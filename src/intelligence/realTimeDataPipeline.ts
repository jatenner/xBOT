/**
 * 🌊 REAL-TIME DATA PIPELINE ENGINE
 * 
 * Continuously collects, processes, and analyzes Twitter data for algorithm optimization
 * Tracks engagement velocity, trending topics, and competitor strategies in real-time
 */

import { supabaseClient } from '../utils/supabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

export interface TweetMetrics {
  tweet_id: string;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  impressions_count?: number;
  minutes_since_posting: number;
  velocity_score: number;
  viral_probability: number;
}

export interface TrendingTopic {
  topic: string;
  trend_strength: number;
  source: string;
  related_keywords: string[];
  opportunity_score: number;
  content_suggestions: string[];
}

export interface CompetitorData {
  competitor_handle: string;
  recent_performance: {
    avg_likes: number;
    avg_retweets: number;
    top_performing_content: string[];
    posting_frequency: number;
    engagement_rate: number;
  };
  content_strategy: {
    primary_topics: string[];
    content_formats: string[];
    viral_elements: string[];
  };
}

export interface EngagementVelocity {
  tweet_id: string;
  velocity_15min: number;
  velocity_1hr: number;
  velocity_24hr: number;
  viral_threshold_reached: boolean;
  predicted_final_engagement: number;
}

export class RealTimeDataPipeline {
  private static instance: RealTimeDataPipeline;
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private isRunning: boolean = false;
  private intervals: NodeJS.Timeout[] = [];

  // Target competitors to monitor
  private readonly TARGET_COMPETITORS = [
    'hubermanlab', 'drmarkhyman', 'carnivoremd', 'drjasonfung',
    'ben_greenfield', 'gundrymd', 'robb_wolf', 'theliverking'
  ];

