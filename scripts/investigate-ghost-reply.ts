/**
 * Investigate potential ghost reply
 * Searches for target tweet and bot reply in all relevant tables
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const TARGET_TEXT_SNIPPETS = [
  'swap that transformed my mood',
  'ripple effect on my life',
  'change influence the whole ecosystem',
  'swap that transformed',
  'ripple effect',
  'whole ecosystem of our BEING'
];

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 GHOST REPLY INVESTIGATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1) Search for target tweet
  console.log('1) Searching for target tweet...');
  let targetFound = false;
  let targetTweetId: string | null = null;
  
  for (const snippet of TARGET_TEXT_SNIPPETS) {
    // Search in reply_opportunities
    const { data: opps } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_username, target_tweet_content, is_reply_tweet, is_root_tweet, target_in_reply_to_tweet_id, root_tweet_id, created_at')
      .ilike('target_tweet_content', `%${snippet}%`)
      .limit(5);
    
    if (opps && opps.length > 0) {
      console.log(`   ✅ Found in reply_opportunities (${opps.length} records):`);
      opps.forEach(opp => {
        console.log(`      target_tweet_id: ${opp.target_tweet_id}`);
        console.log(`      target_username: ${opp.target_username}`);
        console.log(`      is_reply_tweet: ${opp.is_reply_tweet}`);
        console.log(`      is_root_tweet: ${opp.is_root_tweet}`);
        console.log(`      target_in_reply_to_tweet_id: ${opp.target_in_reply_to_tweet_id || 'NULL'}`);
        console.log(`      root_tweet_id: ${opp.root_tweet_id || 'NULL'}`);
        console.log(`      created_at: ${opp.created_at}`);
        console.log('');
        targetTweetId = opp.target_tweet_id;
        targetFound = true;
      });
      break;
    }
    
    // Search in content_generation_metadata_comprehensive (as target)
    const { data: targets } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('tweet_id, target_tweet_id, target_username, decision_type, status, created_at, posted_at')
      .ilike('content', `%${snippet}%`)
      .limit(5);
    
    if (targets && targets.length > 0) {
      console.log(`   ✅ Found in content_metadata (${targets.length} records):`);
      targets.forEach(t => {
        console.log(`      tweet_id: ${t.tweet_id || 'NULL'}`);
        console.log(`      target_tweet_id: ${t.target_tweet_id || 'NULL'}`);
        console.log(`      decision_type: ${t.decision_type}`);
        console.log(`      status: ${t.status}`);
        console.log(`      created_at: ${t.created_at}`);
        console.log('');
        if (t.tweet_id) targetTweetId = t.tweet_id;
        if (t.target_tweet_id) targetTweetId = t.target_tweet_id;
        targetFound = true;
      });
    }
  }
  
  if (!targetFound) {
    console.log('   ❌ Target tweet NOT FOUND in database');
    console.log('   ⚠️  This suggests the target tweet was never harvested/stored\n');
  }
  
  // 2) Search for bot reply
  console.log('2) Searching for bot reply...');
  let botReplyFound = false;
  
  if (targetTweetId) {
    const { data: replies } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, tweet_id, target_tweet_id, root_tweet_id, target_username, decision_type, status, LEFT(content, 150) as content_preview, created_at, posted_at, pipeline_source')
      .eq('target_tweet_id', targetTweetId)
      .eq('decision_type', 'reply')
      .order('created_at', 'desc')
      .limit(10);
    
    if (replies && replies.length > 0) {
      console.log(`   ✅ Found bot reply(ies) (${replies.length} records):`);
      replies.forEach(reply => {
        console.log(`      decision_id: ${reply.decision_id}`);
        console.log(`      tweet_id: ${reply.tweet_id || 'NOT POSTED YET'}`);
        console.log(`      target_tweet_id: ${reply.target_tweet_id}`);
        console.log(`      root_tweet_id: ${reply.root_tweet_id || 'NULL'}`);
        console.log(`      status: ${reply.status}`);
        console.log(`      content_preview: ${reply.content_preview?.substring(0, 100) || 'N/A'}...`);
        console.log(`      created_at: ${reply.created_at}`);
        console.log(`      posted_at: ${reply.posted_at || 'NOT POSTED'}`);
        console.log(`      pipeline_source: ${reply.pipeline_source || 'N/A'}`);
        console.log('');
        botReplyFound = true;
      });
    } else {
      console.log(`   ❌ Bot reply NOT FOUND for target_tweet_id=${targetTweetId}`);
    }
  } else {
    // Search without target_tweet_id
    const { data: recentReplies } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, tweet_id, target_tweet_id, decision_type, status, LEFT(content, 150) as content_preview, created_at, posted_at')
      .eq('decision_type', 'reply')
      .gte('created_at', '2026-01-07 23:00:00')
      .lte('created_at', '2026-01-08 01:00:00')
      .order('created_at', 'desc')
      .limit(20);
    
    if (recentReplies && recentReplies.length > 0) {
      console.log(`   Found ${recentReplies.length} replies in time window:`);
      recentReplies.forEach(reply => {
        console.log(`      decision_id: ${reply.decision_id}`);
        console.log(`      tweet_id: ${reply.tweet_id || 'NOT POSTED'}`);
        console.log(`      target_tweet_id: ${reply.target_tweet_id || 'NULL'}`);
        console.log(`      status: ${reply.status}`);
        console.log(`      created_at: ${reply.created_at}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No replies found in time window (Jan 7, 2026 23:00-01:00)');
    }
  }
  
  // 3) Check system_events
  console.log('3) Checking system_events trail...');
  const { data: events } = await supabase
    .from('system_events')
    .select('event_type, severity, message, event_data, created_at')
    .gte('created_at', '2026-01-07 23:00:00')
    .lte('created_at', '2026-01-08 01:00:00')
    .or('event_type.ilike.%reply%,event_type.ilike.%post%,message.ilike.%swap%,message.ilike.%mood%')
    .order('created_at', 'desc')
    .limit(20);
  
  if (events && events.length > 0) {
    console.log(`   ✅ Found ${events.length} system events:`);
    events.forEach(event => {
      console.log(`      ${event.created_at}: [${event.severity}] ${event.event_type} - ${event.message || 'N/A'}`);
    });
  } else {
    console.log('   ⚠️  No relevant system events found');
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('EVIDENCE SUMMARY:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Target tweet found: ${targetFound ? 'YES' : 'NO'}`);
  console.log(`Target tweet_id: ${targetTweetId || 'NOT FOUND'}`);
  console.log(`Bot reply found in DB: ${botReplyFound ? 'YES' : 'NO'}`);
  console.log(`System events trail exists: ${events && events.length > 0 ? 'YES' : 'NO'}`);
  
  if (!targetFound && !botReplyFound) {
    console.log('\n🚨 CLASSIFICATION: Cannot determine - target tweet not in DB');
    console.log('   This could mean:');
    console.log('   1. Target tweet was never harvested');
    console.log('   2. Target tweet is from a different account/time');
    console.log('   3. Ghost reply occurred (reply exists on X but not in DB)');
  } else if (targetFound && !botReplyFound) {
    console.log('\n🚨 CLASSIFICATION: POTENTIAL GHOST REPLY');
    console.log('   Target tweet exists in DB but bot reply does not');
    console.log('   If reply exists on X, this is Category B: Ghost/bypass');
  } else if (targetFound && botReplyFound) {
    console.log('\n✅ CLASSIFICATION: No ghost - both target and reply in DB');
  }
  
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);

