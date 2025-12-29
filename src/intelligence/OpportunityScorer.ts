/**
 * 🎯 OPPORTUNITY SCORER V2
 * 
 * Multi-dimensional scoring for reply opportunities
 * 
 * Scoring Factors:
 * - Base: Engagement (likes) - 0-40 points
 * - Boost: Proven account performance - 0-30 points
 * - Boost: Freshness (time since posted) - 0-20 points
 * - Penalty: Competition (reply count) - 0 to -10 points
 * 
 * Max Score: 90 points
 * 
 * Used by replyJob to select best opportunity from candidates
 */

import { getSupabaseClient } from '../db/index.js';

export class OpportunityScorer {
  /**
   * Calculate multi-dimensional opportunity score
   */
  static async calculateScore(opportunity: any): Promise<number> {
    let score = 0;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BASE SCORE: ENGAGEMENT (0-40 points)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Higher engagement = more visibility for our reply
    const likeCount = opportunity.like_count || 0;
    score += Math.min(likeCount / 2500, 40);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOST: PROVEN ACCOUNT (0-30 points)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Accounts that historically drive followers get priority
    const accountData = await this.getAccountPerformance(opportunity.target_username);
    if (accountData) {
      const avgFollowers = accountData.avg_followers_per_reply || 0;
      if (avgFollowers >= 15) {
        score += 30; // EXCELLENT performer
      } else if (avgFollowers >= 10) {
        score += 20; // GOOD performer
      } else if (avgFollowers >= 5) {
        score += 10; // MODERATE performer
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOST: FRESHNESS (0-20 points)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Fresh tweets get more visibility, older tweets get buried
    const postedAt = new Date(opportunity.tweet_posted_at);
    const ageMinutes = (Date.now() - postedAt.getTime()) / (1000 * 60);
    
    if (ageMinutes < 120) {
      score += 20; // <2 hours = ULTRA FRESH
    } else if (ageMinutes < 360) {
      score += 10; // <6 hours = FRESH
    } else if (ageMinutes < 1440) {
      score += 5; // <24 hours = ACTIVE
    }
    // Older than 24h gets no freshness boost

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PENALTY: COMPETITION (0 to -10 points)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Too many replies = our reply gets buried
    const replyCount = opportunity.reply_count || 0;
    if (replyCount > 500) {
      score -= 10; // SATURATED
    } else if (replyCount > 200) {
      score -= 5; // HIGH COMPETITION
    }
    // <200 replies gets no penalty

    // Ensure non-negative
    return Math.max(0, score);
  }

  /**
   * Get account performance data from discovered_accounts
   */
  private static async getAccountPerformance(username: string): Promise<any> {
    if (!username) return null;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('discovered_accounts')
      .select('avg_followers_per_reply, performance_tier, total_replies_count')
      .eq('username', username)
      .single();

    if (error || !data) return null;

    return data;
  }

  /**
   * Score multiple opportunities and return sorted by score
   */
  static async scoreAndRankOpportunities(opportunities: any[]): Promise<any[]> {
    if (!opportunities || opportunities.length === 0) {
      return [];
    }

    // Score all opportunities
    const scoredOpportunities = await Promise.all(
      opportunities.map(async (opp) => {
        const score = await this.calculateScore(opp);
        return {
          ...opp,
          opportunity_score_v2: score
        };
      })
    );

    // Sort by score descending
    scoredOpportunities.sort((a, b) => b.opportunity_score_v2 - a.opportunity_score_v2);

    return scoredOpportunities;
  }

  /**
   * Get scoring breakdown for an opportunity (for debugging)
   */
  static async getScoreBreakdown(opportunity: any): Promise<any> {
    const likeCount = opportunity.like_count || 0;
    const engagementScore = Math.min(likeCount / 2500, 40);

    const accountData = await this.getAccountPerformance(opportunity.target_username);
    let accountScore = 0;
    if (accountData) {
      const avgFollowers = accountData.avg_followers_per_reply || 0;
      if (avgFollowers >= 15) accountScore = 30;
      else if (avgFollowers >= 10) accountScore = 20;
      else if (avgFollowers >= 5) accountScore = 10;
    }

    const postedAt = new Date(opportunity.tweet_posted_at);
    const ageMinutes = (Date.now() - postedAt.getTime()) / (1000 * 60);
    let freshnessScore = 0;
    if (ageMinutes < 120) freshnessScore = 20;
    else if (ageMinutes < 360) freshnessScore = 10;
    else if (ageMinutes < 1440) freshnessScore = 5;

    const replyCount = opportunity.reply_count || 0;
    let competitionPenalty = 0;
    if (replyCount > 500) competitionPenalty = -10;
    else if (replyCount > 200) competitionPenalty = -5;

    const totalScore = Math.max(0, engagementScore + accountScore + freshnessScore + competitionPenalty);

    return {
      totalScore,
      breakdown: {
        engagement: engagementScore,
        account: accountScore,
        freshness: freshnessScore,
        competition: competitionPenalty
      },
      factors: {
        likeCount,
        accountAvgFollowers: accountData?.avg_followers_per_reply || 0,
        ageMinutes: Math.round(ageMinutes),
        replyCount
      }
    };
  }
}

