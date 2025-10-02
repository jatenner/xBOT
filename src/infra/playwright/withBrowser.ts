/**
 * 🛡️ CRASH-AWARE BROWSER RUNNER
 * Auto-retries with traces/screenshots on failure
 * Handles both twitter.com and x.com domains with proper auth
 */

import { Page } from 'playwright';
import { launchPersistent } from './launcher';
import { applyStateToContext, isLoggedIn, saveStorageState } from '../session/xSession';
import { performLogin } from './xLogin';

const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function withBrowser<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let ctx: any;
    try {
      console.log(`[PW] Attempt ${attempt}/3 starting...`);
      ctx = await launchPersistent();

      // Apply session cookies
      await applyStateToContext(ctx);

      // Set realistic headers and user agent
      await ctx.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      
      // Enable tracing if requested
      const tracing = process.env.PLAYWRIGHT_TRACE === 'on';
      if (tracing) {
        console.log('[PW] Tracing enabled, starting trace...');
        await ctx.tracing.start({ screenshots: true, snapshots: true });
      }

      const page = await ctx.newPage();
      await page.setUserAgent(REAL_UA);
      page.setDefaultTimeout(45_000);
      
      // Try twitter.com first (works with legacy cookies)
      const targetDomain = process.env.X_TARGET_DOMAIN || 'twitter.com';
      console.log(`[PW] Navigating to ${targetDomain}/home...`);
      
      await page.goto(`https://${targetDomain}/home`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      console.log('[PW] ✅ Page loaded');

      // Check if logged in
      let loggedIn = await isLoggedIn(page);
      
      if (!loggedIn && targetDomain === 'twitter.com') {
        // Fallback to x.com
        console.log('[PW] Not logged in on twitter.com, trying x.com...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45_000 });
        loggedIn = await isLoggedIn(page);
      }
      
      // If still not logged in, attempt automatic login
      if (!loggedIn) {
        console.log('[PW] ⚠️ Not logged in, attempting automatic login...');
        const loginSuccess = await performLogin(page);
        
        if (loginSuccess) {
          // Save session after successful login
          const state = await ctx.storageState();
          await saveStorageState(state);
          console.log('[PW] ✅ Login successful, session saved');
          
          // Navigate back to home
          await page.goto(`https://${targetDomain}/home`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          loggedIn = await isLoggedIn(page);
        }
        
        if (!loggedIn) {
          throw new Error('Not logged in to Twitter after login attempt');
        }
      }

      console.log('[PW] ✅ Logged in and ready');

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

