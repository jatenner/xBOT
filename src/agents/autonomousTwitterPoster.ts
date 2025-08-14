import { IntelligentContentGenerator, ContentGenerationRequest } from './intelligentContentGenerator';
import { EngagementAnalyzer } from '../intelligence/engagementAnalyzer';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { TwitterSessionManager } from '../utils/twitterSessionManager';
import { isLoggedIn } from '../utils/xLoggedIn';
import { saveStorageStateBack } from '../utils/sessionLoader';
import { getPageWithStorage } from '../utils/browser';
import { lintAndSplitThread } from '../utils/tweetLinter';
import { sanitizeForFormat, FinalFormat, containsThreadLanguage, getSanitizationSummary } from '../utils/formatSanitizer';
import { validateThread, ThreadDraft, getThreadValidationConfig } from '../utils/threadValidator';
import { loadBotConfig } from '../config';
import { SELECTORS, SEL } from '../utils/selectors';
import { ContentProducer } from '../generation/producer';
import { BanditArm } from '../learn/bandit';
import { ThreadSchema } from '../generation/systemPrompt';
import { Browser, Page, BrowserContext } from 'playwright';

// Environment variable defaults
const FALLBACK_SINGLE_TWEET_OK = process.env.FALLBACK_SINGLE_TWEET_OK !== 'false'; // default true
const ENABLE_THREADS = process.env.ENABLE_THREADS !== 'false'; // default true
const THREAD_MIN_TWEETS = parseInt(process.env.THREAD_MIN_TWEETS || '4');
const THREAD_MAX_TWEETS = parseInt(process.env.THREAD_MAX_TWEETS || '8');
const THREAD_STRICT_REPLY_MODE = process.env.THREAD_STRICT_REPLY_MODE !== 'false'; // default true
const LONGFORM_AUTODETECT = process.env.LONGFORM_AUTODETECT !== 'false'; // default true
const LONGFORM_FALLBACK_TO_THREAD = process.env.LONGFORM_FALLBACK_TO_THREAD !== 'false'; // default true

export interface PostingOptions {
  dryRun?: boolean;
  forcePost?: boolean;
}

export interface PostingResult {
  success: boolean;
  tweetId?: string;
  content: string;
  method: 'browser' | 'failed';
  error?: string;
  metrics?: {
    contentScore: number;
    estimatedEngagement: number;
  };
}

export class AutonomousTwitterPoster {
  private static instance: AutonomousTwitterPoster;
  private contentGenerator: IntelligentContentGenerator;
  private engagementAnalyzer: EngagementAnalyzer;
  private db: AdvancedDatabaseManager;
  // TwitterSessionManager uses static methods, no instance needed
  private persistentContext: BrowserContext | null = null;
  private readonly userDataDir: string;
  private isShuttingDown = false;

  private constructor() {
    this.contentGenerator = IntelligentContentGenerator.getInstance();
    this.engagementAnalyzer = EngagementAnalyzer.getInstance();
    this.db = AdvancedDatabaseManager.getInstance();
    // TwitterSessionManager uses static methods only
    this.userDataDir = process.env.PW_USER_DATA_DIR || "/app/.pw-data";
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  public static getInstance(): AutonomousTwitterPoster {
    if (!AutonomousTwitterPoster.instance) {
      AutonomousTwitterPoster.instance = new AutonomousTwitterPoster();
    }
    return AutonomousTwitterPoster.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Startup banner with build info
      const pkg = require('../../package.json');
      console.log(`🚀 BUILD:${pkg.version} APP_ENV:${process.env.APP_ENV} LIVE_POSTS:${process.env.LIVE_POSTS}`);
      console.log('🤖 Initializing Autonomous Twitter Poster...');
      console.log('🌐 Browser-only posting mode (No Twitter API)');
      console.log('✅ Autonomous Twitter Poster initialized (Browser posting mode)');
    } catch (error: any) {
      console.warn('⚠️ Twitter Poster initialization warning:', error.message);
      // Don't throw - initialization is minimal for browser-only mode
    }
  }

