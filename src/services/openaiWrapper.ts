/**
 * OpenAI Wrapper - DEPRECATED
 * This file provides backward compatibility only
 * ALL new code should use src/services/openaiBudgetedClient.ts
 */

import OpenAI from 'openai';
import { 
  createBudgetedChatCompletion, 
  createBudgetedChatCompletionStream,
  BudgetExceededError 
} from './openaiBudgetedClient';

// Re-export for compatibility
export { BudgetExceededError };

/**
 * @deprecated Use createBudgetedChatCompletion from openaiBudgetedClient instead
 */
export async function createChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  context: string = 'chat_completion'
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  console.warn('⚠️ DEPRECATED: createChatCompletion() - use openaiBudgetedClient instead');
  
  // LLM generation is now decoupled from posting - budget flags control LLM, not POSTING_DISABLED
  // Shadow logging for visibility
  if (process.env.POSTING_DISABLED === 'true') {
    const { calculateTokenCost, estimateTokenCount } = await import('../config/openai/pricing');
    const messageText = params.messages
      .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
      .join(' ');
    const estimatedInputTokens = estimateTokenCount(messageText);
    const estimatedOutputTokens = params.max_tokens || 1000;
    const estimatedCost = calculateTokenCost(params.model || 'gpt-4o-mini', estimatedInputTokens, estimatedOutputTokens);
    
    console.log(`🕵️ BUDGET_SHADOW: calling model=${params.model || 'gpt-4o-mini'} est_tokens=${estimatedInputTokens + estimatedOutputTokens} cost=$${estimatedCost.toFixed(4)} [${context}] (posting disabled but LLM enabled)`);
  }
  
  // Use new budgeted client
  return createBudgetedChatCompletion(params, {
    purpose: context,
    requestId: `legacy_${Date.now()}`
  });
}

/**
 * @deprecated Use createBudgetedChatCompletionStream from openaiBudgetedClient instead
 */
export async function createChatCompletionStream(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  context: string = 'chat_completion_stream'
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  console.warn('⚠️ DEPRECATED: createChatCompletionStream() - use openaiBudgetedClient instead');
  
  // LLM generation is now decoupled from posting - budget flags control LLM, not POSTING_DISABLED
  if (process.env.POSTING_DISABLED === 'true') {
    console.log('🕵️ LLM_ENABLED: posting disabled but LLM generation allowed for queue building');
  }
  
  // Use new budgeted client
  return createBudgetedChatCompletionStream(params, {
    purpose: context,
    requestId: `legacy_stream_${Date.now()}`
  });
}

/**
 * @deprecated Legacy function - no longer used
 */
export async function withBudgetEnforcement<T>(
  operation: () => Promise<T>,
  context: string = 'unknown'
): Promise<T> {
  console.warn('⚠️ DEPRECATED: withBudgetEnforcement() - use openaiBudgetedClient.withBudgetGuard instead');
  
  // LLM generation is now decoupled from posting
  if (process.env.POSTING_DISABLED === 'true') {
    console.log('🕵️ LLM_ENABLED: posting disabled but LLM generation allowed');
  }
  
  return operation();
}

/**
 * @deprecated Legacy token estimation - use pricing.ts instead
 */
export function estimateTokens(text: string): number {
  const { estimateTokenCount } = require('../config/openai/pricing');
  return estimateTokenCount(text);
}