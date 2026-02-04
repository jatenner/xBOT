/**
 * 💰 BUDGET STORE
 * 
 * Retrieves current budget status for rate controller decisions.
 * Uses bot_run_counters table for budget tracking.
 */

import { getSupabaseClient } from '../db/index';

export interface BudgetStatus {
  daily_budget_remaining: number;
  hourly_budget_remaining: number;
  budget_exceeded: boolean;
}

/**
 * Get current budget status
 */
export async function getBudgets(): Promise<BudgetStatus> {
  try {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's counters
    const { data, error } = await supabase
      .from('bot_run_counters')
      .select('date, posts_today, replies_today, daily_budget_limit, hourly_budget_limit')
      .eq('date', today)
      .single();
    
    if (error || !data) {
      // Default budgets if no data
      return {
        daily_budget_remaining: 100,
        hourly_budget_remaining: 10,
        budget_exceeded: false,
      };
    }
    
    const dailyLimit = data.daily_budget_limit || 100;
    const hourlyLimit = data.hourly_budget_limit || 10;
    const postsToday = data.posts_today || 0;
    const repliesToday = data.replies_today || 0;
    const totalToday = postsToday + repliesToday;
    
    return {
      daily_budget_remaining: Math.max(0, dailyLimit - totalToday),
      hourly_budget_remaining: hourlyLimit, // Simplified - would need hourly tracking
      budget_exceeded: totalToday >= dailyLimit,
    };
  } catch (error: any) {
    console.warn(`[BUDGET_STORE] Error getting budgets: ${error.message}`);
    // Fail-open with generous defaults
    return {
      daily_budget_remaining: 100,
      hourly_budget_remaining: 10,
      budget_exceeded: false,
    };
  }
}