  public async createAndPostContent(request?: ContentGenerationRequest, options: PostingOptions = {}): Promise<PostingResult> {
    try {
      console.log('🚀 Creating and posting autonomous content...');

      // Check if posting is enabled
      const postingEnabled = await this.isPostingEnabled();
      if (!postingEnabled && !options.forcePost) {
        console.log('⏸️ Posting is disabled');
        return {
          success: false,
          content: '',
          method: 'failed',
          error: 'Posting is disabled'
        };
      }

      // Check daily limit
      const dailyLimit = await this.getDailyPostLimit();
      const todaysPosts = await this.getTodaysPostCount();
      
      if (todaysPosts >= dailyLimit && !options.forcePost) {
        console.log(`📊 Daily limit reached: ${todaysPosts}/${dailyLimit}`);
        return {
          success: false,
          content: '',
          method: 'failed',
          error: 'Daily post limit reached'
        };
      }

      // Generate intelligent content
      const contentRequest = request || await this.generateSmartContentRequest();
      const generatedContent = await this.contentGenerator.generateContent(contentRequest);

      console.log(`📝 Generated content (score: ${generatedContent.contentScore}):`, 
                  generatedContent.content.substring(0, 100) + '...');

      // Quality check
      if (generatedContent.contentScore < 60 && !options.forcePost) {
        console.log('⚠️ Content quality too low, regenerating...');
        return await this.createAndPostContent(request, options);
      }

      // Dry run mode
      if (options.dryRun) {
        console.log('🧪 DRY RUN MODE - Content would be posted:');
        console.log(generatedContent.content);
        return {
          success: true,
          content: generatedContent.content,
          method: 'browser',
          metrics: {
            contentScore: generatedContent.contentScore,
            estimatedEngagement: generatedContent.estimatedEngagement
          }
        };
      }

      // Post the content
      let postingResult: PostingResult;

      if (generatedContent.isThread) {
        // Use the new thread posting method and convert result
        const threadResult = await this.postThread(generatedContent.threadParts!);
        postingResult = {
          success: true,
          tweetId: threadResult.rootTweetId,
          content: generatedContent.threadParts!.join('\n\n'),
          method: 'browser'
        };
      } else {
        postingResult = await this.postSingle(generatedContent.content, options);
      }

      // Store posting data
      if (postingResult.success && postingResult.tweetId) {
        await this.storePostedContent(postingResult.tweetId, generatedContent, contentRequest);
      }

      return postingResult;

    } catch (error: any) {
      console.error('❌ Failed to create and post content:', error.message);
      return {
        success: false,
        content: '',
        method: 'failed',
        error: error.message
      };
    }
  }

  private async postSingle(content: string, options: PostingOptions): Promise<PostingResult> {
    // Browser posting only
    try {
      console.log('🌐 Posting via browser automation...');
      const tweetId = await this.postViaBrowser(content);
      
      return {
        success: true,
        tweetId,
        content,
        method: 'browser'
      };
    } catch (error: any) {
      console.warn('⚠️ Browser posting failed:', error.message);
      return {
        success: false,
        content,
        method: 'failed',
        error: `Browser posting failed: ${error.message}`
      };
    }
  }



  private async postViaBrowser(content: string | string[]): Promise<string> {
    console.log('🎭 POST_START');
    
    // Guard against real posting during verification
    if (process.env.LIVE_POSTS !== 'true') {
      console.log('📋 POST_SKIPPED_LIVE_OFF - LIVE_POSTS not enabled');
      throw new Error('POST_SKIPPED_LIVE_OFF');
    }
    
    // Check if we have a valid Twitter session before attempting to post
    if (!TwitterSessionManager.hasValidSession()) {
      console.log('⚠️ POST_SKIPPED_NO_SESSION: No valid Twitter session found');
      console.log('💡 To fix: Save Twitter cookies to data/twitter_session.json');
      throw new Error('POST_SKIPPED_NO_SESSION: No valid Twitter session - cookies required for browser posting');
    }
    
    console.log('🌐 Posting via browser automation...');
    
    // Handle input: either string or array
    let rawTweets: string[];
    if (typeof content === 'string') {
      // Only allow single strings if config permits
      const { loadBotConfig } = await import('../config');
      const config = await loadBotConfig();
      
      if (!config.fallbackSingleTweetOk) {
        throw new Error('FALLBACK_SINGLE_TWEET_DISABLED: Single tweet posting disabled by config');
      }
      
      rawTweets = content.includes('\n\n') ? content.split('\n\n') : [content];
    } else {
      rawTweets = content;
    }
    
    if (!rawTweets || rawTweets.length === 0) {
      throw new Error('NO_TWEETS_ARRAY_ABORT: No tweets provided for posting');
    }
    
    // Lint the tweets
    const { tweets, reasons } = lintAndSplitThread(rawTweets, 'thread');
    const totalChars = tweets.reduce((sum, t) => sum + t.length, 0);
    
    console.log(`LINTER: tweets=${tweets.length}, totalChars=${totalChars}, fixes=[${reasons.join(', ')}]`);
    
    if (tweets.length === 1) {
      return await this.postSingleTweet(tweets[0]);
    } else {
      return await this.postThreadChain(tweets);
    }
  }

