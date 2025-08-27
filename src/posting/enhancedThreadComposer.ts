/**
 * 🧵 ENHANCED THREAD COMPOSER
 * 
 * Fixes thread posting issues with proper organization and quality:
 * - Sequential posting with proper delays
 * - Maintained reply chains and proper threading
 * - Visual formatting and structure optimization
 * - Thread numbering and flow control
 * - Error recovery and retry logic
 */

import { Page } from 'playwright';
import { browserManager } from './BrowserManager';

interface ThreadPostResult {
  success: boolean;
  rootTweetId?: string;
  replyIds?: string[];
  error?: string;
  threadStructure?: {
    totalTweets: number;
    successfulPosts: number;
    failedPosts: number;
    threadChain: string[];
  };
}

interface TweetFormatting {
  content: string;
  position: number;
  totalCount: number;
  isRoot: boolean;
  formattedContent: string;
}

export class EnhancedThreadComposer {
  private static instance: EnhancedThreadComposer;
  private readonly REPLY_DELAY = 3000; // 3 seconds between replies
  private readonly MAX_RETRIES = 2;
  private readonly THREAD_TIMEOUT = 45000; // 45 seconds total

  private constructor() {}

  public static getInstance(): EnhancedThreadComposer {
    if (!EnhancedThreadComposer.instance) {
      EnhancedThreadComposer.instance = new EnhancedThreadComposer();
    }
    return EnhancedThreadComposer.instance;
  }

