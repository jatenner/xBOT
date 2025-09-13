/**
 * Authoritative Budget Gate - Prevents OpenAI overspending
 * Synchronously blocks requests before they hit OpenAI API
 */

import Redis from 'ioredis';

// Environment configuration
const DAILY_OPENAI_LIMIT_USD = parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.00');
const REDIS_URL = process.env.REDIS_URL;
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'prod:';
const BUDGET_ENV_KEY = process.env.BUDGET_ENV_KEY || '';

// Redis client (singleton)
let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis && REDIS_URL) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    redis.on('error', (error) => {
      console.error('💰 BUDGET_REDIS_ERROR:', error.message);
    });
  }
  
  if (!redis) {
    throw new Error('Redis connection required for budget enforcement');
  }
  
  return redis;
}

/**
 * OpenAI Model Pricing (per 1K tokens)
 * Updated as of 2024 - hardcoded for reliability
 */
const COST_TRACKER_MODEL_MULTIPLIERS: Record<string, { input: number; output: number }> = {
  // GPT-4o models
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-05-13': { input: 0.005, output: 0.015 },
  
  // GPT-4o-mini models  
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },
  
  // GPT-4 Turbo models
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-2024-04-09': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4-0125-preview': { input: 0.01, output: 0.03 },
  'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
  
  // GPT-4 models
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-0613': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-4-32k-0613': { input: 0.06, output: 0.12 },
  
  // GPT-3.5 Turbo models
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-1106': { input: 0.001, output: 0.002 },
  'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 }
};

/**
 * Calculate cost for OpenAI API call
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number = 0): number {
  const pricing = COST_TRACKER_MODEL_MULTIPLIERS[model];
  
  if (!pricing) {
    // Safe overestimation for unknown models (use GPT-4 pricing)
    console.warn(`💰 BUDGET_WARNING: Unknown model ${model}, using GPT-4 pricing for safety`);
    const safePricing = COST_TRACKER_MODEL_MULTIPLIERS['gpt-4'];
    return ((inputTokens / 1000) * safePricing.input) + ((outputTokens / 1000) * safePricing.output);
  }
  
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Estimate tokens for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Get today's date key for Redis
 */
