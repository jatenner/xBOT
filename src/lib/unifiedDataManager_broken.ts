/**
 * 🗄️ UNIFIED DATA MANAGER
 * Single source of truth for all AI-driven data operations
 * Eliminates duplication and ensures all systems work together
 * 
 * ALL DATA FLOWS THROUGH THIS MANAGER:
 * - Post performance tracking
 * - AI decision logging
 * - Metrics collection
 * - Follower attribution
 * - Content analysis
 */

import { supabase } from './supabaseClients';
import { getSmartCacheManager } from './smartCacheManager';

interface UnifiedPost {
  id?: number;
  postId: string;
  threadId?: string;
  postIndex?: number;
  content: string;
  postType: 'single' | 'thread_root' | 'thread_reply';
  contentLength: number;
  formatType?: 'educational' | 'myth_busting' | 'personal' | 'data_driven' | 'controversial';
  
  // Timing
  postedAt: Date;
  hourPosted: number;
  minutePosted: number;
  dayOfWeek: number;
  
  // Metrics
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  profileClicks: number;
  linkClicks: number;
  bookmarks: number;
  shares: number;
  
  // Follower impact
  followersBefore: number;
  followersAfter1h?: number;
  followersAfter24h?: number;
  followersAfter7d?: number;
  followersAttributed: number;
  followerQualityScore?: number;
  
  // AI data
  aiGenerated: boolean;
  aiStrategy?: string;
  aiConfidence?: number;
  predictedPerformance?: number;
  actualVsPredicted?: number;
  
  // Content analysis
  sentimentScore?: number;
  viralScore?: number;
  educationalValue?: number;
  actionabilityScore?: number;
  controversyLevel?: number;
  emotionalTriggers?: string[];
  authoritySignals?: string[];
  viralElements?: string[];
  
  // Context
  isHoliday?: boolean;
  isWeekend?: boolean;
  seasonality?: string;
  weatherImpact?: number;
  trendingTopics?: string[];
  newsEvents?: string[];
  
  // Competitive
  competitorActivity?: number;
  marketSaturation?: number;
  viralContentNearby?: number;
  timingAdvantage?: number;
  
  // Engagement patterns
  engagementVelocity?: number;
  peakEngagementTime?: number;
  engagementDecayRate?: number;
  commentQuality?: number;
  
  // Metadata
  dataQuality?: number;
  lastUpdated?: Date;
  createdAt?: Date;
}

interface AIDecision {
  id?: number;
  decisionTimestamp: Date;
  decisionType: 'posting_frequency' | 'timing' | 'content_type' | 'strategy' | 'competitive' | 'api_usage' | 'learning_update' | 'intelligence_update' | 'outcome_update' | 'system_update';
  recommendation: any;
  confidence: number;
  reasoning: string;
  dataPointsUsed: number;
  contextData?: any;
  competitiveData?: any;
  performanceData?: any;
  implemented?: boolean;
  implementationTimestamp?: Date;
  outcomeData?: any;
  successScore?: number;
  feedbackCollected?: boolean;
  improvementSuggestions?: any[];
}

interface UnifiedMetrics {
  id?: number;
  metricTimestamp: Date;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
  accountEngagementRate: number;
  dailyFollowersGained: number;
  dailyPostsCount: number;
  dailyImpressions: number;
  dailyProfileVisits: number;
  dailyAiDecisions: number;
  avgPostPerformance: number;
  bestPostPerformance: number;
  followerGrowthRate: number;
  contentQualityScore: number;
  aiDecisionAccuracy: number;
  aiPredictionAccuracy: number;
  strategyOptimizationScore: number;
  marketPosition: number;
  competitiveAdvantage: number;
  dataCompleteness: number;
  metricDate: Date;
}

export class UnifiedDataManager {
  private static instance: UnifiedDataManager;
  private cacheManager = getSmartCacheManager();

  private constructor() {}

  public static getInstance(): UnifiedDataManager {
    if (!UnifiedDataManager.instance) {
      UnifiedDataManager.instance = new UnifiedDataManager();
    }
    return UnifiedDataManager.instance;
  }

