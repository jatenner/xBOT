/**
 * 🔧 CRITICAL MIGRATION RUNNER
 * Applies 20251216_fix_phase5_schema_columns.sql using Node.js pg client
 * Works in any environment with DATABASE_URL
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Apply both migrations in order
const MIGRATION_FILES = [
  path.join(__dirname, '../supabase/migrations/20251216_fix_phase5_schema_columns.sql'),
  path.join(__dirname, '../supabase/migrations/20251216_fix_complete_view_columns.sql'),
  path.join(__dirname, '../supabase/migrations/20251216_add_thread_tweet_ids_to_view.sql')
];

async function applyMigration(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('[MIGRATION] ❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  console.log('[MIGRATION] 📋 Reading migration files...');
  const sqlFiles: string[] = [];
  for (const file of MIGRATION_FILES) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      sqlFiles.push(content);
      console.log(`[MIGRATION] ✅ Loaded: ${path.basename(file)}`);
    } catch (error: any) {
      console.error(`[MIGRATION] ❌ Failed to read ${file}: ${error.message}`);
      process.exit(1);
    }
  }
  const sql = sqlFiles.join('\n\n-- =====================================================================================\n-- Next Migration\n-- =====================================================================================\n\n');

  console.log('[MIGRATION] 🔌 Connecting to database...');
  
  // Parse connection string to handle SSL properly
  // Convert postgresql:// to postgres:// for URL parsing
  const normalizedUrl = databaseUrl.replace(/^postgresql:\/\//, 'postgres://');
  const url = new URL(normalizedUrl);
  
  // Build connection config with explicit SSL handling
  const connectionConfig: any = {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    database: url.pathname.slice(1) || 'postgres',
    user: url.username,
    password: url.password,
  };
  
  // Parse query params
  const params = new URLSearchParams(url.search);
  const sslMode = params.get('sslmode');
  
  // Set SSL config - always use relaxed for Supabase pooler
  const isSupabase = url.hostname.includes('supabase.com') || url.hostname.includes('pooler.supabase.com');
  if (isSupabase || sslMode === 'require') {
    connectionConfig.ssl = { rejectUnauthorized: false };
    console.log('[MIGRATION] ⚠️ Using relaxed SSL (rejectUnauthorized: false) for Supabase connection');
  } else if (sslMode === 'disable') {
    connectionConfig.ssl = false;
  } else {
    connectionConfig.ssl = true;
  }
  
  const pool = new Pool(connectionConfig);
  
  // Test connection
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    console.log('[MIGRATION] ✅ Database connection successful');
  } catch (connError: any) {
    console.error(`[MIGRATION] ❌ Database connection failed: ${connError.message}`);
    if (connError.code) console.error(`[MIGRATION] Error code: ${connError.code}`);
    await pool.end();
    process.exit(1);
  } finally {
    if (client) client.release();
  }

  const migrationClient = await pool.connect();
  
  try {
    console.log('[MIGRATION] 🚀 Applying migration...');
    await migrationClient.query(sql);
    console.log('[MIGRATION] ✅ Migration applied successfully');
    
    // Verify columns exist
    console.log('[MIGRATION] 🔍 Verifying schema...');
    const { rows } = await migrationClient.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'content_metadata'
      AND column_name IN ('hook_type', 'structure_type', 'visual_format', 'features', 'error_message', 'skip_reason', 'thread_tweet_ids')
      ORDER BY column_name
    `);
    
    const requiredColumns = ['hook_type', 'structure_type', 'visual_format', 'features', 'error_message', 'skip_reason', 'thread_tweet_ids'];
    const existingColumns = rows.map(r => r.column_name);
    const missing = requiredColumns.filter(col => !existingColumns.includes(col));
    
    console.log('[MIGRATION] 📊 Verification results:');
    requiredColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`  ${col}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
    });
    
    if (missing.length > 0) {
      console.error(`[MIGRATION] ❌ Verification failed - missing columns: ${missing.join(', ')}`);
      process.exit(1);
    }
    
    console.log('[MIGRATION] ✅ Schema verification passed');
    
  } catch (error: any) {
    console.error(`[MIGRATION] ❌ Migration failed: ${error.message}`);
    if (error.code) console.error(`[MIGRATION] Error code: ${error.code}`);
    if (error.detail) console.error(`[MIGRATION] Detail: ${error.detail}`);
    process.exit(1);
  } finally {
    migrationClient.release();
    await pool.end();
  }
}

applyMigration().catch((error) => {
  console.error('[MIGRATION] ❌ Fatal error:', error);
  process.exit(1);
});
