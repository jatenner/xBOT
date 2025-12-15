/**
 * 🧠 MEMORY MONITOR
 * 
 * Monitors system memory usage and triggers automatic cleanup to prevent OOM crashes.
 * Critical for Railway's 512MB memory limit.
 */

export interface MemoryStatus {
  status: 'ok' | 'warning' | 'critical';
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
}

export class MemoryMonitor {
  // 🔧 UPDATED for 2GB Railway Pro plan (was 512MB)
  private static readonly WARNING_THRESHOLD = 1200; // MB - Start monitoring closely (60% of 2GB)
  private static readonly CRITICAL_THRESHOLD = 1600; // MB - Emergency cleanup needed (80% of 2GB)
  private static readonly EMERGENCY_THRESHOLD = 1800; // MB - Force cleanup or restart (90% of 2GB)
  
  /**
   * Check current memory usage
   */
  static checkMemory(): MemoryStatus {
    const usage = process.memoryUsage();
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const externalMB = Math.round(usage.external / 1024 / 1024);
    
    let status: 'ok' | 'warning' | 'critical';
    if (rssMB > this.CRITICAL_THRESHOLD) {
      status = 'critical';
    } else if (rssMB > this.WARNING_THRESHOLD) {
      status = 'warning';
    } else {
      status = 'ok';
    }
    
    return {
      status,
      rssMB,
      heapUsedMB,
      heapTotalMB,
      externalMB
    };
  }
  
  /**
   * Perform emergency memory cleanup
   */
  static async emergencyCleanup(): Promise<{ freedMB: number; success: boolean }> {
    const before = this.checkMemory();
    
    try {
      // Force garbage collection multiple times
      if (global.gc) {
        for (let i = 0; i < 5; i++) {
          global.gc();
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      // Clean browser pool if available
      // 🔥 FIX: Use aggressive mode when memory is critical to force close all contexts
      try {
        const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
        const pool = UnifiedBrowserPool.getInstance();
        if (pool.emergencyCleanup) {
          // Use aggressive cleanup if memory is above critical threshold
          const isCritical = before.rssMB > this.CRITICAL_THRESHOLD;
          await pool.emergencyCleanup(isCritical);
        }
      } catch (e) {
        // Browser pool might not be available, continue anyway
        console.warn(`🧠 [MEMORY_MONITOR] Browser pool cleanup failed:`, e);
      }
      
      const after = this.checkMemory();
      const freedMB = before.rssMB - after.rssMB;
      
      console.log(`🧠 [MEMORY_MONITOR] Emergency cleanup: ${before.rssMB}MB → ${after.rssMB}MB (freed ${freedMB}MB)`);
      
      // 🔥 CRITICAL FIX: If cleanup freed 0MB and memory still critical, force browser restart
      // This is the only way to actually free browser memory (browser contexts don't release memory)
      if (freedMB === 0 && after.rssMB > this.CRITICAL_THRESHOLD) {
        console.error(`🧠 [MEMORY_MONITOR] 🚨 Cleanup freed 0MB but memory still critical (${after.rssMB}MB) - forcing browser restart...`);
        try {
          const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          
          // Use emergency cleanup with aggressive mode to force browser restart
          // This will close all contexts and browser, freeing memory
          await pool.emergencyCleanup(true); // Aggressive mode = closes browser
          
          // Check memory after browser restart
          await new Promise(r => setTimeout(r, 2000)); // Give OS time to reclaim memory
          const afterRestart = this.checkMemory();
          const restartFreedMB = after.rssMB - afterRestart.rssMB;
          
          if (restartFreedMB > 0) {
            console.log(`🧠 [MEMORY_MONITOR] ✅ Browser restart freed ${restartFreedMB}MB: ${after.rssMB}MB → ${afterRestart.rssMB}MB`);
          } else {
            console.warn(`🧠 [MEMORY_MONITOR] ⚠️ Browser restart didn't free memory immediately (may take time to reflect)`);
          }
          
          return {
            freedMB: Math.max(0, freedMB + Math.max(0, restartFreedMB)),
            success: true
          };
        } catch (restartError: any) {
          console.error(`🧠 [MEMORY_MONITOR] ⚠️ Browser restart failed:`, restartError.message);
        }
      }
      
      return {
        freedMB: Math.max(0, freedMB),
        success: true
      };
    } catch (error: any) {
      console.error(`🧠 [MEMORY_MONITOR] Emergency cleanup failed:`, error.message);
      return {
        freedMB: 0,
        success: false
      };
    }
  }
  
  /**
   * Check if memory is safe for new operations
   */
  static isSafeForOperation(): boolean {
    const memory = this.checkMemory();
    return memory.status !== 'critical';
  }
  
  /**
   * Get memory status message for logging
   */
  static getStatusMessage(): string {
    const memory = this.checkMemory();
    const icon = memory.status === 'critical' ? '🚨' : memory.status === 'warning' ? '⚠️' : '✅';
    return `${icon} Memory: ${memory.rssMB}MB RSS, ${memory.heapUsedMB}/${memory.heapTotalMB}MB heap (${memory.status})`;
  }
}

