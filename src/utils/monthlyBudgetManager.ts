/**
 * Intelligent Monthly Budget Manager
 * Distributes 1500 monthly tweets based on opportunities, trends, and strategic timing
 */

import { supabaseClient } from './supabaseClient';
import { defaults } from './config';

interface MonthlyBudgetState {
  month: string; // YYYY-MM format
  tweets_used: number;
  tweets_budget: number;
  days_remaining: number;
  daily_targets: { [date: string]: number };
  strategic_reserves: number; // Tweets saved for viral opportunities
  performance_multiplier: number; // Boost based on recent performance
  last_updated: string;
}

interface DailyTargetCalculation {
  base_target: number;
  opportunity_boost: number;
  performance_modifier: number;
  remaining_budget_factor: number;
  final_target: number;
  reasoning: string;
}

class MonthlyBudgetManager {
  private currentState: MonthlyBudgetState | null = null;

  /**
   * Get intelligent daily tweet target based on monthly budget and opportunities
   */
  async getIntelligentDailyTarget(): Promise<DailyTargetCalculation> {
    await this.loadMonthlyState();
    
    const today = new Date().toISOString().split('T')[0];
    const calculation = await this.calculateOptimalDailyTarget(today);
    
    console.log(`🎯 Intelligent Daily Target: ${calculation.final_target} tweets`);
    console.log(`📊 Reasoning: ${calculation.reasoning}`);
    
    return calculation;
  }

  /**
   * Load or initialize monthly budget state
   */
  private async loadMonthlyState(): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('monthly_budget_state')
        .select('*')
        .eq('month', currentMonth)
        .single();

