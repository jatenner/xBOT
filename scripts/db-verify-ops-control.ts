/**
 * Verify ops_control table and consume_controlled_token function exist
 */

import 'dotenv/config';
import { Pool } from 'pg';

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
    console.log('🔍 Verifying ops_control table...');
    
    // Check table exists
    const tableCheck = await pool.query(`
      SELECT to_regclass('public.ops_control') as ops_control;
    `);
    
    if (tableCheck.rows[0]?.ops_control) {
      console.log(`✅ Table exists: ${tableCheck.rows[0].ops_control}`);
    } else {
      console.error('❌ Table NOT found: ops_control');
      process.exit(1);
    }
    
    // Check function exists
    console.log('🔍 Verifying consume_controlled_token function...');
    const functionCheck = await pool.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname='consume_controlled_token';
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log(`✅ Function exists: ${functionCheck.rows[0].proname}`);
      console.log(`   Function source preview: ${functionCheck.rows[0].prosrc.substring(0, 100)}...`);
    } else {
      console.error('❌ Function NOT found: consume_controlled_token');
      process.exit(1);
    }
    
    // Check table structure
    console.log('🔍 Verifying table structure...');
    const structureCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name='ops_control' 
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ Table structure:');
    structureCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ All verifications passed!');
    
  } catch (error: any) {
    console.error(`❌ Error verifying migration: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

