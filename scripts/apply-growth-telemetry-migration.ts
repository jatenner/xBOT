/**
 * Apply Growth Telemetry Migration (Direct PG Connection)
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

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('[MIGRATION] ✅ Connected');

    // Read migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260114_growth_telemetry_tables.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRATION] 📝 Applying 20260114_growth_telemetry_tables.sql...\n');

    // Execute migration
    await client.query(sql);

    console.log('\n[MIGRATION] ✅ Migration applied successfully');

    // Verify tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('account_snapshots', 'performance_snapshots', 'reward_features', 'daily_aggregates')
      ORDER BY table_name;
    `);
    
    console.log('\n[MIGRATION] ✅ Verification:');
    tables.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

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
