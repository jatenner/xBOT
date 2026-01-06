/**
 * Apply ops_control migration directly via DATABASE_URL
 * This script applies the migration SQL directly to the database
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function main() {
  // Parse SSL mode from DATABASE_URL
  const sslConfig = DATABASE_URL.includes('sslmode=require') 
    ? { rejectUnauthorized: false } 
    : DATABASE_URL.includes('sslmode=prefer')
    ? { rejectUnauthorized: false }
    : undefined;
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: sslConfig
  });

  try {
    console.log('📋 Reading migration file...');
    const migrationPath = join(__dirname, '../supabase/migrations/20260106092255_ops_control_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('🔧 Applying migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify table exists
    console.log('🔍 Verifying table exists...');
    const tableCheck = await pool.query(`
      SELECT to_regclass('public.ops_control') as ops_control;
    `);
    
    if (tableCheck.rows[0]?.ops_control) {
      console.log(`✅ Table verified: ${tableCheck.rows[0].ops_control}`);
    } else {
      console.error('❌ Table verification failed: ops_control not found');
      process.exit(1);
    }
    
    // Verify function exists
    console.log('🔍 Verifying function exists...');
    const functionCheck = await pool.query(`
      SELECT proname FROM pg_proc WHERE proname='consume_controlled_token';
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log(`✅ Function verified: ${functionCheck.rows[0].proname}`);
    } else {
      console.error('❌ Function verification failed: consume_controlled_token not found');
      process.exit(1);
    }
    
    console.log('\n✅ Migration complete and verified!');
    
  } catch (error: any) {
    console.error(`❌ Error applying migration: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

