/**
 * Apply Growth Controller Migration (Direct PG Connection)
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
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260114_growth_controller_tables.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRATION] 📝 Applying 20260114_growth_controller_tables.sql...\n');

    // Execute migration
    await client.query(sql);

    console.log('\n[MIGRATION] ✅ Migration applied successfully');

    // Record in _migrations table (if it exists)
    try {
      await client.query(
        `INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
        ['20260114_growth_controller_tables.sql']
      );
      console.log('[MIGRATION] ✅ Recorded in _migrations table');
    } catch (recordErr: any) {
      console.log('[MIGRATION] ⚠️  Could not record migration (table may not exist, continuing)');
    }

    // Verify tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('growth_plans', 'growth_execution')
      ORDER BY table_name;
    `);
    
    console.log('\n[MIGRATION] ✅ Verification:');
    tables.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Verify function exists
    const { rows: functions } = await client.query(`
      SELECT routine_name FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name = 'increment_growth_execution';
    `);
    
    if (functions.length > 0) {
      console.log(`   - Function: ${functions[0].routine_name}`);
    } else {
      console.log('   ⚠️  Function increment_growth_execution not found');
    }

    await client.end();
    console.log('\n[MIGRATION] 🎉 Complete\n');
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
