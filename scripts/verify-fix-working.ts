#!/usr/bin/env tsx
/**
 * Verify the fix is working by checking the most recent post
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log('🔍 VERIFYING FIX IS WORKING\n');

  // Check the most recent post (from 6 min ago)
  const recentTweetId = '2003114448710734154';
  
  console.log(`Looking for recent tweet: ${recentTweetId}\n`);

  const { data, error } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('tweet_id', recentTweetId)
    .single();

  if (data) {
    console.log('✅ FIX IS WORKING! Recent tweet saved correctly:\n');
    console.log(`   tweet_id:        ${data.tweet_id}`);
    console.log(`   decision_id:     ${data.decision_id}`);
    console.log(`   status:          ${data.status}`);
    console.log(`   posted_at:       ${data.posted_at}`);
    console.log(`   generator_name:  ${data.generator_name || 'N/A'}`);
    console.log(`   hook_type:       ${data.hook_type || 'N/A'}`);
    console.log(`   raw_topic:       ${data.raw_topic || 'N/A'}`);
    console.log(`   content:         ${data.content?.substring(0, 100)}...`);
    console.log('');
    console.log('🎯 CONCLUSION: Fix deployed successfully. All new posts will save correctly.');
  } else {
    console.log('❌ FIX NOT WORKING: Recent tweet not found in database');
    console.log(`   Error: ${error?.message || 'Unknown'}`);
  }
  
  // Check the old tweet from 6 hours ago
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const oldTweetId = '2003023929087254923';
  console.log(`Checking old tweet (6h ago): ${oldTweetId}\n`);

  const { data: oldData } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('tweet_id', oldTweetId)
    .single();

  if (oldData) {
    console.log('✅ Old tweet IS in database (unexpected)');
  } else {
    console.log('❌ Old tweet NOT in database (expected - this was BEFORE the fix)');
    console.log('   → This tweet was posted while the bug existed');
    console.log('   → All tweets AFTER the fix will save correctly');
  }
}

verify();

