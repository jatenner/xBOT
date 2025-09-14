/**
 * Budget Rollover Service
 * Handles daily budget reset and rollover logging
 */

import { Redis } from 'ioredis';

export class BudgetRolloverService {
  private redis: Redis;
  private lastCheckedDate: string = '';
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
  }
  
  /**
   * Check if budget should rollover and log the event
   */
  async checkAndLogRollover(): Promise<void> {
    const currentDate = this.getTodayDateString();
    
    // Only log rollover once per day
    if (this.lastCheckedDate === currentDate) {
      return;
    }
    
    const previousDate = this.getPreviousDateString();
    const currentKey = this.getBudgetKey(currentDate);
    const previousKey = this.getBudgetKey(previousDate);
    
    // Check if we have a new day
    if (this.lastCheckedDate && this.lastCheckedDate !== currentDate) {
      // Get previous day's final spend
      const previousSpend = await this.redis.get(previousKey);
      const previousCalls = await this.redis.get(`${previousKey}:calls`);
      
      console.log(`BUDGET_ROLLOVER: key=${currentKey} tz=${process.env.COST_TRACKER_ROLLOVER_TZ || 'UTC'} previous_spend=$${parseFloat(previousSpend || '0').toFixed(4)} previous_calls=${previousCalls || '0'}`);
      
      // Clear any blocked flags from previous day
      const previousBlockedKey = this.getBlockedKey(previousDate);
      await this.redis.del(previousBlockedKey);
    }
    
    this.lastCheckedDate = currentDate;
  }
  
  /**
   * Get current spend for today
   */
  async getTodaySpend(): Promise<{ spend: number; calls: number }> {
    const todayKey = this.getBudgetKey(this.getTodayDateString());
    
    const [spendStr, callsStr] = await Promise.all([
      this.redis.get(todayKey),
      this.redis.get(`${todayKey}:calls`)
    ]);
    
    return {
      spend: parseFloat(spendStr || '0'),
      calls: parseInt(callsStr || '0')
    };
  }
  
  /**
   * Emergency reset budget (admin function)
   */
  async resetBudget(date?: string): Promise<void> {
    const targetDate = date || this.getTodayDateString();
    const budgetKey = this.getBudgetKey(targetDate);
    const blockedKey = this.getBlockedKey(targetDate);
    
    await Promise.all([
      this.redis.del(budgetKey),
      this.redis.del(`${budgetKey}:calls`),
      this.redis.del(blockedKey)
    ]);
    
    console.log(`BUDGET_ROLLOVER: emergency_reset key=${budgetKey} admin=true`);
  }
  
  private getTodayDateString(): string {
    const tz = process.env.COST_TRACKER_ROLLOVER_TZ || 'UTC';
    
    if (tz === 'UTC') {
      return new Date().toISOString().split('T')[0];
    }
    
    // For non-UTC timezones, this is simplified
    // In production, use a proper timezone library like date-fns-tz
    return new Date().toISOString().split('T')[0];
  }
  
  private getPreviousDateString(): string {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }
  
  private getBudgetKey(date: string): string {
    const prefix = process.env.REDIS_PREFIX || 'prod:';
    return `${prefix}openai_cost:${date}`;
  }
  
  private getBlockedKey(date: string): string {
    const prefix = process.env.REDIS_PREFIX || 'prod:';
    return `${prefix}openai_blocked:${date}`;
  }
}

// Singleton instance
export const budgetRollover = new BudgetRolloverService();

/**
 * Initialize rollover checking (call this in main app startup)
 */
export function initializeBudgetRollover(): void {
  // Check rollover immediately
  budgetRollover.checkAndLogRollover().catch(error => {
    console.error('❌ BUDGET_ROLLOVER_INIT_ERROR:', error.message);
  });
  
  // Check every hour for rollover
  setInterval(() => {
    budgetRollover.checkAndLogRollover().catch(error => {
      console.error('❌ BUDGET_ROLLOVER_CHECK_ERROR:', error.message);
    });
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('✅ BUDGET_ROLLOVER: Initialized with hourly checks');
}
