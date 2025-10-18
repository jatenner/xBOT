/**
 * ═══════════════════════════════════════════════════════════
 * GENERATOR WEIGHT CALCULATOR
 * ═══════════════════════════════════════════════════════════
 * 
 * Purpose: Calculate optimal weights for content generators based on performance
 * 
 * Algorithm:
 * 1. Normalize F/1K scores to 0-1 scale
 * 2. Apply exponential weighting to reward top performers
 * 3. Blend with current weights for smooth transitions
 * 4. Ensure minimum weights for exploration
 * 5. Handle special cases (viral, failing, new generators)
 * 
 * Usage:
 *   const calculator = new GeneratorWeightCalculator();
 *   const newWeights = await calculator.calculateOptimalWeights(performanceData);
 */

import type { GeneratorStats } from './generatorPerformanceTracker';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface GeneratorWeights {
  [generatorName: string]: number;
}

export interface WeightChange {
  generator: string;
  old_weight: number;
  new_weight: number;
  change_percent: number;
  reason: string;
}

export interface OptimizationConfig {
  aggressiveness: number; // 0.1 = slow, 0.5 = fast (how quickly to adapt)
  min_weight: number; // Minimum weight for exploration
  viral_boost: number; // Multiplier for viral generators
  failure_penalty: number; // Multiplier for failing generators
  min_posts_for_optimization: number; // Don't optimize generators with < N posts
  exploration_rate: number; // % of weight reserved for low performers
}

// ═══════════════════════════════════════════════════════════
// GENERATOR WEIGHT CALCULATOR
// ═══════════════════════════════════════════════════════════

