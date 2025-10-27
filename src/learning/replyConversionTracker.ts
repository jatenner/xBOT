/**
 * 📊 REPLY CONVERSION TRACKER
 * 
 * Tracks which replies drive followers and optimizes account targeting
 * Learning loop: reply → measure results → update account priorities
 */

import { getSupabaseClient } from '../db/index';

export class ReplyConversionTracker {
  private static instance: ReplyConversionTracker;
  private supabase = getSupabaseClient();
  
  private constructor() {}
  
  public static getInstance(): ReplyConversionTracker {
    if (!ReplyConversionTracker.instance) {
      ReplyConversionTracker.instance = new ReplyConversionTracker();
    }
    return ReplyConversionTracker.instance;
  }
  
  /**
   * Track reply performance after 2 hours (enough time for initial engagement)
   */
  async trackPendingReplies(): Promise<void> {
    console.log('[CONVERSION_TRACKER] 📊 Checking pending replies for performance tracking...');
    
    try {
      // Find replies posted 2-4 hours ago that haven't been measured
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      const { data: pendingReplies } = await this.supabase
        .from('content_metadata')
        .select('decision_id, posted_at, content')
        .eq('decision_type', 'reply')
        .gte('posted_at', fourHoursAgo.toISOString())
        .lte('posted_at', twoHoursAgo.toISOString())
        .is('tracked_for_conversion', null);
      
      if (!pendingReplies || pendingReplies.length === 0) {
        console.log('[CONVERSION_TRACKER] ✅ No pending replies to track');
        return;
      }
      
      console.log(`[CONVERSION_TRACKER] 🎯 Found ${pendingReplies.length} replies to track`);
      
      for (const reply of pendingReplies) {
        await this.trackReplyPerformance(String(reply.decision_id));
      }
      
      console.log('[CONVERSION_TRACKER] ✅ Tracking complete');
      
    } catch (error: any) {
      console.error('[CONVERSION_TRACKER] ❌ Error tracking replies:', error.message);
    }
  }
  
  /**
   * Track performance for a specific reply
   */
  async trackReplyPerformance(replyDecisionId: string): Promise<void> {
    try {
      // Get opportunity details
      const { data: opportunity } = await this.supabase
        .from('reply_opportunities')
        .select('*')
        .eq('reply_decision_id', replyDecisionId)
        .single();
      
      if (!opportunity) {
        console.warn(`[CONVERSION_TRACKER] ⚠️ No opportunity found for decision ${replyDecisionId}`);
        return;
      }
      
      // Get current follower count
      const { data: metrics } = await this.supabase
        .from('scraped_metrics')
        .select('followers')
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();
      
      const currentFollowers = Number(metrics?.followers) || 0;
      
      // Get follower count at time of reply
      const { data: reply } = await this.supabase
        .from('content_metadata')
        .select('posted_at')
        .eq('decision_id', replyDecisionId)
        .single();
      
      if (!reply) return;
      
      const { data: historicalMetrics } = await this.supabase
        .from('scraped_metrics')
        .select('followers')
        .lte('scraped_at', reply.posted_at)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();
      
      const followersBefore = Number(historicalMetrics?.followers) || currentFollowers;
      const followersGained = Math.max(0, currentFollowers - followersBefore);
      
      // Store conversion data
      await this.supabase.from('reply_conversions').insert({
        reply_decision_id: replyDecisionId,
        target_account: opportunity.target_username,
        target_tweet_id: opportunity.target_tweet_id,
        opportunity_tier: opportunity.tier || 'unknown',
        engagement_rate: opportunity.engagement_rate,
        followers_gained: followersGained,
        replied_at: reply.posted_at,
        measured_at: new Date().toISOString()
      });
      
      // Mark as tracked
      await this.supabase
        .from('content_metadata')
        .update({ tracked_for_conversion: true })
        .eq('decision_id', replyDecisionId);
      
      console.log(`[CONVERSION_TRACKER] 📊 @${opportunity.target_username} (${opportunity.tier}): +${followersGained} followers`);
      
      // Update account conversion stats
      await this.updateAccountConversionRate(String(opportunity.target_username), followersGained);
      
    } catch (error: any) {
      console.error(`[CONVERSION_TRACKER] ❌ Error tracking reply ${replyDecisionId}:`, error.message);
    }
  }
  
  /**
   * Update account conversion rate based on new data
   */
  async updateAccountConversionRate(username: string, followersGained: number): Promise<void> {
    try {
      // Get current stats
      const { data: account } = await this.supabase
        .from('discovered_accounts')
        .select('total_replies_to_account, followers_gained_from_account')
        .eq('username', username)
        .single();
      
      if (!account) return;
      
      const totalReplies = (Number(account.total_replies_to_account) || 0) + 1;
      const totalFollowers = (Number(account.followers_gained_from_account) || 0) + followersGained;
      const conversionRate = totalReplies > 0 ? totalFollowers / totalReplies : 0;
      
      // Update account
      await this.supabase
        .from('discovered_accounts')
        .update({
          total_replies_to_account: totalReplies,
          followers_gained_from_account: totalFollowers,
          conversion_rate: conversionRate
        })
        .eq('username', username);
      
      console.log(`[CONVERSION_TRACKER] 📈 @${username}: ${totalReplies} replies → ${totalFollowers} followers (${conversionRate.toFixed(2)} avg)`);
      
    } catch (error: any) {
      console.error(`[CONVERSION_TRACKER] ❌ Error updating account stats:`, error.message);
    }
  }
  
  /**
   * Update account priorities based on conversion performance
   */
  async updateAccountPriorities(): Promise<void> {
    console.log('[CONVERSION_TRACKER] 🎯 Updating account priorities based on conversion data...');
    
    try {
      // Get all accounts with replies
      const { data: accounts } = await this.supabase
        .from('discovered_accounts')
        .select('username, quality_score, conversion_rate, total_replies_to_account')
        .gte('total_replies_to_account', 1);
      
      if (!accounts || accounts.length === 0) {
        console.log('[CONVERSION_TRACKER] ⚠️ No accounts with conversion data yet');
        return;
      }
      
      // Update priority: quality_score + conversion boost
      for (const account of accounts) {
        const qualityScore = Number(account.quality_score) || 50;
        const conversionRate = Number(account.conversion_rate) || 0;
        
        // Boost priority by up to 30 points based on conversion
        const conversionBoost = Math.min(30, conversionRate * 10);
        const newPriority = Math.min(100, qualityScore + conversionBoost);
        
        await this.supabase
          .from('discovered_accounts')
          .update({ scrape_priority: Math.round(newPriority) })
          .eq('username', account.username);
      }
      
      console.log(`[CONVERSION_TRACKER] ✅ Updated priorities for ${accounts.length} accounts`);
      
    } catch (error: any) {
      console.error('[CONVERSION_TRACKER] ❌ Error updating priorities:', error.message);
    }
  }
}

export function getReplyConversionTracker(): ReplyConversionTracker {
  return ReplyConversionTracker.getInstance();
}

