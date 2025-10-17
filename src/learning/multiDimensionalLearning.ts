/**
 * 🧠 MULTI-DIMENSIONAL LEARNING SYSTEM
 * 
 * Goes beyond simple "content A > content B" to understand:
 * - Engagement velocity (how FAST engagement comes)
 * - Conversion funnel (views → clicks → follows)
 * - Network effects (who engages matters)
 * - Timing patterns (when to post)
 * - Conversation depth (reply chains)
 */

import { getSupabaseClient } from '../db/index';

interface EngagementVelocity {
  first_30min: number;
  first_2hours: number;
  first_24hours: number;
  velocity_score: number; // 0-100, weighted by timing
}

interface ConversionFunnel {
  impressions: number;
  views: number;
  profile_clicks: number;
  followers_gained: number;
  
  // Conversion rates
  view_rate: number; // impressions → views
  click_rate: number; // views → profile clicks
  follow_rate: number; // clicks → follows
  
  // Overall funnel score
  funnel_efficiency: number; // 0-100
}

interface NetworkEffects {
  high_value_engagers: number; // Verified or >10K followers
  engagement_quality_score: number; // Weighted by influence
  reply_chain_depth: number;
  external_shares: number; // Shared outside Twitter
}

interface TimingPattern {
  hour: number;
  day_of_week: number;
  competition_level: 'low' | 'medium' | 'high';
  follower_activity_level: number; // 0-100
}

interface MultiDimensionalMetrics {
  post_id: string;
  posted_at: string;
  
  // Traditional metrics
  likes: number;
  retweets: number;
  replies: number;
  saves: number;
  followers_gained: number;
  
  // Advanced metrics
  velocity: EngagementVelocity;
  funnel: ConversionFunnel;
  network: NetworkEffects;
  timing: TimingPattern;
  
  // Weighted scores
  twitter_algorithm_score: number; // How Twitter sees this
  follower_conversion_score: number; // How well it converts
  overall_effectiveness: number; // Combined score
}

interface LearningInsight {
  insight_type: 'velocity' | 'funnel' | 'network' | 'timing' | 'content';
  discovery: string;
  confidence: number;
  sample_size: number;
  actionable_recommendation: string;
}

export class MultiDimensionalLearningSystem {
  private static instance: MultiDimensionalLearningSystem;
  private supabase = getSupabaseClient();
  private insights: Map<string, LearningInsight> = new Map();

  private constructor() {}

  public static getInstance(): MultiDimensionalLearningSystem {
    if (!MultiDimensionalLearningSystem.instance) {
      MultiDimensionalLearningSystem.instance = new MultiDimensionalLearningSystem();
    }
    return MultiDimensionalLearningSystem.instance;
  }

  /**
   * Process comprehensive metrics for a post
   */
  async processMultiDimensionalMetrics(metrics: MultiDimensionalMetrics): Promise<void> {
    console.log(`[MULTI_DIM_LEARNING] 📊 Processing multi-dimensional metrics for ${metrics.post_id}`);
    
    try {
      // 1. Calculate weighted scores
      const twitterScore = this.calculateTwitterAlgorithmScore(metrics);
      const conversionScore = this.calculateConversionScore(metrics);
      const overallScore = (twitterScore * 0.6) + (conversionScore * 0.4);
      
      // 2. Store in database
      await this.storeMetrics({
        ...metrics,
        twitter_algorithm_score: twitterScore,
        follower_conversion_score: conversionScore,
        overall_effectiveness: overallScore
      });
      
      // 3. Extract learnings
      await this.extractLearnings(metrics);
      
      console.log(`[MULTI_DIM_LEARNING] ✅ Processed: Twitter=${twitterScore}, Conversion=${conversionScore}, Overall=${overallScore}`);
    } catch (error: any) {
      console.error(`[MULTI_DIM_LEARNING] ❌ Error processing metrics:`, error.message);
    }
  }

