/**
 * 🚨 UNIFIED BUDGET ENFORCER
 * 
 * Single source of truth for all budget decisions.
 * Enforces strict $3.00/day limit across all AI operations.
 * 
 * Priority System:
 * - Critical: Tweet generation, posting decisions (must have budget)
 * - Important: Strategic analysis, quality checks (needs 1.5x buffer)
 * - Optional: Image selection, personality evolution (needs 2x buffer)
 */

import { supabaseClient } from './supabaseClient';
import { dailyBudgetAccounting } from './dailyBudgetAccounting';

export type BudgetPriority = 'critical' | 'important' | 'optional';

export interface BudgetStatus {
  totalSpent: number;
  remainingBudget: number;
  dailyLimit: number;
  emergencyBrakeActive: boolean;
  canAffordOperation: boolean;
  recommendedAction: string;
}

export class BudgetEnforcer {
  private static readonly DAILY_LIMIT = 3.00;
  private static readonly EMERGENCY_BRAKE = 2.50;
  private static readonly WARNING_THRESHOLD = 2.00;
  
  // Budget allocation percentages
  private static readonly BUDGET_ALLOCATION = {
    critical: 0.70,   // 70% for critical operations ($2.10)
    important: 0.20,  // 20% for important operations ($0.60)
    optional: 0.10    // 10% for optional operations ($0.30)
  };

  // Priority multipliers for safety buffer
  private static readonly PRIORITY_MULTIPLIERS = {
    critical: 1.0,    // No buffer - critical operations get priority
    important: 1.5,   // 50% buffer - need more remaining budget
    optional: 2.0     // 100% buffer - need significant remaining budget
  };

  /**
   * 🛡️ MAIN BUDGET CHECK
   * All AI operations must call this before making API requests
   */
  static async canAffordOperation(
    estimatedCost: number,
    priority: BudgetPriority,
    operationType: string = 'unknown'
  ): Promise<{ canAfford: boolean; reason: string; remainingBudget: number }> {
    try {
      const status = await this.getBudgetStatus();
      
      // Emergency brake check
      if (status.emergencyBrakeActive) {
        return {
          canAfford: false,
          reason: `Emergency brake active - spent $${status.totalSpent.toFixed(2)}/$${this.DAILY_LIMIT}`,
          remainingBudget: status.remainingBudget
        };
      }

      // Calculate required budget with safety multiplier
      const multiplier = this.PRIORITY_MULTIPLIERS[priority];
      const requiredBudget = estimatedCost * multiplier;

      // Check if we have enough budget
      if (status.remainingBudget < requiredBudget) {
        return {
          canAfford: false,
          reason: `Insufficient budget: need $${requiredBudget.toFixed(4)} (${priority}), have $${status.remainingBudget.toFixed(4)}`,
          remainingBudget: status.remainingBudget
        };
      }

      // Check priority allocation
      const allocatedBudget = this.DAILY_LIMIT * this.BUDGET_ALLOCATION[priority];
      const usedInCategory = await this.getCategorySpending(priority);
      
      if (usedInCategory + estimatedCost > allocatedBudget) {
        return {
          canAfford: false,
          reason: `Category budget exceeded: ${priority} spent $${usedInCategory.toFixed(4)}/$${allocatedBudget.toFixed(2)}`,
          remainingBudget: status.remainingBudget
        };
      }

      console.log(`✅ BUDGET: ${operationType} approved - $${(estimatedCost || 0).toFixed(4)} (${priority})`);
      return {
        canAfford: true,
        reason: `Operation approved - $${(estimatedCost || 0).toFixed(4)} within ${priority} budget`,
        remainingBudget: status.remainingBudget
      };

    } catch (error) {
      console.error('❌ Budget check failed:', error);
      return {
        canAfford: false,
        reason: 'Budget system error - denying operation for safety',
        remainingBudget: 0
      };
    }
  }

  /**
   * 📊 GET CURRENT BUDGET STATUS
   */
  static async getBudgetStatus(): Promise<BudgetStatus> {
    try {
      const budgetStatus = await dailyBudgetAccounting.getTodaysBudgetStatus();
      
      if (!budgetStatus) {
        return {
          totalSpent: 0,
          remainingBudget: this.DAILY_LIMIT,
          dailyLimit: this.DAILY_LIMIT,
          emergencyBrakeActive: false,
          canAffordOperation: true,
          recommendedAction: 'Budget system initializing'
        };
      }

      const emergencyBrakeActive = budgetStatus.total_spent >= this.EMERGENCY_BRAKE;
      const remainingBudget = this.DAILY_LIMIT - budgetStatus.total_spent;

      return {
        totalSpent: budgetStatus.total_spent,
        remainingBudget: Math.max(0, remainingBudget),
        dailyLimit: this.DAILY_LIMIT,
        emergencyBrakeActive,
        canAffordOperation: !emergencyBrakeActive && remainingBudget > 0,
        recommendedAction: this.getRecommendedAction(budgetStatus.total_spent, remainingBudget)
      };

    } catch (error) {
      console.error('❌ Failed to get budget status:', error);
      return {
        totalSpent: this.DAILY_LIMIT,
        remainingBudget: 0,
        dailyLimit: this.DAILY_LIMIT,
        emergencyBrakeActive: true,
        canAffordOperation: false,
        recommendedAction: 'Budget system error - operations suspended'
      };
    }
  }

