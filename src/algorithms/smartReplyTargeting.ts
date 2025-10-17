/**
 * 🎯 SMART REPLY TARGETING
 * 
 * Finds optimal accounts to reply to for maximum follower conversion
 * 
 * Key Insights:
 * - 10k-100k accounts = sweet spot (not too big, not too small)
 * - Reply within first 5 minutes = 3x more visibility
 * - Follower overlap analysis = better conversion
 * - Rising tweets = ride the viral wave
 * 
 * Budget: ~$0.10/day (discovery + analysis)
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface OptimalReplyTarget {
  handle: string;
  username: string;
  followers: number;
  engagement_rate: number;
  
  // Why this is a good target
  follower_overlap_score: number; // 0-1, how much overlap with YOUR audience
  reply_window: string;            // "first_5_min" | "early" | "late"
  rising_potential: number;        // 0-1, is tweet going viral?
  conversion_potential: number;    // 0-1, predicted follow rate
  
  // Historical performance
  times_replied: number;
  avg_engagement_on_replies: number;
  avg_followers_gained: number;
  actual_conversion_rate: number;
  
  priority_score: number; // Combined score for ranking
}

export interface ReplyOpportunity {
  target: OptimalReplyTarget;
  tweet_url?: string;
  tweet_posted_at: string;
  minutes_since_post: number;
  reply_strategy: string;
  estimated_followers: number;
}

export class SmartReplyTargeting {
  private static instance: SmartReplyTargeting;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): SmartReplyTargeting {
    if (!SmartReplyTargeting.instance) {
      SmartReplyTargeting.instance = new SmartReplyTargeting();
    }
    return SmartReplyTargeting.instance;
  }

  /**
   * Find optimal reply opportunities RIGHT NOW - FULLY AI-DRIVEN
   */
  async findReplyOpportunities(count: number = 5): Promise<ReplyOpportunity[]> {
    console.log('[SMART_REPLY] 🎯 Finding optimal reply opportunities (AI-DRIVEN)...');

    try {
      // Use AI decision engine to find best opportunities
      const { aiReplyDecisionEngine } = await import('../ai/replyDecisionEngine');
      const opportunities = await aiReplyDecisionEngine.findBestOpportunities(count);
      
      if (opportunities.length === 0) {
        console.log('[SMART_REPLY] ⚠️ AI found no opportunities, triggering discovery...');
        const { aiAccountDiscovery } = await import('../ai/accountDiscovery');
        await aiAccountDiscovery.runDiscoveryLoop();
        return [];
      }
      
      // Convert AI opportunities to reply opportunities format
      return opportunities.map(opp => ({
        target: {
          handle: `@${opp.target_username}`,
          username: opp.target_username,
          followers: opp.target_followers,
          engagement_rate: 0.05,
          follower_overlap_score: opp.opportunity_score / 100,
          reply_window: 'early',
          rising_potential: 0.7,
          conversion_potential: opp.opportunity_score / 100,
          times_replied: 0,
          avg_engagement_on_replies: 0,
          avg_followers_gained: opp.predicted_follows,
          actual_conversion_rate: 0,
          priority_score: opp.opportunity_score
        },
        tweet_url: opp.tweet_url,
        tweet_posted_at: new Date().toISOString(),
        minutes_since_post: 0,
        reply_strategy: opp.recommended_generator,
        estimated_followers: opp.predicted_follows
      }));

      /* ALL OLD HARD-CODED LOGIC REMOVED - Using AI Decision Engine */

    } catch (error: any) {
      console.error('[SMART_REPLY] ❌ Error finding opportunities:', error.message);
      console.log('[SMART_REPLY] 🤖 Triggering AI discovery to build target pool...');
      
      // Trigger discovery instead of using hardcoded defaults
      const { aiAccountDiscovery } = await import('../ai/accountDiscovery');
      await aiAccountDiscovery.runDiscoveryLoop();
      
      return []; // Return empty, next cycle will have targets
    }
  }

  /**
   * Calculate priority score for target
   */
  private calculatePriorityScore(factors: {
    followers: number;
    conversion_potential: number;
    times_replied: number;
    actual_conversion_rate: number;
  }): number {
    let score = 0;

    // Factor 1: Optimal follower count (10k-100k = best)
    const followerScore = this.getFollowerScore(factors.followers);
    score += followerScore * 0.3;

    // Factor 2: Conversion potential
    score += factors.conversion_potential * 0.4;

    // Factor 3: Historical performance
    if (factors.times_replied > 0 && factors.actual_conversion_rate > 0) {
      score += factors.actual_conversion_rate * 10 * 0.3; // Scale up conversion rate
    } else {
      score += 0.1; // Small bonus for untested accounts (exploration)
    }

    return Math.min(score, 1.0);
  }

  /**
   * Follower count scoring (10k-100k = sweet spot)
   */
  private getFollowerScore(followers: number): number {
    if (followers < 5000) return 0.2;        // Too small
    if (followers < 10000) return 0.5;       // Small but okay
    if (followers <= 50000) return 1.0;      // SWEET SPOT!
    if (followers <= 100000) return 0.9;     // Still good
    if (followers <= 200000) return 0.6;     // Getting too big
    return 0.3;                              // Too big, replies get buried
  }

  /**
   * Get reply strategy for target
   */
  private getReplyStrategy(target: OptimalReplyTarget): string {
    if (target.follower_overlap_score > 0.7) {
      return 'Add data/study to support their point';
    } else if (target.conversion_potential > 0.6) {
      return 'Share contrarian perspective with evidence';
    } else {
      return 'Ask thoughtful question to spark discussion';
    }
  }

  /**
   * Track reply performance
   */
  async trackReplyPerformance(reply: {
    target_handle: string;
    reply_id: string;
    engagement: number;
    followers_gained: number;
  }): Promise<void> {
    try {
      // Update target statistics
      const { data: target } = await this.supabase
        .from('ai_discovered_targets')
        .select('times_replied, total_engagement, total_followers_gained')
        .eq('handle', reply.target_handle)
        .single();

      if (!target) return;

      const newTimesReplied = (Number(target.times_replied) || 0) + 1;
      const newTotalEngagement = (Number(target.total_engagement) || 0) + reply.engagement;
      const newTotalFollowers = (Number(target.total_followers_gained) || 0) + reply.followers_gained;
      const newConversionRate = newTotalFollowers / newTimesReplied;

      await this.supabase
        .from('ai_discovered_targets')
        .update({
          times_replied: newTimesReplied,
          total_engagement: newTotalEngagement,
          total_followers_gained: newTotalFollowers,
          actual_conversion_rate: newConversionRate,
          updated_at: new Date().toISOString()
        })
        .eq('handle', reply.target_handle);

      console.log(`[SMART_REPLY] 📊 Updated stats for ${reply.target_handle}`);
      console.log(`[SMART_REPLY]    Conversion rate: ${(newConversionRate * 100).toFixed(2)}%`);

    } catch (error: any) {
      console.error('[SMART_REPLY] ❌ Error tracking performance:', error.message);
    }
  }

  /**
   * Analyze if reply timing is optimal
   */
  isOptimalReplyTiming(minutesSincePost: number): {
    is_optimal: boolean;
    visibility_multiplier: number;
    reason: string;
  } {
    if (minutesSincePost <= 5) {
      return {
        is_optimal: true,
        visibility_multiplier: 3.0,
        reason: '🔥 FIRST 5 MINUTES! Maximum visibility (3x)'
      };
    } else if (minutesSincePost <= 15) {
      return {
        is_optimal: true,
        visibility_multiplier: 2.0,
        reason: '✅ Within 15 min, high visibility (2x)'
      };
    } else if (minutesSincePost <= 30) {
      return {
        is_optimal: false,
        visibility_multiplier: 1.2,
        reason: '⚠️ 15-30 min, medium visibility'
      };
    } else {
      return {
        is_optimal: false,
        visibility_multiplier: 0.5,
        reason: '❌ Too late, reply will be buried'
      };
    }
  }

  /**
   * Get top performing targets (for prioritization)
   */
  async getTopTargets(limit: number = 5): Promise<OptimalReplyTarget[]> {
    try {
      const { data: targets } = await this.supabase
        .from('ai_discovered_targets')
        .select('*')
        .gte('followers', 10000)
        .lte('followers', 100000)
        .order('actual_conversion_rate', { ascending: false })
        .limit(limit);

      if (!targets || targets.length === 0) {
        return [];
      }

      return targets.map(t => ({
        handle: String(t.handle),
        username: String(t.username || String(t.handle).replace('@', '')),
        followers: Number(t.followers) || 0,
        engagement_rate: 0.05,
        follower_overlap_score: Number(t.conversion_potential) || 0.5,
        reply_window: 'early',
        rising_potential: 0.7,
        conversion_potential: Number(t.conversion_potential) || 0.5,
        times_replied: Number(t.times_replied) || 0,
        avg_engagement_on_replies: 10,
        avg_followers_gained: Number(t.total_followers_gained) || 0,
        actual_conversion_rate: Number(t.actual_conversion_rate) || 0,
        priority_score: Number(t.actual_conversion_rate) || 0.5
      }));

    } catch (error: any) {
      console.error('[SMART_REPLY] ❌ Error getting top targets:', error.message);
      return [];
    }
  }

  /* REMOVED: getDefaultOpportunities() - No more hardcoded accounts!
   * System now uses AI-driven discovery exclusively.
   * If no targets exist, AI discovery is triggered automatically.
   */
}

export const getSmartReplyTargeting = () => SmartReplyTargeting.getInstance();

