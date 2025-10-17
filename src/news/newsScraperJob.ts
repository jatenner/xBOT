/**
 * 🗞️ TWITTER NEWS SCRAPER
 * 
 * Scrapes real health news from:
 * - Major news outlets (CNN, Fox, NYT, etc.)
 * - Health-specific accounts (WebMD, Health.com, etc.)
 * - Viral health tweets (trending topics)
 * - Top health influencers
 * 
 * Stores timestamped news for timely content generation
 */

import { Page } from 'playwright';
import { getSupabaseClient } from '../db';

export interface ScrapedNews {
  tweet_id: string;
  tweet_text: string;
  tweet_url: string;
  author_username: string;
  author_display_name: string;
  author_followers: number;
  author_verified: boolean;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  posted_at: string;
  scraped_at: string;
  topic_detected?: string;
  study_urls: string[];
  source_type: 'news_outlet' | 'health_account' | 'influencer' | 'viral_trend';
  viral_score: number;
  freshness_score: number;
}

export class TwitterNewsScraperJob {
  private static instance: TwitterNewsScraperJob;
  
  // NEWS OUTLETS - Real news sources
  private readonly NEWS_ACCOUNTS = [
    'CNN', 'FoxNews', 'nytimes', 'MSNBC', 'CBSNews', 'ABCNews',
    'NBCNews', 'Reuters', 'AP', 'BBCNews', 'guardian',
    'WSJ', 'washingtonpost', 'NPR', 'USATODAY', 'axios'
  ];
  
  // HEALTH NEWS ACCOUNTS - Dedicated health reporting
  private readonly HEALTH_NEWS_ACCOUNTS = [
    'WebMD', 'MayoClinic', 'CDCgov', 'WHO', 'NIH', 
    'HarvardHealth', 'ClevelandClinic', 'KaiserHealth',
    'statnews', 'medscape', 'HealthDay', 'MedPageToday',
    'ScienceDaily', 'nature', 'ScienceMagazine'
  ];
  
  // HEALTH INFLUENCERS - Top health content creators
  private readonly HEALTH_INFLUENCERS = [
    'hubermanlab', 'peterattiamd', 'foundmyfitness', 'DrRhaganSekelsky',
    'drlaurendeverett', 'DrKellyann', 'DrMarkHyman', 'bengreenfield',
    'RobertLustigMD', 'GundryMD', 'DrWillCole', 'mindbodygreen',
    'nutritionsource', 'nutritionstripped', 'precisionnutri'
  ];
  
  // TRENDING SEARCH QUERIES
  private readonly HEALTH_SEARCH_QUERIES = [
    'new study health',
    'research shows health',
    'scientists found',
    'breakthrough health',
    'health news',
    'medical study',
    'clinical trial results'
  ];
  
  private constructor() {}
  
  static getInstance(): TwitterNewsScraperJob {
    if (!TwitterNewsScraperJob.instance) {
      TwitterNewsScraperJob.instance = new TwitterNewsScraperJob();
    }
    return TwitterNewsScraperJob.instance;
  }

  /**
   * MAIN SCRAPING JOB - Runs every hour
   */
  async runScrapingJob(): Promise<void> {
    console.log('[NEWS_SCRAPER] 🗞️ Starting Twitter news scraping job...');
    
    try {
      const browserManager = (await import('../lib/browser')).default;
      const page = await browserManager.newPage();
      
      // Scrape from all sources
      const allNews: ScrapedNews[] = [];
      
      // 1. Scrape major news outlets
      console.log('[NEWS_SCRAPER] 📰 Scraping major news outlets...');
      const newsOutletTweets = await this.scrapeAccounts(page, this.NEWS_ACCOUNTS, 'news_outlet');
      allNews.push(...newsOutletTweets);
      
      // 2. Scrape health-specific news
      console.log('[NEWS_SCRAPER] 🏥 Scraping health news accounts...');
      const healthNewsTweets = await this.scrapeAccounts(page, this.HEALTH_NEWS_ACCOUNTS, 'health_account');
      allNews.push(...healthNewsTweets);
      
      // 3. Scrape health influencers
      console.log('[NEWS_SCRAPER] 👨‍⚕️ Scraping health influencers...');
      const influencerTweets = await this.scrapeAccounts(page, this.HEALTH_INFLUENCERS, 'influencer');
      allNews.push(...influencerTweets);
      
      // 4. Scrape trending health topics
      console.log('[NEWS_SCRAPER] 🔥 Scraping trending health topics...');
      const trendingTweets = await this.scrapeTrendingTopics(page);
      allNews.push(...trendingTweets);
      
      // Close browser
      await page.close();
      
      // Store in database
      console.log(`[NEWS_SCRAPER] 💾 Storing ${allNews.length} scraped tweets...`);
      await this.storeScrapedNews(allNews);
      
      // Run AI analysis
      console.log('[NEWS_SCRAPER] 🤖 Running AI analysis on scraped news...');
      await this.runAIAnalysis();
      
      // Update trending topics
      console.log('[NEWS_SCRAPER] 📊 Updating trending topics...');
      await this.updateTrendingTopics();
      
      console.log(`[NEWS_SCRAPER] ✅ Scraping job completed: ${allNews.length} tweets scraped`);
      
    } catch (error: any) {
      console.error('[NEWS_SCRAPER] ❌ Scraping job failed:', error.message);
      throw error;
    }
  }

