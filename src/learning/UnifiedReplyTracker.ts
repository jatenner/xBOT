/**
 * 🎯 UNIFIED REPLY TRACKER
 * 
 * Consolidates all reply performance tracking into a single system.
 * Replaces fragmented tracking across multiple modules.
 * 
 * Consolidates:
 * - ReplyLearningSystem (in-memory patterns)
 * - ReplyConversionTracker (database tracking)
 * - StrategicReplySystem (performance tracking)
 * - SmartReplyTargeting (target statistics)
 * 
 * Single source of truth for all reply performance data.
 */

import { getSupabaseClient } from '../db';
import type { GeneratorType } from '../scheduling/personalityScheduler';

export interface ReplyPerformanceData {
  reply_id: string;
  decision_id: string;
  target_account: string;
  target_tweet_id: string;
  generator_used: GeneratorType;
  opportunity_tier?: 'golden' | 'good' | 'acceptable';
  
  // Performance metrics
  followers_gained: number;
  reply_likes: number;
  reply_retweets?: number;
  reply_impressions?: number;
  profile_clicks?: number;
  
  // Timing
  posted_at: string;
  measured_at?: string;
}

export interface GeneratorPerformance {
  generator: GeneratorType;
  account: string;
  total_replies: number;
  avg_followers_gained: number;
  avg_profile_clicks: number;
  avg_engagement: number;
  confidence: number; // 0-1 based on sample size
  last_used: string;
}

export interface AccountConversion {
  account: string;
  total_replies: number;
  total_followers_gained: number;
  conversion_rate: number; // followers per reply
  best_generator?: GeneratorType;
  last_replied: string;
}

export class UnifiedReplyTracker {
  private static instance: UnifiedReplyTracker;
  private supabase = getSupabaseClient();

  // In-memory cache for performance
  private generatorCache = new Map<string, GeneratorPerformance>();
  private accountCache = new Map<string, AccountConversion>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  private constructor() {
    // Load initial cache
    this.refreshCache().catch(err => 
      console.error('[UNIFIED_TRACKER] Failed to load initial cache:', err)
    );
  }

  public static getInstance(): UnifiedReplyTracker {
    if (!UnifiedReplyTracker.instance) {
      UnifiedReplyTracker.instance = new UnifiedReplyTracker();
    }
    return UnifiedReplyTracker.instance;
  }

  /**
   * Track reply performance - MAIN ENTRY POINT
   * Call this after a reply is posted and metrics are collected
   */
  public async trackReplyPerformance(data: ReplyPerformanceData): Promise<void> {
    console.log(`[UNIFIED_TRACKER] 📊 Tracking reply to @${data.target_account}`);
    console.log(`[UNIFIED_TRACKER]   Generator: ${data.generator_used}`);
    console.log(`[UNIFIED_TRACKER]   Followers gained: ${data.followers_gained}`);
    console.log(`[UNIFIED_TRACKER]   Engagement: ${data.reply_likes} likes`);

    try {
      // Step 1: Store in reply_conversions table
      await this.storeConversion(data);

      // Step 2: Update account performance
      await this.updateAccountPerformance(data);

      // Step 3: Update generator performance for this account
      await this.updateGeneratorPerformance(data);

      // Step 4: Update discovered_accounts table
      await this.updateDiscoveredAccountStats(data);

      // Step 5: Invalidate cache for next lookup
      this.invalidateCache(data.target_account, data.generator_used);

      console.log(`[UNIFIED_TRACKER] ✅ Successfully tracked reply ${data.reply_id}`);

    } catch (error: any) {
      console.error('[UNIFIED_TRACKER] ❌ Failed to track reply:', error.message);
      throw error;
    }
  }

