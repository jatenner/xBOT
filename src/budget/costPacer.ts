// src/budget/costPacer.ts - Hourly budget pacing for $5/day limit
import { log } from '../utils/logger';

export function allowableSpendNow(utcHour: number, dailyLimit = 5): number {
  // front-load slightly to US day, but never exceed linear cap + buffer
  const schedule = [
    0.04, 0.03, 0.03, 0.03, 0.03, 0.03, 0.04, 0.05, 
    0.06, 0.07, 0.08, 0.09, 0.10, 0.09, 0.08, 0.07, 
    0.06, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03
  ];
  const weight = schedule[utcHour] ?? 1/24;
  return dailyLimit * weight; // permitted this hour
}

export function checkBudgetPacing(currentSpend: number, utcHour: number, dailyLimit = 5): { 
  allowed: boolean; 
  hourlyAllowance: number; 
  remaining: number; 
} {
  const hourlyAllowance = allowableSpendNow(utcHour, dailyLimit);
  const remaining = hourlyAllowance - currentSpend;
  const allowed = remaining > 0;

  log(`💰 BUDGET_PACER: hour=${utcHour} allow=$${hourlyAllowance.toFixed(2)} used=$${currentSpend.toFixed(2)} remaining=$${remaining.toFixed(2)}`);

  return {
    allowed,
    hourlyAllowance,
    remaining: Math.max(0, remaining)
  };
}

export function shouldSkipExpensiveOperation(estimatedCost: number, currentHourSpend: number, utcHour: number): boolean {
  const pacing = checkBudgetPacing(currentHourSpend, utcHour);
  
  if (estimatedCost > pacing.remaining) {
    log(`⏭️ BUDGET_SKIP: Operation costs $${estimatedCost.toFixed(3)}, only $${pacing.remaining.toFixed(3)} remaining this hour`);
    return true;
  }
  
  return false;
}

export function getDailyBudgetStatus(totalSpentToday: number, dailyLimit = 5): {
  remaining: number;
  percentUsed: number;
  overBudget: boolean;
} {
  const remaining = Math.max(0, dailyLimit - totalSpentToday);
  const percentUsed = (totalSpentToday / dailyLimit) * 100;
  const overBudget = totalSpentToday >= dailyLimit;

  if (overBudget) {
    log(`🚨 BUDGET_EXHAUSTED: Spent $${totalSpentToday.toFixed(2)} of $${dailyLimit} daily limit`);
  }

  return {
    remaining,
    percentUsed,
    overBudget
  };
}
