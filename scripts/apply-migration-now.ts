#!/usr/bin/env tsx
/**
 * 🔧 EMERGENCY MIGRATION APPLIER
 * Applies schema migration directly to production database
 */

import { config } from 'dotenv';
config();

import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function main() {
  console.log('🔧 APPLYING MIGRATION TO PRODUCTION DATABASE');
  console.log('════════════════════════════════════════════\n');
  
  const DATABASE_URL = process.env.DATABASE_URL!;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }
  
  console.log(`📡 Connecting to database...`);
  
  // Parse connection string to add sslmode if not present
  const connString = DATABASE_URL.includes('sslmode=')
    ? DATABASE_URL
    : `${DATABASE_URL}${DATABASE_URL.includes('?') ? '&' : '?'}sslmode=require`;
  
  const client = new Client({
    connectionString: connString,
    ssl: { 
      rejectUnauthorized: false // Allow self-signed certs
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');
    
    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/20260101_add_root_tweet_fields.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executing migration SQL...');
    console.log(`File: ${migrationPath}\n`);
    
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify columns exist
    console.log('🔍 Verifying columns...');
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'content_generation_metadata_comprehensive' 
        AND column_name IN ('root_tweet_id', 'original_candidate_tweet_id', 'resolved_via_root')
      ORDER BY column_name
    `);
    
    console.log(`Found ${rows.length} columns:`);
    rows.forEach(row => console.log(`  ✅ ${row.column_name}`));
    
    if (rows.length === 3) {
      console.log('\n✅ ALL SCHEMA COLUMNS PRESENT');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some columns still missing');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

