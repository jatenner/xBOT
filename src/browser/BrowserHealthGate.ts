/**
 * BrowserHealthGate
 * Lightweight health probe for the browser pool that avoids heavy launches.
 * Strategy:
 * - Try to acquire a page with a very short timeout (1500ms)
 * - If success → healthy
 * - If timeout or error → degraded
 */
import { UnifiedBrowserPool } from './UnifiedBrowserPool';

export type BrowserHealthStatus = 'healthy' | 'degraded';

export async function getBrowserHealth(): Promise<BrowserHealthStatus> {
  try {
    const pool = UnifiedBrowserPool.getInstance();
    const PAGE_TIMEOUT_MS = Number(process.env.BROWSER_HEALTH_TIMEOUT_MS ?? 1500);
    
    const acquire = (async () => {
      const page = await pool.acquirePage('health_probe');
      try {
        // Very cheap op to ensure page is valid
        await page.evaluate(() => 1);
      } finally {
        await page.close().catch(() => {});
      }
    })();
    
    await Promise.race([
      acquire,
      new Promise((_, reject) => setTimeout(() => reject(new Error('probe_timeout')), PAGE_TIMEOUT_MS))
    ]);
    return 'healthy';
  } catch {
    return 'degraded';
  }
}

export async function shouldRunLowPriority(): Promise<boolean> {
  const status = await getBrowserHealth();
  return status === 'healthy';
}


