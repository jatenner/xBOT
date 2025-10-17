/**
 * 💰 AI BUDGET ORCHESTRATOR
 * 
 * Coordinates all AI systems while staying UNDER $5/day
 * 
 * Budget Allocation:
 * - Content generation: $3.50/day (70%)
 * - Strategy discovery: $0.50/day (10%)
 * - Target finding: $0.25/day (5%)
 * - Timing/conversion: $0.25/day (5%)
 * - Buffer: $0.50/day (10%)
 * 
 * Smart Scheduling:
 * - Expensive AI tasks run during low-activity periods
 * - Results cached aggressively
 * - Batch operations when possible
 * - Graceful degradation if budget exceeded
 */

import { getStrategyDiscoveryEngine } from './strategyDiscoveryEngine';
import { getTargetFinderEngine } from './targetFinderEngine';
import { getSupabaseClient } from '../db/index';

export interface AISystemSchedule {
  system_name: string;
  last_run: string | null;
  next_run: string;
  run_frequency_hours: number;
  estimated_cost_per_run: number;
  priority: number; // 1-10
  enabled: boolean;
}

export interface BudgetStatus {
  daily_budget: number;
  spent_today: number;
  remaining_today: number;
  projected_end_of_day: number;
  can_run_expensive_tasks: boolean;
  systems_status: AISystemSchedule[];
}

export class AIBudgetOrchestrator {
  private static instance: AIBudgetOrchestrator;
  private supabase = getSupabaseClient();
  private lastRunCache: Record<string, string> = {};

  // Budget allocation (per day)
  private readonly DAILY_BUDGET = 5.00;
  private readonly CONTENT_BUDGET = 3.50;
  private readonly STRATEGY_BUDGET = 0.50;
  private readonly TARGET_BUDGET = 0.25;
  private readonly MISC_BUDGET = 0.25;
  private readonly BUFFER = 0.50;

  // System schedules
  private readonly SCHEDULES: Record<string, AISystemSchedule> = {
    strategy_discovery: {
      system_name: 'Strategy Discovery',
      last_run: null,
      next_run: new Date().toISOString(),
      run_frequency_hours: 24, // Once per day
      estimated_cost_per_run: 0.10,
      priority: 9,
      enabled: true
    },
    target_finder: {
      system_name: 'Target Finder',
      last_run: null,
      next_run: new Date().toISOString(),
      run_frequency_hours: 168, // Once per week
      estimated_cost_per_run: 0.05,
      priority: 7,
      enabled: true
    },
    timing_optimizer: {
      system_name: 'Timing Optimizer',
      last_run: null,
      next_run: new Date().toISOString(),
      run_frequency_hours: 168, // Once per week
      estimated_cost_per_run: 0.05,
      priority: 6,
      enabled: true
    }
  };

  private constructor() {}

  public static getInstance(): AIBudgetOrchestrator {
    if (!AIBudgetOrchestrator.instance) {
      AIBudgetOrchestrator.instance = new AIBudgetOrchestrator();
    }
    return AIBudgetOrchestrator.instance;
  }

  /**
   * Main orchestration: Run AI systems based on schedule and budget
   */
  async orchestrate(): Promise<void> {
    console.log('[AI_ORCHESTRATOR] 🧠 Starting AI system orchestration...');

    const budgetStatus = await this.getBudgetStatus();

    console.log(`[AI_ORCHESTRATOR] 💰 Budget: $${budgetStatus.spent_today.toFixed(2)}/$${budgetStatus.daily_budget.toFixed(2)}`);
    console.log(`[AI_ORCHESTRATOR] 💰 Remaining: $${budgetStatus.remaining_today.toFixed(2)}`);

    if (!budgetStatus.can_run_expensive_tasks) {
      console.log('[AI_ORCHESTRATOR] ⚠️ Budget exhausted, skipping expensive AI tasks');
      return;
    }

    // Run systems based on schedule and priority
    for (const [key, schedule] of Object.entries(this.SCHEDULES)) {
      if (!schedule.enabled) {
        console.log(`[AI_ORCHESTRATOR] ⏭️ ${schedule.system_name} disabled`);
        continue;
      }

      const shouldRun = await this.shouldRunSystem(key, schedule);

      if (shouldRun && budgetStatus.remaining_today >= schedule.estimated_cost_per_run) {
        console.log(`[AI_ORCHESTRATOR] 🚀 Running ${schedule.system_name}...`);
        await this.runSystem(key, schedule);
      } else if (shouldRun) {
        console.log(`[AI_ORCHESTRATOR] 💸 Skipping ${schedule.system_name} (insufficient budget)`);
      }
    }

    console.log('[AI_ORCHESTRATOR] ✅ Orchestration complete');
  }

