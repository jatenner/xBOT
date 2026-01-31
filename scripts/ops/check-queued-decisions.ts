#!/usr/bin/env tsx
/**
 * Check Queued Decisions for P1
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Queued Decisions Check');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Query 1: Queued decisions (last 2h)
  const { data: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, pipeline_source, target_tweet_id, features, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log('1️⃣ Queued decisions (last 2h):');
  if (decisions && decisions.length > 0) {
    decisions.forEach((d, i) => {
      const features = (d.features || {}) as any;
      const ageMin = Math.round((Date.now() - new Date(d.created_at).getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. ${d.decision_id?.substring(0, 8)}... status=${d.status} source=${d.pipeline_source} target=${d.target_tweet_id}`);
      console.log(`      preflight_status=${features.preflight_status || 'null'} runtime_preflight_status=${features.runtime_preflight_status || 'null'} age=${ageMin}m`);
    });
  } else {
    console.log('   None');
  }
  
  // Query 2: Count queued now
  const { count: queuedNow } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .eq('status', 'queued');
  
  console.log(`\n2️⃣ Count queued now: ${queuedNow || 0}`);
  
  // Query 3: Runtime preflight breakdown (last 30m)
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
  
  console.log(`\n3️⃣ Runtime preflight breakdown (last 30m):`);
  console.log(`   ok: ${runtimePreflightBreakdown.ok}`);
  console.log(`   failed: ${runtimePreflightBreakdown.failed}`);
  console.log(`   null: ${runtimePreflightBreakdown.null}`);
  console.log(`   total: ${runtimePreflightBreakdown.total}`);
  
  // Query 4: Posted last 60m
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: posted } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, target_tweet_id, posted_tweet_id, posted_at, target_tweet_url')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .not('posted_tweet_id', 'is', null)
    .gte('posted_at', oneHourAgo)
    .order('posted_at', { ascending: false })
    .limit(5);
  
  console.log(`\n4️⃣ Posted last 60m: ${posted?.length || 0}`);
  if (posted && posted.length > 0) {
    posted.forEach((p, i) => {
      const replyUrl = p.posted_tweet_id ? `https://x.com/i/status/${p.posted_tweet_id}` : 'N/A';
      console.log(`   ${i + 1}. ${p.decision_id?.substring(0, 8)}... posted_tweet_id=${p.posted_tweet_id} url=${replyUrl}`);
    });
  }
}

main().catch(console.error);
