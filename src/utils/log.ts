/**
 * Throttled logging utilities to prevent Railway 500 logs/sec limit
 * Replaces per-attempt spam with windowed suppression counters
 */

interface LogRecord {
  t: number;  // timestamp
  c: number;  // count
}

const logHistory: Record<string, LogRecord> = {};

/**
 * Throttled warning - logs at most once per window with suppression counter
 */
export function throttleWarn(key: string, message: string, windowMs = 60000): void {
  const now = Date.now();
  const record = logHistory[key] || { t: 0, c: 0 };
  
  if (now - record.t > windowMs) {
    // Time to log again
    const suffix = record.c > 0 ? ` (suppressed ${record.c} repeats)` : '';
    console.warn(message + suffix);
    logHistory[key] = { t: now, c: 0 };
  } else {
    // Within window, increment suppression counter
    record.c++;
    logHistory[key] = record;
  }
}

/**
 * Throttled error - logs at most once per window with suppression counter
 */
export function throttleError(key: string, message: string, windowMs = 60000): void {
  const now = Date.now();
  const record = logHistory[key] || { t: 0, c: 0 };
  
  if (now - record.t > windowMs) {
    // Time to log again
    const suffix = record.c > 0 ? ` (suppressed ${record.c} repeats)` : '';
    console.error(message + suffix);
    logHistory[key] = { t: now, c: 0 };
  } else {
    // Within window, increment suppression counter
    record.c++;
    logHistory[key] = record;
  }
}

/**
 * Throttled info - logs at most once per window with suppression counter
 */
export function throttleInfo(key: string, message: string, windowMs = 60000): void {
  const now = Date.now();
  const record = logHistory[key] || { t: 0, c: 0 };
  
  if (now - record.t > windowMs) {
    // Time to log again
    const suffix = record.c > 0 ? ` (suppressed ${record.c} repeats)` : '';
    console.log(message + suffix);
    logHistory[key] = { t: now, c: 0 };
  } else {
    // Within window, increment suppression counter
    record.c++;
    logHistory[key] = record;
  }
}

/**
 * Log only the first attempt and final result to reduce spam
 */
export function logAttempt(key: string, attempt: number, maxAttempts: number, message: string): void {
  if (attempt === 1) {
    console.log(`🔄 ${message} (attempt ${attempt}/${maxAttempts})`);
  } else if (attempt === maxAttempts) {
    console.error(`❌ ${message} (final attempt ${attempt}/${maxAttempts})`);
  }
  // Suppress intermediate attempts
}

/**
 * Clear log history (useful for testing)
 */
export function clearLogHistory(): void {
  Object.keys(logHistory).forEach(key => delete logHistory[key]);
}

/**
 * Get current suppression stats
 */
export function getLogStats(): Record<string, LogRecord> {
  return { ...logHistory };
}
