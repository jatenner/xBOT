/**
 * 🧠 TWITTER STRUCTURE LEARNING ENGINE
 * 
 * Advanced AI system that scrapes high-performing tweets to learn:
 * - Content formats and structures
 * - Style patterns and tones
 * - Topic categories and themes
 * - Engagement optimization techniques
 * 
 * This engine feeds learning data to the tweet generation system.
 */

import { chromium, Browser, Page } from 'playwright';
import { SecureSupabaseClient } from '../utils/secureSupabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';
import { getChromiumLaunchOptions } from '../utils/playwrightUtils';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

interface ViralTweet {
  tweet_id: string;
  author_username: string;
  author_follower_count: number;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  views: number;
  posted_date: Date;
  scraped_at: Date;
}

interface TweetAnalysis {
  format_type: string;
  tone: string;
  sentiment_score: number;
  readability_score: number;
  urgency_level: number;
  authority_signals: number;
  primary_topic: string;
  secondary_topic?: string;
  health_category?: string;
  controversy_level: number;
  word_count: number;
  sentence_count: number;
  paragraph_count: number;
  has_emojis: boolean;
  emoji_count: number;
  has_hashtags: boolean;
  hashtag_count: number;
  has_mentions: boolean;
  mention_count: number;
  has_media: boolean;
  media_type: string;
}

interface ScrapingTarget {
  type: 'trending' | 'search' | 'user' | 'hashtag';
  query: string;
  min_engagement: number;
  max_tweets: number;
}