  /**
   * 📝 STORE POST DATA (Single source of truth with deduplication)
   */
  public async storePost(postData: UnifiedPost): Promise<void> {
    console.log(`📝 UNIFIED_DATA: Storing post ${postData.postId} with comprehensive data and duplicate checking`);

    try {
      // Check for duplicates before storing
      const duplicateCheck = await this.checkForDuplicates(postData.content);
      if (duplicateCheck.isDuplicate) {
        console.warn(`⚠️ DUPLICATE_DETECTED: Content similar to post ${duplicateCheck.similarPostId} from ${duplicateCheck.hoursAgo?.toFixed(1)} hours ago`);
        throw new Error(`Duplicate content detected: similar to post ${duplicateCheck.similarPostId}`);
      }
      // Calculate derived fields
      const now = new Date();
      const enrichedData = {
        ...postData,
        hourPosted: postData.postedAt.getHours(),
        minutePosted: postData.postedAt.getMinutes(),
        dayOfWeek: postData.postedAt.getDay(),
        isWeekend: postData.postedAt.getDay() === 0 || postData.postedAt.getDay() === 6,
        contentLength: postData.content.length,
        lastUpdated: now,
        createdAt: postData.createdAt || now
      };

      // Store in database using Supabase
      const { error } = await supabase.from('unified_posts').upsert({
        post_id: enrichedData.postId,
        thread_id: enrichedData.threadId,
        post_index: enrichedData.postIndex || 0,
        content: enrichedData.content,
        post_type: enrichedData.postType,
        content_length: enrichedData.contentLength,
        format_type: enrichedData.formatType || 'educational',
        posted_at: enrichedData.postedAt.toISOString(),
        hour_posted: enrichedData.hourPosted,
        minute_posted: enrichedData.minutePosted,
        day_of_week: enrichedData.dayOfWeek,
        likes: enrichedData.likes,
        retweets: enrichedData.retweets,
        replies: enrichedData.replies,
        impressions: enrichedData.impressions,
        profile_clicks: enrichedData.profileClicks || 0,
        link_clicks: enrichedData.linkClicks || 0,
        bookmarks: enrichedData.bookmarks || 0,
        shares: enrichedData.shares || 0,
        followers_before: enrichedData.followersBefore,
        followers_after_1h: enrichedData.followersAfter1h || 0,
        followers_after_24h: enrichedData.followersAfter24h || 0,
        followers_after_7d: enrichedData.followersAfter7d || 0,
        followers_attributed: enrichedData.followersAttributed,
        follower_quality_score: enrichedData.followerQualityScore || 0,
        ai_generated: enrichedData.aiGenerated,
        ai_strategy: enrichedData.aiStrategy,
        ai_confidence: enrichedData.aiConfidence || 0,
        predicted_performance: enrichedData.predictedPerformance || 0,
        actual_vs_predicted: enrichedData.actualVsPredicted || 0,
        sentiment_score: enrichedData.sentimentScore || 0,
        viral_score: enrichedData.viralScore || 0,
        educational_value: enrichedData.educationalValue || 0,
        actionability_score: enrichedData.actionabilityScore || 0,
        controversy_level: enrichedData.controversyLevel || 0,
        emotional_triggers: enrichedData.emotionalTriggers || [],
        authority_signals: enrichedData.authoritySignals || [],
        viral_elements: enrichedData.viralElements || [],
        is_holiday: enrichedData.isHoliday || false,
        is_weekend: enrichedData.isWeekend,
        seasonality: enrichedData.seasonality || 'normal',
        weather_impact: enrichedData.weatherImpact || 1.0,
        trending_topics: enrichedData.trendingTopics || [],
        news_events: enrichedData.newsEvents || [],
        competitor_activity: enrichedData.competitorActivity || 0.5,
        market_saturation: enrichedData.marketSaturation || 0.5,
        viral_content_nearby: enrichedData.viralContentNearby || 0,
        timing_advantage: enrichedData.timingAdvantage || 0,
        engagement_velocity: enrichedData.engagementVelocity || 0,
        peak_engagement_time: enrichedData.peakEngagementTime || 0,
        engagement_decay_rate: enrichedData.engagementDecayRate || 0,
        comment_quality: enrichedData.commentQuality || 0,
        data_quality: enrichedData.dataQuality || 1.0,
        last_updated: enrichedData.lastUpdated?.toISOString(),
        created_at: enrichedData.createdAt?.toISOString()
      });

      if (error) throw error;

      // Cache recent posts for quick access
      await this.cacheManager.set(`recent_post:${postData.postId}`, enrichedData, 'recent_tweets');

      console.log(`✅ UNIFIED_DATA: Post ${postData.postId} stored successfully`);

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to store post:', error.message);
      throw error;
    }
  }

