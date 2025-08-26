/**
 * 🚀 AGGRESSIVE GROWTH ENGINE
 * 
 * Maximizes posting frequency and engagement optimization for rapid follower growth
 * - Posts every 60-90 minutes instead of 3+ hours
 * - Learns aggressively from engagement patterns
 * - Optimizes content quality in real-time
 * - Maximizes OpenAI API usage for rapid iterations
 */

import { AutonomousPostingEngine } from './autonomousPostingEngine';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

interface GrowthMetrics {
  followers_gained_24h: number;
  engagement_rate_24h: number;
  best_performing_times: number[];
  worst_performing_times: number[];
  optimal_content_types: string[];
  failed_content_patterns: string[];
}

interface AggressivePostDecision {
  shouldPost: boolean;
  reason: string;
  urgency: 'immediate' | 'high' | 'medium' | 'low';
  nextCheckMinutes: number;
  qualityAdjustments: string[];
}

export class AggressiveGrowthEngine {
  private static instance: AggressiveGrowthEngine;
  private db: AdvancedDatabaseManager;
  private postingEngine: AutonomousPostingEngine;
  private learningActive = true;
  private currentGrowthRate = 0;
  private targetGrowthRate = 10; // followers per day minimum

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
    this.postingEngine = AutonomousPostingEngine.getInstance();
  }

  public static getInstance(): AggressiveGrowthEngine {
    if (!AggressiveGrowthEngine.instance) {
      AggressiveGrowthEngine.instance = new AggressiveGrowthEngine();
    }
    return AggressiveGrowthEngine.instance;
  }

  /**
   * 🎯 MAIN DECISION FUNCTION: Should we post NOW for maximum growth?
   */
  public async shouldPostAggressive(): Promise<AggressivePostDecision> {
    console.log('🚀 AGGRESSIVE_GROWTH: Analyzing posting opportunity for maximum engagement');

    const [
      timeSinceLastPost,
      currentGrowthMetrics,
      engagementOpportunity,
      contentQualityScore
    ] = await Promise.all([
      this.getTimeSinceLastPost(),
      this.getCurrentGrowthMetrics(),
      this.analyzeCurrentEngagementOpportunity(),
      this.evaluateRecentContentQuality()
    ]);

    let decision: AggressivePostDecision = {
      shouldPost: false,
      reason: '',
      urgency: 'low',
      nextCheckMinutes: 30,
      qualityAdjustments: []
    };

    console.log(`📊 GROWTH_ANALYSIS: ${timeSinceLastPost}min since last post, growth rate: ${currentGrowthMetrics.followers_gained_24h}/day`);

    // 🚨 AGGRESSIVE POSTING RULES (Much more aggressive than standard)
    
    // 1. POST IMMEDIATELY if it's been 90+ minutes (was 3+ hours)
    if (timeSinceLastPost >= 90) {
      decision.shouldPost = true;
      decision.urgency = 'immediate';
      decision.reason = `🚨 IMMEDIATE: ${timeSinceLastPost}min gap (90min threshold for growth)`;
      decision.nextCheckMinutes = 5;
      decision.qualityAdjustments.push('Use high-engagement format from recent successes');
    }
    
    // 2. POST AGGRESSIVELY if it's been 60+ minutes AND we have good engagement opportunity
    else if (timeSinceLastPost >= 60 && engagementOpportunity > 0.4) {
      decision.shouldPost = true;
      decision.urgency = 'high';
      decision.reason = `⚡ HIGH_OPPORTUNITY: ${timeSinceLastPost}min + engagement window (${(engagementOpportunity * 100).toFixed(0)}%)`;
      decision.nextCheckMinutes = 15;
      decision.qualityAdjustments.push('Capitalize on current engagement window');
    }
    
    // 3. POST if growth rate is below target AND it's been 45+ minutes
    else if (currentGrowthMetrics.followers_gained_24h < this.targetGrowthRate && timeSinceLastPost >= 45) {
      decision.shouldPost = true;
      decision.urgency = 'high';
      decision.reason = `📈 GROWTH_ACCELERATION: Only ${currentGrowthMetrics.followers_gained_24h} followers today (target: ${this.targetGrowthRate})`;
      decision.nextCheckMinutes = 20;
      decision.qualityAdjustments.push('Use viral content pattern', 'Add engagement hook');
    }
    
    // 4. QUALITY OVERRIDE: Post if we have a high-quality content opportunity
    else if (contentQualityScore > 0.8 && timeSinceLastPost >= 30) {
      decision.shouldPost = true;
      decision.urgency = 'medium';
      decision.reason = `💎 QUALITY_OPPORTUNITY: High content quality score (${(contentQualityScore * 100).toFixed(0)}%)`;
      decision.nextCheckMinutes = 25;
      decision.qualityAdjustments.push('Leverage current high-quality content generation');
    }
    
    // 5. Check again in 15 minutes instead of 30 (more aggressive monitoring)
    else {
      decision.nextCheckMinutes = 15;
      decision.reason = `⏳ WAITING: ${timeSinceLastPost}min gap (need 45+ for growth mode)`;
      
      // Add quality improvements for next attempt
      if (currentGrowthMetrics.engagement_rate_24h < 0.03) {
        decision.qualityAdjustments.push('Low engagement detected - need content quality boost');
      }
      
      if (timeSinceLastPost > 30) {
        decision.qualityAdjustments.push('Approaching posting window - prepare high-engagement content');
      }
    }

    // 📊 LEARNING ADJUSTMENTS based on recent performance
    if (currentGrowthMetrics.failed_content_patterns.length > 0) {
      decision.qualityAdjustments.push(`Avoid: ${currentGrowthMetrics.failed_content_patterns.slice(0, 2).join(', ')}`);
    }
    
    if (currentGrowthMetrics.optimal_content_types.length > 0) {
      decision.qualityAdjustments.push(`Use: ${currentGrowthMetrics.optimal_content_types[0]} format`);
    }

    console.log(`🎯 AGGRESSIVE_DECISION: ${decision.shouldPost ? '✅ POST NOW' : '⏳ WAIT'} - ${decision.reason}`);
    
    if (decision.qualityAdjustments.length > 0) {
      console.log(`🔧 QUALITY_ADJUSTMENTS: ${decision.qualityAdjustments.join('; ')}`);
    }

    return decision;
  }

  /**
   * 📈 Get current growth metrics for learning
   */
  private async getCurrentGrowthMetrics(): Promise<GrowthMetrics> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const growthData = await this.db.executeQuery(
        'get_growth_metrics',
        async (client) => {
          // Get recent posts with engagement
          const { data: recentPosts } = await client
            .from('learning_posts')
            .select('*')
            .gte('created_at', twentyFourHoursAgo.toISOString())
            .order('created_at', { ascending: false });

          // Get follower growth (if tracked)
          const { data: followerData } = await client
            .from('follower_tracking')
            .select('*')
            .gte('tracked_at', twentyFourHoursAgo.toISOString())
            .order('tracked_at', { ascending: false })
            .limit(1);

          return { recentPosts: recentPosts || [], followerData: followerData || [] };
        }
      );

      const metrics = this.analyzeGrowthData(growthData.recentPosts, growthData.followerData);
      
      console.log(`📊 GROWTH_METRICS: ${metrics.followers_gained_24h} followers, ${(metrics.engagement_rate_24h * 100).toFixed(2)}% engagement`);
      
      return metrics;
    } catch (error) {
      console.warn('⚠️ Could not get growth metrics:', error);
      return {
        followers_gained_24h: 0,
        engagement_rate_24h: 0.01,
        best_performing_times: [9, 13, 19],
        worst_performing_times: [23, 2, 5],
        optimal_content_types: ['research_insight', 'actionable_tip'],
        failed_content_patterns: ['too_academic', 'no_hook']
      };
    }
  }

  /**
   * 🧮 Analyze growth data to extract learning insights
   */
  private analyzeGrowthData(recentPosts: any[], followerData: any[]): GrowthMetrics {
    // Calculate follower growth
    const followersGained = followerData.length > 0 
      ? Math.max(0, followerData[0].current_followers - (followerData[0].previous_followers || 0))
      : 0;

    // Calculate engagement rate
    let totalEngagement = 0;
    let totalImpressions = 0;
    const hourlyPerformance: { [hour: number]: number } = {};
    const contentTypePerformance: { [type: string]: number } = {};

    recentPosts.forEach(post => {
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0);
      const impressions = post.impressions_count || Math.max(100, engagement * 20); // Estimate if missing
      
      totalEngagement += engagement;
      totalImpressions += impressions;

      // Track hourly performance
      const hour = new Date(post.created_at).getHours();
      if (!hourlyPerformance[hour]) hourlyPerformance[hour] = 0;
      hourlyPerformance[hour] += engagement / Math.max(1, impressions);

      // Track content type performance
      const contentType = post.content_type || 'general';
      if (!contentTypePerformance[contentType]) contentTypePerformance[contentType] = 0;
      contentTypePerformance[contentType] += engagement;
    });

    const engagementRate = totalImpressions > 0 ? totalEngagement / totalImpressions : 0.01;

    // Find best and worst performing times
    const sortedHours = Object.entries(hourlyPerformance)
      .sort(([,a], [,b]) => b - a)
      .map(([hour]) => parseInt(hour));

    const bestTimes = sortedHours.slice(0, 3);
    const worstTimes = sortedHours.slice(-3).reverse();

    // Find optimal content types
    const sortedContentTypes = Object.entries(contentTypePerformance)
      .sort(([,a], [,b]) => b - a)
      .map(([type]) => type);

    return {
      followers_gained_24h: followersGained,
      engagement_rate_24h: engagementRate,
      best_performing_times: bestTimes.length > 0 ? bestTimes : [9, 13, 19],
      worst_performing_times: worstTimes.length > 0 ? worstTimes : [23, 2, 5],
      optimal_content_types: sortedContentTypes.slice(0, 3),
      failed_content_patterns: this.identifyFailedPatterns(recentPosts)
    };
  }

  /**
   * 🔍 Identify content patterns that failed to get engagement
   */
  private identifyFailedPatterns(recentPosts: any[]): string[] {
    const failedPatterns: string[] = [];
    
    recentPosts.forEach(post => {
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0);
      
      if (engagement === 0 && post.content) {
        if (post.content.length > 250) failedPatterns.push('too_long');
        if (!post.content.includes('?') && !post.content.includes('!')) failedPatterns.push('no_engagement_hook');
        if (post.content.includes('research shows') && engagement === 0) failedPatterns.push('too_academic');
        if (post.content.includes('studies indicate')) failedPatterns.push('dry_language');
      }
    });

    return [...new Set(failedPatterns)].slice(0, 3);
  }

  /**
   * ⚡ Analyze current engagement opportunity (time-based)
   */
  private async analyzeCurrentEngagementOpportunity(): Promise<number> {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Peak engagement times for health content (based on research)
    const peakHours = [7, 8, 9, 12, 13, 18, 19, 20]; // Morning, lunch, evening
    const moderateHours = [10, 11, 14, 15, 16, 17, 21, 22];
    const lowHours = [0, 1, 2, 3, 4, 5, 6, 23];

    let baseScore = 0.2; // Base opportunity
    
    if (peakHours.includes(hour)) baseScore = 0.8;
    else if (moderateHours.includes(hour)) baseScore = 0.5;
    else if (lowHours.includes(hour)) baseScore = 0.2;

    // Weekend boost (people have more time to read health content)
    if (dayOfWeek === 0 || dayOfWeek === 6) baseScore += 0.1;

    // Weekday evening boost (after work health focus)
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 18 && hour <= 20) baseScore += 0.2;

    return Math.min(1.0, baseScore);
  }

  /**
   * 💎 Evaluate recent content quality for optimization
   */
  private async evaluateRecentContentQuality(): Promise<number> {
    try {
      const recentContent = await this.db.executeQuery(
        'get_recent_content_quality',
        async (client) => {
          const { data } = await client
            .from('learning_posts')
            .select('content, viral_potential_score, likes_count, retweets_count')
            .order('created_at', { ascending: false })
            .limit(5);
          
          return data || [];
        }
      );

      if (recentContent.length === 0) return 0.5;

      let totalQuality = 0;
      recentContent.forEach(post => {
        const viralScore = post.viral_potential_score || 50;
        const engagement = (post.likes_count || 0) + (post.retweets_count || 0);
        const engagementBonus = Math.min(0.3, engagement * 0.1);
        
        const qualityScore = (viralScore / 100) + engagementBonus;
        totalQuality += qualityScore;
      });

      const avgQuality = totalQuality / recentContent.length;
      console.log(`💎 CONTENT_QUALITY: ${(avgQuality * 100).toFixed(0)}% (last ${recentContent.length} posts)`);
      
      return avgQuality;
    } catch (error) {
      console.warn('⚠️ Could not evaluate content quality:', error);
      return 0.5;
    }
  }

  /**
   * ⏱️ Get minutes since last post
   */
  private async getTimeSinceLastPost(): Promise<number> {
    try {
      const lastPost = await this.db.executeQuery(
        'get_last_post_time',
        async (client) => {
          const { data } = await client
            .from('tweets')
            .select('posted_at')
            .order('posted_at', { ascending: false })
            .limit(1);
          
          return data?.[0];
        }
      );

      if (!lastPost) return 999; // No previous posts - post immediately

      const timeDiff = Date.now() - new Date(lastPost.posted_at).getTime();
      return Math.floor(timeDiff / (1000 * 60)); // Minutes
    } catch (error) {
      console.warn('⚠️ Could not get last post time:', error);
      return 999;
    }
  }

  /**
   * 🎯 Execute aggressive posting with quality optimization
   */
  public async executeAggressivePost(): Promise<void> {
    const decision = await this.shouldPostAggressive();
    
    if (decision.shouldPost) {
      console.log(`🚀 EXECUTING_AGGRESSIVE_POST: ${decision.reason}`);
      
      // Apply quality adjustments to the posting engine
      if (decision.qualityAdjustments.length > 0) {
        console.log(`🔧 APPLYING_QUALITY_ADJUSTMENTS: ${decision.qualityAdjustments.join('; ')}`);
      }
      
      // Execute the post through the main posting engine
      await this.postingEngine.executePost();
      
      // Update growth metrics
      await this.updateGrowthTracking();
    } else {
      console.log(`⏳ AGGRESSIVE_WAITING: ${decision.reason} - next check in ${decision.nextCheckMinutes}min`);
    }
  }

  /**
   * 📊 Update growth tracking after posting
   */
  private async updateGrowthTracking(): Promise<void> {
    try {
      // Track that we posted with aggressive strategy
      await this.db.executeQuery(
        'update_growth_tracking',
        async (client) => {
          const { error } = await client
            .from('growth_tracking')
            .insert({
              strategy_used: 'aggressive_growth',
              posted_at: new Date().toISOString(),
              growth_rate_before: this.currentGrowthRate,
              target_growth_rate: this.targetGrowthRate
            });
          
          if (error) console.warn('Could not update growth tracking:', error);
        }
      );
    } catch (error) {
      console.warn('⚠️ Growth tracking update failed:', error);
    }
  }

  /**
   * 🎛️ Configure aggressive growth parameters
   */
  public configureGrowthTarget(targetFollowersPerDay: number): void {
    this.targetGrowthRate = targetFollowersPerDay;
    console.log(`🎯 GROWTH_TARGET: ${targetFollowersPerDay} followers/day`);
  }

  /**
   * 📈 Get current growth status
   */
  public async getGrowthStatus(): Promise<any> {
    const metrics = await this.getCurrentGrowthMetrics();
    const decision = await this.shouldPostAggressive();
    
    return {
      current_growth_rate: metrics.followers_gained_24h,
      target_growth_rate: this.targetGrowthRate,
      engagement_rate: metrics.engagement_rate_24h,
      next_action: decision.shouldPost ? 'POST_NOW' : 'WAIT',
      next_check_minutes: decision.nextCheckMinutes,
      optimization_suggestions: decision.qualityAdjustments
    };
  }
}
