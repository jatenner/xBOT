#!/usr/bin/env tsx
/**
 * P1 Watch Loop - Monitor until first post
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
  const { data: claimed } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, claimed_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('claimed_at', fiveMinAgo);
  
  // Runtime preflight breakdown last 30m
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('features')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinAgo);
  
  const runtimePreflightBreakdown = {
    ok: 0,
    failed: 0,
    null: 0,
    total: recentDecisions?.length || 0,
  };
  
  recentDecisions?.forEach(d => {
    const features = (d.features || {}) as any;
    const status = features.runtime_preflight_status;
    if (status === 'ok') runtimePreflightBreakdown.ok++;
    else if (status && status !== 'ok') runtimePreflightBreakdown.failed++;
    else runtimePreflightBreakdown.null++;
  });
  
  // Posted last 60m
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: posted } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, target_tweet_id, posted_tweet_id, posted_at, target_tweet_url')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .not('posted_tweet_id', 'is', null)
    .gte('posted_at', oneHourAgo)
    .order('posted_at', { ascending: false })
    .limit(1);
  
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] queued_now=${queuedNow || 0} claimed_last_5m=${claimed?.length || 0} runtime_preflight_ok=${runtimePreflightBreakdown.ok} failed=${runtimePreflightBreakdown.failed} null=${runtimePreflightBreakdown.null} posted_last_60m=${posted?.length || 0}`);
  
  if (posted && posted.length > 0) {
    const p = posted[0];
    const replyUrl = p.posted_tweet_id ? `https://x.com/i/status/${p.posted_tweet_id}` : 'N/A';
    console.log(`\n✅ FIRST POST DETECTED!`);
    console.log(`   decision_id: ${p.decision_id}`);
    console.log(`   target_tweet_id: ${p.target_tweet_id}`);
    console.log(`   posted_tweet_id: ${p.posted_tweet_id}`);
    console.log(`   reply_url: ${replyUrl}`);
    console.log(`   posted_at: ${p.posted_at}`);
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔍 P1 Watch Loop - Monitoring until first post...\n');
  
  while (true) {
    const found = await checkStatus();
    if (found) {
      process.exit(0);
    }
    await new Promise(resolve => setTimeout(resolve, 60000)); // 60s
  }
}

main().catch(console.error);
