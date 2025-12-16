/**
 * 🎯 GENERATOR POLICY
 * 
 * Defines base weights for generator selection based on Phase 5 strategy.
 * Blends policy weights with learning metrics for data-driven optimization.
 * 
 * Tier 1 (60%): High-performance generators
 * Tier 2 (30%): Moderate-performance generators  
 * Tier 3 (10%): Low-performance generators (experimental)
 */

import type { GeneratorType } from '../intelligence/generatorMatcher';

/**
 * Generator name type (alias for GeneratorType)
 */
export type GeneratorName = GeneratorType;

/**
 * Base weights from Phase 5 strategy document
 * 
 * Tier 1 (60%): thought_leader (20%), coach (20%), philosopher (10%), dataNerd (10%)
 * Tier 2 (30%): provocateur (8%), mythBuster (7%), culturalBridge (5%), newsReporter (5%), contrarian (5%)
 * Tier 3 (10%): storyteller (3%), explorer (2%), dynamicContent (2%), interestingContent (1%)
 * Deprecated: human_content_orchestrator (0%)
 */
export const GENERATOR_POLICY_BASE_WEIGHTS: Record<GeneratorName, number> = {
  // Tier 1: High-performance generators (60%)
  thoughtLeader: 0.20,
  coach: 0.20,
  philosopher: 0.10,
  dataNerd: 0.10,

  // Tier 2: Moderate-performance generators (30%)
  provocateur: 0.08,
  mythBuster: 0.07,
  culturalBridge: 0.05,
  newsReporter: 0.05,
  contrarian: 0.05,

  // Tier 3: Low-performance generators (experimental) (10%)
  storyteller: 0.03,
  explorer: 0.02,
  dynamicContent: 0.02,
  interestingContent: 0.01,

  // Additional generators (not in Phase 5 strategy, set to small weights)
  popCultureAnalyst: 0.01,
  teacher: 0.01,
  investigator: 0.01,
  connector: 0.01,
  pragmatist: 0.01,
  historian: 0.01,
  translator: 0.01,
  patternFinder: 0.01,
  experimenter: 0.01,

  // Deprecated / disabled generators explicitly set to 0
  // Note: human_content_orchestrator is not in GeneratorType, so not included
};

/**
 * Generator performance summary from learning data
 */
export interface GeneratorPerformanceSummary {
  generator_name: GeneratorName;
  avg_primary_objective_score: number | null;
  avg_followers_gained_weighted: number | null;
  total_posts: number;
}

/**
 * Generator weights (normalized probabilities)
 */
export interface GeneratorWeights {
  [name: string]: number;
}

/**
 * Compute generator weights by blending policy base weights with learning metrics
 * 
 * @param args Configuration for weight computation
 * @returns Normalized generator weights (sum to 1.0)
 */
export function computeGeneratorWeightsFromPolicyAndLearning(args: {
  baseWeights: GeneratorWeights;
  performanceByGenerator: GeneratorPerformanceSummary[];
  minPostsForAdjustment?: number; // default ~10
  learningStrength?: number;      // 0–1, default ~0.3 to keep adjustments small
}): GeneratorWeights {
  const {
    baseWeights,
    performanceByGenerator,
    minPostsForAdjustment = 10,
    learningStrength = 0.3
  } = args;

  // Start with base weights
  const adjustedWeights: GeneratorWeights = { ...baseWeights };

  // Create a map of performance by generator for quick lookup
  const performanceMap = new Map<string, GeneratorPerformanceSummary>();
  for (const perf of performanceByGenerator) {
    performanceMap.set(perf.generator_name, perf);
  }

  // Adjust weights based on performance for generators with enough data
  for (const [generatorName, baseWeight] of Object.entries(baseWeights)) {
    // Generators with baseWeight = 0 should remain 0
    if (baseWeight === 0) {
      continue;
    }

    const performance = performanceMap.get(generatorName);
    
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
      
      adjustedWeights[generatorName] = adjustedWeight;
      
      console.log(
        `[GEN_POLICY] Adjusted ${generatorName}: ` +
        `base=${baseWeight.toFixed(3)} → adjusted=${adjustedWeight.toFixed(3)} ` +
        `(score=${score.toFixed(3)}, n=${performance.total_posts})`
      );
    }
  }

  // Normalize all weights so they sum to 1.0
  const totalWeight = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
  
  if (totalWeight === 0) {
    console.warn('[GEN_POLICY] ⚠️ Total weight is 0, returning base weights');
    return baseWeights;
  }

  const normalizedWeights: GeneratorWeights = {};
  for (const [generatorName, weight] of Object.entries(adjustedWeights)) {
    normalizedWeights[generatorName] = weight / totalWeight;
  }

  return normalizedWeights;
}

/**
 * Validate that generator weights are valid (sum to ~1.0, all non-negative)
 */
export function validateGeneratorWeights(weights: GeneratorWeights): boolean {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const allNonNegative = Object.values(weights).every(w => w >= 0);
  const sumIsValid = Math.abs(total - 1.0) < 0.01; // Allow small floating point errors
  
  if (!allNonNegative) {
    console.error('[GEN_POLICY] ❌ Invalid weights: some weights are negative');
    return false;
  }
  
  if (!sumIsValid) {
    console.error(`[GEN_POLICY] ❌ Invalid weights: sum=${total.toFixed(4)}, expected ~1.0`);
    return false;
  }
  
  return true;
}