function getTodayKey(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${REDIS_PREFIX}${BUDGET_ENV_KEY}openai_cost:${today}`;
}

/**
 * Budget exceeded error
 */
export class BudgetExceededError extends Error {
  constructor(message: string, public spent: number, public limit: number) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<{
  spent: number;
  limit: number;
  remaining: number;
  date: string;
}> {
  const redis = getRedisClient();
  const todayKey = getTodayKey();
  
  try {
    const spentStr = await redis.get(todayKey);
    const spent = parseFloat(spentStr || '0');
    const remaining = Math.max(0, DAILY_OPENAI_LIMIT_USD - spent);
    
    return {
      spent,
      limit: DAILY_OPENAI_LIMIT_USD,
      remaining,
      date: new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('💰 BUDGET_STATUS_ERROR:', error);
    throw new Error('Failed to get budget status');
  }
}

/**
 * AUTHORITATIVE BUDGET ENFORCEMENT
 * Must be called BEFORE every OpenAI API request
 */
export async function enforceBudget(model: string, estimatedInputTokens: number, estimatedOutputTokens: number = 0): Promise<number> {
  const redis = getRedisClient();
  const todayKey = getTodayKey();
  
  // Calculate estimated cost
  const estimatedCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
  
  try {
    // Get current total (atomic operation)
    const currentSpentStr = await redis.get(todayKey);
    const currentSpent = parseFloat(currentSpentStr || '0');
    const projectedTotal = currentSpent + estimatedCost;
    
    // HARD STOP: Block request if it would exceed budget
    if (projectedTotal > DAILY_OPENAI_LIMIT_USD) {
      const status = await getBudgetStatus();
      console.log(`💰 BUDGET_GATE: BLOCKED (${projectedTotal.toFixed(4)} > ${DAILY_OPENAI_LIMIT_USD})`);
      
      throw new BudgetExceededError(
        `Budget exceeded: $${projectedTotal.toFixed(4)} > $${DAILY_OPENAI_LIMIT_USD}`,
        currentSpent,
        DAILY_OPENAI_LIMIT_USD
      );
    }
    
    // Pre-reserve the estimated cost (will be corrected after actual usage)
    await redis.incrbyfloat(todayKey, estimatedCost);
    await redis.expire(todayKey, 86400 * 7); // 7 day expiration
    
    console.log(`💰 BUDGET_GATE: ALLOWED (+$${estimatedCost.toFixed(4)}, total: $${projectedTotal.toFixed(4)}/$${DAILY_OPENAI_LIMIT_USD})`);
    
    return estimatedCost;
    
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      throw error;
    }
    console.error('💰 BUDGET_GATE_ERROR:', error);
    throw new Error('Budget enforcement failed - blocking request for safety');
  }
}

/**
 * Record actual usage after OpenAI API call
 * Corrects the pre-reserved estimate with actual token usage
 */
export async function recordActualUsage(
  model: string, 
  actualInputTokens: number, 
  actualOutputTokens: number,
  estimatedCost: number,
  context: string = 'openai_call'
): Promise<void> {
  const redis = getRedisClient();
  const todayKey = getTodayKey();
  
  try {
    // Calculate actual cost
    const actualCost = calculateCost(model, actualInputTokens, actualOutputTokens);
    const costDifference = actualCost - estimatedCost;
    
    // Adjust Redis total (correct the estimate)
    if (Math.abs(costDifference) > 0.0001) { // Only adjust if significant difference
      await redis.incrbyfloat(todayKey, costDifference);
      console.log(`💰 BUDGET_ADJUST: ${costDifference >= 0 ? '+' : ''}$${costDifference.toFixed(4)} (est: $${estimatedCost.toFixed(4)}, actual: $${actualCost.toFixed(4)})`);
    }
    
    // Get final total for logging
    const finalTotalStr = await redis.get(todayKey);
    const finalTotal = parseFloat(finalTotalStr || '0');
    
    console.log(`💰 BUDGET_STATUS: $${finalTotal.toFixed(4)} / $${DAILY_OPENAI_LIMIT_USD} (${(DAILY_OPENAI_LIMIT_USD - finalTotal).toFixed(4)} remaining) [${context}]`);
    
    // Also log to Supabase for auditing (async, non-blocking)
    logToSupabase(model, actualInputTokens, actualOutputTokens, actualCost, context).catch(error => {
      console.error('💰 SUPABASE_LOG_ERROR:', error.message);
    });
    
  } catch (error) {
    console.error('💰 BUDGET_RECORD_ERROR:', error);
  }
}

/**
 * Log usage to Supabase for auditing
 */
async function logToSupabase(
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number,
  context: string
): Promise<void> {
  try {
    const { pool } = await import('../db/client');
    
    await pool.query(`
      INSERT INTO api_usage (
        intent, model, prompt_tokens, completion_tokens, cost_usd, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [context, model, inputTokens, outputTokens, costUsd]);
    
  } catch (error) {
    // Don't throw - this is just for auditing
    console.error('💰 SUPABASE_AUDIT_ERROR:', error);
  }
}

/**
 * Reset daily budget (for testing/admin use only)
 */
export async function resetDailyBudget(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Budget reset not allowed in production');
  }
  
  const redis = getRedisClient();
  const todayKey = getTodayKey();
  
  await redis.del(todayKey);
  console.log('💰 BUDGET_RESET: Daily budget cleared');
}

/**
 * Get detailed budget breakdown
 */
export async function getBudgetBreakdown(): Promise<{
  status: any;
  redisKey: string;
  modelPricing: typeof COST_TRACKER_MODEL_MULTIPLIERS;
}> {
  const status = await getBudgetStatus();
  
  return {
    status,
    redisKey: getTodayKey(),
    modelPricing: COST_TRACKER_MODEL_MULTIPLIERS
  };
}