/**
 * ⚠️ DEPRECATED: Monthly Budget Manager
 * 
 * This file is deprecated as of the rate limit refactor.
 * Artificial monthly budgets (1500/month) have been removed.
 * 
 * Real Twitter API limits are now enforced:
 * - 300 tweets per 3-hour rolling window  
 * - 2400 tweets per 24-hour rolling window
 * 
 * These are handled directly by xClient.ts
 */

// Legacy interface for backward compatibility
export interface MonthlyPlan {
  month: number;
  year: number;
  totalBudget: number;
  dailyTweetBudget: number;
  strategicOpportunities: number;
  engagementFocus: boolean;
  currentDayTargets: {
    baseline: number;
    opportunity: number;
    viral: number;
  };
}

export class MonthlyBudgetManager {
  /**
   * @deprecated Use real Twitter rate limits instead (300/3h, 2400/24h)
   */
  async generateCurrentMonthPlan(): Promise<MonthlyPlan> {
    console.warn('⚠️ DEPRECATED: MonthlyBudgetManager is deprecated. Using real Twitter limits.');
    
    // Return a simple plan for backward compatibility
    return {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      totalBudget: 2400, // Real 24-hour Twitter limit
      dailyTweetBudget: 17, // Twitter Free Tier limit
      strategicOpportunities: 50,
      engagementFocus: true,
      currentDayTargets: {
        baseline: 50,
        opportunity: 100,
        viral: 150
      }
    };
  }

  /**
   * @deprecated Use xClient.getRateLimitStatus() instead
   */
  async getDailyTarget(): Promise<number> {
    console.warn('⚠️ DEPRECATED: Use xClient.getRateLimitStatus() for real Twitter limits.');
    return 100; // Conservative target
  }

  /**
   * @deprecated Use real Twitter rate limits
   */
  getMonthlyStats() {
    console.warn('⚠️ DEPRECATED: Monthly artificial limits removed. Use real Twitter limits.');
    return {
      used: 0,
      remaining: 2400,
      percentage: 0
    };
  }
}

export const monthlyBudgetManager = new MonthlyBudgetManager(); 