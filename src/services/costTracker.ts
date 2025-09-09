/**
 * 🛡️ OPENAI COST TRACKER & BUDGET ENFORCER
 * Hard daily cap with Redis breaker + Supabase logging
 */

import { DateTime } from 'luxon';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Environment configuration
const COST_TRACKER_ENABLED = (process.env.COST_TRACKER_ENABLED ?? 'true') === 'true';
const DAILY_COST_LIMIT_USD = parseFloat(process.env.DAILY_COST_LIMIT_USD ?? '5.00');
const COST_TRACKER_STRICT = (process.env.COST_TRACKER_STRICT ?? 'true') === 'true';
const COST_TRACKER_ROLLOVER_TZ = process.env.COST_TRACKER_ROLLOVER_TZ ?? 'UTC';
const REDIS_COST_KEY_PREFIX = process.env.REDIS_COST_KEY_PREFIX ?? 'openai_cost';
const REDIS_BUDGET_TTL_SECONDS = parseInt(process.env.REDIS_BUDGET_TTL_SECONDS ?? '172800', 10);
const REDIS_BREAKER_ENABLED = (process.env.REDIS_BREAKER_ENABLED ?? 'true') === 'true';
const COST_LOGGING_STORAGE = process.env.COST_LOGGING_STORAGE ?? 'supabase';
const COST_LOGGING_TABLE = process.env.COST_LOGGING_TABLE ?? 'openai_usage_log';

// Model pricing (per 1K tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
};

export class DailyBudgetExceededError extends Error {
  constructor(spent: number, limit: number, date: string) {
    super(`Daily budget exceeded: $${spent.toFixed(2)} / $${limit.toFixed(2)} on ${date}`);
    this.name = 'DailyBudgetExceededError';
  }
}

export interface UsageRecord {
  model: string;
  cost_tier?: string;
  intent?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  request_id?: string;
  finish_reason?: string;
  raw: Record<string, any>;
}

export interface BudgetStatus {
  date_utc: string;
  limit: number;
  today_spend: number;
  remaining: number;
  blocked: boolean;
  source: 'redis' | 'supabase' | 'fallback';
}

export class CostTracker {
  private static instance: CostTracker;
  private supabase: SupabaseClient | null = null;
  private redis: Redis | null = null;
  private supabaseCacheExpiry = 0;
  private supabaseCachedTotal = 0;

  private constructor() {
    this.initializeClients();
  }

  static getInstance(): CostTracker {
    if (!CostTracker.instance) {
      CostTracker.instance = new CostTracker();
    }
    return CostTracker.instance;
  }

