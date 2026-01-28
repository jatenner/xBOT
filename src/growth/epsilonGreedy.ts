/**
 * 🎲 ε-GREEDY STRATEGY SELECTION
 * Phase 6.3B: Select strategies using ε-greedy with safeguards
 * 
 * Features:
 * - ε% exploration (default 10%)
 * - Exploit chooses highest mean_reward among strategies with min_samples
 * - Fallback to targeting score if no strategy meets min_samples
 * - Deterministic RNG seed for proofs
 */

import { getGrowthConfig } from '../config/growthConfig';
import { getStrategiesByReward } from './strategyRewards';
import { getAllStrategies, getDefaultStrategy } from './replyStrategies';
import type { ScoredCandidate } from './replyTargetScoring';

/**
 * Strategy selection result
 */
export interface StrategySelection {
  strategyId: string;
  strategyVersion: string;
  selectionMode: 'explore' | 'exploit';
  reason: string;
}

/**
 * Select strategy using ε-greedy from available reply strategies
 * 
 * Phase 6.4: Selects from explicit reply strategies (insight_punch, actionable_checklist, etc.)
 * rather than extracting from candidate features.
 * 
 * Returns strategy_id and selection_mode for attribution
 */
export async function epsilonGreedyStrategySelection(
  candidates: ScoredCandidate[],
  rngSeed?: number
): Promise<StrategySelection> {
  const config = getGrowthConfig();
  const epsilon = config.EPSILON_GREEDY_EPSILON;
  const minSamples = config.EPSILON_GREEDY_MIN_SAMPLES;
  
  // Get all available reply strategies
  const availableStrategies = getAllStrategies();
  
  if (availableStrategies.length === 0) {
    const defaultStrategy = getDefaultStrategy();
    return {
      strategyId: defaultStrategy.strategy_id,
      strategyVersion: defaultStrategy.strategy_version,
      selectionMode: 'exploit',
      reason: 'no_strategies_available',
    };
  }
  
  // Get eligible strategies from strategy_rewards (with min_samples)
  const eligibleRewardStats = await getStrategiesByReward(minSamples);
  const eligibleStrategyKeys = new Set(
    eligibleRewardStats.map(s => `${s.strategy_id}:${s.strategy_version}`)
  );
  
  // ε-greedy decision
  const randomValue = rngSeed !== undefined 
    ? seededRandom(rngSeed) 
    : Math.random();
  
  const shouldExplore = randomValue < epsilon;
  
  if (shouldExplore && availableStrategies.length > 1) {
    // Explore: choose random strategy from available
    const randomIndex = Math.floor((rngSeed !== undefined ? seededRandom(rngSeed + 1) : Math.random()) * availableStrategies.length);
    const selectedStrategy = availableStrategies[randomIndex];
    
    return {
      strategyId: selectedStrategy.strategy_id,
      strategyVersion: selectedStrategy.strategy_version,
      selectionMode: 'explore',
      reason: `epsilon_exploration (ε=${epsilon})`,
    };
  }
  
  // Exploit: choose highest mean_reward among eligible strategies
  if (eligibleRewardStats.length > 0) {
    // Find best eligible strategy that exists in available strategies
    for (const rewardStat of eligibleRewardStats) {
      const matchingStrategy = availableStrategies.find(
        s => s.strategy_id === rewardStat.strategy_id && 
             s.strategy_version === rewardStat.strategy_version
      );
      
      if (matchingStrategy) {
        return {
          strategyId: matchingStrategy.strategy_id,
          strategyVersion: matchingStrategy.strategy_version,
          selectionMode: 'exploit',
          reason: `highest_mean_reward=${rewardStat.mean_reward.toFixed(3)} (samples=${rewardStat.sample_count})`,
        };
      }
    }
  }
  
  // Fallback: use default strategy (insight_punch)
  const defaultStrategy = getDefaultStrategy();
  return {
    strategyId: defaultStrategy.strategy_id,
    strategyVersion: defaultStrategy.strategy_version,
    selectionMode: 'exploit',
    reason: `fallback_to_default (no_strategy_meets_min_samples=${minSamples})`,
  };
}

/**
 * Seeded random number generator (for deterministic proofs)
 */
function seededRandom(seed: number): number {
  // Simple LCG for deterministic randomness
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  const nextSeed = (seed * a + c) % m;
  return nextSeed / m;
}

/**
 * Apply strategy selection to candidates (filter/prioritize by selected strategy)
 * Does NOT increase volume - only affects which candidates are selected
 */
export function applyStrategySelection(
  candidates: ScoredCandidate[],
  selection: StrategySelection
): ScoredCandidate[] {
  // Filter candidates matching selected strategy
  const matching = candidates.filter(c => {
    const features = (c as any)._scoring || {};
    const candidateStrategyId = features.strategy_id || 'baseline';
    const candidateStrategyVersion = String(features.strategy_version || '1');
    
    return candidateStrategyId === selection.strategyId &&
           candidateStrategyVersion === selection.strategyVersion;
  });
  
  // If matches found, return them (preserving score order)
  // Otherwise return all candidates (fallback)
  return matching.length > 0 ? matching : candidates;
}
