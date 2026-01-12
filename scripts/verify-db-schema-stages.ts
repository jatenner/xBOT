#!/usr/bin/env tsx
/**
 * Verify DB schema for pipeline stage timestamps
 */

import 'dotenv/config';
import { Client } from 'pg';

async function verifySchema() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check columns exist
    console.log('📊 1. CHECKING COLUMNS ON reply_decisions:');
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
      AND column_name IN (
        'scored_at', 
        'template_selected_at', 
        'generation_started_at', 
        'generation_completed_at',
        'posting_started_at', 
        'posting_completed_at', 
        'pipeline_error_reason'
      )
      ORDER BY column_name;
    `);

    const expectedColumns = [
      'scored_at',
      'template_selected_at',
      'generation_started_at',
      'generation_completed_at',
      'posting_started_at',
      'posting_completed_at',
      'pipeline_error_reason',
    ];

    console.log(`   Found ${columns.length} columns:`);
    columns.forEach((row: any) => {
      console.log(`   ✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    const foundColumnNames = columns.map((r: any) => r.column_name);
    const missingColumns = expectedColumns.filter((name) => !foundColumnNames.includes(name));
    if (missingColumns.length > 0) {
      console.log(`\n   ❌ MISSING COLUMNS: ${missingColumns.join(', ')}`);
      process.exit(1);
    } else {
      console.log(`\n   ✅ All ${expectedColumns.length} columns exist\n`);
    }

    // Check indexes
    console.log('📊 2. CHECKING INDEXES:');
    const { rows: indexes } = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'reply_decisions'
      AND indexname IN ('idx_reply_decisions_stage_timestamps', 'idx_reply_decisions_pipeline_error')
      ORDER BY indexname;
    `);

    console.log(`   Found ${indexes.length} indexes:`);
    indexes.forEach((row: any) => {
      console.log(`   ✅ ${row.indexname}`);
      console.log(`      ${row.indexdef.substring(0, 100)}...`);
    });

    if (indexes.length < 2) {
      console.log(`\n   ⚠️  Expected 2 indexes, found ${indexes.length}`);
    } else {
      console.log(`\n   ✅ All indexes exist\n`);
    }

    console.log('✅ Schema verification complete');

  } catch (error: any) {
    console.error('❌ Schema verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySchema().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
