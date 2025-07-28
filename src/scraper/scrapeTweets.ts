import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Tweet data interface
export interface ScrapedTweet {
  tweetId: string;
  content: string;
  author: {
    username: string;
    displayName: string;
    verified: boolean;
  };
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  timestamp: string;
  url: string;
  isReply: boolean;
  parentTweetId?: string;
}

// Search result interface
export interface TweetSearchResult {
  success: boolean;
  tweets: ScrapedTweet[];
  searchQuery: string;
  totalFound: number;
  error?: string;
}

export class StealthTweetScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private isLoggedIn = false;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 2000; // 2 seconds between requests

  constructor() {
    this.ensureSessionDirectory();
  }

  private ensureSessionDirectory(): void {
    const sessionDir = path.dirname(this.sessionPath);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  /**
   * 🚀 Initialize stealth browser with session loading
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🕵️ Initializing stealth browser...');
      
      // Launch browser with stealth settings
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

      // Create page with stealth settings
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Additional stealth measures - using window reference to avoid TypeScript issues
      await this.page.addInitScript(() => {
        // Override webdriver detection
        Object.defineProperty((window as any).navigator, 'webdriver', { get: () => undefined });
        
        // Override plugins detection
        Object.defineProperty((window as any).navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Override languages
        Object.defineProperty((window as any).navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
      });

      // Load existing session if available
      await this.loadSession();
      
      console.log('✅ Stealth browser initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize stealth browser:', error);
      return false;
    }
  }

  /**
   * 💾 Load Twitter session from file
   */
  private async loadSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        
        if (this.page && sessionData.cookies) {
          await this.page.context().addCookies(sessionData.cookies);
          console.log('✅ Twitter session loaded from file');
          this.isLoggedIn = true;
        }
      } else {
        console.log('⚠️ No Twitter session found - manual login may be required');
      }
    } catch (error) {
      console.error('❌ Failed to load session:', error);
    }
  }

  /**
   * 💾 Save Twitter session to file
   */
  private async saveSession(): Promise<void> {
    try {
      if (!this.page) return;
      
      const cookies = await this.page.context().cookies();
      const sessionData = {
        cookies,
        timestamp: Date.now(),
        userAgent: await this.page.evaluate(() => (window as any).navigator.userAgent)
      };
      
      fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData, null, 2));
      console.log('✅ Twitter session saved');
    } catch (error) {
      console.error('❌ Failed to save session:', error);
    }
  }

  /**
   * ⏱️ Rate limiting delay
   */
  private async respectRateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const delay = this.REQUEST_DELAY - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * 🔍 Search for tweets by query
   */
  async searchTweets(query: string, maxResults: number = 10): Promise<TweetSearchResult> {
    if (!this.page) {
      return {
        success: false,
        tweets: [],
        searchQuery: query,
        totalFound: 0,
        error: 'Browser not initialized'
      };
    }

    try {
      await this.respectRateLimit();
      
      console.log(`🔍 Searching for tweets: "${query}"`);
      
      // Navigate to Twitter search
      const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
      await this.page.goto(searchUrl, { waitUntil: 'networkidle' });
      
      // Wait for tweets to load
      await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
      
      // Extract tweet data
      const tweets = await this.page.evaluate((maxResults: number) => {
        const tweetElements = (document as any).querySelectorAll('[data-testid="tweet"]');
        const extractedTweets: any[] = [];
        
        for (let i = 0; i < Math.min(tweetElements.length, maxResults); i++) {
          const tweetElement = tweetElements[i];
          
          try {
            // Extract tweet ID from URL
            const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
            const tweetUrl = tweetLink?.getAttribute('href') || '';
            const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0] || '';
            
            // Extract content
            const contentElement = tweetElement.querySelector('[data-testid="tweetText"]');
            const content = contentElement?.textContent || '';
            
            // Extract author info
            const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
            const authorLinks = authorElement?.querySelectorAll('a');
            const displayName = authorLinks?.[0]?.textContent || '';
            const username = authorLinks?.[1]?.textContent?.replace('@', '') || '';
            
            // Check if verified
            const verifiedIcon = tweetElement.querySelector('[data-testid="icon-verified"]');
            const verified = !!verifiedIcon;
            
            // Extract engagement metrics
            const likeButton = tweetElement.querySelector('[data-testid="like"]');
            const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
            const replyButton = tweetElement.querySelector('[data-testid="reply"]');
            
            const likes = parseInt(likeButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
            const retweets = parseInt(retweetButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
            const replies = parseInt(replyButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
            
            // Extract timestamp
            const timeElement = tweetElement.querySelector('time');
            const timestamp = timeElement?.getAttribute('datetime') || new Date().toISOString();
            
            // Check if this is a reply
            const isReply = tweetElement.querySelector('[data-testid="socialContext"]')?.textContent?.includes('Replying to') || false;
            
            if (tweetId && content && username) {
              extractedTweets.push({
                tweetId,
                content,
                author: {
                  username,
                  displayName,
                  verified
                },
                engagement: {
                  likes,
                  retweets,
                  replies
                },
                timestamp,
                url: `https://twitter.com${tweetUrl}`,
                isReply
              });
            }
          } catch (error) {
            console.warn('Failed to extract tweet data:', error);
          }
        }
        
        return extractedTweets;
      }, maxResults);
      
      console.log(`✅ Found ${tweets.length} tweets for query: "${query}"`);
      
      return {
        success: true,
        tweets: tweets as ScrapedTweet[],
        searchQuery: query,
        totalFound: tweets.length,
      };
      
    } catch (error) {
      console.error('❌ Failed to search tweets:', error);
      return {
        success: false,
        tweets: [],
        searchQuery: query,
        totalFound: 0,
        error: error.message
      };
    }
  }

  /**
   * 🎯 Get trending tweets from specific topic
   */
  async getTrendingTweets(topic: string = 'health ai', limit: number = 5): Promise<TweetSearchResult> {
    const trendingQuery = `${topic} -filter:replies min_faves:10`;
    return await this.searchTweets(trendingQuery, limit);
  }

  /**
   * 🔥 Get viral health tweets (high engagement)
   */
  async getViralHealthTweets(limit: number = 3): Promise<TweetSearchResult> {
    const viralQuery = 'health OR fitness OR nutrition OR wellness min_faves:50 min_retweets:10 -filter:replies';
    return await this.searchTweets(viralQuery, limit);
  }

  /**
   * 🧠 Get AI-related tweets for tech engagement
   */
  async getAITweets(limit: number = 5): Promise<TweetSearchResult> {
    const aiQuery = '(artificial intelligence OR machine learning OR AI OR GPT) -filter:replies min_faves:20';
    return await this.searchTweets(aiQuery, limit);
  }

  /**
   * 🔒 Close browser and save session
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.saveSession();
        await this.page.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      console.log('✅ Stealth browser closed and session saved');
    } catch (error) {
      console.error('❌ Error closing browser:', error);
    }
  }

  /**
   * 🔧 Check if scraper is ready
   */
  isReady(): boolean {
    return this.browser !== null && this.page !== null;
  }
}

// Export singleton instance
export const stealthTweetScraper = new StealthTweetScraper(); 