/**
 * 🎯 SMART BUDGET OPTIMIZER
 * 
 * Maximizes tweet output within $3 daily budget to prevent "ghost account" syndrome.
 * Intelligently allocates budget to ensure consistent daily tweeting.
 * 
 * Goals:
 * - Use 95%+ of daily budget every day
 * - Maintain 10-15 tweets per day (up from 6)
 * - Smart cost per tweet optimization
 * - Prevent budget waste from being too conservative
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

interface SmartBudgetPlan {
  dailyBudget: number;
  targetTweets: number;
  budgetPerTweet: number;
  hourlyBudget: number;
  remainingBudget: number;
  remainingTweets: number;
  aggressivenessLevel: 'conservative' | 'balanced' | 'aggressive' | 'maximum';
  recommendations: string[];
}

interface CostOptimization {
  maxTokensPerTweet: number;
  aiCallsPerTweet: number;
  estimatedCostPerTweet: number;
  qualityLevel: 'minimum' | 'good' | 'high' | 'premium';
}

export class SmartBudgetOptimizer {
  private static readonly DAILY_BUDGET = 3.00;
  private static readonly MINIMUM_TWEETS_PER_DAY = 10;
  private static readonly OPTIMAL_TWEETS_PER_DAY = 12;
  private static readonly MAX_TWEETS_PER_DAY = 15;
  private static readonly EMERGENCY_RESERVE = 0.30; // $0.30 emergency buffer
  
  // Cost targets (optimized for volume)
  private static readonly COST_TARGETS = {
    cheap: 0.15,      // $0.15 per tweet (20 tweets/day possible)
    balanced: 0.20,   // $0.20 per tweet (15 tweets/day)
    quality: 0.25,    // $0.25 per tweet (12 tweets/day)
    premium: 0.30     // $0.30 per tweet (10 tweets/day)
  };

  /**
   * 🎯 CREATE DAILY SMART BUDGET PLAN
   */
  static async createDailyPlan(): Promise<SmartBudgetPlan> {
    try {
      const currentSpending = await this.getCurrentDailySpending();
      const currentTweets = await this.getTodaysTweetCount();
      const remainingBudget = this.DAILY_BUDGET - currentSpending;
      const remainingHours = this.getRemainingHoursToday();
      
      // Calculate optimal tweet target based on remaining budget
      const targetTweets = this.calculateOptimalTweetTarget(remainingBudget, currentTweets, remainingHours);
      const budgetPerTweet = this.calculateBudgetPerTweet(remainingBudget, targetTweets);
      const aggressiveness = this.determineAggressivenessLevel(currentSpending, currentTweets);
      
      const plan: SmartBudgetPlan = {
        dailyBudget: this.DAILY_BUDGET,
        targetTweets,
        budgetPerTweet,
        hourlyBudget: remainingBudget / Math.max(1, remainingHours),
        remainingBudget,
        remainingTweets: Math.max(0, targetTweets - currentTweets),
        aggressivenessLevel: aggressiveness,
        recommendations: this.generateRecommendations(remainingBudget, currentTweets, targetTweets)
      };

      console.log(`🎯 SMART BUDGET PLAN:`);
      console.log(`   💰 Remaining budget: $${remainingBudget.toFixed(2)}`);
      console.log(`   📝 Target tweets: ${targetTweets} (${plan.remainingTweets} more)`);
      console.log(`   💵 Budget per tweet: $${budgetPerTweet.toFixed(3)}`);
      console.log(`   🎯 Aggressiveness: ${aggressiveness.toUpperCase()}`);
      console.log(`   ⏰ Remaining hours: ${remainingHours}`);

      return plan;

    } catch (error) {
      console.error('❌ Failed to create budget plan:', error);
      return this.getEmergencyFallbackPlan();
    }
  }

  /**
   * 📊 CALCULATE OPTIMAL TWEET TARGET
   */
  private static calculateOptimalTweetTarget(remainingBudget: number, currentTweets: number, remainingHours: number): number {
    // If it's early in the day, be ambitious
    if (remainingHours > 12 && currentTweets < 3) {
      return this.MAX_TWEETS_PER_DAY;
    }
    
    // Calculate how many tweets we can afford
    const maxAffordable = Math.floor(remainingBudget / this.COST_TARGETS.cheap);
    const minRecommended = Math.max(this.MINIMUM_TWEETS_PER_DAY - currentTweets, 0);
    
    // Balance between what we can afford and what we should do
    const target = Math.max(
      minRecommended,
      Math.min(maxAffordable, this.OPTIMAL_TWEETS_PER_DAY - currentTweets)
    );
    
    return Math.max(0, target + currentTweets);
  }

  /**
   * 💰 CALCULATE BUDGET PER TWEET
   */
  private static calculateBudgetPerTweet(remainingBudget: number, targetTweets: number): number {
    if (targetTweets <= 0) return 0;
    
    // Reserve emergency buffer
    const usableBudget = Math.max(0, remainingBudget - this.EMERGENCY_RESERVE);
    const budgetPerTweet = usableBudget / targetTweets;
    
    // Ensure it's within reasonable bounds
    return Math.max(this.COST_TARGETS.cheap, Math.min(budgetPerTweet, this.COST_TARGETS.premium));
  }

  /**
   * 📈 DETERMINE AGGRESSIVENESS LEVEL
   */
  private static determineAggressivenessLevel(currentSpending: number, currentTweets: number): SmartBudgetPlan['aggressivenessLevel'] {
    const spendingPercent = currentSpending / this.DAILY_BUDGET;
    const progressPercent = this.getDayProgress();
    
    // If we're under-spending compared to day progress, be more aggressive
    if (spendingPercent < progressPercent * 0.7 && currentTweets < 6) {
      return 'maximum';
    } else if (spendingPercent < progressPercent * 0.8 && currentTweets < 8) {
      return 'aggressive';
    } else if (spendingPercent < progressPercent * 0.9 && currentTweets < 10) {
      return 'balanced';
    } else {
      return 'conservative';
    }
  }

  /**
   * 🎯 GET COST OPTIMIZATION FOR TWEET
   */
  static getCostOptimization(budgetPerTweet: number): CostOptimization {
    if (budgetPerTweet >= this.COST_TARGETS.premium) {
      return {
        maxTokensPerTweet: 150,
        aiCallsPerTweet: 2,
        estimatedCostPerTweet: this.COST_TARGETS.premium,
        qualityLevel: 'premium'
      };
    } else if (budgetPerTweet >= this.COST_TARGETS.quality) {
      return {
        maxTokensPerTweet: 120,
        aiCallsPerTweet: 2,
        estimatedCostPerTweet: this.COST_TARGETS.quality,
        qualityLevel: 'high'
      };
    } else if (budgetPerTweet >= this.COST_TARGETS.balanced) {
      return {
        maxTokensPerTweet: 100,
        aiCallsPerTweet: 1,
        estimatedCostPerTweet: this.COST_TARGETS.balanced,
        qualityLevel: 'good'
      };
    } else {
      return {
        maxTokensPerTweet: 80,
        aiCallsPerTweet: 1,
        estimatedCostPerTweet: this.COST_TARGETS.cheap,
        qualityLevel: 'minimum'
      };
    }
  }

  /**
   * ✅ CHECK IF TWEET IS WITHIN BUDGET
   */
  static async canAffordTweet(estimatedCost: number): Promise<{
    canAfford: boolean;
    reason: string;
    recommendation: string;
    fallbackOptions: string[];
  }> {
    try {
      // Check for emergency lockdown first
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        return {
          canAfford: false,
          reason: 'Emergency budget lockdown active',
          recommendation: 'Use cached content or wait until tomorrow',
          fallbackOptions: ['Use cached content', 'Generate simple text-only tweet', 'Wait until budget resets']
        };
      }

      const plan = await this.createDailyPlan();
      
      if (estimatedCost <= plan.budgetPerTweet) {
        return {
          canAfford: true,
          reason: `Within budget: $${estimatedCost.toFixed(3)} <= $${plan.budgetPerTweet.toFixed(3)}`,
          recommendation: 'Proceed with tweet generation',
          fallbackOptions: []
        };
      }

      // Check if we can afford it from remaining budget
      if (estimatedCost <= plan.remainingBudget - this.EMERGENCY_RESERVE) {
        return {
          canAfford: true,
          reason: `Affordable from remaining budget: $${estimatedCost.toFixed(3)} <= $${(plan.remainingBudget - this.EMERGENCY_RESERVE).toFixed(3)}`,
          recommendation: 'Proceed but adjust future tweet costs',
          fallbackOptions: []
        };
      }

      // Suggest cost reductions
      const optimization = this.getCostOptimization(plan.budgetPerTweet);
      return {
        canAfford: false,
        reason: `Too expensive: $${estimatedCost.toFixed(3)} > $${plan.budgetPerTweet.toFixed(3)}`,
        recommendation: `Reduce to ${optimization.qualityLevel} quality (${optimization.maxTokensPerTweet} tokens max)`,
        fallbackOptions: [
          `Use ${optimization.qualityLevel} quality settings`,
          'Generate with cached templates',
          'Create simple text-only tweet',
          'Use emergency content library'
        ]
      };

    } catch (error) {
      console.error('❌ Budget check failed:', error);
      return {
        canAfford: false,
        reason: 'Budget system error',
        recommendation: 'Use emergency fallback',
        fallbackOptions: ['Use cached content', 'Emergency content library']
      };
    }
  }

  /**
   * 📊 GET BUDGET UTILIZATION REPORT
   */
  static async getBudgetUtilizationReport(): Promise<string> {
    try {
      const plan = await this.createDailyPlan();
      const currentSpending = await this.getCurrentDailySpending();
      const currentTweets = await this.getTodaysTweetCount();
      const utilizationPercent = (currentSpending / this.DAILY_BUDGET) * 100;
      const efficiency = currentTweets > 0 ? currentSpending / currentTweets : 0;

      return `
🎯 === SMART BUDGET UTILIZATION REPORT ===
💰 Budget Used: $${currentSpending.toFixed(2)}/$${this.DAILY_BUDGET} (${utilizationPercent.toFixed(1)}%)
📝 Tweets Posted: ${currentTweets}/${plan.targetTweets}
💵 Cost per Tweet: $${efficiency.toFixed(3)}
🎯 Target Efficiency: $${plan.budgetPerTweet.toFixed(3)}/tweet
📊 Aggressiveness: ${plan.aggressivenessLevel.toUpperCase()}
⏰ Remaining Hours: ${this.getRemainingHoursToday()}

🎯 RECOMMENDATIONS:
${plan.recommendations.map(r => `   • ${r}`).join('\n')}

📈 OPTIMIZATION STATUS:
${utilizationPercent < 50 ? '🚨 UNDER-UTILIZING BUDGET - Be more aggressive!' : 
  utilizationPercent < 80 ? '💡 Good utilization - maintain pace' : 
  '✅ Excellent budget usage - optimize for quality'}
`;

    } catch (error) {
      console.error('❌ Report generation failed:', error);
      return '❌ Unable to generate budget report';
    }
  }

  // Helper methods
  private static async getCurrentDailySpending(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (!supabaseClient.supabase) return 0;

      const { data } = await supabaseClient.supabase
        .from('budget_transactions')
        .select('cost_usd')
        .eq('date', today);

      return data?.reduce((sum, tx) => sum + tx.cost_usd, 0) || 0;
    } catch {
      return 0;
    }
  }

  private static async getTodaysTweetCount(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (!supabaseClient.supabase) return 0;

      const { count } = await supabaseClient.supabase
        .from('tweets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      
      return count || 0;
    } catch {
      return 0;
    }
  }

  private static getRemainingHoursToday(): number {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    return Math.max(0, Math.ceil((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)));
  }

  private static getDayProgress(): number {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    return (now.getTime() - startOfDay.getTime()) / (endOfDay.getTime() - startOfDay.getTime());
  }

  private static generateRecommendations(remainingBudget: number, currentTweets: number, targetTweets: number): string[] {
    const recommendations = [];
    const remainingTweets = Math.max(0, targetTweets - currentTweets);
    const budgetPerTweet = remainingTweets > 0 ? remainingBudget / remainingTweets : 0;

    if (remainingBudget > 2.0 && currentTweets < 5) {
      recommendations.push('Budget is healthy - be more aggressive with posting');
    }

    if (budgetPerTweet > this.COST_TARGETS.quality) {
      recommendations.push('Can afford high-quality tweets with multiple AI calls');
    } else if (budgetPerTweet > this.COST_TARGETS.balanced) {
      recommendations.push('Use balanced quality settings for optimal tweet volume');
    } else {
      recommendations.push('Use efficient settings to maximize tweet count');
    }

    if (remainingTweets > 8) {
      recommendations.push('Consider using cached content and templates for some tweets');
    }

    if (remainingBudget < 1.0 && remainingTweets > 5) {
      recommendations.push('Switch to emergency content library for remaining tweets');
    }

    return recommendations;
  }

  private static getEmergencyFallbackPlan(): SmartBudgetPlan {
    return {
      dailyBudget: this.DAILY_BUDGET,
      targetTweets: this.MINIMUM_TWEETS_PER_DAY,
      budgetPerTweet: this.COST_TARGETS.cheap,
      hourlyBudget: 0.25,
      remainingBudget: 1.0,
      remainingTweets: this.MINIMUM_TWEETS_PER_DAY,
      aggressivenessLevel: 'conservative',
      recommendations: ['Use emergency content library', 'Focus on cached content']
    };
  }
}

// Export singleton for easy access
export const smartBudgetOptimizer = SmartBudgetOptimizer; 