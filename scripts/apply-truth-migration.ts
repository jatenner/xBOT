/**
 * Apply Truth Integrity Schema Migration
 * Uses direct pg client to apply migration reliably
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

async function applyMigration() {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20251219_truth_integrity_schema.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  console.log('[MIGRATION] Applying truth integrity schema migration...');
  console.log(`[MIGRATION] File: ${migrationPath}`);
  
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('[MIGRATION] Connected to database');
    
    // Execute migration
    await client.query(migrationSQL);
    console.log('[MIGRATION] ✅ Migration applied successfully');
    
    // Verify columns exist
    const verifyQuery = `
      SELECT 
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'system_events' AND column_name = 'component') as component_exists,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'system_events' AND column_name = 'message') as message_exists,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'system_events' AND column_name = 'timestamp') as timestamp_exists,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'content_metadata' AND column_name = 'reconciled_at') as reconciled_at_exists;
    `;
    
    const result = await client.query(verifyQuery);
    const row = result.rows[0];
    
    console.log('\n[MIGRATION] Verification:');
    console.log(`  system_events.component: ${row.component_exists > 0 ? '✅' : '❌'}`);
    console.log(`  system_events.message: ${row.message_exists > 0 ? '✅' : '❌'}`);
    console.log(`  system_events.timestamp: ${row.timestamp_exists > 0 ? '✅' : '❌'}`);
    console.log(`  content_metadata.reconciled_at: ${row.reconciled_at_exists > 0 ? '✅' : '❌'}`);
    
    await client.end();
    
    if (row.component_exists > 0 && row.message_exists > 0 && row.timestamp_exists > 0) {
      console.log('\n[MIGRATION] ✅ All required columns exist');
      process.exit(0);
    } else {
      console.error('\n[MIGRATION] ❌ Some columns missing');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('[MIGRATION] ❌ Failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    await client.end().catch(() => {});
    process.exit(1);
  }
}

applyMigration();
