/**
 * 🔐 SUPABASE SERVICE ROLE CLIENT
 * Bypasses RLS for writes and administrative operations
 */

import { createClient } from '@supabase/supabase-js';

export const supaService = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // must be set in prod
  { 
    auth: { persistSession: false }, 
    global: { 
      fetch 
    } 
  }
);

/**
 * Ensure API usage table exists with proper structure
 */
export async function ensureApiUsageTable() {
  try {
    const { error } = await supaService.rpc('exec_sql', {
      sql: `
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
        
        -- Permissive RLS policy for inserts (if not using service role)
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
      `
    });

    if (error) {
      console.warn('⚠️ API_USAGE_TABLE: Could not create via RPC, continuing...');
    } else {
      console.log('✅ API_USAGE_TABLE: Table and RLS ensured');
    }
  } catch (error: any) {
    console.warn('⚠️ API_USAGE_TABLE: Setup warning:', error.message);
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
