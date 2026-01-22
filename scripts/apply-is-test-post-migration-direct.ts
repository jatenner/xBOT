#!/usr/bin/env tsx
/**
 * 🔧 APPLY MIGRATION: is_test_post column
 * 
 * Applies the migration to content_generation_metadata_comprehensive
 * (the actual underlying table, since content_metadata is a view or doesn't exist)
 */

import 'dotenv/config';
import { pool } from '../src/db/client';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔧 APPLY MIGRATION: is_test_post column');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();
  
  try {
    const tableName = 'content_generation_metadata_comprehensive';
    
    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = 'is_test_post';
    `, [tableName]);

    if (checkColumn.rows.length > 0) {
      console.log(`✅ Column is_test_post already exists in ${tableName}`);
      console.log('⏭️  Skipping migration (already applied)\n');
      process.exit(0);
    }

    console.log(`🔄 Applying migration to ${tableName}...\n`);
    
    // Apply migration SQL (modified for correct table)
    await client.query('BEGIN');
    try {
      // Add column
      await client.query(`
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS is_test_post BOOLEAN NOT NULL DEFAULT false;
      `);
      
      // Create index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_content_metadata_is_test_post 
        ON ${tableName} (is_test_post) 
        WHERE is_test_post = true;
      `);
      
      // Add comment
      await client.query(`
        COMMENT ON COLUMN ${tableName}.is_test_post IS 
        'Flag to separate test posts from production. Test posts are blocked by default unless ALLOW_TEST_POSTS=true env var is set.';
      `);
      
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
        AND table_name = $1
        AND column_name = 'is_test_post';
    `, [tableName]);

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
        AND tablename = $1
        AND indexname = 'idx_content_metadata_is_test_post';
    `, [tableName]);

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
