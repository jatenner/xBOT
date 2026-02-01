#!/usr/bin/env tsx
/**
 * P1 Watch Loop - Monitor executor until first post
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function checkStatus() {
  const supabase = getSupabaseClient();
  
  // Queued now
  const { count: queuedNow } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .eq('status', 'queued');
  
  // Claimed last 5m
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: claimedLast5m } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'EXECUTOR_DECISION_CLAIM_OK')
    .gte('created_at', fiveMinAgo);
  
  // Runtime preflight breakdown last 30m
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: runtimeDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('features')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinAgo);
  
  const runtimeBreakdown: Record<string, number> = {};
  if (runtimeDecisions) {
    runtimeDecisions.forEach(d => {
      const features = (d.features || {}) as any;
      const status = features.runtime_preflight_status || 'unknown';
      runtimeBreakdown[status] = (runtimeBreakdown[status] || 0) + 1;
    });
  }
  
  // Posted last 60m
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: posted } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, target_tweet_id, posted_tweet_id, target_tweet_url, posted_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .not('posted_tweet_id', 'is', null)
    .gte('created_at', oneHourAgo)
    .order('posted_at', { ascending: false })
    .limit(1);
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] queued_now=${queuedNow || 0} claimed_last_5m=${claimedLast5m || 0}`);
  console.log(`  runtime_preflight: ${JSON.stringify(runtimeBreakdown)}`);
  
  if (posted && posted.length > 0) {
    const p = posted[0];
    const replyUrl = p.posted_tweet_id ? `https://x.com/i/status/${p.posted_tweet_id}` : 'N/A';
    console.log(`\n🎉 POSTED! decision=${p.decision_id?.substring(0, 8)}... target=${p.target_tweet_id} reply=${p.posted_tweet_id}`);
    console.log(`   reply_url=${replyUrl}`);
    return true; // Exit signal
  }
  
  return false;
}

async function main() {
  console.log('🔍 P1 Watch Loop - Monitoring until first post...\n');
  
  let iteration = 0;
  while (true) {
    iteration++;
    const shouldExit = await checkStatus();
    
    if (shouldExit) {
      console.log('\n✅ First post detected - exiting watch loop');
      process.exit(0);
    }
    
    if (iteration % 10 === 0) {
      console.log(`   (${iteration} iterations, continuing...)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 60000)); // 60s
  }
}

main().catch(console.error);