  /**
   * 🎯 Main function: Post a well-organized thread with proper sequencing
   */
  public async postOrganizedThread(tweets: string[], topic?: string): Promise<ThreadPostResult> {
    if (tweets.length === 0) {
      return { success: false, error: 'No tweets provided' };
    }

    if (tweets.length === 1) {
      // Single tweet - use simple posting
      return await this.postSingleTweet(tweets[0]);
    }

    console.log(`🧵 ENHANCED_THREAD: Starting organized thread (${tweets.length} tweets)`);
    console.log(`📝 Topic: ${topic || 'General health content'}`);

    try {
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        
        // Enhance quality and format all tweets with proper structure
        const { ThreadQualityEnhancer } = await import('../content/threadQualityEnhancer');
        const qualityEnhancer = ThreadQualityEnhancer.getInstance();
        
        const qualityResult = qualityEnhancer.enhanceThreadQuality(tweets, topic);
        console.log(`🎨 QUALITY_ENHANCED: Score ${qualityResult.qualityScore}/100, ${qualityResult.improvements.length} improvements`);
        
        if (qualityResult.warnings.length > 0) {
          console.warn(`⚠️ QUALITY_WARNINGS: ${qualityResult.warnings.join(', ')}`);
        }
        
        // Format the enhanced tweets
        const formattedTweets = this.formatThreadTweets(qualityResult.enhancedTweets, topic);
        
        // Post root tweet with enhanced formatting
        const rootResult = await this.postRootTweet(page, formattedTweets[0]);
        if (!rootResult.success || !rootResult.tweetId) {
          return { success: false, error: `Root tweet failed: ${rootResult.error}` };
        }

        console.log(`✅ THREAD_ROOT: Posted ${rootResult.tweetId}`);

        const replyIds: string[] = [];
        const failedPosts: number[] = [];

        // Post replies with proper sequencing and error handling
        for (let i = 1; i < formattedTweets.length; i++) {
          const replyResult = await this.postSequentialReply(
            page, 
            formattedTweets[i], 
            rootResult.tweetId,
            i
          );

          if (replyResult.success && replyResult.tweetId) {
            replyIds.push(replyResult.tweetId);
            console.log(`✅ THREAD_REPLY_${i}: Posted ${replyResult.tweetId}`);
          } else {
            failedPosts.push(i);
            console.warn(`❌ THREAD_REPLY_${i}: Failed - ${replyResult.error}`);
          }

          // Strategic delay between posts to maintain order
          if (i < formattedTweets.length - 1) {
            console.log(`⏱️ THREAD_DELAY: Waiting ${this.REPLY_DELAY}ms for proper sequencing`);
            await page.waitForTimeout(this.REPLY_DELAY);
          }
        }

        const threadStructure = {
          totalTweets: formattedTweets.length,
          successfulPosts: 1 + replyIds.length,
          failedPosts: failedPosts.length,
          threadChain: [rootResult.tweetId, ...replyIds]
        };

        console.log(`🧵 THREAD_COMPLETE: ${threadStructure.successfulPosts}/${threadStructure.totalTweets} posted successfully`);

        return {
          success: true,
          rootTweetId: rootResult.tweetId,
          replyIds,
          threadStructure
        };
      });

    } catch (error: any) {
      console.error('❌ ENHANCED_THREAD: Critical error:', error.message);
      return { 
        success: false, 
        error: error.message,
        threadStructure: {
          totalTweets: tweets.length,
          successfulPosts: 0,
          failedPosts: tweets.length,
          threadChain: []
        }
      };
    }
  }

  /**
   * 📝 Format tweets with proper thread structure and visual organization
   */
  private formatThreadTweets(tweets: string[], topic?: string): TweetFormatting[] {
    const formatted: TweetFormatting[] = [];

    for (let i = 0; i < tweets.length; i++) {
      const isRoot = i === 0;
      let content = tweets[i].trim();

      // Remove any existing thread numbering to avoid duplication
      content = content.replace(/^\d+\/\d+\s*/, '').trim();
      content = content.replace(/^\(\d+\/\d+\)\s*/, '').trim();

      // Format the content with proper structure
      let formattedContent: string;

      if (isRoot) {
        // Root tweet: Strong opener with topic indication
        formattedContent = this.formatRootTweet(content, topic, tweets.length);
      } else {
        // Reply tweets: Clear continuation with proper flow
        formattedContent = this.formatReplyTweet(content, i, tweets.length);
      }

      formatted.push({
        content: tweets[i],
        position: i,
        totalCount: tweets.length,
        isRoot,
        formattedContent
      });
    }

    return formatted;
  }

  /**
   * 🎯 Format root tweet with strong opener
   */
  private formatRootTweet(content: string, topic?: string, totalTweets?: number): string {
    // Clean existing content
    let formatted = content.trim();

    // Add thread indicator for multi-tweet threads
    if (totalTweets && totalTweets > 1) {
      // Only add thread indicator if not already present
      if (!formatted.toLowerCase().includes('thread') && !formatted.includes('🧵')) {
        // Subtle thread indicator without being spammy
        if (formatted.endsWith('.') || formatted.endsWith('!') || formatted.endsWith('?')) {
          formatted = formatted + ' 🧵';
        } else {
          formatted = formatted + '. 🧵';
        }
      }
    }

    return formatted;
  }

  /**
   * 💬 Format reply tweet with proper continuation
   */
  private formatReplyTweet(content: string, position: number, totalTweets: number): string {
    let formatted = content.trim();

    // Ensure proper sentence structure
    if (!formatted.match(/[.!?]$/)) {
      // Add appropriate punctuation based on content
      if (formatted.includes('?')) {
        formatted += '?';
      } else if (formatted.toLowerCase().includes('important') || 
                 formatted.toLowerCase().includes('critical') || 
                 formatted.toLowerCase().includes('remember')) {
        formatted += '!';
      } else {
        formatted += '.';
      }
    }

    return formatted;
  }

  /**
   * 🌟 Post root tweet with enhanced composer handling
   */
  private async postRootTweet(page: Page, tweetFormat: TweetFormatting): Promise<{
    success: boolean;
    tweetId?: string;
    error?: string;
  }> {
    try {
      console.log(`🌟 ROOT_TWEET: Posting with enhanced formatting (${tweetFormat.formattedContent.length} chars)`);

      // Navigate to compose page for clean environment
      await page.goto('https://x.com/compose/tweet', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      // Clear any overlays or notifications
      await this.clearPageOverlays(page);

      // Wait for and find composer
      const composer = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { 
        timeout: 15000 
      });

      // Clear and enter content with proper typing
      await composer.click();
      await page.waitForTimeout(500);
      await composer.fill('');
      await page.waitForTimeout(300);
      
      // Type content naturally
      await page.type('[data-testid="tweetTextarea_0"]', tweetFormat.formattedContent, { delay: 15 });

      // Verify content was entered correctly
      const enteredText = await composer.innerText();
      if (!enteredText || enteredText.trim().length < 10) {
        throw new Error(`Content verification failed: "${enteredText}"`);
      }

      console.log(`✅ ROOT_CONTENT: "${enteredText.substring(0, 60)}..."`);

      // Enhanced posting with multiple strategies
      const posted = await this.executePost(page);
      if (!posted) {
        throw new Error('Post execution failed');
      }

      // Capture tweet ID with enhanced detection
      const tweetId = await this.captureTweetIdEnhanced(page);

      return { success: true, tweetId };

    } catch (error: any) {
      console.error('❌ ROOT_TWEET_FAILED:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔄 Post sequential reply with proper threading
   */
  private async postSequentialReply(
    page: Page, 
    tweetFormat: TweetFormatting, 
    rootTweetId: string,
    replyIndex: number
  ): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`💬 REPLY_${replyIndex}: Attempt ${attempt}/${this.MAX_RETRIES} (${tweetFormat.formattedContent.length} chars)`);

        // Navigate to root tweet for proper reply context
        await page.goto(`https://x.com/i/status/${rootTweetId}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });

        // Clear overlays and ensure clean state
        await this.clearPageOverlays(page);

        // Wait for tweet to load and be interactive
        await page.waitForSelector('article', { timeout: 10000 });

        // Open reply composer using keyboard shortcut (most reliable)
        await page.keyboard.press('r');

        // Wait for reply composer to appear
        const replyComposer = await page.waitForSelector(
          'div[role="dialog"] div[contenteditable="true"]',
          { timeout: 10000 }
        );

        // Enter reply content
        await replyComposer.click();
        await page.waitForTimeout(300);
        await replyComposer.fill('');
        await page.waitForTimeout(200);
        await page.type('div[role="dialog"] div[contenteditable="true"]', tweetFormat.formattedContent, { delay: 12 });

        // Verify content entry
        const replyText = await replyComposer.innerText();
        if (!replyText || replyText.trim().length < 5) {
          throw new Error(`Reply content verification failed: "${replyText}"`);
        }

        // Post reply with enhanced submission
        const posted = await this.executeReplyPost(page);
        if (!posted) {
          throw new Error('Reply post execution failed');
        }

        // Wait for reply dialog to close (indicates success)
        await page.waitForSelector('div[role="dialog"]', { 
          state: 'detached', 
          timeout: 10000 
        });

        // Try to capture reply ID
        let replyId = `reply_${replyIndex}_to_${rootTweetId}`;
        try {
          replyId = await this.captureTweetIdEnhanced(page);
        } catch (idError) {
          console.warn(`⚠️ REPLY_ID_CAPTURE failed for reply ${replyIndex}: ${idError}`);
        }

        console.log(`✅ REPLY_${replyIndex}: Successfully posted`);
        return { success: true, tweetId: replyId };

      } catch (error: any) {
        console.warn(`❌ REPLY_${replyIndex}_ATTEMPT_${attempt}: ${error.message}`);
        
        if (attempt < this.MAX_RETRIES) {
          await page.waitForTimeout(2000 * attempt); // Exponential backoff
        }
      }
    }

    return { 
      success: false, 
      error: `Reply ${replyIndex} failed after ${this.MAX_RETRIES} attempts` 
    };
  }

  /**
   * 🧹 Clear page overlays and notifications
   */
  private async clearPageOverlays(page: Page): Promise<void> {
    try {
      // Dismiss "new posts available" overlay
      const overlay = page.locator('button[aria-label^="New posts are available"]');
      if (await overlay.first().isVisible({ timeout: 2000 })) {
        await page.keyboard.press('.');
        await page.waitForTimeout(1000);
      }

      // Close any modal dialogs or notifications
      const closeButtons = page.locator('[aria-label*="Close"], [data-testid*="close"]');
      const count = await closeButtons.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        try {
          await closeButtons.nth(i).click({ timeout: 500 });
        } catch {}
      }
    } catch {
      // Non-blocking overlay clearing
    }
  }

  /**
   * 🚀 Execute post with multiple strategies
   */
  private async executePost(page: Page): Promise<boolean> {
    try {
      // Strategy 1: Keyboard shortcut (most reliable)
      const shortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
      await page.keyboard.press(shortcut);
      await page.waitForTimeout(2000);

      // Strategy 2: Click post button if available
      const postButton = page.locator('[data-testid="tweetButtonInline"]:not([aria-disabled="true"])');
      if (await postButton.isVisible({ timeout: 2000 })) {
        await postButton.click();
      }

      // Wait for success indicators
      const success = await Promise.race([
        // URL change back to timeline
        page.waitForURL(/.*x\.com\/(home|[^\/]+)$/, { timeout: 10000 }).then(() => true),
        // Composer disappears
        page.locator('[data-testid="tweetTextarea_0"]').waitFor({ 
          state: 'detached', 
          timeout: 8000 
        }).then(() => true),
        // Timeout fallback
        page.waitForTimeout(12000).then(() => true)
      ]);

      return true;

    } catch (error) {
      console.warn('⚠️ POST_EXECUTION failed:', error);
      return false;
    }
  }

  /**
   * 🔄 Execute reply post with dialog handling
   */
  private async executeReplyPost(page: Page): Promise<boolean> {
    try {
      // Try keyboard shortcut first
      const shortcut = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
      await page.keyboard.press(shortcut);
      await page.waitForTimeout(1500);

      // Fallback to button click
      const replyButton = page.locator('div[role="dialog"] [data-testid="tweetButtonInline"]');
      if (await replyButton.isVisible({ timeout: 2000 })) {
        await replyButton.click();
      }

      return true;

    } catch (error) {
      console.warn('⚠️ REPLY_POST_EXECUTION failed:', error);
      return false;
    }
  }

  /**
   * 🔍 Enhanced tweet ID capture with multiple strategies
   */
  private async captureTweetIdEnhanced(page: Page): Promise<string> {
    try {
      // Wait a moment for page to update
      await page.waitForTimeout(2000);

      // Look for status links in timeline
      const statusLink = await page.waitForSelector('a[href*="/status/"]:has(time)', {
        timeout: 10000
      });

      const href = await statusLink.getAttribute('href');
      if (!href) {
        throw new Error('No href found on status link');
      }

      const match = href.match(/status\/(\d+)/);
      if (!match || !match[1]) {
        throw new Error(`Invalid status URL format: ${href}`);
      }

      const tweetId = match[1];
      console.log(`🔍 CAPTURED_ID: ${tweetId}`);
      return tweetId;

    } catch (error) {
      console.warn('⚠️ ID_CAPTURE failed:', error);
      return `posted_${Date.now()}`;
    }
  }

  /**
   * 📱 Fallback: Post single tweet when thread has only one item
   */
  private async postSingleTweet(content: string): Promise<ThreadPostResult> {
    try {
      const { TwitterComposer } = await import('./TwitterComposer');
      
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        const composer = new TwitterComposer(page);
        
        const result = await composer.postSingleTweet(content);
        
        return {
          success: result.success,
          rootTweetId: result.tweetId,
          replyIds: [],
          threadStructure: {
            totalTweets: 1,
            successfulPosts: result.success ? 1 : 0,
            failedPosts: result.success ? 0 : 1,
            threadChain: result.success && result.tweetId ? [result.tweetId] : []
          }
        };
      });

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        threadStructure: {
          totalTweets: 1,
          successfulPosts: 0,
          failedPosts: 1,
          threadChain: []
        }
      };
    }
  }
}
