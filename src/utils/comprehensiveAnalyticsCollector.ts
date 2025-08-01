/**
 * 🚀 COMPREHENSIVE ANALYTICS COLLECTOR
 * 
 * Advanced analytics collection system that gathers detailed performance data
 * from multiple sources to build the most complete picture of tweet performance.
 * 
 * Features:
 * - Multi-interval data collection (1h, 6h, 24h, 72h snapshots)
 * - Browser-based analytics scraping for complete data
 * - API fallback for basic metrics
 * - Content feature analysis using AI
 * - Real-time performance scoring
 * - Follower attribution tracking
 */

import { supabaseClient } from './supabaseClient';
import { BudgetAwareOpenAI } from './budgetAwareOpenAI';
import { chromium, Browser, Page } from 'playwright';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

export interface TweetAnalyticsData {
  tweet_id: string;
  snapshot_interval?: 'initial' | '1h' | '6h' | '24h' | '72h' | 'weekly';
  
  // Core engagement metrics
  likes: number;
  retweets: number;
  replies: number;
  quotes?: number;
  bookmarks?: number;
  
  // Discovery metrics
  impressions: number;
  profile_visits?: number;
  detail_expands?: number;
  url_clicks?: number;
  media_views?: number;
  
  // Follower impact
  new_followers_attributed?: number;
  
  // Data source
  collected_via: 'api' | 'browser' | 'estimated';
}

export interface ContentFeatures {
  tweet_id: string;
  content_type?: string;
  tone_profile?: string;
  format_style?: string;
  
  // Structure analysis
  character_count?: number;
  word_count?: number;
  sentence_count?: number;
  paragraph_count?: number;
  
  // Engagement elements
  has_question?: boolean;
  has_call_to_action?: boolean;
  has_emoji?: boolean;
  emoji_count?: number;
  has_hashtags?: boolean;
  hashtag_count?: number;
  has_mentions?: boolean;
  mention_count?: number;
  has_media?: boolean;
  has_links?: boolean;
  
  // AI analysis
  primary_topic?: string;
  secondary_topics?: string[];
  key_phrases?: string[];
  sentiment_score?: number;
  complexity_score?: number;
  
  // Timing
  posted_hour?: number;
  posted_day_of_week?: number;
  posted_month?: number;
  is_weekend?: boolean;
}

export class ComprehensiveAnalyticsCollector {
  private static budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  private static browser: Browser | null = null;
  
  /**
   * 🚀 MAIN COLLECTION ORCHESTRATOR
   * Coordinates all analytics collection for a tweet
   */
  static async collectComprehensiveAnalytics(tweetId: string, content: string, posted_at: Date): Promise<{
    success: boolean;
    analytics_collected: boolean;
    features_analyzed: boolean;
    performance_scored: boolean;
    error?: string;
  }> {
    try {
      console.log(`📊 Starting comprehensive analytics collection for tweet: ${tweetId}`);
      
      let analyticsCollected = false;
      let featuresAnalyzed = false;
      let performanceScored = false;
      
      // Step 1: Collect initial analytics snapshot
      try {
        await this.collectAnalyticsSnapshot(tweetId, 'initial');
        analyticsCollected = true;
        console.log('✅ Initial analytics snapshot collected');
      } catch (error) {
        console.warn('⚠️ Initial analytics collection failed:', error.message);
      }
      
      // Step 2: Analyze content features
      try {
        await this.analyzeContentFeatures(tweetId, content, posted_at);
        featuresAnalyzed = true;
        console.log('✅ Content features analyzed');
      } catch (error) {
        console.warn('⚠️ Content analysis failed:', error.message);
      }
      
      // Step 3: Schedule future collection intervals
      this.scheduleCollectionIntervals(tweetId);
      
      return {
        success: true,
        analytics_collected: analyticsCollected,
        features_analyzed: featuresAnalyzed,
        performance_scored: performanceScored
      };
      
    } catch (error) {
      console.error('❌ Comprehensive analytics collection failed:', error);
      return {
        success: false,
        analytics_collected: false,
        features_analyzed: false,
        performance_scored: false,
        error: error.message
      };
    }
  }
  
  /**
   * 📈 COLLECT ANALYTICS SNAPSHOT
   * Gathers performance data via browser scraping or API
   */
  static async collectAnalyticsSnapshot(tweetId: string, interval: string): Promise<TweetAnalyticsData> {
    console.log(`📊 Collecting ${interval} analytics for tweet: ${tweetId}`);
    
    // Try browser collection first (most comprehensive)
    try {
      const browserData = await this.collectViaBrowser(tweetId);
      if (browserData) {
        browserData.snapshot_interval = interval as any;
        await this.storeAnalyticsData(browserData);
        return browserData;
      }
    } catch (error) {
      console.warn('⚠️ Browser collection failed, trying API fallback:', error.message);
    }
    
    // Fallback to API or estimation
    const fallbackData = await this.collectViaAPIFallback(tweetId, interval);
    await this.storeAnalyticsData(fallbackData);
    return fallbackData;
  }
  