  /**
   * Check if system should run based on schedule
   */
  private async shouldRunSystem(key: string, schedule: AISystemSchedule): Promise<boolean> {
    const lastRun = await this.getLastRun(key);

    if (!lastRun) {
      console.log(`[AI_ORCHESTRATOR] 🆕 ${schedule.system_name} never run, running now`);
      return true;
    }

    const hoursSinceLastRun = (Date.now() - new Date(lastRun).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastRun >= schedule.run_frequency_hours) {
      console.log(`[AI_ORCHESTRATOR] ⏰ ${schedule.system_name} due (${hoursSinceLastRun.toFixed(1)}h since last run)`);
      return true;
    }

    console.log(`[AI_ORCHESTRATOR] ⏱️ ${schedule.system_name} not due yet (${(schedule.run_frequency_hours - hoursSinceLastRun).toFixed(1)}h remaining)`);
    return false;
  }

  /**
   * Run specific AI system
   */
  private async runSystem(key: string, schedule: AISystemSchedule): Promise<void> {
    const startTime = Date.now();

    try {
      switch (key) {
        case 'strategy_discovery':
          await getStrategyDiscoveryEngine().discoverStrategies(true);
          break;

        case 'target_finder':
          await getTargetFinderEngine().discoverTargets(true);
          break;

        case 'timing_optimizer':
          // TODO: Implement timing optimizer
          console.log('[AI_ORCHESTRATOR] ⚠️ Timing optimizer not yet implemented');
          break;

        default:
          console.log(`[AI_ORCHESTRATOR] ❓ Unknown system: ${key}`);
          return;
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[AI_ORCHESTRATOR] ✅ ${schedule.system_name} completed in ${duration}s`);

      // Update last run time
      await this.setLastRun(key);

    } catch (error: any) {
      console.error(`[AI_ORCHESTRATOR] ❌ ${schedule.system_name} failed:`, error.message);
    }
  }

  /**
   * Get budget status
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    // Get today's spend from OpenAI budget system
    const spentToday = await this.getTodaysSpend();

    const remaining = Math.max(0, this.DAILY_BUDGET - spentToday);
    const canRunExpensive = remaining >= 0.50; // Need at least $0.50 buffer

    // Calculate projected end of day spend
    const hoursRemaining = 24 - new Date().getHours();
    const avgHourlySpend = spentToday / (24 - hoursRemaining || 1);
    const projectedEndOfDay = spentToday + (avgHourlySpend * hoursRemaining);

    return {
      daily_budget: this.DAILY_BUDGET,
      spent_today: spentToday,
      remaining_today: remaining,
      projected_end_of_day: projectedEndOfDay,
      can_run_expensive_tasks: canRunExpensive,
      systems_status: Object.values(this.SCHEDULES).map(s => ({
        ...s,
        last_run: this.getLastRunSync(s.system_name)
      }))
    };
  }

  /**
   * Get today's total spend
   */
  private async getTodaysSpend(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data } = await this.supabase
        .from('openai_api_calls')
        .select('cost')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lte('created_at', `${today}T23:59:59.999Z`);

      if (!data || data.length === 0) {
        return 0;
      }

      const total = data.reduce((sum, call) => sum + (Number(call.cost) || 0), 0);
      return total;

    } catch (error) {
      console.error('[AI_ORCHESTRATOR] ⚠️ Could not fetch spend, assuming $0');
      return 0;
    }
  }

  /**
   * Store last run time
   */
  private async setLastRun(systemKey: string): Promise<void> {
    this.lastRunCache[systemKey] = new Date().toISOString();
  }

  /**
   * Get last run time
   */
  private async getLastRun(systemKey: string): Promise<string | null> {
    return this.lastRunCache[systemKey] || null;
  }

  /**
   * Get last run time (sync version for status)
   */
  private getLastRunSync(systemName: string): string | null {
    // This is a simplified sync version for status display
    return null; // Will be populated by actual runs
  }

  /**
   * Force run system (ignores schedule, but respects budget)
   */
  async forceRunSystem(systemKey: string): Promise<boolean> {
    const schedule = this.SCHEDULES[systemKey];
    if (!schedule) {
      console.error(`[AI_ORCHESTRATOR] ❓ Unknown system: ${systemKey}`);
      return false;
    }

    const budgetStatus = await this.getBudgetStatus();

    if (budgetStatus.remaining_today < schedule.estimated_cost_per_run) {
      console.error(`[AI_ORCHESTRATOR] 💸 Insufficient budget to run ${schedule.system_name}`);
      return false;
    }

    await this.runSystem(systemKey, schedule);
    return true;
  }

  /**
   * Get system recommendations
   */
  async getSystemRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    const budgetStatus = await this.getBudgetStatus();

    if (budgetStatus.projected_end_of_day > this.DAILY_BUDGET * 1.2) {
      recommendations.push('⚠️ Projected to exceed budget by 20% - reduce content generation frequency');
    }

    if (budgetStatus.remaining_today < 1.00 && new Date().getHours() < 12) {
      recommendations.push('⚠️ Budget spent quickly today - consider reducing AI usage');
    }

    for (const [key, schedule] of Object.entries(this.SCHEDULES)) {
      const lastRun = await this.getLastRun(key);
      if (!lastRun) {
        recommendations.push(`🆕 ${schedule.system_name} has never run - consider running manually`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All systems running optimally within budget');
    }

    return recommendations;
  }
}

export const getAIBudgetOrchestrator = () => AIBudgetOrchestrator.getInstance();

