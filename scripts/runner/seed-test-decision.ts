#!/usr/bin/env tsx
/**
 * 🧪 SEED TEST DECISION
 * 
 * Creates a single test reply decision for manual CDP posting verification.
 * 
 * Usage:
 *   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:seed-decision -- --tweet_id=1234567890
 * 
 * Requirements:
 *   - RUNNER_MODE=true (safety guard)
 *   - --tweet_id required (target tweet ID to reply to)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Step 1: Auto-sync env from Railway (like other runner scripts)
console.log('📥 Syncing env from Railway...');
try {
  execSync('pnpm run runner:autosync', { 
    stdio: 'pipe',
    encoding: 'utf-8',
    cwd: process.cwd()
  });
  console.log('✅ Env synced\n');
} catch (error: any) {
  console.error('❌ Failed to sync env from Railway:', error.message);
  console.error('   Continuing with existing .env.local if available...\n');
}

// Load env from .env.local or .env (required for DB connection)
// MUST load before any imports that use env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Now import modules that use env (after dotenv loads)
const { getSupabaseClient } = require('../../src/db');
const { v4: uuidv4 } = require('uuid');

const RUNNER_MODE = process.env.RUNNER_MODE === 'true';

// Parse command line args
const args = process.argv.slice(2);
const tweetIdArg = args.find(arg => arg.startsWith('--tweet_id='));
const tweetId = tweetIdArg ? tweetIdArg.split('=')[1] : null;

async function main() {
  // Safety guard: only run in RUNNER_MODE
  if (!RUNNER_MODE) {
    console.error('❌ ERROR: RUNNER_MODE must be true');
    console.error('   This script only runs in runner environment for safety');
    process.exit(1);
  }
  
  // Require tweet_id
  if (!tweetId) {
    console.error('❌ ERROR: --tweet_id required');
    console.error('   Usage: pnpm run runner:seed-decision -- --tweet_id=1234567890');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 SEED TEST DECISION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Target tweet ID: ${tweetId}`);
  console.log(`RUNNER_MODE: ${RUNNER_MODE}`);
  console.log('');
  
  const supabase = getSupabaseClient();
  
  // Generate decision_id (UUID)
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  // Simple reply text
  const replyContent = "Quick note: sleep quality and sunlight timing matter more than most people think.";
  
  // Try to fetch actual tweet content from reply_opportunities if it exists
  let targetTweetSnapshot = "This is a test tweet content snapshot for CDP posting verification. It must be at least 20 characters long to pass FINAL_REPLY_GATE.";
  let targetTweetHash = "test_hash_" + Date.now();
  let targetUsername = null;
  
  const { data: opportunity } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_content, target_username')
    .eq('target_tweet_id', tweetId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (opportunity && opportunity.target_tweet_content) {
    targetTweetSnapshot = opportunity.target_tweet_content;
    targetUsername = opportunity.target_username;
    // Generate a simple hash (for testing, not cryptographically secure)
    const crypto = require('crypto');
    targetTweetHash = crypto.createHash('sha256').update(targetTweetSnapshot).digest('hex').substring(0, 32);
    console.log(`✅ Found tweet content in opportunities (${targetTweetSnapshot.length} chars)`);
  } else {
    console.log(`⚠️  Tweet ${tweetId} not found in opportunities, using test values`);
  }
  
  // Insert into content_metadata (what posting queue reads)
  const { data: inserted, error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      target_tweet_id: tweetId,
      target_username: targetUsername,
      root_tweet_id: tweetId, // For replies, root = target
      status: 'queued',
      scheduled_at: now, // Immediately ready (no future deferral)
      pipeline_source: 'reply_v2_scheduler',
      bandit_arm: 'test',
      topic_cluster: 'test',
      predicted_er: 0.5,
      quality_score: 0.8,
      is_test_post: true, // 🔒 TEST LANE: Mark as test post
      // Required fields for FINAL_REPLY_GATE
      target_tweet_content_snapshot: targetTweetSnapshot, // Must be >= 20 chars
      target_tweet_content_hash: targetTweetHash, // Required for context lock
      semantic_similarity: 0.75, // Must be >= 0.30
      // No retry deferral - features.retry_count = 0 (or not set)
      features: {
        retry_count: 0,
        seeded_for_testing: true,
        seeded_at: now
      },
      created_at: now,
      updated_at: now
    })
    .select('decision_id, scheduled_at, status, content')
    .single();
  
  if (error) {
    console.error('❌ Failed to insert test decision:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error details:', error.details);
    process.exit(1);
  }
  
  if (!inserted) {
    console.error('❌ No data returned from insert');
    process.exit(1);
  }
  
  console.log('✅ Test decision created successfully!');
  console.log('');
  console.log('📋 Decision Details:');
  console.log(`   decision_id: ${inserted.decision_id}`);
  console.log(`   status: ${inserted.status}`);
  console.log(`   scheduled_at: ${inserted.scheduled_at}`);
  console.log(`   content: "${inserted.content}"`);
  console.log(`   target_tweet_id: ${tweetId}`);
  console.log('');
  console.log('🧪 Next Steps:');
  console.log('   1. Run: RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \\');
  console.log('            POSTING_BYPASS_RETRY_DEFERRAL=true pnpm run runner:once -- --once');
  console.log('   2. Verify: pnpm exec tsx scripts/verify-post-success.ts --minutes=60');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
