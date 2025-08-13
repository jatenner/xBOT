import { IntelligentContentGenerator, ContentGenerationRequest } from './intelligentContentGenerator';
import { EngagementAnalyzer } from '../intelligence/engagementAnalyzer';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { TwitterSessionManager } from '../utils/sessionManager';
import { getPageWithStorage } from '../utils/browser';
import { Browser, Page, BrowserContext } from 'playwright';

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
  private sessionManager: TwitterSessionManager;
  private persistentContext: BrowserContext | null = null;
  private readonly userDataDir: string;
  private isShuttingDown = false;

  private constructor() {
    this.contentGenerator = IntelligentContentGenerator.getInstance();
    this.engagementAnalyzer = EngagementAnalyzer.getInstance();
    this.db = AdvancedDatabaseManager.getInstance();
    this.sessionManager = TwitterSessionManager.getInstance();
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
        postingResult = await this.postThread(generatedContent.threadParts!, options);
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

  private async postThread(threadParts: string[], options: PostingOptions): Promise<PostingResult> {
    // Browser posting only for threads
    try {
      console.log('🌐 Posting thread via browser automation...');
      const tweetId = await this.postThreadViaBrowser(threadParts);
      
      return {
        success: true,
        tweetId,
        content: threadParts.join('\n\n'),
        method: 'browser'
      };
    } catch (error: any) {
      console.warn('⚠️ Browser thread posting failed:', error.message);
      return {
        success: false,
        content: threadParts.join('\n\n'),
        method: 'failed',
        error: `Browser thread posting failed: ${error.message}`
      };
    }
  }

  private async postViaBrowser(content: string): Promise<string> {
    console.log('🌐 Posting via browser automation...');
    
    return await this.withPage(async (page) => {
      // Navigate directly to Twitter home to check if logged in
      console.log('🌐 Navigating to Twitter...');
      await page.goto('https://twitter.com/home', { 
        waitUntil: "domcontentloaded", 
        timeout: 60000 
      });
      
      // Check if we're already logged in by looking for compose button
      const isLoggedIn = await page.locator('[data-testid="SideNav_NewTweet_Button"], [aria-label="Post"]').first().isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!isLoggedIn) {
        console.log('🔐 Need to login to Twitter...');
        // For now, throw error - login flow will be handled separately
        throw new Error('Not logged in to Twitter - login required');
      }
      
      console.log('✅ Already logged in to Twitter');

      // Navigate to compose tweet
      console.log('📝 Opening tweet composer...');
      await page.goto('https://twitter.com/compose/tweet', { 
        waitUntil: "domcontentloaded", 
        timeout: 60000 
      });
      await page.waitForTimeout(3000);

      // Type content
      console.log('⌨️ Typing tweet content...');
      const tweetBox = await page.locator('[data-testid="tweetTextarea_0"]').first();
      await tweetBox.click(); // Focus first
      await page.waitForTimeout(500);
      await tweetBox.fill(content);
      await page.waitForTimeout(1000);

      // Trigger input event to enable post button
      await tweetBox.dispatchEvent('input');
      await page.waitForTimeout(1000);

      // Wait for post button to be enabled
      console.log('🔄 Waiting for post button to be enabled...');
      const postButton = await page.locator('[data-testid="tweetButtonInline"]').first();
      await postButton.waitFor({ state: 'attached' });
      
      // Try multiple post button selectors
      const postSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]', 
        '[role="button"]:has-text("Post")',
        'button:has-text("Tweet")'
      ];
      
      let posted = false;
      for (const selector of postSelectors) {
        try {
          const button = await page.locator(selector).first();
          if (await button.isEnabled()) {
            console.log(`✅ Found enabled post button: ${selector}`);
            await button.click();
            posted = true;
            break;
          }
        } catch (e) {
          console.log(`⚠️ Post button ${selector} not found or enabled`);
        }
      }
      
      if (!posted) {
        // Fallback: press Ctrl+Enter (tweet shortcut)
        console.log('🔄 Using keyboard shortcut to post...');
        await page.keyboard.press('Control+Enter');
      }
      
      await page.waitForTimeout(3000);

      // Extract tweet ID from URL (simplified)
      const currentUrl = page.url();
      const tweetIdMatch = currentUrl.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `browser_${Date.now()}`;

      console.log('✅ Posted via browser, tweet ID:', tweetId);
      return tweetId;
    });
  }

  private async postThreadViaBrowser(threadParts: string[]): Promise<string> {
    // Simplified - post as single long tweet for now
    const fullContent = threadParts.join('\n\n');
    return await this.postViaBrowser(fullContent);
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
      const result = await this.db.executeQuery(
        'get_daily_post_limit',
        async (client) => {
          const { data, error } = await client
            .from('bot_config')
            .select('config_value')
            .eq('config_key', 'max_daily_posts')
            .single();
          if (error) throw error;
          return data;
        }
      );
      return parseInt(result?.config_value) || 8;
    } catch (error) {
      console.warn('Failed to get daily limit, defaulting to 8');
      return 8;
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
        await ctx.storageState({ path: sessionPath });
        console.log('💾 Storage state saved successfully');
      } catch (saveError) {
        console.warn('⚠️ Failed to save storage state:', saveError);
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