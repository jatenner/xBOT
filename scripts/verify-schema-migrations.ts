/**
 * Verify schema after migrations
 * Checks that new columns/tables exist
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { Client } from 'pg';

async function verifySchema() {
  console.log('🔍 Verifying schema after migrations...\n');
  
  const supabase = getSupabaseClient();
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode=require') ? { require: true, rejectUnauthorized: false } : undefined,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check reply_opportunities columns
    console.log('📊 Checking reply_opportunities columns...');
    const { rows: oppColumns } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'reply_opportunities'
        AND column_name IN ('relevance_score', 'replyability_score', 'selection_reason')
      ORDER BY column_name;
    `);
    
    const expectedColumns = ['relevance_score', 'replyability_score', 'selection_reason'];
    const foundColumns = oppColumns.map((r: any) => r.column_name);
    
    console.log(`   Found: ${foundColumns.join(', ') || 'none'}`);
    
    for (const col of expectedColumns) {
      const found = foundColumns.includes(col);
      const info = oppColumns.find((r: any) => r.column_name === col);
      if (found && info) {
        console.log(`   ✅ ${col}: ${info.data_type} ${info.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${info.column_default ? `DEFAULT ${info.column_default}` : ''}`);
      } else {
        console.log(`   ❌ ${col}: MISSING`);
      }
    }
    
    // Check replied_tweets table
    console.log('\n📊 Checking replied_tweets table...');
    const { rows: repliedTable } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'replied_tweets'
      ) as exists;
    `);
    
    if (repliedTable[0]?.exists) {
      console.log('   ✅ replied_tweets table exists');
      
      // Check columns
      const { rows: repliedColumns } = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'replied_tweets'
        ORDER BY column_name;
      `);
      console.log(`   Columns: ${repliedColumns.map((r: any) => r.column_name).join(', ')}`);
    } else {
      console.log('   ❌ replied_tweets table MISSING');
    }
    
    // Check tier constraint
    console.log('\n📊 Checking tier constraint...');
    const { rows: tierConstraint } = await client.query(`
      SELECT con.conname, pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'reply_opportunities'
        AND con.conname = 'reply_opportunities_tier_check';
    `);
    
    if (tierConstraint.length > 0) {
      console.log(`   ✅ Constraint exists: ${tierConstraint[0].conname}`);
      console.log(`   Definition: ${tierConstraint[0].definition}`);
    } else {
      console.log('   ⚠️  tier constraint not found (may not exist)');
    }
    
    // Summary
    const allColumnsPresent = expectedColumns.every(col => foundColumns.includes(col));
    const tablePresent = repliedTable[0]?.exists;
    
    console.log('\n═══════════════════════════════════════════');
    if (allColumnsPresent && tablePresent) {
      console.log('✅ Schema verification PASSED');
      console.log('   - All new columns present');
      console.log('   - replied_tweets table exists');
      process.exit(0);
    } else {
      console.log('❌ Schema verification FAILED');
      if (!allColumnsPresent) {
        console.log('   - Missing columns in reply_opportunities');
      }
      if (!tablePresent) {
        console.log('   - Missing replied_tweets table');
      }
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(`❌ Verification failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifySchema().catch(console.error);

