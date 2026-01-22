#!/usr/bin/env tsx
/**
 * 🔧 APPLY MIGRATION: is_test_post column
 * 
 * Applies the migration 20260122_add_is_test_post_column.sql directly
 * using PostgreSQL connection (bypassing Supabase RPC limitations)
 */

import 'dotenv/config';
import { pool } from '../src/db/client';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔧 APPLY MIGRATION: is_test_post column');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();
  
  try {
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20260122_add_is_test_post_column.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log(`📏 SQL size: ${migrationSQL.length} characters\n`);

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'content_metadata'
        AND column_name = 'is_test_post';
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column is_test_post already exists');
      console.log('⏭️  Skipping migration (already applied)\n');
      process.exit(0);
    }

    console.log('🔄 Applying migration...\n');
    
    // Execute migration
    await client.query('BEGIN');
    try {
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration applied successfully!\n');
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    }

    // Verify it was applied
    const verify = await client.query(`
      SELECT 
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'content_metadata'
        AND column_name = 'is_test_post';
    `);

    if (verify.rows.length > 0) {
      const col = verify.rows[0];
      console.log('✅ Verification:');
      console.log(`   Column: ${col.column_name}`);
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Default: ${col.column_default}`);
      console.log(`   Nullable: ${col.is_nullable}\n`);
    }

    // Check index
    const indexCheck = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'content_metadata'
        AND indexname = 'idx_content_metadata_is_test_post';
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Index created: idx_content_metadata_is_test_post\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRATION APPLIED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
