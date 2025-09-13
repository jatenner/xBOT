/**
 * Budget Hard-Guard System
 * Enforces daily OpenAI spending limits with Redis tracking
 */

import Redis from 'ioredis';

// Environment configuration
const DAILY_OPENAI_LIMIT_USD = parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.00');
const POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
const REDIS_URL = process.env.REDIS_URL;

// Redis client (lazy initialization)
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redis && REDIS_URL) {
    try {
      redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true
      });
      
      redis.on('error', (error) => {
        console.error('BUDGET_REDIS_ERROR:', error.message);
      });
      
    } catch (error) {
      console.error('BUDGET_REDIS_INIT_ERROR:', error);
      return null;
    }
  }
  return redis;
}

/**
 * Get current date key for budget tracking
 */
function getDateKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Budget hard-stop error
 */
export class BudgetHardStopError extends Error {
  constructor(spent: number, limit: number) {
    super(`Budget hard-stop: $${spent.toFixed(2)}/$${limit.toFixed(2)} daily limit reached`);
    this.name = 'BudgetHardStopError';
  }
}

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<{
  spent: number;
  limit: number;
  remaining: number;
  lastUpdate: string | null;
  hardStopActive: boolean;
}> {
  const dateKey = getDateKey();
  const redisClient = getRedisClient();
  
  let spent = 0;
  let lastUpdate: string | null = null;
  
  if (redisClient) {
    try {
      const costKey = `prod:openai_cost:${dateKey}`;
      const spentStr = await redisClient.get(costKey);
      spent = parseFloat(spentStr || '0');
      
      // Get last update time
      const updateKey = `prod:openai_cost:${dateKey}:updated`;
      lastUpdate = await redisClient.get(updateKey);
      
    } catch (error) {
      console.error('BUDGET_STATUS_ERROR:', error);
    }
  }
  
  const remaining = Math.max(0, DAILY_OPENAI_LIMIT_USD - spent);
  const hardStopActive = spent >= DAILY_OPENAI_LIMIT_USD;
  
  return {
    spent,
    limit: DAILY_OPENAI_LIMIT_USD,
    remaining,
    lastUpdate,
    hardStopActive
  };
}

/**
 * Check if LLM call is allowed (hard-stop enforcement)
 */
export async function checkBudgetAllowed(): Promise<{ allowed: boolean; reason?: string; status?: any }> {
  // POSTING_DISABLED takes absolute precedence
  if (POSTING_DISABLED) {
    return { 
      allowed: false, 
      reason: 'POSTING_DISABLED=true' 
    };
  }
  
  const status = await getBudgetStatus();
  
  if (status.hardStopActive) {
    // Log hard-stop once per day
    const dateKey = getDateKey();
    const loggedKey = `budget_hard_stop_logged:${dateKey}`;
    const redisClient = getRedisClient();
    
    let alreadyLogged = false;
    if (redisClient) {
      try {
        const logged = await redisClient.get(loggedKey);
        alreadyLogged = !!logged;
        
        if (!alreadyLogged) {
          await redisClient.setex(loggedKey, 86400, '1'); // 24 hours
        }
      } catch (error) {
        console.error('BUDGET_LOG_ERROR:', error);
      }
    }
    
    if (!alreadyLogged) {
      console.log(`🛡️ BUDGET_HARD_STOP: limit reached, halting LLM calls ($${status.spent.toFixed(2)}/$${status.limit.toFixed(2)})`);
    }
    
    return { 
      allowed: false, 
      reason: `Daily budget limit reached: $${status.spent.toFixed(2)}/$${status.limit.toFixed(2)}`,
      status
    };
  }
  
  return { 
    allowed: true, 
    status 
  };
}

/**
 * Record LLM usage and enforce hard-stop
 */
export async function recordBudgetUsage(costUsd: number, context: string = 'unknown'): Promise<void> {
  if (costUsd <= 0) return;
  
  const dateKey = getDateKey();
  const redisClient = getRedisClient();
  
  if (!redisClient) {
    console.warn('BUDGET_RECORD: Redis unavailable, cannot track usage');
    return;
  }
  
  try {
    const costKey = `prod:openai_cost:${dateKey}`;
    const updateKey = `prod:openai_cost:${dateKey}:updated`;
    
    // Atomic increment
    const newTotal = await redisClient.incrbyfloat(costKey, costUsd);
    
    // Set expiration (7 days) and update timestamp
    await Promise.all([
      redisClient.expire(costKey, 86400 * 7),
      redisClient.setex(updateKey, 86400 * 7, new Date().toISOString())
    ]);
    
    console.log(`💰 BUDGET_RECORDED: +$${costUsd.toFixed(4)} (total: $${newTotal.toFixed(4)}/$${DAILY_OPENAI_LIMIT_USD.toFixed(2)}) [${context}]`);
    
    // Check if we just hit the limit
    if (newTotal >= DAILY_OPENAI_LIMIT_USD && (newTotal - costUsd) < DAILY_OPENAI_LIMIT_USD) {
      console.log(`🛡️ BUDGET_HARD_STOP: Daily limit reached! ($${newTotal.toFixed(2)}/$${DAILY_OPENAI_LIMIT_USD.toFixed(2)})`);
    }
    
  } catch (error) {
    console.error('BUDGET_RECORD_ERROR:', error);
  }
}

/**
 * Enforce budget before LLM call
 */
export async function enforceBudgetHardStop(): Promise<void> {
  const check = await checkBudgetAllowed();
  
  if (!check.allowed) {
    if (check.reason?.includes('budget limit')) {
      throw new BudgetHardStopError(check.status?.spent || 0, DAILY_OPENAI_LIMIT_USD);
    }
    throw new Error(`LLM call blocked: ${check.reason}`);
  }
}

/**
 * Safe LLM wrapper with hard-stop enforcement
 */
export async function withBudgetEnforcement<T>(
  llmCall: () => Promise<T>,
  estimatedCost: number,
  context: string = 'unknown'
): Promise<T> {
  // Pre-flight budget check
  await enforceBudgetHardStop();
  
  try {
    const result = await llmCall();
    
    // Record actual usage
    await recordBudgetUsage(estimatedCost, context);
    
    return result;
    
  } catch (error) {
    // Don't record cost if the call failed
    console.error(`BUDGET_LLM_ERROR: ${context} -`, error);
    throw error;
  }
}

/**
 * Get budget status for API endpoint
 */
export async function getBudgetStatusForAPI(): Promise<{
  limit: number;
  spent: number;
  remaining: number;
  lastUpdate: string | null;
  hardStopActive: boolean;
  postingDisabled: boolean;
}> {
  const status = await getBudgetStatus();
  
  return {
    ...status,
    postingDisabled: POSTING_DISABLED
  };
}