  /**
   * 💰 RECORD SPENDING
   */
  static async recordSpending(
    cost: number,
    operationType: string,
    priority: BudgetPriority,
    description: string = ''
  ): Promise<boolean> {
    try {
      const result = await dailyBudgetAccounting.recordTransaction(
        operationType,
        'gpt-4o-mini',
        Math.round(cost / 0.00000015), // Convert cost back to tokens
        `${priority.toUpperCase()}: ${description}`
      );

      if (result.success) {
        console.log(`💰 SPENT: $${cost.toFixed(4)} on ${operationType} (${priority}) - $${result.remainingBudget.toFixed(4)} remaining`);
        
        // Log warning if approaching limits
        if (result.remainingBudget < 0.50) {
          console.warn(`⚠️ LOW BUDGET: Only $${result.remainingBudget.toFixed(4)} remaining today`);
        }
      }

      return result.success;

    } catch (error) {
      console.error('❌ Failed to record spending:', error);
      return false;
    }
  }

  /**
   * 📈 GET CATEGORY SPENDING
   */
  private static async getCategorySpending(priority: BudgetPriority): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) return 0;

      const { data, error } = await supabaseClient.supabase
        .from('budget_transactions')
        .select('cost_usd')
        .eq('date', today)
        .ilike('description', `${priority.toUpperCase()}:%`);

      if (error) throw error;

      return data?.reduce((sum, transaction) => sum + transaction.cost_usd, 0) || 0;

    } catch (error) {
      console.error(`❌ Failed to get ${priority} spending:`, error);
      return 0;
    }
  }

  /**
   * 💡 GET RECOMMENDED ACTION
   */
  private static getRecommendedAction(totalSpent: number, remainingBudget: number): string {
    const percentUsed = (totalSpent / this.DAILY_LIMIT) * 100;

    if (totalSpent >= this.EMERGENCY_BRAKE) {
      return '🚨 EMERGENCY BRAKE: All operations suspended';
    } else if (percentUsed > 80) {
      return '⚠️ CRITICAL: Only critical operations allowed';
    } else if (percentUsed > 60) {
      return '💡 CAUTION: Prioritize important operations';
    } else if (percentUsed > 40) {
      return '✅ NORMAL: All operations allowed with monitoring';
    } else {
      return '🚀 OPTIMAL: Full budget available';
    }
  }

  /**
   * 🔄 RESET DAILY BUDGET (called at midnight)
   */
  static async resetDailyBudget(): Promise<void> {
    try {
      await dailyBudgetAccounting.resetDailyBudget();
      console.log(`🌅 Daily budget reset - $${this.DAILY_LIMIT.toFixed(2)} available`);
    } catch (error) {
      console.error('❌ Failed to reset daily budget:', error);
    }
  }

  /**
   * 📊 GET BUDGET REPORT
   */
  static async getBudgetReport(): Promise<string> {
    const status = await this.getBudgetStatus();
    
    return `
🏦 === BUDGET ENFORCER REPORT ===
💰 Daily Limit: $${status.dailyLimit.toFixed(2)}
💸 Total Spent: $${status.totalSpent.toFixed(4)}
💵 Remaining: $${status.remainingBudget.toFixed(4)}
📊 Utilization: ${((status.totalSpent / status.dailyLimit) * 100).toFixed(1)}%
🚨 Emergency Brake: ${status.emergencyBrakeActive ? 'ACTIVE' : 'Inactive'}
💡 Recommendation: ${status.recommendedAction}

📈 BUDGET ALLOCATION:
- Critical Operations: $${(this.DAILY_LIMIT * this.BUDGET_ALLOCATION.critical).toFixed(2)}
- Important Operations: $${(this.DAILY_LIMIT * this.BUDGET_ALLOCATION.important).toFixed(2)}
- Optional Operations: $${(this.DAILY_LIMIT * this.BUDGET_ALLOCATION.optional).toFixed(2)}
`;
  }
}

// Export singleton instance
export const budgetEnforcer = BudgetEnforcer; 