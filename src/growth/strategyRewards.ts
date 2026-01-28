/**
 * 🎯 STRATEGY REWARDS TRACKING
 * Phase 6.3B: Track and query strategy reward statistics for ε-greedy learning
 */

import { getSupabaseClient } from '../db/index';

/**
 * Strategy reward statistics
 */
export interface StrategyRewardStats {
  strategy_id: string;
  strategy_version: string;
  sample_count: number;
  total_reward: number;
  mean_reward: number;
  last_updated_at: string;
}

/**
 * Record reward for a strategy (atomic upsert)
 */
export async function recordStrategyReward(
  strategyId: string,
  strategyVersion: string,
  reward: number
): Promise<void> {
  const supabase = getSupabaseClient();
  
  try {
    // Use the database function for atomic update
    const { error } = await supabase.rpc('update_strategy_reward', {
      p_strategy_id: strategyId,
      p_strategy_version: strategyVersion,
      p_reward: reward,
    });
    
    if (error) {
      // Fallback to manual upsert if function doesn't exist
      const { data: existing } = await supabase
        .from('strategy_rewards')
        .select('sample_count, total_reward')
        .eq('strategy_id', strategyId)
        .eq('strategy_version', strategyVersion)
        .single();
      
      if (existing) {
        const newSampleCount = existing.sample_count + 1;
        const newTotalReward = existing.total_reward + reward;
        const newMeanReward = newTotalReward / newSampleCount;
        
        await supabase
          .from('strategy_rewards')
          .update({
            sample_count: newSampleCount,
            total_reward: newTotalReward,
            mean_reward: newMeanReward,
            last_updated_at: new Date().toISOString(),
          })
          .eq('strategy_id', strategyId)
          .eq('strategy_version', strategyVersion);
      } else {
        await supabase
          .from('strategy_rewards')
          .insert({
            strategy_id: strategyId,
            strategy_version: strategyVersion,
            sample_count: 1,
            total_reward: reward,
            mean_reward: reward,
            last_updated_at: new Date().toISOString(),
          });
      }
    }
  } catch (error: any) {
    console.warn(`[STRATEGY_REWARDS] Failed to record reward for ${strategyId}/${strategyVersion}:`, error.message);
    // Don't throw - reward tracking is not critical
  }
}

/**
 * Get reward statistics for a strategy
 */
export async function getStrategyRewardStats(
  strategyId: string,
  strategyVersion: string
): Promise<StrategyRewardStats | null> {
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('strategy_rewards')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('strategy_version', strategyVersion)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return data as StrategyRewardStats;
  } catch (error: any) {
    console.warn(`[STRATEGY_REWARDS] Failed to get stats for ${strategyId}/${strategyVersion}:`, error.message);
    return null;
  }
}

/**
 * Get all strategies sorted by mean reward (for ε-greedy exploit)
 */
export async function getStrategiesByReward(
  minSamples: number = 10
): Promise<StrategyRewardStats[]> {
  const supabase = getSupabaseClient();
  
  try {
    const { data, error } = await supabase
      .from('strategy_rewards')
      .select('*')
      .gte('sample_count', minSamples)
      .order('mean_reward', { ascending: false });
    
    if (error || !data) {
      return [];
    }
    
    return data as StrategyRewardStats[];
  } catch (error: any) {
    console.warn('[STRATEGY_REWARDS] Failed to get strategies by reward:', error.message);
    return [];
  }
}
