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
      const preflightStatus = features.preflight_status || features.preflight_ok ? 'ok' : 'unknown';
      const runtimePreflightStatus = features.runtime_preflight_status || 'unknown';
      const ageMs = Date.now() - new Date(d.created_at).getTime();
      const ageMin = Math.round(ageMs / 1000 / 60);
      console.log(`   ${i + 1}. ${d.decision_id?.substring(0, 8)}... status=${d.status} source=${d.pipeline_source} target=${d.target_tweet_id}`);
      console.log(`      preflight=${preflightStatus} runtime_preflight=${runtimePreflightStatus} age=${ageMin}m`);
    });
  } else {
    console.log('   No decisions found');
  }
  
  // Query 2: Count queued now
  const { count: queuedNow } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .eq('status', 'queued');
  
  console.log(`\n2️⃣ Count queued now: ${queuedNow || 0}`);
  
  // Query 3: Runtime preflight breakdown
  const { data: runtimeDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('features, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
  
  const runtimeBreakdown: Record<string, number> = {};
  if (runtimeDecisions) {
    runtimeDecisions.forEach(d => {
      const features = (d.features || {}) as any;
      const status = features.runtime_preflight_status || 'unknown';
      runtimeBreakdown[status] = (runtimeBreakdown[status] || 0) + 1;
    });
  }
  
  console.log(`\n3️⃣ Runtime preflight breakdown (last 30m):`);
  Object.entries(runtimeBreakdown).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  // Query 4: Posted tweets
  const { data: posted } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, target_tweet_id, posted_tweet_id, target_tweet_url, created_at, posted_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .not('posted_tweet_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(5);
  
  console.log(`\n4️⃣ Posted tweets (last 60m): ${posted?.length || 0}`);
  if (posted && posted.length > 0) {
    posted.forEach((p, i) => {
      const url = p.target_tweet_url || `https://x.com/i/status/${p.target_tweet_id}`;
      const replyUrl = p.posted_tweet_id ? `https://x.com/i/status/${p.posted_tweet_id}` : 'N/A';
      console.log(`   ${i + 1}. decision=${p.decision_id?.substring(0, 8)}... target=${p.target_tweet_id} reply=${p.posted_tweet_id}`);
      console.log(`      reply_url=${replyUrl}`);
    });
  }
}

main().catch(console.error);
