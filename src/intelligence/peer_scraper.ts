/**
 * Peer Account Scraper for @SignalAndSynapse
 * Scrapes high-performing health Twitter accounts for competitive intelligence
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import OpenAI from 'openai';

interface PeerAccount {
  handle: string;
  niche: string;
  follower_threshold: number; // Minimum followers to be considered
}

interface PeerTweet {
  account_handle: string;
  tweet_id: string;
  text: string;
  format: string;
  topic: string;
  hook_type: string;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  engagement_rate: number;
  normalized_engagement: number;
  account_followers: number;
  created_at: Date;
}

export class PeerScrapingSystem {
  private supabase: any;
  private redis: Redis;
  private openai: OpenAI;
  private peerAccounts: PeerAccount[];

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    
    // Define peer accounts to monitor
    this.peerAccounts = [
      { handle: 'hubermanlab', niche: 'neuroscience', follower_threshold: 1000000 },
      { handle: 'RhondaPatrick', niche: 'nutrition_science', follower_threshold: 500000 },
      { handle: 'bengreenfield', niche: 'biohacking', follower_threshold: 200000 },
      { handle: 'drmarkhyman', niche: 'functional_medicine', follower_threshold: 800000 },
      { handle: 'davidasinclair', niche: 'longevity', follower_threshold: 400000 },
      { handle: 'foundmyfitness', niche: 'health_research', follower_threshold: 300000 },
      { handle: 'LairdHamilton', niche: 'fitness', follower_threshold: 150000 },
      { handle: 'drdavinaguilera', niche: 'psychology', follower_threshold: 100000 }
    ];
  }

  /**
   * Main scraping cycle for all peer accounts
   */
  async runPeerScrapingCycle(): Promise<void> {
    console.log('🕵️ Starting peer scraping cycle...');

    const browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      for (const account of this.peerAccounts) {
        try {
          console.log(`📱 Scraping @${account.handle}...`);
          const tweets = await this.scrapePeerAccount(browser, account);
          
          if (tweets.length > 0) {
            await this.storePeerTweets(tweets);
            console.log(`✅ Stored ${tweets.length} tweets from @${account.handle}`);
          }

          // Rate limiting
          await this.delay(5000 + Math.random() * 5000);
        } catch (error) {
          console.error(`Failed to scrape @${account.handle}:`, error);
        }
      }

      // Analyze patterns from collected data
      await this.analyzePeerPatterns();
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Scrape a specific peer account
   */
  private async scrapePeerAccount(browser: Browser, account: PeerAccount): Promise<PeerTweet[]> {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();
    const tweets: PeerTweet[] = [];

    try {
      // Navigate to profile
      await page.goto(`https://x.com/${account.handle}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Get follower count
      await page.waitForSelector('[data-testid="UserName"]', { timeout: 10000 });
      const followerCount = await this.extractFollowerCount(page);

      if (followerCount < account.follower_threshold) {
        console.log(`⚠️ @${account.handle} has ${followerCount} followers, below threshold`);
        return tweets;
      }

      // Scroll to load tweets
      await this.scrollToLoadTweets(page);

      // Extract tweet data
      const tweetElements = await page.$$('[data-testid="tweet"]');
      
      for (const tweetElement of tweetElements.slice(0, 20)) { // Limit to recent 20 tweets
        try {
          const tweetData = await this.extractTweetData(tweetElement, account, followerCount);
          if (tweetData && this.isHighQualityTweet(tweetData)) {
            tweets.push(tweetData);
          }
        } catch (error) {
          console.error('Failed to extract tweet data:', error);
        }
      }

    } catch (error) {
      console.error(`Error scraping @${account.handle}:`, error);
    } finally {
      await context.close();
    }

    return tweets;
  }

  /**
   * Extract follower count from profile page
   */
  private async extractFollowerCount(page: Page): Promise<number> {
    try {
      const followerElement = await page.$('a[href*="/followers"] span');
      const followerText = await followerElement?.textContent();
      
      if (followerText) {
        return this.parseFollowerCount(followerText);
      }
    } catch (error) {
      console.error('Failed to extract follower count:', error);
    }
    return 0;
  }

  /**
   * Parse follower count from text (handles K, M suffixes)
   */
  private parseFollowerCount(text: string): number {
    const cleanText = text.replace(/,/g, '');
    const match = cleanText.match(/(\d+\.?\d*)\s*([KM])?/i);
    
    if (!match) return 0;
    
    const number = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    
    if (suffix === 'K') return Math.floor(number * 1000);
    if (suffix === 'M') return Math.floor(number * 1000000);
    return Math.floor(number);
  }

  /**
   * Scroll page to load more tweets
   */
  private async scrollToLoadTweets(page: Page): Promise<void> {
    let previousHeight = 0;
    let scrollAttempts = 0;

    while (scrollAttempts < 3) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
      }
      previousHeight = newHeight;
    }
  }

  /**
   * Extract data from a single tweet element
   */
  private async extractTweetData(tweetElement: any, account: PeerAccount, followerCount: number): Promise<PeerTweet | null> {
    try {
      // Extract text
      const textElement = await tweetElement.$('[data-testid="tweetText"]');
      const text = await textElement?.textContent() || '';
      
      if (!text || text.length < 10) return null;

      // Extract tweet ID
      const linkElement = await tweetElement.$('a[href*="/status/"]');
      const href = await linkElement?.getAttribute('href') || '';
      const tweetId = href.split('/status/')[1]?.split('?')[0] || '';
      
      if (!tweetId) return null;

      // Extract metrics
      const metrics = await this.extractTweetMetrics(tweetElement);
      
      // Extract timestamp
      const timeElement = await tweetElement.$('time');
      const datetime = await timeElement?.getAttribute('datetime') || new Date().toISOString();

      // Calculate engagement rates
      const totalEngagement = metrics.likes + metrics.replies + metrics.reposts;
      const engagementRate = metrics.views > 0 ? totalEngagement / metrics.views : 0;
      const normalizedEngagement = followerCount > 0 ? (totalEngagement / followerCount) * 1000000 : 0;

      // Classify content
      const format = this.detectFormat(text);
      const topic = await this.extractTopic(text);
      const hookType = await this.identifyHookType(text);

      return {
        account_handle: account.handle,
        tweet_id: tweetId,
        text,
        format,
        topic,
        hook_type: hookType,
        likes: metrics.likes,
        replies: metrics.replies,
        reposts: metrics.reposts,
        views: metrics.views,
        engagement_rate: engagementRate,
        normalized_engagement: normalizedEngagement,
        account_followers: followerCount,
        created_at: new Date(datetime)
      };

    } catch (error) {
      console.error('Failed to extract tweet data:', error);
      return null;
    }
  }

  /**
   * Extract engagement metrics from tweet element
   */
  private async extractTweetMetrics(tweetElement: any): Promise<{
    likes: number; replies: number; reposts: number; views: number;
  }> {
    try {
      const likeElement = await tweetElement.$('[data-testid="like"] span');
      const replyElement = await tweetElement.$('[data-testid="reply"] span');
      const repostElement = await tweetElement.$('[data-testid="retweet"] span');
      
      const likeText = await likeElement?.textContent() || '0';
      const replyText = await replyElement?.textContent() || '0';
      const repostText = await repostElement?.textContent() || '0';

      const likes = this.parseMetricCount(likeText);
      const replies = this.parseMetricCount(replyText);
      const reposts = this.parseMetricCount(repostText);
      
      // Estimate views (Twitter doesn't always show views)
      const totalEngagement = likes + replies + reposts;
      const views = Math.max(totalEngagement * 25, totalEngagement + 500); // Conservative estimate

      return { likes, replies, reposts, views };
    } catch (error) {
      return { likes: 0, replies: 0, reposts: 0, views: 0 };
    }
  }

  /**
   * Parse metric count (handles K, M suffixes)
   */
  private parseMetricCount(text: string): number {
    if (!text || text === '0') return 0;
    
    const cleanText = text.replace(/,/g, '');
    const match = cleanText.match(/(\d+\.?\d*)\s*([KM])?/i);
    
    if (!match) return 0;
    
    const number = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    
    if (suffix === 'K') return Math.floor(number * 1000);
    if (suffix === 'M') return Math.floor(number * 1000000);
    return Math.floor(number);
  }

  /**
   * Check if tweet meets quality criteria for learning
   */
  private isHighQualityTweet(tweet: PeerTweet): boolean {
    // Filter criteria for learning-worthy content
    return (
      tweet.text.length >= 50 && // Substantial content
      tweet.likes >= 100 && // Minimum engagement
      tweet.normalized_engagement > 0.5 && // Good relative performance
      !tweet.text.includes('@') && // Not primarily replies
      !tweet.text.startsWith('RT') && // Not retweets
      !/#\w+/.test(tweet.text) // No hashtags (matches our style)
    );
  }

  /**
   * Store peer tweets in database
   */
  private async storePeerTweets(tweets: PeerTweet[]): Promise<void> {
    for (const tweet of tweets) {
      try {
        // Check if tweet already exists
        const { data: existing } = await this.supabase
          .from('peer_posts')
          .select('id')
          .eq('tweet_id', tweet.tweet_id)
          .single();

        if (existing) {
          // Update existing record
          await this.supabase
            .from('peer_posts')
            .update({
              likes: tweet.likes,
              replies: tweet.replies,
              reposts: tweet.reposts,
              views: tweet.views,
              engagement_rate: tweet.engagement_rate,
              normalized_engagement: tweet.normalized_engagement
            })
            .eq('tweet_id', tweet.tweet_id);
        } else {
          // Create new record
          const embeddings = await this.getEmbedding(tweet.text);
          const extractedPatterns = await this.extractContentPatterns(tweet.text);

          await this.supabase
            .from('peer_posts')
            .insert({
              account_handle: tweet.account_handle,
              tweet_id: tweet.tweet_id,
              text: tweet.text,
              format: tweet.format,
              topic: tweet.topic,
              hook_type: tweet.hook_type,
              account_followers: tweet.account_followers,
              account_niche: this.peerAccounts.find(a => a.handle === tweet.account_handle)?.niche || 'health',
              likes: tweet.likes,
              replies: tweet.replies,
              reposts: tweet.reposts,
              views: tweet.views,
              engagement_rate: tweet.engagement_rate,
              normalized_engagement: tweet.normalized_engagement,
              embeddings,
              extracted_patterns: extractedPatterns,
              created_at: tweet.created_at.toISOString()
            });
        }
      } catch (error) {
        console.error(`Failed to store tweet ${tweet.tweet_id}:`, error);
      }
    }
  }

  /**
   * Analyze patterns from peer content using AI
   */
  private async analyzePeerPatterns(): Promise<void> {
    // Get top-performing peer posts
    const { data: topPeerPosts } = await this.supabase
      .from('peer_posts')
      .select('*')
      .gte('normalized_engagement', 2.0)
      .order('normalized_engagement', { ascending: false })
      .limit(50);

    if (!topPeerPosts?.length) return;

    // Analyze patterns using AI
    const patterns = await this.extractSuccessPatterns(topPeerPosts);
    
    // Update our pattern database
    await this.updatePatternDatabase(patterns);
  }

  /**
   * Extract success patterns from top peer posts using AI
   */
  private async extractSuccessPatterns(posts: any[]): Promise<any[]> {
    const prompt = `Analyze these high-performing health Twitter posts and extract patterns:

${posts.slice(0, 20).map(p => 
  `@${p.account_handle} (${p.normalized_engagement.toFixed(1)} engagement): "${p.text}"`
).join('\n')}

Identify successful patterns in JSON format:
{
  "patterns": [
    {
      "type": "hook|format|structure|angle",
      "name": "pattern_name",
      "description": "what makes it work",
      "examples": ["text1", "text2"],
      "confidence": 0.8
    }
  ]
}

Focus on patterns that could be adapted for health content.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"patterns": []}');
      return result.patterns || [];
    } catch (error) {
      console.error('Failed to extract patterns:', error);
      return [];
    }
  }

  /**
   * Update pattern database with peer insights
   */
  private async updatePatternDatabase(patterns: any[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        // Check if pattern already exists
        const { data: existing } = await this.supabase
          .from('patterns')
          .select('id, success_count')
          .eq('pattern_type', pattern.type)
          .eq('pattern_name', pattern.name)
          .single();

        if (existing) {
          // Update existing pattern
          await this.supabase
            .from('patterns')
            .update({
              success_count: existing.success_count + 1,
              confidence_score: Math.min(pattern.confidence, 1.0),
              last_updated: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Create new pattern
          await this.supabase
            .from('patterns')
            .insert({
              pattern_type: pattern.type,
              pattern_name: pattern.name,
              pattern_description: pattern.description,
              success_count: 1,
              confidence_score: pattern.confidence,
              discovered_from: 'peer_posts',
              status: 'testing'
            });
        }
      } catch (error) {
        console.error(`Failed to update pattern ${pattern.name}:`, error);
      }
    }
  }

  // Helper methods
  private detectFormat(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (text.includes('🧵') || sentences.length > 4) return 'thread';
    if (text.length > 200) return 'medium';
    return 'short';
  }

  private async extractTopic(text: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Extract the main health topic from this content in 1-2 words: "${text}"`
        }],
        temperature: 0.1,
        max_tokens: 10
      });
      return response.choices[0]?.message?.content?.trim() || 'general_health';
    } catch (error) {
      return 'general_health';
    }
  }

  private async identifyHookType(text: string): Promise<string> {
    const hookPatterns = {
      'contrarian_stat': /\d+%|\d+ study|\d+ people|research shows/i,
      'myth_busting': /myth|wrong|actually|truth is|contrary to/i,
      'question_provocative': /^\w+.*\?/,
      'surprising_fact': /surprising|shocking|most people don't know/i,
      'personal_story': /I used to|when I|my experience/i
    };

    for (const [hookType, pattern] of Object.entries(hookPatterns)) {
      if (pattern.test(text)) return hookType;
    }
    return 'general';
  }

  private async extractContentPatterns(text: string): Promise<any> {
    // Simplified pattern extraction - could be enhanced with more AI analysis
    return {
      word_count: text.split(' ').length,
      sentence_count: text.split(/[.!?]+/).length,
      has_numbers: /\d+/.test(text),
      has_question: text.includes('?'),
      starts_with_stat: /^\d+/.test(text)
    };
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default PeerScrapingSystem;
