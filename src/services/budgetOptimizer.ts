/**
 * 🎯 BUDGET OPTIMIZER
 * Intelligent OpenAI budget allocation for maximum follower ROI
 */

import { costTracker } from './costTracker';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const BUDGET_OPTIMIZER_ENABLED = (process.env.BUDGET_OPTIMIZER_ENABLED ?? 'true') === 'true';
const BUDGET_STRATEGY = process.env.BUDGET_STRATEGY ?? 'adaptive';
const BUDGET_PEAK_HOURS = process.env.BUDGET_PEAK_HOURS ?? '17-23';
const BUDGET_MIN_RESERVE_USD = parseFloat(process.env.BUDGET_MIN_RESERVE_USD ?? '0.50');
const DAILY_COST_LIMIT_USD = parseFloat(process.env.DAILY_COST_LIMIT_USD ?? '5.00');

interface ROIData {
  hour: number;
  avg_engagement: number;
  avg_followers_gained: number;
  cost_per_follower: number;
  sample_size: number;
}

interface OptimizationDecision {
  allowExpensive: boolean;
  recommendedModel: 'gpt-4o-mini' | 'gpt-4o';
  maxCostPerCall: number;
  postingFrequency: 'normal' | 'reduced' | 'minimal';
  reasoning: string;
  budgetStatus: {
    spent: number;
    remaining: number;
    hoursLeft: number;
    isPeakHour: boolean;
  };
}

export class BudgetOptimizer {
  private static instance: BudgetOptimizer;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private roiCache: ROIData[] = [];
  private roiCacheExpiry = 0;

  static getInstance(): BudgetOptimizer {
    if (!BudgetOptimizer.instance) {
      BudgetOptimizer.instance = new BudgetOptimizer();
    }
    return BudgetOptimizer.instance;
  }

  /**
   * 🎯 MAIN OPTIMIZATION DECISION
   */
  async optimize(intent: string): Promise<OptimizationDecision> {
    if (!BUDGET_OPTIMIZER_ENABLED) {
      return this.getDefaultDecision();
    }

    try {
      // Get current budget status
      const budgetStatus = await costTracker.getBudgetStatus();
      const now = DateTime.now().setZone('UTC');
      const hoursLeft = 24 - now.hour;
      const isPeakHour = this.isPeakHour(now.hour);

      // Get ROI data
      const roiData = await this.getROIData();
      
      // Calculate optimization strategy
      const decision = this.calculateOptimization({
        spent: budgetStatus.today_spend,
        remaining: budgetStatus.remaining,
        hoursLeft,
        isPeakHour,
        intent,
        roiData
      });

      console.log(`🎯 BUDGET_OPTIMIZER: ${decision.reasoning}`);
      return decision;

    } catch (error: any) {
      console.warn('⚠️ BUDGET_OPTIMIZER: Optimization failed, using defaults:', error.message);
      return this.getDefaultDecision();
    }
  }

  /**
   * 📊 CALCULATE OPTIMIZATION STRATEGY
   */
  private calculateOptimization(params: {
    spent: number;
    remaining: number;
    hoursLeft: number;
    isPeakHour: boolean;
    intent: string;
    roiData: ROIData[];
  }): OptimizationDecision {
    const { spent, remaining, hoursLeft, isPeakHour, intent, roiData } = params;
    
    // Calculate budget utilization rate
    const utilizationRate = spent / DAILY_COST_LIMIT_USD;
    const timeProgress = (24 - hoursLeft) / 24;
    
    // Determine if we're ahead/behind budget
    const budgetPace = utilizationRate - timeProgress;
    
    // Get current hour ROI
    const currentHour = 24 - hoursLeft;
    const currentROI = roiData.find(r => r.hour === currentHour);
    const avgROI = roiData.reduce((sum, r) => sum + r.cost_per_follower, 0) / roiData.length || 0.01;
    
    let decision: OptimizationDecision;
    
    if (BUDGET_STRATEGY === 'conservative') {
      decision = this.conservativeStrategy(remaining, hoursLeft, isPeakHour);
    } else {
      decision = this.adaptiveStrategy(remaining, hoursLeft, isPeakHour, budgetPace, currentROI, avgROI);
    }
    
    // Apply intent-specific adjustments
    decision = this.adjustForIntent(decision, intent);
    
    // Ensure minimum reserve
    if (remaining <= BUDGET_MIN_RESERVE_USD) {
      decision.allowExpensive = false;
      decision.recommendedModel = 'gpt-4o-mini';
      decision.maxCostPerCall = Math.min(0.001, remaining * 0.1);
      decision.postingFrequency = 'minimal';
      decision.reasoning = `Emergency conservation: $${remaining.toFixed(2)} remaining (min reserve: $${BUDGET_MIN_RESERVE_USD})`;
    }
    
    decision.budgetStatus = {
      spent,
      remaining,
      hoursLeft,
      isPeakHour
    };
    
    return decision;
  }

