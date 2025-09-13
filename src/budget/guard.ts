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
 * @deprecated Use hardGuard.checkBudgetAllowed() for production
 */
export async function checkLLMAllowed(): Promise<{ allowed: boolean; reason?: string; cost?: number }> {
  // Delegate to hard guard for production enforcement
  const { checkBudgetAllowed } = await import('./hardGuard');
  const result = await checkBudgetAllowed();
  
  return {
    allowed: result.allowed,
    reason: result.reason,
    cost: result.status?.spent
  };
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
