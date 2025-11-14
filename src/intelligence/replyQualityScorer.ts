/**
 * 🎯 REPLY QUALITY SCORER
 * 
 * Scores accounts and opportunities based on engagement rate, reach, and conversion potential
 * NO hardcoded limits - pure quality-based scoring
 */

import { getSupabaseClient } from '../db';

interface AccountMetrics {
  username: string;
  follower_count: number;
  avg_likes?: number;
  posts_per_day?: number;
  bio?: string;
}

interface TweetMetrics {
  like_count: number;
  reply_count: number;
  posted_minutes_ago: number;
  account_followers: number;
}

export class ReplyQualityScorer {
  private static instance: ReplyQualityScorer;
  
  private constructor() {}
  
  public static getInstance(): ReplyQualityScorer {
    if (!ReplyQualityScorer.instance) {
      ReplyQualityScorer.instance = new ReplyQualityScorer();
    }
    return ReplyQualityScorer.instance;
  }
  
  /**
   * Score an account (0-100) based on quality indicators
   */
  scoreAccount(account: AccountMetrics): number {
    let score = 0;
    
    // 1. Follower count (bigger = more reach) - 40 points max
    if (account.follower_count >= 100000) score += 40;
    else if (account.follower_count >= 50000) score += 30;
    else if (account.follower_count >= 10000) score += 20;
    else if (account.follower_count >= 5000) score += 10;
    
    // 2. Engagement rate (higher = better content) - 30 points max
    if (account.avg_likes && account.follower_count > 0) {
      const engagementRate = account.avg_likes / account.follower_count;
      if (engagementRate >= 0.03) score += 30;  // 3%+ is excellent
      else if (engagementRate >= 0.01) score += 20;  // 1%+ is good
      else if (engagementRate >= 0.005) score += 10;  // 0.5%+ is acceptable
    }
    
    // 3. Post frequency (active = more opportunities) - 15 points max
    if (account.posts_per_day) {
      if (account.posts_per_day >= 3) score += 15;
      else if (account.posts_per_day >= 1) score += 10;
      else if (account.posts_per_day >= 0.5) score += 5;
    }
    
    // 4. Health relevance - 15 points max
    if (account.bio) {
      const healthKeywords = ['health', 'fitness', 'wellness', 'nutrition', 'longevity', 'biohack', 'medical', 'doctor'];
      const bioLower = account.bio.toLowerCase();
      const relevanceScore = healthKeywords.filter(k => bioLower.includes(k)).length * 2;
      score += Math.min(15, relevanceScore);
    }
    
    return Math.min(100, score);  // 0-100 scale
  }
  
  /**
   * Calculate engagement rate for a specific tweet
   */
  calculateEngagementRate(likes: number, accountFollowers: number): number {
    if (accountFollowers === 0) return 0;
    return likes / accountFollowers;
  }
  
  /**
   * Calculate tier based on absolute engagement + reply competition.
   * 
   * Updated to align with the new 8-tier system used by replyOpportunityHarvester:
   * - FRESH tiers capture 500-1K like tweets that are exploding now
   * - TRENDING tiers capture 2K-5K like tweets with strong momentum
   * - VIRAL tiers capture 10K-25K like tweets (core targets)
   * - MEGA tiers capture 50K+ like tweets (bonus reach)
   * 
   * Reply count guards prevent us from diving into buried replies.
   */
  calculateTier(metrics: TweetMetrics):
    | 'MEGA+'
    | 'MEGA'
    | 'VIRAL+'
    | 'VIRAL'
    | 'TRENDING+'
    | 'TRENDING'
    | 'FRESH+'
    | 'FRESH'
    | 'golden'
    | 'good'
    | 'acceptable'
    | null {
    const likes = Number(metrics.like_count || 0);
    const replies = Number(metrics.reply_count || 0);
    const tweetAgeMinutes = Number.isFinite(metrics.posted_minutes_ago)
      ? Number(metrics.posted_minutes_ago)
      : Number.MAX_SAFE_INTEGER;

    // Ignore anything older than 72 hours – beyond that window, conversation is stale.
    if (tweetAgeMinutes > 72 * 60) return null;

    // Top tiers – elite viral conversations
    if (likes >= 100000 && replies <= 1600) return 'MEGA+';
    if (likes >= 50000 && replies <= 1400) return 'MEGA';
    if (likes >= 25000 && replies <= 900) return 'VIRAL+';
    if (likes >= 10000 && replies <= 700) return 'VIRAL';

    // Strong trending tweets
    if (likes >= 5000 && replies <= 500) return 'TRENDING+';
    if (likes >= 2000 && replies <= 350) return 'TRENDING';

    // Fresh conversations still heating up
    if (likes >= 1000 && replies <= 250) return 'FRESH+';
    if (likes >= 500 && replies <= 180) return 'FRESH';

    // Legacy tiers kept for backwards compatibility / long tail
    if (likes >= 300 && replies <= 140) return 'golden';
    if (likes >= 150 && replies <= 110) return 'good';
    if (likes >= 80 && replies <= 80) return 'acceptable';

    return null;
  }
  
  /**
   * Calculate momentum score (likes per minute)
   */
  calculateMomentum(likes: number, minutesAgo: number): number {
    if (minutesAgo === 0) return likes;
    return likes / minutesAgo;
  }
  
  /**
   * Update account quality scores in database
   */
  async updateAccountScores(accounts: AccountMetrics[]): Promise<void> {
    const supabase = getSupabaseClient();
    
    for (const account of accounts) {
      const qualityScore = this.scoreAccount(account);
      const engagementRate = account.avg_likes && account.follower_count > 0 
        ? account.avg_likes / account.follower_count 
        : null;
      
      await supabase
        .from('discovered_accounts')
        .update({
          quality_score: qualityScore,
          engagement_rate: engagementRate,
          scrape_priority: qualityScore, // Initially, priority = quality
          last_updated: new Date().toISOString()
        })
        .eq('username', account.username);
    }
    
    console.log(`[QUALITY_SCORER] ✅ Updated quality scores for ${accounts.length} accounts`);
  }
}

export function getReplyQualityScorer(): ReplyQualityScorer {
  return ReplyQualityScorer.getInstance();
}

