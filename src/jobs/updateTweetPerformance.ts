import { chromium, Browser, Page } from 'playwright';
import { supabaseClient } from '../utils/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

// Performance update result interface
export interface PerformanceUpdateResult {
  success: boolean;
  tweetsProcessed: number;
  tweetsUpdated: number;
  errors: string[];
  summary: string;
  duration: number;
}

// Tweet performance data interface
export interface TweetPerformanceData {
  tweetId: string;
  url: string;
  currentMetrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  lastUpdated: string;
  success: boolean;
  error?: string;
}

// Performance log entry for Supabase
export interface PerformanceLogEntry {
  t: number; // timestamp
  likes: number;
  retweets: number;
  replies?: number;
}

export class TweetPerformanceTracker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY_MIN = 1000; // 1 second minimum
  private readonly REQUEST_DELAY_MAX = 3000; // 3 seconds maximum
  private readonly MAX_TWEETS_PER_JOB = 20;
  private readonly HOUR_UPDATE_THRESHOLD = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.ensureSessionExists();
  }

  private ensureSessionExists(): void {
    if (!fs.existsSync(this.sessionPath)) {
      console.warn('⚠️ No Twitter session found at twitter-auth.json');
      console.log('💡 Run the scraper first to establish a session');
    }
  }

  /**
   * 🚀 Initialize stealth browser for performance tracking
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🕵️ Initializing stealth performance tracker...');
      
             // Launch browser with enhanced stealth settings
       this.browser = await chromium.launch({
         headless: true,
         args: [
           '--no-sandbox',
           '--disable-setuid-sandbox',
           '--disable-dev-shm-usage',
           '--disable-accelerated-2d-canvas',
           '--no-first-run',
           '--no-zygote',
           '--disable-gpu',
           '--disable-web-security',
           '--disable-features=VizDisplayCompositor',
           '--disable-background-timer-throttling',
           '--disable-backgrounding-occluded-windows',
           '--disable-renderer-backgrounding',
           '--disable-blink-features=AutomationControlled'
         ]
       });

      // Create page with realistic settings
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Enhanced stealth measures
      await this.page.addInitScript(() => {
        // Override webdriver detection
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Override automation indicators
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });

        // Mock realistic screen properties
        Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        
        // Remove automation-related properties
        delete window.chrome?.runtime?.onConnect;
        delete window.chrome?.runtime?.onMessage;
      });

      // Load Twitter session if available
      await this.loadTwitterSession();
      
      console.log('✅ Stealth performance tracker initialized');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize performance tracker:', error);
      return false;
    }
  }

  /**
   * 💾 Load Twitter session from saved cookies
   */
  private async loadTwitterSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        
        if (this.page && sessionData.cookies) {
          await this.page.context().addCookies(sessionData.cookies);
          console.log('✅ Twitter session loaded for performance tracking');
        }
      } else {
        console.log('⚠️ No Twitter session found - some metrics may be limited');
      }
    } catch (error) {
      console.warn('⚠️ Could not load Twitter session:', error);
    }
  }

  /**
   * ⏱️ Apply random delay for stealth
   */
  private async applyStealthDelay(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    const minDelay = Math.max(this.REQUEST_DELAY_MIN, this.REQUEST_DELAY_MIN - timeSinceLastRequest);
    const randomDelay = Math.floor(Math.random() * (this.REQUEST_DELAY_MAX - this.REQUEST_DELAY_MIN)) + minDelay;
    
    console.log(`⏱️ Stealth delay: ${randomDelay}ms`);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    this.lastRequestTime = Date.now();
  }

  /**
   * 📊 Get tweets that need performance updates
   */
  private async getTweetsToUpdate(): Promise<any[]> {
    try {
      const now = Date.now();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Query tweets that need updates
      const { data: tweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        ?.select('id, tweet_id, content, created_at, performance_log, last_performance_update')
        ?.eq('success', true)
        ?.gte('created_at', thirtyDaysAgo)
        ?.order('created_at', { ascending: false })
        ?.limit(50); // Get more than needed, we'll filter

      if (error) {
        console.error('❌ Database error fetching tweets:', error);
        return [];
      }

      if (!tweets || tweets.length === 0) {
        console.log('📊 No tweets found for performance tracking');
        return [];
      }

      // Filter tweets based on update frequency
      const tweetsToUpdate = tweets.filter(tweet => {
        const tweetAge = now - new Date(tweet.created_at).getTime();
        const lastUpdate = tweet.last_performance_update ? new Date(tweet.last_performance_update).getTime() : 0;
        const timeSinceUpdate = now - lastUpdate;

        // Recent tweets (< 24h): update hourly if not updated in past hour
        if (tweetAge < 24 * 60 * 60 * 1000) {
          return timeSinceUpdate > this.HOUR_UPDATE_THRESHOLD;
        }

        // Older tweets (1-30 days): update daily if not updated in past day
        return timeSinceUpdate > 24 * 60 * 60 * 1000;
      });

      // Randomize and limit to max per job
      const shuffled = tweetsToUpdate.sort(() => Math.random() - 0.5);
      const limited = shuffled.slice(0, this.MAX_TWEETS_PER_JOB);

      console.log(`📊 Found ${tweets.length} total tweets, ${tweetsToUpdate.length} need updates, processing ${limited.length}`);
      return limited;

    } catch (error) {
      console.error('❌ Error fetching tweets to update:', error);
      return [];
    }
  }

  /**
   * 🔍 Scrape performance metrics from a tweet URL
   */
  private async scrapeTweetMetrics(tweetId: string, username: string = 'SignalAndSynapse'): Promise<TweetPerformanceData> {
    const tweetUrl = `https://twitter.com/${username}/status/${tweetId}`;
    
    try {
      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      console.log(`🔍 Scraping metrics for tweet: ${tweetId}`);
      
      // Navigate to tweet
      await this.page.goto(tweetUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait for tweet content to load
      await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });

      // Extract metrics using page evaluation
      const metrics = await this.page.evaluate(() => {
        try {
          const tweetElement = document.querySelector('[data-testid="tweet"]');
          if (!tweetElement) return null;

          // Find engagement buttons
          const likeButton = tweetElement.querySelector('[data-testid="like"]');
          const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
          const replyButton = tweetElement.querySelector('[data-testid="reply"]');

          // Extract numbers from aria-labels or text content
          const extractNumber = (element: Element | null): number => {
            if (!element) return 0;
            
            const ariaLabel = element.getAttribute('aria-label') || '';
            const textContent = element.textContent || '';
            
            // Try to extract number from aria-label first
            const ariaMatch = ariaLabel.match(/(\d+(?:,\d+)*)/);
            if (ariaMatch) {
              return parseInt(ariaMatch[1].replace(/,/g, ''));
            }
            
            // Fallback to text content
            const textMatch = textContent.match(/(\d+(?:,\d+)*)/);
            if (textMatch) {
              return parseInt(textMatch[1].replace(/,/g, ''));
            }
            
            return 0;
          };

          const likes = extractNumber(likeButton);
          const retweets = extractNumber(retweetButton);
          const replies = extractNumber(replyButton);

          return { likes, retweets, replies };
        } catch (error) {
          console.error('Error extracting metrics:', error);
          return null;
        }
      });

      if (!metrics) {
        throw new Error('Could not extract metrics from tweet page');
      }

      console.log(`✅ Scraped metrics - Likes: ${metrics.likes}, Retweets: ${metrics.retweets}, Replies: ${metrics.replies}`);

      return {
        tweetId,
        url: tweetUrl,
        currentMetrics: metrics,
        lastUpdated: new Date().toISOString(),
        success: true
      };

    } catch (error) {
      console.error(`❌ Failed to scrape tweet ${tweetId}:`, error);
      return {
        tweetId,
        url: tweetUrl,
        currentMetrics: { likes: 0, retweets: 0, replies: 0 },
        lastUpdated: new Date().toISOString(),
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 💾 Update tweet performance in Supabase
   */
  private async updateTweetPerformance(tweet: any, performanceData: TweetPerformanceData): Promise<boolean> {
    try {
      // Prepare performance log entry
      const newLogEntry: PerformanceLogEntry = {
        t: Date.now(),
        likes: performanceData.currentMetrics.likes,
        retweets: performanceData.currentMetrics.retweets,
        replies: performanceData.currentMetrics.replies
      };

      // Get existing performance log or initialize empty array
      let performanceLog: PerformanceLogEntry[] = [];
      if (tweet.performance_log && Array.isArray(tweet.performance_log)) {
        performanceLog = tweet.performance_log;
      }

      // Add new entry
      performanceLog.push(newLogEntry);

      // Keep only last 30 entries to prevent data bloat
      if (performanceLog.length > 30) {
        performanceLog = performanceLog.slice(-30);
      }

      // Update the database
      const { error } = await supabaseClient.supabase
        ?.from('tweets')
        ?.update({
          likes: performanceData.currentMetrics.likes,
          retweets: performanceData.currentMetrics.retweets,
          replies: performanceData.currentMetrics.replies,
          performance_log: performanceLog,
          last_performance_update: new Date().toISOString()
        })
        ?.eq('id', tweet.id);

      if (error) {
        console.error(`❌ Database update failed for tweet ${tweet.tweet_id}:`, error);
        return false;
      }

      console.log(`✅ Updated performance for tweet ${tweet.tweet_id}`);
      return true;

    } catch (error) {
      console.error(`❌ Error updating tweet performance:`, error);
      return false;
    }
  }

  /**
   * 🤖 MAIN PERFORMANCE UPDATE ORCHESTRATOR
   */
  async runPerformanceUpdate(): Promise<PerformanceUpdateResult> {
    console.log('🤖 === TWEET PERFORMANCE TRACKING STARTING ===');
    const startTime = Date.now();
    const errors: string[] = [];
    let tweetsProcessed = 0;
    let tweetsUpdated = 0;

    try {
      // Initialize browser
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          tweetsProcessed: 0,
          tweetsUpdated: 0,
          errors: ['Failed to initialize stealth browser'],
          summary: 'Performance tracking failed - browser initialization error',
          duration: Date.now() - startTime
        };
      }

      // Get tweets to update
      const tweetsToUpdate = await this.getTweetsToUpdate();
      if (tweetsToUpdate.length === 0) {
        await this.close();
        return {
          success: true,
          tweetsProcessed: 0,
          tweetsUpdated: 0,
          errors: [],
          summary: 'No tweets require performance updates at this time',
          duration: Date.now() - startTime
        };
      }

      // Process each tweet
      for (const tweet of tweetsToUpdate) {
        try {
          tweetsProcessed++;
          
          // Apply stealth delay
          await this.applyStealthDelay();

          // Scrape performance metrics
          const performanceData = await this.scrapeTweetMetrics(tweet.tweet_id);

          if (performanceData.success) {
            // Update database
            const updateSuccess = await this.updateTweetPerformance(tweet, performanceData);
            if (updateSuccess) {
              tweetsUpdated++;
            } else {
              errors.push(`Database update failed for tweet ${tweet.tweet_id}`);
            }
          } else {
            errors.push(`Scraping failed for tweet ${tweet.tweet_id}: ${performanceData.error}`);
          }

        } catch (error) {
          errors.push(`Error processing tweet ${tweet.tweet_id}: ${error.message}`);
          console.error(`❌ Error processing tweet ${tweet.tweet_id}:`, error);
        }
      }

      // Close browser
      await this.close();

      // Generate summary
      const duration = Date.now() - startTime;
      const successRate = tweetsProcessed > 0 ? Math.round((tweetsUpdated / tweetsProcessed) * 100) : 0;
      const summary = `📊 Performance tracking complete: ${tweetsUpdated}/${tweetsProcessed} tweets updated (${successRate}% success) in ${Math.round(duration / 1000)}s`;

      console.log(summary);

      return {
        success: tweetsUpdated > 0 || tweetsProcessed === 0,
        tweetsProcessed,
        tweetsUpdated,
        errors,
        summary,
        duration
      };

    } catch (error) {
      console.error('❌ Performance tracking system error:', error);
      errors.push(`System error: ${error.message}`);
      
      // Ensure browser is closed
      await this.close();

      return {
        success: false,
        tweetsProcessed,
        tweetsUpdated,
        errors,
        summary: `❌ Performance tracking failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 🔒 Close browser and cleanup
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      console.log('✅ Performance tracker browser closed');
    } catch (error) {
      console.warn('⚠️ Error closing performance tracker browser:', error);
    }
  }

  /**
   * 📊 Get tracking statistics
   */
  getTrackingStats(): any {
    return {
      maxTweetsPerJob: this.MAX_TWEETS_PER_JOB,
      delayRange: `${this.REQUEST_DELAY_MIN}-${this.REQUEST_DELAY_MAX}ms`,
      updateThreshold: `${this.HOUR_UPDATE_THRESHOLD / 1000 / 60}min for recent tweets`,
      sessionAvailable: fs.existsSync(this.sessionPath)
    };
  }
}

// Export singleton instance
export const tweetPerformanceTracker = new TweetPerformanceTracker(); 