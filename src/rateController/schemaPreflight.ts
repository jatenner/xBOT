/**
 * 🔒 SCHEMA PREFLIGHT CHECK
 * 
 * Fail-closed schema verification for rate controller
 * If schema is missing, sets SAFE_MODE and prevents execution
 */

import { getSupabaseClient } from '../db/index';

export interface SchemaPreflightResult {
  passed: boolean;
  missing: string[];
  errors: string[];
}

const REQUIRED_TABLES = [
  'bot_backoff_state',
  'bot_run_counters',
  'rate_controller_state',
  'strategy_weights',
  'hour_weights',
  'prompt_version_weights',
];

const REQUIRED_COLUMNS = {
  content_metadata: ['prompt_version', 'strategy_id', 'hour_bucket', 'outcome_score'],
};

const REQUIRED_RPC_FUNCTIONS = [
  'increment_budget_counter',
];

/**
 * Check if table exists
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    // If error is about table not existing, return false
    if (error) {
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('does not exist') || errorMsg.includes('relation') || errorMsg.includes('table')) {
        return false;
      }
      // Other errors (permissions, etc.) - assume table exists but we can't access it
      return true;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if column exists in table
 */
async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(1);
    
    if (error) {
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        return false;
      }
      // Other errors - assume column exists
      return true;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if RPC function exists
 */
async function checkRpcExists(functionName: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc(functionName, {
      p_date: new Date().toISOString().split('T')[0],
      p_nav_amount: 0,
      p_search_amount: 0,
    });
    
    // If error is about function not existing, return false
    if (error) {
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('function') && errorMsg.includes('does not exist')) {
        return false;
      }
      // Other errors (wrong params, etc.) - assume function exists
      return true;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Run schema preflight check
 */
export async function runSchemaPreflight(): Promise<SchemaPreflightResult> {
  const missing: string[] = [];
  const errors: string[] = [];

  console.log('[SCHEMA_PREFLIGHT] 🔒 Running schema preflight check...');

  // Check required tables
  for (const table of REQUIRED_TABLES) {
    const exists = await checkTableExists(table);
    if (!exists) {
      missing.push(`table:${table}`);
      console.error(`[SCHEMA_PREFLIGHT] ❌ Missing table: ${table}`);
    } else {
      console.log(`[SCHEMA_PREFLIGHT] ✅ Table exists: ${table}`);
    }
  }

  // Check required columns
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    for (const column of columns) {
      const exists = await checkColumnExists(table, column);
      if (!exists) {
        missing.push(`column:${table}.${column}`);
        console.error(`[SCHEMA_PREFLIGHT] ❌ Missing column: ${table}.${column}`);
      } else {
        console.log(`[SCHEMA_PREFLIGHT] ✅ Column exists: ${table}.${column}`);
      }
    }
  }

  // Check required RPC functions
  for (const rpc of REQUIRED_RPC_FUNCTIONS) {
    const exists = await checkRpcExists(rpc);
    if (!exists) {
      missing.push(`rpc:${rpc}`);
      console.error(`[SCHEMA_PREFLIGHT] ❌ Missing RPC function: ${rpc}`);
    } else {
      console.log(`[SCHEMA_PREFLIGHT] ✅ RPC function exists: ${rpc}`);
    }
  }

  const passed = missing.length === 0;

  if (!passed) {
    console.error(`[SCHEMA_PREFLIGHT] ❌ PREFLIGHT FAILED: ${missing.length} missing items`);
    console.error(`[SCHEMA_PREFLIGHT] 🛡️ SAFE_MODE ACTIVATED: Rate controller disabled`);
    
    // Set SAFE_MODE environment variable
    process.env.SAFE_MODE = 'true';
    
    // Log to system_events
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'schema_preflight_failed',
        severity: 'critical',
        message: `Schema preflight failed: ${missing.join(', ')}`,
        event_data: {
          missing_items: missing,
          required_tables: REQUIRED_TABLES,
          required_columns: REQUIRED_COLUMNS,
          required_rpc: REQUIRED_RPC_FUNCTIONS,
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // Ignore logging errors
    }
  } else {
    console.log(`[SCHEMA_PREFLIGHT] ✅ PREFLIGHT PASSED: All schema elements present`);
    process.env.SAFE_MODE = 'false';
  }

  return {
    passed,
    missing,
    errors,
  };
}

/**
 * Check if SAFE_MODE is active
 */
export function isSafeMode(): boolean {
  return process.env.SAFE_MODE === 'true';
}
