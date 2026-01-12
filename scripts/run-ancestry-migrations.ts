#!/usr/bin/env tsx
/**
 * Run ancestry-related migrations
 */

import 'dotenv/config';
import { Client } from 'pg';
import * as fs from 'fs';

async function runMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not set');
  }
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  try {
    // 1. Add method column if missing
    console.log('🔧 Adding method column to reply_decisions...');
    await client.query(`
      ALTER TABLE reply_decisions 
      ADD COLUMN IF NOT EXISTS method text;
    `);
    console.log('✅ Method column added');
    
    // 2. Create cache table
    console.log('🔧 Creating reply_ancestry_cache table...');
    const cacheSQL = fs.readFileSync('supabase/migrations/20260112_reply_ancestry_cache.sql', 'utf8');
    await client.query(cacheSQL);
    console.log('✅ Cache table created');
    
    console.log('\n✅ All migrations completed\n');
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
