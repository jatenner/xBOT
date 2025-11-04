/**
 * TRENDING VIRAL SCRAPER
 * 
 * Scrapes ANY viral tweet from Twitter (not limited to health)
 * Focus: FORMAT patterns, not content
 * 
 * Why universal?
 * - Question hooks work everywhere
 * - Line breaks = mobile-friendly (any topic)
 * - Bullets = scannable (any content)
 * - Clean formatting = professional (universal)
 * 
 * We learn STRUCTURE from all of Twitter, apply to health content
 */

import { log } from '../lib/logger';
import { chromium, Browser, Page } from 'playwright';
import { getFormatAnalyzer } from '../analysis/viralFormatAnalyzer';
import { getSupabaseClient } from '../db';

interface ViralTweet {
  tweet_id: string;
  text: string;
  author_handle: string;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  engagement_rate: number;
}

export class TrendingViralScraper {
  private static instance: TrendingViralScraper;
  
  public static getInstance(): TrendingViralScraper {
    if (!this.instance) {
      this.instance = new TrendingViralScraper();
    }
    return this.instance;
  }
  
  /**
   * Main scraping function - finds viral tweets from Twitter trending
   */
  async scrapeViralTweets(options: {
    minViews?: number;
    maxTweets?: number;
    minEngagementRate?: number;
  } = {}): Promise<ViralTweet[]> {
    const {
      minViews = 50000,
      maxTweets = 100,
      minEngagementRate = 0.02 // 2%
    } = options;
    
    log({ op: 'viral_scraper_start', target_tweets: maxTweets, min_views: minViews, min_er: minEngagementRate });
    
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1024 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });
      
      const page = await context.newPage();
      
      // STRATEGY 1: Trending Page
      console.log('🌐 Scraping Twitter trending page...');
      const trendingTweets = await this.scrapeTrendingPage(page, { minViews, maxTweets: maxTweets / 2 });
      
      // STRATEGY 2: For You / Following (if logged in)
      console.log('\n📱 Scraping For You timeline...');
      const timelineTweets = await this.scrapeTimeline(page, { minViews, maxTweets: maxTweets / 2 });
      
      const allTweets = [...trendingTweets, ...timelineTweets];
      
      // Filter by engagement rate
      const highQuality = allTweets.filter(t => t.engagement_rate >= minEngagementRate);
      
      console.log('\n📊 SCRAPING COMPLETE');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Total scraped: ${allTweets.length}`);
      console.log(`High quality (${(minEngagementRate * 100)}%+ engagement): ${highQuality.length}`);
      console.log(`Avg views: ${this.avgViews(highQuality).toLocaleString()}`);
      
      return highQuality;
      
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Scrape Twitter trending page
   */
  private async scrapeTrendingPage(page: Page, options: {
    minViews: number;
    maxTweets: number;
  }): Promise<ViralTweet[]> {
    
    const tweets: ViralTweet[] = [];
    
    try {
      // Navigate to explore page
      await page.goto('https://twitter.com/explore', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      console.log('  → Loaded explore page');
      
      // Wait for tweets to load
      await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
      
      // Scroll to load more tweets
      let lastCount = 0;
      let scrollAttempts = 0;
      
      while (tweets.length < options.maxTweets && scrollAttempts < 10) {
        // Get current tweets
        const currentTweets = await this.extractTweetsFromPage(page, options.minViews);
        
        // Add new ones
        for (const tweet of currentTweets) {
          if (!tweets.find(t => t.tweet_id === tweet.tweet_id)) {
            tweets.push(tweet);
          }
        }
        
        console.log(`  → Found ${tweets.length} viral tweets so far...`);
        
        // If no new tweets, scroll more
        if (tweets.length === lastCount) {
          scrollAttempts++;
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
          await page.waitForTimeout(2000);
        } else {
          scrollAttempts = 0;
        }
        
        lastCount = tweets.length;
        
        if (tweets.length >= options.maxTweets) break;
      }
      
      console.log(`  ✅ Scraped ${tweets.length} tweets from trending`);
      
    } catch (error: any) {
      console.error(`  ❌ Trending scrape failed: ${error.message}`);
    }
    
    return tweets.slice(0, options.maxTweets);
  }
  
  /**
   * Scrape home timeline (For You / Following)
   */
  private async scrapeTimeline(page: Page, options: {
    minViews: number;
    maxTweets: number;
  }): Promise<ViralTweet[]> {
    
    const tweets: ViralTweet[] = [];
    
    try {
      // Navigate to home
      await page.goto('https://twitter.com/home', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      console.log('  → Loaded home timeline');
      
      // Wait for tweets
      await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
      
      // Scroll and collect
      let scrollAttempts = 0;
      
      while (tweets.length < options.maxTweets && scrollAttempts < 10) {
        const currentTweets = await this.extractTweetsFromPage(page, options.minViews);
        
        for (const tweet of currentTweets) {
          if (!tweets.find(t => t.tweet_id === tweet.tweet_id)) {
            tweets.push(tweet);
          }
        }
        
        console.log(`  → Found ${tweets.length} viral tweets...`);
        
        // Scroll for more
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(2000);
        scrollAttempts++;
      }
      
      console.log(`  ✅ Scraped ${tweets.length} tweets from timeline`);
      
    } catch (error: any) {
      console.error(`  ⚠️ Timeline scrape skipped: ${error.message}`);
    }
    
    return tweets.slice(0, options.maxTweets);
  }
  
  /**
   * Extract tweets from current page
   */
  private async extractTweetsFromPage(page: Page, minViews: number): Promise<ViralTweet[]> {
    
    return await page.evaluate((minViews) => {
      const tweets: any[] = [];
      const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
      
      tweetElements.forEach(element => {
        try {
          // Get text
          const textElement = element.querySelector('[data-testid="tweetText"]');
          const text = textElement?.textContent || '';
          
          if (!text || text.length < 10) return; // Skip empty
          
          // Get author
          const authorElement = element.querySelector('[data-testid="User-Name"] a[role="link"]');
          const authorHref = authorElement?.getAttribute('href') || '';
          const author_handle = authorHref.replace('/', '').split('/')[0] || 'unknown';
          
          // Get tweet ID
          const linkElement = element.querySelector('a[href*="/status/"]');
          const href = linkElement?.getAttribute('href') || '';
          const tweet_id = href.match(/status\/(\d+)/)?.[1] || '';
          
          if (!tweet_id) return; // Skip if no ID
          
          // Get metrics
          const likeButton = element.querySelector('[data-testid="like"]');
          const retweetButton = element.querySelector('[data-testid="retweet"]');
          const replyButton = element.querySelector('[data-testid="reply"]');
          
          const likeText = likeButton?.getAttribute('aria-label') || '0';
          const retweetText = retweetButton?.getAttribute('aria-label') || '0';
          const replyText = replyButton?.getAttribute('aria-label') || '0';
          
          const likes = parseInt(likeText.match(/\d+/)?.[0] || '0');
          const retweets = parseInt(retweetText.match(/\d+/)?.[0] || '0');
          const replies = parseInt(replyText.match(/\d+/)?.[0] || '0');
          
          // Estimate views (Twitter doesn't always show)
          // Conservative estimate: views = likes * 50
          const views = likes * 50;
          
          // Filter by views
          if (views < minViews) return;
          
          const engagement_rate = (likes + retweets + replies) / (views || 1);
          
          tweets.push({
            tweet_id,
            text,
            author_handle,
            likes,
            retweets,
            replies,
            views,
            engagement_rate
          });
          
        } catch (e) {
          // Skip malformed tweets
        }
      });
      
      return tweets;
    }, minViews);
  }
  
  /**
   * Analyze and store viral tweets
   */
  async analyzeAndStore(tweets: ViralTweet[]): Promise<void> {
    console.log('\n🔍 ANALYZING FORMATS WITH AI...');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const formatAnalyzer = getFormatAnalyzer();
    const supabase = getSupabaseClient();
    
    // Batch analyze
    const analyses = await formatAnalyzer.batchAnalyze(tweets);
    
    console.log(`✅ Analyzed ${analyses.size} tweet formats\n`);
    
    // Store with AI insights
    let stored = 0;
    for (const [tweetId, analysis] of analyses) {
      const tweet = tweets.find(t => t.tweet_id === tweetId);
      if (!tweet) continue;
      
      await supabase.from('viral_tweet_library').upsert({
        tweet_id: tweetId,
        text: tweet.text,
        author_handle: tweet.author_handle,
        
        // Metrics
        likes: tweet.likes,
        retweets: tweet.retweets,
        replies: tweet.replies,
        views: tweet.views,
        engagement_rate: tweet.engagement_rate,
        viral_coefficient: tweet.retweets / (tweet.views || 1),
        
        // AI-analyzed patterns
        hook_type: analysis.hookType,
        formatting_patterns: analysis.visualStructure,
        emoji_count: analysis.emojiStrategy === 'none' ? 0 : 
                     analysis.emojiStrategy === 'strategic_one' ? 1 : 2,
        character_count: tweet.text.length,
        has_numbers: /\d/.test(tweet.text),
        
        // AI insights - THE KEY DATA!
        why_it_works: analysis.whyItWorks,
        pattern_strength: analysis.patternStrength,
        
        // Category (generic - not health-specific)
        topic_category: 'general',
        content_type: 'general',
        structure: 'single',
        is_active: true,
        scraped_at: new Date().toISOString()
      }, { onConflict: 'tweet_id' });
      
      stored++;
    }
    
    console.log(`💾 Stored ${stored} analyzed formats in database\n`);
  }
  
  /**
   * Helper: Calculate average views
   */
  private avgViews(tweets: ViralTweet[]): number {
    if (tweets.length === 0) return 0;
    return Math.round(tweets.reduce((sum, t) => sum + t.views, 0) / tweets.length);
  }
  
  /**
   * Complete workflow: Scrape → Analyze → Store
   */
  async run(options?: {
    minViews?: number;
    maxTweets?: number;
  }): Promise<void> {
    console.log('🚀 STARTING UNIVERSAL VIRAL SCRAPER\n');
    
    // Scrape viral tweets (any topic)
    const tweets = await this.scrapeViralTweets(options);
    
    if (tweets.length === 0) {
      console.log('⚠️ No viral tweets found');
      return;
    }
    
    // Analyze and store
    await this.analyzeAndStore(tweets);
    
    console.log('🎉 COMPLETE!\n');
    console.log('Your AI formatter now has fresh examples from:');
    console.log('  • Tech tweets');
    console.log('  • Sports tweets');
    console.log('  • News tweets');
    console.log('  • Entertainment tweets');
    console.log('  • AND health tweets');
    console.log('\nLearning UNIVERSAL formatting patterns! 🚀');
  }
}

/**
 * Helper: Get singleton instance
 */
export const getTrendingScraper = () => TrendingViralScraper.getInstance();

