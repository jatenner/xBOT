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

        // Wait for page to stabilize and composer to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // Extra stability wait
        
        // Try multiple selector strategies to avoid conflicts
        let composer;
        try {
          // Strategy 1: Most specific selector possible
          composer = page.locator('div[data-testid="tweetTextarea_0"]:visible').first();
          await composer.waitFor({ timeout: 5000 });
          console.log('✅ NATIVE_THREAD: Found composer with Strategy 1');
        } catch (e) {
          // Strategy 2: Fallback to tweet button area + textarea
          console.log('🔄 NATIVE_THREAD: Trying Strategy 2...');
          composer = page.locator('[role="textbox"][data-testid*="tweetTextarea"]').first();
          await composer.waitFor({ timeout: 5000 });
          console.log('✅ NATIVE_THREAD: Found composer with Strategy 2');
        }

        // Clear and focus
        await composer.click();
        await page.waitForTimeout(300);
        await composer.selectText();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);

        // Type the first tweet
        console.log(`📝 NATIVE_THREAD: Typing tweet 1/${tweets.length} (${tweets[0].length} chars)`);
        await composer.fill(tweets[0]);
        await page.waitForTimeout(500);

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
          await newTextarea.fill(tweets[i]);
          
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
      
      // 🔄 BULLETPROOF FALLBACK: Try Enhanced Thread Composer as backup
      if (tweets.length > 1) {
        console.log('🔄 NATIVE_THREAD: Attempting fallback to Enhanced Thread Composer...');
        try {
          const { EnhancedThreadComposer } = await import('./enhancedThreadComposer');
          const enhancedComposer = EnhancedThreadComposer.getInstance();
          const fallbackResult = await enhancedComposer.postOrganizedThread(tweets, topic);
          
          if (fallbackResult.success) {
            console.log('✅ NATIVE_THREAD: Enhanced fallback succeeded!');
            return {
              success: true,
              rootTweetId: fallbackResult.rootTweetId,
              replyIds: fallbackResult.replyIds,
              error: 'Used Enhanced fallback'
            };
          }
        } catch (fallbackError: any) {
          console.error('❌ NATIVE_THREAD: Enhanced fallback also failed:', fallbackError.message);
        }
      }
      
      return {
        success: false,
        error: `Native thread failed: ${error.message}`
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
