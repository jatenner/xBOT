#!/usr/bin/env tsx
/**
 * Run quality tracking migrations
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

async function runMigrations() {
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
    console.log('✅ Connected to database');

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260112_reply_quality_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed');

    // Verify tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('reply_templates', 'reply_candidate_features')
      ORDER BY table_name;
    `);

    console.log('\n📊 Tables created:');
    tables.forEach((row: any) => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Verify columns added to reply_decisions
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
      AND column_name IN ('candidate_features', 'candidate_score', 'template_id', 'prompt_version', 'engagement_24h_likes', 'engagement_24h_replies', 'engagement_24h_retweets', 'engagement_24h_views', 'engagement_fetched_at')
      ORDER BY column_name;
    `);

    console.log('\n📊 Columns added to reply_decisions:');
    columns.forEach((row: any) => {
      console.log(`  ✅ ${row.column_name}: ${row.data_type}`);
    });

    // Check template count
    const { rows: templateCount } = await client.query(`
      SELECT COUNT(*) as count FROM reply_templates;
    `);

    console.log(`\n📊 Templates loaded: ${templateCount[0].count}`);

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
