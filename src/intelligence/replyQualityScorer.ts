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
   * Calculate tier based on ABSOLUTE ENGAGEMENT (likes) + REPLY COMPETITION
   * 🔥 MEGA-VIRAL ONLY STRATEGY: Target truly massive health tweets for maximum exposure
   * 
   * 5-TIER SYSTEM: Ultra-high-impact tweets only (MINIMUM 10K likes)
   * TITAN (golden): 250K+ likes, <2000 replies → 2.5M+ impressions (absolute mega-viral)
   * ULTRA (golden): 100K+ likes, <1500 replies → 1M+ impressions (massive viral)
   * MEGA (golden): 50K+ likes, <1000 replies → 500K+ impressions (super viral)
   * SUPER (good): 25K+ likes, <800 replies → 250K+ impressions (very viral)
   * HIGH (acceptable): 10K+ likes, <500 replies → 100K+ impressions (viral minimum)
   * 
   * HARD FLOOR: Nothing under 10K likes accepted (ensures massive reach)
   */
  calculateTier(metrics: TweetMetrics): 'golden' | 'good' | 'acceptable' | null {
    const absoluteLikes = metrics.like_count;
    const absoluteReplies = metrics.reply_count;
    const tweetAge = metrics.posted_minutes_ago;
    
    // Only consider tweets from last 24 hours
    if (tweetAge > 1440) return null;
    
    // 🚫 HARD FLOOR: Reject anything under 10K likes
    if (absoluteLikes < 10000) return null;
    
    // ═══════════════════════════════════════════════════════════
    // 5-TIER MEGA-VIRAL SYSTEM
    // MINIMUM 10K | GOAL 50K-250K+ for massive exposure
    // ═══════════════════════════════════════════════════════════
    
    // TIER 1 - TITAN: 250,000+ likes, <2000 replies
    // Visibility: 2.5M+ impressions | Your reply seen by millions
    if (absoluteLikes >= 250000 && absoluteReplies < 2000) {
      return 'golden';
    }
    
    // TIER 2 - ULTRA: 100,000+ likes, <1500 replies
    // Visibility: 1M+ impressions | Massive viral reach
    if (absoluteLikes >= 100000 && absoluteReplies < 1500) {
      return 'golden';
    }
    
    // TIER 3 - MEGA: 50,000+ likes, <1000 replies
    // Visibility: 500K+ impressions | Super viral content
    if (absoluteLikes >= 50000 && absoluteReplies < 1000) {
      return 'golden';
    }
    
    // TIER 4 - SUPER: 25,000+ likes, <800 replies
    // Visibility: 250K+ impressions | Very high viral reach
    if (absoluteLikes >= 25000 && absoluteReplies < 800) {
      return 'good';
    }
    
    // TIER 5 - HIGH: 10,000+ likes, <500 replies
    // Visibility: 100K+ impressions | Minimum viral threshold
    if (absoluteLikes >= 10000 && absoluteReplies < 500) {
      return 'acceptable';
    }
    
    // Too many replies = buried, even with high likes
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

