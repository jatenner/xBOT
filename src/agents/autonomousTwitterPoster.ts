import { IntelligentContentGenerator, ContentGenerationRequest } from './intelligentContentGenerator';
import { SimpleEngagementAnalyzer } from '../intelligence/simpleEngagementAnalyzer';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';
import { Browser, Page } from 'playwright';

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
  private engagementAnalyzer: SimpleEngagementAnalyzer;
  private db: AdvancedDatabaseManager;
  private browser: Browser | null = null;

  private constructor() {
    this.contentGenerator = IntelligentContentGenerator.getInstance();
    this.engagementAnalyzer = SimpleEngagementAnalyzer.getInstance();
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): AutonomousTwitterPoster {
    if (!AutonomousTwitterPoster.instance) {
      AutonomousTwitterPoster.instance = new AutonomousTwitterPoster();
    }
    return AutonomousTwitterPoster.instance;
  }

  public async initialize(): Promise<void> {
    try {
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
    // Runtime browser installation for Railway
    try {
      console.log('🎭 Checking Playwright browser availability...');
      const { execSync } = require('child_process');
      
      // Test if browsers are available
      const playwright = await import('playwright');
      try {
        await playwright.chromium.launch({ headless: true });
        console.log('✅ Playwright browsers are available');
      } catch (browserError: any) {
        if (browserError.message.includes("Executable doesn't exist")) {
          console.log('🔧 Installing Playwright browsers at runtime...');
          execSync('npx playwright install chromium', { stdio: 'inherit' });
          console.log('✅ Runtime browser installation complete');
        } else {
          throw browserError;
        }
      }
    } catch (installError: any) {
      console.warn('⚠️ Browser installation failed:', installError.message);
    }

    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to Twitter
      await page.goto('https://twitter.com/compose/tweet');
      await page.waitForTimeout(3000);

      // Type content
      const tweetBox = await page.locator('[data-testid="tweetTextarea_0"]').first();
      await tweetBox.fill(content);
      await page.waitForTimeout(1000);

      // Click post button
      const postButton = await page.locator('[data-testid="tweetButtonInline"]').first();
      await postButton.click();
      await page.waitForTimeout(3000);

      // Extract tweet ID from URL (simplified)
      const currentUrl = page.url();
      const tweetIdMatch = currentUrl.match(/status\/(\d+)/);
      const tweetId = tweetIdMatch ? tweetIdMatch[1] : `browser_${Date.now()}`;

      console.log('✅ Posted via browser, tweet ID:', tweetId);
      return tweetId;

    } finally {
      await browser.close();
    }
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
}