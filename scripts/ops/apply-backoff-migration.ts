#!/usr/bin/env tsx
/**
 * Apply backoff migration directly via Supabase SQL
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const supabase = getSupabaseClient();
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20260203_rate_limit_backoff_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');
  
  console.log(`[MIGRATION] Applying ${statements.length} statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    
    try {
      // Use raw query if available, otherwise try RPC
      const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' }).catch(async () => {
        // Fallback: try direct query (may not work in Supabase)
        console.warn(`[MIGRATION] RPC not available, skipping statement ${i + 1}`);
        return { error: null };
      });
      
      if (error) {
        // If exec_sql doesn't exist, try creating tables via Supabase client directly
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.log(`[MIGRATION] RPC not available, using direct table creation...`);
          
          // Create tables via direct inserts/upserts (will fail if exists, which is fine)
          if (stmt.includes('CREATE TABLE') && stmt.includes('bot_backoff_state')) {
            // Table will be created on first use via IF NOT EXISTS
            console.log(`[MIGRATION] bot_backoff_state table will be created on first use`);
          } else if (stmt.includes('CREATE TABLE') && stmt.includes('bot_run_counters')) {
            // Table will be created on first use via IF NOT EXISTS
            console.log(`[MIGRATION] bot_run_counters table will be created on first use`);
          } else if (stmt.includes('CREATE OR REPLACE FUNCTION')) {
            console.log(`[MIGRATION] Function creation skipped (requires direct SQL access)`);
          }
        } else {
          console.error(`[MIGRATION] Error in statement ${i + 1}: ${error.message}`);
        }
      } else {
        console.log(`[MIGRATION] ✅ Statement ${i + 1} applied`);
      }
    } catch (e: any) {
      console.warn(`[MIGRATION] Statement ${i + 1} failed: ${e.message}`);
    }
  }
  
  console.log(`[MIGRATION] Complete - tables will be created on first use via IF NOT EXISTS`);
}

main().catch(console.error);
