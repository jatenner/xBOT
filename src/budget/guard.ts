/**
 * Budget Guard - Strict LLM cost enforcement
 * Prevents OpenAI spending when posting is disabled or budget limits are reached
 */

import Redis from 'ioredis';

// Redis connection (lazy initialization)
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });
  }
  return redis!;
}

// Environment configuration
const BUDGET_ENFORCER_ENABLED = process.env.BUDGET_ENFORCER_ENABLED === 'true';
const POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
const DRY_RUN = process.env.DRY_RUN === 'true';
const DAILY_OPENAI_LIMIT_USD = parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5');
const MAX_GENERATIONS_PER_HOUR = parseInt(process.env.MAX_GENERATIONS_PER_HOUR || '0');

// Get current date key for budget tracking
function getDateKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// Get current hour key for generation tracking
function getHourKey(): string {
  const now = new Date();
  return `${getDateKey()}-${now.getUTCHours().toString().padStart(2, '0')}`;
}

/**
 * Check if LLM generation is allowed
 * Returns { allowed: boolean, reason?: string, cost?: number }
 */
export async function checkLLMAllowed(): Promise<{ allowed: boolean; reason?: string; cost?: number }> {
  // Check 1: POSTING_DISABLED takes precedence
  if (POSTING_DISABLED) {
    console.log('LLM_SKIPPED: posting disabled');
    return { allowed: false, reason: 'POSTING_DISABLED=true' };
  }
  
  // Check 2: DRY_RUN mode
  if (DRY_RUN) {
    console.log('DRY_RUN: no LLM usage');
    return { allowed: false, reason: 'DRY_RUN=true' };
  }
  
  // Check 3: Budget enforcer (if enabled)
  if (BUDGET_ENFORCER_ENABLED) {
    try {
      const redis = getRedis();
      if (!redis) {
        console.warn('BUDGET_GUARD: Redis unavailable, allowing LLM call');
        return { allowed: true };
      }
      
      // Check daily budget
      const dateKey = getDateKey();
      const costKey = `prod:openai_cost:${dateKey}`;
      const currentCostStr = await redis.get(costKey);
      const currentCost = parseFloat(currentCostStr || '0');
      
      if (currentCost >= DAILY_OPENAI_LIMIT_USD) {
        console.log(`BUDGET_BLOCK: limit reached ($${currentCost}/$${DAILY_OPENAI_LIMIT_USD})`);
        return { 
          allowed: false, 
          reason: `Daily budget limit reached: $${currentCost}/$${DAILY_OPENAI_LIMIT_USD}`,
          cost: currentCost
        };
      }
      
      // Check hourly generation limit (if configured)
      if (MAX_GENERATIONS_PER_HOUR > 0) {
        const hourKey = getHourKey();
        const generationKey = `prod:generations:${hourKey}`;
        const currentGenerationsStr = await redis.get(generationKey);
        const currentGenerations = parseInt(currentGenerationsStr || '0');
        
        if (currentGenerations >= MAX_GENERATIONS_PER_HOUR) {
          console.log(`GENERATION_LIMIT: hourly limit reached (${currentGenerations}/${MAX_GENERATIONS_PER_HOUR})`);
          return { 
            allowed: false, 
            reason: `Hourly generation limit reached: ${currentGenerations}/${MAX_GENERATIONS_PER_HOUR}`
          };
        }
      }
      
      // All checks passed
      console.log(`BUDGET_GUARD: LLM allowed (cost: $${currentCost}/$${DAILY_OPENAI_LIMIT_USD})`);
      return { allowed: true, cost: currentCost };
      
    } catch (error) {
      console.error('BUDGET_GUARD: Error checking budget, allowing LLM call:', error);
      return { allowed: true };
    }
  }
  
  // Budget enforcer disabled - allow call
  return { allowed: true };
}

/**
 * Record LLM usage after successful call
 */
export async function recordLLMUsage(costUsd: number, metadata?: any): Promise<void> {
  if (!BUDGET_ENFORCER_ENABLED) return;
  
  try {
    const redis = getRedis();
    if (!redis) return;
    
    const dateKey = getDateKey();
    const hourKey = getHourKey();
    
    // Update daily cost
    const costKey = `prod:openai_cost:${dateKey}`;
    await redis.incrbyfloat(costKey, costUsd);
    await redis.expire(costKey, 86400 * 7); // Keep for 7 days
    
    // Update hourly generation count
    if (MAX_GENERATIONS_PER_HOUR > 0) {
      const generationKey = `prod:generations:${hourKey}`;
      await redis.incr(generationKey);
      await redis.expire(generationKey, 3600); // Keep for 1 hour
    }
    
    console.log(`BUDGET_RECORDED: +$${costUsd} (date: ${dateKey})`);
    
  } catch (error) {
    console.error('BUDGET_GUARD: Error recording usage:', error);
  }
}

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<{
  dailySpent: number;
  dailyLimit: number;
  hourlyGenerations: number;
  hourlyLimit: number;
  postingDisabled: boolean;
  dryRun: boolean;
  budgetEnforcerEnabled: boolean;
}> {
  let dailySpent = 0;
  let hourlyGenerations = 0;
  
  if (BUDGET_ENFORCER_ENABLED) {
    try {
      const redis = getRedis();
      if (redis) {
        const dateKey = getDateKey();
        const hourKey = getHourKey();
        
        const costKey = `prod:openai_cost:${dateKey}`;
        const generationKey = `prod:generations:${hourKey}`;
        
        const [costStr, generationsStr] = await Promise.all([
          redis.get(costKey),
          redis.get(generationKey)
        ]);
        
        dailySpent = parseFloat(costStr || '0');
        hourlyGenerations = parseInt(generationsStr || '0');
      }
    } catch (error) {
      console.error('BUDGET_STATUS: Error reading status:', error);
    }
  }
  
  return {
    dailySpent,
    dailyLimit: DAILY_OPENAI_LIMIT_USD,
    hourlyGenerations,
    hourlyLimit: MAX_GENERATIONS_PER_HOUR,
    postingDisabled: POSTING_DISABLED,
    dryRun: DRY_RUN,
    budgetEnforcerEnabled: BUDGET_ENFORCER_ENABLED
  };
}

/**
 * LLM wrapper that enforces budget checks
 */
export async function safeLLMCall<T>(
  llmFunction: () => Promise<T>,
  costUsd: number,
  context: string = 'unknown'
): Promise<T | null> {
  const check = await checkLLMAllowed();
  
  if (!check.allowed) {
    console.log(`LLM_BLOCKED: ${context} - ${check.reason}`);
    return null;
  }
  
  try {
    const result = await llmFunction();
    await recordLLMUsage(costUsd, { context });
    return result;
  } catch (error) {
    console.error(`LLM_ERROR: ${context} -`, error);
    throw error;
  }
}
