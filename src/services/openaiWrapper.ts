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
import { isLLMAllowed } from '../config/envFlags';

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
  
  // Check AI quota circuit breaker (primary LLM control)
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`🚫 LLM_BLOCKED: ${llmCheck.reason}`);
    throw new Error(`LLM calls blocked: ${llmCheck.reason}`);
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
  
  // Check AI quota circuit breaker
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`🚫 LLM_BLOCKED: ${llmCheck.reason}`);
    throw new Error(`LLM calls blocked: ${llmCheck.reason}`);
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
  
  // Check AI quota circuit breaker
  const llmCheck = isLLMAllowed();
  if (!llmCheck.allowed) {
    console.log(`🚫 LLM_BLOCKED: ${llmCheck.reason}`);
    throw new Error(`LLM calls blocked: ${llmCheck.reason}`);
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