  /**
   * Post a single tweet with format sanitization and validation
   */
  private async postSingleTweet(content: string, finalFormat: FinalFormat = 'single'): Promise<string> {
    return await this.withPage(async (page) => {
      console.log('POST_START');
      
      // Apply format sanitization
      const originalContent = content;
      let sanitizedContent = sanitizeForFormat(content, finalFormat);
      
      // Apply linting
      const { tweets } = lintAndSplitThread([sanitizedContent], finalFormat);
      sanitizedContent = tweets[0];
      
      // Final sanitization check for singles
      if (finalFormat === 'single' && containsThreadLanguage(sanitizedContent)) {
        const summary = getSanitizationSummary(sanitizedContent, sanitizeForFormat(sanitizedContent, 'single'));
        sanitizedContent = sanitizeForFormat(sanitizedContent, 'single');
        console.log(`FORMAT_SANITIZER: removed_thread_language_single, actions=[${summary.join('|')}]`);
      }
      
      console.log(`FORMAT_DECISION: final=${finalFormat}, reason=engine, tweets=1`);
      
      // Navigate directly to Twitter home to check if logged in
      const loggedIn = await isLoggedIn(page);
      
      if (!loggedIn) {
        throw new Error('POST_SKIPPED_PLAYWRIGHT: login_required');
      }
      
      console.log('✅ LOGIN_CHECK: Confirmed logged in to X');

      // Navigate to compose tweet
      await page.goto('https://x.com/compose/tweet', { 
        waitUntil: "domcontentloaded", 
        timeout: 60000 
      });
      await page.waitForTimeout(3000);

      // Type content using robust selectors
      await page.click(SEL.composerBox);
      await page.waitForTimeout(500);
      await page.fill(SEL.composerBox, sanitizedContent);
      await page.waitForTimeout(1000);

      // Post using robust selectors
      const posted = await this.tryPostWithFallbacks(page);
      if (!posted) {
        throw new Error('Failed to post tweet - all post methods failed');
      }
      
      await page.waitForTimeout(3000);

      // Extract tweet ID from URL (simplified)
      const currentUrl = page.url();
      const tweetIdMatch = currentUrl.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `browser_${Date.now()}`;

      console.log(`POST_DONE: id=${tweetId}`);
      
      // Save session cookies
      const cookieCount = await this.saveCookiesCount(page);
      console.log(`SESSION_SAVED: cookies=${cookieCount}`);
      
      return tweetId;
    });
  }

