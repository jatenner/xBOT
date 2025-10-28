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
   * Calculate tier based on ABSOLUTE ENGAGEMENT (likes OR comments)
   * Account size is IRRELEVANT - only engagement matters for visibility
   * 
   * 3-TIER SYSTEM: Focus on high-engagement tweets only
   * Tier 1 (Platinum): 10K+ likes - ~25/day → Replied to FIRST
   * Tier 2 (Diamond): 5K+ likes - ~50/day → Replied to SECOND  
   * Tier 3 (Golden): 2K+ likes - ~150/day → Replied to THIRD
   * Total: ~225/day (2.3x buffer for 96 replies/day needed)
   */
  calculateTier(metrics: TweetMetrics): 'golden' | 'good' | 'acceptable' | null {
    const absoluteLikes = metrics.like_count;
    const absoluteComments = metrics.reply_count;
    const tweetAge = metrics.posted_minutes_ago;
    
    // Only consider tweets from last 24 hours
    if (tweetAge > 1440) return null;
    
    // ═══════════════════════════════════════════════════════════
    // 3-TIER SYSTEM (All stored as "golden" but prioritized by likes)
    // ═══════════════════════════════════════════════════════════
    
    // TIER 1 - PLATINUM: 10,000+ likes OR 1,000+ comments
    // Expected: ~20-30 per day | Visibility: 100K+ people
    if (absoluteLikes >= 10000 || absoluteComments >= 1000) {
      return 'golden';
    }
    
    // TIER 2 - DIAMOND: 5,000+ likes OR 500+ comments
    // Expected: ~40-60 per day | Visibility: 50K+ people
    if (absoluteLikes >= 5000 || absoluteComments >= 500) {
      return 'golden';
    }
    
    // TIER 3 - GOLDEN: 2,000+ likes OR 200+ comments
    // Expected: ~100-200 per day | Visibility: 20K+ people
    if (absoluteLikes >= 2000 || absoluteComments >= 200) {
      return 'golden';
    }
    
    // Below 2K likes = REJECTED (not enough visibility)
    // We have 225+ opportunities/day above 2K, don't need anything below
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

