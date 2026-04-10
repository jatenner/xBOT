/**
 * 🧠 MEMORY WATCHDOG
 *
 * Monitors process memory and browser pool health.
 * Triggers emergency cleanup when memory exceeds thresholds or pool deadlocks.
 *
 * Thresholds:
 *   - WARN: 400MB RSS → log warning
 *   - CLEANUP: 600MB RSS → aggressive pool cleanup
 *   - CRITICAL: 800MB RSS → force pool restart + GC hint
 *
 * Deadlock detection:
 *   - Pool has 0 idle, 0 active, but queue > 0 for > 60s → deadlock
 */

const MEMORY_CHECK_INTERVAL_MS = parseInt(process.env.MEMORY_CHECK_INTERVAL_MS || '30000', 10); // 30s
const MEMORY_WARN_MB = parseInt(process.env.MEMORY_WARN_MB || '400', 10);
const MEMORY_CLEANUP_MB = parseInt(process.env.MEMORY_CLEANUP_MB || '600', 10);
const MEMORY_CRITICAL_MB = parseInt(process.env.MEMORY_CRITICAL_MB || '800', 10);
const DEADLOCK_THRESHOLD_MS = 60_000; // 60s of 0 idle + 0 active + queue > 0

let watchdogIntervalId: ReturnType<typeof setInterval> | null = null;
let deadlockStartTime: number | null = null;
let lastCleanupTime = 0;
let cleanupCount = 0;

export interface MemoryWatchdogStatus {
  running: boolean;
  rssMb: number;
  heapUsedMb: number;
  cleanupCount: number;
  lastCleanupTime: string | null;
  deadlockDetected: boolean;
}

function getMemoryMb(): { rss: number; heapUsed: number; heapTotal: number } {
  const mem = process.memoryUsage();
  return {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
  };
}

async function checkMemoryAndPool(): Promise<void> {
  const prefix = '[MEMORY_WATCHDOG]';
  const mem = getMemoryMb();

  // Check pool state for deadlock detection
  let poolState: { queueLength: number; activeContexts: number; totalContexts: number } | null = null;
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const metrics = pool.getMetrics();
    poolState = {
      queueLength: metrics.queueLength,
      activeContexts: metrics.activeContexts,
      totalContexts: metrics.totalContexts,
    };
  } catch { /* Pool not initialized yet */ }

  // Deadlock detection: queue waiting but no contexts available or active
  if (poolState && poolState.queueLength > 0 && poolState.activeContexts === 0 && poolState.totalContexts === 0) {
    if (!deadlockStartTime) {
      deadlockStartTime = Date.now();
    } else if (Date.now() - deadlockStartTime > DEADLOCK_THRESHOLD_MS) {
      console.error(`${prefix} 🚨 DEADLOCK DETECTED: queue=${poolState.queueLength} active=0 total=0 for ${Math.round((Date.now() - deadlockStartTime) / 1000)}s`);
      await triggerPoolRecovery(prefix, 'deadlock');
      deadlockStartTime = null;
    }
  } else {
    deadlockStartTime = null; // Reset if pool is healthy
  }

  // Memory threshold checks
  if (mem.rss >= MEMORY_CRITICAL_MB) {
    console.error(`${prefix} 🚨 CRITICAL: RSS=${mem.rss}MB (threshold=${MEMORY_CRITICAL_MB}MB) — forcing aggressive cleanup + GC`);
    await triggerPoolRecovery(prefix, 'memory_critical');
    // Hint GC if available
    if (global.gc) {
      global.gc();
      console.log(`${prefix} 🗑️ GC triggered`);
    }
  } else if (mem.rss >= MEMORY_CLEANUP_MB) {
    const timeSinceLastCleanup = Date.now() - lastCleanupTime;
    if (timeSinceLastCleanup > 5 * 60 * 1000) { // Don't cleanup more than every 5min
      console.warn(`${prefix} ⚠️ HIGH MEMORY: RSS=${mem.rss}MB (threshold=${MEMORY_CLEANUP_MB}MB) — running emergency cleanup`);
      await triggerPoolRecovery(prefix, 'memory_high');
    }
  } else if (mem.rss >= MEMORY_WARN_MB) {
    console.log(`${prefix} ⚠️ WARN: RSS=${mem.rss}MB heap=${mem.heapUsed}/${mem.heapTotal}MB`);
  }
}

async function triggerPoolRecovery(prefix: string, reason: string): Promise<void> {
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    await pool.emergencyCleanup(true);
    lastCleanupTime = Date.now();
    cleanupCount++;
    console.log(`${prefix} ✅ Emergency cleanup completed (reason=${reason}, total_cleanups=${cleanupCount})`);

    // Log to system_events
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      const mem = getMemoryMb();
      await supabase.from('system_events').insert({
        event_type: 'MEMORY_WATCHDOG_CLEANUP',
        severity: reason === 'deadlock' || reason === 'memory_critical' ? 'critical' : 'warning',
        message: `Pool cleanup triggered: ${reason} (RSS=${mem.rss}MB)`,
        event_data: { reason, rss_mb: mem.rss, heap_used_mb: mem.heapUsed, cleanup_count: cleanupCount },
        created_at: new Date().toISOString(),
      });
    } catch { /* non-blocking */ }
  } catch (err: any) {
    console.error(`${prefix} ❌ Pool recovery failed: ${err.message}`);
  }
}

/**
 * Start the memory watchdog interval.
 */
export function startMemoryWatchdog(): void {
  if (watchdogIntervalId) return;
  const mem = getMemoryMb();
  console.log(`[MEMORY_WATCHDOG] ✅ Started (interval: ${MEMORY_CHECK_INTERVAL_MS / 1000}s, RSS=${mem.rss}MB, thresholds: warn=${MEMORY_WARN_MB} cleanup=${MEMORY_CLEANUP_MB} critical=${MEMORY_CRITICAL_MB})`);
  watchdogIntervalId = setInterval(() => {
    checkMemoryAndPool().catch((err) => {
      console.error(`[MEMORY_WATCHDOG] ❌ Check failed: ${err.message}`);
    });
  }, MEMORY_CHECK_INTERVAL_MS);
}

/**
 * Stop the memory watchdog.
 */
export function stopMemoryWatchdog(): void {
  if (watchdogIntervalId) {
    clearInterval(watchdogIntervalId);
    watchdogIntervalId = null;
    console.log(`[MEMORY_WATCHDOG] 🛑 Stopped`);
  }
}

/**
 * Get current watchdog status.
 */
export function getMemoryWatchdogStatus(): MemoryWatchdogStatus {
  const mem = getMemoryMb();
  return {
    running: watchdogIntervalId !== null,
    rssMb: mem.rss,
    heapUsedMb: mem.heapUsed,
    cleanupCount,
    lastCleanupTime: lastCleanupTime ? new Date(lastCleanupTime).toISOString() : null,
    deadlockDetected: deadlockStartTime !== null,
  };
}
