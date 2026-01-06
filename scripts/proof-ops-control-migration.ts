/**
 * Proof queries for ops_control migration
 */

import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL
  });

  try {
    console.log('🔍 PROOF QUERIES:\n');
    
    // Proof 1: Table exists
    console.log('1️⃣ Table exists query:');
    console.log("   SELECT to_regclass('public.ops_control') as ops_control;");
    const tableCheck = await pool.query(`
      SELECT to_regclass('public.ops_control') as ops_control;
    `);
    console.log('   Result:', JSON.stringify(tableCheck.rows, null, 2));
    
    if (tableCheck.rows[0]?.ops_control) {
      console.log(`   ✅ Table exists: ${tableCheck.rows[0].ops_control}\n`);
    } else {
      console.error('   ❌ Table NOT found\n');
      process.exit(1);
    }
    
    // Proof 2: Function exists
    console.log('2️⃣ Function exists query:');
    console.log("   SELECT proname FROM pg_proc WHERE proname='consume_controlled_token';");
    const functionCheck = await pool.query(`
      SELECT proname FROM pg_proc WHERE proname='consume_controlled_token';
    `);
    console.log('   Result:', JSON.stringify(functionCheck.rows, null, 2));
    
    if (functionCheck.rows.length > 0) {
      console.log(`   ✅ Function exists: ${functionCheck.rows[0].proname}\n`);
    } else {
      console.error('   ❌ Function NOT found\n');
      process.exit(1);
    }
    
    // Additional proof: Table structure
    console.log('3️⃣ Table structure:');
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name='ops_control' 
      ORDER BY ordinal_position;
    `);
    console.log('   Columns:');
    structureCheck.rows.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n✅ ALL PROOF QUERIES PASSED!');
    
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

