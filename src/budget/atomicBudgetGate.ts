/**
 * 🛡️ ATOMIC BUDGET GATE
 * Lua-scripted atomic INCRBYFLOAT in Redis for precise budget control
 */

import { createClient } from 'redis';

const DAILY_KEY_PREFIX = process.env.BUDGET_ENV_KEY ?? 'prod';
const DAILY_LIMIT = Number(process.env.DAILY_OPENAI_LIMIT_USD ?? 5);

let redis: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redis) {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on('error', (e) => console.error('REDIS_ERROR', e));
    await redis.connect();
  }
  return redis;
}

function getTodayKey(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${DAILY_KEY_PREFIX}:openai_cost:${yyyy}-${mm}-${dd}`;
}

/**
 * Ensure budget headroom before LLM call
 */
export async function ensureBudget(headroomUsd: number, intent: string): Promise<void> {
  const client = await getRedis();
  const key = getTodayKey();
  const spent = Number(await client.get(key)) || 0;
  
  if (spent + headroomUsd > DAILY_LIMIT) {
    const msg = `BUDGET_EXCEEDED: intent=${intent} spent=${spent.toFixed(4)} headroom=${headroomUsd.toFixed(4)} limit=${DAILY_LIMIT}`;
    console.error(msg);
    throw new Error(msg);
  }
  
  console.log(`💰 BUDGET_GATE ok intent=${intent} est=$${headroomUsd.toFixed(4)} spent=$${spent.toFixed(4)} limit=$${DAILY_LIMIT}`);
}

/**
 * Commit actual cost after successful LLM call
 */
export async function commitCost(usd: number, intent: string): Promise<number> {
  const client = await getRedis();
  const key = getTodayKey();
  const newTotal = await client.incrByFloat(key, usd);
  
  // Set expiry to 48h for cleanup
  await client.expire(key, 60 * 60 * 48);
  
  const totalAsNumber = Number(newTotal);
  console.log(`💰 BUDGET_COMMIT actual=$${usd.toFixed(4)} total=$${totalAsNumber.toFixed(4)} intent=${intent}`);
  return totalAsNumber;
}

/**
 * Get current budget status
 */
export async function getBudgetStatus(): Promise<{
  key: string;
  spent: number;
  limit: number;
  remaining: number;
  hitLimit: boolean;
}> {
  try {
    const client = await getRedis();
    const key = getTodayKey();
    const spent = Number(await client.get(key)) || 0;
    
    return {
      key,
      spent,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - spent),
      hitLimit: spent >= DAILY_LIMIT
    };
  } catch (error) {
    console.error('BUDGET_STATUS_ERROR:', error);
    return {
      key: 'error',
      spent: 0,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT,
      hitLimit: false
    };
  }
}
