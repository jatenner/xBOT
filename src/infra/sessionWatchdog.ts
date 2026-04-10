/**
 * 🔄 SESSION WATCHDOG
 *
 * Periodically reloads browser session cookies to prevent silent auth expiry.
 * Integrates with UnifiedBrowserPool.reloadSessionState() and SessionLoader.
 *
 * Default: every 12 hours (SESSION_REFRESH_INTERVAL_MS).
 * Runs non-blocking alongside executor daemon.
 */

const SESSION_REFRESH_INTERVAL_MS = parseInt(
  process.env.SESSION_REFRESH_INTERVAL_MS || String(12 * 60 * 60 * 1000), // 12h default
  10
);
const SESSION_REFRESH_MIN_INTERVAL_MS = 30 * 60 * 1000; // Never refresh more than every 30min

let lastRefreshTime = Date.now();
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;

export interface SessionWatchdogStatus {
  running: boolean;
  lastRefreshTime: string;
  lastRefreshAgeMs: number;
  consecutiveFailures: number;
  nextRefreshInMs: number;
}

/**
 * Attempt to refresh the browser session by reloading cookies from disk/env.
 * Returns true if successful.
 */
async function refreshSession(): Promise<boolean> {
  const prefix = '[SESSION_WATCHDOG]';
  try {
    console.log(`${prefix} 🔄 Starting session refresh...`);

    // Reload session loader (re-reads cookies from file/env)
    const { SessionLoader } = await import('../utils/sessionLoader');
    const session = await SessionLoader.load();
    if (!session || !session.cookies || session.cookies.length === 0) {
      console.warn(`${prefix} ⚠️ Session loader returned empty cookies`);
      consecutiveFailures++;
      return false;
    }
    console.log(`${prefix} ✅ Session loaded: ${session.cookies.length} cookies`);

    // Reload into browser pool (clears cached state, re-applies cookies)
    try {
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      await pool.reloadSessionState();
      console.log(`${prefix} ✅ Browser pool session reloaded`);
    } catch (poolErr: any) {
      console.warn(`${prefix} ⚠️ Browser pool reload failed (pool may not be initialized): ${poolErr.message}`);
      // Non-fatal: pool will pick up new session on next context creation
    }

    lastRefreshTime = Date.now();
    consecutiveFailures = 0;
    console.log(`${prefix} ✅ Session refresh complete`);

    // Log to system_events
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'SESSION_WATCHDOG_REFRESH',
        severity: 'info',
        message: `Session refreshed successfully (${session.cookies.length} cookies)`,
        event_data: {
          cookie_count: session.cookies.length,
          consecutive_failures: 0,
          refresh_interval_ms: SESSION_REFRESH_INTERVAL_MS,
        },
        created_at: new Date().toISOString(),
      });
    } catch { /* non-blocking */ }

    return true;
  } catch (err: any) {
    consecutiveFailures++;
    console.error(`${prefix} ❌ Session refresh failed (attempt ${consecutiveFailures}): ${err.message}`);

    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'SESSION_WATCHDOG_FAILED',
        severity: consecutiveFailures >= 3 ? 'critical' : 'warning',
        message: `Session refresh failed: ${err.message}`,
        event_data: {
          error: err.message,
          consecutive_failures: consecutiveFailures,
        },
        created_at: new Date().toISOString(),
      });
    } catch { /* non-blocking */ }

    return false;
  }
}

/**
 * Start the session watchdog interval.
 * Safe to call multiple times (idempotent).
 */
export function startSessionWatchdog(): void {
  if (refreshIntervalId) return; // Already running

  const intervalMs = Math.max(SESSION_REFRESH_MIN_INTERVAL_MS, SESSION_REFRESH_INTERVAL_MS);
  console.log(`[SESSION_WATCHDOG] ✅ Started (interval: ${Math.round(intervalMs / 60000)}min)`);

  refreshIntervalId = setInterval(async () => {
    const elapsed = Date.now() - lastRefreshTime;
    if (elapsed < SESSION_REFRESH_MIN_INTERVAL_MS) return; // Debounce
    await refreshSession();
  }, intervalMs);
}

/**
 * Stop the session watchdog.
 */
export function stopSessionWatchdog(): void {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    console.log(`[SESSION_WATCHDOG] 🛑 Stopped`);
  }
}

/**
 * Get current watchdog status.
 */
export function getSessionWatchdogStatus(): SessionWatchdogStatus {
  const now = Date.now();
  const intervalMs = Math.max(SESSION_REFRESH_MIN_INTERVAL_MS, SESSION_REFRESH_INTERVAL_MS);
  return {
    running: refreshIntervalId !== null,
    lastRefreshTime: new Date(lastRefreshTime).toISOString(),
    lastRefreshAgeMs: now - lastRefreshTime,
    consecutiveFailures,
    nextRefreshInMs: Math.max(0, intervalMs - (now - lastRefreshTime)),
  };
}

/**
 * Force an immediate refresh (for manual recovery).
 */
export async function forceSessionRefresh(): Promise<boolean> {
  return refreshSession();
}
