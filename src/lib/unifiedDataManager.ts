/**
 * 🗄️ UNIFIED DATA MANAGER (Fixed Version)
 * Single source of truth for all data operations
 * 
 * Integrates:
 * - Database operations (Supabase)
 * - Smart caching
 * - Unified schema access
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
  formatType?: string;
  postedAt: Date;
  hourPosted: number;
  minutePosted: number;
  dayOfWeek: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  profileClicks: number;
  linkClicks: number;
  bookmarks: number;
  shares: number;
  followersBefore: number;
  followersAttributed: number;
  aiGenerated: boolean;
  aiStrategy?: string;
  aiConfidence?: number;
  viralScore?: number;
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
}

interface UnifiedMetrics {
  id?: number;
  metricTimestamp: Date;
  metricDate: Date;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
  dailyFollowerGrowth: number;
  dailyEngagement: number;
  weeklyViralScore: number;
  monthlyGrowthRate: number;
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
        contentLength: postData.content.length,
        createdAt: now,
        lastUpdated: now
      };

      // Store in Supabase
      const { error } = await supabase.from('unified_posts').upsert({
        post_id: enrichedData.postId,
        thread_id: enrichedData.threadId,
        post_index: enrichedData.postIndex,
        content: enrichedData.content,
        post_type: enrichedData.postType,
        content_length: enrichedData.contentLength,
        format_type: enrichedData.formatType || 'default',
        posted_at: enrichedData.postedAt.toISOString(),
        hour_posted: enrichedData.hourPosted,
        minute_posted: enrichedData.minutePosted,
        day_of_week: enrichedData.dayOfWeek,
        likes: enrichedData.likes,
        retweets: enrichedData.retweets,
        replies: enrichedData.replies,
        impressions: enrichedData.impressions,
        profile_clicks: enrichedData.profileClicks,
        link_clicks: enrichedData.linkClicks,
        bookmarks: enrichedData.bookmarks,
        shares: enrichedData.shares,
        followers_before: enrichedData.followersBefore,
        followers_attributed: enrichedData.followersAttributed,
        ai_generated: enrichedData.aiGenerated,
        ai_strategy: enrichedData.aiStrategy,
        ai_confidence: enrichedData.aiConfidence,
        viral_score: enrichedData.viralScore || 0,
        created_at: enrichedData.createdAt?.toISOString(),
        last_updated: enrichedData.lastUpdated?.toISOString()
      });

      if (error) throw error;

      // Cache the post
      await this.cacheManager.set(`post:${postData.postId}`, enrichedData, 'recent_tweets'); // 1 hour cache

      console.log(`✅ UNIFIED_DATA: Post ${postData.postId} stored successfully`);

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to store post:', error.message);
      throw error;
    }
  }

  /**
   * 🤖 STORE AI DECISION
   */
  public async storeAIDecision(decisionData: AIDecision): Promise<number> {
    console.log(`🤖 UNIFIED_DATA: Storing AI decision ${decisionData.decisionType}`);

    try {
      const { data, error } = await supabase.from('unified_ai_intelligence').insert({
        decision_timestamp: decisionData.decisionTimestamp.toISOString(),
        decision_type: decisionData.decisionType,
        recommendation: JSON.stringify(decisionData.recommendation),
        confidence: decisionData.confidence,
        reasoning: decisionData.reasoning,
        data_points_used: decisionData.dataPointsUsed,
        context_data: JSON.stringify(decisionData.contextData || {}),
        competitive_data: JSON.stringify(decisionData.competitiveData || {}),
        performance_data: JSON.stringify(decisionData.performanceData || {}),
        implemented: decisionData.implemented || false,
        implementation_timestamp: decisionData.implementationTimestamp?.toISOString(),
        outcome_data: JSON.stringify(decisionData.outcomeData || {}),
        success_score: decisionData.successScore || 0.5
      }).select('id').single();

      if (error) throw error;

      console.log(`✅ UNIFIED_DATA: AI decision stored with ID ${data.id}`);
      return data.id;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to store AI decision:', error.message);
      throw error;
    }
  }

  /**
   * 📊 UPDATE METRICS
   */
  public async updateMetrics(metricsData: UnifiedMetrics): Promise<void> {
    console.log(`📊 UNIFIED_DATA: Updating metrics for ${metricsData.metricDate.toDateString()}`);

    try {
      const { error } = await supabase.from('unified_metrics').upsert({
        metric_timestamp: metricsData.metricTimestamp.toISOString(),
        metric_date: metricsData.metricDate.toISOString().split('T')[0],
        total_followers: metricsData.totalFollowers,
        total_following: metricsData.totalFollowing,
        total_posts: metricsData.totalPosts,
        daily_follower_growth: metricsData.dailyFollowerGrowth,
        daily_engagement: metricsData.dailyEngagement,
        weekly_viral_score: metricsData.weeklyViralScore,
        monthly_growth_rate: metricsData.monthlyGrowthRate
      });

      if (error) throw error;

      console.log(`✅ UNIFIED_DATA: Metrics updated successfully`);

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to update metrics:', error.message);
      throw error;
    }
  }

  /**
   * 📈 GET POST PERFORMANCE
   */
  public async getPostPerformance(daysBack: number): Promise<UnifiedPost[]> {
    const cacheKey = `posts:${daysBack}d`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (Array.isArray(cached)) {
        return cached.map(post => this.convertDatabaseToPost(post));
      }

      // Query database
      const { data: posts, error } = await supabase.from('unified_posts')
        .select('*')
        .gte('posted_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('followers_attributed', { ascending: false })
        .order('posted_at', { ascending: false });

      if (error) throw error;

      const convertedPosts = posts.map(post => this.convertDatabaseToPost(post));

      // Cache for 30 minutes
      await this.cacheManager.set(cacheKey, convertedPosts, 'recent_tweets');

      return convertedPosts;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get post performance:', error.message);
      return [];
    }
  }

  /**
   * 🧠 GET AI DECISIONS
   */
  public async getAIDecisions(daysBack: number): Promise<AIDecision[]> {
    try {
      const { data: decisions, error } = await supabase.from('unified_ai_intelligence')
        .select('*')
        .gte('decision_timestamp', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('decision_timestamp', { ascending: false });

      if (error) throw error;

      return decisions.map(d => this.convertDatabaseToDecision(d));

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get AI decisions:', error.message);
      return [];
    }
  }

  /**
   * ⚡ GET OPTIMAL POSTING FREQUENCY
   */
  public async getOptimalPostingFrequency(): Promise<{ 
    optimalFrequency: number; 
    strategy: string; 
    confidence: number 
  }> {
    const cacheKey = 'optimal_frequency';
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (typeof cached === 'object' && cached !== null) {
        return cached as any;
      }

      // Use RPC function if available, otherwise calculate
      try {
        const { data: frequencyData, error: rpcError } = await supabase.rpc('calculate_ai_posting_frequency');
        if (!rpcError && frequencyData) {
          const result = {
            optimalFrequency: frequencyData.optimal_frequency || 6,
            strategy: frequencyData.strategy || 'steady',
            confidence: frequencyData.confidence || 0.7
          };
          
          await this.cacheManager.set(cacheKey, result, 'growth_insights'); // 1 hour cache
          return result;
        }
      } catch (rpcError) {
        console.warn('RPC function not available, calculating manually');
      }

      // Manual calculation fallback
      const posts = await this.getPostPerformance(7);
      const avgDaily = posts.length / 7;
      const avgFollowerGain = posts.reduce((sum, p) => sum + p.followersAttributed, 0) / Math.max(posts.length, 1);
      
      let optimalFrequency = Math.max(3, Math.min(20, avgDaily * 1.2));
      if (avgFollowerGain > 2) optimalFrequency *= 1.3; // Increase if successful
      
      const result = {
        optimalFrequency: Math.round(optimalFrequency),
        strategy: avgFollowerGain > 1 ? 'aggressive' : 'steady',
        confidence: Math.min(1, posts.length / 10)
      };

      await this.cacheManager.set(cacheKey, result, 'growth_insights');
      return result;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get optimal frequency:', error.message);
      return { optimalFrequency: 6, strategy: 'steady', confidence: 0.5 };
    }
  }

  /**
   * ⏰ GET OPTIMAL POSTING TIMES
   */
  public async getOptimalPostingTimes(): Promise<number[]> {
    const cacheKey = 'optimal_times';
    
    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (Array.isArray(cached)) {
        return cached;
      }

      // Try RPC function first
      try {
        const { data: timesData, error: rpcError } = await supabase.rpc('get_optimal_posting_times');
        if (!rpcError && Array.isArray(timesData)) {
          await this.cacheManager.set(cacheKey, timesData, 'posting_schedule');
          return timesData;
        }
      } catch (rpcError) {
        console.warn('RPC function not available, using defaults');
      }

      // Default optimal times for health content
      const defaultTimes = [7, 12, 18, 21]; // 7am, 12pm, 6pm, 9pm
      await this.cacheManager.set(cacheKey, defaultTimes, 'posting_schedule');
      return defaultTimes;

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get optimal times:', error.message);
      return [7, 12, 18, 21];
    }
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
   * 📊 GET DATA STATUS
   */
  public async getDataStatus(): Promise<{
    totalPosts: number;
    totalDecisions: number;
    dataQuality: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  }> {
    try {
      const posts = await this.getPostPerformance(30);
      const decisions = await this.getAIDecisions(7);
      
      const totalPosts = posts.length;
      const totalDecisions = decisions.length;
      
      // Calculate data quality score
      const recentPosts = posts.filter(p => 
        (Date.now() - new Date(p.postedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
      );
      const dataQuality = Math.min(1, (recentPosts.length + decisions.length) / 20);
      
      let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (dataQuality > 0.8) systemHealth = 'excellent';
      else if (dataQuality > 0.6) systemHealth = 'good';
      else if (dataQuality > 0.3) systemHealth = 'fair';
      
      return {
        totalPosts,
        totalDecisions,
        dataQuality,
        systemHealth
      };

    } catch (error: any) {
      console.error('❌ UNIFIED_DATA: Failed to get data status:', error.message);
      return {
        totalPosts: 0,
        totalDecisions: 0,
        dataQuality: 0,
        systemHealth: 'poor'
      };
    }
  }

  // Helper methods
  private convertDatabaseToPost(dbPost: any): UnifiedPost {
    return {
      id: dbPost.id,
      postId: dbPost.post_id,
      threadId: dbPost.thread_id,
      postIndex: dbPost.post_index,
      content: dbPost.content,
      postType: dbPost.post_type,
      contentLength: dbPost.content_length,
      formatType: dbPost.format_type,
      postedAt: new Date(dbPost.posted_at),
      hourPosted: dbPost.hour_posted,
      minutePosted: dbPost.minute_posted,
      dayOfWeek: dbPost.day_of_week,
      likes: dbPost.likes,
      retweets: dbPost.retweets,
      replies: dbPost.replies,
      impressions: dbPost.impressions,
      profileClicks: dbPost.profile_clicks,
      linkClicks: dbPost.link_clicks,
      bookmarks: dbPost.bookmarks,
      shares: dbPost.shares,
      followersBefore: dbPost.followers_before,
      followersAttributed: dbPost.followers_attributed,
      aiGenerated: dbPost.ai_generated,
      aiStrategy: dbPost.ai_strategy,
      aiConfidence: dbPost.ai_confidence,
      viralScore: dbPost.viral_score,
      lastUpdated: dbPost.last_updated ? new Date(dbPost.last_updated) : undefined,
      createdAt: dbPost.created_at ? new Date(dbPost.created_at) : undefined
    };
  }

  private convertDatabaseToDecision(dbDecision: any): AIDecision {
    return {
      id: dbDecision.id,
      decisionTimestamp: new Date(dbDecision.decision_timestamp),
      decisionType: dbDecision.decision_type,
      recommendation: this.safeParseJSON(dbDecision.recommendation),
      confidence: dbDecision.confidence,
      reasoning: dbDecision.reasoning,
      dataPointsUsed: dbDecision.data_points_used,
      contextData: this.safeParseJSON(dbDecision.context_data),
      competitiveData: this.safeParseJSON(dbDecision.competitive_data),
      performanceData: this.safeParseJSON(dbDecision.performance_data),
      implemented: dbDecision.implemented,
      implementationTimestamp: dbDecision.implementation_timestamp ? new Date(dbDecision.implementation_timestamp) : undefined,
      outcomeData: this.safeParseJSON(dbDecision.outcome_data),
      successScore: dbDecision.success_score
    };
  }

  private safeParseJSON(field: any): any {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    }
    return field;
  }
}

export const getUnifiedDataManager = () => UnifiedDataManager.getInstance();
