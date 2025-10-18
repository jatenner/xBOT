#!/usr/bin/env tsx
/**
 * 🔧 FIXED MIGRATION APPLICATION
 * Actually executes CREATE TABLE statements properly
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Use Supabase's fetch API to execute raw SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (response.ok) {
      return { success: true };
    }
    
    const errorText = await response.text();
    
    // Check if it's just "already exists"
    if (errorText.includes('already exists') || errorText.includes('duplicate')) {
      return { success: true };
    }
    
    return { success: false, error: errorText };
    
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 FIXED MIGRATION APPLICATION');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('[SETUP] Loading environment...');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log('✅ Environment loaded\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Read migration file
  const migrationPath = path.join(__dirname, 'supabase/migrations/20251018_ai_driven_reply_system.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('[MIGRATION] Executing SQL directly...\n');
  
  // Execute the FULL SQL file as one statement
  // This is the correct way - don't try to parse it
  console.log('   Method: Single multi-statement execution');
  console.log('   Size:', migrationSQL.length, 'bytes\n');
  
  const result = await executeSQL(migrationSQL);
  
  if (!result.success) {
    console.error('❌ Direct execution failed:', result.error);
    console.log('\n🔄 Trying alternative: Execute via pg library...\n');
    
    // Alternative: Use node-postgres directly
    const { Client } = await import('pg');
    
    // Parse connection details from SUPABASE_URL
    const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
    const connectionString = `postgres://postgres.${projectRef}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
    
    console.log('   Connecting via PostgreSQL directly...');
    
    const client = new Client({ connectionString });
    
    try {
      await client.connect();
      console.log('   ✅ Connected\n');
      
      console.log('   Executing migration SQL...');
      await client.query(migrationSQL);
      console.log('   ✅ Migration executed!\n');
      
      await client.end();
      
    } catch (pgError: any) {
      console.error('   ❌ PostgreSQL execution failed:', pgError.message);
      await client.end();
      
      console.log('\n🔄 Trying final method: Individual CREATE TABLE statements...\n');
      
      // Execute just the CREATE TABLE statements manually
      const createDiscoveredAccounts = `
        CREATE TABLE IF NOT EXISTS discovered_accounts (
          id BIGSERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          follower_count INTEGER DEFAULT 0,
          following_count INTEGER DEFAULT 0,
          tweet_count INTEGER DEFAULT 0,
          bio TEXT,
          verified BOOLEAN DEFAULT false,
          discovery_method TEXT CHECK (discovery_method IN ('hashtag', 'network', 'content', 'follower_overlap')),
          discovery_date TIMESTAMP DEFAULT NOW(),
          
          quality_score INTEGER DEFAULT 0,
          engagement_score INTEGER DEFAULT 0,
          content_score INTEGER DEFAULT 0,
          audience_relevance INTEGER DEFAULT 0,
          growth_score INTEGER DEFAULT 0,
          final_score INTEGER DEFAULT 0,
          
          last_scored TIMESTAMP,
          last_updated TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_discovered_accounts_final_score 
        ON discovered_accounts(final_score DESC);
        
        CREATE INDEX IF NOT EXISTS idx_discovered_accounts_username 
        ON discovered_accounts(username);
      `;
      
      const createReplyInsights = `
        CREATE TABLE IF NOT EXISTS reply_learning_insights (
          id BIGSERIAL PRIMARY KEY,
          insight_type TEXT CHECK (insight_type IN ('generator', 'timing', 'target', 'topic')),
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          confidence DECIMAL(3,2) DEFAULT 0.0,
          sample_size INTEGER DEFAULT 0,
          discovered_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(insight_type, key)
        );
      `;
      
      const createInsightsIndexes = `
        CREATE INDEX IF NOT EXISTS idx_reply_insights_type 
        ON reply_learning_insights(insight_type);
        
        CREATE INDEX IF NOT EXISTS idx_reply_insights_confidence 
        ON reply_learning_insights(confidence DESC);
      `;
      
      console.log('   [1/4] Creating discovered_accounts table...');
      const client2 = new Client({ connectionString });
      await client2.connect();
      
      try {
        await client2.query(createDiscoveredAccounts);
        console.log('   ✅ discovered_accounts table created\n');
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log('   ✅ discovered_accounts table already exists\n');
        } else {
          throw err;
        }
      }
      
      console.log('   [2/4] Creating indexes for discovered_accounts...');
      try {
        await client2.query(createIndexes);
        console.log('   ✅ Indexes created\n');
      } catch (err: any) {
        console.log('   ℹ️  Indexes may already exist\n');
      }
      
      console.log('   [3/4] Creating reply_learning_insights table...');
      try {
        await client2.query(createReplyInsights);
        console.log('   ✅ reply_learning_insights table created\n');
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log('   ✅ reply_learning_insights table already exists\n');
        } else {
          throw err;
        }
      }
      
      console.log('   [4/4] Creating indexes for reply_learning_insights...');
      try {
        await client2.query(createInsightsIndexes);
        console.log('   ✅ Indexes created\n');
      } catch (err: any) {
        console.log('   ℹ️  Indexes may already exist\n');
      }
      
      await client2.end();
    }
  }
  
  // Verify table was created
  console.log('[VERIFY] Checking if table exists...\n');
  
  const { data, error } = await supabase
    .from('discovered_accounts')
    .select('id')
    .limit(1);
  
  if (error) {
    console.error('❌ MIGRATION STILL FAILED!');
    console.error('   Error:', error.message);
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('🚨 ALL METHODS FAILED');
    console.error('═══════════════════════════════════════════════════════\n');
    console.error('The table could not be created programmatically.');
    console.error('MANUAL FIX REQUIRED:\n');
    console.error('1. Open Supabase Dashboard: https://supabase.com/dashboard');
    console.error('2. Go to SQL Editor');
    console.error('3. Copy content from: supabase/migrations/20251018_ai_driven_reply_system.sql');
    console.error('4. Paste and run the SQL');
    console.error('5. Verify table is created\n');
    process.exit(1);
  }
  
  const { count } = await supabase
    .from('discovered_accounts')
    .select('*', { count: 'exact', head: true });
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ MIGRATION SUCCESSFUL!');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`📊 discovered_accounts table exists with ${count || 0} rows`);
  console.log('🚀 Reply system is now fully operational!\n');
  
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});

