/**
 * 🔐 SUPABASE SERVICE ROLE CLIENT
 * Dedicated service role client for database writes that bypass RLS
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseService: SupabaseClient | null = null;
let supabaseAnon: SupabaseClient | null = null;

/**
 * Get service role client (bypasses RLS)
 */
export function getSupabaseService(): SupabaseClient {
  if (!supabaseService) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !serviceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    
    supabaseService = createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: { fetch }
    });
    
    console.log('✅ SUPABASE_SERVICE: Service role client initialized');
  }
  
  return supabaseService;
}

/**
 * Get anon client (respects RLS)
 */
export function getSupabaseAnon(): SupabaseClient {
  if (!supabaseAnon) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !anonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }
    
    supabaseAnon = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: { fetch }
    });
    
    console.log('✅ SUPABASE_ANON: Anonymous client initialized');
  }
  
  return supabaseAnon;
}

/**
 * Insert API usage record with detailed error logging
 */
export async function insertApiUsage(record: {
  intent: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  meta?: Record<string, any>;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const service = getSupabaseService();
    
    const insertData = {
      created_at: new Date().toISOString(),
      intent: record.intent,
      model: record.model,
      prompt_tokens: record.prompt_tokens,
      completion_tokens: record.completion_tokens,
      total_tokens: record.prompt_tokens + record.completion_tokens,
      cost_usd: record.cost_usd,
      meta: record.meta || {}
    };
    
    const { data, error } = await service
      .from('api_usage')
      .insert([insertData])
      .select()
      .single();
    
    if (error) {
      console.error('API_USAGE_INSERT_FAILED', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        insertData
      });
      return { success: false, error: error.message };
    }
    
    console.log(`💾 API_USAGE_LOGGED: ${record.intent} ${record.model} $${record.cost_usd.toFixed(6)} (id: ${data.id})`);
    return { success: true, data };
    
  } catch (error: any) {
    console.error('API_USAGE_INSERT_ERROR:', {
      message: error.message,
      stack: error.stack?.substring(0, 200)
    });
    return { success: false, error: error.message };
  }
}

/**
 * Test database connectivity
 */
export async function testDatabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const service = getSupabaseService();
    
    // Test insert
    const testData = {
      intent: 'test_connection',
      model: 'test-model',
      prompt_tokens: 1,
      completion_tokens: 1,
      cost_usd: 0.000001,
      meta: { test: true }
    };
    
    const { data, error } = await service
      .from('api_usage')
      .insert([testData])
      .select()
      .single();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Clean up test record
    await service.from('api_usage').delete().eq('id', data.id);
    
    console.log('✅ DATABASE_TEST: Connection successful');
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ DATABASE_TEST: Connection failed:', error.message);
    return { success: false, error: error.message };
  }
}
