#!/usr/bin/env tsx
/**
 * Verify POST_SUCCESS and POST_FAILED events
 * Usage: pnpm exec tsx scripts/verify-post-success.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           ✅ POST SUCCESS VERIFICATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Get POST_SUCCESS events
  const { data: successEvents, error: successError } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (successError) {
    console.error(`❌ Error querying POST_SUCCESS: ${successError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 POST_SUCCESS Events (Last 24h): ${successEvents?.length || 0}\n`);
  
  if (successEvents && successEvents.length > 0) {
    console.log('Newest 5 POST_SUCCESS events:\n');
    successEvents.slice(0, 5).forEach((event: any, idx: number) => {
      const data = event.event_data || {};
      const timestamp = new Date(event.created_at).toISOString();
      const decisionId = data.decision_id || 'unknown';
      const targetTweetId = data.target_tweet_id || 'unknown';
      const postedTweetId = data.posted_reply_tweet_id || 'unknown';
      const templateId = data.template_id || 'null';
      const promptVersion = data.prompt_version || 'null';
      
      console.log(`${idx + 1}. ${timestamp}`);
      console.log(`   decision_id: ${decisionId}`);
      console.log(`   target_tweet_id: ${targetTweetId}`);
      console.log(`   posted_reply_tweet_id: ${postedTweetId}`);
      console.log(`   template_id: ${templateId}, prompt_version: ${promptVersion}`);
      console.log(`   Tweet URL: https://x.com/i/status/${postedTweetId}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No POST_SUCCESS events in last 24h\n');
  }
  
  // Get POST_FAILED events
  const { data: failedEvents, error: failedError } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false });
  
  if (failedError) {
    console.error(`❌ Error querying POST_FAILED: ${failedError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 POST_FAILED Events (Last 24h): ${failedEvents?.length || 0}\n`);
  
  if (failedEvents && failedEvents.length > 0) {
    // Count by error reason
    const errorCounts = new Map<string, number>();
    failedEvents.forEach((event: any) => {
      const data = event.event_data || {};
      const reason = data.pipeline_error_reason || data.skip_reason || 'UNKNOWN';
      errorCounts.set(reason, (errorCounts.get(reason) || 0) + 1);
    });
    
    console.log('Top error reasons:\n');
    Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([reason, count], idx) => {
        console.log(`  ${idx + 1}. ${reason}: ${count} failures`);
      });
    
    console.log('\nNewest 5 POST_FAILED events:\n');
    failedEvents.slice(0, 5).forEach((event: any, idx: number) => {
      const data = event.event_data || {};
      const timestamp = new Date(event.created_at).toISOString();
      const decisionId = data.decision_id || 'unknown';
      const targetTweetId = data.target_tweet_id || 'unknown';
      const errorReason = data.pipeline_error_reason || data.skip_reason || 'unknown';
      const errorMessage = data.error_message || null;
      
      console.log(`${idx + 1}. ${timestamp}`);
      console.log(`   decision_id: ${decisionId}`);
      console.log(`   target_tweet_id: ${targetTweetId}`);
      console.log(`   pipeline_error_reason: ${errorReason}`);
      if (errorMessage) {
        console.log(`   error_message: ${errorMessage}`);
      }
      console.log('');
    });
  } else {
    console.log('✅ No POST_FAILED events in last 24h\n');
  }
  
  // Summary
  const successCount = successEvents?.length || 0;
  const failedCount = failedEvents?.length || 0;
  const total = successCount + failedCount;
  const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : 'N/A';
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📈 Summary (Last 24h):`);
  console.log(`   POST_SUCCESS: ${successCount}`);
  console.log(`   POST_FAILED: ${failedCount}`);
  console.log(`   Success Rate: ${successRate}%`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
