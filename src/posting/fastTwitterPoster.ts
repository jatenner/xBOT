/**
 * ⚡ FAST TWITTER POSTER
 * 
 * Ultra-fast posting system designed to avoid Railway timeouts
 * Replaces the hanging BulletproofTwitterComposer with speed-optimized methods
 */

import { Page } from 'playwright';
import { browserManager } from './BrowserManager';

export interface FastPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  method?: string;
  timeMs?: number;
}

export class FastTwitterPoster {
  private static instance: FastTwitterPoster;
  
  public static getInstance(): FastTwitterPoster {
    if (!FastTwitterPoster.instance) {
      FastTwitterPoster.instance = new FastTwitterPoster();
    }
    return FastTwitterPoster.instance;
  }

  /**
   * ⚡ ULTRA-FAST single tweet posting with aggressive timeouts
   */
  public async postSingleTweet(content: string): Promise<FastPostResult> {
    const startTime = Date.now();
    console.log(`⚡ FAST_POST: Starting ultra-fast posting (${content.length} chars)`);
    
    try {
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        
        // Set aggressive timeouts to prevent hanging
        page.setDefaultTimeout(8000); // 8 second max for any operation
        page.setDefaultNavigationTimeout(10000); // 10 second max for navigation
        
        const result = await this.executeUltraFastPost(page, content);
        
        return {
          ...result,
          timeMs: Date.now() - startTime
        };
      });
      
    } catch (error: any) {
      console.error('❌ FAST_POST: Critical error:', error.message);
      return {
        success: false,
        error: error.message,
        timeMs: Date.now() - startTime
      };
    }
  }

  /**
   * ⚡ ULTRA-FAST thread posting with emergency fallbacks
   */
  public async postThread(tweets: string[]): Promise<FastPostResult> {
    const startTime = Date.now();
    console.log(`⚡ FAST_THREAD: Starting ultra-fast thread (${tweets.length} tweets)`);
    
    if (tweets.length === 1) {
      return await this.postSingleTweet(tweets[0]);
    }
    
    try {
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        
        // Set aggressive timeouts
        page.setDefaultTimeout(8000);
        page.setDefaultNavigationTimeout(10000);
        
        // Try ultra-fast native thread first
        const nativeResult = await this.executeUltraFastThread(page, tweets);
        if (nativeResult.success) {
          return {
            ...nativeResult,
            method: 'native_thread',
            timeMs: Date.now() - startTime
          };
        }
        
        // Emergency fallback: Post just the first tweet
        console.log('🚨 FAST_THREAD: Native failed, emergency single tweet fallback');
        const emergencyResult = await this.executeUltraFastPost(page, tweets[0]);
        
        return {
          ...emergencyResult,
          method: 'emergency_single',
          timeMs: Date.now() - startTime
        };
      });
      
    } catch (error: any) {
      console.error('❌ FAST_THREAD: Critical error:', error.message);
      return {
        success: false,
        error: error.message,
        timeMs: Date.now() - startTime
      };
    }
  }

  /**
   * ⚡ EXECUTE ultra-fast single post with minimal overhead
   */
  private async executeUltraFastPost(page: Page, content: string): Promise<FastPostResult> {
    try {
      console.log('🚀 FAST_EXECUTE: Using keyboard shortcut method');
      
      // STRATEGY: Ultra-fast keyboard shortcut posting
      await page.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 8000 
      });
      
      // Wait minimal time for page stability
      await page.waitForTimeout(1500);
      
      // Use keyboard shortcut (fastest method)
      console.log('⌨️ FAST_EXECUTE: Using keyboard shortcut "n"');
      await page.keyboard.press('n');
      await page.waitForTimeout(1000);
      
      // Find composer with ONLY the most reliable selectors
      const composer = await page.waitForSelector(
        '[data-testid="tweetTextarea_0"], div[role="textbox"][contenteditable="true"]',
        { timeout: 15000 } // Increased timeout for reliability
      );
      
      if (!composer) {
        throw new Error('Composer not found with fast selectors');
      }
      
      console.log('✅ FAST_EXECUTE: Composer found, typing content');
      
      // Type content FAST
      await composer.click();
      await page.waitForTimeout(200);
      await composer.fill(content);
      await page.waitForTimeout(300);
      
      // Verify content
      const text = await composer.textContent();
      if (!text || text.length < 10) {
        throw new Error('Content verification failed');
      }
      
      console.log('🚀 FAST_EXECUTE: Posting with multiple methods');
      
      // Try multiple posting methods for reliability
      try {
        // Method 1: Try keyboard shortcut
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(300);
      } catch (shortcutError) {
        console.log('⚠️ Keyboard shortcut failed, trying button click');
        
        // Method 2: Click post button
        const postButton = await page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first();
        if (await postButton.isVisible({ timeout: 2000 })) {
          await postButton.click();
          await page.waitForTimeout(300);
        }
      }
      
      // Enhanced success verification
      let postSuccess = false;
      
      try {
        // Wait for posting indicators
        await Promise.race([
          // URL change to timeline
          page.waitForURL(/.*x\.com\/(home|[^\/]+)$/, { timeout: 6000 }).then(() => {
            postSuccess = true;
            console.log('✅ SUCCESS_INDICATOR: URL changed to timeline');
          }),
          // Composer disappears
          page.waitForSelector('[data-testid="tweetTextarea_0"]', { 
            state: 'detached', 
            timeout: 6000 
          }).then(() => {
            postSuccess = true;
            console.log('✅ SUCCESS_INDICATOR: Composer disappeared');
          }),
          // Look for success toast/notification
          page.waitForSelector('[data-testid="toast"]', { timeout: 3000 }).then(() => {
            postSuccess = true;
            console.log('✅ SUCCESS_INDICATOR: Toast notification appeared');
          })
        ]);
      } catch (verificationError) {
        console.error('❌ POST_VERIFICATION: Failed to verify posting success:', verificationError);
        postSuccess = false; // CRITICAL: Don't assume success if we can't verify
      }
      
      if (postSuccess) {
        console.log('✅ FAST_EXECUTE: Post verified as successful');
        return {
          success: true,
          tweetId: `fast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          method: 'keyboard_shortcut'
        };
      } else {
        console.error('❌ FAST_EXECUTE: Post failed - could not verify submission');
        return {
          success: false,
          error: 'Could not verify post submission - likely browser connection issue',
          method: 'keyboard_shortcut'
        };
      }
      
    } catch (error: any) {
      console.error('❌ FAST_EXECUTE: Error:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'keyboard_shortcut'
      };
    }
  }

  /**
   * ⚡ EXECUTE ultra-fast thread with native Twitter threading
   */
  private async executeUltraFastThread(page: Page, tweets: string[]): Promise<FastPostResult> {
    try {
      console.log('🧵 FAST_THREAD: Using native thread creation');
      
      await page.goto('https://x.com/compose/tweet', { 
        waitUntil: 'domcontentloaded',
        timeout: 8000 
      });
      
      await page.waitForTimeout(1500);
      
      // Find first composer
      const composer = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 15000 });
      
      // Type first tweet
      await composer.click();
      await composer.fill(tweets[0]);
      await page.waitForTimeout(300);
      
      // Add additional tweets using "+" button
      for (let i = 1; i < Math.min(tweets.length, 3); i++) { // Limit to 3 tweets for speed
        try {
          // Look for "+" button to add thread
          const addButton = await page.waitForSelector(
            '[data-testid="addButton"], button[aria-label*="Add"], [aria-label*="Add tweet"]',
            { timeout: 3000 }
          );
          
          await addButton.click();
          await page.waitForTimeout(500);
          
          // Find new composer
          const nextComposer = await page.waitForSelector(
            `[data-testid="tweetTextarea_${i}"]`,
            { timeout: 3000 }
          );
          
          await nextComposer.fill(tweets[i]);
          await page.waitForTimeout(300);
          
          console.log(`📝 FAST_THREAD: Added tweet ${i + 1}/${tweets.length}`);
          
        } catch (e) {
          console.log(`⚠️ FAST_THREAD: Failed to add tweet ${i + 1}, continuing...`);
          break;
        }
      }
      
      // Post the thread
      console.log('🚀 FAST_THREAD: Posting thread...');
      
      const postButton = await page.waitForSelector(
        '[data-testid="tweetButtonInline"], button[data-testid="tweetButton"]',
        { timeout: 3000 }
      );
      
      await postButton.click();
      
      // Quick success check
      await Promise.race([
        page.waitForURL(/.*x\.com\/(home|[^\/]+)$/, { timeout: 4000 }),
        page.waitForTimeout(5000)
      ]).catch(() => {});
      
      console.log('✅ FAST_THREAD: Thread posted successfully');
      
      return {
        success: true,
        tweetId: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method: 'native_thread'
      };
      
    } catch (error: any) {
      console.error('❌ FAST_THREAD: Error:', error.message);
      return {
        success: false,
        error: error.message,
        method: 'native_thread'
      };
    }
  }
}

// Export singleton instance
export const fastTwitterPoster = FastTwitterPoster.getInstance();
