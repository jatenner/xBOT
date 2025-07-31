/**
 * 🚨 BUDGET-AWARE OPENAI CLIENT
 * 
 * Intercepts all OpenAI API calls and enforces strict budget limits.
 * All AI operations must go through this wrapper to ensure budget compliance.
 * 
 * UPDATED: Now integrates with SmartBudgetOptimizer for maximum tweet output
 */

import { OpenAI } from 'openai';
import { budgetEnforcer, BudgetPriority } from './budgetEnforcer';
import { smartBudgetOptimizer } from './smartBudgetOptimizer';

export interface BudgetAwareRequestOptions {
  priority: BudgetPriority;
  operationType: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  forTweetGeneration?: boolean; // New: indicates this is for tweet generation
}

export class BudgetAwareOpenAI {
  private openai: OpenAI;
  private readonly COST_PER_1K_TOKENS = 0.00015; // gpt-4o-mini cost

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * 🛡️ BUDGET-AWARE CHAT COMPLETION
   */
  async createChatCompletion(
    messages: any[],
    options: BudgetAwareRequestOptions
  ): Promise<{ success: boolean; response?: any; error?: string; cost: number }> {
    const {
      priority,
      operationType,
      maxTokens = 100,
      model = 'gpt-4o-mini',
      temperature = 0.3,
      forTweetGeneration = false
    } = options;

    try {
      // Calculate estimated cost
      let estimatedCost = this.calculateEstimatedCost(maxTokens, model);
      let actualMaxTokens = maxTokens;

      // If this is for tweet generation, optimize using SmartBudgetOptimizer
      if (forTweetGeneration) {
        const plan = await smartBudgetOptimizer.createDailyPlan();
        const optimization = smartBudgetOptimizer.getCostOptimization(plan.budgetPerTweet);
        
        // Adjust tokens and cost based on optimization
        actualMaxTokens = Math.min(maxTokens, optimization.maxTokensPerTweet);
        estimatedCost = optimization.estimatedCostPerTweet;
        
        console.log(`🎯 TWEET OPTIMIZATION: ${optimization.qualityLevel} quality, ${actualMaxTokens} tokens, $${(estimatedCost || 0).toFixed(3)} budget`);
      }
      
      // Check budget before making the call
      const budgetCheck = await budgetEnforcer.canAffordOperation(
        estimatedCost,
        priority,
        operationType
      );

      if (!budgetCheck.canAfford) {
        // For tweet generation, try fallback options
        if (forTweetGeneration) {
          const fallbackCheck = await this.tryFallbackOptions(operationType);
          if (fallbackCheck.canAfford) {
            console.log(`🔄 Using fallback option: ${fallbackCheck.option}`);
            return await this.executeFallbackGeneration(fallbackCheck.option);
          }
        }

        console.warn(`🚨 BUDGET DENIED: ${operationType} - ${budgetCheck.reason}`);
        return {
          success: false,
          error: `Budget limit exceeded: ${budgetCheck.reason}`,
          cost: 0
        };
      }

      // Make the API call with optimized settings
      console.log(`🤖 AI CALL: ${operationType} (${priority}) - estimated $${estimatedCost.toFixed(4)}`);
      
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        max_tokens: actualMaxTokens,
        temperature
      });

      // Calculate actual cost based on usage
      const actualTokens = response.usage?.total_tokens || actualMaxTokens;
      const actualCost = this.calculateActualCost(actualTokens, model);

      // Record the spending
      await budgetEnforcer.recordSpending(
        actualCost,
        operationType,
        priority,
        `${actualTokens} tokens (optimized)`
      );

      // Log efficiency for tweet generation
      if (forTweetGeneration) {
        console.log(`📊 TWEET EFFICIENCY: $${actualCost.toFixed(4)} cost, ${actualTokens} tokens`);
      }

