/**
 * Canonical OpenAI Budgeted Client
 * ALL OpenAI calls must go through this wrapper for budget enforcement
 */

import OpenAI from 'openai';
import { Redis } from 'ioredis';
import { calculateTokenCost, estimateTokenCount, getModelPricing, getModelRecommendations } from '../config/openai/pricing';

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
  private redis: Redis;
  private config: BudgetConfig;
  
  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    
    this.redis = new Redis(process.env.REDIS_URL!);
    
    this.config = {
      dailyLimitUSD: parseFloat(process.env.DAILY_OPENAI_LIMIT_USD || '5.0'),
      rolloverTimezone: process.env.COST_TRACKER_ROLLOVER_TZ || 'UTC',
      redisKeyPrefix: process.env.REDIS_PREFIX || 'prod:',
      strictMode: process.env.BUDGET_STRICT !== 'false'
    };
    
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
      console.log(`[COST_TRACKER] PRE-CALL model=${modelName} estimated=$${estimatedCost.toFixed(4)} purpose=${metadata.purpose} id=${requestId}`);
      
      const result = await operation();
      
      // 3. Post-call cost tracking
      const actualCost = this.extractActualCost(result, modelName, estimatedCost);
      await this.recordActualSpend(actualCost, metadata, modelName, requestId);
      
      const duration = Date.now() - startTime;
      console.log(`[COST_TRACKER] SUCCESS model=${modelName} actual=$${actualCost.toFixed(4)} duration=${duration}ms purpose=${metadata.purpose} id=${requestId}`);
      
      // 4. Check if this call pushed us over budget
      await this.checkPostCallBudgetStatus();
      
      return result;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (error instanceof BudgetExceededError) {
        console.log(`🛑 BUDGET: blocked attempted=$${error.attempted.toFixed(4)} used=$${error.used.toFixed(4)}/${error.allowed.toFixed(2)} purpose=${metadata.purpose} model=${modelName}`);
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
   * Chat completion with budget enforcement
   */
  async chatComplete(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    metadata: CallMetadata
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    
    const model = params.model || 'gpt-4o-mini';
    const estimatedTokens = this.estimateInputTokens(params.messages);
    const maxOutputTokens = params.max_tokens || 1000;
    const estimatedCost = calculateTokenCost(model, estimatedTokens, maxOutputTokens);
    
    return this.withBudgetGuard(
      'chat.completions.create',
      async () => {
        const response = await this.openai.chat.completions.create(params);
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
        return await this.openai.embeddings.create(params);
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
      // Set blocked flag
      await this.redis.setex(this.getBlockedKey(), 86400, 'budget_exceeded');
      
      throw new BudgetExceededError(
        status.dailyLimitUSD,
        status.usedTodayUSD,
        estimatedCost,
        `Call would exceed daily budget`
      );
    }
    
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
    const todayKey = this.getTodaySpendKey();
    
    // Atomic Redis increment
    const [newTotal] = await Promise.all([
      this.redis.incrbyfloat(todayKey, cost),
      this.redis.incr(`${todayKey}:calls`),
      this.redis.expire(todayKey, 86400 * 2), // 2-day expiry
      this.redis.expire(`${todayKey}:calls`, 86400 * 2)
    ]);
    
    console.log(`[COST_TRACKER] model=${model} cost=$${cost.toFixed(4)} daily=$${parseFloat(newTotal.toString()).toFixed(4)}/${this.config.dailyLimitUSD.toFixed(2)} purpose=${metadata.purpose}`);
    
    // Store in database for detailed analytics
    this.storeInDatabase(cost, metadata, model, requestId).catch(error => {
      console.error('💾 DB_STORE_ERROR:', error.message);
    });
  }
  
  private async checkPostCallBudgetStatus(): Promise<void> {
    const status = await this.getBudgetStatus();
    
    if (status.usedTodayUSD >= status.dailyLimitUSD) {
      await this.redis.setex(this.getBlockedKey(), 86400, 'budget_exceeded_post_call');
      console.log(`🛑 BUDGET_CIRCUIT_BREAKER: Activated after exceeding $${status.dailyLimitUSD.toFixed(2)} (used: $${status.usedTodayUSD.toFixed(4)})`);
    }
    
    // Warning at 80%
    if (status.percentUsed >= 80 && status.percentUsed < 95) {
      console.log(`⚠️ BUDGET_WARNING: ${status.percentUsed.toFixed(1)}% of daily budget used ($${status.usedTodayUSD.toFixed(2)}/$${status.dailyLimitUSD.toFixed(2)})`);
    }
  }
  
  private async refundEstimatedCost(cost: number, reason: string): Promise<void> {
    const todayKey = this.getTodaySpendKey();
    await this.redis.incrbyfloat(todayKey, -cost);
    console.log(`💸 BUDGET_REFUND: $${cost.toFixed(4)} refunded (${reason})`);
  }
  
  private async storeInDatabase(
    cost: number,
    metadata: CallMetadata,
    model: string,
    requestId: string
  ): Promise<void> {
    try {
      const { supaService } = await import('../db/supabaseService');
      
      await supaService.from('api_usage').insert({
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
