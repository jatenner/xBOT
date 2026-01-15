#!/usr/bin/env tsx
/**
 * Check bad tweet and trace why it was posted
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry } from '../src/jobs/replySystemV2/replyDecisionRecorder';

async function main() {
  const tweetId = process.argv.find(arg => arg.startsWith('--tweetId='))?.split('=')[1];
  
  if (!tweetId) {
    console.error('Usage: railway run -s xBOT -- pnpm exec tsx scripts/check-bad-tweet.ts --tweetId=<id>');
    process.exit(1);
  }
  
  console.log(`Checking tweet: ${tweetId}\n`);
  const supabase = getSupabaseClient();
  
  // Check content_metadata
  const { data: contentMeta } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('tweet_id', tweetId)
    .maybeSingle();
  
  if (contentMeta) {
    console.log('✅ Found in content_metadata:');
    console.log(`   decision_id: ${contentMeta.decision_id}`);
    console.log(`   target_tweet_id: ${contentMeta.target_tweet_id}`);
    console.log(`   decision_type: ${contentMeta.decision_type}`);
    console.log(`   status: ${contentMeta.status}`);
    console.log(`   created_at: ${contentMeta.created_at}`);
    console.log(`   pipeline_source: ${contentMeta.pipeline_source || 'N/A'}`);
    console.log(`   build_sha: ${contentMeta.build_sha || 'N/A'}`);
    
    // Check reply_decisions
    if (contentMeta.decision_id) {
      const { data: replyDecision } = await supabase
        .from('reply_decisions')
        .select('*')
        .eq('decision_id', contentMeta.decision_id)
        .maybeSingle();
      
      if (replyDecision) {
        console.log('\n✅ Found in reply_decisions:');
        console.log(`   target_in_reply_to_tweet_id: ${replyDecision.target_in_reply_to_tweet_id || 'NULL'}`);
        console.log(`   is_root: ${replyDecision.is_root}`);
        console.log(`   ancestry_depth: ${replyDecision.ancestry_depth}`);
        console.log(`   decision: ${replyDecision.decision}`);
        console.log(`   deny_reason_code: ${replyDecision.deny_reason_code || 'N/A'}`);
        
        // Resolve ancestry now
        if (contentMeta.target_tweet_id) {
          console.log(`\n🔍 Resolving ancestry for target: ${contentMeta.target_tweet_id}...`);
          const ancestry = await resolveTweetAncestry(contentMeta.target_tweet_id);
          console.log(`   target_in_reply_to_tweet_id: ${ancestry.targetInReplyToTweetId || 'NULL'}`);
          console.log(`   is_root: ${ancestry.isRoot}`);
          console.log(`   ancestry_depth: ${ancestry.ancestryDepth}`);
          console.log(`   status: ${ancestry.status}`);
          
          if (ancestry.targetInReplyToTweetId !== null) {
            console.log(`\n❌ PROBLEM: Target is a reply! Should have been blocked.`);
            console.log(`   Target replies to: ${ancestry.targetInReplyToTweetId}`);
          }
        }
      }
    }
    
    // Check system_events
    if (contentMeta.decision_id) {
      const { data: events } = await supabase
        .from('system_events')
        .select('*')
        .contains('event_data', { decision_id: contentMeta.decision_id })
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (events && events.length > 0) {
        console.log(`\n📊 System Events (${events.length}):`);
        events.forEach((e, i) => {
          const eventData = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
          console.log(`   ${i + 1}. ${e.event_type} (${e.created_at})`);
          if (eventData.app_version) console.log(`      app_version: ${eventData.app_version}`);
          if (eventData.deny_reason_code) console.log(`      deny_reason_code: ${eventData.deny_reason_code}`);
        });
      }
    }
  } else {
    console.log('❌ Not found in content_metadata');
    console.log('   This tweet may have been posted before reply_decisions table existed');
    console.log('   or through a different pipeline.');
  }
}

main().catch(console.error);
