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
 * Select strategy using ε-greedy from scored candidates
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
  
  if (candidates.length === 0) {
    return {
      strategyId: 'baseline',
      strategyVersion: '1',
      selectionMode: 'exploit',
      reason: 'no_candidates',
    };
  }
  
  // Extract unique strategies from candidates
  const strategyMap = new Map<string, ScoredCandidate[]>();
  for (const candidate of candidates) {
    const features = (candidate as any)._scoring || {};
    const strategyId = features.strategy_id || 'baseline';
    const strategyVersion = String(features.strategy_version || '1');
    const key = `${strategyId}:${strategyVersion}`;
    
    if (!strategyMap.has(key)) {
      strategyMap.set(key, []);
    }
    strategyMap.get(key)!.push(candidate);
  }
  
  // Get eligible strategies (with min_samples)
  const eligibleStrategies = await getStrategiesByReward(minSamples);
  const eligibleStrategyKeys = new Set(
    eligibleStrategies.map(s => `${s.strategy_id}:${s.strategy_version}`)
  );
  
  // ε-greedy decision
  const randomValue = rngSeed !== undefined 
    ? seededRandom(rngSeed) 
    : Math.random();
  
  const shouldExplore = randomValue < epsilon;
  
  if (shouldExplore && strategyMap.size > 1) {
    // Explore: choose random strategy from available
    const strategyKeys = Array.from(strategyMap.keys());
    const randomIndex = Math.floor((rngSeed !== undefined ? seededRandom(rngSeed + 1) : Math.random()) * strategyKeys.length);
    const selectedKey = strategyKeys[randomIndex];
    const [strategyId, strategyVersion] = selectedKey.split(':');
    
    return {
      strategyId: strategyId || 'baseline',
      strategyVersion: strategyVersion || '1',
      selectionMode: 'explore',
      reason: `epsilon_exploration (ε=${epsilon})`,
    };
  }
  
  // Exploit: choose highest mean_reward among eligible strategies
  if (eligibleStrategies.length > 0) {
    // Find best eligible strategy present in candidates
    for (const strategy of eligibleStrategies) {
      const key = `${strategy.strategy_id}:${strategy.strategy_version}`;
      if (strategyMap.has(key)) {
        return {
          strategyId: strategy.strategy_id,
          strategyVersion: strategy.strategy_version,
          selectionMode: 'exploit',
          reason: `highest_mean_reward=${strategy.mean_reward.toFixed(3)} (samples=${strategy.sample_count})`,
        };
      }
    }
  }
  
  // Fallback: use highest targeting score (current behavior)
  const bestCandidate = candidates[0]; // Already sorted by score
  const bestFeatures = (bestCandidate as any)._scoring || {};
  
  return {
    strategyId: bestFeatures.strategy_id || 'baseline',
    strategyVersion: String(bestFeatures.strategy_version || '1'),
    selectionMode: 'exploit',
    reason: `fallback_to_targeting_score=${bestCandidate.score.toFixed(3)} (no_strategy_meets_min_samples=${minSamples})`,
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
