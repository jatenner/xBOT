/**
 * 🤖 AI REPLY DECISION ENGINE
 * AI decides WHO to reply to, WHEN, and HOW - no hard-coded rules
 * 
 * Decisions Made:
 * - Which account to target (from discovered pool)
 * - Which specific tweet to reply to
 * - Which generator personality to use
 * - Optimal timing for reply
 * - Expected ROI prediction
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';
import { aiAccountDiscovery } from './accountDiscovery';

export interface ReplyOpportunity {
  target_username: string;
  target_followers: number;
  tweet_url: string;
  tweet_content: string;
  tweet_engagement: number;
  opportunity_score: number; // 0-100
  recommended_generator: string;
  recommended_timing: number; // Minutes to wait
  predicted_impressions: number;
  predicted_profile_clicks: number;
  predicted_follows: number;
  reasoning: string;
}

export interface ReplyDecision {
  should_reply: boolean;
  opportunity?: ReplyOpportunity;
  reason: string;
}

export class AIReplyDecisionEngine {
  private static instance: AIReplyDecisionEngine;
  
  private constructor() {}
  
  static getInstance(): AIReplyDecisionEngine {
    if (!AIReplyDecisionEngine.instance) {
      AIReplyDecisionEngine.instance = new AIReplyDecisionEngine();
    }
    return AIReplyDecisionEngine.instance;
  }

  /**
   * MAIN DECISION LOOP - AI decides best reply opportunities (REAL TWITTER SCRAPING)
   */
  async findBestOpportunities(count: number = 10): Promise<ReplyOpportunity[]> {
    console.log(`[AI_DECISION] 🤖 Finding top ${count} reply opportunities with REAL scraping...`);
    
    try {
      // Step 1: Get current context
      const context = await this.getCurrentContext();
      
      // Step 2: Get discovered accounts
      const supabase = getSupabaseClient();
      
      // Ensure table exists
      const { ensureTableOrSkip } = await import('../db/ensureDiscoveredAccounts');
      const tableReady = await ensureTableOrSkip('REPLY_DECISION');
      
      let accounts = null;
      if (tableReady) {
        const { data } = await supabase
          .from('discovered_accounts')
          .select('username, follower_count')
          .gte('follower_count', 10000)
          .lte('follower_count', 500000)
          .order('last_updated', { ascending: false })
          .limit(20);
        accounts = data;
      }
      
      if (!accounts || accounts.length === 0) {
        console.warn('[AI_DECISION] ❌ No accounts in discovered_accounts table!');
        console.log('[AI_DECISION] 💡 Triggering emergency account discovery...');
        await aiAccountDiscovery.runDiscoveryLoop();
        console.log('[AI_DECISION] ⏭️ Returning empty - next reply cycle will have accounts');
        return [];
      }
      
      console.log(`[AI_DECISION] ✅ Found ${accounts.length} discovered accounts in database`);
      
      // Step 3: Scrape real reply opportunities from top accounts
      // 🔥 SCALE: Scrape 15 accounts per cycle (was 5) → 15 × 20 tweets = 300 opportunities!
      const accountsToScrape = Math.min(15, accounts.length);
      console.log(`[AI_DECISION] 🌐 Scraping top ${accountsToScrape} accounts (from ${accounts.length} total pool) for reply opportunities...`);
      const { realTwitterDiscovery } = await import('./realTwitterDiscovery');
      const allOpportunities: any[] = [];
      
      for (const account of accounts.slice(0, accountsToScrape)) {
        try {
          console.log(`[AI_DECISION]   → Scraping @${account.username} (${account.follower_count?.toLocaleString() || 'unknown'} followers)...`);
          const opps = await realTwitterDiscovery.findReplyOpportunitiesFromAccount(String(account.username));
          allOpportunities.push(...opps);
          console.log(`[AI_DECISION]     ✓ Found ${opps.length} opportunities`);
          
          // Small delay between accounts
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.error(`[AI_DECISION]     ✗ Failed to scrape @${account.username}:`, error.message);
        }
      }
      
      console.log(`[AI_DECISION] 📊 Total opportunities scraped: ${allOpportunities.length}`);
      
      if (allOpportunities.length === 0) {
        console.warn('[AI_DECISION] ⚠️ No reply opportunities found - tweets may be too old or engagement too low');
        console.log('[AI_DECISION] 💡 Will try again next cycle');
        return [];
      }
      
      // Step 4: Store opportunities in database
      await realTwitterDiscovery.storeOpportunities(allOpportunities);
      
      // Step 5: Filter and rank opportunities
      const filteredOpps = await this.filterRecentTargets(allOpportunities);
      const rankedOpportunities = await this.convertToReplyOpportunities(filteredOpps);
      
      // Step 6: Return top N
      const topOpportunities = rankedOpportunities.slice(0, count);
      
      console.log(`[AI_DECISION] ✅ Returning top ${topOpportunities.length} opportunities:`);
      for (const opp of topOpportunities.slice(0, 3)) {
        console.log(`  • @${opp.target_username}: ${opp.tweet_content.substring(0, 50)}... (score: ${opp.opportunity_score})`);
      }
      if (topOpportunities.length > 3) {
        console.log(`  • ... and ${topOpportunities.length - 3} more`);
      }
      
      return topOpportunities;
      
    } catch (error: any) {
      console.error('[AI_DECISION] ❌ Decision engine failed:', error.message);
      return [];
    }
  }
  
  /**
   * Convert scraped opportunities to ReplyOpportunity format
   */
  private async convertToReplyOpportunities(opportunities: any[]): Promise<ReplyOpportunity[]> {
    return opportunities.map(opp => ({
      target_username: opp.account_username || opp.tweet_author,
      target_followers: 50000, // Estimated
      tweet_url: opp.tweet_url,
      tweet_content: opp.tweet_content,
      tweet_engagement: opp.like_count,
      opportunity_score: opp.opportunity_score,
      recommended_generator: 'research_backed_explainer',
      recommended_timing: 0,
      predicted_impressions: Math.round(opp.like_count * 10),
      predicted_profile_clicks: Math.round(opp.like_count * 0.05),
      predicted_follows: Math.round(opp.like_count * 0.01),
      reasoning: `High engagement (${opp.like_count} likes), low competition (${opp.reply_count} replies)`
    }));
  }

  /**
   * Get current context for decision making
   */
  private async getCurrentContext(): Promise<any> {
    const supabase = getSupabaseClient();
    
    // Get our current follower count
    const { data: metrics } = await supabase
      .from('growth_metrics')
      .select('followers')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const ourFollowers = Number(metrics?.followers) || 31;
    
    // Get recent reply performance
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReplies } = await supabase
      .from('posted_decisions')
      .select('*')
      .eq('decision_type', 'reply')
      .gte('posted_at', oneWeekAgo);
    
    // Get what worked best recently
    const { data: topPerformers } = await supabase
      .from('posted_decisions')
      .select('target_username, generator_used, avg_engagement:outcomes(engagement_rate)')
      .eq('decision_type', 'reply')
      .gte('posted_at', oneWeekAgo)
      .order('outcomes.engagement_rate', { ascending: false })
      .limit(10);
    
    return {
      our_followers: ourFollowers,
      total_replies_this_week: recentReplies?.length || 0,
      top_performing_generators: topPerformers || [],
      current_hour: new Date().getHours(),
      day_of_week: new Date().getDay(),
      growth_stage: this.determineGrowthStage(ourFollowers)
    };
  }

  /**
   * Determine growth stage based on follower count
   */
  private determineGrowthStage(followers: number): string {
    if (followers < 100) return 'bootstrap';
    if (followers < 1000) return 'early_growth';
    if (followers < 10000) return 'scaling';
    return 'established';
  }

  /**
   * Filter targets we haven't replied to recently
   */
  private async filterRecentTargets(targets: any[]): Promise<any[]> {
    const supabase = getSupabaseClient();
    
    // Get accounts we've replied to in last 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTargets } = await supabase
      .from('posted_decisions')
      .select('target_username')
      .eq('decision_type', 'reply')
      .gte('posted_at', threeDaysAgo);
    
    const recentUsernames = new Set(
      (recentTargets || []).map(r => String(r.target_username || '').toLowerCase())
    );
    
    // 🎯 USER REQUIREMENT: Only reply to tweets <24 hours old
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Filter: (1) Not recently replied to, (2) Tweet <24h old
    const available = targets.filter(target => {
      // Filter 1: Remove accounts we've recently replied to
      if (recentUsernames.has(target.username?.toLowerCase())) {
        return false;
      }
      
      // Filter 2: Only tweets <24h old
      if (target.tweet_posted_at) {
        const tweetAge = new Date(target.tweet_posted_at).getTime();
        if (Date.now() - tweetAge > 24 * 60 * 60 * 1000) {
          console.log(`[AI_DECISION]   ⏭️ Skipping @${target.username} - tweet too old (${Math.round((Date.now() - tweetAge) / 3600000)}h ago)`);
          return false;
        }
      } else {
        // If no timestamp, assume it's fresh (from live scraping)
        console.log(`[AI_DECISION]   ⚠️ No timestamp for @${target.username} - assuming fresh`);
      }
      
      return true;
    });
    
    console.log(`[AI_DECISION] 🔍 Filtered ${targets.length} → ${available.length} (removed ${targets.length - available.length} recent/old targets)`);
    
    return available;
  }

  /**
   * Use AI to rank opportunities intelligently
   */
  private async rankOpportunitiesWithAI(targets: any[], context: any): Promise<ReplyOpportunity[]> {
    console.log('[AI_DECISION] 🤖 Using AI to rank opportunities...');
    
    // For each target, create an opportunity
    const opportunities: ReplyOpportunity[] = [];
    
    for (const target of targets.slice(0, 50)) { // Analyze top 50
      const opportunity = await this.createOpportunity(target, context);
      if (opportunity.opportunity_score >= 50) { // Minimum threshold
        opportunities.push(opportunity);
      }
    }
    
    // Sort by opportunity score
    opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);
    
    return opportunities;
  }

  /**
   * Create opportunity with AI-powered scoring
   */
  private async createOpportunity(target: any, context: any): Promise<ReplyOpportunity> {
    // Calculate opportunity score based on multiple factors
    const followerScore = this.scoreFollowerCount(target.follower_count, context.our_followers);
    const qualityScore = target.final_score || 50;
    const timingScore = this.scoreOptimalTiming(context.current_hour);
    const growthFitScore = this.scoreGrowthFit(target.follower_count, context.growth_stage);
    
    const opportunityScore = Math.round(
      followerScore * 0.3 +
      qualityScore * 0.3 +
      timingScore * 0.2 +
      growthFitScore * 0.2
    );
    
    // Recommend generator based on target's content style
    const recommendedGenerator = await this.recommendGenerator(target, context);
    
    // Calculate predicted outcomes
    const predictions = this.predictOutcomes(target, context, opportunityScore);
    
    // Determine optimal reply timing
    const recommendedTiming = this.calculateOptimalTiming(target, context);
    
    return {
      target_username: target.username,
      target_followers: target.follower_count || 0,
      tweet_url: '', // Will be filled when actual tweet is found
      tweet_content: '',
      tweet_engagement: 0,
      opportunity_score: opportunityScore,
      recommended_generator: recommendedGenerator,
      recommended_timing: recommendedTiming,
      predicted_impressions: predictions.impressions,
      predicted_profile_clicks: predictions.profile_clicks,
      predicted_follows: predictions.follows,
      reasoning: this.generateReasoning(target, opportunityScore, recommendedGenerator)
    };
  }

  /**
   * Score follower count relative to our size
   */
  private scoreFollowerCount(targetFollowers: number, ourFollowers: number): number {
    // Sweet spot: 10-100x our size
    const ratio = targetFollowers / Math.max(ourFollowers, 1);
    
    if (ratio >= 10 && ratio <= 100) return 100; // Perfect range
    if (ratio >= 5 && ratio <= 200) return 80;   // Good range
    if (ratio >= 2 && ratio <= 500) return 60;   // Acceptable
    if (ratio < 2) return 20; // Too small
    if (ratio > 1000) return 30; // Too big, replies get buried
    
    return 50;
  }

  /**
   * Score timing based on hour of day
   */
  private scoreOptimalTiming(hour: number): number {
    // Best hours: 7-9am EST (high engagement), 6-8pm EST (evening)
    const est_hour = hour; // Assume EST for now
    
    if (est_hour >= 7 && est_hour <= 9) return 100;   // Morning peak
    if (est_hour >= 18 && est_hour <= 20) return 90;  // Evening peak
    if (est_hour >= 11 && est_hour <= 14) return 70;  // Lunch time
    if (est_hour >= 21 || est_hour <= 6) return 30;   // Late night/early morning
    
    return 60;
  }

  /**
   * Score how well target fits our growth stage
   */
  private scoreGrowthFit(targetFollowers: number, growthStage: string): number {
    switch (growthStage) {
      case 'bootstrap': // <100 followers - target micro influencers
        if (targetFollowers >= 10000 && targetFollowers <= 50000) return 100;
        if (targetFollowers >= 5000 && targetFollowers <= 100000) return 80;
        return 50;
        
      case 'early_growth': // 100-1k followers - target small-mid influencers
        if (targetFollowers >= 20000 && targetFollowers <= 200000) return 100;
        if (targetFollowers >= 10000 && targetFollowers <= 500000) return 80;
        return 50;
        
      case 'scaling': // 1k-10k followers - target mid-large influencers
        if (targetFollowers >= 50000 && targetFollowers <= 500000) return 100;
        if (targetFollowers >= 20000 && targetFollowers <= 1000000) return 80;
        return 50;
        
      case 'established': // 10k+ followers - can target anyone
        return 80;
        
      default:
        return 50;
    }
  }

  /**
   * Recommend which generator to use based on target and context
   */
  private async recommendGenerator(target: any, context: any): Promise<string> {
    // Check if we have performance data
    const topPerformers = context.top_performing_generators || [];
    
    if (topPerformers.length > 0) {
      // Use best performing generator
      return topPerformers[0].generator_used || 'data_nerd';
    }
    
    // Default intelligent matching
    const bio = target.bio?.toLowerCase() || '';
    
    if (bio.includes('research') || bio.includes('phd') || bio.includes('science')) {
      return 'data_nerd';
    }
    if (bio.includes('coach') || bio.includes('trainer')) {
      return 'coach';
    }
    if (bio.includes('doctor') || bio.includes('md')) {
      return 'thought_leader';
    }
    
    // Default to data_nerd (research-heavy, broadly applicable)
    return 'data_nerd';
  }

  /**
   * Predict outcomes for this opportunity
   */
  private predictOutcomes(target: any, context: any, opportunityScore: number): any {
    const followers = target.follower_count || 0;
    
    // Base predictions on opportunity score and target size
    const impressionRate = opportunityScore / 100 * 0.05; // 0-5% of their followers
    const clickRate = 0.02; // 2% of impressions click profile
    const followRate = 0.1; // 10% of clicks convert to follows
    
    const impressions = Math.round(followers * impressionRate);
    const clicks = Math.round(impressions * clickRate);
    const follows = Math.round(clicks * followRate);
    
    return {
      impressions,
      profile_clicks: clicks,
      follows
    };
  }

  /**
   * Calculate optimal timing in minutes
   */
  private calculateOptimalTiming(target: any, context: any): number {
    const followers = target.follower_count || 0;
    
    // Larger accounts = wait longer (more initial engagement)
    if (followers > 500000) return 45; // Wait 45 min
    if (followers > 100000) return 20; // Wait 20 min
    if (followers > 10000) return 5;   // Wait 5 min
    
    return 2; // Reply immediately for smaller accounts
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(target: any, score: number, generator: string): string {
    const followers = target.follower_count || 0;
    return `Score ${score}/100: ${followers.toLocaleString()} followers, using ${generator} generator for optimal engagement`;
  }
}

// Singleton export
export const aiReplyDecisionEngine = AIReplyDecisionEngine.getInstance();