export class GeneratorWeightCalculator {
  private config: OptimizationConfig;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      aggressiveness: 0.3, // 30% adjustment per cycle
      min_weight: 0.02, // 2% minimum
      viral_boost: 1.5, // 50% boost for viral
      failure_penalty: 0.5, // 50% penalty for failure
      min_posts_for_optimization: 3, // Need at least 3 posts
      exploration_rate: 0.15, // 15% reserved for exploration
      ...config
    };
  }

  /**
   * Calculate optimal weights based on performance data
   */
  async calculateOptimalWeights(
    performanceData: GeneratorStats[],
    currentWeights: GeneratorWeights,
    overrides?: Partial<OptimizationConfig>
  ): Promise<GeneratorWeights> {
    try {
      const config = { ...this.config, ...overrides };
      
      console.log('🧮 WEIGHT_CALCULATOR: Calculating optimal weights...');
      console.log(`   Aggressiveness: ${config.aggressiveness * 100}%`);
      console.log(`   Min weight: ${config.min_weight * 100}%`);
      console.log(`   Exploration rate: ${config.exploration_rate * 100}%`);

      // ═══════════════════════════════════════════════════════════
      // STEP 1: FILTER AND NORMALIZE DATA
      // ═══════════════════════════════════════════════════════════
      
      const validGenerators = performanceData.filter(
        gen => gen.total_posts >= config.min_posts_for_optimization
      );

      if (validGenerators.length === 0) {
        console.log('⚠️ WEIGHT_CALCULATOR: No generators with enough posts, using current weights');
        return currentWeights;
      }

      // Normalize F/1K scores to 0-1 scale
      const maxF1K = Math.max(...validGenerators.map(g => g.f_per_1k), 0.1);
      const minF1K = Math.min(...validGenerators.map(g => g.f_per_1k));
      
      console.log(`   F/1K range: ${minF1K.toFixed(2)} - ${maxF1K.toFixed(2)}`);

      // ═══════════════════════════════════════════════════════════
      // STEP 2: CALCULATE PERFORMANCE SCORES
      // ═══════════════════════════════════════════════════════════
      
      const scores = new Map<string, number>();
      
      for (const gen of validGenerators) {
        // Normalize F/1K to 0-1
        let score = maxF1K > minF1K 
          ? (gen.f_per_1k - minF1K) / (maxF1K - minF1K)
          : 0.5;

        // Apply exponential weighting (rewards top performers more)
        score = Math.pow(score, 1.3);

        // Boost for viral generators
        if (gen.f_per_1k > 5 && gen.viral_posts > 0) {
          score *= config.viral_boost;
          console.log(`   🚀 Viral boost for ${gen.name}: ${gen.f_per_1k.toFixed(2)} F/1K`);
        }

        // Penalty for high failure rate
        const failureRate = gen.total_posts > 0 ? gen.failed_posts / gen.total_posts : 0;
        if (failureRate > 0.5) {
          score *= config.failure_penalty;
          console.log(`   ⚠️ Failure penalty for ${gen.name}: ${(failureRate * 100).toFixed(1)}% failure rate`);
        }

        // Bonus for consistency (low variance in performance)
        if (gen.viral_posts > 0 && gen.failed_posts === 0) {
          score *= 1.1;
        }

        scores.set(gen.name, Math.max(score, 0.01)); // Never go to 0
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 3: CALCULATE TARGET WEIGHTS
      // ═══════════════════════════════════════════════════════════
      
      // Total score for normalization
      const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);
      
      const targetWeights: GeneratorWeights = {};
      const exploitationPool = 1 - config.exploration_rate;

      for (const [generator, score] of scores.entries()) {
        // Convert score to weight (exploitation pool)
        const baseWeight = (score / totalScore) * exploitationPool;
        targetWeights[generator] = baseWeight;
      }

      // Add exploration weight for all generators
      for (const gen of validGenerators) {
        const explorationWeight = config.exploration_rate / validGenerators.length;
        targetWeights[gen.name] = (targetWeights[gen.name] || 0) + explorationWeight;
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 4: BLEND WITH CURRENT WEIGHTS
      // ═══════════════════════════════════════════════════════════
      
      const newWeights: GeneratorWeights = {};
      
      for (const generator of Object.keys(currentWeights)) {
        const currentWeight = currentWeights[generator];
        const targetWeight = targetWeights[generator] || config.min_weight;
        
        // Smooth transition (prevents wild swings)
        const blendedWeight = 
          currentWeight * (1 - config.aggressiveness) + 
          targetWeight * config.aggressiveness;
        
        // Apply minimum weight constraint
        newWeights[generator] = Math.max(blendedWeight, config.min_weight);
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 5: HANDLE SPECIAL CASES
      // ═══════════════════════════════════════════════════════════
      
      for (const gen of performanceData) {
        // New generators (< min_posts): Give average weight
        if (gen.total_posts < config.min_posts_for_optimization) {
          newWeights[gen.name] = 0.08; // 8% to give it a fair chance
          console.log(`   🆕 New generator ${gen.name}: default weight (${gen.total_posts} posts)`);
        }

        // Consistently failing generators: Reduce to minimum
        if (gen.total_posts >= 10 && gen.f_per_1k === 0) {
          newWeights[gen.name] = config.min_weight;
          console.log(`   ❌ Failing generator ${gen.name}: minimum weight (0 F/1K from ${gen.total_posts} posts)`);
        }

        // Locked generators: Keep current weight
        if (gen.status === 'testing' || gen.status === 'disabled') {
          newWeights[gen.name] = currentWeights[gen.name] || config.min_weight;
        }
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 6: NORMALIZE TO SUM TO 1.0
      // ═══════════════════════════════════════════════════════════
      
      const totalWeight = Object.values(newWeights).reduce((a, b) => a + b, 0);
      
      for (const generator in newWeights) {
        newWeights[generator] = newWeights[generator] / totalWeight;
      }

      // ═══════════════════════════════════════════════════════════
      // STEP 7: LOG RESULTS
      // ═══════════════════════════════════════════════════════════
      
      console.log('✅ WEIGHT_CALCULATOR: Optimal weights calculated');
      console.log('   Top 5 weights:');
      
      const sorted = Object.entries(newWeights).sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < Math.min(5, sorted.length); i++) {
        const [name, weight] = sorted[i];
        const current = currentWeights[name] || 0;
        const change = ((weight - current) / current) * 100;
        console.log(`   ${i + 1}. ${name}: ${(weight * 100).toFixed(1)}% (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`);
      }

      return newWeights;

    } catch (error: any) {
      console.error('❌ WEIGHT_CALCULATOR: Failed to calculate weights:', error.message);
      return currentWeights; // Return current weights on error
    }
  }

  /**
   * Detect significant weight changes
   */
  detectSignificantChanges(
    oldWeights: GeneratorWeights,
    newWeights: GeneratorWeights,
    threshold: number = 0.05 // 5% change is significant
  ): WeightChange[] {
    const changes: WeightChange[] = [];

    for (const generator in newWeights) {
      const oldWeight = oldWeights[generator] || 0;
      const newWeight = newWeights[generator];
      
      const change = newWeight - oldWeight;
      const changePercent = oldWeight > 0 ? (change / oldWeight) * 100 : 0;

      if (Math.abs(change) >= threshold) {
        let reason = '';
        
        if (changePercent > 50) reason = 'Major performance improvement';
        else if (changePercent > 20) reason = 'Performance improvement';
        else if (changePercent > 5) reason = 'Slight improvement';
        else if (changePercent < -50) reason = 'Major performance decline';
        else if (changePercent < -20) reason = 'Performance decline';
        else if (changePercent < -5) reason = 'Slight decline';

        changes.push({
          generator,
          old_weight: oldWeight,
          new_weight: newWeight,
          change_percent: changePercent,
          reason
        });
      }
    }

    return changes.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));
  }

  /**
   * Validate weights (ensure they're valid and sum to ~1.0)
   */
  validateWeights(weights: GeneratorWeights): boolean {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    const allPositive = Object.values(weights).every(w => w >= 0 && w <= 1);
    const sumIsOne = Math.abs(total - 1.0) < 0.01; // Allow 1% tolerance

    if (!allPositive) {
      console.error('❌ WEIGHT_CALCULATOR: Invalid weights (not all between 0-1)');
    }
    
    if (!sumIsOne) {
      console.error(`❌ WEIGHT_CALCULATOR: Weights don't sum to 1.0 (sum: ${total.toFixed(4)})`);
    }

    return allPositive && sumIsOne;
  }

  /**
   * Apply manual override to weights
   */
  applyOverride(
    weights: GeneratorWeights,
    generator: string,
    newWeight: number
  ): GeneratorWeights {
    const result = { ...weights };
    const oldWeight = result[generator] || 0;
    const difference = newWeight - oldWeight;

    result[generator] = newWeight;

    // Redistribute the difference proportionally
    const otherGenerators = Object.keys(result).filter(g => g !== generator);
    const otherTotal = otherGenerators.reduce((sum, g) => sum + result[g], 0);

    if (otherTotal > 0) {
      for (const gen of otherGenerators) {
        const proportion = result[gen] / otherTotal;
        result[gen] = Math.max(
          this.config.min_weight,
          result[gen] - (difference * proportion)
        );
      }
    }

    // Normalize
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    for (const gen in result) {
      result[gen] /= total;
    }

    return result;
  }

  /**
   * Get recommended action for each generator
   */
  getRecommendations(
    performanceData: GeneratorStats[],
    currentWeights: GeneratorWeights
  ): Map<string, string> {
    const recommendations = new Map<string, string>();

    for (const gen of performanceData) {
      const currentWeight = currentWeights[gen.name] || 0;
      
      if (gen.total_posts < this.config.min_posts_for_optimization) {
        recommendations.set(gen.name, '🆕 NEW: Keep monitoring, need more data');
      } else if (gen.f_per_1k > 5) {
        recommendations.set(gen.name, `🚀 VIRAL: Boost to ${Math.min(currentWeight * 1.5, 0.25).toFixed(2)}`);
      } else if (gen.f_per_1k > 3) {
        recommendations.set(gen.name, `⭐ EXCELLENT: Increase to ${Math.min(currentWeight * 1.2, 0.20).toFixed(2)}`);
      } else if (gen.f_per_1k > 1.5) {
        recommendations.set(gen.name, `✅ GOOD: Maintain at ${currentWeight.toFixed(2)}`);
      } else if (gen.f_per_1k > 0.5) {
        recommendations.set(gen.name, `⚠️ AVERAGE: Reduce to ${Math.max(currentWeight * 0.8, this.config.min_weight).toFixed(2)}`);
      } else if (gen.f_per_1k > 0) {
        recommendations.set(gen.name, `⬇️ POOR: Reduce to ${Math.max(currentWeight * 0.5, this.config.min_weight).toFixed(2)}`);
      } else {
        recommendations.set(gen.name, `❌ FAILING: Minimum weight ${this.config.min_weight.toFixed(2)}`);
      }
    }

    return recommendations;
  }

  /**
   * Simulate weight changes (for testing before applying)
   */
  async simulateOptimization(
    performanceData: GeneratorStats[],
    currentWeights: GeneratorWeights
  ): Promise<{
    new_weights: GeneratorWeights;
    changes: WeightChange[];
    recommendations: Map<string, string>;
    estimated_impact: string;
  }> {
    const newWeights = await this.calculateOptimalWeights(performanceData, currentWeights);
    const changes = this.detectSignificantChanges(currentWeights, newWeights);
    const recommendations = this.getRecommendations(performanceData, currentWeights);

    // Estimate impact
    const avgCurrentF1K = performanceData.reduce((sum, g) => {
      const weight = currentWeights[g.name] || 0;
      return sum + (g.f_per_1k * weight);
    }, 0);

    const avgProjectedF1K = performanceData.reduce((sum, g) => {
      const weight = newWeights[g.name] || 0;
      return sum + (g.f_per_1k * weight);
    }, 0);

    const improvement = ((avgProjectedF1K - avgCurrentF1K) / avgCurrentF1K) * 100;
    
    let estimatedImpact = `Projected weighted F/1K: ${avgProjectedF1K.toFixed(2)} `;
    estimatedImpact += `(${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% vs current ${avgCurrentF1K.toFixed(2)})`;

    return {
      new_weights: newWeights,
      changes,
      recommendations,
      estimated_impact: estimatedImpact
    };
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Format weights for display
 */
export function formatWeights(weights: GeneratorWeights): string {
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  return sorted.map(([name, weight]) => `${name}: ${(weight * 100).toFixed(1)}%`).join(', ');
}

/**
 * Export weights for backup/restore
 */
export function exportWeights(weights: GeneratorWeights): string {
  return JSON.stringify(weights, null, 2);
}

/**
 * Import weights from backup
 */
export function importWeights(json: string): GeneratorWeights {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Invalid weights JSON');
  }
}