  /**
   * Post a proper thread as reply chain with format sanitization and strict validation
   * Implements real reply chains with human delays and retry logic
   */
  public async postThread(tweets: string[], finalFormat: FinalFormat = 'thread'): Promise<{rootTweetId: string; permalink: string; replyIds: string[]}> {
    if (!tweets || tweets.length === 0) {
      throw new Error('NO_TWEETS_ARRAY_ABORT: Empty tweets array provided');
    }

    return await this.withPage(async (page) => {
      console.log('POST_START');
      
      // If this is a thread format, apply strict validation
      if (finalFormat === 'thread') {
        const config = await loadBotConfig();
        const threadDraft: ThreadDraft = { tweets: tweets.map(text => ({ text })) };
        
        // Validate thread integrity
        const validation = validateThread(threadDraft);
        
        if (!validation.ok) {
          console.log(`THREAD_VALIDATE: k=${validation.k || tweets.length} failed → reason=${validation.reason}`);
          
          if (config.fallbackSingleTweetOk) {
            console.log('THREAD_FALLBACK: to=single (allowed=true)');
            const singleContent = sanitizeForFormat(tweets[0], 'single');
            return {
              rootTweetId: await this.postSingleTweet(singleContent, 'single'),
              permalink: '',
              replyIds: []
            };
          } else {
            console.log('THREAD_SKIP: fallback=false reason=invalid_thread');
            throw new Error(`THREAD_VALIDATION_FAILED: ${validation.reason} (k=${validation.k})`);
          }
        }
        
        // Use the repaired tweets from validation
        const sanitizedTweets = validation.repairedTweets!;
        console.log(`THREAD_VALIDATE: k=${sanitizedTweets.length} OK`);
        console.log(`FORMAT_DECISION: final=thread, tweets=${sanitizedTweets.length}`);
        
        // Continue with validated and repaired tweets
        return await this.postValidatedThread(page, sanitizedTweets);
      } else {
        // Apply format sanitization for single posts
        let sanitizedTweets = tweets.map(tweet => sanitizeForFormat(tweet, finalFormat));
        
        // Apply linting to the content
        const { tweets: lintedTweets } = lintAndSplitThread(sanitizedTweets, finalFormat);
        sanitizedTweets = lintedTweets;
        
        console.log(`FORMAT_DECISION: final=${finalFormat}, tweets=${sanitizedTweets.length}`);
        
        if (sanitizedTweets.length === 1) {
          return {
            rootTweetId: await this.postSingleTweet(sanitizedTweets[0], finalFormat),
            permalink: '',
            replyIds: []
          };
        } else {
          // Multiple tweets but not thread format - use thread chain
          return await this.postValidatedThread(page, sanitizedTweets);
        }
      }
    });
  }

