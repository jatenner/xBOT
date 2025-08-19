/**
 * Error Recovery System
 * Provides intelligent retry logic and fallback mechanisms
 */

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringWindowMs: number;
}

class ErrorRecoveryManager {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  
  /**
   * Execute function with exponential backoff retry
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    identifier?: string
  ): Promise<T> {
    const fullConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
      ...config
    };

    let lastError: Error;
    
    for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        // Reset circuit breaker on success
        if (identifier && this.circuitBreakers.has(identifier)) {
          this.resetCircuitBreaker(identifier);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Record failure for circuit breaker
        if (identifier) {
          this.recordFailure(identifier);
        }
        
        // Don't retry on last attempt
        if (attempt === fullConfig.maxAttempts) {
          break;
        }
        
        // Calculate delay with exponential backoff and optional jitter
        let delay = Math.min(
          fullConfig.baseDelayMs * Math.pow(fullConfig.backoffMultiplier, attempt - 1),
          fullConfig.maxDelayMs
        );
        
        if (fullConfig.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5); // 50-100% of calculated delay
        }
        
        console.warn(`ERROR_RECOVERY: Attempt ${attempt}/${fullConfig.maxAttempts} failed, retrying in ${Math.round(delay)}ms:`, 
                    lastError.message.substring(0, 100));
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    identifier: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): Promise<T> {
    const fullConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringWindowMs: 300000, // 5 minutes
      ...config
    };

    const breaker = this.getOrCreateCircuitBreaker(identifier, fullConfig);
    
    // Check if circuit is open
    if (breaker.state === 'open') {
      const timeSinceOpened = Date.now() - breaker.lastFailureTime;
      if (timeSinceOpened < fullConfig.resetTimeoutMs) {
        throw new Error(`Circuit breaker open for ${identifier}. Retry in ${Math.ceil((fullConfig.resetTimeoutMs - timeSinceOpened) / 1000)}s`);
      } else {
        // Try to half-open
        breaker.state = 'half-open';
        console.log(`ERROR_RECOVERY: Circuit breaker half-open for ${identifier}, testing...`);
      }
    }

    try {
      const result = await fn();
      
      // Success - reset or close circuit
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = [];
        console.log(`ERROR_RECOVERY: Circuit breaker closed for ${identifier}`);
      }
      
      return result;
    } catch (error) {
      this.recordFailure(identifier);
      
      if (breaker.state === 'half-open') {
        breaker.state = 'open';
        breaker.lastFailureTime = Date.now();
        console.warn(`ERROR_RECOVERY: Circuit breaker re-opened for ${identifier}`);
      }
      
      throw error;
    }
  }

  /**
   * Execute with both retry and circuit breaker
   */
  async withRecovery<T>(
    fn: () => Promise<T>,
    identifier: string,
    retryConfig: Partial<RetryConfig> = {},
    circuitConfig: Partial<CircuitBreakerConfig> = {}
  ): Promise<T> {
    return this.withCircuitBreaker(
      () => this.withRetry(fn, retryConfig, identifier),
      identifier,
      circuitConfig
    );
  }

  /**
   * Get or create circuit breaker state
   */
  private getOrCreateCircuitBreaker(identifier: string, config: CircuitBreakerConfig): CircuitBreakerState {
    if (!this.circuitBreakers.has(identifier)) {
      this.circuitBreakers.set(identifier, {
        state: 'closed',
        failures: [],
        lastFailureTime: 0,
        config
      });
    }
    return this.circuitBreakers.get(identifier)!;
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordFailure(identifier: string) {
    const breaker = this.circuitBreakers.get(identifier);
    if (!breaker) return;

    const now = Date.now();
    breaker.failures.push(now);
    breaker.lastFailureTime = now;

    // Clean old failures outside monitoring window
    const cutoff = now - breaker.config.monitoringWindowMs;
    breaker.failures = breaker.failures.filter(time => time > cutoff);

    // Check if we should open the circuit
    if (breaker.failures.length >= breaker.config.failureThreshold && breaker.state === 'closed') {
      breaker.state = 'open';
      console.warn(`ERROR_RECOVERY: Circuit breaker opened for ${identifier} after ${breaker.failures.length} failures`);
    }
  }

  /**
   * Reset circuit breaker
   */
  private resetCircuitBreaker(identifier: string) {
    const breaker = this.circuitBreakers.get(identifier);
    if (!breaker) return;

    breaker.state = 'closed';
    breaker.failures = [];
    breaker.lastFailureTime = 0;
  }

  /**
   * Get status of all circuit breakers
   */
  getStatus() {
    const status: Record<string, any> = {};
    
    for (const [identifier, breaker] of this.circuitBreakers.entries()) {
      status[identifier] = {
        state: breaker.state,
        failureCount: breaker.failures.length,
        lastFailure: breaker.lastFailureTime > 0 ? new Date(breaker.lastFailureTime).toISOString() : null
      };
    }
    
    return status;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number[];
  lastFailureTime: number;
  config: CircuitBreakerConfig;
}

// Global instance
export const errorRecovery = new ErrorRecoveryManager();

// Convenience functions
export const withRetry = <T>(fn: () => Promise<T>, config?: Partial<RetryConfig>, identifier?: string) =>
  errorRecovery.withRetry(fn, config, identifier);

export const withCircuitBreaker = <T>(fn: () => Promise<T>, identifier: string, config?: Partial<CircuitBreakerConfig>) =>
  errorRecovery.withCircuitBreaker(fn, identifier, config);

export const withRecovery = <T>(fn: () => Promise<T>, identifier: string, retryConfig?: Partial<RetryConfig>, circuitConfig?: Partial<CircuitBreakerConfig>) =>
  errorRecovery.withRecovery(fn, identifier, retryConfig, circuitConfig);