  /**
   * 🛡️ CONSERVATIVE STRATEGY
   */
  private conservativeStrategy(remaining: number, hoursLeft: number, isPeakHour: boolean): OptimizationDecision {
    const hourlyBudget = remaining / Math.max(1, hoursLeft);
    
    return {
      allowExpensive: hourlyBudget > 0.50 && isPeakHour,
      recommendedModel: hourlyBudget > 0.25 ? 'gpt-4o-mini' : 'gpt-4o-mini',
      maxCostPerCall: Math.min(hourlyBudget * 0.5, 0.10),
      postingFrequency: hourlyBudget > 0.20 ? 'normal' : 'reduced',
      reasoning: `Conservative: $${hourlyBudget.toFixed(3)}/hour budget, ${isPeakHour ? 'peak' : 'off-peak'}`,
      budgetStatus: {
        spent: 0,
        remaining,
        hoursLeft,
        isPeakHour
      }
    };
  }

  /**
   * 🎯 ADAPTIVE STRATEGY
   */
  private adaptiveStrategy(
    remaining: number, 
    hoursLeft: number, 
    isPeakHour: boolean, 
    budgetPace: number,
    currentROI: ROIData | undefined,
    avgROI: number
  ): OptimizationDecision {
    const hourlyBudget = remaining / Math.max(1, hoursLeft);
    const roiMultiplier = currentROI ? (avgROI / currentROI.cost_per_follower) : 1;
    
    // Adjust spending based on ROI
    const roiAdjustedBudget = hourlyBudget * Math.min(2, Math.max(0.5, roiMultiplier));
    
    let allowExpensive = false;
    let recommendedModel: 'gpt-4o-mini' | 'gpt-4o' = 'gpt-4o-mini';
    let postingFrequency: 'normal' | 'reduced' | 'minimal' = 'normal';
    
    if (budgetPace < -0.2) {
      // We're behind budget - be more aggressive during peak hours
      allowExpensive = isPeakHour && roiAdjustedBudget > 0.30;
      recommendedModel = isPeakHour && roiAdjustedBudget > 0.20 ? 'gpt-4o' : 'gpt-4o-mini';
      postingFrequency = 'normal';
    } else if (budgetPace > 0.2) {
      // We're ahead of budget - conserve
      allowExpensive = false;
      recommendedModel = 'gpt-4o-mini';
      postingFrequency = 'reduced';
    } else {
      // On track - optimize for ROI
      allowExpensive = isPeakHour && roiMultiplier > 1.2;
      recommendedModel = roiMultiplier > 1.5 ? 'gpt-4o' : 'gpt-4o-mini';
      postingFrequency = roiMultiplier > 1.0 ? 'normal' : 'reduced';
    }
    
    return {
      allowExpensive,
      recommendedModel,
      maxCostPerCall: Math.min(roiAdjustedBudget * 0.8, allowExpensive ? 0.25 : 0.10),
      postingFrequency,
      reasoning: `Adaptive: pace=${budgetPace.toFixed(2)}, ROI=${roiMultiplier.toFixed(2)}x, ${isPeakHour ? 'peak' : 'off-peak'}`,
      budgetStatus: {
        spent: 0,
        remaining,
        hoursLeft,
        isPeakHour
      }
    };
  }

