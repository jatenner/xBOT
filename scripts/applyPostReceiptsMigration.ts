/**
 * Apply Post Receipts Migration
 * Uses CANONICAL pg.Client pattern with rejectUnauthorized: false
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function applyMigration() {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20251219_post_receipts.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  console.log('[MIGRATION] Applying post_receipts migration...');
  console.log(`[MIGRATION] File: ${migrationPath}`);
  
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[MIGRATION] ❌ Missing DATABASE_URL');
    process.exit(1);
  }
  
  // Extract safe connection info
  try {
    const url = new URL(DATABASE_URL);
    console.log(`[MIGRATION] Target: host=${url.hostname} dbname=${url.pathname.substring(1)}`);
  } catch (err) {
    console.error('[MIGRATION] ❌ Invalid DATABASE_URL format');
    process.exit(1);
  }
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // CANONICAL pattern for Supabase
  });
  
  try {
    await client.connect();
    console.log('[MIGRATION] ✅ Connected');
    
    // Execute migration
    await client.query(migrationSQL);
    console.log('[MIGRATION] ✅ SQL executed');
    
    // Verify table exists
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'post_receipts';
    `;
    
    const result = await client.query(verifyQuery);
    if (result.rows.length === 0) {
      throw new Error('Table post_receipts not found after migration');
    }
    
    console.log('[MIGRATION] ✅ Table post_receipts verified');
    
    // Check indexes
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'post_receipts' 
      AND schemaname = 'public';
    `;
    
    const indexes = await client.query(indexQuery);
    console.log(`[MIGRATION] ✅ Found ${indexes.rows.length} indexes:`);
    indexes.rows.forEach(row => {
      console.log(`[MIGRATION]    - ${row.indexname}`);
    });
    
    await client.end();
    console.log('\n[MIGRATION] ✅✅✅ MIGRATION COMPLETE ✅✅✅\n');
    process.exit(0);
    
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

