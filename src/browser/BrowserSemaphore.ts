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
 * Includes timeout to prevent deadlocks from hung browser operations
 */
export async function withBrowserLock<T>(
  jobName: string,
  priority: number,
  operation: () => Promise<T>
): Promise<T> {
  const semaphore = BrowserSemaphore.getInstance();
  
  await semaphore.acquire(jobName, priority);
  
  try {
    // 🔧 FIX #4: Improved timeout handling with graceful degradation
    // If browser pool is corrupted (EAGAIN errors), operation may hang forever
    const BROWSER_OP_TIMEOUT = Number(process.env.BROWSER_LOCK_TIMEOUT_MS ?? 180000); // default 3 minutes
    const WARNING_TIMEOUT = Math.floor(BROWSER_OP_TIMEOUT * 0.5); // Warn at 50% of timeout
    
    let warningLogged = false;
    const warningTimer = setTimeout(() => {
      if (!warningLogged) {
        console.warn(`[BROWSER_SEM] ⏱️ WARNING: ${jobName} taking longer than expected (${WARNING_TIMEOUT/1000}s)`);
        warningLogged = true;
      }
    }, WARNING_TIMEOUT);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        clearTimeout(warningTimer);
        console.error(`[BROWSER_SEM] ⏱️ TIMEOUT: ${jobName} exceeded ${BROWSER_OP_TIMEOUT/1000}s - force releasing lock`);
        reject(new Error(`Browser operation timeout after ${BROWSER_OP_TIMEOUT/1000}s`));
      }, BROWSER_OP_TIMEOUT);
    });
    
    try {
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      clearTimeout(warningTimer);
      return result;
    } catch (error) {
      clearTimeout(warningTimer);
      // ✅ GRACEFUL: Log timeout but don't crash - allow system to continue
      console.error(`[BROWSER_SEM] ❌ Operation failed for ${jobName}:`, error instanceof Error ? error.message : String(error));
      throw error; // Re-throw to allow caller to handle
    }
  } finally {
    // ALWAYS release, even on timeout or error
    semaphore.release(jobName);
  }
}

/**
 * Priority levels for common jobs
 */
export const BrowserPriority = {
  REPLIES: 0,        // 🔥 ABSOLUTE HIGHEST - reply posting never waits (4/hour guarantee)
  POSTING: 1,        // High - main content posting
  METRICS: 2,        // High - critical for dashboard/learning data
  HARVESTING: 3,     // Third - feeds reply system
  FOLLOWER_TRACK: 4, // Medium - important but not urgent
  ANALYTICS: 6       // Lowest - background data
} as const;

