/**
 * REPLY LEARNING SYSTEM
 * Learns which accounts, generators, and strategies get followers from replies
 */

import { getSupabaseClient } from '../db';
import { type GeneratorType } from '../scheduling/personalityScheduler';

export interface ReplyPattern {
  account_username: string;
  generator_used: GeneratorType;
  avg_followers_gained: number;
  avg_profile_clicks: number;
  avg_engagement: number;
  sample_size: number;
  confidence: number;
}

export interface AccountPerformance {
  username: string;
  total_replies: number;
  total_followers_gained: number;
  avg_followers_per_reply: number;
  success_rate: number; // % of replies that gained followers
  priority_score: number; // Higher = target more often
}

export class ReplyLearningSystem {
  private static instance: ReplyLearningSystem;
  private patterns: Map<string, ReplyPattern> = new Map();
  private accountPerformance: Map<string, AccountPerformance> = new Map();
  
  private constructor() {}
  
  public static getInstance(): ReplyLearningSystem {
    if (!ReplyLearningSystem.instance) {
      ReplyLearningSystem.instance = new ReplyLearningSystem();
    }
    return ReplyLearningSystem.instance;
  }
  
  /**
   * Track reply performance
   */
  async trackReplyPerformance(data: {
    reply_id: string;
    target_account: string;
    generator_used: GeneratorType;
    followers_gained: number;
    profile_clicks: number;
    likes: number;
    posted_at: string;
  }): Promise<void> {
    
    console.log(`[REPLY_LEARNING] 📊 Reply to @${data.target_account} via ${data.generator_used}: +${data.followers_gained} followers, ${data.profile_clicks} clicks`);
    
    // Update pattern (account + generator combo)
    const patternKey = `${data.target_account}_${data.generator_used}`;
    const existing = this.patterns.get(patternKey);
    
    if (existing) {
      const newSampleSize = existing.sample_size + 1;
      const newAvgFollowers = (existing.avg_followers_gained * existing.sample_size + data.followers_gained) / newSampleSize;
      const newAvgClicks = (existing.avg_profile_clicks * existing.sample_size + data.profile_clicks) / newSampleSize;
      const newAvgEngagement = (existing.avg_engagement * existing.sample_size + data.likes) / newSampleSize;
      
      this.patterns.set(patternKey, {
        ...existing,
        avg_followers_gained: newAvgFollowers,
        avg_profile_clicks: newAvgClicks,
        avg_engagement: newAvgEngagement,
        sample_size: newSampleSize,
        confidence: Math.min(0.95, newSampleSize / 10)
      });
      
      console.log(`[REPLY_LEARNING] 📈 Pattern ${patternKey}: ${newAvgFollowers.toFixed(1)} avg followers (n=${newSampleSize})`);
    } else {
      this.patterns.set(patternKey, {
        account_username: data.target_account,
        generator_used: data.generator_used,
        avg_followers_gained: data.followers_gained,
        avg_profile_clicks: data.profile_clicks,
        avg_engagement: data.likes,
        sample_size: 1,
        confidence: 0.1
      });
    }
    
    // Update account performance
    const accountPerf = this.accountPerformance.get(data.target_account);
    
    if (accountPerf) {
      const newTotal = accountPerf.total_replies + 1;
      const newFollowers = accountPerf.total_followers_gained + data.followers_gained;
      const gained = data.followers_gained > 0 ? 1 : 0;
      const newSuccessRate = (accountPerf.success_rate * accountPerf.total_replies + gained) / newTotal;
      
      this.accountPerformance.set(data.target_account, {
        username: data.target_account,
        total_replies: newTotal,
        total_followers_gained: newFollowers,
        avg_followers_per_reply: newFollowers / newTotal,
        success_rate: newSuccessRate,
        priority_score: (newFollowers / newTotal) * newSuccessRate * 100
      });
    } else {
      const gained = data.followers_gained > 0 ? 1 : 0;
      this.accountPerformance.set(data.target_account, {
        username: data.target_account,
        total_replies: 1,
        total_followers_gained: data.followers_gained,
        avg_followers_per_reply: data.followers_gained,
        success_rate: gained,
        priority_score: data.followers_gained
      });
    }
    
    // Persist to database
    await this.persistLearning(data);
  }
  
  /**
   * Get best performing accounts to target
   */
  getBestAccounts(count: number = 5): string[] {
    const accounts = Array.from(this.accountPerformance.values())
      .filter(a => a.total_replies >= 2) // Need at least 2 replies
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, count)
      .map(a => a.username);
    
    return accounts;
  }
  
  /**
   * Get best generator for specific account
   */
  getBestGeneratorForAccount(account: string): GeneratorType | null {
    const patterns = Array.from(this.patterns.values())
      .filter(p => p.account_username === account && p.sample_size >= 2)
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained);
    
    return patterns[0]?.generator_used || null;
  }
  
  /**
   * Get priority score for account (higher = better)
   */
  getAccountPriority(account: string): number {
    const perf = this.accountPerformance.get(account);
    return perf?.priority_score || 0;
  }
  
  /**
   * Load historical performance from database
   */
  async loadHistoricalData(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('strategic_replies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (data && data.length > 0) {
        data.forEach((row: any) => {
          // Aggregate patterns
          const key = `${row.target_account}_${row.generator_used || 'unknown'}`;
          // Process and update patterns...
        });
        
        console.log(`[REPLY_LEARNING] ✅ Loaded ${data.length} historical replies`);
      }
    } catch (error) {
      console.warn('[REPLY_LEARNING] ⚠️ Could not load historical data');
    }
  }
  
  /**
   * Persist learning to database
   */
  private async persistLearning(data: any): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('strategic_replies')
        .upsert({
          reply_id: data.reply_id,
          target_account: data.target_account,
          generator_used: data.generator_used,
          followers_gained: data.followers_gained,
          profile_clicks: data.profile_clicks,
          likes: data.likes,
          posted_at: data.posted_at,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('[REPLY_LEARNING] ⚠️ Could not persist to DB');
    }
  }
  
  /**
   * Get learning insights
   */
  getInsights(): {
    best_accounts: AccountPerformance[];
    best_patterns: ReplyPattern[];
    total_followers_from_replies: number;
  } {
    const accounts = Array.from(this.accountPerformance.values())
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 10);
    
    const patterns = Array.from(this.patterns.values())
      .filter(p => p.sample_size >= 2)
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained)
      .slice(0, 10);
    
    const totalFollowers = accounts.reduce((sum, a) => sum + a.total_followers_gained, 0);
    
    return {
      best_accounts: accounts,
      best_patterns: patterns,
      total_followers_from_replies: totalFollowers
    };
  }
}

export const replyLearningSystem = ReplyLearningSystem.getInstance();

