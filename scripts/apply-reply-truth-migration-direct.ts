/**
 * Apply Reply Truth Infrastructure Migration (Direct PG Connection)
 * 
 * Uses raw pg client to apply the migration directly.
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('[MIGRATION] ❌ Missing DATABASE_URL');
    process.exit(1);
  }

  const url = new URL(DATABASE_URL);
  console.log(`[MIGRATION] Target: host=${url.hostname} dbname=${url.pathname.substring(1)}`);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[MIGRATION] ✅ Connected');

    // Read migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251219_reply_truth_infrastructure.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRATION] 📝 Applying 20251219_reply_truth_infrastructure.sql...\n');

    // Execute migration
    await client.query(sql);

    console.log('\n[MIGRATION] ✅ Migration applied successfully');

    // Record in _migrations table
    try {
      await client.query(
        `INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
        ['20251219_reply_truth_infrastructure.sql']
      );
      console.log('[MIGRATION] ✅ Recorded in _migrations table');
    } catch (recordErr: any) {
      console.log('[MIGRATION] ⚠️  Could not record migration (may already exist)');
    }

    await client.end();
    console.log('[MIGRATION] 🎉 Complete\n');
    process.exit(0);
    
  } catch (err: any) {
    console.error('[MIGRATION] ❌ Error:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    await client.end().catch(() => {});
    process.exit(1);
  }
}

applyMigration();