  /**
   * 🎪 ADJUST FOR INTENT
   */
  private adjustForIntent(decision: OptimizationDecision, intent: string): OptimizationDecision {
    const highValueIntents = ['viral_content', 'strategic_engagement', 'thread_creation'];
    const lowValueIntents = ['analytics', 'monitoring', 'debugging'];
    
    if (highValueIntents.some(i => intent.includes(i))) {
      decision.maxCostPerCall *= 1.5;
      decision.reasoning += ' [high-value intent boost]';
    } else if (lowValueIntents.some(i => intent.includes(i))) {
      decision.maxCostPerCall *= 0.5;
      decision.allowExpensive = false;
      decision.reasoning += ' [low-value intent conservation]';
    }
    
    return decision;
  }

  /**
   * 📊 GET ROI DATA
   */
  private async getROIData(): Promise<ROIData[]> {
    const now = Date.now();
    if (now < this.roiCacheExpiry && this.roiCache.length > 0) {
      return this.roiCache;
    }

    try {
      const { data, error } = await this.supabase
        .from('engagement_roi')
        .select('*')
        .order('hour');

      if (error) throw error;

      this.roiCache = data || this.getDefaultROIData();
      this.roiCacheExpiry = now + (30 * 60 * 1000); // 30 minute cache
      
      return this.roiCache;
      
    } catch (error) {
      console.warn('⚠️ BUDGET_OPTIMIZER: Using default ROI data');
      return this.getDefaultROIData();
    }
  }

  /**
   * 🕐 CHECK PEAK HOURS
   */
  private isPeakHour(hour: number): boolean {
    const [start, end] = BUDGET_PEAK_HOURS.split('-').map(h => parseInt(h));
    return hour >= start && hour <= end;
  }

  /**
   * 📊 DEFAULT ROI DATA
   */
  private getDefaultROIData(): ROIData[] {
    // Default ROI data based on typical Twitter engagement patterns
    const baseROI = 0.02; // $0.02 per follower
    return Array.from({ length: 24 }, (_, hour) => {
      const isPeak = this.isPeakHour(hour);
      return {
        hour,
        avg_engagement: isPeak ? 15 : 8,
        avg_followers_gained: isPeak ? 3 : 1,
        cost_per_follower: isPeak ? baseROI * 0.7 : baseROI * 1.3,
        sample_size: isPeak ? 50 : 20
      };
    });
  }

  /**
   * 🔧 DEFAULT DECISION
   */
  private getDefaultDecision(): OptimizationDecision {
    return {
      allowExpensive: false,
      recommendedModel: 'gpt-4o-mini',
      maxCostPerCall: 0.05,
      postingFrequency: 'normal',
      reasoning: 'Default: Optimizer disabled',
      budgetStatus: {
        spent: 0,
        remaining: DAILY_COST_LIMIT_USD,
        hoursLeft: 24,
        isPeakHour: false
      }
    };
  }

  /**
   * 📈 RECORD ROI DATA
   */
  async recordROI(hour: number, engagement: number, followersGained: number, cost: number): Promise<void> {
    try {
      const costPerFollower = followersGained > 0 ? cost / followersGained : cost;
      
      await this.supabase
        .from('engagement_roi')
        .upsert([{
          hour,
          engagement_score: engagement,
          followers_gained: followersGained,
          cost_usd: cost,
          cost_per_follower: costPerFollower,
          recorded_at: new Date().toISOString()
        }], { onConflict: 'hour' });
        
      console.log(`📈 ROI_RECORDED: Hour ${hour}, ${followersGained} followers, $${costPerFollower.toFixed(4)}/follower`);
      
    } catch (error: any) {
      console.warn('⚠️ ROI_RECORD_FAILED:', error.message);
    }
  }
}

export const budgetOptimizer = BudgetOptimizer.getInstance();
export default budgetOptimizer;
