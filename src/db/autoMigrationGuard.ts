/**
 * 🛡️ AUTO-MIGRATION GUARD WITH AUTO-APPLY
 * Ensures required schema columns exist, auto-applies if missing (NO MANUAL SQL)
 */

import { getSupabaseClient } from './index';

interface SchemaCheckResult {
  allPresent: boolean;
  missingColumns: string[];
  action: 'none' | 'auto_apply' | 'degraded';
  reason: string;
  autoApplySuccess?: boolean;
}

const REQUIRED_COLUMNS = {
  content_generation_metadata_comprehensive: [
    { name: 'root_tweet_id', type: 'TEXT' },
    { name: 'original_candidate_tweet_id', type: 'TEXT' },
    { name: 'resolved_via_root', type: 'BOOLEAN DEFAULT FALSE' },
  ],
  reply_opportunities: [
    { name: 'is_root_tweet', type: 'BOOLEAN DEFAULT TRUE' },
    { name: 'root_tweet_id', type: 'TEXT' },
  ],
};

/**
 * Check if a column exists by attempting to select it
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  try {
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(1);
    
    if (error) {
      // Check if error message indicates missing column
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        return false;
      }
      // Other errors - assume column exists
      return true;
    }
    
    return true;
  } catch (err: any) {
    // Assume missing on errors
    return false;
  }
}

/**
 * Auto-apply missing columns using raw SQL
 */
async function autoApplyMissingColumns(
  tableName: string,
  missingColumns: Array<{ name: string; type: string }>
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  try {
    console.log(`[SCHEMA] 🔧 Auto-applying ${missingColumns.length} missing columns to ${tableName}...`);
    
    // Build ALTER TABLE statements (idempotent with IF NOT EXISTS)
    const statements: string[] = [];
    
    for (const col of missingColumns) {
      statements.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`);
    }
    
    // Execute each statement individually for better error handling
    for (const stmt of statements) {
      console.log(`[SCHEMA] Executing: ${stmt}`);
      
      // Use Supabase's rpc if available, otherwise try direct query
      try {
        // Try using the sql RPC function (if enabled in Supabase)
        const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
        
        if (error) {
          console.warn(`[SCHEMA] ⚠️ RPC failed for statement, trying alternative...`);
          
          // Alternative: Use the REST API directly with raw SQL
          // This requires the postgrest endpoint to allow raw SQL
          // For now, we'll log and continue
          console.warn(`[SCHEMA] ⚠️ Could not auto-apply: ${stmt}`);
          console.warn(`[SCHEMA] ⚠️ Error: ${error.message}`);
          return false;
        }
      } catch (stmtError: any) {
        console.error(`[SCHEMA] ❌ Failed to execute statement: ${stmt}`);
        console.error(`[SCHEMA] Error: ${stmtError.message}`);
        return false;
      }
    }
    
    console.log(`[SCHEMA] ✅ Auto-applied ${missingColumns.length} columns successfully`);
    return true;
  } catch (error: any) {
    console.error(`[SCHEMA] ❌ Auto-apply failed:`, error.message);
    return false;
  }
}

/**
 * Main schema guard - checks and auto-applies missing columns
 */
export async function ensureReplySchemaColumnsWithAutoApply(): Promise<SchemaCheckResult> {
  console.log('[SCHEMA] 🔍 Checking required reply schema columns...');
  
  try {
    const allMissing: Array<{ table: string; column: { name: string; type: string } }> = [];
    
    // Check all tables
    for (const [tableName, columns] of Object.entries(REQUIRED_COLUMNS)) {
      for (const col of columns) {
        const exists = await columnExists(tableName, col.name);
        
        if (!exists) {
          allMissing.push({ table: tableName, column: col });
          console.log(`[SCHEMA] ⚠️ Missing: ${tableName}.${col.name}`);
        }
      }
    }
    
    if (allMissing.length === 0) {
      console.log('[SCHEMA] ✅ All required columns present');
      return {
        allPresent: true,
        missingColumns: [],
        action: 'none',
        reason: 'all columns present',
      };
    }
    
    console.log(`[SCHEMA] ⚠️ Found ${allMissing.length} missing columns`);
    console.log('[SCHEMA] 🔧 Attempting auto-apply via direct PostgreSQL connection...');
    
    // Try direct migration apply
    const { applyReplySchemaColumnsDirectly } = await import('./applyMigrationDirect');
    const applyResult = await applyReplySchemaColumnsDirectly();
    
    if (applyResult.success) {
      console.log('[SCHEMA] ✅ Migration applied successfully, re-checking...');
      
      // Re-check to confirm
      const recheckMissing: string[] = [];
      for (const [tableName, columns] of Object.entries(REQUIRED_COLUMNS)) {
        for (const col of columns) {
          const exists = await columnExists(tableName, col.name);
          if (!exists) {
            recheckMissing.push(`${tableName}.${col.name}`);
          }
        }
      }
      
      if (recheckMissing.length === 0) {
        console.log('[SCHEMA] ✅ All columns now present after auto-apply');
        return {
          allPresent: true,
          missingColumns: [],
          action: 'auto_apply',
          reason: 'auto-applied successfully via direct connection',
          autoApplySuccess: true,
        };
      } else {
        console.warn('[SCHEMA] ⚠️ Some columns still missing after auto-apply:', recheckMissing.join(', '));
        return {
          allPresent: false,
          missingColumns: recheckMissing,
          action: 'degraded',
          reason: 'auto-apply incomplete',
          autoApplySuccess: false,
        };
      }
    } else {
      console.error(`[SCHEMA] ❌ Auto-apply failed: ${applyResult.error}`);
      return {
        allPresent: false,
        missingColumns: allMissing.map(m => `${m.table}.${m.column.name}`),
        action: 'degraded',
        reason: `auto-apply failed: ${applyResult.error}`,
        autoApplySuccess: false,
      };
    }
  } catch (error: any) {
    console.error('[SCHEMA] ❌ Schema check failed:', error.message);
    return {
      allPresent: false,
      missingColumns: [],
      action: 'degraded',
      reason: `check failed: ${error.message}`,
    };
  }
}

// Keep old function for backwards compatibility
export async function ensureReplySchemaColumns(): Promise<SchemaCheckResult> {
  return ensureReplySchemaColumnsWithAutoApply();
}
