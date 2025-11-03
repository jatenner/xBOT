/**
 * VIRAL TWEET SCRAPER
 * 
 * Scrapes high-performing tweets from Twitter to learn what actually works
 * Stores patterns and performance data for AI formatter training
 * 
 * Strategy:
 * 1. Scrape viral tweets (50K+ views) across categories
 * 2. Extract formatting patterns (hooks, structure, emojis, etc.)
 * 3. Correlate patterns with engagement metrics
 * 4. Feed insights to AI Visual Formatter
 * 
 * NOT limited to health content - learns from ALL successful tweets
 */

import { getSupabaseClient } from '../db';

export interface ViralTweet {
  tweetId: string;
  text: string;
  authorHandle: string;
  
  // Performance metrics
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  
  // Analyzed patterns
  structure: 'thread' | 'single';
  hookType?: 'question' | 'data' | 'controversy' | 'story' | 'statement';
  formattingPatterns: string[];
  emojiCount: number;
  characterCount: number;
  hasNumbers: boolean;
  
  // Categorization
  topicCategory?: string;
  contentType?: 'educational' | 'entertainment' | 'news' | 'opinion';
}

export class ViralTweetScraper {
  private static instance: ViralTweetScraper;
  
  public static getInstance(): ViralTweetScraper {
    if (!this.instance) {
      this.instance = new ViralTweetScraper();
    }
    return this.instance;
  }
  
  /**
   * Scrape viral tweets from multiple sources
   */
  async scrapeViralTweets(options: {
    minViews?: number;
    minEngagementRate?: number;
    categories?: string[];
    maxTweets?: number;
  } = {}): Promise<ViralTweet[]> {
    const {
      minViews = 50000,
      minEngagementRate = 0.02, // 2%
      categories = ['health', 'science', 'general'],
      maxTweets = 100
    } = options;
    
    console.log('[VIRAL_SCRAPER] 🔍 Starting scrape...');
    console.log(`  Min views: ${minViews.toLocaleString()}`);
    console.log(`  Min engagement: ${(minEngagementRate * 100).toFixed(1)}%`);
    console.log(`  Categories: ${categories.join(', ')}`);
    
    const scrapedTweets: ViralTweet[] = [];
    
    // TODO: Implement actual scraping logic
    // Options:
    // 1. Twitter API v2 (requires authentication)
    // 2. Playwright scraping (like your posting system)
    // 3. Third-party APIs (RapidAPI, etc.)
    
    console.log('[VIRAL_SCRAPER] ⚠️ Scraper not yet implemented');
    console.log('[VIRAL_SCRAPER] 💡 Will use Playwright to scrape Twitter trending page');
    
    return scrapedTweets;
  }
  
  /**
   * Analyze tweet patterns and extract formatting insights
   */
  analyzePatterns(tweet: ViralTweet): {
    patterns: string[];
    insights: Record<string, any>;
  } {
    const patterns: string[] = [];
    const insights: Record<string, any> = {};
    
    const text = tweet.text;
    
    // Hook analysis
    if (/^[A-Z]{2,}:/.test(text)) {
      patterns.push('caps_lead');
      insights.hookType = 'announcement';
    }
    if (/^\?/.test(text) || text.startsWith('What') || text.startsWith('Why') || text.startsWith('How')) {
      patterns.push('question_hook');
      insights.hookType = 'question';
    }
    if (/^\d+/.test(text)) {
      patterns.push('data_lead');
      insights.hookType = 'data';
    }
    if (/^(BREAKING|NEW|JUST IN|EXCLUSIVE)/i.test(text)) {
      patterns.push('news_hook');
      insights.hookType = 'news';
    }
    
    // Structure analysis
    if (text.includes('•') || text.includes('●')) {
      patterns.push('bullets');
    }
    if (/\d+\)/.test(text) || /\d+\./.test(text)) {
      patterns.push('numbered_list');
    }
    if ((text.match(/\n/g) || []).length >= 2) {
      patterns.push('line_breaks');
    }
    if (/[A-Z]{3,}/.test(text)) {
      patterns.push('caps_emphasis');
    }
    
    // Content patterns
    if (/\d+%|\d+ (people|percent|times|studies)/.test(text)) {
      patterns.push('statistics');
      insights.hasNumbers = true;
    }
    if (/myth|truth|wrong|actually|contrary|debunk/i.test(text)) {
      patterns.push('myth_busting');
    }
    if (/story|experience|happened|friend|met/i.test(text)) {
      patterns.push('storytelling');
    }
    if (text.includes('🚫') || text.includes('✅')) {
      patterns.push('myth_truth_markers');
    }
    
