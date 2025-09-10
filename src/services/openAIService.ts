/**
 * 💰 OPENAI SERVICE WITH BUDGET ENFORCEMENT
 * Centralized OpenAI API wrapper with budget controls and monitoring
 * 
 * ALL OpenAI calls MUST go through this service for:
 * - Budget tracking and enforcement
 * - Usage monitoring and analytics
 * - Error handling and retries
 * - Rate limiting and optimization
 */

import OpenAI from 'openai';
import { getUnifiedDataManager } from '../lib/unifiedDataManager';
import { costTracker as newCostTracker } from './costTracker';
import { budgetOptimizer } from './budgetOptimizer';

interface BudgetConfig {
  dailyLimit: number; // USD per day
  monthlyLimit: number; // USD per month
  emergencyStopThreshold: number; // USD - stop all calls if exceeded
  warningThreshold: number; // USD - warn when approaching limits
}

interface UsageRecord {
  timestamp: Date;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD
  requestType: string; // 'content_generation', 'ai_decision', 'analysis', etc.
  success: boolean;
  errorType?: string;
}

interface BudgetStatus {
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  isEmergencyStop: boolean;
  isWarningLevel: boolean;
  totalRequests: number;
  successRate: number;
}

export class OpenAIService {
  private static instance: OpenAIService;
  private openai: OpenAI;
  private dataManager = getUnifiedDataManager();
  private usageHistory: UsageRecord[] = [];
  private isEmergencyStop = false;

  // Budget configuration (adjust based on your limits)
  private budgetConfig: BudgetConfig = {
    dailyLimit: 10.00, // $10 per day - STRICT LIMIT
    monthlyLimit: 200.00, // $200 per month
    emergencyStopThreshold: 12.00, // $12 emergency stop - STRICT ENFORCEMENT
    warningThreshold: 8.00 // $8 warning level - Early warning
  };