  /**
   * Calculate how Twitter's algorithm sees this post
   * Based on engagement velocity, quality, and conversation
   */
  private calculateTwitterAlgorithmScore(metrics: MultiDimensionalMetrics): number {
    let score = 0;
    
    // 1. Engagement Velocity (40% weight) - Twitter HEAVILY favors fast engagement
    const velocityScore = metrics.velocity.velocity_score;
    score += velocityScore * 0.4;
    
    // 2. Engagement Quality (30% weight) - Weighted by Twitter's algorithm
    const replyWeight = 27;
    const retweetWeight = 13;
    const likeWeight = 1;
    
    const totalWeightedEngagement = 
      (metrics.replies * replyWeight) +
      (metrics.retweets * retweetWeight) +
      (metrics.likes * likeWeight);
    
    // Normalize to 0-100 (rough estimate, adjust based on account size)
    const qualityScore = Math.min(100, (totalWeightedEngagement / 50) * 100);
    score += qualityScore * 0.3;
    
    // 3. Network Effects (20% weight) - High-value engagers amplify reach
    score += metrics.network.engagement_quality_score * 0.2;
    
    // 4. Conversation Depth (10% weight) - Reply chains get amplified
    const conversationScore = Math.min(100, metrics.network.reply_chain_depth * 20);
    score += conversationScore * 0.1;
    
    return Math.round(score);
  }

  /**
   * Calculate how well this post converts viewers to followers
   */
  private calculateConversionScore(metrics: MultiDimensionalMetrics): number {
    const funnel = metrics.funnel;
    
    // Perfect funnel would be:
    // - 50% view rate (impressions → views)
    // - 10% click rate (views → profile clicks)
    // - 10% follow rate (clicks → follows)
    
    const viewRateScore = Math.min(100, (funnel.view_rate / 0.5) * 100);
    const clickRateScore = Math.min(100, (funnel.click_rate / 0.1) * 100);
    const followRateScore = Math.min(100, (funnel.follow_rate / 0.1) * 100);
    
    // Weighted average (follow rate matters most)
    const score = (viewRateScore * 0.2) + (clickRateScore * 0.3) + (followRateScore * 0.5);
    
    return Math.round(score);
  }

  /**
   * Store comprehensive metrics in database
   */
  private async storeMetrics(metrics: MultiDimensionalMetrics): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('multi_dimensional_metrics')
        .upsert({
          post_id: metrics.post_id,
          posted_at: metrics.posted_at,
          
          // Traditional
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          saves: metrics.saves,
          followers_gained: metrics.followers_gained,
          
          // Velocity
          velocity_30min: metrics.velocity.first_30min,
          velocity_2hours: metrics.velocity.first_2hours,
          velocity_24hours: metrics.velocity.first_24hours,
          velocity_score: metrics.velocity.velocity_score,
          
          // Funnel
          impressions: metrics.funnel.impressions,
          views: metrics.funnel.views,
          profile_clicks: metrics.funnel.profile_clicks,
          view_rate: metrics.funnel.view_rate,
          click_rate: metrics.funnel.click_rate,
          follow_rate: metrics.funnel.follow_rate,
          
          // Network
          high_value_engagers: metrics.network.high_value_engagers,
          engagement_quality_score: metrics.network.engagement_quality_score,
          reply_chain_depth: metrics.network.reply_chain_depth,
          
          // Timing
          hour: metrics.timing.hour,
          day_of_week: metrics.timing.day_of_week,
          competition_level: metrics.timing.competition_level,
          
          // Scores
          twitter_algorithm_score: metrics.twitter_algorithm_score,
          follower_conversion_score: metrics.follower_conversion_score,
          overall_effectiveness: metrics.overall_effectiveness,
          
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'post_id'
        });

