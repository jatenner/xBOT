#!/usr/bin/env tsx
/**
 * 🔍 VERIFY MIGRATION: is_test_post column
 * 
 * Verifies that the migration 20260122_add_is_test_post_column.sql was applied:
 * - Column exists in content_metadata
 * - Default is false
 * - NOT NULL constraint exists
 * - Index exists
 */

import 'dotenv/config';
import { pool } from '../../src/db/client';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔍 VERIFY MIGRATION: is_test_post column');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = await pool.connect();
  
  try {
    // 1. Check column exists
    console.log('1️⃣  Checking column exists...');
    const columnCheck = await client.query(`
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

    if (columnCheck.rows.length === 0) {
      console.error('❌ AUTO MIGRATION DID NOT APPLY');
      console.error('   Column is_test_post does not exist in content_metadata');
      console.error('\n🔍 DIAGNOSIS:');
      console.error('   - Migration file exists: supabase/migrations/20260122_add_is_test_post_column.sql');
      console.error('   - Possible causes:');
      console.error('     1. Migration runner not configured in Railway');
      console.error('     2. Migration path not included in deploy');
      console.error('     3. Migration failed silently');
      console.error('\n💡 FIX:');
      console.error('   - Check Railway logs for migration errors');
      console.error('   - Verify Supabase migration runner is enabled');
      console.error('   - Manually apply migration if needed');
      process.exit(1);
    }

    const col = columnCheck.rows[0];
    console.log(`   ✅ Column exists: ${col.column_name}`);
    console.log(`   ✅ Data type: ${col.data_type}`);
    console.log(`   ✅ Default: ${col.column_default}`);
    console.log(`   ✅ Nullable: ${col.is_nullable}\n`);

    // Verify defaults
    if (col.column_default !== 'false' && col.column_default !== 'false::boolean') {
      console.error('❌ Column default is not false');
      console.error(`   Found: ${col.column_default}`);
      process.exit(1);
    }

    if (col.is_nullable !== 'NO') {
      console.error('❌ Column is nullable (should be NOT NULL)');
      process.exit(1);
    }

    // 2. Check index exists
    console.log('2️⃣  Checking index exists...');
    const indexCheck = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'content_metadata'
        AND indexname = 'idx_content_metadata_is_test_post';
    `);

    if (indexCheck.rows.length === 0) {
      console.error('❌ Index idx_content_metadata_is_test_post does not exist');
      process.exit(1);
    }

    console.log(`   ✅ Index exists: ${indexCheck.rows[0].indexname}`);
    console.log(`   ✅ Index definition: ${indexCheck.rows[0].indexdef}\n`);

    // 3. Sample data check
    console.log('3️⃣  Checking sample data...');
    const sampleCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_test_post = true) as test_posts,
        COUNT(*) FILTER (WHERE is_test_post = false) as prod_posts,
        COUNT(*) FILTER (WHERE is_test_post IS NULL) as null_posts
      FROM content_metadata;
    `);

    const sample = sampleCheck.rows[0];
    console.log(`   ✅ Total rows: ${sample.total}`);
    console.log(`   ✅ Test posts: ${sample.test_posts}`);
    console.log(`   ✅ Prod posts: ${sample.prod_posts}`);
    console.log(`   ✅ Null posts: ${sample.null_posts}\n`);

    if (parseInt(sample.null_posts) > 0) {
      console.warn('⚠️  WARNING: Found NULL values (should not exist with NOT NULL constraint)');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRATION VERIFICATION: PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Output results for report
    console.log('📊 VERIFICATION RESULTS:');
    console.log(JSON.stringify({
      column_exists: true,
      column_name: col.column_name,
      data_type: col.data_type,
      column_default: col.column_default,
      is_nullable: col.is_nullable,
      index_exists: true,
      index_name: indexCheck.rows[0].indexname,
      sample_data: {
        total: sample.total,
        test_posts: sample.test_posts,
        prod_posts: sample.prod_posts,
        null_posts: sample.null_posts
      }
    }, null, 2));

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
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