  /**
   * Get best performing generator for a specific account
   * Uses cached data for performance
   */
  public async getBestGeneratorForAccount(account: string): Promise<GeneratorType | null> {
    await this.ensureCacheValid();

    // Find all generators used with this account
    const accountGenerators: GeneratorPerformance[] = [];
    
    for (const [key, perf] of this.generatorCache.entries()) {
      if (perf.account === account) {
        accountGenerators.push(perf);
      }
    }

    if (accountGenerators.length === 0) {
      return null; // No data for this account
    }

    // Filter for high confidence (at least 3 samples)
    const confident = accountGenerators.filter(g => g.total_replies >= 3);
    
    if (confident.length === 0) {
      return null; // Not enough data yet
    }

    // Sort by avg followers gained
    confident.sort((a, b) => b.avg_followers_gained - a.avg_followers_gained);

    const best = confident[0];
    console.log(`[UNIFIED_TRACKER] 🎯 Best for @${account}: ${best.generator} (${best.avg_followers_gained.toFixed(1)} followers/reply)`);

    return best.generator;
  }

  /**
   * Get account conversion stats
   */
  public async getAccountConversion(account: string): Promise<AccountConversion | null> {
    await this.ensureCacheValid();
    return this.accountCache.get(account) || null;
  }

  /**
   * Get generator performance across all accounts
   */
  public async getGeneratorStats(generator: GeneratorType): Promise<{
    total_replies: number;
    avg_followers: number;
    best_accounts: string[];
  }> {
    await this.ensureCacheValid();

    const stats = Array.from(this.generatorCache.values())
      .filter(g => g.generator === generator);

    if (stats.length === 0) {
      return { total_replies: 0, avg_followers: 0, best_accounts: [] };
    }

    const totalReplies = stats.reduce((sum, s) => sum + s.total_replies, 0);
    const avgFollowers = stats.reduce((sum, s) => sum + (s.avg_followers_gained * s.total_replies), 0) / totalReplies;

    // Best accounts for this generator
    const bestAccounts = stats
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained)
      .slice(0, 10)
      .map(s => s.account);

