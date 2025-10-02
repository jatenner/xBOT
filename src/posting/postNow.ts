/**
 * 📤 POST NOW - Unified posting pipeline for scheduled & smoke tests
 * Uses withBrowser for crash-safe posting
 */

import { withBrowser } from '../infra/playwright/withBrowser';
import { railwaySessionManager } from '../utils/railwaySessionManager';

export interface PostResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function postNow({ text }: { text: string }): Promise<PostResult> {
  console.log(`POSTING_START textLength=${text.length}`);
  globalThis.__xbotLastPostAttemptAt = new Date().toISOString();

  try {
    // Ensure we have a valid session before attempting to post
    const hasSession = await railwaySessionManager.ensureValidSession();
    if (!hasSession) {
      throw new Error('No valid Twitter session available');
    }

    const result = await withBrowser(async (page) => {
      console.log('[POST_NOW] Session loaded via persistent context...');

      // Check if we're logged in
      console.log('[POST_NOW] Checking login status...');
      const composeButton = page.locator('[data-testid="SideNav_NewTweet_Button"]');
      const isLoggedIn = await composeButton.isVisible({ timeout: 10000 });
      
      if (!isLoggedIn) {
        throw new Error('Not logged in to Twitter');
      }
      console.log('[POST_NOW] ✅ Login verified');

      // Click compose button
      await composeButton.click();
      console.log('[POST_NOW] Compose dialog opened');

      // Wait for text area
      await page.waitForTimeout(2000);
      
      // Fill text area
      const textArea = page.locator('[data-testid="tweetTextarea_0"]').first();
      await textArea.waitFor({ state: 'visible', timeout: 10000 });
      await textArea.fill(text);
      console.log('[POST_NOW] Text filled');

      // Wait for Twitter to process
      await page.waitForTimeout(1000);

      // Click Post button
      const postButton = page.locator('[data-testid="tweetButtonInline"]');
      await postButton.waitFor({ state: 'visible', timeout: 5000 });
      
      const isEnabled = await postButton.isEnabled();
      if (!isEnabled) {
        throw new Error('Post button is disabled');
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