      if (error) {
        console.error('[MULTI_DIM_LEARNING] ❌ Database error:', error.message);
      }
    } catch (error: any) {
      console.error('[MULTI_DIM_LEARNING] ❌ Error storing metrics:', error.message);
    }
  }

  /**
   * Extract actionable learnings from patterns
   */
  private async extractLearnings(metrics: MultiDimensionalMetrics): Promise<void> {
    // Get historical data for pattern recognition
    const { data: historicalData } = await this.supabase
      .from('multi_dimensional_metrics')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(50);

    if (!historicalData || historicalData.length < 10) {
      console.log('[MULTI_DIM_LEARNING] ℹ️ Not enough data for pattern recognition yet');
      return;
    }

    // Analyze velocity patterns
    const avgVelocityScore = historicalData.reduce((sum, d) => sum + (d.velocity_score || 0), 0) / historicalData.length;
    if (metrics.velocity.velocity_score > avgVelocityScore * 1.5) {
      this.insights.set('velocity_success', {
        insight_type: 'velocity',
        discovery: `Posts with engagement in first 30min get ${metrics.velocity.velocity_score / avgVelocityScore}x better reach`,
        confidence: 0.8,
        sample_size: historicalData.length,
        actionable_recommendation: 'Post during high-activity hours and engage immediately to spark early conversation'
      });
    }

    // Analyze funnel patterns
    const avgClickRate = historicalData.reduce((sum, d) => sum + (d.click_rate || 0), 0) / historicalData.length;
    if (metrics.funnel.click_rate > avgClickRate * 2) {
      this.insights.set('funnel_success', {
        insight_type: 'funnel',
        discovery: `This content type gets ${metrics.funnel.click_rate / avgClickRate}x more profile clicks`,
        confidence: 0.85,
        sample_size: historicalData.length,
        actionable_recommendation: 'Use more curiosity gaps and cliffhangers to drive profile clicks'
      });
    }

    // Analyze timing patterns
    const sameHourPosts = historicalData.filter(d => d.hour === metrics.timing.hour);
    if (sameHourPosts.length >= 5) {
      const avgEffectiveness = sameHourPosts.reduce((sum, d) => sum + (d.overall_effectiveness || 0), 0) / sameHourPosts.length;
      if (avgEffectiveness > 70) {
        this.insights.set(`timing_hour_${metrics.timing.hour}`, {
          insight_type: 'timing',
          discovery: `Posting at ${metrics.timing.hour}:00 consistently performs ${avgEffectiveness}% above average`,
          confidence: 0.9,
          sample_size: sameHourPosts.length,
          actionable_recommendation: `Schedule more posts for ${metrics.timing.hour}:00`
        });
      }
    }
  }

  /**
   * Get actionable insights for content strategy
   */
  async getActionableInsights(): Promise<LearningInsight[]> {
    return Array.from(this.insights.values())
      .filter(insight => insight.confidence > 0.7)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get best performing patterns for optimization
   */
  async getBestPatterns(): Promise<{
    best_hours: number[];
    best_content_types: string[];
    optimal_velocity_target: number;
    optimal_click_rate: number;
  }> {
    const { data } = await this.supabase
      .from('multi_dimensional_metrics')
      .select('*')
      .gte('overall_effectiveness', 70)
      .order('overall_effectiveness', { ascending: false })
      .limit(20);

    if (!data || data.length === 0) {
      return {
        best_hours: [7, 8, 12, 19], // Default educated guess
        best_content_types: ['myth_busting', 'how_to'],
        optimal_velocity_target: 10,
        optimal_click_rate: 0.05
      };
    }

    // Extract patterns from top performers
    const hourCounts = new Map<number, number>();
    let totalVelocity = 0;
    let totalClickRate = 0;

    data.forEach(post => {
      hourCounts.set(post.hour, (hourCounts.get(post.hour) || 0) + 1);
      totalVelocity += post.velocity_score || 0;
      totalClickRate += post.click_rate || 0;
    });

    const best_hours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([hour]) => hour);

    return {
      best_hours,
      best_content_types: ['myth_busting', 'controversial', 'how_to'], // TODO: Extract from content metadata
      optimal_velocity_target: Math.round(totalVelocity / data.length),
      optimal_click_rate: totalClickRate / data.length
    };
  }
}

export const getMultiDimensionalLearning = () => MultiDimensionalLearningSystem.getInstance();

