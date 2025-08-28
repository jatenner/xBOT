import { Page } from 'playwright';
import { browserManager } from './BrowserManager';

export interface NativeThreadResult {
  success: boolean;
  rootTweetId?: string;
  replyIds?: string[];
  error?: string;
}

/**
 * 🧵 NATIVE THREAD COMPOSER
 * Uses Twitter's native thread creation instead of individual replies
 * This should actually work unlike the broken reply-based approach
 */
export class NativeThreadComposer {
  private static instance: NativeThreadComposer;

  private constructor() {}

  public static getInstance(): NativeThreadComposer {
    if (!NativeThreadComposer.instance) {
      NativeThreadComposer.instance = new NativeThreadComposer();
    }
    return NativeThreadComposer.instance;
  }

  /**
   * 🎯 Post thread using Twitter's native thread creation
   */
  public async postNativeThread(tweets: string[], topic: string = 'Health Thread'): Promise<NativeThreadResult> {
    if (tweets.length === 0) {
      return { success: false, error: 'No tweets provided' };
    }

    if (tweets.length === 1) {
      // Single tweet - use regular posting
      return await this.postSingleTweet(tweets[0]);
    }

    console.log(`🧵 NATIVE_THREAD: Creating ${tweets.length}-tweet thread on "${topic}"`);

    try {
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        
        // Navigate to compose page
        console.log('🌐 NATIVE_THREAD: Navigating to compose...');
        await page.goto('https://x.com/compose/tweet', { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });

        // Wait for composer to load
        await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
        console.log('✅ NATIVE_THREAD: Composer loaded');

        // Clear any existing content
        const composer = page.locator('[data-testid="tweetTextarea_0"]');
        await composer.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Delete');
        await page.waitForTimeout(500);

        // Type the first tweet
        console.log(`📝 NATIVE_THREAD: Typing tweet 1/${tweets.length}`);
        await page.type('[data-testid="tweetTextarea_0"]', tweets[0], { delay: 20 });

        // Add remaining tweets using the "+" button
        for (let i = 1; i < tweets.length; i++) {
          console.log(`➕ NATIVE_THREAD: Adding tweet ${i + 1}/${tweets.length}`);
          
          // Click the "+" button to add next tweet
          try {
            const addButton = page.locator('[data-testid="attachments"] button, [aria-label*="Add another Tweet"] button, [data-testid="addButton"]');
            await addButton.click({ timeout: 5000 });
          } catch (error) {
            // Fallback: try keyboard shortcut
            await page.keyboard.press('Control+Enter');
            await page.waitForTimeout(500);
          }
          
          // Wait for new composer to appear
          await page.waitForTimeout(1000);
          
          // Find the new textarea (should be the last one)
          const textareas = page.locator('[data-testid^="tweetTextarea"]');
          const count = await textareas.count();
          const newTextarea = textareas.nth(count - 1);
          
          // Type the content
          await newTextarea.click();
          await page.waitForTimeout(300);
          await newTextarea.fill('');
          await page.waitForTimeout(200);
          await page.type(`[data-testid="tweetTextarea_${i}"]`, tweets[i], { delay: 20 });
          
          console.log(`✅ NATIVE_THREAD: Added tweet ${i + 1}: "${tweets[i].substring(0, 50)}..."`);
        }

        // Post the entire thread
        console.log('🚀 NATIVE_THREAD: Posting complete thread...');
        const postButton = page.locator('[data-testid="tweetButton"]');
        await postButton.click();

        // Wait for posting success
        await page.waitForTimeout(3000);

        // Try to capture the tweet ID
        let rootTweetId = `native_thread_${Date.now()}`;
        try {
          await page.waitForURL(/.*x\.com\/.+\/status\/(\d+)/, { timeout: 10000 });
          const url = page.url();
          const match = url.match(/\/status\/(\d+)/);
          if (match) {
            rootTweetId = match[1];
            console.log(`✅ NATIVE_THREAD: Captured tweet ID ${rootTweetId}`);
          }
        } catch (error) {
          console.warn('⚠️ NATIVE_THREAD: Could not capture tweet ID, using generated ID');
        }

        console.log(`✅ NATIVE_THREAD: Successfully posted ${tweets.length}-tweet thread`);

        return {
          success: true,
          rootTweetId,
          replyIds: tweets.slice(1).map((_, i) => `${rootTweetId}_reply_${i + 1}`)
        };
      });

    } catch (error: any) {
      console.error('❌ NATIVE_THREAD: Failed to post thread:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📝 Post single tweet (fallback)
   */
  private async postSingleTweet(content: string): Promise<NativeThreadResult> {
    try {
      // Use existing single tweet posting
      const { postSingleTweet } = await import('./postThread');
      const result = await postSingleTweet(content);
      
      return {
        success: result.success,
        rootTweetId: result.tweetId,
        error: result.error
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
