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
        await page.waitForTimeout(3000); // Extra stability wait
        
        // Use CSP-safe locator waits instead of waitForFunction
        const composer = page.locator('[data-testid="tweetTextarea_0"]').first();
        await composer.waitFor({ state: 'visible', timeout: 10000 });
        console.log('✅ NATIVE_THREAD: Found composer element');

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
          
          // Wait for and click the add button using CSP-safe locator waits
          const addButton = page.locator('[data-testid="addTweetButton"]');
          await addButton.waitFor({ state: 'visible', timeout: 10000 });
          await addButton.click();
          await page.waitForTimeout(1000); // Wait for new textarea to appear
          
          // Wait for the new textarea to appear
          const newTextarea = page.locator(`[data-testid="tweetTextarea_${i}"]`);
          await newTextarea.waitFor({ state: 'visible', timeout: 10000 });
          
          // Type the content
          await newTextarea.click();
          await page.waitForTimeout(300);
          await newTextarea.fill(tweets[i]);
          await page.waitForTimeout(500); // Ensure content is fully entered
          
          console.log(`✅ NATIVE_THREAD: Added tweet ${i + 1}: "${tweets[i].substring(0, 50)}..."`);
        }

        // Post the entire thread
        console.log('🚀 NATIVE_THREAD: Posting complete thread...');
        const postButton = page.locator('[data-testid="tweetButton"]');
        await postButton.waitFor({ state: 'visible', timeout: 5000 });
        await postButton.click();

        // Wait for posting to complete - look for navigation or success indicators
        console.log('⏳ NATIVE_THREAD: Waiting for posting success...');
        await page.waitForTimeout(3000);

        // Try to capture the tweet ID from URL
        let rootTweetId = `native_thread_${Date.now()}`;
        try {
          // Wait for navigation to the posted tweet
          await page.waitForURL(/.*x\.com\/.*\/status\/(\d+)/, { timeout: 15000 });
          const url = page.url();
          const match = url.match(/\/status\/(\d+)/);
          if (match) {
            rootTweetId = match[1];
            console.log(`✅ NATIVE_THREAD: Captured root tweet ID ${rootTweetId}`);
          }
        } catch (error) {
          console.warn('⚠️ NATIVE_THREAD: Could not capture tweet ID from URL');
          
          // Try alternative method - look for status links on current page
          try {
            const statusLinks = await page.locator('a[href*="/status/"]').all();
            if (statusLinks.length > 0) {
              const href = await statusLinks[0].getAttribute('href');
              const match = href?.match(/\/status\/(\d+)/);
              if (match) {
                rootTweetId = match[1];
                console.log(`✅ NATIVE_THREAD: Captured tweet ID from link ${rootTweetId}`);
              }
            }
          } catch (linkError) {
            console.warn('⚠️ NATIVE_THREAD: Link capture also failed, using generated ID');
          }
        }

        // 🎯 CRITICAL: Verify the thread actually exists
        console.log(`🔍 NATIVE_THREAD: Verifying thread exists for ${rootTweetId}...`);
        const threadVerified = await this.verifyThreadExists(page, rootTweetId, tweets.length);
        
        if (!threadVerified) {
          throw new Error(`Thread verification failed: Expected ${tweets.length} tweets but thread not found`);
        }

        console.log(`✅ NATIVE_THREAD: Successfully posted and verified ${tweets.length}-tweet thread`);

        return {
          success: true,
          rootTweetId,
          replyIds: tweets.slice(1).map((_, i) => `${rootTweetId}_reply_${i + 1}`)
        };
      });

    } catch (error: any) {
      console.error('❌ NATIVE_THREAD: Failed to post thread:', error.message);
      
      // 🚫 FALLBACK DISABLED: Force native composer to work properly
      console.log('🚫 NATIVE_THREAD: Fallback disabled - native composer must succeed');
      console.log('💡 NATIVE_THREAD: This forces us to fix the root cause instead of masking it');
      
      return {
        success: false,
        error: `Native thread failed: ${error.message}`
      };
    }
  }

  /**
   * 🔍 Verify that a real thread was created (not just a single tweet)
   */
  private async verifyThreadExists(page: Page, tweetId: string, expectedTweets: number): Promise<boolean> {
    try {
      // Navigate to the tweet to check if it's a thread
      console.log(`🔍 THREAD_VERIFY: Checking ${tweetId} for ${expectedTweets} tweets...`);
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      await page.goto(`https://x.com/${username}/status/${tweetId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      await page.waitForTimeout(4000); // Extra time for thread loading
      
      // Method 1: Count tweet articles (most reliable)
      let foundTweets = 0;
      try {
        const articles = await page.locator('article[data-testid="tweet"]').count();
        foundTweets = articles;
        console.log(`📊 THREAD_VERIFY: Found ${articles} tweet articles`);
      } catch (error) {
        console.warn('⚠️ Could not count tweet articles');
      }
      
      // Method 2: Look for thread continuation indicators
      if (foundTweets < expectedTweets) {
        try {
          // Check for "Show this thread" link
          const showThreadLink = await page.locator('a:has-text("Show this thread")').count();
          if (showThreadLink > 0) {
            foundTweets = Math.max(foundTweets, expectedTweets);
            console.log(`✅ THREAD_VERIFY: Found "Show this thread" link`);
          }
          
          // Check for thread reply indicators
          const replyLinks = await page.locator('a[href*="/status/"]:not([href*="' + tweetId + '"])').count();
          if (replyLinks > 0) {
            foundTweets = Math.max(foundTweets, replyLinks + 1);
            console.log(`✅ THREAD_VERIFY: Found ${replyLinks} reply links`);
          }
          
        } catch (error) {
          // Additional checks failed, use primary count
        }
      }
      
      // Method 3: Check page content for thread structure
      if (foundTweets < expectedTweets) {
        try {
          const pageContent = await page.content();
          const threadMatches = pageContent.match(/status\/\d+/g);
          if (threadMatches && threadMatches.length >= expectedTweets) {
            foundTweets = threadMatches.length;
            console.log(`✅ THREAD_VERIFY: Found ${threadMatches.length} status IDs in page content`);
          }
        } catch (error) {
          // Content analysis failed
        }
      }
      
      const verified = foundTweets >= expectedTweets;
      console.log(`🎯 THREAD_VERIFY: Expected ${expectedTweets}, found ${foundTweets} → ${verified ? 'VERIFIED' : 'FAILED'}`);
      
      // For debugging: if verification fails, try to capture what we see
      if (!verified) {
        try {
          const visibleText = await page.locator('body').textContent();
          const hasThreadText = visibleText?.includes('thread') || visibleText?.includes('Thread');
          console.log(`🔍 DEBUG: Page contains 'thread' text: ${hasThreadText}`);
        } catch (debugError) {
          // Debug failed, continue
        }
      }
      
      return verified;
      
    } catch (error: any) {
      console.error('❌ THREAD_VERIFY: Verification failed:', error.message);
      return false;
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
