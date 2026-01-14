#!/usr/bin/env tsx
/**
 * Verify POST_SUCCESS events and print posted tweet URLs
 * Usage: 
 *   railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
 *   railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts --decisionId=<uuid>
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const decisionIdArg = process.argv.find(arg => arg.startsWith('--decisionId='))?.split('=')[1];
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           ✅ POST SUCCESS VERIFICATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // If decision_id provided, check only that decision
  if (decisionIdArg) {
    console.log(`🎯 Checking specific decision_id: ${decisionIdArg}\n`);
    
    // Check reply_decisions
    const { data: decision, error: decisionError } = await supabase
      .from('reply_decisions')
      .select('decision_id, target_tweet_id, posted_reply_tweet_id, posting_completed_at, pipeline_error_reason, deny_reason_code, created_at')
      .eq('decision_id', decisionIdArg)
      .maybeSingle();
    
    if (decisionError) {
      console.error(`❌ Error querying reply_decisions: ${decisionError.message}`);
      process.exit(1);
    }
    
    if (!decision) {
      console.error(`❌ Decision not found: ${decisionIdArg}\n`);
      process.exit(1);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 DECISION RESULT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`decision_id: ${decision.decision_id}`);
    console.log(`target_tweet_id: ${decision.target_tweet_id}`);
    console.log(`created_at: ${decision.created_at}`);
    
    if (decision.posted_reply_tweet_id) {
      const tweetUrl = `https://x.com/i/status/${decision.posted_reply_tweet_id}`;
      console.log(`\n✅ POST_SUCCESS`);
      console.log(`posted_reply_tweet_id: ${decision.posted_reply_tweet_id}`);
      console.log(`posting_completed_at: ${decision.posting_completed_at || 'N/A'}`);
      console.log(`\n🎯 Tweet URL: ${tweetUrl}`);
      console.log(`📋 Target URL: https://x.com/i/status/${decision.target_tweet_id}\n`);
      
      // Check for POST_SUCCESS event
      const { data: successEvent } = await supabase
        .from('system_events')
        .select('event_data, created_at')
        .eq('event_type', 'POST_SUCCESS')
        .eq('event_data->>decision_id', decisionIdArg)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (successEvent) {
        console.log(`✅ POST_SUCCESS event found at: ${successEvent.created_at}`);
      }
    } else if (decision.pipeline_error_reason) {
      console.log(`\n❌ POST_FAILED`);
      console.log(`pipeline_error_reason: ${decision.pipeline_error_reason}`);
      console.log(`deny_reason_code: ${decision.deny_reason_code || 'N/A'}`);
      console.log(`posting_completed_at: ${decision.posting_completed_at || 'N/A'}\n`);
      
      // Check for POST_FAILED event for more details
      const { data: failedEvent } = await supabase
        .from('system_events')
        .select('event_data, created_at')
        .eq('event_type', 'POST_FAILED')
        .eq('event_data->>decision_id', decisionIdArg)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (failedEvent?.event_data) {
        const eventData = typeof failedEvent.event_data === 'string'
          ? JSON.parse(failedEvent.event_data)
          : failedEvent.event_data;
        console.log(`📋 Failure Details:`);
        console.log(`   Event timestamp: ${failedEvent.created_at}`);
        console.log(`   Error message: ${eventData.error_message || 'N/A'}`);
        console.log(`   Reason: ${eventData.reason || eventData.pipeline_error_reason || 'N/A'}`);
      }
      
      // Check content_metadata for additional context
      const { data: contentMeta } = await supabase
        .from('content_metadata')
        .select('status, error_message, skip_reason')
        .eq('decision_id', decisionIdArg)
        .maybeSingle();
      
      if (contentMeta) {
        console.log(`\n📋 Content Metadata Status:`);
        console.log(`   status: ${contentMeta.status}`);
        if (contentMeta.error_message) {
          console.log(`   error_message: ${contentMeta.error_message}`);
        }
        if (contentMeta.skip_reason) {
          console.log(`   skip_reason: ${contentMeta.skip_reason}`);
        }
      }
      
      console.log(`\n💡 What to try next:`);
      if (decision.pipeline_error_reason?.includes('CONSENT_WALL')) {
        console.log(`   - Wait 24h for consent wall to clear`);
        console.log(`   - Try a different tweet_id`);
      } else if (decision.pipeline_error_reason?.includes('target_not_found')) {
        console.log(`   - Tweet may have been deleted`);
        console.log(`   - Try a different tweet_id`);
      } else {
        console.log(`   - Check logs for detailed error`);
        console.log(`   - Verify tweet still exists: https://x.com/i/status/${decision.target_tweet_id}`);
      }
    } else {
      console.log(`\n⏳ Status: Still processing (check again in a moment)`);
      console.log(`   posting_completed_at: ${decision.posting_completed_at || 'N/A'}\n`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }
  
  
  // Check for POST_SUCCESS events in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: successEvents, error: eventsError } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (eventsError) {
    console.error(`❌ Error querying system_events: ${eventsError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 POST_SUCCESS Events (last 24h): ${successEvents?.length || 0}\n`);
  
  if (successEvents && successEvents.length > 0) {
    console.log('✅ Recent POST_SUCCESS events:\n');
    successEvents.forEach((event, i) => {
      const eventData = event.event_data as any;
      const tweetId = eventData?.posted_reply_tweet_id || eventData?.tweet_id;
      const targetId = eventData?.target_tweet_id;
      const decisionId = eventData?.decision_id;
      
      console.log(`${i + 1}. Posted at: ${event.created_at}`);
      if (decisionId) console.log(`   decision_id: ${decisionId}`);
      if (targetId) console.log(`   target_tweet_id: ${targetId}`);
      if (tweetId) {
        console.log(`   posted_reply_tweet_id: ${tweetId}`);
        console.log(`   🎯 Tweet URL: https://x.com/i/status/${tweetId}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️  No POST_SUCCESS events found in last 24h\n');
  }
  
  // Also check reply_decisions for recent posts
  const { data: recentPosts, error: postsError } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, posted_reply_tweet_id, created_at')
    .not('posted_reply_tweet_id', 'is', null)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (postsError) {
    console.error(`❌ Error querying reply_decisions: ${postsError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Recent successful posts (from reply_decisions): ${recentPosts?.length || 0}\n`);
  
  if (recentPosts && recentPosts.length > 0) {
    console.log('✅ Recent successful posts:\n');
    recentPosts.forEach((post, i) => {
      console.log(`${i + 1}. Posted at: ${post.created_at}`);
      console.log(`   decision_id: ${post.decision_id}`);
      console.log(`   target_tweet_id: ${post.target_tweet_id}`);
      console.log(`   posted_reply_tweet_id: ${post.posted_reply_tweet_id}`);
      console.log(`   🎯 Tweet URL: https://x.com/i/status/${post.posted_reply_tweet_id}`);
      console.log(`   📋 Target URL: https://x.com/i/status/${post.target_tweet_id}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No recent posts found in reply_decisions\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
