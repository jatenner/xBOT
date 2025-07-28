import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getChromiumLaunchOptions } from '../utils/playwrightUtils';

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
      
      // Get launch options with correct executable path
      const launchOptions = getChromiumLaunchOptions();
      
      // Launch browser with stealth settings and correct executable
      this.browser = await chromium.launch(launchOptions);

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
          console.log(`✅ Twitter session loaded (${sessionData.cookies.length} cookies)`);
          console.log(`🕐 Session created: ${sessionData.createdAt || 'Unknown'}`);
          this.isLoggedIn = true;
        }
      } else {
        console.log('⚠️ No Twitter session found at twitter-auth.json');
        console.log('💡 Run: npm run build && node dist/utils/initTwitterSession.js');
      }
    } catch (error) {
      console.error('❌ Failed to load session:', error);
      console.log('💡 If session is corrupted, delete twitter-auth.json and re-initialize');
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
  async searchTweets(query: string, maxResults: number = 20): Promise<TweetSearchResult> {
    if (!this.browser || !this.page) {
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
      
      // Navigate to Twitter search with longer timeout
      const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
      await this.page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 90000 // Increased from 60s to 90s
      });

      // Wait for search results with increased timeout
      try {
        await this.page.waitForSelector('article[data-testid="tweet"]', { 
          timeout: 30000 // Increased from 15s to 30s
        });
      } catch (selectorError) {
        // Fallback: wait for any article elements
        console.log('🔧 Primary selector failed, trying fallback...');
        await this.page.waitForSelector('article', { timeout: 20000 });
      }

      // Extract tweets with enhanced error handling
      const tweets = await this.page.evaluate((maxResults) => {
        try {
          const tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, maxResults);
          
          return tweetElements.map((tweet, index) => {
            try {
              // Extract basic tweet data
              const textElement = tweet.querySelector('[data-testid="tweetText"]');
              const authorElement = tweet.querySelector('[data-testid="User-Name"]');
              const linkElement = tweet.querySelector('a[href*="/status/"]');
              
              const content = textElement?.textContent?.trim() || '';
              
              // Extract author info
              const authorLinks = authorElement?.querySelectorAll('a');
              const displayName = authorLinks?.[0]?.textContent?.trim() || 'Unknown';
              const username = authorLinks?.[1]?.textContent?.replace('@', '').trim() || 'unknown';
              const verified = !!tweet.querySelector('[data-testid="icon-verified"]');
              
              // Extract tweet ID from link
              let tweetId = '';
              if (linkElement) {
                const href = linkElement.getAttribute('href') || '';
                const match = href.match(/\/status\/(\d+)/);
                if (match) tweetId = match[1];
              }

              // Extract engagement metrics
              const likeButton = tweet.querySelector('[data-testid="like"]');
              const retweetButton = tweet.querySelector('[data-testid="retweet"]');
              const replyButton = tweet.querySelector('[data-testid="reply"]');
              
              const likes = parseInt(likeButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
              const retweets = parseInt(retweetButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');
              const replies = parseInt(replyButton?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0');

              // Extract timestamp
              const timeElement = tweet.querySelector('time');
              const timestamp = timeElement?.getAttribute('datetime') || new Date().toISOString();

              // Check if this is a reply
              const isReply = !!tweet.querySelector('[data-testid="socialContext"]')?.textContent?.includes('Replying to');

              return {
                tweetId: tweetId || `fallback_${Date.now()}_${index}`,
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
                url: tweetId ? `https://twitter.com/${username}/status/${tweetId}` : '',
                isReply
              };
            } catch (elementError) {
              console.log(`⚠️ Error processing tweet element ${index}:`, elementError.message);
              return null;
            }
          }).filter(tweet => tweet && tweet.content.length > 0);
        } catch (evaluationError) {
          console.log('⚠️ Error in page evaluation:', evaluationError.message);
          return [];
        }
      }, maxResults);

      console.log(`✅ Found ${tweets.length} tweets for query: "${query}"`);
      
      return {
        success: true,
        tweets: tweets as ScrapedTweet[],
        searchQuery: query,
        totalFound: tweets.length,
      };

    } catch (error) {
      console.log('🔧 First navigation attempt failed, trying fallback...');
      
      // Enhanced fallback with screenshot
      try {
        await this.page.screenshot({ 
          path: `logs/search_error_${Date.now()}.png`,
          timeout: 45000 // Increased timeout for screenshots
        });
        
        console.log(`❌ Failed to search tweets: ${error.message}`);
        return {
          success: false,
          tweets: [],
          searchQuery: query,
          totalFound: 0,
          error: error.message
        }; // Return empty array instead of throwing
        
      } catch (screenshotError) {
        console.log(`❌ Screenshot also failed: ${screenshotError.message}`);
        throw error; // Re-throw original error
      }
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
   * 🧪 Test scraping with "ai health" search
   */
  async testAIHealthSearch(limit: number = 5): Promise<TweetSearchResult> {
    console.log('🧪 Testing AI health search...');
    const result = await this.searchTweets('ai health', limit);
    
    if (result.success && result.tweets) {
      console.log(`✅ Successfully scraped ${result.tweets.length} AI health tweets:`);
      result.tweets.forEach((tweet, index) => {
        console.log(`\n${index + 1}. @${tweet.author.username}`);
        console.log(`   ${tweet.content.substring(0, 100)}...`);
        console.log(`   💖 ${tweet.engagement.likes} | 🔁 ${tweet.engagement.retweets} | 💬 ${tweet.engagement.replies}`);
        console.log(`   🔗 ${tweet.url}`);
      });
    } else {
      console.log('❌ Failed to scrape AI health tweets:', result.error);
    }
    
    return result;
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