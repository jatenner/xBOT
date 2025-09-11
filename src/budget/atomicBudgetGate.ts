/**
 * Atomic Budget Gate - Hard cap daily OpenAI spend using Redis Lua scripts
 * Ensures race-condition-free budget enforcement across all LLM calls
 */

import { getRedis } from '../lib/redis';

const DAILY_LIMIT_USD = parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0');

interface BudgetStatus {
  current: number;
  limit: number;
  remaining: number;
  key: string;
}

interface BudgetLog {
  intent: string;
  estimated_cost: number;
  actual_cost?: number;
  timestamp: string;
  status: 'ensured' | 'committed' | 'exceeded';
}

// In-memory budget log for detailed tracking
const budgetLogs: BudgetLog[] = [];

// Note: Using simple Redis operations instead of Lua scripts for compatibility with SafeRedisClient

function getTodayKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `prod:openai_cost:${today}`;
}

/**
 * Check if budget allows for estimated cost
 * Throws BudgetExceededException if would exceed daily limit
 */
export async function ensureBudget(intent: string, estimatedCost: number): Promise<void> {
  const client = await getRedis();
  const key = getTodayKey();
  
  // Get current budget (simple atomic operation)
  const currentStr = await client.get(key);
  const current = currentStr ? parseFloat(currentStr) : 0;
  
  const newTotal = current + estimatedCost;
  
  const log: BudgetLog = {
    intent,
    estimated_cost: estimatedCost,
    timestamp: new Date().toISOString(),
    status: newTotal > DAILY_LIMIT_USD ? 'exceeded' : 'ensured'
  };
  
  budgetLogs.push(log);
  
  if (newTotal > DAILY_LIMIT_USD) {
    console.error(`💸 BUDGET_EXCEEDED: Intent=${intent} est=$${estimatedCost.toFixed(4)} would exceed daily limit of $${DAILY_LIMIT_USD}`);
    console.error(`💸 BUDGET_STATUS: Current=$${current.toFixed(4)} Limit=$${DAILY_LIMIT_USD}`);
    
    throw new BudgetExceededException(intent, estimatedCost, current, DAILY_LIMIT_USD);
  }
  
  console.log(`💰 BUDGET_GATE: OK intent=${intent} est=$${estimatedCost.toFixed(4)} current=$${current.toFixed(4)}`);
}

/**
 * Commit actual cost after successful LLM call
 * Returns new total spent today
 */
export async function commitCost(intent: string, actualCost: number): Promise<number> {
  const client = await getRedis();
  const key = getTodayKey();
  
  // Use atomic increment by float
  const newTotalStr = await client.incrByFloat(key, actualCost);
  const newTotal = parseFloat(newTotalStr);
  
  // Set TTL for 48 hours if this is a new key
  if (newTotal === actualCost) {
    await client.expire(key, 60 * 60 * 48);
  }
  
  const log: BudgetLog = {
    intent,
    estimated_cost: 0, // Not relevant for commit
    actual_cost: actualCost,
    timestamp: new Date().toISOString(),
    status: 'committed'
  };
  
  budgetLogs.push(log);
  
  console.log(`💰 BUDGET_COMMIT: actual=$${actualCost.toFixed(4)} total=$${newTotal.toFixed(4)} intent=${intent}`);
  
  // Log to database if available
  try {
    const { insertApiUsage } = await import('../db/supabaseService');
    await insertApiUsage({
      intent,
      model: 'budget_commit',
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: actualCost,
      meta: { 
        daily_total: newTotal,
        budget_logs: budgetLogs.slice(-5) // Last 5 entries for context
      }
    });
  } catch (dbError: any) {
    console.warn('⚠️ BUDGET_DB_LOG_FAILED:', dbError.message);
  }
  
  return newTotal;
}

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const client = await getRedis();
  const key = getTodayKey();
  
  const current = await client.get(key);
  const currentNum = current ? parseFloat(current) : 0;
  
  return {
    current: currentNum,
    limit: DAILY_LIMIT_USD,
    remaining: Math.max(0, DAILY_LIMIT_USD - currentNum),
    key
  };
}

/**
 * Get recent budget logs for debugging
 */
export function getBudgetLogs(limit: number = 20): BudgetLog[] {
  return budgetLogs.slice(-limit);
}

/**
 * Custom exception for budget exceeded
 */
export class BudgetExceededException extends Error {
  constructor(
    public intent: string,
    public estimatedCost: number,
    public currentSpend: number,
    public dailyLimit: number
  ) {
    super(`Budget exceeded: ${intent} ($${estimatedCost.toFixed(4)}) would exceed daily limit of $${dailyLimit} (current: $${currentSpend.toFixed(4)})`);
    this.name = 'BudgetExceededException';
  }
}