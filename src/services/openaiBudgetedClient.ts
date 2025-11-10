/**
 * Canonical OpenAI Budgeted Client
 * ALL OpenAI calls must go through this wrapper for budget enforcement
 */

import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { calculateTokenCost, estimateTokenCount, getModelRecommendations } from '../config/openai/pricing';
import { getModelPricing } from '../config/openai/pricingSource';
import { withExponentialBackoff, isQuotaExhausted } from './openaiRetry';

// Typed errors
export class BudgetExceededError extends Error {
  constructor(
    public readonly allowed: number,
    public readonly used: number, 
    public readonly attempted: number,
    message?: string
  ) {
    super(message || `Budget exceeded: attempted $${attempted.toFixed(4)}, used $${used.toFixed(4)}/$${allowed.toFixed(2)}`);
    this.name = 'BudgetExceededError';
  }
}

export class ModelNotSupportedError extends Error {
  constructor(model: string) {
    super(`Model not supported: ${model}`);
    this.name = 'ModelNotSupportedError';
  }
}

// Types
export interface BudgetConfig {
  dailyLimitUSD: number;
  rolloverTimezone: string;
  redisKeyPrefix: string;
  strictMode: boolean;
  alertThreshold: number; // 0.8 = 80%
}

export interface CallMetadata {
  purpose: string;
  requestId?: string;
  userId?: string;
  priority?: 'low' | 'medium' | 'high';
  maxRetries?: number;
}

export interface BudgetStatus {
  dailyLimitUSD: number;
  usedTodayUSD: number;
  remainingUSD: number;
  percentUsed: number;
  isBlocked: boolean;
  lastResetDate: string;
  totalCallsToday: number;
}

export interface SpendingBreakdown {
  byModel: Record<string, { calls: number; totalCost: number }>;
  byPurpose: Record<string, { calls: number; totalCost: number }>;
  topExpensive: Array<{ purpose: string; model: string; cost: number; timestamp: string }>;
}

/**
 * Canonical OpenAI Budget Client
 * Single entry point for all OpenAI API calls with budget enforcement
 */