      return {
        success: true,
        response,
        cost: actualCost
      };

    } catch (error: any) {
      console.error(`❌ AI CALL FAILED: ${operationType} -`, error.message);
      
      // For tweet generation, try emergency fallback
      if (forTweetGeneration && error.message.includes('budget')) {
        return await this.emergencyTweetFallback();
      }
      
      return {
        success: false,
        error: error.message,
        cost: 0
      };
    }
  }

  /**
   * 🔄 TRY FALLBACK OPTIONS FOR TWEET GENERATION
   */
  private async tryFallbackOptions(operationType: string): Promise<{
    canAfford: boolean;
    option: string;
    cost: number;
  }> {
    // Try progressively cheaper options
    const fallbackOptions = [
      { name: 'reduced_tokens', cost: 0.10, tokens: 60 },
      { name: 'minimal_ai', cost: 0.05, tokens: 40 },
      { name: 'template_fill', cost: 0.02, tokens: 20 }
    ];

    for (const option of fallbackOptions) {
      const check = await budgetEnforcer.canAffordOperation(
        option.cost,
        'critical',
        `${operationType}_fallback`
      );

      if (check.canAfford) {
        return {
          canAfford: true,
          option: option.name,
          cost: option.cost
        };
      }
    }

    return { canAfford: false, option: 'none', cost: 0 };
  }

  /**
   * 🆘 EMERGENCY TWEET FALLBACK
   */
  private async emergencyTweetFallback(): Promise<{ success: boolean; response?: any; error?: string; cost: number }> {
    console.log('🆘 EMERGENCY: Using pre-generated content library');
    
    // Return emergency content
    const emergencyContent = this.getEmergencyContent();
    return {
      success: true,
      response: {
        choices: [{
          message: {
            content: emergencyContent
          }
        }]
      },
      cost: 0 // No cost for emergency content
    };
  }

  /**
   * 🔄 EXECUTE FALLBACK GENERATION
   */
  private async executeFallbackGeneration(option: string): Promise<{ success: boolean; response?: any; error?: string; cost: number }> {
    const fallbackPrompts = {
      reduced_tokens: "Generate a concise healthcare tech insight tweet (60 tokens max):",
      minimal_ai: "Healthcare tech fact (40 tokens):",
      template_fill: "Brief health tech update:"
    };

    const prompt = fallbackPrompts[option as keyof typeof fallbackPrompts] || fallbackPrompts.template_fill;
    const maxTokens = option === 'reduced_tokens' ? 60 : option === 'minimal_ai' ? 40 : 20;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.5
      });

      const cost = this.calculateActualCost(response.usage?.total_tokens || maxTokens, 'gpt-4o-mini');
      
      await budgetEnforcer.recordSpending(
        cost,
        `fallback_${option}`,
        'critical',
        `Emergency fallback generation`
      );

      return {
        success: true,
        response,
        cost
      };

    } catch (error: any) {
      return this.emergencyTweetFallback();
    }
  }

  /**
   * 🆘 GET EMERGENCY CONTENT
   */
  private getEmergencyContent(): string {
    const emergencyTweets = [
      "Healthcare innovation never stops. What breakthrough are you most excited about? #HealthTech",
      "The future of medicine is being written today. Every advancement brings us closer to better patient outcomes.",
      "Digital health transformation is accelerating. How is your organization adapting? #DigitalHealth",
      "AI in healthcare: Not about replacing doctors, but empowering them with better tools and insights.",
      "Patient-centered care starts with technology that puts people first. #PatientCare #HealthInnovation"
    ];

    return emergencyTweets[Math.floor(Math.random() * emergencyTweets.length)];
  }

  /**
   * 💰 CALCULATE ESTIMATED COST
   */
  private calculateEstimatedCost(maxTokens: number, model: string): number {
    const costPer1K = this.getCostPer1KTokens(model);
    return (maxTokens / 1000) * costPer1K;
  }

  /**
   * 💰 CALCULATE ACTUAL COST
   */
  private calculateActualCost(totalTokens: number, model: string): number {
    const costPer1K = this.getCostPer1KTokens(model);
    return (totalTokens / 1000) * costPer1K;
  }

  /**
   * 📊 GET COST PER 1K TOKENS
   */
  private getCostPer1KTokens(model: string): number {
    const costs: { [key: string]: number } = {
      'gpt-4o-mini': 0.00015,      // $0.15/1M tokens
      'gpt-4o': 0.0025,            // $2.50/1M tokens
      'gpt-4': 0.03,               // $30/1M tokens
      'gpt-4-turbo': 0.01,         // $10/1M tokens
      'gpt-3.5-turbo': 0.0005      // $0.50/1M tokens
    };
    
    return costs[model] || costs['gpt-4o-mini']; // Default to cheapest
  }

  /**
   * 🎯 PRIORITY-BASED COMPLETION
   * Convenience method for common AI operations
   */
  async generateContent(
    prompt: string,
    priority: BudgetPriority,
    operationType: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      forTweetGeneration?: boolean;
    } = {}
  ): Promise<{ success: boolean; content?: string; error?: string; cost: number }> {
    const messages = [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: prompt }
    ];

    const result = await this.createChatCompletion(messages, {
      priority,
      operationType,
      maxTokens: options.maxTokens || 100,
      temperature: options.temperature || 0.3,
      forTweetGeneration: options.forTweetGeneration || false
    });

    if (result.success && result.response) {
      return {
        success: true,
        content: result.response.choices[0]?.message?.content || '',
        cost: result.cost
      };
    }

    return {
      success: false,
      error: result.error,
      cost: result.cost
    };
  }

  /**
   * 📊 GET BUDGET STATUS
   */
  async getBudgetStatus() {
    return await budgetEnforcer.getBudgetStatus();
  }

  /**
   * 🚨 EMERGENCY BUDGET CHECK
   */
  async isEmergencyBrakeActive(): Promise<boolean> {
    const status = await this.getBudgetStatus();
    return status.emergencyBrakeActive;
  }

  /**
   * 📈 GET SMART OPTIMIZATION REPORT
   */
  async getOptimizationReport(): Promise<string> {
    return await smartBudgetOptimizer.getBudgetUtilizationReport();
  }
}

// Export singleton instance
let budgetAwareOpenAI: BudgetAwareOpenAI | null = null;

export function getBudgetAwareOpenAI(): BudgetAwareOpenAI {
  if (!budgetAwareOpenAI) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    budgetAwareOpenAI = new BudgetAwareOpenAI(apiKey);
  }
  return budgetAwareOpenAI;
}

export { budgetAwareOpenAI }; 