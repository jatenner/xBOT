/**
 * 📅 CONTENT SLOT POLICY
 * 
 * Defines base weights for content slot selection based on Phase 5 strategy.
 * Blends policy weights with learning metrics for data-driven optimization.
 * 
 * High-value (40%): framework (15%), practical_tip (15%), research (10%)
 * Medium-value (40%): myth_busting (12%), deep_dive (10%), case_study (8%), comparison (5%), educational (5%)
 * Low-value (20%): question (8%), trend_analysis (6%), story (4%), news (2%)
 */

import type { ContentSlotType } from '../utils/contentSlotManager';

/**
 * Base weights from Phase 5 strategy document
 * 
 * High-value (40%): framework (15%), practical_tip (15%), research (10%)
 * Medium-value (40%): myth_busting (12%), deep_dive (10%), case_study (8%), comparison (5%), educational (5%)
 * Low-value (20%): question (8%), trend_analysis (6%), story (4%), news (2%)
 */
export const SLOT_POLICY_BASE_WEIGHTS: Record<ContentSlotType, number> = {
  // High-value slots (40%)
  framework: 0.15,
  practical_tip: 0.15,
  research: 0.10,

  // Medium-value slots (40%)
  myth_busting: 0.12,
  deep_dive: 0.10,
  case_study: 0.08,
  comparison: 0.05,
  educational: 0.05,

  // Low-value slots (20%)
  question: 0.08,
  trend_analysis: 0.06,
  story: 0.04,
  news: 0.02
};

/**
 * Slot performance summary from learning data
 */
export interface SlotPerformanceSummary {
  content_slot: ContentSlotType;
  avg_primary_objective_score: number | null;
  avg_followers_gained_weighted: number | null;
  total_posts: number;
}

/**
 * Slot weights (normalized probabilities)
 */
export interface SlotWeights {
  [slot: string]: number;
}

/**
 * Compute slot weights by blending policy base weights with learning metrics
 * 
 * @param args Configuration for weight computation
 * @returns Normalized slot weights (sum to 1.0)
 */
export function computeSlotWeightsFromPolicyAndLearning(args: {
  baseWeights: SlotWeights;
  performanceBySlot: SlotPerformanceSummary[];
  minPostsForAdjustment?: number; // default ~10
  learningStrength?: number;      // 0–1, default ~0.3 to keep adjustments small
}): SlotWeights {
  const {
    baseWeights,
    performanceBySlot,
    minPostsForAdjustment = 10,
    learningStrength = 0.3
  } = args;

  // Start with base weights
  const adjustedWeights: SlotWeights = { ...baseWeights };

  // Create a map of performance by slot for quick lookup
  const performanceMap = new Map<string, SlotPerformanceSummary>();
  for (const perf of performanceBySlot) {
    performanceMap.set(perf.content_slot, perf);
  }

  // Adjust weights based on performance for slots with enough data
  for (const [slotName, baseWeight] of Object.entries(baseWeights)) {
    // Slots with baseWeight = 0 should remain 0
    if (baseWeight === 0) {
      continue;
    }

    const performance = performanceMap.get(slotName);
    
    // Only adjust if we have enough posts and valid performance data
    if (
      performance &&
      performance.total_posts >= minPostsForAdjustment &&
      performance.avg_primary_objective_score !== null
    ) {
      const score = performance.avg_primary_objective_score;
      
      // Normalize score to [-1, 1] range (assuming scores are typically 0-1)
      // Score of 0.5 is neutral, >0.5 is good, <0.5 is bad
      const normalizedScore = (score - 0.5) * 2; // Maps 0.5 -> 0, 1.0 -> 1, 0.0 -> -1
      
      // Apply learning adjustment: adjustedWeight = baseWeight * (1 + learningStrength * normalizedScore)
      // This means:
      // - Score 0.5 (neutral): weight stays the same
      // - Score 0.75 (good): weight increases by learningStrength * 0.5
      // - Score 0.25 (bad): weight decreases by learningStrength * 0.5
      let adjustedWeight = baseWeight * (1 + learningStrength * normalizedScore);
      
      // Clamp to reasonable range (0.25x to 2x of base weight)
      const minWeight = baseWeight * 0.25;
      const maxWeight = baseWeight * 2.0;
      adjustedWeight = Math.max(minWeight, Math.min(maxWeight, adjustedWeight));
      
      adjustedWeights[slotName] = adjustedWeight;
      
      console.log(
        `[SLOT_POLICY] Adjusted ${slotName}: ` +
        `base=${baseWeight.toFixed(3)} → adjusted=${adjustedWeight.toFixed(3)} ` +
        `(score=${score.toFixed(3)}, n=${performance.total_posts})`
      );
    }
  }

  // Normalize all weights so they sum to 1.0
  const totalWeight = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
  
  if (totalWeight === 0) {
    console.warn('[SLOT_POLICY] ⚠️ Total weight is 0, returning base weights');
    return baseWeights;
  }

  const normalizedWeights: SlotWeights = {};
  for (const [slotName, weight] of Object.entries(adjustedWeights)) {
    normalizedWeights[slotName] = weight / totalWeight;
  }

  return normalizedWeights;
}

/**
 * Validate that slot weights are valid (sum to ~1.0, all non-negative)
 */
export function validateSlotWeights(weights: SlotWeights): boolean {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const allNonNegative = Object.values(weights).every(w => w >= 0);
  const sumIsValid = Math.abs(total - 1.0) < 0.01; // Allow small floating point errors
  
  if (!allNonNegative) {
    console.error('[SLOT_POLICY] ❌ Invalid weights: some weights are negative');
    return false;
  }
  
  if (!sumIsValid) {
    console.error(`[SLOT_POLICY] ❌ Invalid weights: sum=${total.toFixed(4)}, expected ~1.0`);
    return false;
  }
  
  return true;
}

