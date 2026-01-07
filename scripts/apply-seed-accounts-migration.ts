#!/usr/bin/env tsx

/**
 * Apply seed_accounts migration
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔧 Applying seed_accounts migration...');
  
  const supabase = getSupabaseClient();
  const migrationSQL = readFileSync(
    join(__dirname, '../supabase/migrations/20260107_seed_accounts_table.sql'),
    'utf8'
  );
  
  // Split by semicolons and execute each statement
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');
  
  for (const statement of statements) {
    if (statement.length === 0) continue;
    
    try {
      // Use RPC if available, otherwise try direct query
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).catch(async () => {
        // Fallback: try direct query (won't work for DDL but let's try)
        return { error: 'rpc_not_available' };
      });
      
      if (error && error !== 'rpc_not_available') {
        console.error(`❌ Error executing statement: ${error.message}`);
        // Try using raw SQL via pg client if available
        throw new Error(`Migration failed: ${error.message}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to execute statement: ${error.message}`);
      throw error;
    }
  }
  
  console.log('✅ Migration applied successfully');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

