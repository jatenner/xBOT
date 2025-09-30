/**
 * 🔄 OPENAI RETRY LOGIC
 * 
 * Exponential backoff with jitter for OpenAI 429 rate limit errors
 * Max retries: 2
 * Delays: 500ms, 1s, 2s (with random jitter)
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 2000
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

      // Check if it's a 429 rate limit error
      if (is429Error(error)) {
        console.warn(
          `[OPENAI_BACKOFF] ⚠️  429 rate limit hit for ${context} ` +
          `(attempt ${attempt + 1}/${config.maxRetries + 1})`
        );

        if (attempt < config.maxRetries) {
          continue; // Retry
        } else {
          console.error(
            `[OPENAI_BACKOFF] ❌ Max retries exceeded for ${context}, giving up`
          );
          throw error;
        }
      }

      // For non-429 errors, throw immediately
      console.error(`[OPENAI_BACKOFF] ❌ Non-retryable error for ${context}: ${error.message}`);
      throw error;
    }
  }

  throw lastError;
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
