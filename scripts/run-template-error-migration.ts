#!/usr/bin/env tsx
/**
 * Run template error reason migration
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

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260112_add_template_error_reason.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running template_error_reason migration...');
    await client.query(sql);
    console.log('✅ Migration completed\n');

    // Verify column exists
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
      AND column_name = 'template_error_reason';
    `);

    if (columns.length > 0) {
      console.log('✅ template_error_reason column exists:');
      console.log(`   Type: ${columns[0].data_type}`);
    } else {
      console.error('❌ template_error_reason column not found');
    }

    // Verify index exists
    const { rows: indexes } = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'reply_decisions'
      AND indexname = 'idx_reply_decisions_template_status_created';
    `);

    if (indexes.length > 0) {
      console.log(`\n✅ Index created: ${indexes[0].indexname}`);
    } else {
      console.warn(`\n⚠️  Index not found`);
    }

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