  private async initializeClients(): Promise<void> {
    try {
      // Initialize Supabase
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        this.supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
      }

      // Initialize Redis
      if (process.env.REDIS_URL && REDIS_BREAKER_ENABLED) {
        this.redis = new Redis(process.env.REDIS_URL!, {
          maxRetriesPerRequest: 2,
          lazyConnect: true
        });

        this.redis.on('error', (error) => {
          console.warn('⚠️ COST_TRACKER: Redis connection issue:', error.message);
        });
      }
    } catch (error) {
      console.error('❌ COST_TRACKER: Initialization failed:', error);
    }
  }

  /**
   * 💰 ESTIMATE COST from OpenAI response or injected values
   */
  estimateCost(params: {
    model: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    cost_usd?: number;
  }): number {
    if (params.cost_usd !== undefined) {
      return params.cost_usd;
    }

    const { model, prompt_tokens = 0, completion_tokens = 0 } = params;
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-3.5-turbo'];
    
    const inputCost = (prompt_tokens / 1000) * pricing.input;
    const outputCost = (completion_tokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * 📊 RECORD USAGE to Supabase (RPC first, fallback to direct insert)
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    if (!COST_TRACKER_ENABLED || COST_LOGGING_STORAGE !== 'supabase' || !this.supabase) {
      return;
    }

    try {
      // Try RPC first
      const { error: rpcError } = await this.supabase.rpc('log_openai_usage', {
        p_completion_tokens: record.completion_tokens,
        p_cost_tier: record.cost_tier,
        p_cost_usd: record.cost_usd,
        p_finish_reason: record.finish_reason,
        p_intent: record.intent,
        p_model: record.model,
        p_prompt_tokens: record.prompt_tokens,
        p_raw: record.raw,
        p_request_id: record.request_id,
        p_total_tokens: record.total_tokens
      });

      if (rpcError) {
        throw rpcError;
      }

      console.log(`💰 COST_LOG: RPC success $${record.cost_usd.toFixed(4)} (${record.model})`);

    } catch (rpcError: any) {
      // Fallback to direct insert
      console.log('💰 COST_LOG: RPC failed, trying direct insert');
      
      try {
        const { error: insertError } = await this.supabase
          .from(COST_LOGGING_TABLE)
          .insert([{
            model: record.model,
            cost_tier: record.cost_tier,
            intent: record.intent,
            prompt_tokens: record.prompt_tokens,
            completion_tokens: record.completion_tokens,
            total_tokens: record.total_tokens,
            cost_usd: record.cost_usd,
            request_id: record.request_id,
            finish_reason: record.finish_reason,
            raw: record.raw
          }]);

        if (insertError) {
          throw insertError;
        }

        console.log(`💰 COST_LOG: Direct insert success $${record.cost_usd.toFixed(4)} (${record.model})`);

      } catch (insertError: any) {
        // Log and continue - don't break posting pipeline
        console.error('💰 COST_LOG: Both RPC and insert failed:', insertError.message);
      }
    }
  }

  /**
   * 🔗 REDIS INCREMENT TODAY'S SPENDING
   */
  async redisIncrementToday(amount: number): Promise<number> {
    if (!this.redis || !REDIS_BREAKER_ENABLED) {
      return 0;
    }

    const today = this.getTodayKey();
    const key = `${REDIS_COST_KEY_PREFIX}:${today}`;

    try {
      // Atomic increment and set TTL if new key
      const pipeline = this.redis.pipeline();
      pipeline.incrbyfloat(key, amount);
      pipeline.expire(key, REDIS_BUDGET_TTL_SECONDS);
      
      const results = await pipeline.exec();
      const newTotal = parseFloat(results?.[0]?.[1] as string || '0');
      
      console.log(`💰 REDIS_BUDGET: $${newTotal.toFixed(4)} / $${DAILY_COST_LIMIT_USD} (${today})`);
      return newTotal;

    } catch (error: any) {
      console.warn('⚠️ REDIS_BUDGET: Increment failed:', error.message);
      return 0;
    }
  }

  /**
   * 🚫 CHECK BUDGET OR THROW
   */
  async checkBudgetOrThrow(): Promise<void> {
    if (!COST_TRACKER_ENABLED || !COST_TRACKER_STRICT) {
      return;
    }

    const status = await this.getBudgetStatus();
    
    if (status.blocked || status.today_spend >= status.limit) {
      const today = this.getTodayKey();
      
      // Set Redis block flag
      if (this.redis) {
        await this.redis.setex(`openai_blocked:${today}`, REDIS_BUDGET_TTL_SECONDS, 'true');
      }

      console.error(`🚫 DAILY_LIMIT_REACHED: $${status.today_spend.toFixed(2)} used / $${status.limit.toFixed(2)} limit – blocking OpenAI calls until rollover (TZ=${COST_TRACKER_ROLLOVER_TZ})`);
      
      throw new DailyBudgetExceededError(status.today_spend, status.limit, today);
    }
  }

  /**
   * 📈 GET BUDGET STATUS
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    const today = this.getTodayKey();
    let todaySpend = 0;
    let source: 'redis' | 'supabase' | 'fallback' = 'fallback';
    let blocked = false;

    // Check Redis block flag first
    if (this.redis) {
      try {
        const blockFlag = await this.redis.get(`openai_blocked:${today}`);
        blocked = blockFlag === 'true';

        // Get Redis total
        const redisTotal = await this.redis.get(`${REDIS_COST_KEY_PREFIX}:${today}`);
        if (redisTotal !== null) {
          todaySpend = parseFloat(redisTotal);
          source = 'redis';
        }
      } catch (error) {
        console.warn('⚠️ BUDGET_STATUS: Redis check failed');
      }
    }

    // Fallback to Supabase (cached)
    if (source === 'fallback' && this.supabase) {
      const now = Date.now();
      if (now > this.supabaseCacheExpiry) {
        try {
          const startOfDay = DateTime.now()
            .setZone(COST_TRACKER_ROLLOVER_TZ)
            .startOf('day')
            .toUTC()
            .toISO();

          const { data, error } = await this.supabase
            .from(COST_LOGGING_TABLE)
            .select('cost_usd')
            .gte('created_at', startOfDay);

          if (!error && data) {
            this.supabaseCachedTotal = data.reduce((sum, row) => sum + parseFloat(row.cost_usd || '0'), 0);
            this.supabaseCacheExpiry = now + (5 * 60 * 1000); // 5 minute cache
            source = 'supabase';
          }
        } catch (error) {
          console.warn('⚠️ BUDGET_STATUS: Supabase query failed');
        }
      }
      
      if (source === 'supabase') {
        todaySpend = this.supabaseCachedTotal;
      }
    }

    return {
      date_utc: today,
      limit: DAILY_COST_LIMIT_USD,
      today_spend: todaySpend,
      remaining: Math.max(0, DAILY_COST_LIMIT_USD - todaySpend),
      blocked,
      source
    };
  }

  /**
   * 🔄 WRAP OPENAI CALL with budget enforcement
   */
  async wrapOpenAI<T>(
    intent: string,
    fn: () => Promise<T>,
    options: {
      estimatedCost?: number;
      model?: string;
    } = {}
  ): Promise<T | { skipped: true; reason: string }> {
    if (!COST_TRACKER_ENABLED) {
      return await fn();
    }

    try {
      // Pre-check budget
      await this.checkBudgetOrThrow();

      // Execute OpenAI call
      const result = await fn();

      // Extract usage and record cost
      if (result && typeof result === 'object' && 'usage' in result) {
        const usage = (result as any).usage;
        const model = options.model || 'gpt-3.5-turbo';
        
        const cost = this.estimateCost({
          model,
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          cost_usd: options.estimatedCost
        });

        // Record usage
        await this.recordUsage({
          model,
          intent,
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          total_tokens: usage?.total_tokens || 0,
          cost_usd: cost,
          raw: { usage, intent }
        });

        // Update Redis counter
        const newTotal = await this.redisIncrementToday(cost);

        // Post-call budget check
        if (COST_TRACKER_STRICT && newTotal >= DAILY_COST_LIMIT_USD) {
          const today = this.getTodayKey();
          if (this.redis) {
            await this.redis.setex(`openai_blocked:${today}`, REDIS_BUDGET_TTL_SECONDS, 'true');
          }
          console.warn(`🚫 DAILY_LIMIT_REACHED: $${newTotal.toFixed(2)} used / $${DAILY_COST_LIMIT_USD} limit – blocking further calls`);
        }
      }

      return result;

    } catch (error) {
      if (error instanceof DailyBudgetExceededError) {
        console.log(`⏭️ SKIP_OPENAI: Daily limit reached – ${intent} not executed`);
        return { skipped: true, reason: error.message };
      }
      throw error;
    }
  }

  /**
   * 📅 GET TODAY'S KEY for Redis/logging
   */
  private getTodayKey(): string {
    return DateTime.now()
      .setZone(COST_TRACKER_ROLLOVER_TZ)
      .toFormat('yyyy-MM-dd');
  }
}

// Export singleton
export const costTracker = CostTracker.getInstance();
export default costTracker;