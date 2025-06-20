import { supabaseClient } from './supabaseClient';

interface MonthlyPlan {
  month: string;
  budgetAllocated: boolean;
  dailyTweetBudget: number;
  dailyReadBudget: number;
  conservationMode: boolean;
  daysRemaining: number;
  tweetsRemaining: number;
  readsRemaining: number;
  strategy: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE' | 'EMERGENCY';
}

interface MonthlyLimits {
  tweets: 1500;      // Twitter API v2 Free tier monthly limit
  reads: 10000;      // Twitter API v2 Free tier monthly limit
}

const MONTHLY_LIMITS: MonthlyLimits = {
  tweets: 1500,
  reads: 10000
};

export class MonthlyPlanner {
  /**
   * Get the current monthly plan and optimize distribution
   */
  static async getCurrentMonthlyPlan(): Promise<MonthlyPlan> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = daysInMonth - currentDay + 1; // Including today
    
    try {
      // Get current monthly usage
      const { data: monthlyUsage } = await supabaseClient.supabase
        ?.from('monthly_api_usage')
        .select('*')
        .eq('month', currentMonth)
        .single() || { data: null };

      const tweetsUsed = monthlyUsage?.tweets || 0;
      const readsUsed = monthlyUsage?.reads || 0;
      const tweetsRemaining = MONTHLY_LIMITS.tweets - tweetsUsed;
      const readsRemaining = MONTHLY_LIMITS.reads - readsUsed;

      // Calculate optimal daily budgets
      const dailyTweetBudget = Math.max(1, Math.floor(tweetsRemaining / daysRemaining));
      const dailyReadBudget = Math.max(10, Math.floor(readsRemaining / daysRemaining));

      // Determine strategy based on usage and time remaining
      const tweetUsagePercent = (tweetsUsed / MONTHLY_LIMITS.tweets) * 100;
      const timePercent = ((currentDay - 1) / daysInMonth) * 100;
      
      let strategy: MonthlyPlan['strategy'] = 'BALANCED';
      let conservationMode = false;

      if (tweetUsagePercent > timePercent + 20) {
        // Using tweets too fast
        strategy = 'CONSERVATIVE';
        conservationMode = true;
      } else if (tweetUsagePercent < timePercent - 20 && daysRemaining > 7) {
        // Can afford to be more aggressive
        strategy = 'AGGRESSIVE';
      } else if (tweetsRemaining < 100) {
        // Emergency conservation
        strategy = 'EMERGENCY';
        conservationMode = true;
      }

      console.log(`📊 MONTHLY PLAN ANALYSIS:`);
      console.log(`   Month: ${currentMonth}`);
      console.log(`   Days remaining: ${daysRemaining}/${daysInMonth}`);
      console.log(`   Tweets: ${tweetsUsed}/${MONTHLY_LIMITS.tweets} (${tweetUsagePercent.toFixed(1)}%)`);
      console.log(`   Reads: ${readsUsed}/${MONTHLY_LIMITS.reads} (${(readsUsed/MONTHLY_LIMITS.reads*100).toFixed(1)}%)`);
      console.log(`   Daily budget: ${dailyTweetBudget} tweets, ${dailyReadBudget} reads`);
      console.log(`   Strategy: ${strategy} ${conservationMode ? '(CONSERVATION MODE)' : ''}`);

      return {
        month: currentMonth,
        budgetAllocated: true,
        dailyTweetBudget,
        dailyReadBudget,
        conservationMode,
        daysRemaining,
        tweetsRemaining,
        readsRemaining,
        strategy
      };

    } catch (error) {
      console.error('Error calculating monthly plan:', error);
      
      // Fallback plan
      return {
        month: currentMonth,
        budgetAllocated: false,
        dailyTweetBudget: Math.floor(MONTHLY_LIMITS.tweets / daysInMonth),
        dailyReadBudget: Math.floor(MONTHLY_LIMITS.reads / daysInMonth),
        conservationMode: false,
        daysRemaining,
        tweetsRemaining: MONTHLY_LIMITS.tweets,
        readsRemaining: MONTHLY_LIMITS.reads,
        strategy: 'BALANCED'
      };
    }
  }

  /**
   * Get optimized posting schedule based on monthly plan
   */
  static async getOptimizedSchedule(): Promise<{
    postsPerDay: number;
    minutesBetweenPosts: number;
    engagementRatio: number; // How much to focus on engagement vs posting
    nextResetDate: Date;
    recommendations: string[];
  }> {
    const plan = await this.getCurrentMonthlyPlan();
    
    // Base posting frequency on strategy
    let postsPerDay = plan.dailyTweetBudget;
    let engagementRatio = 0.5; // 50% engagement, 50% posting
    
    switch (plan.strategy) {
      case 'AGGRESSIVE':
        postsPerDay = Math.min(plan.dailyTweetBudget * 1.2, 25); // Up to 25 per day
        engagementRatio = 0.3; // Focus more on posting
        break;
        
      case 'CONSERVATIVE':
        postsPerDay = Math.max(plan.dailyTweetBudget * 0.8, 3); // At least 3 per day
        engagementRatio = 0.7; // Focus more on engagement
        break;
        
      case 'EMERGENCY':
        postsPerDay = Math.max(plan.dailyTweetBudget * 0.5, 1); // Minimal posting
        engagementRatio = 0.9; // Almost all engagement
        break;
        
      default: // BALANCED
        postsPerDay = plan.dailyTweetBudget;
        engagementRatio = 0.5;
    }

    const minutesBetweenPosts = Math.floor((16 * 60) / postsPerDay); // 16 active hours
    
    // Calculate next month reset
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0);

    // Generate recommendations
    const recommendations = this.generateRecommendations(plan);

    return {
      postsPerDay,
      minutesBetweenPosts,
      engagementRatio,
      nextResetDate: nextMonth,
      recommendations
    };
  }

  /**
   * Generate strategic recommendations based on current situation
   */
  private static generateRecommendations(plan: MonthlyPlan): string[] {
    const recommendations: string[] = [];
    
    if (plan.conservationMode) {
      recommendations.push('🚨 Conservation mode active - prioritize high-quality content only');
      recommendations.push('💡 Focus on engagement activities (likes, replies, follows)');
      recommendations.push('🎯 Use simulated engagement when API limits hit');
    }
    
    if (plan.strategy === 'AGGRESSIVE') {
      recommendations.push('🚀 Aggressive posting mode - capitalize on available budget');
      recommendations.push('🔥 Post breakthrough insights during peak hours');
      recommendations.push('💪 Use threads and polls for maximum engagement');
    }
    
    if (plan.strategy === 'EMERGENCY') {
      recommendations.push('🆘 Emergency conservation - minimal posting until month end');
      recommendations.push('🤝 Focus entirely on community engagement');
      recommendations.push('📈 Prepare content library for next month');
    }
    
    if (plan.daysRemaining <= 5) {
      recommendations.push('⏰ Month end approaching - budget remaining tweets carefully');
      recommendations.push('📚 Start preparing content for next month reset');
    }
    
    if (plan.tweetsRemaining > plan.daysRemaining * 10) {
      recommendations.push('💰 Healthy tweet budget remaining - can increase frequency');
      recommendations.push('🎭 Experiment with different content formats');
    }

    return recommendations;
  }

  /**
   * Check if we should enter conservation mode early
   */
  static async shouldEnterConservationMode(): Promise<boolean> {
    const plan = await this.getCurrentMonthlyPlan();
    
    // Conservation triggers
    const lowBudget = plan.tweetsRemaining < (plan.daysRemaining * 3);
    const overUsage = plan.tweetsRemaining < (MONTHLY_LIMITS.tweets * 0.1); // Less than 10% left
    
    return plan.conservationMode || lowBudget || overUsage;
  }

  /**
   * Get next month preparation strategy
   */
  static async getNextMonthStrategy(): Promise<{
    resetDate: Date;
    prepActions: string[];
    budgetPlan: string;
  }> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    nextMonth.setHours(0, 0, 0, 0);
    
    const daysUntilReset = Math.ceil((nextMonth.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    const prepActions = [
      '📝 Prepare 30-50 high-quality tweets in content library',
      '🔬 Research trending health tech topics for next month',
      '📊 Analyze current month performance for optimization',
      '🎯 Plan engagement strategy for month start',
      '⚡ Prepare viral content templates for peak days'
    ];
    
    const budgetPlan = `
🗓️ NEXT MONTH BUDGET PLAN:
• ${MONTHLY_LIMITS.tweets} tweets / 30 days = ~50 tweets/day budget
• Focus first week on aggressive growth (60-70 tweets/day)
• Maintain steady 40-50 tweets/day mid-month
• Conservative 30-40 tweets/day final week
• Reserve 200+ tweets for viral opportunities
    `.trim();

    return {
      resetDate: nextMonth,
      prepActions,
      budgetPlan
    };
  }
}

// Export utility functions
export async function getCurrentMonthlyPlan(): Promise<MonthlyPlan> {
  return MonthlyPlanner.getCurrentMonthlyPlan();
}

export async function getOptimizedSchedule() {
  return MonthlyPlanner.getOptimizedSchedule();
}

export async function shouldEnterConservationMode(): Promise<boolean> {
  return MonthlyPlanner.shouldEnterConservationMode();
} 