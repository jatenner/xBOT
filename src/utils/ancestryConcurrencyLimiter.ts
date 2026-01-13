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
  
  constructor(maxConcurrent: number = 1) { // 🎯 LOAD SHAPING: Default to 1 (was 2)
    this.maxConcurrent = maxConcurrent;
  }
  
  /**
   * Acquire a slot for ancestry resolution
   * Returns a release function that must be called when done
   * 🎯 FIX: Allow queuing up to maxConcurrent instead of immediately rejecting
   */
  async acquire(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      // If we have capacity, grant immediately
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve(() => this.release());
        return;
      }
      
      // If queue is full (>= maxConcurrent), reject to prevent unbounded growth
      if (this.queue.length >= this.maxConcurrent) {
        console.warn(`[ANCESTRY_LIMITER] ⚠️ Queue full: rejecting request (current=${this.current}/${this.maxConcurrent}, queue=${this.queue.length})`);
        reject(new Error(`ANCESTRY_SKIPPED_OVERLOAD: queue full (current=${this.current}/${this.maxConcurrent}, queue=${this.queue.length})`));
        return;
      }
      
      // Queue the request (queue.length < maxConcurrent)
      this.queue.push(() => {
        this.current++;
        resolve(() => this.release());
      });
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