  /**
   * 🌐 BROWSER-BASED ANALYTICS COLLECTION
   * Scrapes Twitter analytics page for complete data
   */
  private static async collectViaBrowser(tweetId: string): Promise<TweetAnalyticsData | null> {
    let page: Page | null = null;
    
    try {
      // Initialize browser if needed
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
      
      page = await this.browser.newPage();
      
      // Navigate to tweet analytics
      const analyticsUrl = `https://x.com/Signal_Synapse/status/${tweetId}/analytics`;
      await page.goto(analyticsUrl, { waitUntil: 'networkidle' });
      
      // Wait for analytics to load
      await page.waitForTimeout(3000);
      
      // Check if we're logged in and have access to analytics
      const analyticsVisible = await page.isVisible('[data-testid="analytics"]').catch(() => false);
      if (!analyticsVisible) {
        console.warn('⚠️ Analytics not accessible - may need login or tweet is too new');
        return null;
      }
      
      // Extract analytics data
      const analyticsData = await page.evaluate((tweetId) => {
        const getMetricValue = (selector: string): number => {
          const element = document.querySelector(selector);
          if (!element) return 0;
          const text = element.textContent || '0';
          return parseInt(text.replace(/[^\d]/g, '')) || 0;
        };
        
        return {
          tweet_id: tweetId,
          
          // Core engagement (try multiple selectors)
          likes: getMetricValue('[data-testid="like"] span') || 
                 getMetricValue('[aria-label*="like"]') ||
                 getMetricValue('[data-testid="analytics-likes"]'),
                 
          retweets: getMetricValue('[data-testid="retweet"] span') ||
                   getMetricValue('[aria-label*="retweet"]') ||
                   getMetricValue('[data-testid="analytics-retweets"]'),
                   
          replies: getMetricValue('[data-testid="reply"] span') ||
                  getMetricValue('[aria-label*="repl"]') ||
                  getMetricValue('[data-testid="analytics-replies"]'),
                  
          quotes: getMetricValue('[data-testid="analytics-quotes"]') || 0,
          bookmarks: getMetricValue('[data-testid="analytics-bookmarks"]') || 0,
          
          // Discovery metrics
          impressions: getMetricValue('[data-testid="analytics-impressions"]') || 0,
          profile_visits: getMetricValue('[data-testid="analytics-profile-visits"]') || 0,
          detail_expands: getMetricValue('[data-testid="analytics-detail-expands"]') || 0,
          url_clicks: getMetricValue('[data-testid="analytics-url-clicks"]') || 0,
          media_views: getMetricValue('[data-testid="analytics-media-views"]') || 0,
          
          new_followers_attributed: 0, // Will be calculated separately
          collected_via: 'browser' as const
        };
      }, tweetId);
      
      console.log(`✅ Browser analytics collected: ${analyticsData.impressions} impressions, ${analyticsData.likes} likes`);
      return analyticsData;
      
    } catch (error) {
      console.error('❌ Browser analytics collection failed:', error);
      return null;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }
  
  /**
   * 🔄 API FALLBACK COLLECTION
   * Uses Twitter API or estimation when browser scraping fails
   */
  private static async collectViaAPIFallback(tweetId: string, interval: string): Promise<TweetAnalyticsData> {
    console.log(`🔄 Using API fallback for tweet: ${tweetId}`);
    
    // Try to get basic metrics from database (if we have them)
    const { data: existingTweet } = await supabaseClient.supabase
      .from('tweets')
      .select('likes, retweets, replies')
      .eq('tweet_id', tweetId)
      .single();
    
    const baseMetrics = {
      likes: existingTweet?.likes || 0,
      retweets: existingTweet?.retweets || 0,
      replies: existingTweet?.replies || 0
    };
    
    // Estimate other metrics based on engagement patterns
    const totalEngagement = baseMetrics.likes + baseMetrics.retweets + baseMetrics.replies;
    const estimatedImpressions = Math.max(totalEngagement * 20, 100); // Conservative estimate
    
    return {
      tweet_id: tweetId,
      snapshot_interval: interval as any,
      
      // Basic metrics
      likes: baseMetrics.likes,
      retweets: baseMetrics.retweets,
      replies: baseMetrics.replies,
      quotes: 0,
      bookmarks: Math.floor(totalEngagement * 0.3), // Estimate bookmarks as 30% of engagement
      
      // Estimated discovery metrics
      impressions: estimatedImpressions,
      profile_visits: Math.floor(estimatedImpressions * 0.02), // 2% profile visit rate
      detail_expands: Math.floor(estimatedImpressions * 0.01), // 1% detail expand rate
      url_clicks: 0,
      media_views: 0,
      
      new_followers_attributed: 0, // Will be calculated separately
      collected_via: 'estimated'
    };
  }
  
  /**
   * 🧠 ANALYZE CONTENT FEATURES
   * Uses AI to extract content characteristics for learning
   */
  static async analyzeContentFeatures(tweetId: string, content: string, posted_at: Date): Promise<ContentFeatures> {
    console.log(`🧠 Analyzing content features for tweet: ${tweetId}`);
    
    // Basic content analysis (no AI needed)
    const basicFeatures = this.extractBasicFeatures(content, posted_at);
    
    // AI-powered analysis (if budget allows)
    let aiFeatures: Partial<ContentFeatures> = {};
    try {
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (!lockdownStatus.lockdownActive) {
        aiFeatures = await this.performAIContentAnalysis(content);
      }
    } catch (error) {
      console.warn('⚠️ AI content analysis failed:', error.message);
    }
    
    // Combine features
    const features: ContentFeatures = {
      tweet_id: tweetId,
      ...basicFeatures,
      ...aiFeatures
    };
    
    // Store in database
    await this.storeContentFeatures(features);
    
    return features;
  }
  
  /**
   * 📝 EXTRACT BASIC CONTENT FEATURES
   * Analyzes content structure without AI
   */
  private static extractBasicFeatures(content: string, posted_at: Date): Partial<ContentFeatures> {
    const date = new Date(posted_at);
    const day = date.getDay(); // 0 = Sunday
    const hour = date.getHours();
    const month = date.getMonth() + 1;
    
    // Text analysis
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Emoji detection
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = content.match(emojiRegex) || [];
    
    // Hashtag detection
    const hashtags = content.match(/#\w+/g) || [];
    
    // Mention detection
    const mentions = content.match(/@\w+/g) || [];
    
    // Link detection
    const links = content.match(/https?:\/\/[^\s]+/g) || [];
    
    // Content type detection
    let contentType = 'single_tip';
    if (content.includes('Thread:') || content.match(/\d+\//)) {
      contentType = 'thread';
    } else if (content.includes('?') && content.includes('poll')) {
      contentType = 'poll';
    } else if (content.toLowerCase().includes('myth:') || content.toLowerCase().includes('fact:')) {
      contentType = 'myth_buster';
    } else if (content.match(/\d+\s+(ways|tips|steps|reasons)/i)) {
      contentType = 'list';
    }
    
    // Tone detection (basic)
    let toneProfile = 'conversational';
    if (content.includes('study shows') || content.includes('research')) {
      toneProfile = 'authoritative';
    } else if (content.match(/\d+%|\d+x|statistics/)) {
      toneProfile = 'data_driven';
    } else if (content.includes('!') && content.includes('now')) {
      toneProfile = 'urgent';
    }
    
    // Format style detection
    let formatStyle = 'narrative';
    if (content.match(/^\d+\./m)) {
      formatStyle = 'numbered_list';
    } else if (content.match(/^[-•]/m)) {
      formatStyle = 'bullet_points';
    } else if (content.includes('?') && content.includes(':')) {
      formatStyle = 'q_and_a';
    }
    
    return {
      content_type: contentType,
      tone_profile: toneProfile,
      format_style: formatStyle,
      
      character_count: content.length,
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      
      has_question: content.includes('?'),
      has_call_to_action: /\b(follow|like|share|retweet|comment|try|start|get|join)\b/i.test(content),
      has_emoji: emojis.length > 0,
      emoji_count: emojis.length,
      has_hashtags: hashtags.length > 0,
      hashtag_count: hashtags.length,
      has_mentions: mentions.length > 0,
      mention_count: mentions.length,
      has_media: false, // Will be detected elsewhere
      has_links: links.length > 0,
      
      posted_hour: hour,
      posted_day_of_week: day,
      posted_month: month,
      is_weekend: day === 0 || day === 6
    };
  }
  
  /**
   * 🤖 AI-POWERED CONTENT ANALYSIS
   * Uses OpenAI to extract semantic features
   */
  private static async performAIContentAnalysis(content: string): Promise<Partial<ContentFeatures>> {
    const systemPrompt = `Analyze this tweet content and extract key characteristics. Return JSON with:
{
  "primary_topic": "main topic (e.g., sleep, nutrition, exercise)",
  "secondary_topics": ["related", "topics"],
  "key_phrases": ["important", "phrases"],
  "sentiment_score": 0.7,
  "complexity_score": 5
}

Sentiment: -1 (negative) to 1 (positive)
Complexity: 1 (very simple) to 10 (highly technical)`;

    const userPrompt = `Analyze this tweet: "${content}"`;

    try {
      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], {
        priority: 'optional' as any,
        operationType: 'content_analysis',
        model: 'gpt-4o-mini',
        maxTokens: 200,
        temperature: 0.1,
        forTweetGeneration: false
      });

      if (response?.success && response?.response?.choices?.[0]?.message?.content) {
        const analysis = JSON.parse(response.response.choices[0].message.content);
        return {
          primary_topic: analysis.primary_topic || 'general_health',
          secondary_topics: analysis.secondary_topics || [],
          key_phrases: analysis.key_phrases || [],
          sentiment_score: analysis.sentiment_score || 0.5,
          complexity_score: analysis.complexity_score || 5
        };
      }
    } catch (error) {
      console.warn('⚠️ AI analysis parsing failed:', error.message);
    }

    // Fallback to basic detection
    return {
      primary_topic: 'general_health',
      secondary_topics: [],
      key_phrases: [],
      sentiment_score: 0.5,
      complexity_score: 5
    };
  }
  
  /**
   * 💾 STORE ANALYTICS DATA
   */
  private static async storeAnalyticsData(data: TweetAnalyticsData): Promise<void> {
    const { error } = await supabaseClient.supabase
      .from('tweet_analytics')
      .upsert({
        tweet_id: data.tweet_id,
        snapshot_interval: data.snapshot_interval,
        snapshot_time: new Date().toISOString(),
        
        likes: data.likes,
        retweets: data.retweets,
        replies: data.replies,
        quotes: data.quotes,
        bookmarks: data.bookmarks,
        
        impressions: data.impressions,
        profile_visits: data.profile_visits,
        detail_expands: data.detail_expands,
        url_clicks: data.url_clicks,
        media_views: data.media_views,
        
        new_followers_attributed: data.new_followers_attributed,
        
        engagement_rate: data.impressions > 0 ? 
          ((data.likes + data.retweets + data.replies) / data.impressions * 100) : 0,
        profile_visit_rate: data.impressions > 0 ? 
          (data.profile_visits / data.impressions * 100) : 0,
        click_through_rate: data.impressions > 0 ? 
          (data.url_clicks / data.impressions * 100) : 0,
        
        collected_via: data.collected_via
      }, {
        onConflict: 'tweet_id,snapshot_interval'
      });

    if (error) {
      console.error('❌ Failed to store analytics data:', error);
      throw error;
    }
  }
  
  /**
   * 💾 STORE CONTENT FEATURES
   */
  private static async storeContentFeatures(features: ContentFeatures): Promise<void> {
    const { error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .upsert(features, {
        onConflict: 'tweet_id'
      });

    if (error) {
      console.error('❌ Failed to store content features:', error);
      throw error;
    }
  }
  
  /**
   * ⏰ SCHEDULE COLLECTION INTERVALS
   * Sets up delayed collection for 1h, 6h, 24h, 72h intervals
   */
  private static scheduleCollectionIntervals(tweetId: string): void {
    const intervals = [
      { name: '1h', delay: 60 * 60 * 1000 },      // 1 hour
      { name: '6h', delay: 6 * 60 * 60 * 1000 },  // 6 hours
      { name: '24h', delay: 24 * 60 * 60 * 1000 }, // 24 hours
      { name: '72h', delay: 72 * 60 * 60 * 1000 }  // 72 hours
    ];

    intervals.forEach(interval => {
      setTimeout(async () => {
        try {
          await this.collectAnalyticsSnapshot(tweetId, interval.name);
          console.log(`✅ ${interval.name} analytics collected for ${tweetId}`);
        } catch (error) {
          console.error(`❌ ${interval.name} collection failed for ${tweetId}:`, error);
        }
      }, interval.delay);
    });

    console.log(`⏰ Scheduled ${intervals.length} collection intervals for tweet: ${tweetId}`);
  }
  
  /**
   * 🧹 CLEANUP BROWSER RESOURCES
   */
  static async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🧹 Analytics browser cleaned up');
    }
  }
}

export const comprehensiveAnalyticsCollector = ComprehensiveAnalyticsCollector;