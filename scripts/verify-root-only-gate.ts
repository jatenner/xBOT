#!/usr/bin/env tsx
/**
 * 🔒 VERIFY ROOT-ONLY GATE
 * 
 * TASK C: Test both cases:
 * - Known root tweet id -> passes root gate
 * - Known reply tweet id -> blocked with SAFETY_GATE_NON_ROOT_TARGET
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/verify-root-only-gate.ts --rootTweetId=<id> --replyTweetId=<id>
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry, shouldAllowReply } from '../src/jobs/replySystemV2/replyDecisionRecorder';

async function main() {
  const rootTweetId = process.argv.find(arg => arg.startsWith('--rootTweetId='))?.split('=')[1];
  const replyTweetId = process.argv.find(arg => arg.startsWith('--replyTweetId='))?.split('=')[1];
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔒 ROOT-ONLY GATE VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // Test Case 1: Root tweet should PASS
  if (rootTweetId) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           TEST CASE 1: ROOT TWEET (Should PASS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Tweet ID: ${rootTweetId}\n`);
    
    // Clear cache
    await supabase
      .from('reply_ancestry_cache')
      .delete()
      .eq('tweet_id', rootTweetId);
    
    const ancestry = await resolveTweetAncestry(rootTweetId);
    const allowCheck = await shouldAllowReply(ancestry);
    
    console.log('📊 Ancestry Resolution:');
    console.log(`   target_tweet_id: ${ancestry.targetTweetId}`);
    console.log(`   root_tweet_id: ${ancestry.rootTweetId || 'NULL'}`);
    console.log(`   target_in_reply_to_tweet_id: ${ancestry.targetInReplyToTweetId || 'NULL'}`);
    console.log(`   ancestry_depth: ${ancestry.ancestryDepth ?? 'NULL'}`);
    console.log(`   is_root: ${ancestry.isRoot}`);
    console.log(`   status: ${ancestry.status}`);
    console.log(`   method: ${ancestry.method}\n`);
    
    console.log('📊 Gate Check Result:');
    console.log(`   allow: ${allowCheck.allow ? '✅ YES' : '❌ NO'}`);
    console.log(`   reason: ${allowCheck.reason}`);
    if (allowCheck.deny_reason_code) {
      console.log(`   deny_reason_code: ${allowCheck.deny_reason_code}`);
    }
    console.log('');
    
    if (allowCheck.allow) {
      console.log('✅ TEST PASSED: Root tweet correctly allowed\n');
    } else {
      console.log('❌ TEST FAILED: Root tweet was blocked (should be allowed)\n');
    }
  }
  
  // Test Case 2: Reply tweet should FAIL
  if (replyTweetId) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           TEST CASE 2: REPLY TWEET (Should BLOCK)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Tweet ID: ${replyTweetId}\n`);
    
    // Clear cache
    await supabase
      .from('reply_ancestry_cache')
      .delete()
      .eq('tweet_id', replyTweetId);
    
    const ancestry = await resolveTweetAncestry(replyTweetId);
    const allowCheck = await shouldAllowReply(ancestry);
    
    console.log('📊 Ancestry Resolution:');
    console.log(`   target_tweet_id: ${ancestry.targetTweetId}`);
    console.log(`   root_tweet_id: ${ancestry.rootTweetId || 'NULL'}`);
    console.log(`   target_in_reply_to_tweet_id: ${ancestry.targetInReplyToTweetId || 'NULL'}`);
    console.log(`   ancestry_depth: ${ancestry.ancestryDepth ?? 'NULL'}`);
    console.log(`   is_root: ${ancestry.isRoot}`);
    console.log(`   status: ${ancestry.status}`);
    console.log(`   method: ${ancestry.method}\n`);
    
    console.log('📊 Gate Check Result:');
    console.log(`   allow: ${allowCheck.allow ? '❌ YES (SHOULD BE NO!)' : '✅ NO'}`);
    console.log(`   reason: ${allowCheck.reason}`);
    if (allowCheck.deny_reason_code) {
      console.log(`   deny_reason_code: ${allowCheck.deny_reason_code}`);
      if (allowCheck.deny_reason_code === 'NON_ROOT') {
        console.log(`   ✅ Correct deny_reason_code: NON_ROOT`);
      }
    }
    console.log('');
    
    if (!allowCheck.allow && allowCheck.deny_reason_code === 'NON_ROOT') {
      console.log('✅ TEST PASSED: Reply tweet correctly blocked with NON_ROOT\n');
    } else if (allowCheck.allow) {
      console.log('❌ TEST FAILED: Reply tweet was allowed (should be blocked!)\n');
    } else {
      console.log(`⚠️  TEST PARTIAL: Reply tweet was blocked but with wrong code: ${allowCheck.deny_reason_code}\n`);
    }
  }
  
  // Check recent POST_FAILED events with NON_ROOT
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           RECENT POST_FAILED WITH NON_ROOT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: failedEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (failedEvents && failedEvents.length > 0) {
    const nonRootFailures = failedEvents.filter(e => {
      const eventData = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
      return eventData.deny_reason_code === 'NON_ROOT' || 
             eventData.reason?.includes('NON_ROOT') ||
             eventData.reason?.includes('SAFETY_GATE_NON_ROOT');
    });
    
    console.log(`Found ${nonRootFailures.length} POST_FAILED events with NON_ROOT (last 24h):\n`);
    
    nonRootFailures.forEach((event, i) => {
      const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
      console.log(`${i + 1}. Created: ${event.created_at}`);
      console.log(`   decision_id: ${eventData.decision_id || 'N/A'}`);
      console.log(`   target_tweet_id: ${eventData.target_tweet_id || 'N/A'}`);
      console.log(`   in_reply_to_status_id: ${eventData.in_reply_to_status_id || 'NULL'}`);
      console.log(`   deny_reason_code: ${eventData.deny_reason_code || 'N/A'}`);
      console.log(`   reason: ${eventData.reason || 'N/A'}`);
      console.log('');
    });
    
    if (nonRootFailures.length > 0) {
      console.log('✅ Gate is working: Non-root tweets are being blocked\n');
    }
  } else {
    console.log('ℹ️  No POST_FAILED events with NON_ROOT found in last 24h\n');
  }
  
  // Check reply_decisions for recent NON_ROOT denies
  const { data: nonRootDecisions } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, deny_reason_code, created_at')
    .eq('deny_reason_code', 'NON_ROOT')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (nonRootDecisions && nonRootDecisions.length > 0) {
    console.log(`Found ${nonRootDecisions.length} reply_decisions with NON_ROOT deny (last 24h):\n`);
    nonRootDecisions.forEach((d, i) => {
      console.log(`${i + 1}. Created: ${d.created_at}`);
      console.log(`   decision_id: ${d.decision_id}`);
      console.log(`   target_tweet_id: ${d.target_tweet_id}`);
      console.log(`   deny_reason_code: ${d.deny_reason_code}`);
      console.log('');
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
