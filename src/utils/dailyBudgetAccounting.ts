/**
 * 🏦 DAILY BUDGET ACCOUNTING SYSTEM
 * 
 * HARD RULE: Never exceed $3.00 per day - ENFORCED
 * Features:
 * - Real-time cost tracking
 * - Intelligent budget allocation
 * - Emergency brake at $2.50
 * - Cost-per-operation optimization
 * - Daily budget rollover prevention
 */

import { supabaseClient } from './supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

export interface BudgetTransaction {
  id: string;
  date: string;
  operation_type: string;
  model_used: string;
  tokens_used: number;
  cost_usd: number;
  remaining_budget: number;
  description: string;
  created_at: string;
}

export interface DailyBudgetStatus {
  date: string;
  total_spent: number;
  remaining_budget: number;
  transactions_count: number;
  average_cost_per_operation: number;
  budget_utilization_percentage: number;
  emergency_brake_active: boolean;
  cost_efficiency_score: number;
}

export class DailyBudgetAccounting {
  private readonly HARD_DAILY_LIMIT = 7.50; // $7.50 maximum per day - ENFORCED
  private readonly EMERGENCY_BRAKE_THRESHOLD = 7.25; // Stop at $7.25 to prevent overrun
  private readonly WARNING_THRESHOLD = 4.00; // Warning at $4.00
  private readonly COST_PER_1K_TOKENS = 0.00015; // gpt-4o-mini cost
  
  // Budget allocation strategy for $5.00 daily budget
  private readonly BUDGET_ALLOCATION = {
    content_generation: 0.70, // 70% for content creation ($3.50)
    engagement_tracking: 0.15, // 15% for engagement analysis ($0.75)
    learning_systems: 0.10,    // 10% for learning/optimization ($0.50)
    emergency_reserve: 0.05    // 5% emergency buffer ($0.25)
  };

  private _initialized = false;

  constructor() {
    // Don't call async initialization in constructor
  }

  /**
   * 🚀 Initialize daily budget tracking (call this once at startup)
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    
    try {
      await this.initializeDailyBudget();
      this._initialized = true;
      console.log('✅ DailyBudgetAccounting initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize DailyBudgetAccounting:', error);
      throw error;
    }
  }

  /**
   * Initialize daily budget tracking
   */
  private async initializeDailyBudget(): Promise<void> {
    const today = this.getTodayString();
    
    // Create budget tracking table if it doesn't exist
    try {
      await this.createBudgetTables();
      
      // Check if today's budget entry exists
      const todaysBudget = await this.getTodaysBudgetStatus();
      if (!todaysBudget) {
        await this.createDailyBudgetEntry(today);
      }
    } catch (error) {
      console.error('❌ Failed to initialize daily budget:', error);
    }
  }

  /**
   * Create necessary database tables for budget tracking
   */
  private async createBudgetTables(): Promise<void> {
    const createTransactionsTable = `
      CREATE TABLE IF NOT EXISTS budget_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        operation_type VARCHAR(100) NOT NULL,
        model_used VARCHAR(50) NOT NULL,
        tokens_used INTEGER NOT NULL,
        cost_usd DECIMAL(8,6) NOT NULL,
        remaining_budget DECIMAL(8,6) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
      );
    `;

    const createDailyBudgetTable = `
      CREATE TABLE IF NOT EXISTS daily_budget_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE UNIQUE NOT NULL,
        budget_limit DECIMAL(8,2) NOT NULL DEFAULT 3.00,
        total_spent DECIMAL(8,6) NOT NULL DEFAULT 0,
        remaining_budget DECIMAL(8,6) NOT NULL,
        transactions_count INTEGER DEFAULT 0,
        emergency_brake_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
      );
    `;

    if (supabaseClient.supabase) {
      await Promise.all([
        supabaseClient.supabase.rpc('exec_sql', { sql: createTransactionsTable }),
        supabaseClient.supabase.rpc('exec_sql', { sql: createDailyBudgetTable })
      ]);
    }
  }

