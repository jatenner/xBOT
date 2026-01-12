#!/usr/bin/env tsx
/**
 * Run migration to add deny_reason_code column
 */

import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

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

    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20260112_add_deny_reason_code.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration: 20260112_add_deny_reason_code.sql\n');
    await client.query(migrationSQL);

    // Verify column exists
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reply_decisions'
        AND column_name = 'deny_reason_code';
    `);

    if (rows.length > 0) {
      console.log('✅ Migration complete: deny_reason_code column exists');
      console.log(`   Column: ${rows[0].column_name}, Type: ${rows[0].data_type}, Nullable: ${rows[0].is_nullable}`);
    } else {
      console.error('❌ Migration failed: deny_reason_code column not found');
      process.exit(1);
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
