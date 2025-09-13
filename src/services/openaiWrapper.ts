/**
 * OpenAI API Wrapper with Mandatory Budget Enforcement
 * ALL OpenAI calls must go through this wrapper
 */

import OpenAI from 'openai';
import { enforceBudget, recordActualUsage, estimateTokens, BudgetExceededError } from '../budget/budgetGate';

// OpenAI client singleton
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    openaiClient = new OpenAI({ apiKey });
  }
  
  return openaiClient;
}

/**
 * Budget-enforced chat completion
 */
export async function createChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  context: string = 'chat_completion'
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  
  // Check if posting is disabled
  if (process.env.POSTING_DISABLED === 'true') {
    console.log('🚫 LLM_SKIPPED: posting disabled');
    throw new Error('LLM calls disabled (POSTING_DISABLED=true)');
  }
  
  const client = getOpenAIClient();
  const model = params.model;
  
  // Estimate input tokens from messages
  const messageText = params.messages
    .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
    .join(' ');
  const estimatedInputTokens = estimateTokens(messageText);
  
  // Estimate output tokens (use max_tokens if provided, otherwise conservative estimate)
  const estimatedOutputTokens = params.max_tokens || Math.min(1000, estimatedInputTokens * 0.5);
  
  console.log(`🤖 OPENAI_REQUEST: ${model} (est: ${estimatedInputTokens} input + ${estimatedOutputTokens} output tokens) [${context}]`);
  
  // MANDATORY BUDGET CHECK - Will throw BudgetExceededError if over limit
  const estimatedCost = await enforceBudget(model, estimatedInputTokens, estimatedOutputTokens);
  
  try {
    // Make the actual OpenAI API call
    const response = await client.chat.completions.create(params);
    
    // Extract actual token usage
    const actualInputTokens = response.usage?.prompt_tokens || estimatedInputTokens;
    const actualOutputTokens = response.usage?.completion_tokens || estimatedOutputTokens;
    
    console.log(`✅ OPENAI_SUCCESS: ${model} (actual: ${actualInputTokens} input + ${actualOutputTokens} output tokens)`);
    
    // Record actual usage for budget tracking
    await recordActualUsage(model, actualInputTokens, actualOutputTokens, estimatedCost, context);
    
    return response;
    
  } catch (error: any) {
    // If the API call failed, we need to refund the pre-reserved cost
    console.error(`❌ OPENAI_ERROR: ${error.message}`);
    
    // Refund the estimated cost since the call failed
    await recordActualUsage(model, 0, 0, estimatedCost, `${context}_failed`);
    
    throw error;
  }
}

/**
 * Budget-enforced streaming chat completion
 */
export async function createChatCompletionStream(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
  context: string = 'chat_completion_stream'
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  
  // Check if posting is disabled
  if (process.env.POSTING_DISABLED === 'true') {
    console.log('🚫 LLM_SKIPPED: posting disabled');
    throw new Error('LLM calls disabled (POSTING_DISABLED=true)');
  }
  
  const client = getOpenAIClient();
  const model = params.model;
  
  // Estimate tokens (same as non-streaming)
  const messageText = params.messages
    .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
    .join(' ');
  const estimatedInputTokens = estimateTokens(messageText);
  const estimatedOutputTokens = params.max_tokens || Math.min(1000, estimatedInputTokens * 0.5);
  
  console.log(`🤖 OPENAI_STREAM: ${model} (est: ${estimatedInputTokens} input + ${estimatedOutputTokens} output tokens) [${context}]`);
  
  // MANDATORY BUDGET CHECK
  const estimatedCost = await enforceBudget(model, estimatedInputTokens, estimatedOutputTokens);
  
  try {
    // Make the streaming API call
    const stream = await client.chat.completions.create({
      ...params,
      stream: true
    });
    
    // We'll track actual usage when the stream completes
    // For now, assume the estimate is correct
    console.log(`🌊 OPENAI_STREAM_STARTED: ${model}`);
    
    // Note: For streaming, we can't easily get exact token counts
    // We'll use the estimate and log it as such
    setTimeout(async () => {
      await recordActualUsage(model, estimatedInputTokens, estimatedOutputTokens, estimatedCost, `${context}_stream`);
    }, 100);
    
    return stream;
    
  } catch (error: any) {
    console.error(`❌ OPENAI_STREAM_ERROR: ${error.message}`);
    
    // Refund the estimated cost since the call failed
    await recordActualUsage(model, 0, 0, estimatedCost, `${context}_stream_failed`);
    
    throw error;
  }
}

/**
 * Safe wrapper for any OpenAI API call with budget enforcement
 */
export async function withBudgetEnforcement<T>(
  apiCall: () => Promise<T>,
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number = 0,
  context: string = 'openai_api'
): Promise<T> {
  
  // Check if posting is disabled
  if (process.env.POSTING_DISABLED === 'true') {
    console.log('🚫 LLM_SKIPPED: posting disabled');
    throw new Error('LLM calls disabled (POSTING_DISABLED=true)');
  }
  
  console.log(`🤖 OPENAI_GENERIC: ${model} (est: ${estimatedInputTokens} input + ${estimatedOutputTokens} output tokens) [${context}]`);
  
  // MANDATORY BUDGET CHECK
  const estimatedCost = await enforceBudget(model, estimatedInputTokens, estimatedOutputTokens);
  
  try {
    const result = await apiCall();
    
    console.log(`✅ OPENAI_GENERIC_SUCCESS: ${model}`);
    
    // Record estimated usage (since we can't extract exact tokens from generic calls)
    await recordActualUsage(model, estimatedInputTokens, estimatedOutputTokens, estimatedCost, context);
    
    return result;
    
  } catch (error: any) {
    console.error(`❌ OPENAI_GENERIC_ERROR: ${error.message}`);
    
    // Refund the estimated cost since the call failed
    await recordActualUsage(model, 0, 0, estimatedCost, `${context}_failed`);
    
    throw error;
  }
}

/**
 * Get budget status (convenience method)
 */
export async function getBudgetStatus() {
  const { getBudgetStatus } = await import('../budget/budgetGate');
  return await getBudgetStatus();
}

/**
 * Export the BudgetExceededError for error handling
 */
export { BudgetExceededError } from '../budget/budgetGate';