  /**
   * Record a budget transaction
   */
  async recordTransaction(
    operationType: string,
    modelUsed: string,
    tokensUsed: number,
    description: string = ''
  ): Promise<{ success: boolean; cost: number; remainingBudget: number; canContinue: boolean }> {
    const cost = this.calculateCost(tokensUsed, modelUsed);
    const today = this.getTodayString();

    try {
      // Ensure initialization
      if (!this._initialized) {
        console.log('⚠️ DailyBudgetAccounting not initialized, initializing now...');
        await this.initialize();
      }

      // Get current budget status
      const currentStatus = await this.getTodaysBudgetStatus();
      if (!currentStatus) {
        throw new Error('Daily budget not initialized');
      }

      // Check if transaction would exceed budget
      const newTotal = currentStatus.total_spent + cost;
      if (newTotal > this.HARD_DAILY_LIMIT) {
        console.log(`🚨 BUDGET EXCEEDED: Transaction would cost $${cost.toFixed(6)}, but only $${(this.HARD_DAILY_LIMIT - currentStatus.total_spent).toFixed(6)} remaining`);
        return {
          success: false,
          cost: 0,
          remainingBudget: currentStatus.remaining_budget,
          canContinue: false
        };
      }

      // Record the transaction
      const transaction: Omit<BudgetTransaction, 'id' | 'created_at'> = {
        date: today,
        operation_type: operationType,
        model_used: modelUsed,
        tokens_used: tokensUsed,
        cost_usd: cost,
        remaining_budget: this.HARD_DAILY_LIMIT - newTotal,
        description: description
      };

      // Save transaction
      // Also append to local cache for offline fallback
      try {
        const line = `${today},${cost.toFixed(6)}\n`;
        fs.appendFileSync(path.join(process.cwd(), '.daily_spending.log'), line);
      } catch (_e) {/* ignore */}

      // Save transaction
      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('budget_transactions')
          .insert(transaction);

        // Update daily budget status
        await supabaseClient.supabase
          .from('daily_budget_status')
          .update({
            total_spent: newTotal,
            remaining_budget: this.HARD_DAILY_LIMIT - newTotal,
            transactions_count: currentStatus.transactions_count + 1,
            emergency_brake_active: newTotal >= this.EMERGENCY_BRAKE_THRESHOLD,
            updated_at: new Date().toISOString()
          })
          .eq('date', today);
      }

      const remainingBudget = this.HARD_DAILY_LIMIT - newTotal;
      const emergencyBrakeActive = newTotal >= this.EMERGENCY_BRAKE_THRESHOLD;

      // Log budget status
      console.log(`💰 BUDGET: Spent $${cost.toFixed(6)} on ${operationType} | Remaining: $${remainingBudget.toFixed(6)} | Emergency Brake: ${emergencyBrakeActive ? '🚨 ACTIVE' : '✅ OK'}`);

      return {
        success: true,
        cost: cost,
        remainingBudget: remainingBudget,
        canContinue: !emergencyBrakeActive
      };

    } catch (error) {
      console.error('❌ Failed to record budget transaction:', error);
      return {
        success: false,
        cost: 0,
        remainingBudget: 0,
        canContinue: false
      };
    }
  }

  /**
   * Check if operation is within budget before executing
   */
  async canAffordOperation(
    operationType: string,
    estimatedTokens: number,
    modelUsed: string = 'gpt-4o-mini'
  ): Promise<{ canAfford: boolean; cost: number; remainingBudget: number; recommendation: string }> {
    const estimatedCost = this.calculateCost(estimatedTokens, modelUsed);
    const currentStatus = await this.getTodaysBudgetStatus();

    if (!currentStatus) {
      return {
        canAfford: false,
        cost: estimatedCost,
        remainingBudget: 0,
        recommendation: 'Budget system not initialized'
      };
    }

    const wouldExceedBudget = (currentStatus.total_spent + estimatedCost) > this.HARD_DAILY_LIMIT;
    const wouldTriggerEmergencyBrake = (currentStatus.total_spent + estimatedCost) >= this.EMERGENCY_BRAKE_THRESHOLD;

    let recommendation = '';
    if (wouldExceedBudget) {
      recommendation = `❌ DENIED: Would exceed daily limit. Reduce tokens from ${estimatedTokens} to ${Math.floor((this.HARD_DAILY_LIMIT - currentStatus.total_spent) / this.COST_PER_1K_TOKENS * 1000)}`;
    } else if (wouldTriggerEmergencyBrake) {
      recommendation = `⚠️ WARNING: Would trigger emergency brake. Consider reducing scope.`;
    } else if (estimatedCost > (currentStatus.remaining_budget * 0.5)) {
      recommendation = `💡 OPTIMIZE: Large expense (${((estimatedCost / currentStatus.remaining_budget) * 100).toFixed(1)}% of remaining budget)`;
    } else {
      recommendation = `✅ APPROVED: Operation within budget`;
    }

    return {
      canAfford: !wouldExceedBudget,
      cost: estimatedCost,
      remainingBudget: currentStatus.remaining_budget,
      recommendation: recommendation
    };
  }

  /**
   * Get optimized token limit for remaining budget
   */
  async getOptimalTokenLimit(operationType: string): Promise<number> {
    const currentStatus = await this.getTodaysBudgetStatus();
    if (!currentStatus) return 100; // Fallback

    const allocatedBudget = this.getBudgetAllocation(operationType);
    const availableBudget = Math.min(allocatedBudget, currentStatus.remaining_budget);
    
    // Convert available budget to token limit
    const maxTokens = Math.floor((availableBudget / this.COST_PER_1K_TOKENS) * 1000);
    
    // Apply reasonable limits
    return Math.max(50, Math.min(maxTokens, 500)); // Between 50-500 tokens
  }

  /**
   * Get current budget status
   */
  async getTodaysBudgetStatus(): Promise<DailyBudgetStatus | null> {
    const today = this.getTodayString();

    try {
      if (!supabaseClient.supabase) return null;

      const { data, error } = await supabaseClient.supabase
        .from('daily_budget_status')
        .select('*')
        .eq('date', today)
        .single();

      if (error || !data) return null;

      // Calculate additional metrics
      const budgetUtilization = (data.total_spent / this.HARD_DAILY_LIMIT) * 100;
      const avgCostPerOperation = data.transactions_count > 0 ? data.total_spent / data.transactions_count : 0;
      const costEfficiencyScore = this.calculateEfficiencyScore(data.total_spent, data.transactions_count);

      return {
        date: data.date,
        total_spent: data.total_spent,
        remaining_budget: data.remaining_budget,
        transactions_count: data.transactions_count,
        average_cost_per_operation: avgCostPerOperation,
        budget_utilization_percentage: budgetUtilization,
        emergency_brake_active: data.emergency_brake_active,
        cost_efficiency_score: costEfficiencyScore
      };

    } catch (error) {
      console.error('❌ Failed to get budget status:', error);
      return null;
    }
  }

  /**
   * Generate daily budget report
   */
  async generateDailyReport(): Promise<string> {
    const status = await this.getTodaysBudgetStatus();
    if (!status) return '❌ Budget data unavailable';

    const report = `
🏦 === DAILY BUDGET REPORT ===
📅 Date: ${status.date}
💰 Budget Limit: $${this.HARD_DAILY_LIMIT.toFixed(2)}
💸 Total Spent: $${status.total_spent.toFixed(6)}
💵 Remaining: $${status.remaining_budget.toFixed(6)}
📊 Utilization: ${status.budget_utilization_percentage.toFixed(1)}%
🔢 Transactions: ${status.transactions_count}
📈 Avg Cost/Op: $${status.average_cost_per_operation.toFixed(6)}
⚡ Efficiency Score: ${status.cost_efficiency_score.toFixed(1)}/100
🚨 Emergency Brake: ${status.emergency_brake_active ? 'ACTIVE' : 'Inactive'}

💡 BUDGET ALLOCATION:
- Content Generation: $${this.getBudgetAllocation('content_generation').toFixed(2)}
- Engagement Tracking: $${this.getBudgetAllocation('engagement_tracking').toFixed(2)}
- Learning Systems: $${this.getBudgetAllocation('learning_systems').toFixed(2)}
- Emergency Reserve: $${this.getBudgetAllocation('emergency_reserve').toFixed(2)}
`;

    return report;
  }

  /**
   * Reset daily budget (called at midnight)
   */
  async resetDailyBudget(): Promise<void> {
    const today = this.getTodayString();
    await this.createDailyBudgetEntry(today);
    console.log(`🌅 Daily budget reset for ${today} - $${this.HARD_DAILY_LIMIT.toFixed(2)} available`);
  }

  // === PRIVATE HELPER METHODS ===

  private calculateCost(tokens: number, model: string): number {
    const costPer1K = this.getCostPer1KTokens(model);
    return (tokens / 1000) * costPer1K;
  }

  private getCostPer1KTokens(model: string): number {
    const costs: { [key: string]: number } = {
      'gpt-4o-mini': 0.00015,
      'gpt-4o': 0.03,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002
    };
    return costs[model] || 0.00015; // Default to gpt-4o-mini
  }

  private getBudgetAllocation(operationType: string): number {
    const allocation = this.BUDGET_ALLOCATION[operationType as keyof typeof this.BUDGET_ALLOCATION];
    return (allocation || 0.1) * this.HARD_DAILY_LIMIT;
  }

  private calculateEfficiencyScore(totalSpent: number, transactionCount: number): number {
    if (transactionCount === 0) return 100;
    
    const idealCostPerTransaction = 0.005; // $0.005 per operation is ideal
    const actualCostPerTransaction = totalSpent / transactionCount;
    const efficiency = Math.max(0, 100 - ((actualCostPerTransaction - idealCostPerTransaction) / idealCostPerTransaction * 100));
    
    return Math.min(100, efficiency);
  }

  private getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async createDailyBudgetEntry(date: string): Promise<void> {
    if (!supabaseClient.supabase) return;

    await supabaseClient.supabase
      .from('daily_budget_status')
      .upsert({
        date: date,
        budget_limit: this.HARD_DAILY_LIMIT,
        total_spent: 0,
        remaining_budget: this.HARD_DAILY_LIMIT,
        transactions_count: 0,
        emergency_brake_active: false
      });
  }
}

// Export singleton instance
export const dailyBudgetAccounting = new DailyBudgetAccounting(); 