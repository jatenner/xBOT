/**
 * 🎼 GROWTH MASTER ORCHESTRATOR (SIMPLIFIED)
 * ==========================================
 * Simplified version for build success - will be enhanced later
 */

import { predictiveGrowthEngine } from './PredictiveGrowthEngine';
import { contentPerformanceLearning } from './ContentPerformanceLearning';
import { contentStrategyOptimizer } from './ContentStrategyOptimizer';
import { systematicABTesting } from './SystematicABTesting';

interface GrowthDecision {
  shouldPost: boolean;
  confidence: number;
  reason: string;
  strategy: string;
}

export class GrowthMasterOrchestrator {
  private static instance: GrowthMasterOrchestrator;

  static getInstance(): GrowthMasterOrchestrator {
    if (!this.instance) {
      this.instance = new GrowthMasterOrchestrator();
    }
    return this.instance;
  }

  /**
   * 🎯 MAKE GROWTH DECISION (SIMPLIFIED)
   */
  async makeGrowthDecision(content: string, context: any): Promise<GrowthDecision> {
    try {
      // Get prediction from growth engine
      const prediction = await predictiveGrowthEngine.predictGrowthPotential(content, context.timing || {});
      
      return {
        shouldPost: prediction.shouldPost,
        confidence: prediction.confidence,
        reason: prediction.reason,
        strategy: prediction.shouldPost ? 'growth_optimized' : 'conservative'
      };
    } catch (error) {
      console.log('🎯 Growth decision fallback:', error);
      return {
        shouldPost: true,
        confidence: 0.5,
        reason: 'Using fallback decision logic',
        strategy: 'balanced'
      };
    }
  }

  /**
   * 📅 RUN DAILY LEARNING CYCLE (SIMPLIFIED)
   */
  async runDailyLearningCycle(): Promise<void> {
    try {
      console.log('📚 Running daily learning cycle...');
      
      // Get insights from all systems
      await Promise.all([
        contentPerformanceLearning.analyzePerformancePatterns(),
        contentStrategyOptimizer.generateOptimizationRecommendations(),
        systematicABTesting.getCurrentTestRecommendations()
      ]);
      
      console.log('✅ Daily learning cycle completed');
    } catch (error) {
      console.log('⚠️ Learning cycle error (non-critical):', error);
    }
  }
}

export const growthMasterOrchestrator = GrowthMasterOrchestrator.getInstance();