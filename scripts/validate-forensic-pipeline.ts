#!/usr/bin/env tsx
/**
 * 🔍 VALIDATE FORENSIC PIPELINE: Check table exists and generate evidence rows
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry, recordReplyDecision, shouldAllowReply } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { Client } from 'pg';
import * as fs from 'fs';

async function checkTableExists() {
  const supabase = getSupabaseClient();
  
  // Try to query the table - if it doesn't exist, we'll get an error
  const { data, error } = await supabase
    .from('reply_decisions')
    .select('id')
    .limit(1);
  
  if (error) {
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return { exists: false, error: null };
    }
    return { exists: false, error: error.message };
  }
  
  return { exists: true, error: null };
}

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not set');
  }
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  await client.connect();
  
  try {
    const fs = await import('fs');
    const migrationPath = 'supabase/migrations/20260111_reply_decisions_forensic.sql';
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('  🔧 Running migration...');
    await client.query(sql);
    console.log('  ✅ Migration completed');
  } finally {
    await client.end();
  }
}

async function validatePipeline() {
  console.log('\n🔍 VALIDATING FORENSIC PIPELINE\n');
  console.log('═'.repeat(80));
  
  const supabase = getSupabaseClient();
  
  // 1. Check if table exists
  console.log('\n📊 STEP 1: Check if reply_decisions table exists');
  console.log('-'.repeat(80));
  
  const tableCheck = await checkTableExists();
  
  if (!tableCheck.exists) {
    console.log('  ❌ Table reply_decisions does not exist!');
    console.log('  💡 Running migration...');
    
    try {
      await runMigration();
      
      // Re-check
      const recheck = await checkTableExists();
      if (!recheck.exists) {
        console.error('  ❌ Migration failed - table still does not exist');
        process.exit(1);
      }
      console.log('  ✅ Table created successfully');
    } catch (error: any) {
      console.error(`  ❌ Migration error: ${error.message}`);
      console.log('  💡 Please run migration manually via Supabase dashboard');
      process.exit(1);
    }
  } else {
    console.log('  ✅ Table reply_decisions exists');
  }
  
  // Check if method column exists, add if missing
  try {
    const { error: methodCheck } = await supabase
      .from('reply_decisions')
      .select('method')
      .limit(1);
    
    if (methodCheck && methodCheck.message.includes('column') && methodCheck.message.includes('method')) {
      console.log('  💡 Adding method column...');
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      await client.query('ALTER TABLE reply_decisions ADD COLUMN IF NOT EXISTS method text;');
      await client.end();
      console.log('  ✅ Method column added');
    }
  } catch (error: any) {
    console.warn(`  ⚠️  Method column check failed: ${error.message}`);
  }
  
  // Check cache table
  const { data: cacheCheck, error: cacheError } = await supabase
    .from('reply_ancestry_cache')
    .select('id')
    .limit(1);
  
  if (cacheError && (cacheError.code === '42P01' || cacheError.message.includes('does not exist'))) {
    console.log('  💡 Running cache table migration...');
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      const fs = await import('fs');
      const cacheSQL = fs.readFileSync('supabase/migrations/20260112_reply_ancestry_cache.sql', 'utf8');
      await client.query(cacheSQL);
      await client.end();
      console.log('  ✅ Cache table created');
    } catch (error: any) {
      console.warn(`  ⚠️  Cache migration failed: ${error.message}`);
    }
  } else {
    console.log('  ✅ Table reply_ancestry_cache exists');
  }
  
  // Count rows
  const { count, error: countError } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error(`  ⚠️  Error counting rows: ${countError.message}`);
  } else {
    console.log(`  📊 Current row count: ${count || 0}`);
  }
  
  // 2. Generate test evidence rows
  console.log('\n📊 STEP 2: Generate test evidence rows');
  console.log('-'.repeat(80));
  
  // Get real tweet IDs from database if available
  let rootTweetId: string | null = null;
  let replyTweetId: string | null = null;
  
  try {
    // Try to find a root tweet (one that was posted as a reply)
    const { data: rootTweets } = await supabase
      .from('content_metadata')
      .select('target_tweet_id, root_tweet_id')
      .eq('decision_type', 'reply')
      .not('target_tweet_id', 'is', null)
      .limit(1)
      .single();
    
    if (rootTweets?.target_tweet_id) {
      rootTweetId = rootTweets.target_tweet_id;
      console.log(`  Found root tweet from DB: ${rootTweetId}`);
    }
    
    // Try to find a reply tweet (one where target != root)
    const { data: replyTweets } = await supabase
      .from('content_metadata')
      .select('target_tweet_id, root_tweet_id')
      .eq('decision_type', 'reply')
      .not('target_tweet_id', 'is', null)
      .not('root_tweet_id', 'is', null)
      .neq('target_tweet_id', 'root_tweet_id')
      .limit(1)
      .single();
    
    if (replyTweets?.target_tweet_id) {
      replyTweetId = replyTweets.target_tweet_id;
      console.log(`  Found reply tweet from DB: ${replyTweetId}`);
    }
  } catch (error: any) {
    console.log(`  ⚠️  Could not find tweets from DB: ${error.message}`);
  }
  
  // Use provided IDs or defaults
  const testRootTweet = process.argv[2] || rootTweetId || '1234567890123456789';
  const testReplyTweet = process.argv[3] || replyTweetId || '9876543210987654321';
  
  console.log(`  Test Root Tweet ID: ${testRootTweet}`);
  console.log(`  Test Reply Tweet ID: ${testReplyTweet}`);
  console.log('');
  
  // Test 1: Root tweet (should ALLOW)
  console.log('  [TEST 1] Root Tweet Analysis:');
  try {
    const ancestry1 = await resolveTweetAncestry(testRootTweet);
    const allowCheck1 = shouldAllowReply(ancestry1);
    
    console.log(`    Target: ${ancestry1.targetTweetId}`);
    console.log(`    Root: ${ancestry1.rootTweetId}`);
    console.log(`    Depth: ${ancestry1.ancestryDepth}`);
    console.log(`    Is Root: ${ancestry1.isRoot}`);
    console.log(`    Decision: ${allowCheck1.allow ? '✅ ALLOW' : '🚫 DENY'}`);
    console.log(`    Reason: ${allowCheck1.reason}`);
    
    // Record decision (use null for test decisions)
    await recordReplyDecision({
      decision_id: undefined, // Test decision - no real decision_id
      target_tweet_id: ancestry1.targetTweetId,
      target_in_reply_to_tweet_id: ancestry1.targetInReplyToTweetId,
      root_tweet_id: ancestry1.rootTweetId,
      ancestry_depth: ancestry1.ancestryDepth,
      is_root: ancestry1.isRoot,
      decision: allowCheck1.allow ? 'ALLOW' : 'DENY',
      reason: `Test: ${allowCheck1.reason}`,
      trace_id: 'validation_test',
      job_run_id: 'validation_test',
      pipeline_source: 'validation_script',
      playwright_post_attempted: false,
    });
    
    console.log('    ✅ Decision recorded');
  } catch (error: any) {
    console.error(`    ❌ Error: ${error.message}`);
  }
  
  console.log('');
  
  // Test 2: Reply tweet (should DENY)
  console.log('  [TEST 2] Reply Tweet Analysis:');
  try {
    const ancestry2 = await resolveTweetAncestry(testReplyTweet);
    const allowCheck2 = shouldAllowReply(ancestry2);
    
    console.log(`    Target: ${ancestry2.targetTweetId}`);
    console.log(`    Root: ${ancestry2.rootTweetId}`);
    console.log(`    Depth: ${ancestry2.ancestryDepth}`);
    console.log(`    Is Root: ${ancestry2.isRoot}`);
    console.log(`    Decision: ${allowCheck2.allow ? '✅ ALLOW' : '🚫 DENY'}`);
    console.log(`    Reason: ${allowCheck2.reason}`);
    
    // Record decision (use null for test decisions)
    await recordReplyDecision({
      decision_id: undefined, // Test decision - no real decision_id
      target_tweet_id: ancestry2.targetTweetId,
      target_in_reply_to_tweet_id: ancestry2.targetInReplyToTweetId,
      root_tweet_id: ancestry2.rootTweetId,
      ancestry_depth: ancestry2.ancestryDepth,
      is_root: ancestry2.isRoot,
      decision: allowCheck2.allow ? 'ALLOW' : 'DENY',
      reason: `Test: ${allowCheck2.reason}`,
      trace_id: 'validation_test',
      job_run_id: 'validation_test',
      pipeline_source: 'validation_script',
      playwright_post_attempted: false,
    });
    
    console.log('    ✅ Decision recorded');
  } catch (error: any) {
    console.error(`    ❌ Error: ${error.message}`);
  }
  
  // 3. Query latest rows
  console.log('\n📊 STEP 3: Latest 10 rows from reply_decisions');
  console.log('-'.repeat(80));
  
  try {
    const { data: rows, error: queryError } = await supabase
      .from('reply_decisions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queryError) {
      console.error(`  ❌ Error querying rows: ${queryError.message}`);
    } else if (!rows || rows.length === 0) {
      console.log('  ℹ️  No rows found');
    } else {
      console.log(`  Found ${rows.length} row(s):\n`);
      rows.forEach((row, i) => {
        console.log(`  [${i + 1}] ID: ${row.id}`);
        console.log(`      Created: ${row.created_at}`);
        console.log(`      Target: ${row.target_tweet_id}`);
        console.log(`      Root: ${row.root_tweet_id}`);
        console.log(`      Depth: ${row.ancestry_depth}, Is Root: ${row.is_root}`);
        console.log(`      Decision: ${row.decision}`);
        console.log(`      Reason: ${row.reason || 'N/A'}`);
        console.log(`      Pipeline: ${row.pipeline_source || 'N/A'}`);
        console.log('');
      });
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  
  console.log('═'.repeat(80));
  console.log('\n✅ Validation complete\n');
}

// Main
validatePipeline().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
