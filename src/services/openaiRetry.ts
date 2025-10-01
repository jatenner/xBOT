/**
 * 🔄 OPENAI RETRY LOGIC
 * 
 * Exponential backoff with jitter for OpenAI 429/5xx errors
 * Max retries: 4
 * Delays: 500ms, 1s, 2s, 4s, 8s (capped at 10s with jitter)
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 4,
  baseDelayMs: 500,
  maxDelayMs: 10000 // 10s cap
};

/**
 * Execute OpenAI call with exponential backoff on 429 errors
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );
        const jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter
        const delay = baseDelay + jitter;

        console.log(
          `[OPENAI_BACKOFF] ⏱️  Retry ${attempt}/${config.maxRetries} for ${context} ` +
          `after ${Math.round(delay)}ms`
        );
        await sleep(delay);
      }

      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a retryable error (429 or 5xx)
      if (isRetryableError(error)) {
        const errorType = is429Error(error) ? '429 rate limit' : '5xx server error';
        console.warn(
          `[OPENAI_RETRY] ⚠️  ${errorType} hit for ${context} ` +
          `(attempt=${attempt + 1}/${config.maxRetries + 1})`
        );

        if (attempt < config.maxRetries) {
          continue; // Retry
        } else {
          console.error(
            `[OPENAI_RETRY] ❌ Max retries exceeded for ${context}, giving up`
          );
          throw error;
        }
      }

      // For non-retryable errors, throw immediately
      console.error(`[OPENAI_RETRY] ❌ Non-retryable error for ${context}: ${error.message}`);
      throw error;
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable (429 or 5xx)
 */
function isRetryableError(error: any): boolean {
  return is429Error(error) || is5xxError(error);
}

/**
 * Check if error is a 429 rate limit error
 */
function is429Error(error: any): boolean {
  if (!error) return false;

  // Check OpenAI SDK error structure
  if (error.status === 429) return true;
  if (error.statusCode === 429) return true;
  if (error.code === 'rate_limit_exceeded') return true;
  if (error.type === 'insufficient_quota') return true;

  // Check error message
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('insufficient_quota')
  );
}

/**
 * Check if error is a 5xx server error
 */
function is5xxError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode;
  if (status && status >= 500 && status < 600) return true;

  const message = (error.message || '').toLowerCase();
  return (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout')
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error indicates quota exhaustion (no retry)
 */
export function isQuotaExhausted(error: any): boolean {
  if (!error) return false;

  const message = (error.message || '').toLowerCase();
  return (
    message.includes('insufficient_quota') ||
    message.includes('quota exceeded') ||
    message.includes('billing')
  );
}
