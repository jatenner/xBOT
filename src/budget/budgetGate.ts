/**
 * 🛡️ BUDGET GATE - Hard $5/day enforcement for ALL OpenAI calls
 * Must be called before every LLM request including retries, warmups, tests
 */

import { createClient } from 'redis';

const DAILY_KEY_PREFIX = process.env.BUDGET_ENV_KEY ?? 'prod';
const DAILY_LIMIT = Number(process.env.DAILY_OPENAI_BUDGET_USD ?? 5);

let r: ReturnType<typeof createClient> | null = null;

async function redis() {
  if (!r) {
    r = createClient({ url: process.env.REDIS_URL });
    r.on('error', (e) => console.error('REDIS_ERROR', e));
    await r.connect();
  }
  return r;
}

export async function getTodayKey() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${DAILY_KEY_PREFIX}:openai_cost:${yyyy}-${mm}-${dd}`;
}

export async function budgetCheckOrThrow() {
  const client = await redis();
  const key = await getTodayKey();
  const spent = Number(await client.get(key) ?? 0);
  if (spent >= DAILY_LIMIT) {
    const msg = `BUDGET_GUARD: daily cap reached ${spent.toFixed(4)} / ${DAILY_LIMIT}`;
    console.warn(msg);
    const err: any = new Error(msg);
    err.code = 'DAILY_BUDGET_REACHED';
    throw err;
  }
}

export async function budgetAdd(deltaUsd: number) {
  const client = await redis();
  const key = await getTodayKey();
  const v = await client.incrByFloat(key, deltaUsd);
  // expire key in 48h to be safe
  await client.expire(key, 60 * 60 * 48);
  return v;
}

/**
 * Get current budget status for logging
 */
export async function getBudgetStatus() {
  try {
    const client = await redis();
    const key = await getTodayKey();
    const spent = Number(await client.get(key) ?? 0);
    return {
      key,
      spent: spent.toFixed(4),
      limit: DAILY_LIMIT.toFixed(4),
      remaining: Math.max(0, DAILY_LIMIT - spent).toFixed(4),
      hitLimit: spent >= DAILY_LIMIT
    };
  } catch (error) {
    console.error('BUDGET_STATUS_ERROR:', error);
    return {
      key: 'error',
      spent: '0.0000',
      limit: DAILY_LIMIT.toFixed(4),
      remaining: DAILY_LIMIT.toFixed(4),
      hitLimit: false
    };
  }
}