      if (data && !error) {
        this.currentState = data;
      } else {
        // Initialize new month
        this.currentState = await this.initializeNewMonth(currentMonth);
      }
    } catch (error) {
      console.log('🔄 Initializing monthly budget state...');
      this.currentState = await this.initializeNewMonth(currentMonth);
    }
  }

  /**
   * Initialize budget state for new month
   */
  private async initializeNewMonth(month: string): Promise<MonthlyBudgetState> {
    const newState: MonthlyBudgetState = {
      month,
      tweets_used: 0,
      tweets_budget: defaults.monthlyTweetBudget,
      days_remaining: this.getDaysRemainingInMonth(),
      daily_targets: {},
      strategic_reserves: Math.floor(defaults.monthlyTweetBudget * 0.15), // 15% for opportunities
      performance_multiplier: 1.0,
      last_updated: new Date().toISOString()
    };

    // Save to database
    await supabaseClient.supabase
      ?.from('monthly_budget_state')
      .upsert(newState, { onConflict: 'month' });

    return newState;
  }

  /**
   * Calculate optimal daily target using multiple factors
   */
  private async calculateOptimalDailyTarget(date: string): Promise<DailyTargetCalculation> {
    if (!this.currentState) {
      throw new Error('Monthly state not loaded');
    }

    // Base calculation: remaining budget / remaining days
    const remainingTweets = this.currentState.tweets_budget - this.currentState.tweets_used;
    const remainingDays = this.getDaysRemainingInMonth();
    const baseTarget = Math.max(
      defaults.minDailyTweets,
      Math.floor(remainingTweets / Math.max(1, remainingDays))
    );

    // Opportunity boost (trending topics, viral content potential)
    const opportunityBoost = await this.calculateOpportunityBoost();
    
    // Performance modifier (recent engagement success)
    const performanceModifier = await this.calculatePerformanceModifier();
    
    // Remaining budget factor (more aggressive if month is ending)
    const remainingBudgetFactor = this.calculateRemainingBudgetFactor(remainingDays);
    
    // Calculate final target
    let finalTarget = Math.floor(
      baseTarget * 
      (1 + opportunityBoost) * 
      performanceModifier * 
      remainingBudgetFactor
    );
    
    // Apply safety caps
    finalTarget = Math.min(finalTarget, defaults.maxDailyTweets);
    finalTarget = Math.max(finalTarget, defaults.minDailyTweets);
    
    // Ensure we don't exceed monthly budget
    if (this.currentState.tweets_used + finalTarget > this.currentState.tweets_budget) {
      finalTarget = Math.max(1, this.currentState.tweets_budget - this.currentState.tweets_used);
    }

    const reasoning = this.generateTargetReasoning(
      baseTarget, 
      opportunityBoost, 
      performanceModifier, 
      remainingBudgetFactor, 
      finalTarget,
      remainingTweets,
      remainingDays
    );

    return {
      base_target: baseTarget,
      opportunity_boost: opportunityBoost,
      performance_modifier: performanceModifier,
      remaining_budget_factor: remainingBudgetFactor,
      final_target: finalTarget,
      reasoning
    };
  }

  /**
   * Calculate opportunity boost based on trending topics and viral potential
   */
  private async calculateOpportunityBoost(): Promise<number> {
    try {
      // Check for trending health/AI topics
      const { data: trends } = await supabaseClient.supabase
        ?.from('trending_topics')
        .select('*')
        .eq('active', true)
        .gte('relevance_score', 0.7)
        .limit(5) || { data: [] };

      // Check for viral content opportunities
      const { data: viralPotential } = await supabaseClient.supabase
        ?.from('viral_opportunities')
        .select('*')
        .eq('active', true)
        .gte('confidence_score', 0.8)
        .limit(3) || { data: [] };

      let boost = 0;
      
      // High-relevance trends boost posting
      if (trends && trends.length > 2) {
        boost += 0.3; // 30% boost for multiple trending topics
      } else if (trends && trends.length > 0) {
        boost += 0.15; // 15% boost for some trends
      }
      
      // Viral opportunities boost posting
      if (viralPotential && viralPotential.length > 1) {
        boost += 0.25; // 25% boost for viral opportunities
      } else if (viralPotential && viralPotential.length > 0) {
        boost += 0.1; // 10% boost for some opportunities
      }

      return Math.min(boost, 0.5); // Cap at 50% boost
    } catch (error) {
      console.log('⚠️ Could not calculate opportunity boost:', error);
      return 0;
    }
  }

  /**
   * Calculate performance modifier based on recent engagement success
   */
  private async calculatePerformanceModifier(): Promise<number> {
    try {
      // Get last 7 days of tweet performance
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentTweets } = await supabaseClient.supabase
        ?.from('tweets')
        .select('engagement_score, viral_potential')
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('engagement_score', 'is', null)
        .limit(50) || { data: [] };

      if (!recentTweets || recentTweets.length === 0) {
        return 1.0; // Neutral if no data
      }

      const avgEngagement = recentTweets.reduce((sum: number, tweet: any) => 
        sum + (tweet.engagement_score || 0), 0) / recentTweets.length;

      const avgViralPotential = recentTweets.reduce((sum: number, tweet: any) => 
        sum + (tweet.viral_potential || 0), 0) / recentTweets.length;

      // Higher performance = more aggressive posting
      if (avgEngagement > 0.7 || avgViralPotential > 0.8) {
        return 1.3; // 30% boost for high performance
      } else if (avgEngagement > 0.5 || avgViralPotential > 0.6) {
        return 1.15; // 15% boost for good performance
      } else if (avgEngagement < 0.3 && avgViralPotential < 0.4) {
        return 0.85; // 15% reduction for poor performance
      }

      return 1.0; // Neutral for average performance
    } catch (error) {
      console.log('⚠️ Could not calculate performance modifier:', error);
      return 1.0;
    }
  }

  /**
   * Calculate factor based on remaining days and budget
   */
  private calculateRemainingBudgetFactor(remainingDays: number): number {
    if (!this.currentState) return 1.0;

    const budgetUtilization = this.currentState.tweets_used / this.currentState.tweets_budget;
    const timeElapsed = (new Date().getDate() - 1) / new Date().getDate(); // Rough approximation

    // If we're behind on budget usage, be more aggressive
    if (budgetUtilization < timeElapsed - 0.15) {
      return 1.4; // 40% boost if significantly behind
    } else if (budgetUtilization < timeElapsed - 0.05) {
      return 1.2; // 20% boost if slightly behind
    } else if (budgetUtilization > timeElapsed + 0.15) {
      return 0.7; // 30% reduction if significantly ahead
    } else if (budgetUtilization > timeElapsed + 0.05) {
      return 0.9; // 10% reduction if slightly ahead
    }

    // End of month urgency
    if (remainingDays <= 3 && this.currentState.tweets_used < this.currentState.tweets_budget * 0.9) {
      return 1.5; // 50% boost in final days
    }

    return 1.0; // Neutral if on track
  }

  /**
   * Generate human-readable reasoning for the target
   */
  private generateTargetReasoning(
    baseTarget: number,
    opportunityBoost: number,
    performanceModifier: number,
    budgetFactor: number,
    finalTarget: number,
    remainingTweets: number,
    remainingDays: number
  ): string {
    const reasons = [];
    
    reasons.push(`Base: ${baseTarget} (${remainingTweets} tweets ÷ ${remainingDays} days)`);
    
    if (opportunityBoost > 0.2) {
      reasons.push(`+${(opportunityBoost * 100).toFixed(0)}% trending opportunities`);
    } else if (opportunityBoost > 0) {
      reasons.push(`+${(opportunityBoost * 100).toFixed(0)}% mild opportunities`);
    }
    
    if (performanceModifier > 1.1) {
      reasons.push(`+${((performanceModifier - 1) * 100).toFixed(0)}% strong performance`);
    } else if (performanceModifier < 0.9) {
      reasons.push(`${((performanceModifier - 1) * 100).toFixed(0)}% poor performance`);
    }
    
    if (budgetFactor > 1.1) {
      reasons.push(`+${((budgetFactor - 1) * 100).toFixed(0)}% catch-up mode`);
    } else if (budgetFactor < 0.9) {
      reasons.push(`${((budgetFactor - 1) * 100).toFixed(0)}% ahead of schedule`);
    }
    
    return `${reasons.join(', ')} → ${finalTarget} tweets`;
  }

  /**
   * Record tweet usage and update monthly state
   */
  async recordTweetUsage(count: number = 1): Promise<void> {
    if (!this.currentState) {
      await this.loadMonthlyState();
    }

    if (this.currentState) {
      this.currentState.tweets_used += count;
      this.currentState.last_updated = new Date().toISOString();
      
      await supabaseClient.supabase
        ?.from('monthly_budget_state')
        .upsert(this.currentState, { onConflict: 'month' });
    }
  }

  /**
   * Get remaining days in current month
   */
  private getDaysRemainingInMonth(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(1, lastDay - now.getDate() + 1);
  }

  /**
   * Get current monthly budget status
   */
  async getMonthlyStatus(): Promise<{
    used: number;
    budget: number;
    remaining: number;
    daysLeft: number;
    utilization: number;
    onTrack: boolean;
  }> {
    await this.loadMonthlyState();
    
    if (!this.currentState) {
      throw new Error('Could not load monthly state');
    }

    const remaining = this.currentState.tweets_budget - this.currentState.tweets_used;
    const daysLeft = this.getDaysRemainingInMonth();
    const utilization = this.currentState.tweets_used / this.currentState.tweets_budget;
    const expectedUtilization = (new Date().getDate() - 1) / new Date().getDate(); // Rough
    const onTrack = Math.abs(utilization - expectedUtilization) < 0.1;

    return {
      used: this.currentState.tweets_used,
      budget: this.currentState.tweets_budget,
      remaining,
      daysLeft,
      utilization,
      onTrack
    };
  }
}

export const monthlyBudgetManager = new MonthlyBudgetManager(); 