export class OpenAIBudgetedClient {
  private static instance: OpenAIBudgetedClient;
  private openai: OpenAI;
  private redis: Redis | null;
  private redisEnabled: boolean;
  private config: BudgetConfig;
  private memoryBudget = {
    lastResetDate: '',
    usedTodayUSD: 0,
    totalCallsToday: 0,
    blocked: false,
    byModel: new Map<string, { calls: number; totalCost: number }>(),
    byPurpose: new Map<string, { calls: number; totalCost: number }>(),
    topExpensive: [] as Array<{ purpose: string; model: string; cost: number; timestamp: string }>
  };
  
  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
      this.redisEnabled = true;
    } else {
      this.redis = null;
      this.redisEnabled = false;
      this.memoryBudget.lastResetDate = this.getTodayDateString();
      console.warn('⚠️ REDIS_URL not set. OpenAI budget tracking will fall back to in-memory store (non-persistent).');
    }
    
    this.config = {
      dailyLimitUSD: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0'),
      rolloverTimezone: process.env.COST_TRACKER_ROLLOVER_TZ || 'UTC',
      redisKeyPrefix: process.env.REDIS_PREFIX || 'prod:',
      strictMode: process.env.BUDGET_STRICT !== 'false',
      alertThreshold: parseFloat(process.env.BUDGET_ALERT_THRESHOLD || '0.8')
    };
    this.memoryBudget.lastResetDate = this.getTodayDateString();
    
    // Validate pricing on startup
    const { valid, errors } = require('../config/openai/pricing').validatePricing();
    if (!valid) {
      console.error('❌ PRICING_VALIDATION_FAILED:', errors);
      throw new Error('Invalid pricing configuration');
    }
  }
  
  static getInstance(): OpenAIBudgetedClient {
    if (!this.instance) {
      this.instance = new OpenAIBudgetedClient();
    }
    return this.instance;
  }
  
  /**
   * Core budget-guarded wrapper for all OpenAI calls
   */
  async withBudgetGuard<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata: CallMetadata,
    estimatedCost: number,
    modelName: string
  ): Promise<T> {
    const startTime = Date.now();
    const requestId = metadata.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 1. Pre-call budget check
      await this.enforcePreCallBudget(estimatedCost, metadata.purpose, modelName);
      
      // 2. Execute the OpenAI operation
      const status = await this.getBudgetStatus();
      console.log(`COST_TRACKER attempt: purpose=${metadata.purpose} model=${modelName} est_cost=$${estimatedCost.toFixed(4)} today=$${status.usedTodayUSD.toFixed(4)}/${status.dailyLimitUSD.toFixed(4)}`);
      
      const result = await operation();
      
      // 3. Post-call cost tracking
      const actualCost = this.extractActualCost(result, modelName, estimatedCost);
      await this.recordActualSpend(actualCost, metadata, modelName, requestId);
      
      const duration = Date.now() - startTime;
      const inputTokens = (result as any)?.usage?.prompt_tokens || 0;
      const outputTokens = (result as any)?.usage?.completion_tokens || 0;
      console.log(`OPENAI_CALL: model=${modelName} in=${inputTokens} out=${outputTokens} purpose=${metadata.purpose} cost=$${actualCost.toFixed(4)}`);
      
      // 4. Check if this call pushed us over budget
      await this.checkPostCallBudgetStatus();
      
      return result;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error instanceof BudgetExceededError) {
        console.log(`BUDGET_GATE DENY: projected=$${error.attempted.toFixed(4)} today=$${error.used.toFixed(4)}/${error.allowed.toFixed(2)} purpose=${metadata.purpose} model=${modelName}`);
        throw error;
      }
      
      console.error(`[COST_TRACKER] ERROR model=${modelName} purpose=${metadata.purpose} duration=${duration}ms error=${error.message} id=${requestId}`);
      
      // Refund estimated cost on failure
      if (estimatedCost > 0) {
        await this.refundEstimatedCost(estimatedCost, 'api_failure');
      }
      
      throw error;
    }
  }
  
  /**
   * Chat completion with budget enforcement and runtime optimization
   */
  async chatComplete(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    metadata: CallMetadata
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    
    // Apply budget-aware optimizations
    const optimizedParams = await this.applyBudgetOptimizations(params, metadata);
    
    const model = optimizedParams.model || 'gpt-4o-mini';
    const estimatedTokens = this.estimateInputTokens(optimizedParams.messages);
    const maxOutputTokens = optimizedParams.max_tokens || 1000;
    const estimatedCost = calculateTokenCost(model, estimatedTokens, maxOutputTokens);
    
    return this.withBudgetGuard(
      'chat.completions.create',
      async () => {
        // Wrap OpenAI call in retry logic with exponential backoff
        const response = await withExponentialBackoff(
          () => this.openai.chat.completions.create(optimizedParams),
          `${metadata.purpose}:${model}`
        );
        return response as OpenAI.Chat.Completions.ChatCompletion;
      },
      metadata,
      estimatedCost,
      model
    );
  }
  
  /**
   * Streaming chat completion with budget enforcement
   */
  async chatCompleteStream(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    metadata: CallMetadata
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    
    const model = params.model || 'gpt-4o-mini';
    const estimatedTokens = this.estimateInputTokens(params.messages);
    const maxOutputTokens = params.max_tokens || 1000;
    const estimatedCost = calculateTokenCost(model, estimatedTokens, maxOutputTokens);
    
    return this.withBudgetGuard(
      'chat.completions.create.stream',
      async () => {
        const stream = await this.openai.chat.completions.create({
          ...params,
          stream: true
        });
        return stream;
      },
      metadata,
      estimatedCost,
      model
    );
  }
  
  /**
   * Embeddings with budget enforcement
   */
  async createEmbedding(
    params: OpenAI.Embeddings.EmbeddingCreateParams,
    metadata: CallMetadata
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    
    const model = params.model || 'text-embedding-3-small';
    const inputText = Array.isArray(params.input) ? params.input.join(' ') : params.input;
    const estimatedTokens = estimateTokenCount(inputText);
    const estimatedCost = calculateTokenCost(model, estimatedTokens, 0);
    
    return this.withBudgetGuard(
      'embeddings.create',
      async () => {
        // Wrap OpenAI call in retry logic with exponential backoff
        return await withExponentialBackoff(
          () => this.openai.embeddings.create(params),
          `embedding:${model}`
        );
      },
      metadata,
      estimatedCost,
      model
    );
  }
  
  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    if (!this.redisEnabled || !this.redis) {
      this.ensureMemoryBudgetFresh();
      const used = this.memoryBudget.usedTodayUSD;
      const remainingUSD = Math.max(0, this.config.dailyLimitUSD - used);
      const percentUsed = this.config.dailyLimitUSD === 0 ? 0 : (used / this.config.dailyLimitUSD) * 100;

      return {
        dailyLimitUSD: this.config.dailyLimitUSD,
        usedTodayUSD: used,
        remainingUSD,
        percentUsed: Number(percentUsed.toFixed(2)),
        isBlocked: this.memoryBudget.blocked,
        lastResetDate: this.memoryBudget.lastResetDate,
        totalCallsToday: this.memoryBudget.totalCallsToday
      };
    }

    const todayKey = this.getTodaySpendKey();
    const blockedKey = this.getBlockedKey();
    
    const [spentStr, isBlocked, callsStr] = await Promise.all([
      this.redis.get(todayKey),
      this.redis.exists(blockedKey),
      this.redis.get(`${todayKey}:calls`)
    ]);
    
    const usedTodayUSD = parseFloat(spentStr || '0');
    const remainingUSD = Math.max(0, this.config.dailyLimitUSD - usedTodayUSD);
    const percentUsed = (usedTodayUSD / this.config.dailyLimitUSD) * 100;
    
    return {
      dailyLimitUSD: this.config.dailyLimitUSD,
      usedTodayUSD,
      remainingUSD,
      percentUsed: Number(percentUsed.toFixed(2)),
      isBlocked: Boolean(isBlocked),
      lastResetDate: this.getTodayDateString(),
      totalCallsToday: parseInt(callsStr || '0')
    };
  }
  
  /**
   * Get spending breakdown
   */
  async getSpendingBreakdown(): Promise<SpendingBreakdown> {
    try {
      const { supaService } = await import('../db/supabaseService');
      const today = this.getTodayDateString();
      
      const { data: records } = await supaService
        .from('api_usage')
        .select('*')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .order('created_at', { ascending: false });
      
      if (!records) {
        return { byModel: {}, byPurpose: {}, topExpensive: [] };
      }
      
      const byModel: Record<string, { calls: number; totalCost: number }> = {};
      const byPurpose: Record<string, { calls: number; totalCost: number }> = {};
      const topExpensive: Array<{ purpose: string; model: string; cost: number; timestamp: string }> = [];
      
      records.forEach(record => {
        // By model
        if (!byModel[record.model]) {
          byModel[record.model] = { calls: 0, totalCost: 0 };
        }
        byModel[record.model].calls++;
        byModel[record.model].totalCost += record.cost_usd;
        
        // By purpose
        const purpose = record.intent || 'unknown';
        if (!byPurpose[purpose]) {
          byPurpose[purpose] = { calls: 0, totalCost: 0 };
        }
        byPurpose[purpose].calls++;
        byPurpose[purpose].totalCost += record.cost_usd;
        
        // Top expensive
        topExpensive.push({
          purpose,
          model: record.model,
          cost: record.cost_usd,
          timestamp: record.created_at
        });
      });
      
      // Sort top expensive by cost descending
      topExpensive.sort((a, b) => b.cost - a.cost);
      
      return {
        byModel,
        byPurpose,
        topExpensive: topExpensive.slice(0, 10)
      };
      
    } catch (error) {
      console.error('❌ SPENDING_BREAKDOWN_ERROR:', error);
      return { byModel: {}, byPurpose: {}, topExpensive: [] };
    }
  }
  
  /**
   * Choose optimal model based on remaining budget
   */
  async chooseModelForIntent(intent: string, preferredModel?: string): Promise<string> {
    const status = await this.getBudgetStatus();
    const recommendations = getModelRecommendations(status.remainingUSD);
    
    if (recommendations.recommended === 'none') {
      throw new BudgetExceededError(
        status.dailyLimitUSD,
        status.usedTodayUSD,
        0,
        'Insufficient budget for any model'
      );
    }
    
    // Use preferred model if budget allows
    if (preferredModel && status.remainingUSD > 1.0) {
      console.log(`💰 MODEL_SELECTION: Using preferred ${preferredModel} (budget: $${status.remainingUSD.toFixed(2)})`);
      return preferredModel;
    }
    
    console.log(`💰 MODEL_SELECTION: ${recommendations.recommended} for ${intent} (${recommendations.reasoning})`);
    return recommendations.recommended;
  }
  
  // Private helper methods
  
  private async enforcePreCallBudget(estimatedCost: number, purpose: string, model: string): Promise<void> {
    const status = await this.getBudgetStatus();
    
    if (status.isBlocked) {
      throw new BudgetExceededError(
        status.dailyLimitUSD,
        status.usedTodayUSD,
        estimatedCost,
        'Daily budget limit reached - calls blocked'
      );
    }
    
    const projectedTotal = status.usedTodayUSD + estimatedCost;
    
    if (projectedTotal > status.dailyLimitUSD) {
      if (this.redisEnabled && this.redis) {
        await this.redis.setex(this.getBlockedKey(), 86400, 'budget_exceeded');
      } else {
        this.memoryBudget.blocked = true;
      }
      
      throw new BudgetExceededError(
        status.dailyLimitUSD,
        status.usedTodayUSD,
        estimatedCost,
        `Call would exceed daily budget`
      );
    }
    
    // Log successful budget gate passage
    console.log(`BUDGET_GATE ALLOW: new_today=$${projectedTotal.toFixed(4)}/${status.dailyLimitUSD.toFixed(4)} purpose=${purpose} model=${model}`);
    
    // Shadow mode logging
    if (!this.config.strictMode) {
      console.log(`🕵️ BUDGET_SHADOW: would allow $${estimatedCost.toFixed(4)} call (total: $${projectedTotal.toFixed(4)}/$${status.dailyLimitUSD.toFixed(2)})`);
    }
  }
  
  private extractActualCost(result: any, model: string, estimatedCost: number): number {
    // Extract token usage from OpenAI response
    if (result?.usage) {
      const { prompt_tokens = 0, completion_tokens = 0 } = result.usage;
      return calculateTokenCost(model, prompt_tokens, completion_tokens);
    }
    
    // Fallback to estimated cost
    return estimatedCost;
  }
  
  private async recordActualSpend(
    cost: number,
    metadata: CallMetadata,
    model: string,
    requestId: string
  ): Promise<void> {
    if (this.redisEnabled && this.redis) {
      const todayKey = this.getTodaySpendKey();
      
      const [newTotal] = await Promise.all([
        this.redis.incrbyfloat(todayKey, cost),
        this.redis.incr(`${todayKey}:calls`),
        this.redis.expire(todayKey, 86400 * 2), // 2-day expiry
        this.redis.expire(`${todayKey}:calls`, 86400 * 2)
      ]);
      
      console.log(`[COST_TRACKER] model=${model} cost=$${cost.toFixed(4)} daily=$${parseFloat(newTotal.toString()).toFixed(4)}/${this.config.dailyLimitUSD.toFixed(2)} purpose=${metadata.purpose}`);
    } else {
      this.ensureMemoryBudgetFresh();
      this.memoryBudget.usedTodayUSD += cost;
      this.memoryBudget.totalCallsToday += 1;
      
      const timestamp = new Date().toISOString();
      
      const modelStats = this.memoryBudget.byModel.get(model) || { calls: 0, totalCost: 0 };
      modelStats.calls += 1;
      modelStats.totalCost += cost;
      this.memoryBudget.byModel.set(model, modelStats);
      
      const purpose = metadata.purpose || 'unknown';
      const purposeStats = this.memoryBudget.byPurpose.get(purpose) || { calls: 0, totalCost: 0 };
      purposeStats.calls += 1;
      purposeStats.totalCost += cost;
      this.memoryBudget.byPurpose.set(purpose, purposeStats);
      
      this.memoryBudget.topExpensive.push({
        purpose,
        model,
        cost,
        timestamp
      });
      this.memoryBudget.topExpensive.sort((a, b) => b.cost - a.cost);
      if (this.memoryBudget.topExpensive.length > 10) {
        this.memoryBudget.topExpensive.length = 10;
      }
      
      console.log(`[COST_TRACKER] (memory) model=${model} cost=$${cost.toFixed(4)} daily=$${this.memoryBudget.usedTodayUSD.toFixed(4)}/${this.config.dailyLimitUSD.toFixed(2)} purpose=${purpose}`);
    }
    
    // Store in database for detailed analytics
    this.storeInDatabase(cost, metadata, model, requestId).catch(error => {
      console.error('💾 DB_STORE_ERROR:', error.message);
    });
  }
  
  private async checkPostCallBudgetStatus(): Promise<void> {
    const status = await this.getBudgetStatus();
    
    if (status.usedTodayUSD >= status.dailyLimitUSD) {
      if (this.redisEnabled && this.redis) {
        await this.redis.setex(this.getBlockedKey(), 86400, 'budget_exceeded_post_call');
      } else {
        this.memoryBudget.blocked = true;
      }
      console.log(`🛑 BUDGET_CIRCUIT_BREAKER: Activated after exceeding $${status.dailyLimitUSD.toFixed(2)} (used: $${status.usedTodayUSD.toFixed(4)})`);
    }
    
    // Warning at 80%
    if (status.percentUsed >= 80 && status.percentUsed < 95) {
      console.log(`⚠️ BUDGET_WARNING: ${status.percentUsed.toFixed(1)}% of daily budget used ($${status.usedTodayUSD.toFixed(2)}/$${status.dailyLimitUSD.toFixed(2)})`);
    }
  }
  
  private async refundEstimatedCost(cost: number, reason: string): Promise<void> {
    if (this.redisEnabled && this.redis) {
      const todayKey = this.getTodaySpendKey();
      await this.redis.incrbyfloat(todayKey, -cost);
    } else {
      this.ensureMemoryBudgetFresh();
      this.memoryBudget.usedTodayUSD = Math.max(0, this.memoryBudget.usedTodayUSD - cost);
    }
    console.log(`💸 BUDGET_REFUND: $${cost.toFixed(4)} refunded (${reason})`);
  }
  
  private async storeInDatabase(
    cost: number,
    metadata: CallMetadata,
    model: string,
    requestId: string
  ): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      await supabase.from('api_usage').insert({
        intent: metadata.purpose,
        model,
        prompt_tokens: 0, // Will be updated if we track tokens separately
        completion_tokens: 0,
        cost_usd: cost,
        meta: {
          request_id: requestId,
          user_id: metadata.userId,
          priority: metadata.priority,
          timestamp: new Date().toISOString(),
          budget_tracking: true
        }
      });
      
    } catch (error) {
      console.error('💾 DATABASE_INSERT_ERROR:', error);
    }
  }
  
  private estimateInputTokens(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): number {
    const text = messages
      .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
      .join(' ');
    return estimateTokenCount(text);
  }

  private ensureMemoryBudgetFresh(): void {
    const today = this.getTodayDateString();
    if (this.memoryBudget.lastResetDate !== today) {
      this.memoryBudget.lastResetDate = today;
      this.memoryBudget.usedTodayUSD = 0;
      this.memoryBudget.totalCallsToday = 0;
      this.memoryBudget.blocked = false;
      this.memoryBudget.byModel.clear();
      this.memoryBudget.byPurpose.clear();
      this.memoryBudget.topExpensive = [];
    }
  }
  
  private getTodaySpendKey(): string {
    return `${this.config.redisKeyPrefix}openai_cost:${this.getTodayDateString()}`;
  }
  
  private getBlockedKey(): string {
    return `${this.config.redisKeyPrefix}openai_blocked:${this.getTodayDateString()}`;
  }
  
  private getTodayDateString(): string {
    // Use configured timezone for rollover
    const now = new Date();
    if (this.config.rolloverTimezone === 'UTC') {
      return now.toISOString().split('T')[0];
    }
    // For non-UTC, convert to local date string
    // This is simplified - in production, use a proper timezone library
    return now.toISOString().split('T')[0];
  }

  /**
   * Apply budget-aware optimizations to reduce costs when approaching limits
   */
  private async applyBudgetOptimizations(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    metadata: CallMetadata
  ): Promise<OpenAI.Chat.Completions.ChatCompletionCreateParams> {
    const status = await this.getBudgetStatus();
    const usagePercent = status.percentUsed / 100;
    
    // No optimization needed if under alert threshold
    if (usagePercent < this.config.alertThreshold) {
      return params;
    }
    
    const optimizedParams = { ...params };
    let optimizationReason = '';
    
    // 80-90%: Reduce max_tokens
    if (usagePercent >= 0.8 && usagePercent < 0.9) {
      const originalTokens = params.max_tokens || 1000;
      optimizedParams.max_tokens = Math.floor(originalTokens * 0.7); // 30% reduction
      optimizationReason += `max_tokens=${originalTokens}→${optimizedParams.max_tokens} `;
    }
    
    // 90-95%: Switch to cheaper model + reduce tokens
    if (usagePercent >= 0.9 && usagePercent < 0.95) {
      const originalModel = params.model || 'gpt-4o-mini';
      const originalTokens = params.max_tokens || 1000;
      
      // Model downgrade mapping
      const modelDowngrades: Record<string, string> = {
        'gpt-4o': 'gpt-4o-mini',
        'gpt-4': 'gpt-4o-mini',
        'gpt-4-turbo': 'gpt-4o-mini',
        'gpt-4o-mini': 'gpt-3.5-turbo'
      };
      
      if (modelDowngrades[originalModel]) {
        optimizedParams.model = modelDowngrades[originalModel];
        optimizationReason += `model=${originalModel}→${optimizedParams.model} `;
      }
      
      optimizedParams.max_tokens = Math.floor(originalTokens * 0.5); // 50% reduction
      optimizationReason += `max_tokens=${originalTokens}→${optimizedParams.max_tokens} `;
    }
    
    // 95%+: Maximum cost reduction
    if (usagePercent >= 0.95) {
      optimizedParams.model = 'gpt-3.5-turbo'; // Cheapest model
      optimizedParams.max_tokens = 256; // Minimal tokens
      optimizedParams.temperature = 0.1; // Reduce randomness for efficiency
      optimizationReason += `model=gpt-3.5-turbo max_tokens=256 temp=0.1 `;
    }
    
    // Log optimization decision
    if (optimizationReason) {
      console.log(`BUDGET_OPTIMIZER: throttle ${optimizationReason}reason=threshold${Math.round(usagePercent * 100)} purpose=${metadata.purpose}`);
    }
    
    return optimizedParams;
  }
}

// Export singleton instance
export const budgetedOpenAI = OpenAIBudgetedClient.getInstance();

// Export convenience functions
export async function createBudgetedChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  metadata: CallMetadata
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return budgetedOpenAI.chatComplete(params, metadata);
}

export async function createBudgetedChatCompletionStream(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  metadata: CallMetadata
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  return budgetedOpenAI.chatCompleteStream(params, metadata);
}

export async function createBudgetedEmbedding(
  params: OpenAI.Embeddings.EmbeddingCreateParams,
  metadata: CallMetadata
): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
  return budgetedOpenAI.createEmbedding(params, metadata);
}
