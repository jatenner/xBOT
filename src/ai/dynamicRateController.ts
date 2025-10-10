/**
 * 🎯 DYNAMIC RATE CONTROLLER
 * 
 * Automatically scales posting and reply frequency based on real-time performance data
 * - Increases frequency when engagement is high
 * - Decreases frequency when performance drops
 * - Learns optimal posting patterns from data
 * - Prevents over-posting when audience is saturated
 */

import { getSupabaseClient } from '../db/index';
import { kvGet, kvSet } from '../lib/kv';

interface PerformanceMetrics {
  avg_engagement_rate: number;
  follower_growth_rate: number;
  content_saturation_score: number;
  reply_conversion_rate: number;
  recent_post_performance: number;
  audience_fatigue_indicator: number;
}

interface RateRecommendation {
  posts_per_hour: number;
  replies_per_hour: number;
  confidence: number;
  reasoning: string[];
  should_scale_up: boolean;
  should_scale_down: boolean;
}

export class DynamicRateController {
  private static instance: DynamicRateController;
  private readonly MIN_POSTS_PER_HOUR = 1;
  private readonly MAX_POSTS_PER_HOUR = 4;
  private readonly MIN_REPLIES_PER_HOUR = 2;
  private readonly MAX_REPLIES_PER_HOUR = 6;
  private readonly LEARNING_WINDOW_HOURS = 24;

  private constructor() {}

  public static getInstance(): DynamicRateController {
    if (!DynamicRateController.instance) {
      DynamicRateController.instance = new DynamicRateController();
    }
    return DynamicRateController.instance;
  }

  /**
   * 📊 Get optimal posting rates based on current performance
   */
  public async getOptimalRates(): Promise<RateRecommendation> {
    console.log('🎯 DYNAMIC_RATE: Analyzing performance for optimal rates...');

    try {
      // Get current performance metrics
      const metrics = await this.gatherPerformanceMetrics();
      
      // Calculate base rates from current config
      const currentRates = await this.getCurrentRates();
      
      // Analyze performance and determine scaling
      const recommendation = await this.calculateOptimalRates(metrics, currentRates);
      
      // Store recommendation for tracking
      await this.storeRateDecision(recommendation, metrics);
      
      console.log(`✅ DYNAMIC_RATE: Recommended ${recommendation.posts_per_hour}p/h, ${recommendation.replies_per_hour}r/h (confidence: ${recommendation.confidence})`);
      return recommendation;

    } catch (error: any) {
      console.error('❌ DYNAMIC_RATE: Failed to calculate optimal rates:', error.message);
      
      // Fallback to current rates
      const currentRates = await this.getCurrentRates();
      return {
        posts_per_hour: currentRates.posts_per_hour,
        replies_per_hour: currentRates.replies_per_hour,
        confidence: 0.1,
        reasoning: ['Error occurred, using current rates as fallback'],
        should_scale_up: false,
        should_scale_down: false
      };
    }
  }

