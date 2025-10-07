/**
 * 📤 POST NOW - Unified posting pipeline for scheduled & smoke tests
 * Uses withBrowser for crash-safe posting
 */

import { withBrowser } from '../infra/playwright/withBrowser';
import { railwaySessionManager } from '../infra/session/railwaySessionManager';
import { emergencyCircuitBreaker } from '../infra/emergencyCircuitBreaker';

export interface PostResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function postNow({ text }: { text: string }): Promise<PostResult> {
  console.log(`POSTING_START textLength=${text.length}`);
  globalThis.__xbotLastPostAttemptAt = new Date().toISOString();

  // 🚨 EMERGENCY CIRCUIT BREAKER CHECK
  if (!emergencyCircuitBreaker.canAttemptPost()) {
    const status = emergencyCircuitBreaker.getStatus();
    console.log('🚨 POSTING_BLOCKED: Circuit breaker is open', status);
    return { 
      success: false, 
      error: `Circuit breaker open - ${status.failures} failures. Reset in ${Math.round((status.timeUntilReset || 0) / 1000)}s` 
    };
  }

  try {
    // Try headless X poster first (most reliable)
    console.log('[POST_NOW] 🤖 Using headless X poster...');
    try {
      const { HeadlessXPoster } = await import('./headlessXPoster');
      const poster = new HeadlessXPoster();
      
      await poster.initialize();
      const result = await poster.postTweet(text);
      await poster.close();
      
      if (result.success) {
        const tweetId = result.tweetId || `posted_${Date.now()}`;
        console.log(`POSTING_DONE id=${tweetId}`);
        globalThis.__xbotLastPostResult = { success: true, id: tweetId };
        return { success: true, id: tweetId };
      }
    } catch (headlessError) {
      console.error(`[POST_NOW] ⚠️ Headless X poster failed: ${headlessError.message}`);
      // Fall through to other methods
    }
    
    // Try remote browser as backup if configured
    const useRemote = !!process.env.BROWSER_SERVER_URL && !!process.env.BROWSER_SERVER_SECRET;
    
    if (useRemote) {
      console.log('[POST_NOW] 🌐 Using remote browser (local machine)...');
      const { postTweetRemote } = await import('./remoteBrowserPoster');
      const remoteResult = await postTweetRemote(text);
      
      if (remoteResult.success) {
        const tweetId = remoteResult.tweetId || `posted_${Date.now()}`;
        console.log(`POSTING_DONE id=${tweetId}`);
        globalThis.__xbotLastPostResult = { success: true, id: tweetId };
        return { success: true, id: tweetId };
      } else {
        console.error(`[POST_NOW] ⚠️ Remote browser failed: ${remoteResult.error}`);
        // Fall through to Railway browser as backup
      }
    }

    // Fallback to Railway browser
    console.log('[POST_NOW] 🚂 Using Railway browser...');
    
    // Ensure we have a valid session before attempting to post
    const sessionData = await railwaySessionManager.loadSession();
    const hasSession = railwaySessionManager.validateSession(sessionData);
    if (!hasSession) {
      throw new Error('No valid Twitter session available');
    }

    const result = await withBrowser(async (page) => {
      console.log('[POST_NOW] Session loaded via persistent context...');

      // Check if we're logged in with multiple selectors
      console.log('[POST_NOW] Checking login status...');
      const composeButton = page.locator('[data-testid="SideNav_NewTweet_Button"], [aria-label="Post"], [data-testid="tweetButtonInline"]').first();
      const isLoggedIn = await composeButton.isVisible({ timeout: 10000 }).catch(() => false);
      
      if (!isLoggedIn) {
        // Check if we're on login page
        const currentUrl = page.url();
        const pageTitle = await page.title().catch(() => 'Unknown');
        if (currentUrl.includes('/login') || pageTitle.includes('Log in to X')) {
          throw new Error('Session expired - redirected to X login page. Please refresh your session.');
        }
        throw new Error('Not logged in to X - compose button not found');
      }
      console.log('[POST_NOW] ✅ Login verified on X.com');

      // Click compose button
      await composeButton.click();
      console.log('[POST_NOW] Compose dialog opened');

      // Wait for text area
      await page.waitForTimeout(2000);
      
      // Fill text area with multiple selector fallbacks
      const textAreaSelectors = [
        '[data-testid="tweetTextarea_0"]',
        '[role="textbox"][aria-label*="Post"]',
        '[role="textbox"][placeholder*="What is happening"]',
        '.public-DraftEditor-content'
      ];
      
      let textArea = null;
      for (const selector of textAreaSelectors) {
        try {
          textArea = page.locator(selector).first();
          await textArea.waitFor({ state: 'visible', timeout: 5000 });
          break;
        } catch (e) {
          console.log(`[POST_NOW] Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!textArea) {
        throw new Error('Could not find tweet text area with any known selector');
      }
      
      await textArea.fill(text);
      console.log('[POST_NOW] Text filled');

      // Wait for Twitter to process
      await page.waitForTimeout(1000);

      // Click Post button with multiple selector fallbacks
      const postButtonSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        '[role="button"][aria-label*="Post"]',
        'button:has-text("Post")',
        '[data-testid="toolBar"] [role="button"]:last-child'
      ];
      
      let postButton = null;
      for (const selector of postButtonSelectors) {
        try {
          postButton = page.locator(selector).first();
          await postButton.waitFor({ state: 'visible', timeout: 3000 });
          const isEnabled = await postButton.isEnabled();
          if (isEnabled) {
            break;
          }
        } catch (e) {
          console.log(`[POST_NOW] Post button selector ${selector} not found or disabled, trying next...`);
        }
      }
      
      if (!postButton) {
        throw new Error('Could not find enabled post button with any known selector');
      }

      await postButton.click();
      console.log('[POST_NOW] Post button clicked');

      // Wait for posting to complete
      await page.waitForTimeout(3000);

      // Verify success
      const currentUrl = page.url();
      const isSuccess = currentUrl.includes('/home') || currentUrl.includes('/status/');

      if (!isSuccess) {
        throw new Error(`Posting verification failed, URL: ${currentUrl}`);
      }

      // Try to extract tweet ID from URL
      const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `posted_${Date.now()}`;

      console.log(`POSTING_DONE id=${tweetId}`);
      return { id: tweetId };
    });

    globalThis.__xbotLastPostResult = { success: true, ...result };
    return { success: true, ...result };

  } catch (error: any) {
    console.error(`POSTING_FAIL error="${error.message}"`);
    globalThis.__xbotLastPostResult = { success: false, error: error.message };
    return { success: false, error: error.message };
  }
}

