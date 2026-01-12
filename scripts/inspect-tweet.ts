#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC INSPECTION: Inspect a tweet ID and show ancestry + bot decision evidence
 * 
 * Usage: pnpm run inspect:tweet -- <tweetId>
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry, shouldAllowReply } from '../src/jobs/replySystemV2/replyDecisionRecorder';

async function inspectTweet(tweetId: string) {
  console.log(`\n🔍 INSPECTING TWEET: ${tweetId}\n`);
  console.log('═'.repeat(80));
  
  const supabase = getSupabaseClient();
  
  // 1. Resolve ancestry
  console.log('\n📊 ANCESTRY ANALYSIS:');
  console.log('-'.repeat(80));
  try {
    const ancestry = await resolveTweetAncestry(tweetId);
    console.log(`  Target Tweet ID: ${ancestry.targetTweetId}`);
    console.log(`  Target In Reply To: ${ancestry.targetInReplyToTweetId || 'NONE (root tweet)'}`);
    console.log(`  Root Tweet ID: ${ancestry.rootTweetId}`);
    console.log(`  Ancestry Depth: ${ancestry.ancestryDepth} (0 = root, 1+ = reply depth)`);
    console.log(`  Is Root: ${ancestry.isRoot ? '✅ YES' : '❌ NO'}`);
    
    // 2. Check if bot would allow
    const allowCheck = shouldAllowReply(ancestry);
    console.log(`\n  Bot Decision: ${allowCheck.allow ? '✅ ALLOW' : '🚫 DENY'}`);
    console.log(`  Reason: ${allowCheck.reason}`);
  } catch (error: any) {
    console.error(`  ❌ Error resolving ancestry: ${error.message}`);
  }
  
  // 3. Check decision records
  console.log('\n📋 DECISION RECORDS:');
  console.log('-'.repeat(80));
  try {
    const { data: decisions, error } = await supabase
      .from('reply_decisions')
      .select('*')
      .eq('target_tweet_id', tweetId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error(`  ❌ Error querying decisions: ${error.message}`);
    } else if (!decisions || decisions.length === 0) {
      console.log(`  ℹ️  No decision records found for this tweet`);
    } else {
      console.log(`  Found ${decisions.length} decision record(s):\n`);
      decisions.forEach((d, i) => {
        console.log(`  [${i + 1}] Decision ID: ${d.id}`);
        console.log(`      Created: ${d.created_at}`);
        console.log(`      Decision: ${d.decision}`);
        console.log(`      Depth: ${d.ancestry_depth}, Is Root: ${d.is_root}`);
        console.log(`      Root Tweet ID: ${d.root_tweet_id}`);
        console.log(`      Reason: ${d.reason || 'N/A'}`);
        console.log(`      Posted: ${d.posted_reply_tweet_id || 'NO'}`);
        console.log(`      Error: ${d.error || 'NONE'}`);
        console.log('');
      });
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  
  // 4. Check content_metadata records
  console.log('\n📝 CONTENT METADATA RECORDS:');
  console.log('-'.repeat(80));
  try {
    const { data: metadata, error } = await supabase
      .from('content_metadata')
      .select('decision_id, target_tweet_id, root_tweet_id, status, tweet_id, posted_at')
      .eq('target_tweet_id', tweetId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error(`  ❌ Error querying metadata: ${error.message}`);
    } else if (!metadata || metadata.length === 0) {
      console.log(`  ℹ️  No content_metadata records found`);
    } else {
      console.log(`  Found ${metadata.length} record(s):\n`);
      metadata.forEach((m, i) => {
        console.log(`  [${i + 1}] Decision ID: ${m.decision_id}`);
        console.log(`      Target: ${m.target_tweet_id}`);
        console.log(`      Root: ${m.root_tweet_id || 'NOT SET'}`);
        console.log(`      Status: ${m.status}`);
        console.log(`      Posted Tweet ID: ${m.tweet_id || 'NOT POSTED'}`);
        console.log(`      Posted At: ${m.posted_at || 'N/A'}`);
        console.log('');
      });
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  
  console.log('═'.repeat(80));
  console.log('\n✅ Inspection complete\n');
}

// Main
const tweetId = process.argv[2];
if (!tweetId) {
  console.error('Usage: pnpm run inspect:tweet -- <tweetId>');
  process.exit(1);
}

inspectTweet(tweetId).catch((error) => {
  console.error('❌ Inspection failed:', error);
  process.exit(1);
});
