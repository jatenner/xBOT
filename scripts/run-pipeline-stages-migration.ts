#!/usr/bin/env tsx
/**
 * Run pipeline stages migration
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

async function runMigration() {
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

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260112_add_pipeline_stage_timestamps.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running pipeline stages migration...');
    await client.query(sql);
    console.log('✅ Migration completed\n');

    // Verify columns exist
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
      AND column_name IN ('scored_at', 'template_selected_at', 'generation_started_at', 'generation_completed_at', 'posting_started_at', 'posting_completed_at', 'pipeline_error_reason')
      ORDER BY column_name;
    `);

    console.log('✅ Pipeline stage columns:');
    columns.forEach((row: any) => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });

    // Verify indexes
    const { rows: indexes } = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'reply_decisions'
      AND indexname IN ('idx_reply_decisions_stage_timestamps', 'idx_reply_decisions_pipeline_error');
    `);

    console.log(`\n✅ Indexes created:`);
    indexes.forEach((row: any) => {
      console.log(`   ${row.indexname}`);
    });

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
