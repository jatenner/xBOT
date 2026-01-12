/**
 * 🎯 ANCESTRY CONCURRENCY LIMITER
 * 
 * Limits concurrent ancestry resolutions to prevent browser pool overload.
 * Uses a simple semaphore pattern to cap concurrency.
 */

class AncestryConcurrencyLimiter {
  private maxConcurrent: number;
  private current: number = 0;
  private queue: Array<() => void> = [];
  
  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
  }
  
  /**
   * Acquire a slot for ancestry resolution
   * Returns a release function that must be called when done
   */
  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve(() => this.release());
      } else {
        // Queue the request
        this.queue.push(() => {
          this.current++;
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
    const maxConcurrent = parseInt(process.env.ANCESTRY_MAX_CONCURRENT || '2', 10);
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
