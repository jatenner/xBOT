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
import { SupremeAIPromptOptimizer } from './supremeAIPromptOptimizer';
import * as crypto from 'crypto';

// 🗂️ LRU Cache for OpenAI completions (avoids duplicate API calls)
interface CacheEntry {
  response: any;
  timestamp: number;
  cost: number;
}

class CompletionCache {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_SIZE = 100;
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  generateKey(messages: any[], model: string, maxTokens: number, temperature: number): string {
    const content = JSON.stringify({ messages, model, maxTokens, temperature });
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, response: any, cost: number): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      cost
    });
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // TODO: track hits/misses if needed
    };
  }
}

const completionCache = new CompletionCache();

export interface BudgetAwareRequestOptions {
  priority: BudgetPriority;
  operationType: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  forTweetGeneration?: boolean; // New: indicates this is for tweet generation
  existingContent?: string; // For dynamic token calculation
}

export class BudgetAwareOpenAI {
  private openai: OpenAI;
  private readonly COST_PER_1K_TOKENS = 0.00015; // gpt-4o-mini cost

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * 🎯 DYNAMIC TOKEN CALCULATION - Smart token allocation based on content
   */
  private calculateOptimalTokens(operation: string, existingContent?: string): number {
    const baseTokens = {
      content_generation: 150,
      fact_checking: 50,
      quality_check: 40,
      style_optimization: 80,
      trending_topic: 60,
      decision_making: 70
    };

    let tokens = baseTokens[operation] || 100;
    
    // If we have existing content, scale based on its length
    if (existingContent) {
      const wordCount = existingContent.trim().split(/\s+/).length;
      // Target 1.2x the input length (rough tokens ≈ words × 1.3)
      const dynamicTokens = Math.ceil(wordCount * 1.2 * 1.3);
      tokens = Math.max(tokens, dynamicTokens);
    }
    
    // Cap at reasonable maximums
    const maxTokens = {
      content_generation: 250,
      fact_checking: 80,
      quality_check: 60,
      style_optimization: 120,
      trending_topic: 100,
      decision_making: 100
    };
    
    return Math.min(tokens, maxTokens[operation] || 150);
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
      maxTokens,
      model = 'gpt-4o-mini',
      temperature = 0.3,
      forTweetGeneration = false,
      existingContent
    } = options;

    // 🎯 DYNAMIC TOKEN OPTIMIZATION
    const optimalTokens = maxTokens || this.calculateOptimalTokens(operationType, existingContent);
    console.log(`🎯 Dynamic tokens: ${optimalTokens} for ${operationType} ${existingContent ? `(content: ${existingContent.length} chars)` : '(no content)'}`);

    try {
      // 🗂️ CHECK CACHE FIRST (massive cost savings!)
      const cacheKey = completionCache.generateKey(messages, model, optimalTokens, temperature);
      const cached = completionCache.get(cacheKey);
      
      if (cached) {
        console.log(`💾 CACHE HIT: ${operationType} - saved $${cached.cost.toFixed(4)}`);
        return {
          success: true,
          response: cached.response,
          cost: 0 // No actual cost, using cache
        };
      }

      // Calculate estimated cost
      let estimatedCost = this.calculateEstimatedCost(optimalTokens, model);
      let actualMaxTokens = optimalTokens;

      // If this is for tweet generation, optimize using SmartBudgetOptimizer
      if (forTweetGeneration) {
        const plan = await smartBudgetOptimizer.createDailyPlan();
        const optimization = smartBudgetOptimizer.getCostOptimization(plan.budgetPerTweet);
        
        // Adjust tokens and cost based on optimization
        actualMaxTokens = Math.min(optimalTokens, optimization.maxTokensPerTweet);
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

      // 🗂️ CACHE THE RESPONSE for future use
      completionCache.set(cacheKey, response, actualCost);

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
   * 🎯 SUPREME AI PRIORITY-BASED COMPLETION
   * Enhanced with follower growth optimization
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
      model?: 'gpt-4o' | 'gpt-4o-mini';
      content_type?: 'viral' | 'educational' | 'controversial' | 'trend' | 'reply';
      target_audience?: 'health_enthusiasts' | 'general' | 'professionals';
    } = {}
  ): Promise<{ success: boolean; content?: string; error?: string; cost: number; quality_score?: number; growth_factor?: number }> {
    
    // 🧠 SUPREME AI OPTIMIZATION: Use prompt optimizer for follower growth
    let finalPrompt = prompt;
    let finalModel = options.model || 'gpt-4o-mini';
    let finalTemperature = options.temperature || 0.3;
    let finalMaxTokens = options.maxTokens || 100;
    let qualityScore = 7;
    let growthFactor = 1.0;

    // Apply supreme optimization for key operations
    const growthOperations = ['viral_content_generation', 'strategic_reply', 'engagement_optimization', 'content_generation'];
    
    if (growthOperations.includes(operationType) || options.forTweetGeneration) {
      try {
        const optimized = SupremeAIPromptOptimizer.optimizePromptForFollowerGrowth(prompt, {
          operation: operationType,
          current_followers: 500, // Default - could be dynamic
          recent_engagement: 15,  // Default - could be dynamic
          time_of_day: new Date().getHours(),
          content_type: options.content_type || 'viral',
          target_audience: options.target_audience || 'health_enthusiasts'
        });

        finalPrompt = optimized.prompt;
        finalModel = optimized.model;
        finalTemperature = optimized.temperature;
        finalMaxTokens = optimized.max_tokens;
        qualityScore = optimized.expected_quality;
        growthFactor = optimized.follower_growth_factor;

        console.log(`🧠 Supreme AI optimization applied: ${operationType} - Quality: ${qualityScore}/10, Growth Factor: ${growthFactor}x`);
      } catch (error) {
        console.warn('⚠️ Supreme optimization failed, using default prompt');
      }
    }

    const messages = [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: finalPrompt }
    ];

    const result = await this.createChatCompletion(messages, {
      priority,
      operationType,
      maxTokens: finalMaxTokens,
      temperature: finalTemperature,
      model: finalModel,
      forTweetGeneration: options.forTweetGeneration || false
    });

    if (result.success && result.response) {
      return {
        success: true,
        content: result.response.choices[0]?.message?.content || '',
        cost: result.cost,
        quality_score: qualityScore,
        growth_factor: growthFactor
      };
    }

    return {
      success: false,
      error: result.error,
      cost: result.cost,
      quality_score: qualityScore,
      growth_factor: growthFactor
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