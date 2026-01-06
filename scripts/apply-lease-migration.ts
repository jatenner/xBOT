/**
 * Apply the ops_control lease migration via direct SQL using DATABASE_URL
 */

import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('📋 Reading lease migration file...');
  const migrationSqlPath = path.join(__dirname, '../supabase/migrations/20260106204000_ops_control_lease.sql');
  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('pooler.supabase.com') 
      ? { rejectUnauthorized: false } 
      : false,
  });

  try {
    console.log('🔧 Applying lease migration...');
    await pool.query(migrationSql);
    console.log('✅ Lease migration applied successfully!');

    // Verify functions exist
    const functions = ['acquire_controlled_token', 'finalize_controlled_token', 'release_controlled_token'];
    for (const funcName of functions) {
      const functionCheck = await pool.query(`SELECT proname FROM pg_proc WHERE proname='${funcName}';`);
      if (functionCheck.rows.length > 0) {
        console.log(`✅ Function verified: ${funcName}`);
      } else {
        console.error(`❌ Function verification failed: ${funcName} not found.`);
        process.exit(1);
      }
    }

    // Verify columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'ops_control' 
        AND column_name IN ('lease_owner', 'lease_expires_at');
    `);
    const foundColumns = columnsCheck.rows.map(r => r.column_name);
    if (foundColumns.includes('lease_owner') && foundColumns.includes('lease_expires_at')) {
      console.log('✅ Columns verified: lease_owner, lease_expires_at');
    } else {
      console.error(`❌ Column verification failed. Found: ${foundColumns.join(', ')}`);
      process.exit(1);
    }

    console.log('\n✅ Lease migration complete and verified!');

  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

