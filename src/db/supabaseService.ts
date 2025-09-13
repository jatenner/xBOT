/**
 * Supabase Service - Service role client for secure database operations
 * Bypasses RLS and provides detailed error logging
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface ApiUsageRecord {
  intent: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  meta?: Record<string, any>;
}

interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
}

let supaService: SupabaseClient | null = null;

/**
 * Initialize service role client (bypasses RLS)
 */
function getServiceClient(): SupabaseClient {
  if (!supaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    
    supaService = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'x-connection-source': 'service-role-client'
        }
      }
    });
    
    console.log('✅ SUPABASE_SERVICE: Service role client initialized');
  }
  
  return supaService;
}

/**
 * Ensure api_usage table exists with proper schema
 */
export async function ensureApiUsageTable(): Promise<DatabaseResult> {
  try {
    const client = getServiceClient();
    
    // Test if table exists by attempting a simple query
    const { error: testError } = await client
      .from('api_usage')
      .select('id')
      .limit(1);
    
    if (testError && testError.code === 'PGRST116') {
      // Table doesn't exist, create it
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.api_usage (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          intent TEXT NOT NULL,
          model TEXT NOT NULL,
          prompt_tokens INTEGER DEFAULT 0,
          completion_tokens INTEGER DEFAULT 0,
          total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
          cost_usd DECIMAL(10,6) NOT NULL,
          meta JSONB DEFAULT '{}'::jsonb
        );
        
        -- Set table owner
        ALTER TABLE public.api_usage OWNER TO postgres;
        
        -- Enable RLS
        ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
        
        -- Create permissive policy for authenticated users (service role bypasses this)
        DROP POLICY IF EXISTS "insert_api_usage" ON public.api_usage;
        CREATE POLICY "insert_api_usage" ON public.api_usage
          FOR INSERT TO authenticated WITH CHECK (true);
      `;
      
      const { error: createError } = await client.rpc('exec_sql', { 
        sql: createTableSQL 
      });
      
      if (createError) {
        console.error('❌ TABLE_CREATE_FAILED:', createError);
        return { 
          success: false, 
          error: 'Failed to create api_usage table',
          details: createError
        };
      }
      
      console.log('✅ API_USAGE_TABLE: Created successfully');
    }
    
    // Test insert to verify table works
    const testRecord: ApiUsageRecord = {
      intent: 'table_health_check',
      model: 'test',
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: 0,
      meta: { test: true, timestamp: new Date().toISOString() }
    };
    
    const { data, error: insertError } = await client
      .from('api_usage')
      .insert(testRecord)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ TABLE_TEST_INSERT_FAILED:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return {
        success: false,
        error: 'Table test insert failed',
        details: {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        }
      };
    }
    
    // Clean up test record
    await client
      .from('api_usage')
      .delete()
      .eq('id', data.id);
    
    console.log('✅ API_USAGE_TABLE: Test insert successful');
    return { success: true, data: 'Table ready' };
    
  } catch (error: any) {
    console.error('❌ ENSURE_TABLE_ERROR:', error.message);
    return {
      success: false,
      error: error.message,
      details: { message: error.message }
    };
  }
}

/**
 * Insert API usage record with detailed error handling
 */
export async function insertApiUsage(record: ApiUsageRecord): Promise<DatabaseResult> {
  try {
    const client = getServiceClient();
    
    const { data, error } = await client
      .from('api_usage')
      .insert(record)
      .select()
      .single();
    
    if (error) {
      console.error('❌ API_USAGE_INSERT_FAILED:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        record_intent: record.intent
      });
      
      return {
        success: false,
        error: 'Database insert failed',
        details: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        }
      };
    }
    
    console.log(`📊 API_USAGE_LOGGED: ${record.intent} $${record.cost_usd.toFixed(4)}`);
    return { success: true, data };
    
  } catch (error: any) {
    console.error('❌ INSERT_API_USAGE_ERROR:', error.message);
    return {
      success: false,
      error: error.message,
      details: { message: error.message }
    };
  }
}

/**
 * Test database connection and table functionality
 */
export async function testDatabaseConnection(): Promise<DatabaseResult> {
  try {
    // First ensure table exists
    const tableResult = await ensureApiUsageTable();
    if (!tableResult.success) {
      return tableResult;
    }
    
    // Test actual insert/delete cycle (skip in production to avoid budget pollution)
    if (process.env.APP_ENV === 'production') {
      return { success: true };
    }
    
    const testRecord: ApiUsageRecord = {
      intent: 'connection_test',
      model: 'test_model',
      prompt_tokens: 10,
      completion_tokens: 5,
      cost_usd: 0.001,
      meta: { 
        test: true, 
        timestamp: new Date().toISOString(),
        connection_test: true
      }
    };
    
    const insertResult = await insertApiUsage(testRecord);
    if (!insertResult.success) {
      return insertResult;
    }
    
    // Clean up test record
    const client = getServiceClient();
    await client
      .from('api_usage')
      .delete()
      .eq('id', insertResult.data.id);
    
    return { 
      success: true, 
      data: 'Service role client and api_usage table working correctly' 
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      details: { message: error.message }
    };
  }
}

export { supaService };