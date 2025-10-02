/**
 * 🛡️ CRASH-AWARE BROWSER RUNNER
 * Auto-retries with traces/screenshots on failure
 */

import { Page } from 'playwright';
import { launchPersistent } from './launcher';

export async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let ctx: any;
    try {
      console.log(`[PW] Attempt ${attempt}/3 starting...`);
      ctx = await launchPersistent();

      // Enable tracing if requested
      const tracing = process.env.PLAYWRIGHT_TRACE === 'on';
      if (tracing) {
        console.log('[PW] Tracing enabled, starting trace...');
        await ctx.tracing.start({ screenshots: true, snapshots: true });
      }

      const page = await ctx.newPage();
      page.setDefaultTimeout(45_000);
      
      console.log('[PW] Navigating to X home...');
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45_000 });
      console.log('[PW] ✅ Page loaded');

      // Execute user function
      const result = await fn(page);

      // Save trace on success if enabled
      if (tracing) {
        const tracePath = `/tmp/trace-success-${Date.now()}.zip`;
        await ctx.tracing.stop({ path: tracePath });
        console.log(`[PW] Trace saved: ${tracePath}`);
      }

      await ctx.close();
      console.log(`[PW] ✅ Attempt ${attempt} succeeded`);
      return result;

    } catch (e: any) {
      const ts = Date.now();
      console.error(`[PW] ❌ Attempt ${attempt} failed: ${e?.message || e}`);

      // Capture screenshot
      try {
        const screenshot = await ctx?.pages?.()[0]?.screenshot?.({ path: `/tmp/fail-${ts}.png`, fullPage: true });
        if (screenshot) console.log(`[PW] Screenshot saved: /tmp/fail-${ts}.png`);
      } catch (screenshotErr) {
        console.error('[PW] Failed to capture screenshot:', screenshotErr.message);
      }

      // Stop tracing if enabled
      try {
        await ctx?.tracing?.stop?.({ path: `/tmp/trace-${ts}.zip` });
        console.log(`[PW] Trace saved: /tmp/trace-${ts}.zip`);
      } catch (traceErr) {
        // Silent fail
      }

      // Close context
      await ctx?.close?.().catch(() => {});

      // Wait before retry (exponential backoff)
      if (attempt < 3) {
        const delay = 1500 * attempt;
        console.log(`[PW] Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error('[PW] FATAL: Browser kept crashing after 3 attempts. Check /tmp/fail-*.png and /tmp/trace-*.zip');
}

