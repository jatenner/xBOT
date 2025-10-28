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
   */
  calculateTier(metrics: TweetMetrics): 'golden' | 'good' | 'acceptable' | null {
    const absoluteLikes = metrics.like_count;
    const absoluteComments = metrics.reply_count;
    const tweetAge = metrics.posted_minutes_ago;
    
    // ═══════════════════════════════════════════════════════════
    // ABSOLUTE ENGAGEMENT SYSTEM (Follower-count agnostic)
    // More engagement = More people saw it = More visibility for your reply
    // 
    // PRIORITY ORDER: Higher tiers checked first, falls back to lower tiers
    // ═══════════════════════════════════════════════════════════
    
    // MEGA VIRAL: Insane visibility (these exist - Huberman, Hyman, etc.)
    // 10K+ likes = 100K+ people | 1K+ comments = MASSIVE conversation
    if ((absoluteLikes >= 10000 || absoluteComments >= 1000) && 
        tweetAge <= 1440) {  // Posted in last 24 hours
      return 'golden';  // Still "golden" in DB but highest priority
    }
    
    // SUPER VIRAL: Huge visibility
    // 5K+ likes = 50K+ people | 500+ comments = huge conversation
    if ((absoluteLikes >= 5000 || absoluteComments >= 500) && 
        tweetAge <= 1440) {
      return 'golden';
    }
    
    // VIRAL: Very high visibility
    // 2K+ likes = 20K+ people | 200+ comments = viral conversation
    if ((absoluteLikes >= 2000 || absoluteComments >= 200) && 
        tweetAge <= 1440) {
      return 'golden';
    }
    
    // GOLDEN: High visibility tweets
    // 800+ likes = ~8,000 people saw it | 80+ comments = very active conversation
    if ((absoluteLikes >= 800 || absoluteComments >= 80) && 
        tweetAge <= 1440) {  // Posted in last 24 hours
      return 'golden';
    }
    
    // GOOD: Strong visibility tweets (FALLBACK if golden pool too small)
    // 300+ likes = ~3,000 people saw it | 30+ comments = active discussion
    if ((absoluteLikes >= 300 || absoluteComments >= 30) && 
        tweetAge <= 1440) {  // Posted in last 24 hours
      return 'good';
    }
    
    // ACCEPTABLE: Decent visibility tweets (FALLBACK if good pool too small)
    // 100+ likes = ~1,000 people saw it | 10+ comments = some engagement
    if ((absoluteLikes >= 100 || absoluteComments >= 10) && 
        tweetAge <= 1440) {  // Posted in last 24 hours
      return 'acceptable';
    }
    
    // REJECT: Low visibility (not worth replying)
    // <100 likes = too few people looking
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