  /**
   * Post a validated thread with proper reply chains
   */
  private async postValidatedThread(page: any, sanitizedTweets: string[]): Promise<{rootTweetId: string; permalink: string; replyIds: string[]}> {
      
      // Check login
      const loggedIn = await isLoggedIn(page);
      if (!loggedIn) {
        throw new Error('POST_SKIPPED_PLAYWRIGHT: login_required');
      }
      
      console.log('✅ LOGIN_CHECK: Confirmed logged in to X');
      
      // Step 1: Post T1
      console.log(`THREAD_CHAIN: k=1/${sanitizedTweets.length}, in_reply_to=none`);
      await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Use resilient selectors for compose area
      let composed = false;
      for (const selector of SELECTORS.composeArea) {
        try {
          await page.click(selector, { timeout: 2000 });
          await page.fill(selector, sanitizedTweets[0]);
          composed = true;
          break;
        } catch {
          continue;
        }
      }

      if (!composed) {
        throw new Error('Failed to find compose area');
      }
      
      // Post T1 with resilient selectors
      let posted = false;
      for (const selector of SELECTORS.postButton) {
        try {
          await page.click(selector, { timeout: 3000 });
          posted = true;
          break;
        } catch {
          continue;
        }
      }

      if (!posted) {
        // Keyboard fallback
        try {
          await page.keyboard.press('Meta+Enter');
          posted = true;
        } catch {
          try {
            await page.keyboard.press('Control+Enter');
            posted = true;
          } catch {
            throw new Error('Failed to post T1 - all methods failed');
          }
        }
      }
      
      // Wait for navigation to permalink
      await page.waitForTimeout(3000);
      
      // Extract permalink and tweet ID
      const currentUrl = page.url();
      const tweetIdMatch = currentUrl.match(/status\/(\d+)/);
      if (!tweetIdMatch) {
        throw new Error('Failed to extract tweet ID from URL');
      }
      
      const rootTweetId = tweetIdMatch[1];
      const permalink = currentUrl;
      
      console.log(`POST_DONE: id=${rootTweetId}`);
      
      // If only one tweet, we're done
      if (sanitizedTweets.length === 1) {
        const cookieCount = await this.saveCookiesCount(page);
        console.log(`SESSION_SAVED: cookies=${cookieCount}`);
        return { rootTweetId, permalink, replyIds: [] };
      }
      
      // Step 2: Post replies with proper reply chain and human delays
      const replyIds: string[] = [];
      let currentInReplyTo = rootTweetId;
      
      for (let i = 1; i < sanitizedTweets.length; i++) {
        // Human delay between posts (600-1200ms)
        const humanDelay = Math.floor(Math.random() * 600) + 600;
        await page.waitForTimeout(humanDelay);
        
        console.log(`THREAD_CHAIN: k=${i + 1}/${sanitizedTweets.length}, in_reply_to=${currentInReplyTo}`);
        
        // Retry logic for each reply
        let replySuccess = false;
        let replyId = '';
        
        for (let retryAttempt = 1; retryAttempt <= 2; retryAttempt++) {
          try {
            // Navigate to the tweet we're replying to
            const replyToUrl = `https://x.com/x/status/${currentInReplyTo}`;
            await page.goto(replyToUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1500);
            
            // Click reply button with resilient selectors
            let replyClicked = false;
            for (const selector of SELECTORS.replyButton) {
              try {
                await page.click(selector, { timeout: 3000 });
                replyClicked = true;
                break;
              } catch {
                continue;
              }
            }

            if (!replyClicked) {
              throw new Error('Failed to click reply button');
            }
            
            // Wait for compose area and fill
            await page.waitForTimeout(1000);
            let replyComposed = false;
            for (const selector of SELECTORS.composeArea) {
              try {
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.fill(selector, sanitizedTweets[i]);
                replyComposed = true;
                break;
              } catch {
                continue;
              }
            }

            if (!replyComposed) {
              throw new Error('Failed to fill reply compose area');
            }
            
            // Post reply
            let replyPosted = false;
            for (const selector of SELECTORS.postButton) {
              try {
                await page.click(selector, { timeout: 3000 });
                replyPosted = true;
                break;
              } catch {
                continue;
              }
            }

            if (!replyPosted) {
              // Keyboard fallback
              try {
                await page.keyboard.press('Meta+Enter');
                replyPosted = true;
              } catch {
                await page.keyboard.press('Control+Enter');
                replyPosted = true;
              }
            }
            
            // Wait for network idle and extract reply ID
            await page.waitForTimeout(2000);
            
            // Try to get the reply ID from the URL or generate one
            const newUrl = page.url();
            const newTweetMatch = newUrl.match(/status\/(\d+)/);
            replyId = newTweetMatch ? newTweetMatch[1] : `reply_${rootTweetId}_${i}`;
            
            replySuccess = true;
            console.log(`POST_DONE: id=${replyId}`);
            break;
            
          } catch (error: any) {
            if (retryAttempt === 2) {
              console.log(`THREAD_ABORTED_AFTER: k=${i + 1}, error=${error.message}`);
              // Save what we have so far
              const cookieCount = await this.saveCookiesCount(page);
              console.log(`SESSION_SAVED: cookies=${cookieCount}`);
              return { rootTweetId, permalink, replyIds };
            }
            await page.waitForTimeout(1000 * retryAttempt); // Small backoff
          }
        }
        
        if (replySuccess) {
          replyIds.push(replyId);
          currentInReplyTo = replyId; // Next reply replies to this one
        }
      }
      
      // Save session cookies
      const cookieCount = await this.saveCookiesCount(page);
      console.log(`SESSION_SAVED: cookies=${cookieCount}`);
      
      return { rootTweetId, permalink, replyIds };
  }

  /**
   * Save session cookies and return count
   */
  private async saveCookiesCount(page: Page): Promise<number> {
    try {
      await saveStorageStateBack(page.context());
      const context = page.context();
      const cookies = await context.cookies();
      return cookies.length;
    } catch {
      return 0;
    }
  }