  /**
   * Scrape tweets from specific accounts
   */
  private async scrapeAccounts(
    page: Page, 
    accounts: string[], 
    sourceType: ScrapedNews['source_type']
  ): Promise<ScrapedNews[]> {
    const scrapedNews: ScrapedNews[] = [];
    
    for (const account of accounts.slice(0, 10)) { // Limit to prevent rate limiting
      try {
        const tweets = await this.scrapeSingleAccount(page, account, sourceType);
        scrapedNews.push(...tweets);
        
        // Rate limiting delay
        await page.waitForTimeout(2000);
      } catch (error: any) {
        console.warn(`[NEWS_SCRAPER] ⚠️ Failed to scrape @${account}:`, error.message);
      }
    }
    
    return scrapedNews;
  }

  /**
   * Scrape a single Twitter account
   */
  private async scrapeSingleAccount(
    page: Page,
    username: string,
    sourceType: ScrapedNews['source_type']
  ): Promise<ScrapedNews[]> {
    console.log(`[NEWS_SCRAPER] 🔍 Scraping @${username}...`);
    
    try {
      // Navigate to user's profile
      await page.goto(`https://x.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await page.waitForTimeout(3000);
      
      // Get recent tweets (last 24 hours only)
      const tweets = await this.extractTweetsFromPage(page, sourceType, username);
      
      console.log(`[NEWS_SCRAPER] ✅ Scraped ${tweets.length} tweets from @${username}`);
      
      return tweets;
      
    } catch (error: any) {
      console.error(`[NEWS_SCRAPER] ❌ Failed to scrape @${username}:`, error.message);
      return [];
    }
  }

  /**
   * Extract tweets from current page
   */
  private async extractTweetsFromPage(
    page: Page,
    sourceType: ScrapedNews['source_type'],
    username: string
  ): Promise<ScrapedNews[]> {
    const tweets: ScrapedNews[] = [];
    
    try {
      // Wait for tweets to load
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
      
      // Extract tweet data
      const tweetElements = await page.locator('article[data-testid="tweet"]').all();
      
      // Limit to first 5 tweets per account
      for (const tweetEl of tweetElements.slice(0, 5)) {
        try {
          const tweetData = await this.extractTweetData(tweetEl, sourceType, username);
          if (tweetData && this.isRecentTweet(tweetData.posted_at)) {
            tweets.push(tweetData);
          }
        } catch (error) {
          // Skip failed individual tweets
          continue;
        }
      }
      
    } catch (error: any) {
      console.warn('[NEWS_SCRAPER] ⚠️ Failed to extract tweets from page:', error.message);
    }
    
    return tweets;
  }

  /**
   * Extract data from a single tweet element
   */
  private async extractTweetData(
    tweetElement: any,
    sourceType: ScrapedNews['source_type'],
    username: string
  ): Promise<ScrapedNews | null> {
    try {
      // Extract tweet text
      const tweetText = await tweetElement.locator('[data-testid="tweetText"]').innerText().catch(() => '');
      
      if (!tweetText || tweetText.length < 10) return null;
      
      // Extract engagement metrics
      const likesText = await tweetElement.locator('[data-testid="like"]').innerText().catch(() => '0');
      const retweetsText = await tweetElement.locator('[data-testid="retweet"]').innerText().catch(() => '0');
      const repliesText = await tweetElement.locator('[data-testid="reply"]').innerText().catch(() => '0');
      
      const likes = this.parseEngagementCount(likesText);
      const retweets = this.parseEngagementCount(retweetsText);
      const replies = this.parseEngagementCount(repliesText);
      
      // Extract tweet URL (to get tweet ID)
      const tweetLink = await tweetElement.locator('a[href*="/status/"]').first().getAttribute('href').catch(() => '');
      const tweetId = tweetLink.match(/status\/(\d+)/)?.[1] || `scraped_${Date.now()}`;
      
      // Extract timestamp
      const timeElement = await tweetElement.locator('time').first();
      const datetime = await timeElement.getAttribute('datetime').catch(() => new Date().toISOString());
      
      // Extract study URLs if present
      const studyUrls = await this.extractStudyUrls(tweetText);
      
      // Calculate scores
      const viralScore = this.calculateViralScore(likes, retweets, replies);
      const freshnessScore = this.calculateFreshnessScore(datetime);
      
      const scrapedNews: ScrapedNews = {
        tweet_id: tweetId,
        tweet_text: tweetText,
        tweet_url: `https://x.com/${username}/status/${tweetId}`,
        author_username: username,
        author_display_name: username,
        author_followers: 0, // Will be updated by AI analysis
        author_verified: false,
        likes_count: likes,
        retweets_count: retweets,
        replies_count: replies,
        posted_at: datetime,
        scraped_at: new Date().toISOString(),
        study_urls: studyUrls,
        source_type: sourceType,
        viral_score: viralScore,
        freshness_score: freshnessScore
      };
      
      return scrapedNews;
      
    } catch (error: any) {
      console.warn('[NEWS_SCRAPER] ⚠️ Failed to extract tweet data:', error.message);
      return null;
    }
  }

