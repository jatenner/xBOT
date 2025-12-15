/**
 * Phase 4 Budget Controller
 * 
 * Lightweight budget controller that works with existing budget tracking
 * Decides whether to allow Expert (GPT-4o) usage based on budget constraints
 */

import type { AIRoutingRule } from '../config/aiRoutingConfig';
import { OpenAIBudgetedClient } from '../services/openaiBudgetedClient';

// Budget configuration
const DAILY_OPENAI_LIMIT_USD = parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0');
const EXPERT_BUDGET_RESERVE_PERCENT = 0.25; // Reserve 25% of budget for expert content
const EXPERT_DENY_THRESHOLD = 0.75; // Deny expert if 75%+ of budget used
const MAX_EXPERT_CALLS_PER_DAY = 20; // Cap expert calls per day

// Track expert calls (in-memory, resets daily)
let expertCallsToday = 0;
let lastResetDate = new Date().toDateString();

/**
 * Check if expert model usage should be allowed
 * 
 * @param requestedRule - The routing rule requesting expert usage
 * @returns true if expert usage is allowed, false otherwise
 */
export async function shouldUseExpertModel(requestedRule: AIRoutingRule): Promise<boolean> {
  // If rule doesn't request expert, deny
  if (!requestedRule.useExpert) {
    return false;
  }

  // Reset daily counter if needed
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    expertCallsToday = 0;
    lastResetDate = today;
    console.log(`[PHASE4][BudgetController] Daily reset - expert calls counter reset`);
  }

  // Check expert call cap
  if (expertCallsToday >= MAX_EXPERT_CALLS_PER_DAY) {
    console.log(`[PHASE4][BudgetController] ⚠️ Expert usage denied: daily cap reached (${expertCallsToday}/${MAX_EXPERT_CALLS_PER_DAY})`);
    return false;
  }

  // Get current budget status from existing system
  const budgetClient = OpenAIBudgetedClient.getInstance();
  const budgetStatus = await budgetClient.getBudgetStatus();

  // Check if budget is blocked
  if (budgetStatus.isBlocked) {
    console.log(`[PHASE4][BudgetController] ⚠️ Expert usage denied: budget blocked`);
    return false;
  }

  // Calculate budget thresholds
  const percentUsed = budgetStatus.percentUsed;
  const reserveThreshold = (1 - EXPERT_BUDGET_RESERVE_PERCENT) * 100; // 75% if reserve is 25%

  // Deny expert if budget usage is above threshold
  if (percentUsed >= EXPERT_DENY_THRESHOLD * 100) {
    console.log(`[PHASE4][BudgetController] ⚠️ Expert usage denied: budget usage too high (${percentUsed.toFixed(1)}% >= ${(EXPERT_DENY_THRESHOLD * 100).toFixed(1)}%)`);
    return false;
  }

  // Check if remaining budget is sufficient for expert reserve
  const remainingBudget = budgetStatus.remainingUSD;
  const expertReserveRequired = DAILY_OPENAI_LIMIT_USD * EXPERT_BUDGET_RESERVE_PERCENT;
  
  if (remainingBudget < expertReserveRequired) {
    console.log(`[PHASE4][BudgetController] ⚠️ Expert usage denied: insufficient reserve (remaining: $${remainingBudget.toFixed(2)}, required: $${expertReserveRequired.toFixed(2)})`);
    return false;
  }

  // All checks passed - allow expert usage
  expertCallsToday++;
  console.log(`[PHASE4][BudgetController] ✅ Expert usage allowed (calls today: ${expertCallsToday}/${MAX_EXPERT_CALLS_PER_DAY}, budget: ${percentUsed.toFixed(1)}% used, remaining: $${remainingBudget.toFixed(2)})`);
  return true;
}

/**
 * Get budget status for logging/debugging
 */
export async function getBudgetStatus(): Promise<{
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  percentUsed: number;
  expertCallsToday: number;
  expertCallsRemaining: number;
  expertAllowed: boolean;
}> {
  const budgetClient = OpenAIBudgetedClient.getInstance();
  const budgetStatus = await budgetClient.getBudgetStatus();

  return {
    dailyLimit: DAILY_OPENAI_LIMIT_USD,
    usedToday: budgetStatus.usedTodayUSD,
    remaining: budgetStatus.remainingUSD,
    percentUsed: budgetStatus.percentUsed,
    expertCallsToday,
    expertCallsRemaining: Math.max(0, MAX_EXPERT_CALLS_PER_DAY - expertCallsToday),
    expertAllowed: !budgetStatus.isBlocked && budgetStatus.percentUsed < EXPERT_DENY_THRESHOLD * 100
  };
}

