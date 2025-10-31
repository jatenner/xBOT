/**
 * 🔒 BROWSER SEMAPHORE
 * Ensures only ONE browser-heavy operation runs at a time
 * Prevents memory exhaustion from concurrent browser contexts
 */

interface QueuedOperation {
  priority: number;
  jobName: string;
  resolve: () => void;
  timestamp: number;
}

export class BrowserSemaphore {
  private static instance: BrowserSemaphore;
  private maxConcurrent = 1; // Only 1 browser operation at a time
  private currentUsers = 0;
  private queue: QueuedOperation[] = [];
  private activeJobs: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): BrowserSemaphore {
    if (!BrowserSemaphore.instance) {
      BrowserSemaphore.instance = new BrowserSemaphore();
    }
    return BrowserSemaphore.instance;
  }

  /**
   * Acquire browser lock (wait if busy)
   * @param jobName Name of the job requesting browser
   * @param priority Lower = higher priority (1 = highest)
   */
  public async acquire(jobName: string, priority: number = 5): Promise<void> {
    // If slot available, take it immediately
    if (this.currentUsers < this.maxConcurrent) {
      this.currentUsers++;
      this.activeJobs.add(jobName);
      console.log(`[BROWSER_SEM] 🔓 ${jobName} acquired browser (priority ${priority})`);
      return;
    }

    // Wait in priority queue
    console.log(`[BROWSER_SEM] ⏳ ${jobName} waiting (priority ${priority}, queue: ${this.queue.length})`);
    
    return new Promise<void>((resolve) => {
      this.queue.push({
        priority,
        jobName,
        resolve,
        timestamp: Date.now()
      });
      
      // Sort by priority (lower number = higher priority)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.timestamp - b.timestamp; // FIFO for same priority
      });
    });
  }

  /**
   * Release browser lock (allow next job to proceed)
   */
  public release(jobName: string): void {
    this.currentUsers--;
    this.activeJobs.delete(jobName);
    
    console.log(`[BROWSER_SEM] 🔐 ${jobName} released browser (queue: ${this.queue.length})`);

    // Process next in queue
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.currentUsers++;
      this.activeJobs.add(next.jobName);
      
      const waitTime = Date.now() - next.timestamp;
      console.log(`[BROWSER_SEM] 🔓 ${next.jobName} acquired browser (waited ${Math.round(waitTime / 1000)}s)`);
      
      next.resolve();
    }
  }

  /**
   * Get current status (for monitoring)
   */
  public getStatus(): { active: string[]; queued: number; capacity: number } {
    return {
      active: Array.from(this.activeJobs),
      queued: this.queue.length,
      capacity: this.maxConcurrent - this.currentUsers
    };
  }

  /**
   * Force release all locks (emergency use only)
   */
  public forceReleaseAll(): void {
    console.warn('[BROWSER_SEM] ⚠️ Force releasing all browser locks');
    this.currentUsers = 0;
    this.activeJobs.clear();
    
    // Release all queued operations
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.resolve();
    }
  }
}

/**
 * Helper to wrap browser operations with semaphore
 */
export async function withBrowserLock<T>(
  jobName: string,
  priority: number,
  operation: () => Promise<T>
): Promise<T> {
  const semaphore = BrowserSemaphore.getInstance();
  
  await semaphore.acquire(jobName, priority);
  
  try {
    return await operation();
  } finally {
    semaphore.release(jobName);
  }
}

/**
 * Priority levels for common jobs
 */
export const BrowserPriority = {
  POSTING: 1,        // Highest - never wait
  REPLIES: 2,        // Second - core engagement
  HARVESTING: 3,     // Third - feeds reply system
  METRICS: 5,        // Low - can wait
  ANALYTICS: 6,      // Lowest - background data
  FOLLOWER_TRACK: 4  // Medium - important but not urgent
} as const;