  /**
   * Scrape trending health topics via search
   */
  private async scrapeTrendingTopics(page: Page): Promise<ScrapedNews[]> {
    const trendingTweets: ScrapedNews[] = [];
    
    for (const query of this.HEALTH_SEARCH_QUERIES.slice(0, 3)) {
      try {
        console.log(`[NEWS_SCRAPER] 🔍 Searching for: "${query}"`);
        
        // Navigate to search
        const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=top`;
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await page.waitForTimeout(3000);
        
        // Extract tweets
        const tweets = await this.extractTweetsFromPage(page, 'viral_trend', 'search');
        trendingTweets.push(...tweets);
        
        // Rate limiting
        await page.waitForTimeout(3000);
        
      } catch (error: any) {
        console.warn(`[NEWS_SCRAPER] ⚠️ Failed to search "${query}":`, error.message);
      }
    }
    
    return trendingTweets;
  }

  /**
   * Parse engagement count (handles K, M notation)
   */
  private parseEngagementCount(text: string): number {
    const match = text.match(/([0-9.]+)([KM])?/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const multiplier = match[2];
    
    if (multiplier === 'K') return Math.round(num * 1000);
    if (multiplier === 'M') return Math.round(num * 1000000);
    return Math.round(num);
  }

  /**
   * Extract study URLs from tweet text
   */
  private extractStudyUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    
    // Filter for likely study URLs
    return urls.filter(url => 
      url.includes('nature.com') ||
      url.includes('science.org') ||
      url.includes('nih.gov') ||
      url.includes('pubmed') ||
      url.includes('sciencedirect') ||
      url.includes('doi.org')
    );
  }

  /**
   * Calculate viral score
   */
  private calculateViralScore(likes: number, retweets: number, replies: number): number {
    // Weighted: retweets count 2x, replies 1.5x
    return Math.round(likes + (retweets * 2) + (replies * 1.5));
  }

  /**
   * Calculate freshness score (0-100)
   */
  private calculateFreshnessScore(postedAt: string): number {
    const now = Date.now();
    const posted = new Date(postedAt).getTime();
    const hoursOld = (now - posted) / (1000 * 60 * 60);
    
    // Score decreases with age
    if (hoursOld < 6) return 100;
    if (hoursOld < 12) return 90;
    if (hoursOld < 24) return 80;
    if (hoursOld < 48) return 60;
    if (hoursOld < 72) return 40;
    return 20;
  }

  /**
   * Check if tweet is recent (last 48 hours)
   */
  private isRecentTweet(postedAt: string): boolean {
    const now = Date.now();
    const posted = new Date(postedAt).getTime();
    const hoursOld = (now - posted) / (1000 * 60 * 60);
    return hoursOld <= 48;
  }

  /**
   * Store scraped news in database
   */
  private async storeScrapedNews(news: ScrapedNews[]): Promise<void> {
    if (news.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    for (const item of news) {
      await supabase
        .from('health_news_scraped')
        .upsert({
          tweet_id: item.tweet_id,
          tweet_text: item.tweet_text,
          tweet_url: item.tweet_url,
          author_username: item.author_username,
          author_display_name: item.author_display_name,
          author_followers: item.author_followers,
          author_verified: item.author_verified,
          likes_count: item.likes_count,
          retweets_count: item.retweets_count,
          replies_count: item.replies_count,
          posted_at: item.posted_at,
          scraped_at: item.scraped_at,
          study_urls: item.study_urls,
          source_type: item.source_type,
          viral_score: item.viral_score,
          freshness_score: item.freshness_score
        }, {
          onConflict: 'tweet_id'
        });
    }
    
    console.log(`[NEWS_SCRAPER] 💾 Stored ${news.length} tweets in database`);
  }

  /**
   * Run AI analysis on scraped news
   */
  private async runAIAnalysis(): Promise<void> {
    // This will be called to extract topics, categorize, etc.
    const { NewsCuratorService } = await import('./newsCuratorService');
    const curator = NewsCuratorService.getInstance();
    await curator.analyzeAndCurateNews();
  }

  /**
   * Update trending topics table
   */
  private async updateTrendingTopics(): Promise<void> {
    const { TrendingTopicsService } = await import('./trendingTopicsService');
    const trendingService = TrendingTopicsService.getInstance();
    await trendingService.updateTrendingTopics();
  }
}

export const twitterNewsScraperJob = TwitterNewsScraperJob.getInstance();

