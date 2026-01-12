#!/usr/bin/env tsx
/**
 * Run template tracking fix migration
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

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260112_fix_template_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running template tracking fix migration...');
    await client.query(sql);
    console.log('✅ Migration completed\n');

    // Verify column exists
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
      AND column_name = 'template_status';
    `);

    if (columns.length > 0) {
      console.log('✅ template_status column exists:');
      console.log(`   Type: ${columns[0].data_type}`);
      console.log(`   Default: ${columns[0].column_default}`);
    } else {
      console.error('❌ template_status column not found');
    }

    // Verify index exists
    const { rows: indexes } = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'reply_decisions'
      AND indexname = 'idx_reply_decisions_template_status';
    `);

    if (indexes.length > 0) {
      console.log(`\n✅ Index created: ${indexes[0].indexname}`);
    } else {
      console.warn(`\n⚠️  Index not found`);
    }

    // Check for remaining "pending" strings
    const { rows: pendingCount } = await client.query(`
      SELECT COUNT(*) as count
      FROM reply_decisions
      WHERE template_id = 'pending' OR prompt_version = 'pending';
    `);

    console.log(`\n📊 Remaining "pending" strings: ${pendingCount[0]?.count || 0}`);
    if (pendingCount[0]?.count > 0) {
      console.warn(`   ⚠️  Some rows still have "pending" - may need manual cleanup`);
    } else {
      console.log(`   ✅ No "pending" strings found`);
    }

    // Show template_status distribution
    const { rows: statusDist } = await client.query(`
      SELECT 
        template_status,
        COUNT(*) as count
      FROM reply_decisions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY template_status
      ORDER BY count DESC;
    `);

    console.log(`\n📊 Template status distribution (last 24h):`);
    statusDist.forEach((row: any) => {
      console.log(`   ${row.template_status || 'NULL'}: ${row.count}`);
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
