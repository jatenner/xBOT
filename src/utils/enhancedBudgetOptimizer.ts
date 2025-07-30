/**
 * 💰 ENHANCED BUDGET OPTIMIZER
 * Optimizes AI spending with ROI tracking and intelligent model selection
 */

import { SmartModelSelector } from './smartModelSelector';
import { EmergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { supabaseClient } from './supabaseClient';

export class EnhancedBudgetOptimizer {
  private static instance: EnhancedBudgetOptimizer;
  
  static getInstance(): EnhancedBudgetOptimizer {
    if (!this.instance) {
      this.instance = new EnhancedBudgetOptimizer();
    }
    return this.instance;
  }

  /**
   * 📊 Analyze budget and provide optimization recommendations
   */
  async analyzeBudget(): Promise<any> {
    try {
      console.log('💰 === BUDGET OPTIMIZATION ANALYSIS ===');

      // Get current budget status
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      const currentUtilization = budgetStatus.totalSpent / budgetStatus.dailyLimit;
      const remainingBudget = budgetStatus.dailyLimit - budgetStatus.totalSpent;

      console.log(`💵 Current utilization: ${(currentUtilization * 100).toFixed(1)}%`);
      console.log(`💰 Remaining budget: $${remainingBudget.toFixed(2)}`);

      return {
        current_utilization: currentUtilization,
        remaining_budget: remainingBudget,
        optimization_suggestions: this.generateOptimizationSuggestions(currentUtilization)
      };

    } catch (error) {
      console.error('❌ Budget analysis failed:', error);
      return {
        current_utilization: 0,
        remaining_budget: 0,
        optimization_suggestions: ['Budget analysis failed - using conservative settings']
      };
    }
  }

  /**
   * 📝 Log budget operation
   */
  async logBudgetOperation(
    operationType: string,
    modelUsed: string,
    tokensUsed: number,
    costUSD: number
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('budget_optimization_log')
        .insert({
          operation_type: operationType,
          model_used: modelUsed,
          tokens_used: tokensUsed,
          cost_usd: costUSD,
          time_of_day: new Date().getHours(),
          task_success: true
        });

      console.log(`📝 Budget operation logged: ${operationType} (${modelUsed}, $${costUSD.toFixed(4)})`);

    } catch (error) {
      console.error('❌ Failed to log budget operation:', error);
    }
  }

  private generateOptimizationSuggestions(utilization: number): string[] {
    const suggestions: string[] = [];

    if (utilization >= 0.9) {
      suggestions.push('🚨 Critical: Budget almost exhausted - emergency mode activated');
    } else if (utilization >= 0.7) {
      suggestions.push('⚠️ Warning: High budget utilization - prioritize high-ROI operations');
    } else if (utilization < 0.3) {
      suggestions.push('📈 Opportunity: Low budget usage - consider more aggressive posting');
    }

    return suggestions;
  }
}

export const enhancedBudgetOptimizer = EnhancedBudgetOptimizer.getInstance();