  /**
   * 🤖 STORE AI DECISION (All AI decisions tracked)
   */
  public async storeAIDecision(decision: AIDecision): Promise<number> {
    console.log(`🤖 UNIFIED_DATA: Storing AI decision - ${decision.decisionType}`);

    try {
      const result = await this.databaseManager.executeQuery(`
        INSERT INTO unified_ai_intelligence (
          decision_timestamp, decision_type, recommendation, confidence, reasoning,
          data_points_used, context_data, competitive_data, performance_data,
          implemented, implementation_timestamp, outcome_data, success_score,
          feedback_collected, improvement_suggestions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `, [
        decision.decisionTimestamp,
        decision.decisionType,
        JSON.stringify(decision.recommendation),
        decision.confidence,
        decision.reasoning,
        decision.dataPointsUsed,
        JSON.stringify(decision.contextData || {}),
        JSON.stringify(decision.competitiveData || {}),
        JSON.stringify(decision.performanceData || {}),
        decision.implemented || false,
        decision.implementationTimestamp,
        JSON.stringify(decision.outcomeData || {}),
        decision.successScore || 0,
        decision.feedbackCollected || false,
        JSON.stringify(decision.improvementSuggestions || [])
      ]);

      const decisionId = result.rows[0].id;
      console.log(`✅ UNIFIED_DATA: AI decision stored with ID ${decisionId}`);
      return decisionId;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to store AI decision:', error.message);
      throw error;
    }
  }

  /**
   * 📊 UPDATE METRICS (Daily metrics tracking)
   */
  public async updateMetrics(metrics: Partial<UnifiedMetrics>): Promise<void> {
    console.log('📊 UNIFIED_DATA: Updating unified metrics');

    try {
      await this.databaseManager.executeQuery(`
        INSERT INTO unified_metrics (
          metric_timestamp, metric_date, total_followers, total_following, total_posts,
          account_engagement_rate, daily_followers_gained, daily_posts_count,
          daily_impressions, daily_profile_visits, daily_ai_decisions,
          avg_post_performance, best_post_performance, follower_growth_rate,
          content_quality_score, ai_decision_accuracy, ai_prediction_accuracy,
          strategy_optimization_score, market_position, competitive_advantage, data_completeness
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (metric_date) DO UPDATE SET
          total_followers = EXCLUDED.total_followers,
          daily_followers_gained = EXCLUDED.daily_followers_gained,
          daily_posts_count = EXCLUDED.daily_posts_count,
          avg_post_performance = EXCLUDED.avg_post_performance,
          ai_decision_accuracy = EXCLUDED.ai_decision_accuracy,
          data_completeness = EXCLUDED.data_completeness
      `, [
        metrics.metricTimestamp || new Date(),
        metrics.metricDate || new Date(),
        metrics.totalFollowers || 0,
        metrics.totalFollowing || 0,
        metrics.totalPosts || 0,
        metrics.accountEngagementRate || 0,
        metrics.dailyFollowersGained || 0,
        metrics.dailyPostsCount || 0,
        metrics.dailyImpressions || 0,
        metrics.dailyProfileVisits || 0,
        metrics.dailyAiDecisions || 0,
        metrics.avgPostPerformance || 0,
        metrics.bestPostPerformance || 0,
        metrics.followerGrowthRate || 0,
        metrics.contentQualityScore || 0,
        metrics.aiDecisionAccuracy || 0,
        metrics.aiPredictionAccuracy || 0,
        metrics.strategyOptimizationScore || 0,
        metrics.marketPosition || 0,
        metrics.competitiveAdvantage || 0,
        metrics.dataCompleteness || 1.0
      ]);

      console.log('✅ UNIFIED_DATA: Metrics updated successfully');

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to update metrics:', error.message);
      throw error;
    }
  }

