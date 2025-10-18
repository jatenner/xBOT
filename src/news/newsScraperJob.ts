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
  
  // 🚫 NO MORE HARDCODED ACCOUNTS!
  // System discovers news sources dynamically
  
  // NEWS SEARCH QUERIES - Find breaking news organically
  // Focus: Headlines, events, announcements, launches, recalls, policies
  private readonly NEWS_SEARCH_QUERIES = [
    // Product launches & availability
    'now available',
    'launches at',
    'approved by FDA',
    
    // Official statements & claims
    'officials say',
    'secretary claims',
    'announces',
    'confirms',
    
    // Regulatory & policy
    'FDA recalls',
    'CDC warns',
    'banned',
    'approved',
    
    // Breaking events
    'breaking health',
    'just in health',
    'developing health',
    
    // Corporate/industry
    'company announces',
    'launches new',
    'recalls'
  ];
  
  // RESEARCH SEARCH QUERIES - Separate from news
  private readonly RESEARCH_SEARCH_QUERIES = [
    'new study shows',
    'research finds',
    'scientists discover',
    'clinical trial results',
    'peer reviewed study'
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
      
      // 🗞️ SCRAPE BREAKING NEWS (news outlets + verified accounts)
      console.log('[NEWS_SCRAPER] 🔥 Scraping breaking health news...');
      const breakingNews = await this.scrapeBreakingNews(page);
      allNews.push(...breakingNews);
      
      // 🔬 SCRAPE RESEARCH NEWS (separate from headlines)
      console.log('[NEWS_SCRAPER] 🧪 Scraping research announcements...');
      const researchNews = await this.scrapeResearchNews(page);
      allNews.push(...researchNews);
      
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
   * Scrape BREAKING NEWS (headlines, announcements, reports)
   */
  private async scrapeBreakingNews(page: Page): Promise<ScrapedNews[]> {
    const breakingNews: ScrapedNews[] = [];
    
    for (const query of this.NEWS_SEARCH_QUERIES.slice(0, 5)) {
      try {
        console.log(`[NEWS_SCRAPER] 🔍 Searching news: "${query}"`);
        
        // Search with "Latest" filter for most recent
        const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await page.waitForTimeout(3000);
        
        // Extract tweets - filter for verified accounts or high engagement
        const tweets = await this.extractTweetsFromPage(page, 'news_outlet', 'search');
        
        // Filter for actual NEWS EVENTS (not research)
        const newsPatterns = [
          // Headlines & breaking events
          'breaking', 'just in', 'developing',
          
          // Product/availability 
          'now available', 'launches', 'launching', 'released',
          
          // Regulatory
          'fda', 'cdc', 'approved', 'banned', 'recall',
          
          // Official statements
          'officials', 'secretary', 'announces', 'claims',
          'warns', 'confirms', 'reports',
        ];
        
        // EXCLUDE research patterns from news
        const researchExcludePatterns = [
          'study shows', 'research finds', 'scientists', 
          'clinical trial', 'peer reviewed', 'published in'
        ];
        
        // Only include if it's NEWS and NOT research
        const filteredNews = tweets.filter(tweet => {
          const text = tweet.tweet_text.toLowerCase();
          
          const hasNewsPattern = newsPatterns.some(p => text.includes(p));
          const hasResearchPattern = researchExcludePatterns.some(p => text.includes(p));
          
          return hasNewsPattern && !hasResearchPattern;
        });
        
        breakingNews.push(...filteredNews);
        
        // Rate limiting
        await page.waitForTimeout(3000);
        
      } catch (error: any) {
        console.warn(`[NEWS_SCRAPER] ⚠️ Failed to search "${query}":`, error.message);
      }
    }
    
    console.log(`[NEWS_SCRAPER] ✅ Found ${breakingNews.length} breaking news items`);
    return breakingNews;
  }

  /**
   * Scrape RESEARCH NEWS (studies, findings, clinical trials)
   * Separate from breaking news headlines
   */
  private async scrapeResearchNews(page: Page): Promise<ScrapedNews[]> {
    const researchNews: ScrapedNews[] = [];
    
    for (const query of this.RESEARCH_SEARCH_QUERIES.slice(0, 3)) {
      try {
        console.log(`[NEWS_SCRAPER] 🔍 Searching research: "${query}"`);
        
        const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&f=top`;
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        await page.waitForTimeout(3000);
        
        // Extract tweets - mark as viral_trend for research
        const tweets = await this.extractTweetsFromPage(page, 'viral_trend', 'search');
        
        // Filter for actual research citations
        const researchPatterns = [
          'study', 'research', 'scientist', 'trial', 
          'journal', 'published', 'university', 'findings'
        ];
        
        const filteredResearch = tweets.filter(tweet =>
          researchPatterns.some(pattern =>
            tweet.tweet_text.toLowerCase().includes(pattern)
          )
        );
        
        researchNews.push(...filteredResearch);
        
        // Rate limiting
        await page.waitForTimeout(3000);
        
      } catch (error: any) {
        console.warn(`[NEWS_SCRAPER] ⚠️ Failed to search "${query}":`, error.message);
      }
    }
    
    console.log(`[NEWS_SCRAPER] ✅ Found ${researchNews.length} research announcements`);
    return researchNews;
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
      // PHASE 4.2 FIX: Better selectors with multiple fallbacks
      // Wait for tweets to load with multiple selector attempts
      const tweetLoaded = await Promise.race([
        page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => null),
        page.waitForSelector('[data-testid="tweetDetail"]', { timeout: 15000 }).catch(() => null),
        page.waitForSelector('article[role="article"]', { timeout: 15000 }).catch(() => null),
        page.waitForTimeout(10000).then(() => null)  // Give up after 10s
      ]);
      
      if (!tweetLoaded) {
        console.warn('    ⚠️ RELOAD: Tweet element didn\'t load, continuing anyway...');
      }
      
      // Try multiple selectors for tweets
      let tweetElements = await page.locator('article[data-testid="tweet"]').all();
      if (tweetElements.length === 0) {
        tweetElements = await page.locator('article[role="article"]').all();
      }
      
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

  /* Removed hardcoded account scraping - now uses dynamic search */

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

