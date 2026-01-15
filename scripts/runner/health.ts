#!/usr/bin/env tsx
/**
 * 🏥 MAC RUNNER HEALTH CHECK
 * 
 * Prints last success/failure timestamps and current backoff state.
 * 
 * Usage:
 *   pnpm exec tsx scripts/runner/health.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🏥 MAC RUNNER HEALTH CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Get last POST_SUCCESS
  const { data: lastSuccess } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get last POST_FAILED
  const { data: lastFailure } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'POST_FAILED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get last RUNNER_ALERT (backoff)
  const { data: lastAlert } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'RUNNER_ALERT')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get recent POST_SUCCESS count (last 24h)
  const { count: successCount24h } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Get recent POST_FAILED count (last 24h)
  const { count: failureCount24h } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  console.log('📊 Last 24 Hours:');
  console.log(`   POST_SUCCESS: ${successCount24h || 0}`);
  console.log(`   POST_FAILED: ${failureCount24h || 0}\n`);

  console.log('⏰ Last Events:');
  if (lastSuccess) {
    const eventData = typeof lastSuccess.event_data === 'string'
      ? JSON.parse(lastSuccess.event_data)
      : lastSuccess.event_data || {};
    const tweetUrl = eventData.tweet_url || `https://x.com/i/status/${eventData.posted_reply_tweet_id || 'N/A'}`;
    console.log(`   ✅ Last POST_SUCCESS: ${lastSuccess.created_at}`);
    console.log(`      Tweet URL: ${tweetUrl}`);
    console.log(`      Decision ID: ${eventData.decision_id || 'N/A'}`);
  } else {
    console.log(`   ⚠️  No POST_SUCCESS events found`);
  }

  if (lastFailure) {
    const eventData = typeof lastFailure.event_data === 'string'
      ? JSON.parse(lastFailure.event_data)
      : lastFailure.event_data || {};
    const reason = eventData.deny_reason_code || eventData.reason || lastFailure.message || 'unknown';
    console.log(`   ❌ Last POST_FAILED: ${lastFailure.created_at}`);
    console.log(`      Reason: ${reason}`);
  } else {
    console.log(`   ✅ No POST_FAILED events found`);
  }

  if (lastAlert) {
    const eventData = typeof lastAlert.event_data === 'string'
      ? JSON.parse(lastAlert.event_data)
      : lastAlert.event_data || {};
    const backoffUntil = eventData.backoff_until || 'unknown';
    const reason = eventData.reason || lastAlert.message || 'unknown';
    const now = Date.now();
    const untilTs = new Date(backoffUntil).getTime();
    const isActive = untilTs > now;
    
    console.log(`\n⏸️  Backoff State:`);
    console.log(`   Active: ${isActive ? 'YES' : 'NO'}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Until: ${backoffUntil}`);
    if (isActive) {
      const remainingMinutes = Math.ceil((untilTs - now) / 60000);
      console.log(`   Remaining: ${remainingMinutes} minutes`);
    }
  } else {
    console.log(`\n⏸️  Backoff State: NO ACTIVE BACKOFF`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Health check failed:', error);
  process.exit(1);
});
