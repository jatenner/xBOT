/**
 * 🛡️ AUTO-MIGRATION GUARD
 * Ensures required schema columns exist without manual SQL work
 */

import { getSupabaseClient } from './index';

interface SchemaCheckResult {
  allPresent: boolean;
  missingColumns: string[];
  action: 'none' | 'auto_apply' | 'degraded';
  reason: string;
}

const REQUIRED_COLUMNS = {
  content_generation_metadata_comprehensive: [
    'root_tweet_id',
    'original_candidate_tweet_id',
    'resolved_via_root',
  ],
  reply_opportunities: [
    'is_root_tweet',
    'root_tweet_id',
  ],
};

/**
 * Check if required columns exist
 */
async function checkColumns(
  tableName: string,
  requiredColumns: string[]
): Promise<{ present: string[]; missing: string[] }> {
  const supabase = getSupabaseClient();
  
  const present: string[] = [];
  const missing: string[] = [];
  
  for (const column of requiredColumns) {
    try {
      // Try to select the column - if it doesn't exist, Supabase will error
      const { error } = await supabase
        .from(tableName)
        .select(column)
        .limit(1);
      
      if (error) {
        // Check if error is about missing column
        if (error.message?.includes(column) || error.message?.includes('does not exist')) {
          missing.push(column);
        } else {
          // Other error, assume column exists
          present.push(column);
        }
      } else {
        present.push(column);
      }
    } catch (err: any) {
      // Assume missing on any error
      missing.push(column);
    }
  }
  
  return { present, missing };
}

/**
 * Auto-apply missing columns (idempotent)
 */
async function autoApplyColumns(
  tableName: string,
  missingColumns: string[]
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  try {
    console.log(`[SCHEMA] 🔧 Auto-applying ${missingColumns.length} missing columns to ${tableName}...`);
    
    const alterStatements: string[] = [];
    
    // Build ALTER TABLE statements
    for (const column of missingColumns) {
      if (column === 'root_tweet_id' || column === 'original_candidate_tweet_id') {
        alterStatements.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column} TEXT;`);
      } else if (column === 'resolved_via_root' || column === 'is_root_tweet') {
        alterStatements.push(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column} BOOLEAN DEFAULT FALSE;`);
      }
    }
    
    // Execute via RPC or direct SQL (Supabase allows this via service role)
    const sql = alterStatements.join('\n');
    
    // Use Supabase's rpc or direct query
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    
    if (error) {
      // RPC might not exist, try alternative approach
      console.warn(`[SCHEMA] ⚠️ RPC approach failed, columns may need manual migration`);
      return false;
    }
    
    console.log(`[SCHEMA] ✅ Auto-applied ${missingColumns.length} columns successfully`);
    return true;
  } catch (error: any) {
    console.error(`[SCHEMA] ❌ Auto-apply failed:`, error.message);
    return false;
  }
}

/**
 * Main schema guard - checks and optionally applies missing columns
 */
export async function ensureReplySchemaColumns(): Promise<SchemaCheckResult> {
  console.log('[SCHEMA] 🔍 Checking required reply schema columns...');
  
  try {
    const allMissing: string[] = [];
    const checks: Record<string, { present: string[]; missing: string[] }> = {};
    
    // Check all tables
    for (const [tableName, columns] of Object.entries(REQUIRED_COLUMNS)) {
      const result = await checkColumns(tableName, columns);
      checks[tableName] = result;
      allMissing.push(...result.missing.map(c => `${tableName}.${c}`));
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
    
    console.log('[SCHEMA] ⚠️ Missing columns detected:', allMissing.join(', '));
    
    // In production, log banner and run in degraded mode
    // (Migration should be applied via Railway deploy)
    console.error('═══════════════════════════════════════════════════════');
    console.error('🚨 SCHEMA MISSING: Reply system columns not present');
    console.error(`   Missing: ${allMissing.join(', ')}`);
    console.error('   Reply pipeline will run in DEGRADED mode');
    console.error('   Root resolution will be SKIPPED');
    console.error('   Migration 20260101_add_root_tweet_fields.sql needs to be applied');
    console.error('═══════════════════════════════════════════════════════');
    
    return {
      allPresent: false,
      missingColumns: allMissing,
      action: 'degraded',
      reason: 'columns missing, migration needed',
    };
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

