/**
 * 🔥 BACKGROUND CLEANUP SYSTEM
 * 
 * Runs cleanup operations in the background without blocking operations.
 * Uses fire-and-forget pattern with proper error handling.
 */

import { MemoryMonitor } from './memoryMonitor';

interface CleanupTask {
  id: string;
  fn: () => Promise<void>;
  priority: 'low' | 'medium' | 'high';
  scheduledAt: number;
}

class BackgroundCleanupManager {
  private static instance: BackgroundCleanupManager;
  private cleanupQueue: CleanupTask[] = [];
  private isProcessing = false;
  private activeCleanups = new Set<string>();
  private maxConcurrentCleanups = 1; // Only one cleanup at a time

  private constructor() {
    // Start background processor
    this.startBackgroundProcessor();
  }

  public static getInstance(): BackgroundCleanupManager {
    if (!BackgroundCleanupManager.instance) {
      BackgroundCleanupManager.instance = new BackgroundCleanupManager();
    }
    return BackgroundCleanupManager.instance;
  }

  /**
   * Schedule cleanup to run in background (non-blocking)
   */
  public scheduleCleanup(
    id: string,
    cleanupFn: () => Promise<void>,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): void {
    // Don't schedule if already running
    if (this.activeCleanups.has(id)) {
      return;
    }

    this.cleanupQueue.push({
      id,
      fn: cleanupFn,
      priority,
      scheduledAt: Date.now()
    });

    // Sort by priority (high first)
    this.cleanupQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    console.log(`🧹 [BACKGROUND_CLEANUP] Scheduled cleanup: ${id} (priority: ${priority}, queue: ${this.cleanupQueue.length})`);
  }

  /**
   * Process cleanup queue in background
   */
  private async startBackgroundProcessor(): Promise<void> {
    // Process queue every 2 seconds
    setInterval(async () => {
      if (this.isProcessing || this.cleanupQueue.length === 0) {
        return;
      }

      // Check if we can run cleanup (not too many concurrent)
      if (this.activeCleanups.size >= this.maxConcurrentCleanups) {
        return;
      }

      const task = this.cleanupQueue.shift();
      if (!task) return;

      this.isProcessing = true;
      this.activeCleanups.add(task.id);

      // Run cleanup in background (fire and forget)
      this.runCleanupInBackground(task).catch(err => {
        console.error(`🧹 [BACKGROUND_CLEANUP] Cleanup ${task.id} failed:`, err.message);
      }).finally(() => {
        this.activeCleanups.delete(task.id);
        this.isProcessing = false;
      });
    }, 2000); // Check every 2 seconds
  }

  /**
   * Run cleanup in background without blocking
   */
  private async runCleanupInBackground(task: CleanupTask): Promise<void> {
    console.log(`🧹 [BACKGROUND_CLEANUP] Starting cleanup: ${task.id}`);
    const startTime = Date.now();

    try {
      // Run cleanup (non-blocking)
      await task.fn();
      
      const duration = Date.now() - startTime;
      console.log(`✅ [BACKGROUND_CLEANUP] Completed cleanup: ${task.id} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [BACKGROUND_CLEANUP] Cleanup ${task.id} failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Check if cleanup is currently running
   */
  public isCleanupActive(id: string): boolean {
    return this.activeCleanups.has(id);
  }

  /**
   * Get cleanup status
   */
  public getStatus(): {
    queueLength: number;
    activeCleanups: number;
    isProcessing: boolean;
  } {
    return {
      queueLength: this.cleanupQueue.length,
      activeCleanups: this.activeCleanups.size,
      isProcessing: this.isProcessing
    };
  }
}

/**
 * Schedule memory cleanup in background (non-blocking)
 */
export async function scheduleBackgroundMemoryCleanup(): Promise<void> {
  const manager = BackgroundCleanupManager.getInstance();
  
  manager.scheduleCleanup(
    'memory_cleanup',
    async () => {
      const memory = MemoryMonitor.checkMemory();
      
      if (memory.rssMB > 350) {
        console.log(`🧹 [BACKGROUND_CLEANUP] Memory cleanup: ${memory.rssMB}MB`);
        await MemoryMonitor.emergencyCleanup();
        
        const after = MemoryMonitor.checkMemory();
        console.log(`✅ [BACKGROUND_CLEANUP] Memory cleanup complete: ${after.rssMB}MB`);
      }
    },
    'high' // High priority for memory cleanup
  );
}

/**
 * Schedule browser cleanup in background (non-blocking)
 */
export async function scheduleBackgroundBrowserCleanup(aggressive: boolean = false): Promise<void> {
  const manager = BackgroundCleanupManager.getInstance();
  
  manager.scheduleCleanup(
    `browser_cleanup_${aggressive ? 'aggressive' : 'standard'}`,
    async () => {
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      
      if (pool.emergencyCleanup) {
        console.log(`🧹 [BACKGROUND_CLEANUP] Browser cleanup (aggressive: ${aggressive})`);
        await pool.emergencyCleanup(aggressive);
        console.log(`✅ [BACKGROUND_CLEANUP] Browser cleanup complete`);
      }
    },
    aggressive ? 'high' : 'medium'
  );
}

export { BackgroundCleanupManager };