  /**
   * Store thread post data in database
   */
  private async storeThreadPost(rootId: string, permalink: string, tweets: string[], replyIds: string[]): Promise<void> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      await dbManager.executeQuery('store_thread_post', async (client) => {
        const { error } = await client
          .from('posts')
          .insert({
            root_id: rootId,
            permalink,
            tweets_json: { tweets, reply_ids: replyIds },
            posted_at: new Date().toISOString()
          });

        if (error) {
          console.error('Failed to store thread post:', error.message);
          throw error;
        }

        console.log(`📊 Thread post stored: ${rootId}`);
        return { success: true };
      });
    } catch (error: any) {
      console.warn(`Failed to store thread post ${rootId}:`, error.message);
      // Don't throw - posting succeeded even if storage failed
    }
  }

  private async postThreadChain(tweets: string[]): Promise<string> {
    const result = await this.postThread(tweets);
    return result.rootTweetId;
  }
  
  private async tryPostWithFallbacks(page: Page): Promise<boolean> {
    // Try multiple selectors with fallbacks
    for (const selector of SELECTORS.postButton) {
      try {
        await page.click(selector, { timeout: 2000 });
        return true;
      } catch {
        continue;
      }
    }
    
    // Keyboard fallback
    try {
      await page.keyboard.press('Meta+Enter'); // Cmd+Enter on Mac
      return true;
    } catch {
      try {
        await page.keyboard.press('Control+Enter'); // Ctrl+Enter on Windows/Linux
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Post a learning-optimized thread using the bandit system
   */
  public async postLearningThread(threadData: ThreadSchema, arm: BanditArm): Promise<PostingResult> {
    try {
      console.log('🧵 THREAD_POST: Starting learning-optimized thread posting...');
      
          // Lint the thread content
    const { tweets, reasons } = lintAndSplitThread(threadData.tweets, 'thread');
    console.log(`LINTER: tweets=${tweets.length}, ok`);
    
    if (reasons.length > 0) {
      console.log('LINTER fixes:', reasons.join(', '));
    }
      
      // Post the thread as reply chain
      const result = await this.postThreadChainWithStorage(tweets);
      
      if (result.success && result.tweetId && result.permalink) {
        // Store in posts table with learning metadata
        await this.storePostWithMetadata(result, threadData, arm);
        
        // Schedule metric snapshots
        await this.scheduleMetricSnapshots(result.postId!, result.permalink);
        
        console.log(`THREAD_COMPLETE: ${tweets.length} tweets posted with ID ${result.tweetId}`);
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Learning thread posting failed:', error.message);
      return {
        success: false,
        content: threadData.tweets.join('\n\n'),
        method: 'failed',
        error: error.message
      };
    }
  }

  private async postThreadChainWithStorage(tweets: string[]): Promise<PostingResult & { permalink?: string; postId?: string }> {
    return await this.withPage(async (page) => {
      // Check login with enhanced selectors
      const loggedIn = await this.checkLoginWithSelectors(page);
      if (!loggedIn) {
        throw new Error('POST_SKIPPED_PLAYWRIGHT: login_required');
      }
      
      console.log('✅ LOGIN_CHECK: Confirmed logged in to X');
      
      // Post T1
      console.log('THREAD_POST: T1 posting...');
      await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
      
      // Use enhanced selectors for compose area
      await this.clickWithFallbacks(page, SELECTORS.composeArea);
      await page.fill(SELECTORS.composeArea[0], tweets[0]);
      
      const posted = await this.tryPostWithFallbacks(page);
      if (!posted) {
        throw new Error('Failed to post T1');
      }
      
      await page.waitForTimeout(3000);
      
      // Extract permalink and tweet ID
      const currentUrl = page.url();
      const tweetIdMatch = currentUrl.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `thread_${Date.now()}`;
      const permalink = currentUrl;
      
      console.log(`THREAD_POST: T1 posted id=${tweetId} permalink=${permalink}`);
      
      // Post replies if this is a thread
      if (tweets.length > 1) {
        for (let i = 1; i < tweets.length; i++) {
          const resumePoint = process.env.THREAD_RESUME_POINT;
          if (resumePoint && parseInt(resumePoint) > i + 1) {
            console.log(`THREAD_RESUME: Skipping to ${resumePoint}`);
            continue;
          }
          
          try {
            console.log(`THREAD_REPLY: ${i + 1}/${tweets.length} posting...`);
            
            // Click reply button with fallbacks
            await this.clickWithFallbacks(page, SELECTORS.replyButton);
            await page.waitForSelector(SELECTORS.composeArea[0], { timeout: 5000 });
            await page.fill(SELECTORS.composeArea[0], tweets[i]);
            
            const replyPosted = await this.tryPostWithFallbacks(page);
            if (!replyPosted) {
              console.log(`THREAD_RESUME_POINT=${i + 1}`);
              throw new Error(`Failed to post reply ${i + 1}`);
            }
            
            // Human delay between tweets (2-2.5 seconds)
            const delayMs = 2000 + Math.random() * 500;
            await page.waitForTimeout(delayMs);
            console.log(`THREAD_REPLY: ${i + 1}/${tweets.length} posted`);
            
          } catch (error) {
            console.log(`THREAD_RESUME_POINT=${i + 1}`);
            throw error;
          }
        }
      }
      
      return {
        success: true,
        tweetId,
        permalink,
        postId: crypto.randomUUID(),
        content: tweets.join('\n\n'),
        method: 'browser' as const
      };
    });
  }

  private async checkLoginWithSelectors(page: Page): Promise<boolean> {
    for (const selector of SELECTORS.accountSwitcher) {
      try {
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 3000 });
        if (isVisible) return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  private async clickWithFallbacks(page: Page, selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        return;
      } catch {
        continue;
      }
    }
    throw new Error(`Failed to click any of: ${selectors.join(', ')}`);
  }

  private async storePostWithMetadata(
    result: PostingResult & { permalink?: string; postId?: string }, 
    threadData: ThreadSchema, 
    arm: BanditArm
  ): Promise<void> {
    await this.db.executeQuery('store_learning_post', async (client) => {
      const { error } = await client
        .from('posts')
        .insert({
          id: result.postId,
          tweet_id: result.tweetId,
          permalink: result.permalink,
          posted_at: new Date().toISOString(),
          topic_cluster: arm.topic_cluster,
          hook_type: arm.hook_type,
          cta_type: arm.cta_type,
          thread_len: threadData.tweets.length,
          sources_json: threadData.source_urls,
          model_version: 'gpt-4o-mini'
        });

      if (error) throw error;
      return { success: true };
    });
  }

  private async scheduleMetricSnapshots(postId: string, permalink: string): Promise<void> {
    const { MetricsScraper } = await import('../metrics/scraper');
    const scraper = MetricsScraper.getInstance();
    
    // Schedule snapshots at 30m, 2h, 24h
    const intervals = [30 * 60 * 1000, 2 * 60 * 60 * 1000, 24 * 60 * 60 * 1000];
    
    intervals.forEach((interval, index) => {
      setTimeout(async () => {
        try {
          console.log(`METRICS: Taking ${['30m', '2h', '24h'][index]} snapshot for ${postId}`);
          // This would be handled by the metrics processing system
        } catch (error: any) {
          console.error(`Failed to schedule metrics for ${postId}:`, error.message);
        }
      }, interval);
    });
  }



  private async generateSmartContentRequest(): Promise<ContentGenerationRequest> {
    // Get top performing topics
    const topTopics = await this.contentGenerator.getTopPerformingTopics(5);
    const bestTimes = await this.engagementAnalyzer.getBestPostingTimes();
    
    // Choose content type based on recent performance
    const contentTypes: Array<'thread' | 'single' | 'reply'> = ['thread', 'single', 'thread', 'single'];
    const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
    
    // Choose topic
    const topic = topTopics.length > 0 
      ? topTopics[Math.floor(Math.random() * Math.min(3, topTopics.length))].topic
      : undefined;

    // Choose mood based on time and performance data
    const moods: Array<'informative' | 'engaging' | 'funny' | 'controversial'> = 
      ['informative', 'engaging', 'funny'];
    const mood = moods[Math.floor(Math.random() * moods.length)];

    return {
      contentType,
      topic,
      mood,
      targetLength: contentType === 'thread' ? 'long' : 'medium'
    };
  }

  private async storePostedContent(tweetId: string, content: any, request: ContentGenerationRequest): Promise<void> {
    try {
      await this.db.executeQuery(
        'store_posted_content',
        async (client) => {
          const { error } = await client
            .from('tweets')
            .insert({
              tweet_id: tweetId,
              content: content.content,
              content_type: request.contentType,
              topic: request.topic || 'general',
              mood: request.mood || 'informative',
              content_score: content.contentScore,
              estimated_engagement: content.estimatedEngagement,
              platform: 'twitter',
              status: 'posted'
            });
          if (error) throw error;
          return { success: true };
        }
      );

      console.log(`💾 Stored posted content: ${tweetId}`);
    } catch (error) {
      console.warn('Failed to store posted content:', error);
    }
  }

  private async isPostingEnabled(): Promise<boolean> {
    try {
      const result = await this.db.executeQuery(
        'check_posting_enabled',
        async (client) => {
          const { data, error } = await client
            .from('bot_config')
            .select('config_value')
            .eq('config_key', 'posting_enabled')
            .single();
          if (error) throw error;
          return data;
        }
      );
      return result?.config_value === 'true';
    } catch (error) {
      console.warn('Failed to check posting status, defaulting to false');
      return false;
    }
  }

  private async getDailyPostLimit(): Promise<number> {
    try {
      const { loadBotConfig } = await import('../config');
      const config = await loadBotConfig();
      return config.maxDailyPosts;
    } catch (error) {
      console.warn('Failed to load config, defaulting to 100');
      console.log("CONFIG: MAX_DAILY_POSTS = 100 (fallback)");
      return 100;
    }
  }

  private async getTodaysPostCount(): Promise<number> {
    try {
      const result = await this.db.executeQuery(
        'get_todays_post_count',
        async (client) => {
          const today = new Date().toISOString().split('T')[0];
          const { count, error } = await client
            .from('tweets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'posted')
            .gte('created_at', `${today}T00:00:00`)
            .lt('created_at', `${today}T23:59:59`);
          if (error) throw error;
          return count || 0;
        }
      );
      return result;
    } catch (error) {
      console.warn('Failed to get today post count, defaulting to 0');
      return 0;
    }
  }



  private async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    let ctx: any = null;
    let page: any = null;
    
    try {
      console.log('🎭 POST_START');
      
      // Use persistent storage path that survives Railway restarts
      const sessionPath = process.env.RAILWAY_ENVIRONMENT === 'production' 
        ? '/app/data/twitter-session.json'  // Persistent volume in Railway
        : '/tmp/twitter-auth.json';         // Local development
      
      // Ensure directory exists for persistent storage
      if (process.env.RAILWAY_ENVIRONMENT === 'production') {
        const sessionDir = require('path').dirname(sessionPath);
        try {
          require('fs').mkdirSync(sessionDir, { recursive: true });
        } catch (dirError) {
          console.warn('⚠️ Could not create session directory:', dirError.message);
        }
      }
      
      const pageData = await getPageWithStorage(sessionPath);
      ctx = pageData.ctx;
      page = pageData.page;
      console.log('✅ New page created successfully');
      
      // Execute the posting function
      const result = await fn(page);
      
      // Save storage state after successful operation
      try {
        const currentStorageState = await ctx.storageState();
        saveStorageStateBack(currentStorageState);
      } catch (saveError) {
        console.warn('SESSION_LOADER: Failed to save storage state back:', saveError);
      }
      
      return result;
      
    } catch (error: any) {
      const msg = String(error?.message || error);
      console.error('⚠️ POST_SKIPPED_PLAYWRIGHT:', error.name, '-', msg);
      
      return Promise.reject(new Error(`POST_SKIPPED_PLAYWRIGHT: ${msg}`));
      
    } finally {
      // Always clean up resources in finally block
      if (ctx) {
        try {
          await ctx.close();
          console.log('🧹 Browser context cleaned up');
        } catch (cleanupError) {
          console.warn('⚠️ Context cleanup warning:', cleanupError);
        }
      }
    }
  }



  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    console.log('🛑 Graceful shutdown initiated...');
    this.isShuttingDown = true;
    
    try {
      if (this.persistentContext) {
        await this.persistentContext.close();
      }
      console.log('✅ Browser resources cleaned up');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }
}