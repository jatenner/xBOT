#!/usr/bin/env tsx
/**
 * Apply accessibility_status migration to live database
 * Uses direct PostgreSQL connection for DDL operations
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL not set');
  }
  
  // 1. Identify database (without leaking secrets)
  try {
    const url = new URL(dbUrl);
    const host = url.hostname;
    const dbname = url.pathname.replace('/', '') || 'postgres';
    console.log(`[MIGRATION] Connecting to database: host=${host} dbname=${dbname}`);
  } catch (e) {
    console.log(`[MIGRATION] DATABASE_URL format: ${dbUrl.substring(0, 30)}...`);
  }
  
  // 2. Read migration file
  const migrationPath = path.join(__dirname, '../../supabase/migrations/20260129_add_accessibility_status.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`[MIGRATION] Read migration file: ${migrationPath} (${migrationSql.length} bytes)`);
  
  // 3. Connect to PostgreSQL directly
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false, // Supabase uses self-signed certs
    },
  });
  
  try {
    await client.connect();
    console.log('[MIGRATION] ✅ Connected to PostgreSQL');
    
    // 4. Check existing columns
    console.log('\n[MIGRATION] Checking existing columns...');
    const { rows: existingColumns } = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'reply_opportunities'
      AND column_name IN ('accessibility_status', 'accessibility_checked_at', 'accessibility_reason', 'discovery_source')
      ORDER BY column_name;
    `);
    
    const existingNames = existingColumns.map((r: any) => r.column_name);
    const requiredColumns = ['accessibility_status', 'accessibility_checked_at', 'accessibility_reason', 'discovery_source'];
    const missingColumns = requiredColumns.filter(c => !existingNames.includes(c));
    
    if (existingColumns.length > 0) {
      console.log(`[MIGRATION] Found ${existingColumns.length} existing columns: ${existingNames.join(', ')}`);
    }
    if (missingColumns.length > 0) {
      console.log(`[MIGRATION] Missing columns: ${missingColumns.join(', ')}`);
    }
    
    // 5. Apply migration
    if (missingColumns.length > 0 || existingColumns.length === 0) {
      console.log('\n[MIGRATION] Applying migration SQL...');
      await client.query(migrationSql);
      console.log('[MIGRATION] ✅ Migration SQL executed');
    } else {
      console.log('[MIGRATION] ℹ️ All columns already exist, skipping migration');
    }
    
    // 6. Verify columns exist
    console.log('\n[MIGRATION] Verifying columns...');
    const { rows: verifyColumns } = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'reply_opportunities'
      AND column_name IN ('accessibility_status', 'accessibility_checked_at', 'accessibility_reason', 'discovery_source')
      ORDER BY column_name;
    `);
    
    const verified: string[] = [];
    for (const col of verifyColumns) {
      verified.push(col.column_name);
      console.log(`[MIGRATION] ✅ Column exists: ${col.column_name} (${col.data_type})`);
    }
    
    // 7. Check index
    console.log('\n[MIGRATION] Checking index...');
    const { rows: indexes } = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'reply_opportunities'
      AND indexname = 'idx_reply_opportunities_accessibility';
    `);
    
    if (indexes.length > 0) {
      console.log(`[MIGRATION] ✅ Index exists: ${indexes[0].indexname}`);
    } else {
      console.log('[MIGRATION] ⚠️ Index not found (may need to be created)');
    }
    
    // 8. Summary
    console.log('\n[MIGRATION] ════════════════════════════════════════════════════════════════');
    console.log(`[MIGRATION] Verified columns: ${verified.length}/${requiredColumns.length}`);
    if (verified.length === requiredColumns.length) {
      console.log('[MIGRATION] ✅ Migration complete - all columns exist');
      return 0;
    } else {
      console.log(`[MIGRATION] ❌ Some columns missing: ${requiredColumns.filter(c => !verified.includes(c)).join(', ')}`);
      return 1;
    }
    
  } catch (error: any) {
    // Check if error is "already exists" (which is fine)
    const isAlreadyExists = 
      error.code === '42701' ||  // column already exists
      error.code === '42P07' ||  // table already exists
      error.code === '42P16' ||  // index already exists
      error.message?.includes('already exists');
    
    if (isAlreadyExists) {
      console.log(`[MIGRATION] ℹ️ Migration already applied (safe to ignore): ${error.message}`);
      return 0;
    } else {
      console.error(`[MIGRATION] ❌ Migration failed: ${error.message}`);
      console.error(`[MIGRATION] Error code: ${error.code}`);
      return 1;
    }
  } finally {
    await client.end();
  }
}

main()
  .then(code => process.exit(code || 0))
  .catch(error => {
    console.error('[MIGRATION] Fatal error:', error);
    process.exit(1);
  });
