/**
 * ⏱️ OPERATION TIMEOUT UTILITY
 * 
 * Prevents operations from hanging indefinitely by enforcing maximum time limits.
 * Critical for preventing system-wide outages from hung browser operations.
 */

export interface TimeoutOptions {
  timeoutMs: number;
  operationName: string;
  onTimeout?: () => void | Promise<void>;
}

/**
 * Execute an operation with a maximum time limit
 * 
 * @param operation - The async operation to execute
 * @param options - Timeout configuration
 * @returns The result of the operation
 * @throws Error if operation exceeds timeout
 * 
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => page.waitForSelector('.tweet'),
 *   { timeoutMs: 10000, operationName: 'wait_for_tweet' }
 * );
 * ```
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, operationName, onTimeout } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let operationCompleted = false;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (!operationCompleted) {
        operationCompleted = true;
        const error = new Error(`${operationName} timed out after ${timeoutMs}ms`);
        error.name = 'OperationTimeout';
        
        // Execute timeout callback if provided
        if (onTimeout) {
          Promise.resolve(onTimeout()).catch(err => {
            console.error(`[TIMEOUT] Error in onTimeout callback:`, err);
          });
        }
        
        reject(error);
      }
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([
      operation(),
      timeoutPromise
    ]);
    
    // Operation completed successfully
    operationCompleted = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    return result;
  } catch (error) {
    operationCompleted = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Re-throw the error (either from operation or timeout)
    throw error;
  }
}

/**
 * Wrap a function to always enforce a timeout
 * 
 * @example
 * ```typescript
 * const safeWait = withTimeoutWrapper(
 *   (selector: string) => page.waitForSelector(selector),
 *   { timeoutMs: 10000, operationName: 'wait_for_selector' }
 * );
 * 
 * await safeWait('.tweet');
 * ```
 */
export function withTimeoutWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Omit<TimeoutOptions, 'operationName'> & { operationName?: string }
): T {
  return (async (...args: Parameters<T>) => {
    const operationName = options.operationName || fn.name || 'operation';
    return withTimeout(
      () => fn(...args),
      { ...options, operationName }
    );
  }) as T;
}

/**
 * Replace unbounded waitForLoadState with bounded alternative
 * 
 * @param page - Playwright page
 * @param timeoutMs - Maximum wait time (default: 10000ms)
 * @returns Promise that resolves when page loads or times out
 */
export async function waitForPageLoad(page: any, timeoutMs: number = 10000): Promise<void> {
  // Wait for 'load' state (faster, more reliable than 'networkidle')
  // Then add a short timeout to ensure page is ready
  await Promise.race([
    page.waitForLoadState('load', { timeout: timeoutMs }),
    new Promise<void>((resolve) => setTimeout(() => resolve(), timeoutMs))
  ]);
}

