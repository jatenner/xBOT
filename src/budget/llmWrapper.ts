/**
 * LLM Wrapper with POSTING_DISABLED and Budget Guards
 * All OpenAI calls should go through this wrapper
 */

import OpenAI from 'openai';
import { checkLLMAllowed, recordLLMUsage } from './guard';

// Environment flags
const POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Safe OpenAI wrapper that respects POSTING_DISABLED and budget limits
 */
export class SafeOpenAIWrapper {
  private openai: OpenAI;
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
  }
  
  /**
   * Create chat completion with budget and posting guards
   */
  async createChatCompletion(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    context: string = 'unknown'
  ): Promise<OpenAI.Chat.Completions.ChatCompletion | null> {
    
    // GUARD 1: Check if LLM calls are allowed
    const check = await checkLLMAllowed();
    if (!check.allowed) {
      console.log(`LLM_BLOCKED: ${context} - ${check.reason}`);
      
      // Return mock response for dry run
      if (DRY_RUN) {
        return this.createMockResponse(params);
      }
      
      return null;
    }
    
    // GUARD 2: Estimate cost
    const estimatedCost = this.estimateCost(params);
    
    try {
      console.log(`LLM_CALL: ${context} (model: ${params.model}, estimated: $${estimatedCost.toFixed(4)})`);
      
      const { createBudgetedChatCompletion } = await import('../services/openaiBudgetedClient');
      const response = await createBudgetedChatCompletion(params, {
        purpose: context,
        priority: 'medium'
      });
      
      // Record actual usage
      const actualCost = this.calculateActualCost(response);
      await recordLLMUsage(actualCost, { context, model: params.model });
      
      console.log(`LLM_SUCCESS: ${context} (actual: $${actualCost.toFixed(4)})`);
      
      return response;
      
    } catch (error: any) {
      console.error(`LLM_ERROR: ${context} -`, error.message);
      throw error;
    }
  }
  
  /**
   * Legacy compatibility method for existing code
   */
  get chat() {
    return {
      completions: {
        create: (params: OpenAI.Chat.Completions.ChatCompletionCreateParams) => 
          this.createChatCompletion(params, 'legacy')
      }
    };
  }
  
  /**
   * Estimate cost based on model and token limits
   */
  private estimateCost(params: OpenAI.Chat.Completions.ChatCompletionCreateParams): number {
    const model = params.model;
    const maxTokens = params.max_tokens || 500;
    const inputLength = JSON.stringify(params.messages).length / 4; // Rough token estimate
    
    // Pricing (approximate, as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };
    
    const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // Default to mini
    
    const inputCost = (inputLength / 1000) * modelPricing.input;
    const outputCost = (maxTokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Calculate actual cost from response
   */
  private calculateActualCost(response: OpenAI.Chat.Completions.ChatCompletion): number {
    const usage = response.usage;
    if (!usage) return 0;
    
    const model = response.model;
    
    // Same pricing table as estimate
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };
    
    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
    
    const inputCost = (usage.prompt_tokens / 1000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Create mock response for dry run mode
   */
  private createMockResponse(params: OpenAI.Chat.Completions.ChatCompletionCreateParams): OpenAI.Chat.Completions.ChatCompletion {
    const mockContent = this.generateMockContent(params);
    
    return {
      id: `mock-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: params.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: mockContent
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 200,
        total_tokens: 300
      }
    };
  }
  
  /**
   * Generate mock content for dry run
   */
  private generateMockContent(params: OpenAI.Chat.Completions.ChatCompletionCreateParams): string {
    const userMessage = params.messages.find(m => m.role === 'user')?.content;
    const isThread = userMessage?.toString().toLowerCase().includes('thread') || params.max_tokens && params.max_tokens > 500;
    
    if (isThread) {
      return JSON.stringify({
        content: [
          "1/3 🧠 DRY RUN: This is a mock thread about health and wellness. Real content would be generated here with AI-driven insights and fact-based information.",
          "2/3 📊 The actual system would analyze trending topics, engagement patterns, and user preferences to create optimized content that drives follower growth.",
          "3/3 ✅ This mock demonstrates the system is working correctly while POSTING_DISABLED=true protects against unintended API usage and costs."
        ],
        viralScore: 95,
        qualityScore: 88,
        topic: "mock-health-topic"
      });
    } else {
      return "🧠 DRY RUN: Mock single post about health and wellness. Real AI-generated content would appear here with fact-based insights and engaging hooks.";
    }
  }
}

/**
 * Global instance for use throughout the application
 */
export const safeOpenAI = new SafeOpenAIWrapper();

/**
 * Legacy compatibility - replace existing OpenAI instances with this
 */
export function createSafeOpenAI(apiKey?: string): SafeOpenAIWrapper {
  return new SafeOpenAIWrapper(apiKey);
}
