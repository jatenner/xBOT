/**
 * 🚨 BUDGET-AWARE OPENAI CLIENT
 * 
 * Intercepts all OpenAI API calls and enforces strict budget limits.
 * All AI operations must go through this wrapper to ensure budget compliance.
 */

import { OpenAI } from 'openai';
import { budgetEnforcer, BudgetPriority } from './budgetEnforcer';

export interface BudgetAwareRequestOptions {
  priority: BudgetPriority;
  operationType: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

export class BudgetAwareOpenAI {
  private openai: OpenAI;
  private readonly COST_PER_1K_TOKENS = 0.00000015; // gpt-4o-mini cost

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
      temperature = 0.3
    } = options;

    try {
      // Calculate estimated cost
      const estimatedCost = this.calculateEstimatedCost(maxTokens, model);
      
      // Check budget before making the call
      const budgetCheck = await budgetEnforcer.canAffordOperation(
        estimatedCost,
        priority,
        operationType
      );

      if (!budgetCheck.canAfford) {
        console.warn(`🚨 BUDGET DENIED: ${operationType} - ${budgetCheck.reason}`);
        return {
          success: false,
          error: `Budget limit exceeded: ${budgetCheck.reason}`,
          cost: 0
        };
      }

      // Make the API call
      console.log(`🤖 AI CALL: ${operationType} (${priority}) - estimated $${estimatedCost.toFixed(4)}`);
      
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      });

      // Calculate actual cost based on usage
      const actualTokens = response.usage?.total_tokens || maxTokens;
      const actualCost = this.calculateActualCost(actualTokens, model);

      // Record the spending
      await budgetEnforcer.recordSpending(
        actualCost,
        operationType,
        priority,
        `${actualTokens} tokens`
      );

      return {
        success: true,
        response,
        cost: actualCost
      };

    } catch (error: any) {
      console.error(`❌ AI CALL FAILED: ${operationType} -`, error.message);
      return {
        success: false,
        error: error.message,
        cost: 0
      };
    }
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
      temperature: options.temperature || 0.3
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