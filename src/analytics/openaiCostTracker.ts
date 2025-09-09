/**
 * 🎯 COMPREHENSIVE OPENAI COST TRACKER
 * Real-time tracking of ALL OpenAI API usage across the entire system
 */

import { getSafeDatabase } from '../lib/db';
import { getRedisSafeClient } from '../lib/redisSafe';

export interface OpenAIUsageRecord {
  id?: string;
  timestamp: Date;
  operation_type: 'post_generation' | 'reply_generation' | 'thread_generation' | 'content_scoring' | 'optimization' | 'learning' | 'other';
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  actual_cost?: number;
  request_type: string;
  success: boolean;
  error_message?: string;
  correlation_id?: string;
  session_id?: string;
  content_preview?: string; // First 100 chars of generated content
}

export interface CostSummary {
  total_cost_today: number;
  total_cost_week: number;
  total_cost_month: number;
  cost_per_post: number;
  cost_per_reply: number;
  cost_per_thread: number;
  requests_today: number;
  requests_week: number;
  requests_month: number;
  top_cost_operations: Array<{
    operation: string;
    total_cost: number;
    request_count: number;
    avg_cost_per_request: number;
  }>;
  hourly_breakdown: Array<{
    hour: string;
    cost: number;
    requests: number;
  }>;
  model_usage: Array<{
    model: string;
    total_cost: number;
    requests: number;
    avg_tokens: number;
  }>;
}

export interface DailyCostTarget {
  target_daily_cost: number;
  current_daily_cost: number;
  remaining_budget: number;
  projected_monthly_cost: number;
  cost_per_operation_target: number;
  is_over_budget: boolean;
  recommendations: string[];
}

export class OpenAICostTracker {
  private static instance: OpenAICostTracker;
  private db = getSafeDatabase();
  private redis = getRedisSafeClient();

