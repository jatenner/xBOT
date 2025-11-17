/**
 * 🛡️ DATABASE RESILIENCE UTILITY
 * 
 * Provides retry logic, exponential backoff, and circuit breaker pattern
 * for database operations to prevent failures from transient connection issues.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRYABLE_ERRORS = [
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ECONNRESET',
  'timeout',
  'connection',
  'network',
  'temporarily unavailable',
  'too many clients',
  'connection terminated',
  'no connection to the server'
];

/**
 * Execute database operation with automatic retry and exponential backoff
 * 
 * @param operation - The database operation to execute
 * @param options - Retry configuration
 * @returns The result of the operation
 * @throws Error if operation fails after all retries
 * 
 * @example
 * ```typescript
 * const result = await withDbRetry(
 *   () => supabase.from('posts').select().eq('id', postId).single(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
    onRetry
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Success! Reset delay for next operation
      if (attempt > 0) {
        console.log(`[DB_RESILIENCE] ✅ Operation succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      const errorMessage = (error?.message || String(error)).toLowerCase();
      const errorCode = error?.code || error?.code || '';
      
      // Check if error is retryable
      const isRetryable = retryableErrors.some(pattern => 
        errorMessage.includes(pattern.toLowerCase()) || 
        errorCode.includes(pattern)
      );
      
      // If not retryable, fail immediately
      if (!isRetryable) {
        console.error(`[DB_RESILIENCE] ❌ Non-retryable error: ${errorMessage}`);
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt >= maxRetries) {
        console.error(`[DB_RESILIENCE] ❌ Operation failed after ${maxRetries} retries: ${errorMessage}`);
        throw error;
      }
      
      // Log retry attempt
      const attemptNum = attempt + 1;
      console.warn(`[DB_RESILIENCE] ⚠️ Retry ${attemptNum}/${maxRetries} after ${Math.round(delay)}ms: ${errorMessage.substring(0, 100)}`);
      
      if (onRetry) {
        onRetry(attemptNum, error);
      }
      
      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }
  
  // Should never reach here, but TypeScript requires it
  throw lastError || new Error('Database operation failed');
}

/**
 * Circuit breaker state for database operations
 */
class DbCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly failureThreshold = 5;
  private readonly resetTimeoutMs = 60000; // 1 minute

  canAttempt(): boolean {
    const now = Date.now();
    
    if (this.state === 'closed') {
      return true;
    }
    
    if (this.state === 'open') {
      // Check if enough time has passed to try again
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        console.log('[DB_RESILIENCE] 🔄 Circuit breaker: OPEN → HALF-OPEN (attempting recovery)');
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    
    // half-open state - allow one attempt
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      console.log('[DB_RESILIENCE] ✅ Circuit breaker: HALF-OPEN → CLOSED (recovered)');
      this.state = 'closed';
      this.failures = 0;
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'half-open') {
      console.error('[DB_RESILIENCE] ❌ Circuit breaker: HALF-OPEN → OPEN (recovery failed)');
      this.state = 'open';
    } else if (this.state === 'closed' && this.failures >= this.failureThreshold) {
      console.error(`[DB_RESILIENCE] 🚨 Circuit breaker: CLOSED → OPEN (${this.failures} failures)`);
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

// Singleton circuit breaker instance
const circuitBreaker = new DbCircuitBreaker();

/**
 * Execute database operation with circuit breaker protection
 * Prevents cascading failures by stopping attempts when DB is unhealthy
 * 
 * @example
 * ```typescript
 * const result = await withCircuitBreaker(
 *   () => supabase.from('posts').select(),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  retryOptions: RetryOptions = {}
): Promise<T> {
  if (!circuitBreaker.canAttempt()) {
    const error = new Error('Database circuit breaker is OPEN - too many failures');
    error.name = 'CircuitBreakerOpen';
    throw error;
  }
  
  try {
    const result = await withDbRetry(operation, retryOptions);
    circuitBreaker.recordSuccess();
    return result;
  } catch (error) {
    circuitBreaker.recordFailure();
    throw error;
  }
}

/**
 * Get current circuit breaker state (for monitoring)
 */
export function getCircuitBreakerState() {
  return {
    state: circuitBreaker.getState(),
    canAttempt: circuitBreaker.canAttempt()
  };
}

