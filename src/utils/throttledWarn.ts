/**
 * Throttled warning utility to prevent log spam
 * Logs at most once per 60 seconds with suppression counter
 */

interface ThrottleState {
  lastWarn: number;
  suppressed: number;
}

const throttleStates = new Map<string, ThrottleState>();
const THROTTLE_WINDOW_MS = 60_000; // 60 seconds

/**
 * Log a warning message at most once per 60 seconds
 * Shows suppression counter for repeated messages
 */
export function throttledWarn(message: string, key?: string): void {
  const throttleKey = key || message;
  const now = Date.now();
  
  let state = throttleStates.get(throttleKey);
  if (!state) {
    state = { lastWarn: 0, suppressed: 0 };
    throttleStates.set(throttleKey, state);
  }

  if (now - state.lastWarn > THROTTLE_WINDOW_MS) {
    // Time to log again
    const suffix = state.suppressed > 0 ? ` (suppressed ${state.suppressed} repeats)` : '';
    console.warn('⚠️', message + suffix);
    
    state.lastWarn = now;
    state.suppressed = 0;
  } else {
    // Within throttle window, increment suppression counter
    state.suppressed++;
  }
}

/**
 * Log an error message at most once per 60 seconds
 * Shows suppression counter for repeated messages
 */
export function throttledError(message: string, key?: string): void {
  const throttleKey = key || message;
  const now = Date.now();
  
  let state = throttleStates.get(throttleKey);
  if (!state) {
    state = { lastWarn: 0, suppressed: 0 };
    throttleStates.set(throttleKey, state);
  }

  if (now - state.lastWarn > THROTTLE_WINDOW_MS) {
    // Time to log again
    const suffix = state.suppressed > 0 ? ` (suppressed ${state.suppressed} repeats)` : '';
    console.error('❌', message + suffix);
    
    state.lastWarn = now;
    state.suppressed = 0;
  } else {
    // Within throttle window, increment suppression counter
    state.suppressed++;
  }
}

/**
 * Log an info message at most once per 60 seconds
 * Shows suppression counter for repeated messages
 */
export function throttledInfo(message: string, key?: string): void {
  const throttleKey = key || message;
  const now = Date.now();
  
  let state = throttleStates.get(throttleKey);
  if (!state) {
    state = { lastWarn: 0, suppressed: 0 };
    throttleStates.set(throttleKey, state);
  }

  if (now - state.lastWarn > THROTTLE_WINDOW_MS) {
    // Time to log again
    const suffix = state.suppressed > 0 ? ` (suppressed ${state.suppressed} repeats)` : '';
    console.log('ℹ️', message + suffix);
    
    state.lastWarn = now;
    state.suppressed = 0;
  } else {
    // Within throttle window, increment suppression counter
    state.suppressed++;
  }
}

/**
 * Clear all throttle states (useful for testing)
 */
export function clearThrottleStates(): void {
  throttleStates.clear();
}

/**
 * Get current throttle statistics
 */
export function getThrottleStats(): Record<string, ThrottleState> {
  return Object.fromEntries(throttleStates.entries());
}
