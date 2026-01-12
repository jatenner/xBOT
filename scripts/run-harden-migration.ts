#!/usr/bin/env tsx
/**
 * Run hardening migration for reply_decisions table
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
    console.log('✅ Connected to database');

    const migrationPath = path.join(__dirname, '../supabase/migrations/20260112_harden_reply_decisions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed');

    // Verify columns exist
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
      AND column_name IN ('status', 'confidence', 'method', 'cache_hit')
      ORDER BY column_name;
    `);

    console.log('\n📊 Column verification:');
    rows.forEach((row: any) => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });

    // Check row counts
    const { rows: countRows } = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as has_status,
        COUNT(CASE WHEN method IS NOT NULL THEN 1 END) as has_method,
        COUNT(CASE WHEN method = 'unknown' THEN 1 END) as method_unknown
      FROM reply_decisions;
    `);

    console.log('\n📊 Row statistics:');
    console.log(`  Total rows: ${countRows[0].total}`);
    console.log(`  Rows with status: ${countRows[0].has_status}`);
    console.log(`  Rows with method: ${countRows[0].has_method}`);
    console.log(`  Rows with method=unknown: ${countRows[0].method_unknown}`);

    if (countRows[0].method_unknown > 0) {
      const { rows: unknownRows } = await client.query(`
        SELECT decision, COUNT(*) as count
        FROM reply_decisions
        WHERE method = 'unknown'
        GROUP BY decision;
      `);
      console.log('\n⚠️  method=unknown breakdown:');
      unknownRows.forEach((row: any) => {
        console.log(`  ${row.decision}: ${row.count}`);
        if (row.decision === 'ALLOW') {
          console.log(`    ⚠️  WARNING: ${row.count} ALLOW decisions with method=unknown (should be 0)`);
        }
      });
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
