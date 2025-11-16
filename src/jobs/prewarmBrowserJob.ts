/**
 * PrewarmBrowserJob
 * Ensures a browser instance is available with exponential backoff when launches fail.
 * Other jobs must never attempt to launch; they only acquire contexts/pages.
 */
import { log } from '../lib/logger';

export async function prewarmBrowserJob(): Promise<void> {
  const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
  const pool = UnifiedBrowserPool.getInstance();
  
  let attempt = 0;
  const maxAttempts = 4;
  
  while (attempt < maxAttempts) {
    try {
      log({ op: 'prewarm_browser_start', attempt: attempt + 1 });
      const page = await pool.acquirePage('prewarm');
      await page.evaluate(() => 1);
      await page.close().catch(() => {});
      log({ op: 'prewarm_browser_success' });
      return;
    } catch (error: any) {
      attempt++;
      const delay = Math.min(120000, 15000 * Math.pow(2, attempt - 1)); // 15s, 30s, 60s, 120s
      log({ op: 'prewarm_browser_failure', attempt, error: error?.message || String(error), retry_ms: delay });
      await new Promise(res => setTimeout(res, delay));
    }
  }
}


