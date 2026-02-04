#!/usr/bin/env tsx
/**
 * Verify rate controller migration applied
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  let allPassed = true;

  try {
    await client.connect();
    console.log('🔍 Verifying rate controller migration...\n');

    // Check tables
    const requiredTables = [
      'bot_backoff_state',
      'bot_run_counters',
      'rate_controller_state',
      'strategy_weights',
      'hour_weights',
      'prompt_version_weights',
    ];

    console.log('📊 Checking tables:');
    for (const table of requiredTables) {
      try {
        await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`  ✅ ${table}: exists`);
      } catch (e: any) {
        console.log(`  ❌ ${table}: ${e.message}`);
        allPassed = false;
      }
    }

    // Check columns (check underlying table since view may not be updated yet)
    console.log('\n📊 Checking content_generation_metadata_comprehensive columns:');
    const requiredColumns = ['prompt_version', 'strategy_id', 'hour_bucket', 'outcome_score'];
    for (const column of requiredColumns) {
      try {
        await client.query(`SELECT ${column} FROM content_generation_metadata_comprehensive LIMIT 1`);
        console.log(`  ✅ ${column}: exists in underlying table`);
      } catch (e: any) {
        console.log(`  ❌ ${column}: ${e.message}`);
        allPassed = false;
      }
    }
    
    // Check if view has columns (required - view should be updated)
    console.log('\n📊 Checking content_metadata view columns:');
    for (const column of requiredColumns) {
      try {
        await client.query(`SELECT ${column} FROM content_metadata LIMIT 1`);
        console.log(`  ✅ ${column}: exists in view`);
      } catch (e: any) {
        console.log(`  ❌ ${column}: not in view - view needs update`);
        allPassed = false;
      }
    }

    // Check RPC function
    console.log('\n📊 Checking RPC function:');
    try {
      await client.query('SELECT increment_budget_counter($1, $2, $3)', [
        new Date().toISOString().split('T')[0],
        0,
        0,
      ]);
      console.log(`  ✅ increment_budget_counter: exists`);
    } catch (e: any) {
      console.log(`  ❌ increment_budget_counter: ${e.message}`);
      allPassed = false;
    }

    // Check ramp columns in rate_controller_state
    console.log('\n📊 Checking rate_controller_state ramp columns:');
    const rampColumns = ['ramp_reason', 'hours_since_start', 'has_24h_stability', 'success_rate_6h'];
    for (const column of rampColumns) {
      try {
        await client.query(`SELECT ${column} FROM rate_controller_state LIMIT 1`);
        console.log(`  ✅ ${column}: exists`);
      } catch (e: any) {
        console.log(`  ❌ ${column}: ${e.message}`);
        allPassed = false;
      }
    }

    // Check schema_migrations for latest migrations
    console.log('\n📊 Checking schema_migrations:');
    try {
      const { rows: rateControllerRows } = await client.query(`
        SELECT filename, applied_at, checksum 
        FROM schema_migrations 
        WHERE filename = '20260203_rate_controller_schema.sql'
        ORDER BY applied_at DESC 
        LIMIT 1
      `);
      
      if (rateControllerRows.length > 0) {
        console.log(`  ✅ 20260203_rate_controller_schema.sql: applied at ${rateControllerRows[0].applied_at}`);
        console.log(`     Checksum: ${rateControllerRows[0].checksum.substring(0, 16)}...`);
      } else {
        console.log(`  ❌ 20260203_rate_controller_schema.sql: not found in schema_migrations`);
        allPassed = false;
      }
      
      const { rows: rampRows } = await client.query(`
        SELECT filename, applied_at, checksum 
        FROM schema_migrations 
        WHERE filename = '20260203_add_ramp_columns.sql'
        ORDER BY applied_at DESC 
        LIMIT 1
      `);
      
      if (rampRows.length > 0) {
        console.log(`  ✅ 20260203_add_ramp_columns.sql: applied at ${rampRows[0].applied_at}`);
        console.log(`     Checksum: ${rampRows[0].checksum.substring(0, 16)}...`);
      } else {
        console.log(`  ⚠️  20260203_add_ramp_columns.sql: not found (will be applied on next migration run)`);
      }
    } catch (e: any) {
      console.log(`  ⚠️  schema_migrations check failed: ${e.message}`);
      // Don't fail if table doesn't exist yet (will be created by migration runner)
    }

    console.log('');
    if (allPassed) {
      console.log('✅ All verifications passed');
      process.exit(0);
    } else {
      console.log('❌ Some verifications failed');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