  // Pricing per 1K tokens (approximate, update with current OpenAI pricing)
  private readonly TOKEN_PRICING = {
    'gpt-4': { input: 0.030, output: 0.060 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.000150, output: 0.000600 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
  };

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
      maxRetries: 3
    });
    
    // Load usage history from storage
    this.loadUsageHistory();
    
    // Schedule daily budget reset
    this.scheduleDailyReset();
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * 🤖 CHAT COMPLETION WITH BUDGET ENFORCEMENT
   */
  public async chatCompletion(
    messages: any[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      requestType?: string;
      priority?: 'high' | 'medium' | 'low';
      response_format?: any;
    } = {}
  ): Promise<any> {
    let {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 2000,
      requestType = 'general',
      priority = 'medium',
      response_format
    } = options;

    // STRICT JSON: Prevent truncation for content generation
    if (requestType.includes('content') || requestType.includes('follower')) {
      maxTokens = Math.max(maxTokens, 800); // Never allow truncation below 800 tokens
      temperature = 0.7; // Consistent temperature
      
      // Force strict JSON schema for content generation
      if (!response_format) {
        response_format = {
          type: "json_schema",
          json_schema: {
            name: "FollowerContent",
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["content"],
              properties: {
                content: { 
                  type: "array", 
                  items: { type: "string", minLength: 1 } 
                }
              }
            }
          }
        };
      }
    }

    console.log(`🤖 OPENAI_SERVICE: ${requestType} request (${model}, priority: ${priority})`);

    try {
      // Get optimization recommendation
      const optimization = await budgetOptimizer.optimize(requestType);
      if (model === 'gpt-4o' && optimization.recommendedModel === 'gpt-4o-mini') {
        console.log(`💰 MODEL_OPTIMIZATION: Switching ${model} → ${optimization.recommendedModel} (${optimization.reasoning})`);
        model = optimization.recommendedModel;
      }

      // Check budget before making request
      const budgetCheck = await this.checkBudgetLimits(requestType, priority);
      if (!budgetCheck.allowed) {
        throw new Error(`Budget limit exceeded: ${budgetCheck.reason}`);
      }

      // Estimate cost before request
      const estimatedTokens = this.estimateTokens(messages, maxTokens);
      const estimatedCost = this.calculateCost(model, estimatedTokens.input, estimatedTokens.output);
      
      console.log(`💰 ESTIMATED_COST: $${estimatedCost.toFixed(4)} (${estimatedTokens.total} tokens)`);

      // Check optimization cost limit
      if (estimatedCost > optimization.maxCostPerCall) {
        console.warn(`💰 COST_LIMIT_EXCEEDED: $${estimatedCost.toFixed(4)} > $${optimization.maxCostPerCall.toFixed(4)} (${optimization.reasoning})`);
        throw new Error(`Request exceeds optimized cost limit: $${estimatedCost.toFixed(4)} > $${optimization.maxCostPerCall.toFixed(4)}`);
      }

      // ATOMIC BUDGET GATE: Check before every LLM call
      const { ensureBudget, commitCost } = await import('../budget/atomicBudgetGate');
      await ensureBudget(requestType, estimatedCost);

      // Make the OpenAI request with hard budget enforcement
      const startTime = Date.now();
      const response = await newCostTracker.wrapOpenAI(requestType, model, async () => {
        const createParams: any = {
          model,
          messages,
          temperature,
          max_tokens: optimization.allowExpensive ? maxTokens : Math.min(maxTokens, 150)
        };
        
        // Add response_format if provided
        if (response_format) {
          createParams.response_format = response_format;
        }
        
        return await this.openai.chat.completions.create(createParams);
      }, { estimatedCost });

      // TRUNCATION GUARD: Check if response was truncated
      if (response && !('skipped' in response) && response.usage && response.choices?.[0]?.finish_reason === 'length') {
        throw new Error(`TRUNCATED_RESPONSE: Response truncated at ${response.usage.completion_tokens} tokens for ${requestType}`);
      }

      // Add actual cost to budget after successful call
      if (response && !('skipped' in response)) {
        const actualCost = this.calculateCost(model, 
          response.usage?.prompt_tokens || 0, 
          response.usage?.completion_tokens || 0
        );
        await commitCost(requestType, actualCost);
        
        // Log to Supabase for analytics with service role
        try {
          const { insertApiUsage } = await import('../db/supabaseService');
          const result = await insertApiUsage({
            intent: requestType,
            model,
            prompt_tokens: response.usage?.prompt_tokens || 0,
            completion_tokens: response.usage?.completion_tokens || 0,
            cost_usd: actualCost,
            meta: { priority, estimatedCost, optimization: optimization.reasoning }
          });
          
          if (!result.success) {
            console.error('⚠️ API_USAGE_LOG_FAILED:', result.error);
          }
        } catch (logError: any) {
          console.warn('⚠️ API_USAGE_LOG_ERROR:', logError.message);
          // Don't throw - logging failure shouldn't break posting
        }
      }

      // Check if request was skipped due to budget
      if (response && typeof response === 'object' && 'skipped' in response) {
        const skippedResponse = response as { skipped: true; reason: string };
        console.warn(`⏭️ OPENAI_SKIPPED: ${requestType} - ${skippedResponse.reason}`);
        throw new Error(`Daily budget exceeded: ${skippedResponse.reason}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Record usage (response is guaranteed to be ChatCompletion here)
      const actualResponse = response as any;
      const usage = actualResponse.usage;
      const actualCost = this.calculateCost(
        model,
        usage?.prompt_tokens || 0,
        usage?.completion_tokens || 0
      );

      const usageRecord: UsageRecord = {
        timestamp: new Date(),
        model,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        estimatedCost: actualCost,
        requestType,
        success: true
      };

      await this.recordUsage(usageRecord);

      // NEW: Track in comprehensive cost tracker (single call, correct signature)
      // Cost tracking is now handled by newCostTracker.wrapOpenAI above
      console.log(`💰 ACTUAL_COST: $${actualCost.toFixed(4)} (${usage?.total_tokens} tokens)`);

      console.log(`✅ OPENAI_SUCCESS: $${actualCost.toFixed(4)} (${duration}ms, ${usage?.total_tokens} tokens)`);
      
      return actualResponse;

    } catch (error: any) {
      console.error(`❌ OPENAI_ERROR: ${error.message}`);
      
      // Record failed usage
      const usageRecord: UsageRecord = {
        timestamp: new Date(),
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        requestType,
        success: false,
        errorType: error.message
      };

      await this.recordUsage(usageRecord);

      // Error tracking is handled by the budget system
      console.log('💰 OPENAI_ERROR: Cost tracking skipped for failed request');

      throw error;
    }
  }

  /**
   * 🎯 MAP REQUEST TYPE TO OPERATION TYPE FOR COST TRACKING
   */
  private mapRequestTypeToOperation(requestType: string): 'post_generation' | 'reply_generation' | 'thread_generation' | 'content_scoring' | 'optimization' | 'learning' | 'other' {
    const mappings: Record<string, 'post_generation' | 'reply_generation' | 'thread_generation' | 'content_scoring' | 'optimization' | 'learning' | 'other'> = {
      'post_content': 'post_generation',
      'post_generation': 'post_generation',
      'viral_post': 'post_generation',
      'authoritative_content': 'post_generation',
      'content_generation': 'post_generation',
      
      'reply_generation': 'reply_generation',
      'strategic_reply': 'reply_generation',
      'context_reply': 'reply_generation',
      'comment_generation': 'reply_generation',
      
      'thread_generation': 'thread_generation',
      'thread_content': 'thread_generation',
      'thread_planning': 'thread_generation',
      
      'content_scoring': 'content_scoring',
      'quality_check': 'content_scoring',
      'content_analysis': 'content_scoring',
      
      'optimization': 'optimization',
      'prompt_optimization': 'optimization',
      'strategy_optimization': 'optimization',
      
      'learning': 'learning',
      'performance_analysis': 'learning',
      'engagement_analysis': 'learning',
      'pattern_analysis': 'learning'
    };

    return mappings[requestType.toLowerCase()] || 'other';
  }

  /**
   * 💰 CHECK BUDGET LIMITS
   */
  private async checkBudgetLimits(
    requestType: string,
    priority: 'high' | 'medium' | 'low'
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (this.isEmergencyStop) {
      return { allowed: false, reason: 'Emergency budget stop is active' };
    }

    const status = await this.getBudgetStatus();

    // Emergency stop check
    if (status.monthlyUsed >= this.budgetConfig.emergencyStopThreshold) {
      this.isEmergencyStop = true;
      console.error(`🚨 EMERGENCY_BUDGET_STOP: Monthly usage $${status.monthlyUsed.toFixed(2)} exceeds threshold $${this.budgetConfig.emergencyStopThreshold}`);
      return { allowed: false, reason: 'Emergency budget threshold exceeded' };
    }

    // Daily limit check
    if (status.dailyUsed >= this.budgetConfig.dailyLimit) {
      if (priority !== 'high') {
        return { allowed: false, reason: 'Daily budget limit reached (only high priority allowed)' };
      }
    }

    // Monthly limit check
    if (status.monthlyUsed >= this.budgetConfig.monthlyLimit) {
      if (priority !== 'high') {
        return { allowed: false, reason: 'Monthly budget limit reached (only high priority allowed)' };
      }
    }

    // Warning level
    if (status.isWarningLevel) {
      console.warn(`⚠️ BUDGET_WARNING: Approaching limits - Daily: $${status.dailyUsed.toFixed(2)}/$${this.budgetConfig.dailyLimit}, Monthly: $${status.monthlyUsed.toFixed(2)}/$${this.budgetConfig.monthlyLimit}`);
    }

    return { allowed: true };
  }

  /**
   * 📊 GET BUDGET STATUS
   */
  public async getBudgetStatus(): Promise<BudgetStatus> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyUsage = this.usageHistory
      .filter(record => record.timestamp >= startOfDay && record.success)
      .reduce((sum, record) => sum + record.estimatedCost, 0);

    const monthlyUsage = this.usageHistory
      .filter(record => record.timestamp >= startOfMonth && record.success)
      .reduce((sum, record) => sum + record.estimatedCost, 0);

    const totalRequests = this.usageHistory.length;
    const successfulRequests = this.usageHistory.filter(r => r.success).length;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;

    return {
      dailyUsed: dailyUsage,
      monthlyUsed: monthlyUsage,
      dailyRemaining: Math.max(0, this.budgetConfig.dailyLimit - dailyUsage),
      monthlyRemaining: Math.max(0, this.budgetConfig.monthlyLimit - monthlyUsage),
      isEmergencyStop: this.isEmergencyStop,
      isWarningLevel: monthlyUsage >= this.budgetConfig.warningThreshold,
      totalRequests,
      successRate
    };
  }

  /**
   * 📈 RECORD USAGE
   */
  private async recordUsage(usage: UsageRecord): Promise<void> {
    try {
      // Add to in-memory history
      this.usageHistory.push(usage);
      
      // Keep only last 1000 records in memory
      if (this.usageHistory.length > 1000) {
        this.usageHistory = this.usageHistory.slice(-500);
      }

      // Store in unified data manager for persistence
      await this.dataManager.storeAIDecision({
        decisionTimestamp: usage.timestamp,
        decisionType: 'api_usage',
        recommendation: {
          model: usage.model,
          requestType: usage.requestType,
          tokenUsage: {
            prompt: usage.promptTokens,
            completion: usage.completionTokens,
            total: usage.totalTokens
          },
          cost: usage.estimatedCost,
          success: usage.success
        },
        confidence: usage.success ? 1.0 : 0.0,
        reasoning: usage.success ? 'API call successful' : `API call failed: ${usage.errorType}`,
        dataPointsUsed: usage.totalTokens
      });

    } catch (error: any) {
      console.error('❌ Failed to record OpenAI usage:', error.message);
    }
  }

  /**
   * 💲 CALCULATE COST
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.TOKEN_PRICING[model as keyof typeof this.TOKEN_PRICING] || this.TOKEN_PRICING['gpt-4o-mini'];
    
    const promptCost = (promptTokens / 1000) * pricing.input;
    const completionCost = (completionTokens / 1000) * pricing.output;
    
    return promptCost + completionCost;
  }

  /**
   * 📏 ESTIMATE TOKENS
   */
  private estimateTokens(messages: any[], maxTokens: number): { input: number; output: number; total: number } {
    // Rough estimation: 1 token ≈ 4 characters for English text
    const messageText = messages.map(m => m.content).join(' ');
    const inputTokens = Math.ceil(messageText.length / 4);
    const outputTokens = Math.min(maxTokens, 1000); // Conservative estimate
    
    return {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens
    };
  }

  /**
   * 🔄 LOAD USAGE HISTORY
   */
  private async loadUsageHistory(): Promise<void> {
    try {
      // Load recent usage from unified data manager
      const decisions = await this.dataManager.getAIDecisions(7); // Last 7 days
      
      this.usageHistory = decisions
        .filter(d => d.decisionType === 'api_usage')
        .map(d => ({
          timestamp: d.decisionTimestamp,
          model: (d.recommendation as any)?.model || 'unknown',
          promptTokens: (d.recommendation as any)?.tokenUsage?.prompt || 0,
          completionTokens: (d.recommendation as any)?.tokenUsage?.completion || 0,
          totalTokens: (d.recommendation as any)?.tokenUsage?.total || 0,
          estimatedCost: (d.recommendation as any)?.cost || 0,
          requestType: (d.recommendation as any)?.requestType || 'unknown',
          success: (d.recommendation as any)?.success || false,
          errorType: d.successScore === 0 ? 'unknown_error' : undefined
        }));

      console.log(`📊 OPENAI_SERVICE: Loaded ${this.usageHistory.length} usage records`);

    } catch (error: any) {
      console.error('❌ Failed to load OpenAI usage history:', error.message);
      this.usageHistory = [];
    }
  }

  /**
   * ⏰ SCHEDULE DAILY RESET
   */
  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      console.log('🔄 OPENAI_SERVICE: Daily budget reset');
      this.isEmergencyStop = false; // Reset emergency stop daily
      
      // Schedule next reset
      setInterval(() => {
        console.log('🔄 OPENAI_SERVICE: Daily budget reset');
      }, 24 * 60 * 60 * 1000); // Every 24 hours

    }, msUntilMidnight);
  }

  /**
   * 🛠️ UPDATE BUDGET CONFIG
   */
  public updateBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config };
    console.log('💰 BUDGET_CONFIG updated:', this.budgetConfig);
  }

  /**
   * 🚨 EMERGENCY RESET
   */
  public emergencyReset(): void {
    this.isEmergencyStop = false;
    console.log('🚨 EMERGENCY_RESET: Budget enforcement reset manually');
  }

  /**
   * 📈 GET USAGE ANALYTICS
   */
  public getUsageAnalytics(): {
    requestsByType: Record<string, number>;
    costByModel: Record<string, number>;
    averageTokensPerRequest: number;
    errorRate: number;
    totalSpent: number;
  } {
    const requestsByType: Record<string, number> = {};
    const costByModel: Record<string, number> = {};
    let totalTokens = 0;
    let totalCost = 0;
    let errors = 0;

    this.usageHistory.forEach(record => {
      requestsByType[record.requestType] = (requestsByType[record.requestType] || 0) + 1;
      costByModel[record.model] = (costByModel[record.model] || 0) + record.estimatedCost;
      totalTokens += record.totalTokens;
      totalCost += record.estimatedCost;
      if (!record.success) errors++;
    });

    return {
      requestsByType,
      costByModel,
      averageTokensPerRequest: this.usageHistory.length > 0 ? totalTokens / this.usageHistory.length : 0,
      errorRate: this.usageHistory.length > 0 ? errors / this.usageHistory.length : 0,
      totalSpent: totalCost
    };
  }
}

export const getOpenAIService = () => OpenAIService.getInstance();