  private constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  }

  public static getInstance(): RealTimeDataPipeline {
    if (!RealTimeDataPipeline.instance) {
      RealTimeDataPipeline.instance = new RealTimeDataPipeline();
    }
    return RealTimeDataPipeline.instance;
  }

  /**
   * 🚀 START REAL-TIME DATA COLLECTION
   */
  async startDataPipeline(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Data pipeline already running');
      return;
    }

    console.log('🌊 === STARTING REAL-TIME DATA PIPELINE ===');
    this.isRunning = true;

    try {
      // Real-time engagement velocity tracking (every 5 minutes)
      const velocityInterval = setInterval(async () => {
        await this.trackEngagementVelocity();
      }, 5 * 60 * 1000);
      this.intervals.push(velocityInterval);

      // Trending topics detection (every 15 minutes)
      const trendingInterval = setInterval(async () => {
        await this.detectTrendingTopics();
      }, 15 * 60 * 1000);
      this.intervals.push(trendingInterval);

      // Competitor analysis (every 30 minutes)
      const competitorInterval = setInterval(async () => {
        await this.analyzeCompetitors();
      }, 30 * 60 * 1000);
      this.intervals.push(competitorInterval);

      // Data synthesis and insights (every hour)
      const synthesisInterval = setInterval(async () => {
        await this.synthesizeInsights();
      }, 60 * 60 * 1000);
      this.intervals.push(synthesisInterval);

      // Run initial collection
      await this.runInitialDataCollection();

      console.log('✅ Real-time data pipeline started successfully');

    } catch (error) {
      console.error('❌ Failed to start data pipeline:', error);
      this.stopDataPipeline();
    }
  }

  /**
   * 🛑 STOP DATA PIPELINE
   */
  stopDataPipeline(): void {
    console.log('🛑 Stopping real-time data pipeline...');
    this.isRunning = false;
    
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    console.log('✅ Data pipeline stopped');
  }

  /**
   * 🎯 INITIAL DATA COLLECTION ON START
   */
  private async runInitialDataCollection(): Promise<void> {
    console.log('📊 Running initial data collection...');
    
    await Promise.allSettled([
      this.trackEngagementVelocity(),
      this.detectTrendingTopics(),
      this.analyzeCompetitors()
    ]);
    
    console.log('✅ Initial data collection complete');
  }

  /**
   * ⚡ TRACK ENGAGEMENT VELOCITY FOR RECENT TWEETS
   */
  private async trackEngagementVelocity(): Promise<void> {
    try {
      console.log('⚡ Tracking engagement velocity...');

      // Get recent tweets from our account
      const { data: recentTweets, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id, tweet_id, posted_at')
        .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('posted_at', { ascending: false });

      if (error || !recentTweets?.length) {
        console.log('⚠️ No recent tweets to track');
        return;
      }

      for (const tweet of recentTweets) {
        await this.collectTweetMetrics(tweet.tweet_id, tweet.posted_at);
      }

      console.log(`✅ Tracked velocity for ${recentTweets.length} tweets`);

    } catch (error) {
      console.error('❌ Velocity tracking failed:', error);
    }
  }

  /**
   * 📈 COLLECT METRICS FOR INDIVIDUAL TWEET
   */
  private async collectTweetMetrics(tweetId: string, postedAt: string): Promise<TweetMetrics | null> {
    try {
      // Calculate minutes since posting
      const minutesSincePosting = Math.floor(
        (new Date().getTime() - new Date(postedAt).getTime()) / (1000 * 60)
      );

      // Get current metrics from our analytics table
      const { data: analytics } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('likes, retweets, replies, impressions')
        .eq('tweet_id', tweetId)
        .single();

      if (!analytics) {
        console.log(`⚠️ No analytics data for tweet ${tweetId}`);
        return null;
      }

      // Calculate velocity score (engagement per minute)
      const totalEngagement = (analytics.likes || 0) + (analytics.retweets || 0) * 2 + (analytics.replies || 0) * 3;
      const velocityScore = minutesSincePosting > 0 ? totalEngagement / minutesSincePosting : 0;

      // Predict viral probability based on early velocity
      const viralProbability = this.calculateViralProbability(velocityScore, minutesSincePosting);

      const metrics: TweetMetrics = {
        tweet_id: tweetId,
        likes_count: analytics.likes || 0,
        retweets_count: analytics.retweets || 0,
        replies_count: analytics.replies || 0,
        impressions_count: analytics.impressions,
        minutes_since_posting: minutesSincePosting,
        velocity_score: velocityScore,
        viral_probability: viralProbability
      };

      // Store in velocity tracking table
      await supabaseClient.supabase!.from('engagement_velocity_tracking').insert({
        tweet_id: tweetId,
        likes_count: metrics.likes_count,
        retweets_count: metrics.retweets_count,
        replies_count: metrics.replies_count,
        impressions_count: metrics.impressions_count,
        minutes_since_posting: minutesSincePosting,
        velocity_score: velocityScore,
        viral_probability: viralProbability
      });

      return metrics;

    } catch (error) {
      console.error(`❌ Failed to collect metrics for tweet ${tweetId}:`, error);
      return null;
    }
  }

  /**
   * 🔮 CALCULATE VIRAL PROBABILITY BASED ON EARLY METRICS
   */
  private calculateViralProbability(velocityScore: number, minutesSincePosting: number): number {
    // Early velocity indicators (first 15 minutes are critical)
    if (minutesSincePosting <= 15) {
      if (velocityScore >= 3.0) return 0.9; // Very likely to go viral
      if (velocityScore >= 1.5) return 0.7; // High viral potential
      if (velocityScore >= 0.8) return 0.5; // Moderate potential
      if (velocityScore >= 0.3) return 0.3; // Low potential
      return 0.1; // Very low potential
    }
    
    // First hour indicators
    if (minutesSincePosting <= 60) {
      if (velocityScore >= 1.5) return 0.8;
      if (velocityScore >= 0.8) return 0.6;
      if (velocityScore >= 0.4) return 0.4;
      if (velocityScore >= 0.2) return 0.2;
      return 0.05;
    }
    
    // After first hour, viral potential decreases
    if (velocityScore >= 0.5) return 0.6;
    if (velocityScore >= 0.3) return 0.4;
    if (velocityScore >= 0.1) return 0.2;
    return 0.05;
  }

  /**
   * 📈 DETECT TRENDING TOPICS IN HEALTH/WELLNESS
   */
  private async detectTrendingTopics(): Promise<void> {
    try {
      console.log('📈 Detecting trending health topics...');

      // Use AI to identify trending health topics
      const trendingPrompt = `Identify the top 10 trending topics in health, nutrition, wellness, and fitness for today. 

      Consider:
      - Current health debates and controversies
      - Seasonal health topics (current month)
      - Breaking health news and studies
      - Popular diet and fitness trends
      - Mental health awareness topics
      - Supplement and biohacking trends

      For each topic, provide:
      1. Topic name
      2. Trend strength (0-1)
      3. Related keywords
      4. Why it's trending
      5. Content opportunity score for a health education account

      Return as JSON array.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: trendingPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1500,
        temperature: 0.3,
        priority: 'optional',
        operationType: 'trend_detection'
      });

      let trendingTopics: TrendingTopic[] = [];
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || []);
        const parsedTopics = JSON.parse(responseText);
        trendingTopics = Array.isArray(parsedTopics) ? parsedTopics.map(this.formatTrendingTopic) : [];
      } catch (parseError) {
        console.warn('⚠️ Trending topics parsing failed');
        trendingTopics = this.getDefaultTrendingTopics();
      }

      // Store trending topics
      if (trendingTopics.length > 0) {
        await supabaseClient.supabase!.from('health_trending_topics').insert(
          trendingTopics.map(topic => ({
            topic: topic.topic,
            trend_strength: topic.trend_strength,
            source: topic.source,
            related_keywords: topic.related_keywords,
            opportunity_score: topic.opportunity_score,
            content_suggestions: topic.content_suggestions,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          }))
        );
      }

      console.log(`✅ Detected ${trendingTopics.length} trending topics`);

    } catch (error) {
      console.error('❌ Trending topics detection failed:', error);
    }
  }

  /**
   * 🔍 ANALYZE COMPETITOR STRATEGIES
   */
  private async analyzeCompetitors(): Promise<void> {
    try {
      console.log('🔍 Analyzing competitor strategies...');

      // For each target competitor, analyze their recent performance
      for (const competitor of this.TARGET_COMPETITORS.slice(0, 3)) { // Limit to 3 for budget
        await this.analyzeCompetitorPerformance(competitor);
      }

      console.log(`✅ Analyzed ${Math.min(3, this.TARGET_COMPETITORS.length)} competitors`);

    } catch (error) {
      console.error('❌ Competitor analysis failed:', error);
    }
  }

  /**
   * 🎯 ANALYZE INDIVIDUAL COMPETITOR
   */
  private async analyzeCompetitorPerformance(handle: string): Promise<void> {
    try {
      // Use AI to analyze competitor strategy based on their known content patterns
      const analysisPrompt = `Analyze the content strategy of @${handle} in the health/wellness space.

      Based on their known content patterns, provide:
      1. Primary topics they cover
      2. Content formats they use (threads, single tweets, videos)
      3. Viral elements in their content
      4. Posting frequency and timing
      5. Engagement tactics they use
      6. What makes their content successful

      Return as JSON object with competitor analysis.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: analysisPrompt }
      ], {
        model: 'gpt-4o-mini', // Use cheaper model for competitor analysis
        maxTokens: 800,
        temperature: 0.3,
        priority: 'optional',
        operationType: 'competitor_analysis'
      });

      let competitorData: any = {};
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || {});
        competitorData = JSON.parse(responseText);
      } catch (parseError) {
        console.warn(`⚠️ Competitor analysis parsing failed for ${handle}`);
        return;
      }

      // Store competitor analysis
      await supabaseClient.supabase!.from('competitor_analysis').insert({
        competitor_handle: handle,
        tweet_content: 'AI Analysis Summary',
        likes_count: 0,
        retweets_count: 0,
        replies_count: 0,
        posted_at: new Date().toISOString(),
        content_category: 'strategy_analysis',
        viral_elements: competitorData.viral_elements || {},
        engagement_rate: 0,
        follower_gain_estimate: 0
      });

    } catch (error) {
      console.error(`❌ Failed to analyze competitor ${handle}:`, error);
    }
  }

  /**
   * 🧠 SYNTHESIZE INSIGHTS FROM ALL DATA SOURCES
   */
  private async synthesizeInsights(): Promise<void> {
    try {
      console.log('🧠 Synthesizing data insights...');

      // Get recent data from all sources
      const [velocityData, trendingData, competitorData] = await Promise.all([
        this.getRecentVelocityData(),
        this.getRecentTrendingData(),
        this.getRecentCompetitorData()
      ]);

      // Use AI to synthesize insights
      const synthesisPrompt = `Analyze this Twitter data and provide actionable insights for follower growth:

VELOCITY DATA: ${JSON.stringify(velocityData)}
TRENDING TOPICS: ${JSON.stringify(trendingData)}
COMPETITOR INSIGHTS: ${JSON.stringify(competitorData)}

Provide:
1. Current algorithm signals (what's working/not working)
2. Trending opportunities to capitalize on
3. Competitor strategies to adapt
4. Specific content recommendations
5. Optimal posting timing
6. Follower acquisition tactics

Return as JSON object with synthesis insights.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: synthesisPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1200,
        temperature: 0.2,
        priority: 'important',
        operationType: 'data_synthesis'
      });

      // Store synthesis insights
      let insights: any = {};
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || {});
        insights = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('⚠️ Synthesis parsing failed');
        return;
      }

      // Store actionable insights
      if (insights.content_recommendations) {
        await supabaseClient.supabase!.from('algorithm_insights').insert({
          insight_type: 'content_strategy',
          recommendation: JSON.stringify(insights.content_recommendations),
          expected_impact: 30,
          confidence_level: 0.7,
          implementation_priority: 'high',
          supporting_data: { synthesis: insights }
        });
      }

      console.log('✅ Data synthesis complete');

    } catch (error) {
      console.error('❌ Data synthesis failed:', error);
    }
  }

  /**
   * 📊 GET RECENT VELOCITY DATA
   */
  private async getRecentVelocityData(): Promise<any[]> {
    const { data } = await supabaseClient.supabase
      .from('engagement_velocity_tracking')
      .select('*')
      .gte('tracked_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // Last 6 hours
      .order('tracked_at', { ascending: false })
      .limit(20);
    
    return data || [];
  }

  /**
   * 📈 GET RECENT TRENDING DATA
   */
  private async getRecentTrendingData(): Promise<any[]> {
    const { data } = await supabaseClient.supabase
      .from('health_trending_topics')
      .select('*')
      .gte('detected_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
      .order('trend_strength', { ascending: false })
      .limit(10);
    
    return data || [];
  }

  /**
   * 🔍 GET RECENT COMPETITOR DATA
   */
  private async getRecentCompetitorData(): Promise<any[]> {
    const { data } = await supabaseClient.supabase
      .from('competitor_analysis')
      .select('*')
      .gte('analyzed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('analyzed_at', { ascending: false })
      .limit(10);
    
    return data || [];
  }

  /**
   * 🏷️ FORMAT TRENDING TOPIC
   */
  private formatTrendingTopic(rawTopic: any): TrendingTopic {
    return {
      topic: rawTopic.topic || 'Health Topic',
      trend_strength: rawTopic.trend_strength || 0.5,
      source: 'ai_analysis',
      related_keywords: rawTopic.related_keywords || [],
      opportunity_score: rawTopic.opportunity_score || 0.5,
      content_suggestions: rawTopic.content_suggestions || []
    };
  }

  /**
   * 📚 DEFAULT TRENDING TOPICS
   */
  private getDefaultTrendingTopics(): TrendingTopic[] {
    return [
      {
        topic: 'Intermittent Fasting Benefits',
        trend_strength: 0.8,
        source: 'default',
        related_keywords: ['fasting', '16:8', 'autophagy', 'metabolism'],
        opportunity_score: 0.9,
        content_suggestions: ['Fasting myths debunked', 'Optimal fasting windows']
      },
      {
        topic: 'Seed Oil Controversy',
        trend_strength: 0.7,
        source: 'default',
        related_keywords: ['seed oils', 'vegetable oil', 'inflammation', 'omega-6'],
        opportunity_score: 0.8,
        content_suggestions: ['Hidden seed oils in foods', 'Healthy oil alternatives']
      }
    ];
  }

  /**
   * 📊 GET PIPELINE STATUS
   */
  getStatus(): {
    isRunning: boolean;
    intervals: number;
    lastUpdate: Date;
    dataPoints: {
      velocity_tracking: number;
      trending_topics: number;
      competitor_analysis: number;
    };
  } {
    return {
      isRunning: this.isRunning,
      intervals: this.intervals.length,
      lastUpdate: new Date(),
      dataPoints: {
        velocity_tracking: 0, // Would be populated in real implementation
        trending_topics: 0,
        competitor_analysis: 0
      }
    };
  }
}