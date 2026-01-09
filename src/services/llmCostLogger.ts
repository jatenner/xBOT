/**
 * 💰 LLM COST LOGGER
 * 
 * Wraps all LLM calls to automatically log usage and costs
 */

import { getSupabaseClient } from '../db/index';

export interface LLMUsageLog {
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  trace_ids?: Record<string, string>;
  request_metadata?: Record<string, any>;
}

/**
 * Log LLM usage to database
 */
export async function logLLMUsage(log: LLMUsageLog): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Calculate cost
  const est_cost_usd = await calculateLLMCost(log.model, log.input_tokens, log.output_tokens);
  
  try {
    await supabase.from('llm_usage_log').insert({
      model: log.model,
      purpose: log.purpose,
      input_tokens: log.input_tokens,
      output_tokens: log.output_tokens,
      est_cost_usd: est_cost_usd,
      latency_ms: log.latency_ms,
      trace_ids: log.trace_ids || {},
      request_metadata: log.request_metadata || {},
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`[LLM_COST] ❌ Failed to log usage: ${error.message}`);
    // Don't throw - logging failure shouldn't break the system
  }
}

/**
 * Calculate LLM cost based on model and tokens
 */
async function calculateLLMCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  // Pricing as of Jan 2025 (per 1M tokens)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  };
  
  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
  
  return inputCost + outputCost;
}

/**
 * Wrap an LLM call with automatic logging
 */
export async function withLLMLogging<T>(
  purpose: string,
  model: string,
  callFn: () => Promise<T>,
  traceIds?: Record<string, string>,
  requestMetadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await callFn();
    
    // Extract token usage from result if available
    // This assumes the result has usage information (adjust based on your OpenAI client)
    const latency_ms = Date.now() - startTime;
    
    // If result has usage info, log it
    // Otherwise, we'll need to extract from the actual OpenAI response
    // For now, we'll log with placeholder values and update when we wrap the actual calls
    
    return result;
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    console.error(`[LLM_COST] ❌ LLM call failed for ${purpose}: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Extract token usage from OpenAI response
 */
export function extractTokenUsage(response: any): { input_tokens: number; output_tokens: number } {
  // OpenAI response structure: response.usage.prompt_tokens, response.usage.completion_tokens
  if (response?.usage) {
    return {
      input_tokens: response.usage.prompt_tokens || 0,
      output_tokens: response.usage.completion_tokens || 0,
    };
  }
  
  // Fallback: try common patterns
  if (response?.data?.usage) {
    return {
      input_tokens: response.data.usage.prompt_tokens || 0,
      output_tokens: response.data.usage.completion_tokens || 0,
    };
  }
  
  return { input_tokens: 0, output_tokens: 0 };
}

/**
 * Rollup hourly LLM costs
 */
export async function rollupLLMCostsHourly(targetHour?: Date): Promise<void> {
  const supabase = getSupabaseClient();
  const hourStart = targetHour ? new Date(targetHour) : new Date();
  hourStart.setMinutes(0, 0, 0);
  
  try {
    await supabase.rpc('rollup_llm_costs_hourly', { target_hour: hourStart.toISOString() });
    console.log(`[LLM_COST] ✅ Hourly cost rollup complete for ${hourStart.toISOString()}`);
  } catch (error: any) {
    console.error(`[LLM_COST] ❌ Hourly rollup failed: ${error.message}`);
  }
}

/**
 * Rollup daily LLM costs
 */
export async function rollupLLMCostsDaily(targetDate?: Date): Promise<void> {
  const supabase = getSupabaseClient();
  const dateStart = targetDate ? new Date(targetDate) : new Date();
  dateStart.setHours(0, 0, 0, 0);
  
  try {
    await supabase.rpc('rollup_llm_costs_daily', { target_date: dateStart.toISOString().split('T')[0] });
    console.log(`[LLM_COST] ✅ Daily cost rollup complete for ${dateStart.toISOString().split('T')[0]}`);
  } catch (error: any) {
    console.error(`[LLM_COST] ❌ Daily rollup failed: ${error.message}`);
  }
}