    // Emoji analysis
    const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
    insights.emojiCount = emojiCount;
    if (emojiCount === 0) patterns.push('emoji_free');
    else if (emojiCount === 1) patterns.push('single_emoji');
    else if (emojiCount >= 3) patterns.push('emoji_heavy');
    
    // Length analysis
    insights.characterCount = text.length;
    if (text.length < 100) patterns.push('ultra_short');
    else if (text.length < 180) patterns.push('short');
    else if (text.length < 250) patterns.push('medium');
    else patterns.push('long');
    
    return { patterns, insights };
  }
  
  /**
   * Store analyzed tweets in database
   */
  async storeTweets(tweets: ViralTweet[]): Promise<void> {
    const supabase = getSupabaseClient();
    
    console.log(`[VIRAL_SCRAPER] 💾 Storing ${tweets.length} tweets...`);
    
    for (const tweet of tweets) {
      const analysis = this.analyzePatterns(tweet);
      
      const engagementRate = (tweet.likes + tweet.retweets + tweet.replies) / tweet.views;
      const viralCoefficient = tweet.retweets / tweet.views;
      
      await supabase.from('viral_tweet_library').upsert({
        tweet_id: tweet.tweetId,
        text: tweet.text,
        author_handle: tweet.authorHandle,
        
        // Metrics
        likes: tweet.likes,
        retweets: tweet.retweets,
        replies: tweet.replies,
        views: tweet.views,
        engagement_rate: engagementRate,
        viral_coefficient: viralCoefficient,
        
        // Patterns
        structure: tweet.structure,
        hook_type: analysis.insights.hookType || tweet.hookType,
        formatting_patterns: analysis.patterns,
        emoji_count: analysis.insights.emojiCount,
        character_count: analysis.insights.characterCount,
        has_numbers: analysis.insights.hasNumbers || false,
        
        // Category
        topic_category: tweet.topicCategory || 'general',
        content_type: tweet.contentType || 'general'
      }, {
        onConflict: 'tweet_id'
      });
    }
    
    console.log('[VIRAL_SCRAPER] ✅ Tweets stored successfully');
  }
  
  /**
   * Get top performing patterns from database
   */
  async getTopPatterns(options: {
    minSampleSize?: number;
    minViews?: number;
    category?: string;
  } = {}): Promise<any[]> {
    const {
      minSampleSize = 10,
      minViews = 50000,
      category
    } = options;
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('viral_tweet_library')
      .select('formatting_patterns, hook_type, engagement_rate, viral_coefficient, views')
      .gte('views', minViews)
      .order('engagement_rate', { ascending: false });
    
    if (category) {
      query = query.eq('topic_category', category);
    }
    
    const { data } = await query.limit(50);
    
    if (!data) return [];
    
    // Group by pattern combination and calculate averages
    const patternGroups: Record<string, any[]> = {};
    
    data.forEach(tweet => {
      const key = `${tweet.hook_type || 'none'}_${(tweet.formatting_patterns || []).sort().join('+')}`;
      if (!patternGroups[key]) patternGroups[key] = [];
      patternGroups[key].push(tweet);
    });
    
    const topPatterns = Object.entries(patternGroups)
      .filter(([_, tweets]) => tweets.length >= minSampleSize)
      .map(([key, tweets]) => ({
        pattern: key,
        hookType: tweets[0].hook_type,
        formattingPatterns: tweets[0].formatting_patterns,
        avgEngagement: tweets.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / tweets.length,
        avgViralCoef: tweets.reduce((sum, t) => sum + (t.viral_coefficient || 0), 0) / tweets.length,
        sampleSize: tweets.length,
        examples: tweets.slice(0, 3) // Top 3 examples
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);
    
    return topPatterns;
  }
  
  /**
   * Get example tweets for AI training
   */
  async getExamplesForPrompt(limit: number = 5): Promise<string> {
    const supabase = getSupabaseClient();
    
    const { data: examples } = await supabase
      .from('viral_tweet_library')
      .select('text, likes, views, formatting_patterns, hook_type')
      .gte('views', 50000)
      .gte('engagement_rate', 0.03)
      .order('engagement_rate', { ascending: false })
      .limit(limit);
    
    if (!examples || examples.length === 0) {
      return 'No examples available yet. Waiting for viral tweet data.';
    }
    
    return examples.map((tweet, i) => `
EXAMPLE ${i + 1}: ${tweet.likes.toLocaleString()} likes, ${tweet.views.toLocaleString()} views
"${tweet.text.substring(0, 200)}${tweet.text.length > 200 ? '...' : ''}"
→ Pattern: ${tweet.hook_type || 'statement'} hook, ${(tweet.formatting_patterns || []).join(', ')}`
    ).join('\n');
  }
}

export const getViralScraper = () => ViralTweetScraper.getInstance();