  // Current OpenAI pricing (as of 2024)
  private readonly TOKEN_PRICING = {
    'gpt-4': { input: 0.030, output: 0.060 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.000150, output: 0.000600 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'text-embedding-ada-002': { input: 0.0001, output: 0 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'text-embedding-3-large': { input: 0.00013, output: 0 }
  };

  // Cost targets and budgets
  private readonly BUDGET_CONFIG = {
    daily_target: parseFloat(process.env.OPENAI_DAILY_BUDGET || '10.00'),
    monthly_target: parseFloat(process.env.OPENAI_MONTHLY_BUDGET || '200.00'),
    emergency_stop: parseFloat(process.env.OPENAI_EMERGENCY_STOP || '250.00'),
    cost_per_post_target: 0.25, // $0.25 per post
    cost_per_reply_target: 0.10, // $0.10 per reply
    cost_per_thread_target: 0.75 // $0.75 per thread
  };

  static getInstance(): OpenAICostTracker {
    if (!this.instance) {
      this.instance = new OpenAICostTracker();
    }
    return this.instance;
  }

  /**
   * 🎯 MAIN TRACKING METHOD - Call this for EVERY OpenAI request
   * NULL-SAFE VERSION - Never crashes posting loop, guarantees non-empty payload
   */
  trackOpenAIUsage(resp: any, meta: { intent?: string } = {}) {
    try {
      const model = resp?.model ?? 'unknown';
      const usage = resp?.usage ?? {};
      const promptTokens = usage?.prompt_tokens ?? usage?.input_tokens ?? 0;
      const completionTokens = usage?.completion_tokens ?? usage?.output_tokens ?? 0;
      const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);

      const costTier =
        (typeof model === 'string' && model.includes?.('gpt-4o')) ? 'gpt-4o' :
        (typeof model === 'string' && model.includes?.('gpt-4'))  ? 'gpt-4'  :
        (typeof model === 'string' && model.includes?.('gpt-3.5'))? 'gpt-3.5': 'other';

      const payload = {
        created_at: new Date().toISOString(),
        model,
        cost_tier: costTier,
        intent: meta?.intent ?? 'other',
        prompt_tokens: promptTokens ?? 0,
        completion_tokens: completionTokens ?? 0,
        total_tokens: totalTokens ?? ((promptTokens ?? 0) + (completionTokens ?? 0)),
        cost_usd: this.estimateCost({ model, promptTokens, completionTokens, totalTokens, costTier }) ?? 0,
        request_id: resp?.id ?? null,
        finish_reason: resp?.choices?.[0]?.finish_reason ?? null,
        raw: JSON.parse(JSON.stringify(resp ? { response: resp, meta } : (meta || {})))
      };

      console.log(`💰 COST_TRACKER: ${payload.intent} - $${payload.cost_usd.toFixed(4)} (${model})`);

      return this.dbSafeInsert('openai_usage_log', payload);
    } catch (err) {
      console.error('COST_TRACKER_ERROR_SAFE', { message: err?.message ?? String(err ?? '') });
      return null;
    }
  }

  /**
   * 📊 GET COMPREHENSIVE COST SUMMARY
   */
  async getCostSummary(): Promise<CostSummary> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      const monthAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

      // Get usage data from Supabase - fallback to empty array for now
      // TODO: Implement proper query after database migration is complete
      console.warn('⚠️ COST_SUMMARY: Database table not available yet, using mock data');
      
      const records: any[] = []; // Will be populated after migration

      // Calculate totals
      const todayRecords = records.filter(r => new Date(r.timestamp) >= today);
      const weekRecords = records.filter(r => new Date(r.timestamp) >= weekAgo);
      const monthRecords = records;

      const total_cost_today = todayRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);
      const total_cost_week = weekRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);
      const total_cost_month = monthRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);

      // Calculate per-operation costs
      const postRecords = monthRecords.filter(r => r.operation_type === 'post_generation');
      const replyRecords = monthRecords.filter(r => r.operation_type === 'reply_generation');
      const threadRecords = monthRecords.filter(r => r.operation_type === 'thread_generation');

      const cost_per_post = postRecords.length > 0 
        ? postRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0) / postRecords.length 
        : 0;
      
      const cost_per_reply = replyRecords.length > 0 
        ? replyRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0) / replyRecords.length 
        : 0;
      
      const cost_per_thread = threadRecords.length > 0 
        ? threadRecords.reduce((sum, r) => sum + (r.estimated_cost || 0), 0) / threadRecords.length 
        : 0;

      // Top cost operations
      const operationCosts = this.groupByOperation(monthRecords);
      const top_cost_operations = Object.entries(operationCosts)
        .map(([operation, data]: [string, any]) => ({
          operation,
          total_cost: data.totalCost,
          request_count: data.count,
          avg_cost_per_request: data.totalCost / data.count
        }))
        .sort((a, b) => b.total_cost - a.total_cost)
        .slice(0, 10);

      // Hourly breakdown (last 24 hours)
      const hourly_breakdown = this.getHourlyBreakdown(todayRecords);

      // Model usage breakdown
      const model_usage = this.getModelUsageBreakdown(monthRecords);

      return {
        total_cost_today,
        total_cost_week,
        total_cost_month,
        cost_per_post,
        cost_per_reply,
        cost_per_thread,
        requests_today: todayRecords.length,
        requests_week: weekRecords.length,
        requests_month: monthRecords.length,
        top_cost_operations,
        hourly_breakdown,
        model_usage
      };
    } catch (error) {
      console.error('❌ COST_SUMMARY_ERROR:', error);
      throw error;
    }
  }

  /**
   * 🎯 GET DAILY COST TARGET STATUS
   */
  async getDailyCostTarget(): Promise<DailyCostTarget> {
    const summary = await this.getCostSummary();
    const projected_monthly_cost = (summary.total_cost_today * 30);
    
    const recommendations: string[] = [];
    
    if (summary.cost_per_post > this.BUDGET_CONFIG.cost_per_post_target) {
      recommendations.push(`Post generation cost too high: $${summary.cost_per_post.toFixed(3)} vs target $${this.BUDGET_CONFIG.cost_per_post_target}`);
    }
    
    if (summary.cost_per_reply > this.BUDGET_CONFIG.cost_per_reply_target) {
      recommendations.push(`Reply generation cost too high: $${summary.cost_per_reply.toFixed(3)} vs target $${this.BUDGET_CONFIG.cost_per_reply_target}`);
    }
    
    if (projected_monthly_cost > this.BUDGET_CONFIG.monthly_target) {
      recommendations.push(`On track to exceed monthly budget: $${projected_monthly_cost.toFixed(2)} vs $${this.BUDGET_CONFIG.monthly_target}`);
    }

    if (summary.total_cost_today > this.BUDGET_CONFIG.daily_target * 0.8) {
      recommendations.push(`Approaching daily budget limit: $${summary.total_cost_today.toFixed(2)} vs $${this.BUDGET_CONFIG.daily_target}`);
    }

    return {
      target_daily_cost: this.BUDGET_CONFIG.daily_target,
      current_daily_cost: summary.total_cost_today,
      remaining_budget: Math.max(0, this.BUDGET_CONFIG.daily_target - summary.total_cost_today),
      projected_monthly_cost,
      cost_per_operation_target: this.BUDGET_CONFIG.cost_per_post_target,
      is_over_budget: summary.total_cost_today > this.BUDGET_CONFIG.daily_target,
      recommendations
    };
  }

  /**
   * 💰 CALCULATE EXACT COST FOR TOKENS
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.TOKEN_PRICING[model as keyof typeof this.TOKEN_PRICING];
    if (!pricing) {
      console.warn(`⚠️ UNKNOWN_MODEL_PRICING: ${model}`);
      return 0;
    }

    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * 🎯 NULL-SAFE COST ESTIMATION
   */
  private estimateCost(data: { model: string; promptTokens: number; completionTokens: number; totalTokens: number; costTier: string }): number {
    try {
      const pricing = this.TOKEN_PRICING[data.costTier as keyof typeof this.TOKEN_PRICING] || this.TOKEN_PRICING['gpt-3.5-turbo'];
      const inputCost = (data.promptTokens / 1000) * pricing.input;
      const outputCost = (data.completionTokens / 1000) * pricing.output;
      return inputCost + outputCost;
    } catch {
      return 0.01; // Default safe cost
    }
  }

  /**
   * 🛡️ SAFE DATABASE INSERT - RPC with fallback insert and safe error handling
   */
  async dbSafeInsert(table: string, payload: Record<string, any>): Promise<string | null> {
    try {
      if (!payload || Object.keys(payload).length === 0) {
        console.warn('COST_TRACKER: Empty payload, skipping', { table });
        return null;
      }

      console.log('💰 COST_TRACKER: Logging to openai_usage_log via safe function...');
      console.log('📋 COST_TRACKER: Payload keys:', Object.keys(payload).length);

      // Try RPC (positional order the app currently uses)
      try {
        const rpc = await this.db.getClient().rpc('log_openai_usage', {
          p_completion_tokens: payload.completion_tokens,
          p_cost_tier: payload.cost_tier,
          p_cost_usd: payload.cost_usd,
          p_finish_reason: payload.finish_reason,
          p_intent: payload.intent,
          p_model: payload.model,
          p_prompt_tokens: payload.prompt_tokens,
          p_raw: payload.raw,
          p_request_id: payload.request_id,
          p_total_tokens: payload.total_tokens
        });

        if (rpc.error) throw rpc.error;
        console.log('RPC_OK id=', rpc.data);
        return 'success';
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg.includes('Could not find the function') || msg.includes('schema cache')) {
          console.log('💰 COST_TRACKER: RPC not found, falling back to direct insert...');
          // Use array form: .insert([payload]).select('id').single()
          const ins = await this.db.getClient().from('openai_usage_log')
            .insert([payload]).select('id').single();
          if (ins.error) {
            // Log real error: ins.error?.message (not [object Object])
            console.log('DB_SAFE: Insert fallback failed', { 
              message: ins.error.message, 
              details: ins.error.details 
            });
            throw ins.error;
          }
          // Always show DB_SAFE: Inserted openai_usage_log id=… on success
          console.log('DB_SAFE: Inserted openai_usage_log id=', ins.data?.id);
          return 'success';
        } else {
          console.log('DB_SAFE: RPC failed (non-cache)', msg);
          throw e;
        }
      }
    } catch (e: any) {
      console.error('COST_TRACKER: Exception during insert', { table, message: e?.message || String(e) });
      return null;
    }
  }

  /**
   * 📈 UPDATE REDIS COUNTERS FOR FAST ACCESS
   */
  private async updateRedisCounters(record: OpenAIUsageRecord): Promise<void> {
    try {
      const redis = await this.redis;
      if (!redis) return;

      const today = new Date().toISOString().split('T')[0];
      const hour = new Date().getHours();

      // Daily counters
      await redis.incrByFloat(`openai:cost:daily:${today}`, record.estimated_cost);
      await redis.incr(`openai:requests:daily:${today}`);
      
      // Hourly counters
      await redis.incrByFloat(`openai:cost:hourly:${today}:${hour}`, record.estimated_cost);
      await redis.incr(`openai:requests:hourly:${today}:${hour}`);
      
      // Operation type counters
      await redis.incrByFloat(`openai:cost:operation:${record.operation_type}:${today}`, record.estimated_cost);
      await redis.incr(`openai:requests:operation:${record.operation_type}:${today}`);

      // Model counters
      await redis.incrByFloat(`openai:cost:model:${record.model}:${today}`, record.estimated_cost);
      await redis.incr(`openai:requests:model:${record.model}:${today}`);

      // Set expiration using TTL (simplified - Redis safe client may not support expire)
      // Note: TTL expiration handled by Redis safe client automatically

    } catch (error) {
      console.warn('⚠️ REDIS_UPDATE_WARNING:', error);
    }
  }

  /**
   * 🚨 CHECK BUDGET LIMITS AND ALERT
   */
  private async checkBudgetLimits(): Promise<void> {
    try {
      const target = await this.getDailyCostTarget();
      
      if (target.current_daily_cost > this.BUDGET_CONFIG.emergency_stop) {
        console.error(`🚨 EMERGENCY_STOP: Daily cost $${target.current_daily_cost.toFixed(2)} exceeds emergency limit $${this.BUDGET_CONFIG.emergency_stop}`);
        
        // Store emergency flag in Redis
        const redis = await this.redis;
        if (redis) {
          await redis.set('openai:emergency_stop', '1'); // 24 hour emergency stop (TTL handled by client)
        }
      } else if (target.is_over_budget) {
        console.warn(`⚠️ BUDGET_EXCEEDED: Daily cost $${target.current_daily_cost.toFixed(2)} exceeds target $${target.target_daily_cost}`);
      } else if (target.remaining_budget < 2.00) {
        console.warn(`⚠️ LOW_BUDGET: Only $${target.remaining_budget.toFixed(2)} remaining today`);
      }

    } catch (error) {
      console.error('❌ BUDGET_CHECK_ERROR:', error);
    }
  }

  /**
   * 📊 GROUP RECORDS BY OPERATION TYPE
   */
  private groupByOperation(records: OpenAIUsageRecord[]): Record<string, {totalCost: number, count: number}> {
    return records.reduce((acc, record) => {
      const op = record.operation_type;
      if (!acc[op]) {
        acc[op] = { totalCost: 0, count: 0 };
      }
      acc[op].totalCost += record.estimated_cost || 0;
      acc[op].count += 1;
      return acc;
    }, {} as Record<string, {totalCost: number, count: number}>);
  }

  /**
   * ⏰ GET HOURLY BREAKDOWN FOR LAST 24 HOURS
   */
  private getHourlyBreakdown(records: OpenAIUsageRecord[]): Array<{hour: string, cost: number, requests: number}> {
    const hourlyData: Record<string, {cost: number, requests: number}> = {};
    
    // Initialize all 24 hours
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      hourlyData[hour] = { cost: 0, requests: 0 };
    }
    
    // Aggregate data by hour
    records.forEach(record => {
      const hour = new Date(record.timestamp).getHours().toString().padStart(2, '0');
      hourlyData[hour].cost += record.estimated_cost || 0;
      hourlyData[hour].requests += 1;
    });
    
    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: `${hour}:00`,
      cost: data.cost,
      requests: data.requests
    }));
  }

  /**
   * 🤖 GET MODEL USAGE BREAKDOWN
   */
  private getModelUsageBreakdown(records: OpenAIUsageRecord[]): Array<{model: string, total_cost: number, requests: number, avg_tokens: number}> {
    const modelData: Record<string, {totalCost: number, requests: number, totalTokens: number}> = {};
    
    records.forEach(record => {
      const model = record.model;
      if (!modelData[model]) {
        modelData[model] = { totalCost: 0, requests: 0, totalTokens: 0 };
      }
      modelData[model].totalCost += record.estimated_cost || 0;
      modelData[model].requests += 1;
      modelData[model].totalTokens += record.total_tokens || 0;
    });
    
    return Object.entries(modelData)
      .map(([model, data]) => ({
        model,
        total_cost: data.totalCost,
        requests: data.requests,
        avg_tokens: data.requests > 0 ? Math.round(data.totalTokens / data.requests) : 0
      }))
      .sort((a, b) => b.total_cost - a.total_cost);
  }

  /**
   * 🎯 GET REAL-TIME EMERGENCY STOP STATUS
   */
  async isEmergencyStop(): Promise<boolean> {
    try {
      const redis = await this.redis;
      if (!redis) return false;
      
      const emergencyFlag = await redis.get('openai:emergency_stop');
      return emergencyFlag === '1';
    } catch (error) {
      console.warn('⚠️ EMERGENCY_CHECK_WARNING:', error);
      return false;
    }
  }

  /**
   * 📋 GENERATE COST REPORT
   */
  async generateCostReport(): Promise<string> {
    try {
      const summary = await this.getCostSummary();
      const target = await this.getDailyCostTarget();
      
      const report = `
🎯 OPENAI COST ANALYSIS REPORT
==============================

💰 COST SUMMARY:
- Today: $${summary.total_cost_today.toFixed(4)} / $${target.target_daily_cost} (${((summary.total_cost_today / target.target_daily_cost) * 100).toFixed(1)}%)
- This Week: $${summary.total_cost_week.toFixed(2)}
- This Month: $${summary.total_cost_month.toFixed(2)}

📊 COST PER OPERATION:
- Post Generation: $${summary.cost_per_post.toFixed(4)} (target: $${this.BUDGET_CONFIG.cost_per_post_target})
- Reply Generation: $${summary.cost_per_reply.toFixed(4)} (target: $${this.BUDGET_CONFIG.cost_per_reply_target})  
- Thread Generation: $${summary.cost_per_thread.toFixed(4)} (target: $${this.BUDGET_CONFIG.cost_per_thread_target})

🤖 TOP COST OPERATIONS:
${summary.top_cost_operations.slice(0, 5).map(op => 
  `- ${op.operation}: $${op.total_cost.toFixed(4)} (${op.request_count} requests, $${op.avg_cost_per_request.toFixed(4)} avg)`
).join('\n')}

🔧 MODEL USAGE:
${summary.model_usage.slice(0, 3).map(model => 
  `- ${model.model}: $${model.total_cost.toFixed(4)} (${model.requests} requests, ${model.avg_tokens} avg tokens)`
).join('\n')}

📈 BUDGET STATUS:
- Remaining Today: $${target.remaining_budget.toFixed(4)}
- Projected Monthly: $${target.projected_monthly_cost.toFixed(2)}
- Over Budget: ${target.is_over_budget ? 'YES ⚠️' : 'NO ✅'}

${target.recommendations.length > 0 ? `
🎯 RECOMMENDATIONS:
${target.recommendations.map(rec => `- ${rec}`).join('\n')}
` : '✅ All cost targets are within limits!'}

📊 REQUEST VOLUME:
- Today: ${summary.requests_today} requests
- This Week: ${summary.requests_week} requests  
- This Month: ${summary.requests_month} requests
      `.trim();

      return report;
    } catch (error) {
      console.error('❌ REPORT_GENERATION_ERROR:', error);
      return 'Failed to generate cost report';
    }
  }
}

// Export singleton instance
export const openaiCostTracker = OpenAICostTracker.getInstance();
