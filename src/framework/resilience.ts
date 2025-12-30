/**
 * 🛡️ RESILIENCE FRAMEWORK
 * 
 * Provides circuit breakers, retry logic, and failure recovery
 * to make the system resilient to transient failures.
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  state: 'closed' | 'open' | 'half-open';
  nextAttempt: Date | null;
  consecutiveSuccesses: number;
}

export class ResilienceFramework {
  private static instance: ResilienceFramework;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private defaultCircuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeoutMs: 60000,
    halfOpenMaxAttempts: 3
  };
  
  private constructor() {
    console.log('[RESILIENCE_FRAMEWORK] Initialized');
  }
  
  public static getInstance(): ResilienceFramework {
    if (!ResilienceFramework.instance) {
      ResilienceFramework.instance = new ResilienceFramework();
    }
    return ResilienceFramework.instance;
  }
  
  /**
   * Execute with circuit breaker protection
   */
  async withCircuitBreaker<T>(
    name: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitConfig = { ...this.defaultCircuitConfig, ...config };
    let breaker = this.circuitBreakers.get(name);
    
    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailure: null,
        state: 'closed',
        nextAttempt: null,
        consecutiveSuccesses: 0
      };
      this.circuitBreakers.set(name, breaker);
    }
    
    // Check circuit breaker state
    if (breaker.state === 'open') {
      const now = new Date();
      
      if (breaker.nextAttempt && now < breaker.nextAttempt) {
        throw new Error(`Circuit breaker ${name} is OPEN (resets at ${breaker.nextAttempt.toISOString()})`);
      }
      
      // Timeout expired - move to half-open
      breaker.state = 'half-open';
      breaker.consecutiveSuccesses = 0;
      console.log(`[RESILIENCE] Circuit breaker ${name} moved to HALF-OPEN`);
    }
    
    try {
      const result = await operation();
      
      // Success - reset failure count
      if (breaker.state === 'half-open') {
        breaker.consecutiveSuccesses++;
        if (breaker.consecutiveSuccesses >= circuitConfig.halfOpenMaxAttempts) {
          breaker.state = 'closed';
          breaker.failures = 0;
          console.log(`[RESILIENCE] Circuit breaker ${name} CLOSED (recovered)`);
        }
      } else {
        breaker.failures = 0;
      }
      
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      if (breaker.state === 'half-open') {
        // Failed in half-open - back to open
        breaker.state = 'open';
        breaker.nextAttempt = new Date(Date.now() + circuitConfig.resetTimeoutMs);
        console.error(`[RESILIENCE] Circuit breaker ${name} OPENED (failed in half-open)`);
      } else if (breaker.failures >= circuitConfig.failureThreshold) {
        // Threshold exceeded - open circuit
        breaker.state = 'open';
        breaker.nextAttempt = new Date(Date.now() + circuitConfig.resetTimeoutMs);
        console.error(`[RESILIENCE] Circuit breaker ${name} OPENED (${breaker.failures} failures)`);
      }
      
      throw error;
    }
  }
  
  /**
   * Execute with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig: RetryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['ETIMEDOUT', 'ECONNREFUSED', 'timeout', 'connection'],
      ...config
    };
    
    let lastError: Error | null = null;
    let delay = retryConfig.initialDelayMs;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        const errorMessage = lastError.message.toLowerCase();
        const isRetryable = retryConfig.retryableErrors?.some(pattern =>
          errorMessage.includes(pattern.toLowerCase())
        ) ?? true;
        
        if (!isRetryable || attempt === retryConfig.maxRetries) {
          throw lastError;
        }
        
        // Wait before retry
        console.warn(`[RESILIENCE] Retry attempt ${attempt + 1}/${retryConfig.maxRetries} after ${delay}ms: ${lastError.message.substring(0, 100)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff
        delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
  
  /**
   * Execute with both circuit breaker and retry
   */
  async withResilience<T>(
    circuitName: string,
    operation: () => Promise<T>,
    circuitConfig?: Partial<CircuitBreakerConfig>,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    return this.withCircuitBreaker(
      circuitName,
      () => this.withRetry(operation, retryConfig),
      circuitConfig
    );
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(name: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(name) || null;
  }
  
  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(name: string): void {
    const breaker = this.circuitBreakers.get(name);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.consecutiveSuccesses = 0;
      breaker.nextAttempt = null;
      console.log(`[RESILIENCE] Circuit breaker ${name} manually reset`);
    }
  }
  
  /**
   * Get all circuit breaker statuses
   */
  getAllCircuitBreakerStatuses(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }
  
  /**
   * Get health metrics
   */
  getHealthMetrics(): {
    totalBreakers: number;
    openBreakers: number;
    halfOpenBreakers: number;
    closedBreakers: number;
  } {
    let open = 0;
    let halfOpen = 0;
    let closed = 0;
    
    for (const breaker of this.circuitBreakers.values()) {
      if (breaker.state === 'open') open++;
      else if (breaker.state === 'half-open') halfOpen++;
      else closed++;
    }
    
    return {
      totalBreakers: this.circuitBreakers.size,
      openBreakers: open,
      halfOpenBreakers: halfOpen,
      closedBreakers: closed
    };
  }
}

// Export singleton
export const resilienceFramework = ResilienceFramework.getInstance();