  /**
   * 📈 GET POST PERFORMANCE (Optimized queries)
   */
  public async getPostPerformance(daysBack: number = 30): Promise<UnifiedPost[]> {
    console.log(`📈 UNIFIED_DATA: Getting post performance for last ${daysBack} days`);

    try {
      // Check cache first
      const cacheKey = `post_performance:${daysBack}days`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        console.log('💾 UNIFIED_DATA: Returning cached post performance');
        return cached as UnifiedPost[];
      }

      const result = await this.databaseManager.executeQuery(`
        SELECT * FROM unified_posts 
        WHERE posted_at >= NOW() - INTERVAL '${daysBack} days'
        ORDER BY followers_attributed DESC, posted_at DESC
      `);

      const posts = result.rows.map(row => this.mapRowToPost(row));

      // Cache the results
      await this.cacheManager.set(cacheKey, posts, 'engagement_metrics');

      console.log(`✅ UNIFIED_DATA: Retrieved ${posts.length} posts performance data`);
      return posts;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get post performance:', error.message);
      return [];
    }
  }

  /**
   * 🤖 GET AI DECISIONS (Recent AI decision history)
   */
  public async getAIDecisions(daysBack: number = 7): Promise<AIDecision[]> {
    console.log(`🤖 UNIFIED_DATA: Getting AI decisions for last ${daysBack} days`);

    try {
      const result = await this.databaseManager.executeQuery(`
        SELECT * FROM unified_ai_intelligence 
        WHERE decision_timestamp >= NOW() - INTERVAL '${daysBack} days'
        ORDER BY decision_timestamp DESC
      `);

      const decisions = result.rows.map(row => this.mapRowToAIDecision(row));

      console.log(`✅ UNIFIED_DATA: Retrieved ${decisions.length} AI decisions`);
      return decisions;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get AI decisions:', error.message);
      return [];
    }
  }

  /**
   * ⚡ GET OPTIMAL POSTING FREQUENCY (AI-driven)
   */
  public async getOptimalPostingFrequency(): Promise<{
    optimalFrequency: number;
    strategy: string;
    reasoning: string;
    confidence: number;
    marketOpportunity: number;
    competitiveGap: number;
  }> {
    console.log('⚡ UNIFIED_DATA: Calculating AI-driven optimal posting frequency');

    try {
      // Check cache first
      const cached = await this.cacheManager.get('optimal_frequency');
      if (cached && typeof cached === 'object') {
        console.log('💾 UNIFIED_DATA: Returning cached optimal frequency');
        return cached as any;
      }

      const result = await this.databaseManager.executeQuery(`
        SELECT calculate_ai_posting_frequency() as frequency_data
      `);

      const frequencyData = result.rows[0].frequency_data;

      // Cache for 1 hour
      await this.cacheManager.set('optimal_frequency', frequencyData, 'growth_insights');

      console.log(`✅ UNIFIED_DATA: Optimal frequency - ${frequencyData.optimal_frequency} posts/day`);
      return frequencyData;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get optimal frequency:', error.message);
      return {
        optimalFrequency: 8,
        strategy: 'fallback',
        reasoning: 'Using fallback frequency due to data unavailability',
        confidence: 0.5,
        marketOpportunity: 0.5,
        competitiveGap: 0.5
      };
    }
  }

  /**
   * ⏰ GET OPTIMAL POSTING TIMES (Data-driven)
   */
  public async getOptimalPostingTimes(): Promise<Array<{
    hour: number;
    dayOfWeek: number;
    avgFollowers: number;
    avgEngagement: number;
    confidence: number;
    sampleSize: number;
  }>> {
    console.log('⏰ UNIFIED_DATA: Getting data-driven optimal posting times');

    try {
      const cached = await this.cacheManager.get('optimal_times');
      if (cached && typeof cached === 'object' && (cached as any).optimal_times) {
        return (cached as any).optimal_times;
      }

      const result = await this.databaseManager.executeQuery(`
        SELECT get_optimal_posting_times() as times_data
      `);

      const timesData = result.rows[0].times_data;

      // Cache for 6 hours
      await this.cacheManager.set('optimal_times', timesData, 'posting_schedule');

      console.log(`✅ UNIFIED_DATA: Retrieved ${timesData.optimal_times.length} optimal time slots`);
      return timesData.optimal_times;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get optimal times:', error.message);
      return [];
    }
  }

  /**
   * 📊 GET UNIFIED DASHBOARD DATA
   */
  public async getDashboardData(): Promise<{
    todayMetrics: any;
    weeklyTrends: any[];
    topPerformingPosts: UnifiedPost[];
    aiEffectiveness: any;
    recommendations: string[];
  }> {
    console.log('📊 UNIFIED_DATA: Generating comprehensive dashboard data');

    try {
      // Get today's metrics
      const todayResult = await this.databaseManager.executeQuery(`
        SELECT * FROM unified_metrics WHERE metric_date = CURRENT_DATE
      `);

      // Get weekly trends
      const trendsResult = await this.databaseManager.executeQuery(`
        SELECT * FROM unified_performance_dashboard 
        WHERE post_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY post_date DESC
      `);

      // Get top performing posts
      const topPosts = await this.getPostPerformance(7);

      // Get AI effectiveness
      const aiResult = await this.databaseManager.executeQuery(`
        SELECT * FROM ai_intelligence_effectiveness
      `);

      // Generate recommendations
      const recommendations = await this.generateRecommendations();

      return {
        todayMetrics: todayResult.rows[0] || {},
        weeklyTrends: trendsResult.rows,
        topPerformingPosts: topPosts.slice(0, 5),
        aiEffectiveness: aiResult.rows,
        recommendations
      };

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get dashboard data:', error.message);
      return {
        todayMetrics: {},
        weeklyTrends: [],
        topPerformingPosts: [],
        aiEffectiveness: {},
        recommendations: ['Data collection in progress...']
      };
    }
  }

  /**
   * 💡 GENERATE RECOMMENDATIONS
   */
  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Get recent performance data
      const recentPosts = await this.getPostPerformance(7);
      
      if (recentPosts.length > 0) {
        const avgFollowers = recentPosts.reduce((sum, post) => sum + post.followersAttributed, 0) / recentPosts.length;
        
        if (avgFollowers > 2) {
          recommendations.push('🚀 Excellent performance! Consider increasing posting frequency');
        } else if (avgFollowers < 0.5) {
          recommendations.push('🎯 Focus on content quality - try more educational threads');
        } else {
          recommendations.push('📈 Steady growth - maintain current strategy with slight optimizations');
        }
      }

      recommendations.push('🤖 AI learning system active - performance will improve with more data');

    } catch (error) {
      recommendations.push('📊 Collecting data for intelligent recommendations...');
    }

    return recommendations;
  }

  // Helper methods for data mapping
  private mapRowToPost(row: any): UnifiedPost {
    return {
      id: row.id,
      postId: row.post_id,
      threadId: row.thread_id,
      postIndex: row.post_index,
      content: row.content,
      postType: row.post_type,
      contentLength: row.content_length,
      formatType: row.format_type,
      postedAt: new Date(row.posted_at),
      hourPosted: row.hour_posted,
      minutePosted: row.minute_posted,
      dayOfWeek: row.day_of_week,
      likes: row.likes || 0,
      retweets: row.retweets || 0,
      replies: row.replies || 0,
      impressions: row.impressions || 0,
      profileClicks: row.profile_clicks || 0,
      linkClicks: row.link_clicks || 0,
      bookmarks: row.bookmarks || 0,
      shares: row.shares || 0,
      followersBefore: row.followers_before || 0,
      followersAfter1h: row.followers_after_1h || 0,
      followersAfter24h: row.followers_after_24h || 0,
      followersAfter7d: row.followers_after_7d || 0,
      followersAttributed: parseFloat(row.followers_attributed) || 0,
      followerQualityScore: parseFloat(row.follower_quality_score) || 0,
      aiGenerated: row.ai_generated || true,
      aiStrategy: row.ai_strategy,
      aiConfidence: parseFloat(row.ai_confidence) || 0,
      predictedPerformance: parseFloat(row.predicted_performance) || 0,
      actualVsPredicted: parseFloat(row.actual_vs_predicted) || 0,
      sentimentScore: parseFloat(row.sentiment_score) || 0,
      viralScore: parseFloat(row.viral_score) || 0,
      educationalValue: parseFloat(row.educational_value) || 0,
      actionabilityScore: parseFloat(row.actionability_score) || 0,
      controversyLevel: parseFloat(row.controversy_level) || 0,
      emotionalTriggers: this.parseJsonField(row.emotional_triggers),
      authoritySignals: this.parseJsonField(row.authority_signals),
      viralElements: this.parseJsonField(row.viral_elements),
      isHoliday: row.is_holiday || false,
      isWeekend: row.is_weekend || false,
      seasonality: row.seasonality || 'normal',
      weatherImpact: parseFloat(row.weather_impact) || 1.0,
      trendingTopics: this.parseJsonField(row.trending_topics),
      newsEvents: this.parseJsonField(row.news_events),
      competitorActivity: parseFloat(row.competitor_activity) || 0.5,
      marketSaturation: parseFloat(row.market_saturation) || 0.5,
      viralContentNearby: row.viral_content_nearby || 0,
      timingAdvantage: parseFloat(row.timing_advantage) || 0,
      engagementVelocity: parseFloat(row.engagement_velocity) || 0,
      peakEngagementTime: row.peak_engagement_time || 0,
      engagementDecayRate: parseFloat(row.engagement_decay_rate) || 0,
      commentQuality: parseFloat(row.comment_quality) || 0,
      dataQuality: parseFloat(row.data_quality) || 1.0,
      lastUpdated: new Date(row.last_updated),
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToAIDecision(row: any): AIDecision {
    return {
      id: row.id,
      decisionTimestamp: new Date(row.decision_timestamp),
      decisionType: row.decision_type,
      recommendation: this.parseJsonField(row.recommendation),
      confidence: parseFloat(row.confidence),
      reasoning: row.reasoning,
      dataPointsUsed: row.data_points_used || 0,
      contextData: this.parseJsonField(row.context_data),
      competitiveData: this.parseJsonField(row.competitive_data),
      performanceData: this.parseJsonField(row.performance_data),
      implemented: row.implemented || false,
      implementationTimestamp: row.implementation_timestamp ? new Date(row.implementation_timestamp) : undefined,
      outcomeData: this.parseJsonField(row.outcome_data),
      successScore: parseFloat(row.success_score) || 0,
      feedbackCollected: row.feedback_collected || false,
      improvementSuggestions: this.parseJsonField(row.improvement_suggestions)
    };
  }

  private parseJsonField(field: any): any {
    if (!field) return null;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    }
    return field;
  }

  /**
   * 🔍 CHECK FOR DUPLICATES
   */
  private async checkForDuplicates(content: string): Promise<{
    isDuplicate: boolean;
    similarPostId?: string;
    hoursAgo?: number;
    similarity?: number;
  }> {
    try {
      // Use Supabase function to check for duplicates
      const { data, error } = await supabase.rpc('check_content_duplicate', {
        content_text: content,
        hours_back: 24
      });

      if (error) {
        console.error('❌ Duplicate check failed:', error.message);
        return { isDuplicate: false };
      }

      const result = data?.[0];
      if (result && result.is_duplicate) {
        return {
          isDuplicate: true,
          similarPostId: result.similar_post_id,
          hoursAgo: result.hours_ago,
          similarity: 1.0 // Exact hash match
        };
      }

      return { isDuplicate: false };

    } catch (error: any) {
      console.error('❌ Duplicate check error:', error.message);
      return { isDuplicate: false }; // Fail open to avoid blocking posts
    }
  }

  /**
   * 📊 GET DUPLICATE PREVENTION STATS
   */
  public async getDuplicatePreventionStats(): Promise<{
    totalPosts: number;
    uniqueContentHashes: number;
    potentialDuplicates: number;
    uniquenessPercentage: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('duplicate_prevention_stats')
        .select('*')
        .single();

      if (error) throw error;

      return {
        totalPosts: data.total_posts || 0,
        uniqueContentHashes: data.unique_content_hashes || 0,
        potentialDuplicates: data.potential_duplicates || 0,
        uniquenessPercentage: data.uniqueness_percentage || 100
      };

    } catch (error: any) {
      console.error('❌ Failed to get duplicate prevention stats:', error.message);
      return {
        totalPosts: 0,
        uniqueContentHashes: 0,
        potentialDuplicates: 0,
        uniquenessPercentage: 100
      };
    }
  }

  /**
   * 🔄 GET DATA STATUS
   */
  public async getDataStatus(): Promise<{
    totalPosts: number;
    totalDecisions: number;
    dataQuality: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
    lastUpdate: Date;
  }> {
    try {
      const postsResult = await this.databaseManager.executeQuery(`
        SELECT COUNT(*) as total FROM unified_posts
      `);
      
      const decisionsResult = await this.databaseManager.executeQuery(`
        SELECT COUNT(*) as total FROM unified_ai_intelligence
      `);

      const totalPosts = parseInt(postsResult.rows[0].total);
      const totalDecisions = parseInt(decisionsResult.rows[0].total);
      
      let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (totalPosts >= 50 && totalDecisions >= 20) systemHealth = 'excellent';
      else if (totalPosts >= 20 && totalDecisions >= 10) systemHealth = 'good';
      else if (totalPosts >= 5 && totalDecisions >= 3) systemHealth = 'fair';

      return {
        totalPosts,
        totalDecisions,
        dataQuality: Math.min(1.0, totalPosts / 50),
        systemHealth,
        lastUpdate: new Date()
      };

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get data status:', error.message);
      return {
        totalPosts: 0,
        totalDecisions: 0,
        dataQuality: 0,
        systemHealth: 'poor',
        lastUpdate: new Date()
      };
    }
  }
}

export const getUnifiedDataManager = () => UnifiedDataManager.getInstance();
