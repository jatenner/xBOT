/**
 * 🔐 SUPABASE SERVICE ROLE CLIENT
 * Bypasses RLS for writes and administrative operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supaService = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // must be set in prod
  { 
    auth: { persistSession: false }, 
    global: { 
      fetch 
    } 
  }
) as SupabaseClient<any, any, any>;

/**
 * Ensure API usage table exists with proper structure
 */
export async function ensureApiUsageTable() {
  try {
    console.log('🔧 API_USAGE_TABLE: Creating table with direct SQL...');
    
    // Use direct SQL insert to create table (service role bypasses RLS)
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS public.api_usage (
        id bigserial PRIMARY KEY,
        occurred_at timestamptz DEFAULT now(),
        intent text NOT NULL,
        model text NOT NULL,
        tokens_prompt int NOT NULL,
        tokens_completion int NOT NULL,
        usd numeric(10,4) NOT NULL
      );
      
      ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
      
      -- Permissive RLS policy for inserts (fallback for non-service-role)
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE polname = 'api_usage_insert'
        ) THEN
          CREATE POLICY api_usage_insert
            ON public.api_usage
            FOR INSERT TO anon, authenticated
            WITH CHECK (true);
        END IF;
      END $$;
    `;

    // Try with rpc first
    const { error: rpcError } = await supaService.rpc('exec_sql', { sql: createTableSql });
    
    if (rpcError) {
      console.warn('⚠️ API_USAGE_TABLE: RPC failed, trying direct insert test...');
      
      // Skip test insert in production to avoid budget pollution
      if (process.env.APP_ENV === 'production') {
        console.log('✅ API_USAGE_TABLE: Skipping test insert in production (budget protection)');
        return;
      }
      
      // Test direct insert to see if table exists (dev/staging only)
      const { error: testError } = await supaService
        .from('api_usage')
        .insert([{
          intent: 'test',
          model: 'test-model',
          tokens_prompt: 1,
          tokens_completion: 1,
          usd: 0.0001
        }])
        .select()
        .single();
      
      if (testError) {
        console.error('❌ API_USAGE_TABLE: Test insert failed:', {
          message: testError.message,
          details: testError.details,
          hint: testError.hint,
          code: testError.code
        });
      } else {
        console.log('✅ API_USAGE_TABLE: Test insert successful - table exists and writable');
        
        // Clean up test record
        await supaService.from('api_usage').delete().eq('intent', 'test');
      }
    } else {
      console.log('✅ API_USAGE_TABLE: Table and RLS ensured via RPC');
    }
  } catch (error: any) {
    console.error('❌ API_USAGE_TABLE: Setup failed:', error.message);
  }
}

/**
 * Insert API usage record with service role
 */
export async function insertApiUsage(record: {
  intent: string;
  model: string;
  tokens_prompt: number;
  tokens_completion: number;
  usd: number;
}) {
  try {
    const { data, error } = await supaService
      .from('api_usage')
      .insert([{
        occurred_at: new Date().toISOString(),
        intent: record.intent,
        model: record.model,
        tokens_prompt: record.tokens_prompt,
        tokens_completion: record.tokens_completion,
        usd: record.usd
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ API_USAGE_INSERT_FAILED:', {
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { success: false, error: error.message };
    }

    console.log(`💾 API_USAGE_LOGGED: ${record.intent} ${record.model} $${record.usd.toFixed(4)}`);
    return { success: true, data };
  } catch (error: any) {
    console.error('❌ API_USAGE_INSERT_ERROR:', error.message);
    return { success: false, error: error.message };
  }
}