  /**
   * 📈 Gather performance metrics from the last 24 hours
   */
  private async gatherPerformanceMetrics(): Promise<PerformanceMetrics> {
    const supabase = getSupabaseClient();
    const hoursAgo = new Date(Date.now() - this.LEARNING_WINDOW_HOURS * 60 * 60 * 1000);

    // Get recent post performance
    const { data: recentPosts, error: postsError } = await supabase
      .from('posted_decisions')
      .select('engagement_rate, followers_gained, posted_at, content_type')
      .gte('posted_at', hoursAgo.toISOString())
      .order('posted_at', { ascending: false });

    if (postsError) {
      console.error('❌ DYNAMIC_RATE: Failed to fetch recent posts:', postsError);
    }

    // Get reply performance
    const { data: recentReplies, error: repliesError } = await supabase
      .from('posted_decisions')
      .select('engagement_rate, followers_gained, posted_at')
      .eq('content_type', 'reply')
      .gte('posted_at', hoursAgo.toISOString());

    if (repliesError) {
      console.error('❌ DYNAMIC_RATE: Failed to fetch recent replies:', repliesError);
    }

    // Calculate metrics
    const posts = recentPosts || [];
    const replies = recentReplies || [];

    const avgEngagementRate = posts.length > 0 
      ? posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length
      : 0.02; // Default baseline

    const followerGrowthRate = posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.followers_gained || 0), 0) / posts.length
      : 0.5; // Default baseline

    const replyConversionRate = replies.length > 0
      ? replies.reduce((sum, r) => sum + (r.engagement_rate || 0), 0) / replies.length
      : 0.015; // Default baseline

    // Calculate content saturation (how much engagement drops over time)
    const saturationScore = this.calculateSaturationScore(posts);
    
    // Calculate audience fatigue (engagement trend over time)
    const fatigueIndicator = this.calculateFatigueIndicator(posts);

    return {
      avg_engagement_rate: avgEngagementRate,
      follower_growth_rate: followerGrowthRate,
      content_saturation_score: saturationScore,
      reply_conversion_rate: replyConversionRate,
      recent_post_performance: avgEngagementRate,
      audience_fatigue_indicator: fatigueIndicator
    };
  }

  /**
   * 🧮 Calculate optimal posting rates based on performance
   */
  private async calculateOptimalRates(
    metrics: PerformanceMetrics, 
    currentRates: { posts_per_hour: number; replies_per_hour: number }
  ): Promise<RateRecommendation> {
    
    const reasoning: string[] = [];
    let postsPerHour = currentRates.posts_per_hour;
    let repliesPerHour = currentRates.replies_per_hour;
    let shouldScaleUp = false;
    let shouldScaleDown = false;

    // HIGH PERFORMANCE INDICATORS - SCALE UP
    if (metrics.avg_engagement_rate > 0.04 && metrics.follower_growth_rate > 1.0) {
      postsPerHour = Math.min(this.MAX_POSTS_PER_HOUR, postsPerHour + 1);
      repliesPerHour = Math.min(this.MAX_REPLIES_PER_HOUR, repliesPerHour + 1);
      shouldScaleUp = true;
      reasoning.push(`High engagement (${(metrics.avg_engagement_rate * 100).toFixed(1)}%) + follower growth (${metrics.follower_growth_rate.toFixed(1)}/post) → Scale UP`);
    }

    // EXCELLENT REPLY PERFORMANCE - INCREASE REPLIES
    if (metrics.reply_conversion_rate > 0.025) {
      repliesPerHour = Math.min(this.MAX_REPLIES_PER_HOUR, repliesPerHour + 1);
      reasoning.push(`Excellent reply conversion (${(metrics.reply_conversion_rate * 100).toFixed(1)}%) → More replies`);
    }

    // CONTENT SATURATION - REDUCE POSTS, INCREASE REPLIES
    if (metrics.content_saturation_score > 0.7) {
      postsPerHour = Math.max(this.MIN_POSTS_PER_HOUR, postsPerHour - 1);
      repliesPerHour = Math.min(this.MAX_REPLIES_PER_HOUR, repliesPerHour + 1);
      shouldScaleDown = true;
      reasoning.push(`Content saturation detected (${(metrics.content_saturation_score * 100).toFixed(0)}%) → Fewer posts, more replies`);
    }

    // AUDIENCE FATIGUE - SCALE DOWN EVERYTHING
    if (metrics.audience_fatigue_indicator > 0.6) {
      postsPerHour = Math.max(this.MIN_POSTS_PER_HOUR, postsPerHour - 1);
      repliesPerHour = Math.max(this.MIN_REPLIES_PER_HOUR, repliesPerHour - 1);
      shouldScaleDown = true;
      reasoning.push(`Audience fatigue detected (${(metrics.audience_fatigue_indicator * 100).toFixed(0)}%) → Scale DOWN`);
    }

    // LOW PERFORMANCE - SCALE DOWN POSTS, MAINTAIN REPLIES
    if (metrics.avg_engagement_rate < 0.015 && metrics.follower_growth_rate < 0.3) {
      postsPerHour = Math.max(this.MIN_POSTS_PER_HOUR, postsPerHour - 1);
      shouldScaleDown = true;
      reasoning.push(`Low performance (${(metrics.avg_engagement_rate * 100).toFixed(1)}% ER, ${metrics.follower_growth_rate.toFixed(1)} followers/post) → Reduce posts`);
    }

    // OPTIMAL PERFORMANCE - MAINTAIN OR SLIGHT INCREASE
    if (metrics.avg_engagement_rate >= 0.025 && metrics.avg_engagement_rate <= 0.04) {
      reasoning.push(`Optimal performance range (${(metrics.avg_engagement_rate * 100).toFixed(1)}% ER) → Maintain current rates`);
    }

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(metrics);

    return {
      posts_per_hour: postsPerHour,
      replies_per_hour: repliesPerHour,
      confidence,
      reasoning,
      should_scale_up: shouldScaleUp,
      should_scale_down: shouldScaleDown
    };
  }

  /**
   * 📉 Calculate content saturation score
   */
  private calculateSaturationScore(posts: any[]): number {
    if (posts.length < 5) return 0.3; // Default low saturation

    // Sort by time and calculate engagement decline
    const sortedPosts = posts.sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime());
    
    const firstHalf = sortedPosts.slice(0, Math.floor(sortedPosts.length / 2));
    const secondHalf = sortedPosts.slice(Math.floor(sortedPosts.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / secondHalf.length;

    // Higher score means more saturation (engagement declining over time)
    const decline = Math.max(0, (firstHalfAvg - secondHalfAvg) / firstHalfAvg);
    return Math.min(1, decline * 2); // Scale to 0-1
  }

  /**
   * 😴 Calculate audience fatigue indicator
   */
  private calculateFatigueIndicator(posts: any[]): number {
    if (posts.length < 10) return 0.2; // Default low fatigue

    // Look at engagement variance - high variance indicates inconsistent audience response
    const engagementRates = posts.map(p => p.engagement_rate || 0);
    const mean = engagementRates.reduce((sum, er) => sum + er, 0) / engagementRates.length;
    const variance = engagementRates.reduce((sum, er) => sum + Math.pow(er - mean, 2), 0) / engagementRates.length;
    
    // Higher variance + lower mean = more fatigue
    const fatigueScore = (variance * 10) + (mean < 0.02 ? 0.3 : 0);
    return Math.min(1, fatigueScore);
  }

  /**
   * 🎯 Calculate confidence in the recommendation
   */
  private calculateConfidence(metrics: PerformanceMetrics): number {
    let confidence = 0.5; // Base confidence

    // More data = higher confidence
    if (metrics.recent_post_performance > 0) confidence += 0.2;
    if (metrics.reply_conversion_rate > 0) confidence += 0.1;
    
    // Clear signals = higher confidence
    if (metrics.avg_engagement_rate > 0.04 || metrics.avg_engagement_rate < 0.01) confidence += 0.2;
    if (metrics.audience_fatigue_indicator > 0.7 || metrics.audience_fatigue_indicator < 0.3) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * 📋 Get current rate configuration
   */
  private async getCurrentRates(): Promise<{ posts_per_hour: number; replies_per_hour: number }> {
    // Try to get from KV store first (dynamic rates)
    const dynamicRates = await kvGet('dynamic:current_rates');
    if (dynamicRates) {
      const rates = JSON.parse(dynamicRates);
      return {
        posts_per_hour: rates.posts_per_hour || 2,
        replies_per_hour: rates.replies_per_hour || 3
      };
    }

    // Fallback to config defaults
    return {
      posts_per_hour: parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10),
      replies_per_hour: Math.ceil(parseInt(process.env.REPLY_MAX_PER_DAY || '72', 10) / 24)
    };
  }

  /**
   * 💾 Store rate decision for tracking and learning
   */
  private async storeRateDecision(recommendation: RateRecommendation, metrics: PerformanceMetrics): Promise<void> {
    try {
      // Store current rates in KV for immediate use
      await kvSet('dynamic:current_rates', JSON.stringify({
        posts_per_hour: recommendation.posts_per_hour,
        replies_per_hour: recommendation.replies_per_hour,
        updated_at: new Date().toISOString(),
        confidence: recommendation.confidence
      }), 3600); // 1 hour TTL

      // Store decision history in database for learning
      const supabase = getSupabaseClient();
      await supabase.from('rate_decisions').insert({
        posts_per_hour: recommendation.posts_per_hour,
        replies_per_hour: recommendation.replies_per_hour,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
        metrics: metrics,
        should_scale_up: recommendation.should_scale_up,
        should_scale_down: recommendation.should_scale_down,
        created_at: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ DYNAMIC_RATE: Failed to store rate decision:', error.message);
    }
  }

  /**
   * 🚀 Apply dynamic rates to job manager
   */
  public async applyDynamicRates(): Promise<{
    applied: boolean;
    posts_per_hour: number;
    replies_per_hour: number;
    reasoning: string[];
  }> {
    try {
      const recommendation = await this.getOptimalRates();
      
      if (recommendation.confidence < 0.3) {
        console.log('⚠️ DYNAMIC_RATE: Low confidence, keeping current rates');
        return {
          applied: false,
          posts_per_hour: recommendation.posts_per_hour,
          replies_per_hour: recommendation.replies_per_hour,
          reasoning: ['Low confidence - keeping current rates']
        };
      }

      // Update environment variables dynamically (for this session)
      process.env.MAX_POSTS_PER_HOUR = recommendation.posts_per_hour.toString();
      process.env.REPLY_MAX_PER_DAY = (recommendation.replies_per_hour * 24).toString();
      process.env.REPLY_MINUTES_BETWEEN = Math.floor(60 / recommendation.replies_per_hour).toString();

      console.log(`🎯 DYNAMIC_RATE: Applied new rates - ${recommendation.posts_per_hour}p/h, ${recommendation.replies_per_hour}r/h`);
      
      return {
        applied: true,
        posts_per_hour: recommendation.posts_per_hour,
        replies_per_hour: recommendation.replies_per_hour,
        reasoning: recommendation.reasoning
      };

    } catch (error: any) {
      console.error('❌ DYNAMIC_RATE: Failed to apply dynamic rates:', error.message);
      return {
        applied: false,
        posts_per_hour: 2,
        replies_per_hour: 3,
        reasoning: ['Error occurred - using fallback rates']
      };
    }
  }

  /**
   * 📊 Get rate adjustment history and performance
   */
  public async getRateHistory(): Promise<{
    recent_adjustments: any[];
    performance_trend: string;
    current_rates: { posts_per_hour: number; replies_per_hour: number };
  }> {
    try {
      const supabase = getSupabaseClient();
      
      const { data: recentDecisions } = await supabase
        .from('rate_decisions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const currentRates = await this.getCurrentRates();
      
      // Analyze trend
      let performanceTrend = 'stable';
      if (recentDecisions && recentDecisions.length >= 3) {
        const recent = recentDecisions.slice(0, 3);
        const scaleUps = recent.filter(d => d.should_scale_up).length;
        const scaleDowns = recent.filter(d => d.should_scale_down).length;
        
        if (scaleUps > scaleDowns) performanceTrend = 'improving';
        else if (scaleDowns > scaleUps) performanceTrend = 'declining';
      }

      return {
        recent_adjustments: recentDecisions || [],
        performance_trend: performanceTrend,
        current_rates: currentRates
      };

    } catch (error: any) {
      console.error('❌ DYNAMIC_RATE: Failed to get rate history:', error.message);
      return {
        recent_adjustments: [],
        performance_trend: 'unknown',
        current_rates: { posts_per_hour: 2, replies_per_hour: 3 }
      };
    }
  }
}