    return {
      total_replies: totalReplies,
      avg_followers: avgFollowers,
      best_accounts: bestAccounts
    };
  }

  /**
   * Store conversion data in database
   */
  private async storeConversion(data: ReplyPerformanceData): Promise<void> {
    const { error } = await this.supabase
      .from('reply_conversions')
      .insert({
        reply_decision_id: data.decision_id,
        target_account: data.target_account,
        target_tweet_id: data.target_tweet_id,
        opportunity_tier: data.opportunity_tier || null,
        engagement_rate: null, // Can add if available
        
        // Performance metrics
        reply_likes: data.reply_likes,
        reply_retweets: data.reply_retweets || 0,
        reply_impressions: data.reply_impressions || 0,
        profile_clicks: data.profile_clicks || 0,
        followers_gained: data.followers_gained,
        
        // Timing
        replied_at: data.posted_at,
        measured_at: data.measured_at || new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store conversion: ${error.message}`);
    }
  }

  /**
   * Update account-level performance stats
   */
  private async updateAccountPerformance(data: ReplyPerformanceData): Promise<void> {
    // Get current account stats
    const { data: existing } = await this.supabase
      .from('reply_conversions')
      .select('followers_gained')
      .eq('target_account', data.target_account);

    const totalReplies = (existing?.length || 0) + 1;
    const totalFollowers = (existing?.reduce((sum, r) => sum + (r.followers_gained || 0), 0) || 0) + data.followers_gained;
    const conversionRate = totalFollowers / totalReplies;

    console.log(`[UNIFIED_TRACKER] 📈 @${data.target_account}: ${conversionRate.toFixed(2)} followers/reply (n=${totalReplies})`);
  }

  /**
   * Update generator performance for specific account
   */
  private async updateGeneratorPerformance(data: ReplyPerformanceData): Promise<void> {
    // Get all replies to this account with this generator
    const { data: history } = await this.supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('target_username', data.target_account)
      .eq('generator_name', data.generator_used)
      .eq('decision_type', 'reply')
      .eq('status', 'posted');

    const sampleSize = (history?.length || 0);

    // Get conversions for these replies
    if (sampleSize > 0) {
      const decisionIds = history?.map(h => h.decision_id) || [];
      
      const { data: conversions } = await this.supabase
        .from('reply_conversions')
        .select('followers_gained, profile_clicks, reply_likes')
        .in('reply_decision_id', [...decisionIds, data.decision_id]);

      if (conversions && conversions.length > 0) {
        const avgFollowers = conversions.reduce((sum, c) => sum + (c.followers_gained || 0), 0) / conversions.length;
        const avgClicks = conversions.reduce((sum, c) => sum + (c.profile_clicks || 0), 0) / conversions.length;
        const avgEngagement = conversions.reduce((sum, c) => sum + (c.reply_likes || 0), 0) / conversions.length;

        console.log(`[UNIFIED_TRACKER] 🎭 ${data.generator_used} on @${data.target_account}:`);
        console.log(`[UNIFIED_TRACKER]   Avg followers: ${avgFollowers.toFixed(1)} (n=${conversions.length})`);
        console.log(`[UNIFIED_TRACKER]   Confidence: ${Math.min(0.95, conversions.length / 10).toFixed(2)}`);
      }
    }
  }

  /**
   * Update discovered_accounts table with conversion stats
   */
  private async updateDiscoveredAccountStats(data: ReplyPerformanceData): Promise<void> {
    try {
      // Get current stats from discovered_accounts
      const { data: account } = await this.supabase
        .from('discovered_accounts')
        .select('total_replies_to_account, followers_gained_from_account')
        .eq('username', data.target_account)
        .single();

      if (account) {
        const newTotalReplies = (account.total_replies_to_account || 0) + 1;
        const newTotalFollowers = (account.followers_gained_from_account || 0) + data.followers_gained;
        const newConversionRate = newTotalFollowers / newTotalReplies;

        // Update discovered_accounts
        const { error } = await this.supabase
          .from('discovered_accounts')
          .update({
            total_replies_to_account: newTotalReplies,
            followers_gained_from_account: newTotalFollowers,
            conversion_rate: newConversionRate,
            last_updated: new Date().toISOString()
          })
          .eq('username', data.target_account);

        if (!error) {
          console.log(`[UNIFIED_TRACKER] 📊 Updated discovered_accounts for @${data.target_account}`);
          console.log(`[UNIFIED_TRACKER]   Conversion rate: ${newConversionRate.toFixed(3)}`);
        }
      }
    } catch (error: any) {
      // Account might not exist in discovered_accounts, that's ok
      console.log(`[UNIFIED_TRACKER] ⚠️ Could not update discovered_accounts: ${error.message}`);
    }
  }

  /**
   * Refresh in-memory cache from database
   */
  private async refreshCache(): Promise<void> {
    console.log('[UNIFIED_TRACKER] 🔄 Refreshing performance cache...');

    try {
      // Load generator performance
      const { data: conversions } = await this.supabase
        .from('reply_conversions')
        .select('target_account, reply_decision_id, followers_gained, profile_clicks, reply_likes')
        .order('replied_at', { ascending: false })
        .limit(1000); // Last 1000 replies

      if (conversions) {
        // Get generators for each reply
        const decisionIds = conversions.map(c => c.reply_decision_id);
        
        const { data: metadata } = await this.supabase
          .from('content_metadata')
          .select('decision_id, generator_name, target_username')
          .in('decision_id', decisionIds);

        // Build generator performance cache
        const generatorStats = new Map<string, {
          total: number;
          totalFollowers: number;
          totalClicks: number;
          totalEngagement: number;
        }>();

        conversions.forEach(conv => {
          const meta = metadata?.find(m => m.decision_id === conv.reply_decision_id);
          if (!meta) return;

          const key = `${meta.target_username}_${meta.generator_name}`;
          const existing = generatorStats.get(key) || {
            total: 0,
            totalFollowers: 0,
            totalClicks: 0,
            totalEngagement: 0
          };

          existing.total++;
          existing.totalFollowers += conv.followers_gained || 0;
          existing.totalClicks += conv.profile_clicks || 0;
          existing.totalEngagement += conv.reply_likes || 0;

          generatorStats.set(key, existing);
        });

        // Convert to GeneratorPerformance objects
        this.generatorCache.clear();
        for (const [key, stats] of generatorStats.entries()) {
          const [account, generator] = key.split('_');
          
          this.generatorCache.set(key, {
            generator: generator as GeneratorType,
            account,
            total_replies: stats.total,
            avg_followers_gained: stats.totalFollowers / stats.total,
            avg_profile_clicks: stats.totalClicks / stats.total,
            avg_engagement: stats.totalEngagement / stats.total,
            confidence: Math.min(0.95, stats.total / 10),
            last_used: new Date().toISOString()
          });
        }

        console.log(`[UNIFIED_TRACKER] ✅ Cached ${this.generatorCache.size} generator performance entries`);
      }

      // Load account conversions
      const { data: accountStats } = await this.supabase
        .from('reply_conversions')
        .select('target_account, followers_gained, replied_at')
        .order('replied_at', { ascending: false })
        .limit(1000);

      if (accountStats) {
        const accountMap = new Map<string, AccountConversion>();

        accountStats.forEach(stat => {
          const existing = accountMap.get(stat.target_account) || {
            account: stat.target_account,
            total_replies: 0,
            total_followers_gained: 0,
            conversion_rate: 0,
            last_replied: stat.replied_at
          };

          existing.total_replies++;
          existing.total_followers_gained += stat.followers_gained || 0;
          existing.conversion_rate = existing.total_followers_gained / existing.total_replies;

          accountMap.set(stat.target_account, existing);
        });

        this.accountCache = accountMap;
        console.log(`[UNIFIED_TRACKER] ✅ Cached ${this.accountCache.size} account conversions`);
      }

      this.lastCacheUpdate = Date.now();

    } catch (error: any) {
      console.error('[UNIFIED_TRACKER] ❌ Cache refresh failed:', error.message);
    }
  }

  /**
   * Ensure cache is valid, refresh if expired
   */
  private async ensureCacheValid(): Promise<void> {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      await this.refreshCache();
    }
  }

  /**
   * Invalidate cache entries for specific account/generator
   */
  private invalidateCache(account: string, generator: GeneratorType): void {
    const key = `${account}_${generator}`;
    this.generatorCache.delete(key);
    this.accountCache.delete(account);
    
    // Force refresh on next lookup
    this.lastCacheUpdate = 0;
  }

  /**
   * Get overall system performance
   */
  public async getSystemPerformance(): Promise<{
    total_replies: number;
    total_followers_gained: number;
    avg_conversion_rate: number;
    top_generators: Array<{ generator: GeneratorType; avg_followers: number }>;
    top_accounts: Array<{ account: string; conversion_rate: number }>;
  }> {
    await this.ensureCacheValid();

    // Calculate totals
    let totalReplies = 0;
    let totalFollowers = 0;

    for (const account of this.accountCache.values()) {
      totalReplies += account.total_replies;
      totalFollowers += account.total_followers_gained;
    }

    // Top generators
    const generatorTotals = new Map<GeneratorType, { total: number; followers: number }>();
    for (const perf of this.generatorCache.values()) {
      const existing = generatorTotals.get(perf.generator) || { total: 0, followers: 0 };
      existing.total += perf.total_replies;
      existing.followers += perf.avg_followers_gained * perf.total_replies;
      generatorTotals.set(perf.generator, existing);
    }

    const topGenerators = Array.from(generatorTotals.entries())
      .map(([generator, stats]) => ({
        generator,
        avg_followers: stats.followers / stats.total
      }))
      .sort((a, b) => b.avg_followers - a.avg_followers)
      .slice(0, 5);

    // Top accounts
    const topAccounts = Array.from(this.accountCache.values())
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, 10)
      .map(a => ({
        account: a.account,
        conversion_rate: a.conversion_rate
      }));

    return {
      total_replies: totalReplies,
      total_followers_gained: totalFollowers,
      avg_conversion_rate: totalReplies > 0 ? totalFollowers / totalReplies : 0,
      top_generators: topGenerators,
      top_accounts: topAccounts
    };
  }
}

// Export singleton instance
export const unifiedReplyTracker = UnifiedReplyTracker.getInstance();