export class TwitterStructureLearningEngine {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private supabase = new SecureSupabaseClient();
  private openai = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY!);
  
  // Learning targets for viral content discovery
  private readonly LEARNING_TARGETS: ScrapingTarget[] = [
    { type: 'search', query: 'health tips', min_engagement: 100, max_tweets: 20 },
    { type: 'search', query: 'wellness secrets', min_engagement: 50, max_tweets: 15 },
    { type: 'search', query: 'fitness hacks', min_engagement: 100, max_tweets: 15 },
    { type: 'search', query: 'nutrition facts', min_engagement: 50, max_tweets: 15 },
    { type: 'search', query: 'mental health', min_engagement: 100, max_tweets: 15 },
    { type: 'search', query: 'biohacking', min_engagement: 50, max_tweets: 10 },
    { type: 'hashtag', query: '#HealthTech', min_engagement: 50, max_tweets: 10 },
    { type: 'hashtag', query: '#Wellness', min_engagement: 100, max_tweets: 10 },
    { type: 'trending', query: 'health', min_engagement: 500, max_tweets: 5 }
  ];

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('🧠 Initializing Twitter Structure Learning Engine...');

      // Launch browser with stealth configuration
      const launchOptions = getChromiumLaunchOptions();
      this.browser = await chromium.launch(launchOptions);

      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Enhanced stealth measures
      await this.setupStealthMode();

      // Load Twitter session if available
      await this.loadTwitterSession();

      this.isInitialized = true;
      console.log('✅ Twitter Structure Learning Engine initialized');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to initialize learning engine:', error);
      await this.cleanup();
      return false;
    }
  }

  /**
   * 🎯 MAIN LEARNING FUNCTION
   * Scrapes viral tweets and analyzes their structure
   */
  async runLearningCycle(): Promise<{
    success: boolean;
    tweets_discovered: number;
    patterns_learned: number;
    errors: string[];
  }> {
    try {
      console.log('🧠 === TWITTER STRUCTURE LEARNING CYCLE ===');
      
      if (!await this.initialize()) {
        throw new Error('Failed to initialize learning engine');
      }

      let totalTweetsDiscovered = 0;
      let totalPatternsLearned = 0;
      const errors: string[] = [];

      // Process each learning target
      for (const target of this.LEARNING_TARGETS) {
        try {
          console.log(`🔍 Learning from: ${target.type} - ${target.query}`);
          
          const tweets = await this.scrapeTweetsForTarget(target);
          console.log(`📊 Found ${tweets.length} tweets for analysis`);

          // Analyze and store each tweet
          for (const tweet of tweets) {
            try {
              // Check if we already have this tweet
              if (await this.tweetAlreadyLearned(tweet.tweet_id)) {
                continue;
              }

              // Analyze tweet structure with AI
              const analysis = await this.analyzeTweetStructure(tweet);
              
              // Store learning data
              await this.storeLearningData(tweet, analysis);
              
              totalTweetsDiscovered++;
              console.log(`✅ Learned from tweet: ${tweet.content.substring(0, 60)}...`);

            } catch (tweetError: any) {
              console.error(`❌ Error processing tweet ${tweet.tweet_id}:`, tweetError.message);
              errors.push(`Tweet ${tweet.tweet_id}: ${tweetError.message}`);
            }
          }

          // Discover patterns from this batch
          const patterns = await this.discoverContentPatterns(tweets);
          totalPatternsLearned += patterns.length;

          // Small delay between targets to avoid rate limiting
          await this.page!.waitForTimeout(2000);

        } catch (targetError: any) {
          console.error(`❌ Error with target ${target.query}:`, targetError.message);
          errors.push(`Target ${target.query}: ${targetError.message}`);
        }
      }

      // Update format fingerprints based on new learning
      await this.updateFormatFingerprints();

      console.log('✅ === LEARNING CYCLE COMPLETE ===');
      console.log(`📊 Tweets discovered: ${totalTweetsDiscovered}`);
      console.log(`🧬 Patterns learned: ${totalPatternsLearned}`);

      return {
        success: true,
        tweets_discovered: totalTweetsDiscovered,
        patterns_learned: totalPatternsLearned,
        errors
      };

    } catch (error: any) {
      console.error('❌ Learning cycle failed:', error);
      return {
        success: false,
        tweets_discovered: 0,
        patterns_learned: 0,
        errors: [error.message]
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 🔍 SCRAPE TWEETS FOR SPECIFIC TARGET
   */
  private async scrapeTweetsForTarget(target: ScrapingTarget): Promise<ViralTweet[]> {
    const tweets: ViralTweet[] = [];
    
    try {
      // Navigate to search or trending page
      let searchUrl: string;
      
      switch (target.type) {
        case 'search':
          searchUrl = `https://twitter.com/search?q=${encodeURIComponent(target.query)}&src=typed_query&f=top`;
          break;
        case 'hashtag':
          searchUrl = `https://twitter.com/search?q=${encodeURIComponent(target.query)}&src=hashtag_click&f=top`;
          break;
        case 'trending':
          searchUrl = `https://twitter.com/explore/tabs/trending`;
          break;
        default:
          searchUrl = `https://twitter.com/search?q=${encodeURIComponent(target.query)}&f=top`;
      }

      console.log(`🔍 Navigating to: ${searchUrl}`);
      await this.page!.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for tweets to load
      await this.page!.waitForSelector('[data-testid="tweet"]', { timeout: 20000 });
      
      // Scroll to load more tweets
      await this.scrollToLoadTweets();

      // Extract tweets data
      const tweetElements = await this.page!.$$('[data-testid="tweet"]');
      console.log(`📝 Found ${tweetElements.length} tweet elements`);

      for (let i = 0; i < Math.min(tweetElements.length, target.max_tweets); i++) {
        const element = tweetElements[i];
        
        try {
          const tweetData = await this.extractTweetData(element);
          
          if (tweetData && this.meetsEngagementThreshold(tweetData, target.min_engagement)) {
            tweets.push(tweetData);
          }
        } catch (extractError) {
          console.log(`⚠️ Failed to extract tweet ${i + 1}:`, extractError);
        }
      }

    } catch (error: any) {
      console.error(`❌ Error scraping target ${target.query}:`, error);
    }

    return tweets;
  }

  /**
   * 📊 EXTRACT TWEET DATA FROM ELEMENT
   */
  private async extractTweetData(element: any): Promise<ViralTweet | null> {
    try {
      // Extract basic tweet info
      const contentElement = await element.$('[data-testid="tweetText"]');
      const content = contentElement ? await contentElement.textContent() : '';
      
      if (!content || content.length < 10) {
        return null;
      }

      // Extract author info
      const authorElement = await element.$('[data-testid="User-Name"] a');
      const authorUsername = authorElement ? 
        (await authorElement.getAttribute('href'))?.replace('/', '').replace('@', '') || 'unknown' : 'unknown';

      // Extract engagement metrics
      const likeElement = await element.$('[data-testid="like"]');
      const retweetElement = await element.$('[data-testid="retweet"]');
      const replyElement = await element.$('[data-testid="reply"]');

      const likes = await this.extractMetricCount(likeElement);
      const retweets = await this.extractMetricCount(retweetElement);
      const replies = await this.extractMetricCount(replyElement);

      // Generate unique tweet ID (since we can't get the real one easily)
      const tweet_id = crypto.createHash('md5').update(content + authorUsername).digest('hex').substring(0, 16);

      return {
        tweet_id,
        author_username: authorUsername,
        author_follower_count: 0, // We'll estimate this later
        content: content.trim(),
        likes,
        retweets,
        replies,
        quotes: 0,
        views: likes * 10 + retweets * 50, // Estimate views
        posted_date: new Date(),
        scraped_at: new Date()
      };

    } catch (error) {
      console.error('❌ Error extracting tweet data:', error);
      return null;
    }
  }

  /**
   * 🔢 EXTRACT METRIC COUNT FROM ELEMENT
   */
  private async extractMetricCount(element: any): Promise<number> {
    if (!element) return 0;
    
    try {
      const text = await element.textContent() || '0';
      const cleanText = text.replace(/[^\d.KM]/g, '');
      
      if (cleanText.includes('K')) {
        return Math.floor(parseFloat(cleanText) * 1000);
      } else if (cleanText.includes('M')) {
        return Math.floor(parseFloat(cleanText) * 1000000);
      } else {
        return parseInt(cleanText) || 0;
      }
    } catch (error) {
      return 0;
    }
  }

  /**
   * 🧠 ANALYZE TWEET STRUCTURE WITH AI
   */
  private async analyzeTweetStructure(tweet: ViralTweet): Promise<TweetAnalysis> {
    try {
      const analysisPrompt = `Analyze this high-performing tweet for structure and content patterns:

TWEET CONTENT: "${tweet.content}"
ENGAGEMENT: ${tweet.likes} likes, ${tweet.retweets} retweets, ${tweet.replies} replies

ANALYSIS REQUIRED:
1. FORMAT TYPE: Identify the content structure (hook_value_cta, news_commentary, fact_dump, storytelling, question_hook, controversy, research_reveal, personal_discovery, thread, or other)
2. TONE: Overall tone (casual, professional, humorous, controversial, educational, inspirational, urgent)
3. HEALTH CATEGORY: If health-related (fitness, nutrition, mental_health, medical, wellness, biohacking, or general)
4. PRIMARY TOPIC: Main subject (1-3 words)
5. SECONDARY TOPIC: Secondary subject if any
6. SENTIMENT: Emotional sentiment (-1 to 1, where -1=negative, 0=neutral, 1=positive)
7. URGENCY: Urgency level (1-10 scale)
8. AUTHORITY: Number of authority signals (studies, data, expert references, etc.)
9. CONTROVERSY: Controversy level (1-10 scale)

Respond ONLY with this JSON format:
{
  "format_type": "string",
  "tone": "string", 
  "primary_topic": "string",
  "secondary_topic": "string",
  "health_category": "string",
  "sentiment_score": number,
  "urgency_level": number,
  "authority_signals": number,
  "controversy_level": number
}`;

      const response = await this.openai.generateContent(
        analysisPrompt,
        'medium',
        'tweet_structure_analysis',
        { maxTokens: 200, temperature: 0.2 }
      );

      let analysis: any;
      try {
        analysis = JSON.parse(response);
      } catch (parseError) {
        // Fallback analysis
        analysis = {
          format_type: 'other',
          tone: 'casual',
          primary_topic: 'general',
          secondary_topic: null,
          health_category: null,
          sentiment_score: 0,
          urgency_level: 5,
          authority_signals: 0,
          controversy_level: 1
        };
      }

      // Calculate additional metrics
      const sentences = tweet.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const paragraphs = tweet.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const words = tweet.content.split(/\s+/).filter(w => w.length > 0);
      const emojis = tweet.content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
      const hashtags = tweet.content.match(/#\w+/g) || [];
      const mentions = tweet.content.match(/@\w+/g) || [];

      return {
        format_type: analysis.format_type || 'other',
        tone: analysis.tone || 'casual',
        sentiment_score: analysis.sentiment_score || 0,
        readability_score: Math.max(1, 10 - (words.length / sentences.length)), // Simple readability
        urgency_level: analysis.urgency_level || 5,
        authority_signals: analysis.authority_signals || 0,
        primary_topic: analysis.primary_topic || 'general',
        secondary_topic: analysis.secondary_topic,
        health_category: analysis.health_category,
        controversy_level: analysis.controversy_level || 1,
        word_count: words.length,
        sentence_count: sentences.length,
        paragraph_count: paragraphs.length,
        has_emojis: emojis.length > 0,
        emoji_count: emojis.length,
        has_hashtags: hashtags.length > 0,
        hashtag_count: hashtags.length,
        has_mentions: mentions.length > 0,
        mention_count: mentions.length,
        has_media: false, // We'll detect this separately
        media_type: 'none'
      };

    } catch (error: any) {
      console.error('❌ AI analysis failed:', error);
      
      // Return basic analysis as fallback
      return {
        format_type: 'other',
        tone: 'casual',
        sentiment_score: 0,
        readability_score: 5,
        urgency_level: 5,
        authority_signals: 0,
        primary_topic: 'general',
        secondary_topic: null,
        health_category: null,
        controversy_level: 1,
        word_count: tweet.content.split(/\s+/).length,
        sentence_count: tweet.content.split(/[.!?]+/).length,
        paragraph_count: 1,
        has_emojis: /[\u{1F600}-\u{1F64F}]/u.test(tweet.content),
        emoji_count: (tweet.content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length,
        has_hashtags: /#\w+/.test(tweet.content),
        hashtag_count: (tweet.content.match(/#\w+/g) || []).length,
        has_mentions: /@\w+/.test(tweet.content),
        mention_count: (tweet.content.match(/@\w+/g) || []).length,
        has_media: false,
        media_type: 'none'
      };
    }
  }

  /**
   * 💾 STORE LEARNING DATA IN DATABASE
   */
  private async storeLearningData(tweet: ViralTweet, analysis: TweetAnalysis): Promise<void> {
    try {
      const content_hash = crypto.createHash('sha256').update(tweet.content).digest('hex');
      
      const { error } = await this.supabase.client
        .from('viral_tweets_learned')
        .insert({
          tweet_id: tweet.tweet_id,
          author_username: tweet.author_username,
          author_follower_count: tweet.author_follower_count,
          content: tweet.content,
          content_hash,
          likes: tweet.likes,
          retweets: tweet.retweets,
          replies: tweet.replies,
          quotes: tweet.quotes,
          views: tweet.views,
          format_type: analysis.format_type,
          word_count: analysis.word_count,
          sentence_count: analysis.sentence_count,
          paragraph_count: analysis.paragraph_count,
          has_emojis: analysis.has_emojis,
          emoji_count: analysis.emoji_count,
          has_hashtags: analysis.has_hashtags,
          hashtag_count: analysis.hashtag_count,
          has_mentions: analysis.has_mentions,
          mention_count: analysis.mention_count,
          has_media: analysis.has_media,
          media_type: analysis.media_type,
          tone: analysis.tone,
          sentiment_score: analysis.sentiment_score,
          readability_score: analysis.readability_score,
          urgency_level: analysis.urgency_level,
          authority_signals: analysis.authority_signals,
          primary_topic: analysis.primary_topic,
          secondary_topic: analysis.secondary_topic,
          health_category: analysis.health_category,
          controversy_level: analysis.controversy_level,
          scraped_at: tweet.scraped_at
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

    } catch (error: any) {
      console.error('❌ Failed to store learning data:', error);
      throw error;
    }
  }

  /**
   * 🔍 DISCOVER CONTENT PATTERNS
   */
  private async discoverContentPatterns(tweets: ViralTweet[]): Promise<any[]> {
    if (tweets.length < 3) return [];

    try {
      // Group tweets by performance tiers
      const topPerformers = tweets
        .filter(t => t.likes > 100 || t.retweets > 20)
        .sort((a, b) => (b.likes + b.retweets * 2) - (a.likes + a.retweets * 2));

      if (topPerformers.length === 0) return [];

      // Analyze patterns with AI
      const patternPrompt = `Analyze these high-performing tweets to discover content patterns:

${topPerformers.slice(0, 5).map((tweet, i) => 
  `${i+1}. "${tweet.content}" (${tweet.likes} likes, ${tweet.retweets} retweets)`
).join('\n')}

DISCOVER PATTERNS:
1. Common structural elements
2. Shared content themes  
3. Engagement triggers
4. Format patterns
5. Style similarities

Identify 3-5 specific patterns with high confidence. For each pattern, provide:
- Pattern name
- Description
- Why it works
- Confidence score (0-1)

Respond ONLY with JSON array:
[{"name": "string", "description": "string", "why_it_works": "string", "confidence": number}]`;

      const response = await this.openai.generateContent(
        patternPrompt,
        'medium',
        'pattern_discovery',
        { maxTokens: 300, temperature: 0.3 }
      );

      try {
        const patterns = JSON.parse(response);
        return Array.isArray(patterns) ? patterns : [];
      } catch (parseError) {
        console.error('❌ Failed to parse patterns:', parseError);
        return [];
      }

    } catch (error: any) {
      console.error('❌ Pattern discovery failed:', error);
      return [];
    }
  }

  /**
   * 🔄 UPDATE FORMAT FINGERPRINTS
   */
  private async updateFormatFingerprints(): Promise<void> {
    try {
      // Get successful format patterns from recent learning
      const { data: recentTweets, error } = await this.supabase.client
        .from('viral_tweets_learned')
        .select('format_type, engagement_rate, viral_score, content')
        .where('scraped_at', 'gte', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('viral_score', { ascending: false })
        .limit(20);

      if (error || !recentTweets) return;

      // Group by format type and calculate performance
      const formatPerformance = recentTweets.reduce((acc: any, tweet: any) => {
        const format = tweet.format_type || 'other';
        if (!acc[format]) {
          acc[format] = { count: 0, totalEngagement: 0, examples: [] };
        }
        acc[format].count++;
        acc[format].totalEngagement += tweet.engagement_rate || 0;
        acc[format].examples.push(tweet.content);
        return acc;
      }, {});

      // Update fingerprints for high-performing formats
      for (const [format, stats] of Object.entries(formatPerformance) as [string, any][]) {
        if (stats.count >= 2) {
          const avgEngagement = stats.totalEngagement / stats.count;
          
          await this.supabase.client
            .from('content_format_fingerprints')
            .upsert({
              format_name: format,
              format_pattern: `Pattern discovered from viral ${format} tweets`,
              avg_engagement: avgEngagement,
              usage_count: stats.count,
              confidence_score: Math.min(0.9, stats.count * 0.2),
              last_successful_use: new Date().toISOString()
            });
        }
      }

    } catch (error: any) {
      console.error('❌ Failed to update format fingerprints:', error);
    }
  }

  /**
   * 🛠️ UTILITY FUNCTIONS
   */
  private async setupStealthMode(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // Block unnecessary resources
    await this.page.route('**/*', (route) => {
      if (route.request().resourceType() === 'image' && 
          !route.request().url().includes('profile_images')) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  private async loadTwitterSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        await this.page!.context().addCookies(sessionData.cookies);
        console.log('✅ Twitter session loaded');
      }
    } catch (error) {
      console.log('⚠️ No valid Twitter session found');
    }
  }

  private async scrollToLoadTweets(): Promise<void> {
    if (!this.page) return;

    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => window.scrollBy(0, 1000));
      await this.page.waitForTimeout(2000);
    }
  }

  private meetsEngagementThreshold(tweet: ViralTweet, threshold: number): boolean {
    return (tweet.likes + tweet.retweets * 2) >= threshold;
  }

  private async tweetAlreadyLearned(tweetId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.client
        .from('viral_tweets_learned')
        .select('id')
        .eq('tweet_id', tweetId)
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.page = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Export singleton instance
export const twitterStructureLearningEngine = new TwitterStructureLearningEngine();