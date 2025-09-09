/**
 * 🎯 OPENAI COST TRACKER
 * Logs every OpenAI call to Supabase with RPC-first, direct insert fallback
 */

import { createClient } from '@supabase/supabase-js';

const COST_LOGGING_ENABLED = (process.env.COST_LOGGING_ENABLED ?? 'true') === 'true';
const COST_LOG_TABLE = process.env.COST_LOG_TABLE ?? 'openai_usage_log';
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA ?? 'public';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OpenAIUsageLog {
  model: string;
  cost_tier?: string;
  intent?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  request_id?: string;
  finish_reason?: string;
  raw?: any;
}

/**
 * 💰 LOG OPENAI COST - RPC first, direct insert fallback
 */
export async function logOpenAiCost(usage: OpenAIUsageLog): Promise<void> {
  if (!COST_LOGGING_ENABLED) {
    console.log('💰 COST_LOG: disabled by COST_LOGGING_ENABLED=false');
    return;
  }

  // Validate required fields
  if (!usage.model || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
    console.warn('💰 COST_LOG: Invalid usage data, skipping', {
      model: usage.model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens
    });
    return;
  }

  const payload = {
    model: usage.model,
    cost_tier: usage.cost_tier ?? null,
    intent: usage.intent ?? null,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    cost_usd: usage.cost_usd,
    request_id: usage.request_id ?? null,
    finish_reason: usage.finish_reason ?? null,
    raw: usage.raw ? truncateRaw(usage.raw) : null
  };

  try {
    // Try RPC first
    const { data, error } = await supabase.rpc('log_openai_usage', {
      p_completion_tokens: payload.completion_tokens,
      p_cost_tier: payload.cost_tier,
      p_cost_usd: payload.cost_usd,
      p_finish_reason: payload.finish_reason,
      p_intent: payload.intent,
      p_model: payload.model,
      p_prompt_tokens: payload.prompt_tokens,
      p_raw: payload.raw,
      p_request_id: payload.request_id,
      p_total_tokens: payload.total_tokens
    });

    if (error) throw error;
    console.log('💰 COST_LOG_OK rpc', { model: payload.model, cost: payload.cost_usd });
    return;

  } catch (rpcError: any) {
    const errorMsg = normalizeError(rpcError);
    const isFunctionMissing = errorMsg.includes('function not found') || 
                             errorMsg.includes('does not exist') ||
                             errorMsg.includes('schema cache');

    if (isFunctionMissing) {
      console.log('💰 COST_LOG: RPC not found, trying direct insert');
    } else {
      console.error('💰 COST_LOG: RPC failed', errorMsg);
    }

    // Fallback: direct table insert
    try {
      const { data, error } = await supabase
        .from(COST_LOG_TABLE)
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        console.error('💰 COST_LOG: Direct insert failed', normalizeError(error));
        return;
      }

      console.log('💰 COST_LOG_OK insert', { id: data?.id, model: payload.model, cost: payload.cost_usd });

    } catch (insertError: any) {
      console.error('💰 COST_LOG: Both RPC and direct insert failed', normalizeError(insertError));
    }
  }
}

/**
 * 🛡️ NORMALIZE ERROR - Never print [object Object]
 */
function normalizeError(error: any): string {
  if (!error) return 'Unknown error';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return `${error.message}${error.code ? ` (${error.code})` : ''}`;
  
  // Safe stringify with truncation
  try {
    const str = JSON.stringify(error, null, 2);
    return str.length > 500 ? str.slice(0, 500) + '...' : str;
  } catch {
    return String(error);
  }
}

/**
 * 🗜️ TRUNCATE RAW - Keep under 8KB
 */
function truncateRaw(raw: any): any {
  try {
    const str = JSON.stringify(raw);
    if (str.length <= 8192) return raw;
    
    return {
      ...raw,
      _truncated: true,
      _original_size: str.length
    };
  } catch {
    return { _error: 'Failed to serialize raw data' };
  }
}
