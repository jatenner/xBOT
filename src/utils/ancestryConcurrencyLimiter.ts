/**
 * 🎯 ANCESTRY CONCURRENCY LIMITER
 * 
 * Limits concurrent ancestry resolutions to prevent browser pool overload.
 * Uses a simple semaphore pattern to cap concurrency.
 * 
 * 🎯 LOAD SHAPING: Implements "one waiting at a time" rule to prevent pool starvation
 */

class AncestryConcurrencyLimiter {
  private maxConcurrent: number;
  private current: number = 0;
  private queue: Array<() => void> = [];
  private acquireContextWaiting: boolean = false; // Track if acquire_context is waiting
  
  constructor(maxConcurrent: number = 1) { // 🎯 LOAD SHAPING: Default to 1 (was 2)
    this.maxConcurrent = maxConcurrent;
  }
  
  /**
   * Acquire a slot for ancestry resolution
   * Returns a release function that must be called when done
   * 🎯 LOAD SHAPING: Skips if acquire_context is already waiting
   */
  async acquire(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      // 🎯 LOAD SHAPING: If acquire_context is already waiting, skip this request
      if (this.acquireContextWaiting) {
        reject(new Error('ANCESTRY_SKIPPED_OVERLOAD: acquire_context already waiting'));
        return;
      }
      
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve(() => this.release());
      } else {
        // 🎯 LOAD SHAPING: Mark that we're waiting for acquire_context
        this.acquireContextWaiting = true;
        
        // Queue the request
        this.queue.push(() => {
          this.current++;
          this.acquireContextWaiting = false; // Clear waiting flag when we get a slot
          resolve(() => this.release());
        });
      }
    });
  }
  
  private release(): void {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
  
  /**
   * Get current stats for logging
   */
  getStats(): { current: number; queued: number; maxConcurrent: number } {
    return {
      current: this.current,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Singleton instance
let limiter: AncestryConcurrencyLimiter | null = null;

export function getAncestryLimiter(): AncestryConcurrencyLimiter {
  if (!limiter) {
    // 🎯 LOAD SHAPING: Default to 1 (was 2) to reduce pool pressure
    const maxConcurrent = parseInt(process.env.ANCESTRY_MAX_CONCURRENT || '1', 10);
    limiter = new AncestryConcurrencyLimiter(maxConcurrent);
  }
  return limiter;
}

/**
 * Wrap an ancestry resolution function with concurrency limiting
 */
export async function withAncestryLimit<T>(
  fn: () => Promise<T>
): Promise<T> {
  const limiter = getAncestryLimiter();
  const release = await limiter.acquire();
  
  try {
    const stats = limiter.getStats();
    if (stats.queued > 0) {
      console.log(`[ANCESTRY_LIMITER] ⏳ Queued (${stats.queued} waiting, ${stats.current}/${stats.maxConcurrent} active)`);
    }
    
    return await fn();
  } finally {
    release();
  }
}
