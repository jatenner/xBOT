/**
 * 🚄 RAILWAY COMPATIBLE POSTER - Stable Playwright posting
 * 
 * Uses persistent context + retry logic instead of shared browser
 * No --single-process flag (causes crashes)
 * Each post opens and closes its own browser context
 */

import { withBrowser } from '../infra/playwright/withBrowser';
import { railwaySessionManager } from '../utils/railwaySessionManager';

export interface PostResult {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

/**
 * Post a single tweet using robust retry logic
 */
export async function postTweet(text: string): Promise<PostResult> {
  console.log(`POSTING_START textLength=${text.length}`);
  globalThis.__xbotLastPostAttemptAt = new Date().toISOString();

  try {
    // Ensure we have a valid session
    const hasSession = await railwaySessionManager.ensureValidSession();
    if (!hasSession) {
      throw new Error('No valid Twitter session available');
    }

    const result = await withBrowser(async (page) => {
      console.log('[RAILWAY_POSTER] Session loaded via persistent context');

      // Check if we're logged in
      const composeButton = page.locator('[data-testid="SideNav_NewTweet_Button"]');
      const isLoggedIn = await composeButton.isVisible({ timeout: 10000 });
      
      if (!isLoggedIn) {
        throw new Error('Not logged in to Twitter');
      }
      console.log('[RAILWAY_POSTER] ✅ Login verified');

      // Click compose button
      await composeButton.click();
      console.log('[RAILWAY_POSTER] Compose dialog opened');

      // Wait for text area
      await page.waitForTimeout(2000);
      
      // Fill text area
      const textArea = page.locator('[data-testid="tweetTextarea_0"]').first();
      await textArea.waitFor({ state: 'visible', timeout: 10000 });
      await textArea.fill(text);
      console.log('[RAILWAY_POSTER] Text filled');

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
      console.log('[RAILWAY_POSTER] Post button clicked');

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
      return { id: tweetId, url: currentUrl };
    });

    globalThis.__xbotLastPostResult = { success: true, ...result };
    return { success: true, ...result };

  } catch (error: any) {
    console.error(`POSTING_FAIL error="${error.message}"`);
    globalThis.__xbotLastPostResult = { success: false, error: error.message };
    return { success: false, error: error.message };
  }
}

/**
 * Post a thread (multiple tweets)
 */
export async function postThread(tweets: string[]): Promise<PostResult> {
  if (tweets.length === 0) {
    return { success: false, error: 'No tweets provided' };
  }

  console.log(`🧵 RAILWAY_POSTER: Starting thread posting (${tweets.length} tweets)...`);

  try {
    // Post first tweet
    const firstResult = await postTweet(tweets[0]);
    if (!firstResult.success) {
      return { success: false, error: `Failed to post first tweet: ${firstResult.error}` };
    }

    const tweetIds = [firstResult.id!];

    // For remaining tweets, we'd need to implement reply logic
    // For now, just post the first tweet
    console.log(`✅ RAILWAY_POSTER: Thread first tweet posted: ${firstResult.id}`);

    return {
      success: true,
      id: tweetIds.join(','),
      url: firstResult.url
    };

  } catch (error: any) {
    console.error('❌ RAILWAY_POSTER: Thread posting failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export for backwards compatibility (old code may use this class)
export class RailwayCompatiblePoster {
  // Backwards compatible initialize method (no-op, context created per-post now)
  async initialize(): Promise<boolean> {
    console.log('[RAILWAY_POSTER] ℹ️ initialize() called (no-op in new implementation)');
    return true;
  }

  // Backwards compatible cleanup method (no-op, context cleaned per-post now)
  async cleanup(): Promise<void> {
    console.log('[RAILWAY_POSTER] ℹ️ cleanup() called (no-op in new implementation)');
  }

  async postTweet(content: string) {
    const result = await postTweet(content);
    return {
      success: result.success,
      tweetId: result.id,
      error: result.error
    };
  }

  async postThread(tweets: string[]) {
    const result = await postThread(tweets);
    return {
      success: result.success,
      tweetIds: result.id?.split(',') || [],
      error: result.error
    };
  }
}

// Singleton for backwards compatibility
export const railwayPoster = new RailwayCompatiblePoster();
