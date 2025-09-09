/**
 * 🛡️ COST CONTROL WRAPPER
 * Mandatory wrapper for ALL OpenAI API calls
 */

import { OpenAIService } from '../services/openAIService';

export interface CostControlledRequest {
  messages: any[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  requestType: string;
  priority?: 'high' | 'medium' | 'low';
  feature?: string; // For budget allocation
}

export interface CostControlResult {
  success: boolean;
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  error?: string;
  budgetWarning?: string;
}

/**
 * 🛡️ MANDATORY COST-CONTROLLED OPENAI WRAPPER
 * ALL OpenAI calls MUST go through this wrapper
 */
export class CostControlWrapper {
  private static instance: CostControlWrapper;
  private openAIService: OpenAIService;
  
  // Feature budget limits (daily)
  private readonly FEATURE_BUDGETS = {
    'content_generation': 3.00,    // $3/day for content generation
    'reply_generation': 1.50,      // $1.50/day for replies  
    'thread_generation': 2.00,     // $2/day for threads
    'content_scoring': 0.50,       // $0.50/day for scoring
    'learning': 0.75,              // $0.75/day for learning
    'testing': 0.25,               // $0.25/day for tests
    'other': 2.00                  // $2/day for misc
  };

  private constructor() {
    this.openAIService = OpenAIService.getInstance();
  }

  static getInstance(): CostControlWrapper {
    if (!this.instance) {
      this.instance = new CostControlWrapper();
    }
    return this.instance;
  }

  /**
   * 🛡️ COST-CONTROLLED CHAT COMPLETION
   */
  async chatCompletion(request: CostControlledRequest): Promise<CostControlResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🛡️ COST_WRAPPER: ${request.requestType} (${request.feature || 'unknown'} feature)`);
      
      // Feature budget check
      const featureBudgetCheck = await this.checkFeatureBudget(request.feature || 'other');
      if (!featureBudgetCheck.allowed) {
        return {
          success: false,
          error: `Feature budget exceeded: ${featureBudgetCheck.reason}`,
          budgetWarning: `Daily ${request.feature} budget limit reached`
        };
      }

      // Enforce cost-optimized defaults
      const optimizedRequest = this.optimizeRequest(request);
      
      // Make request through OpenAIService (with budget controls)
      const response = await this.openAIService.chatCompletion(
        optimizedRequest.messages,
        {
          model: optimizedRequest.model,
          temperature: optimizedRequest.temperature,
          maxTokens: optimizedRequest.maxTokens,
          requestType: optimizedRequest.requestType,
          priority: optimizedRequest.priority
        }
      );

      const duration = Date.now() - startTime;
      const content = response.choices?.[0]?.message?.content || '';
      const usage = response.usage;

      // Record feature usage
      await this.recordFeatureUsage(request.feature || 'other', usage, duration);

      console.log(`✅ COST_WRAPPER: Success in ${duration}ms`);
      
      return {
        success: true,
        content,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost: this.calculateCost(optimizedRequest.model || 'gpt-4o-mini', usage.prompt_tokens, usage.completion_tokens)
        } : undefined
      };

    } catch (error: any) {
      console.error(`❌ COST_WRAPPER: Failed - ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        budgetWarning: error.message.includes('budget') ? error.message : undefined
      };
    }
  }

  /**
   * 🎯 OPTIMIZE REQUEST FOR COST EFFICIENCY
   */
  private optimizeRequest(request: CostControlledRequest): CostControlledRequest {
    const optimized = { ...request };
    
    // Force cost-efficient model if not specified
    if (!optimized.model || optimized.model === 'gpt-4' || optimized.model === 'gpt-4o') {
      console.log(`💰 COST_OPTIMIZATION: Downgrading ${optimized.model || 'unspecified'} to gpt-4o-mini`);
      optimized.model = 'gpt-4o-mini';
    }
    
    // Enforce reasonable token limits
    if (!optimized.maxTokens || optimized.maxTokens > 1000) {
      const originalTokens = optimized.maxTokens;
      optimized.maxTokens = Math.min(optimized.maxTokens || 1000, 1000);
      if (originalTokens && originalTokens > 1000) {
        console.log(`💰 COST_OPTIMIZATION: Reduced max_tokens from ${originalTokens} to ${optimized.maxTokens}`);
      }
    }
    
    // Set reasonable temperature
    if (!optimized.temperature) {
      optimized.temperature = 0.7;
    }
    
    // Default priority to low for cost savings
    if (!optimized.priority) {
      optimized.priority = 'low';
    }
    
    return optimized;
  }

  /**
   * 💰 CHECK FEATURE BUDGET
   */
  private async checkFeatureBudget(feature: string): Promise<{
    allowed: boolean;
    reason?: string;
    remaining: number;
  }> {
    const featureBudget = this.FEATURE_BUDGETS[feature as keyof typeof this.FEATURE_BUDGETS] || this.FEATURE_BUDGETS.other;
    
    // TODO: Get actual feature usage from Redis/Database
    // For now, assume we're within budget
    const usedToday = 0; // Will be implemented with actual tracking
    const remaining = featureBudget - usedToday;
    
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `Feature '${feature}' has exceeded daily budget of $${featureBudget}`,
        remaining: 0
      };
    }
    
    return {
      allowed: true,
      remaining
    };
  }

  /**
   * 📊 RECORD FEATURE USAGE
   */
  private async recordFeatureUsage(feature: string, usage: any, duration: number): Promise<void> {
    try {
      // Record in analytics for budget tracking
      const cost = this.calculateCost('gpt-4o-mini', usage?.prompt_tokens || 0, usage?.completion_tokens || 0);
      
      console.log(`📊 FEATURE_USAGE: ${feature} - $${cost.toFixed(4)} in ${duration}ms`);
      
      // TODO: Store in Redis/Database for budget tracking
      // await this.storeFeatureUsage(feature, cost, usage, duration);
      
    } catch (error) {
      console.warn('⚠️ FEATURE_USAGE_RECORDING_FAILED:', error);
    }
  }

  /**
   * 💰 CALCULATE COST
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = {
      'gpt-4': { input: 0.030, output: 0.060 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.000150, output: 0.000600 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };

    const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-4o-mini'];
    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * 📊 GET BUDGET STATUS
   */
  async getBudgetStatus(): Promise<{
    totalDailyBudget: number;
    featureBudgets: typeof this.FEATURE_BUDGETS;
    totalUsedToday: number;
    remainingToday: number;
    topFeaturesByUsage: Array<{ feature: string; used: number; budget: number }>;
  }> {
    const totalDailyBudget = Object.values(this.FEATURE_BUDGETS).reduce((sum, budget) => sum + budget, 0);
    
    // TODO: Get actual usage from storage
    const totalUsedToday = 0;
    
    return {
      totalDailyBudget,
      featureBudgets: this.FEATURE_BUDGETS,
      totalUsedToday,
      remainingToday: totalDailyBudget - totalUsedToday,
      topFeaturesByUsage: [] // Will be populated with real data
    };
  }
}

// Export singleton and convenience function
export const costControlWrapper = CostControlWrapper.getInstance();

/**
 * 🛡️ CONVENIENCE FUNCTION - Use this instead of direct OpenAI calls
 */
export async function safeChatCompletion(
  messages: any[],
  requestType: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    priority?: 'high' | 'medium' | 'low';
    feature?: string;
  } = {}
): Promise<CostControlResult> {
  return costControlWrapper.chatCompletion({
    messages,
    requestType,
    ...options
  });
}
