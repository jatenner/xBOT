#!/usr/bin/env tsx
/**
 * Quick P1 Status Check
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  // Check opportunities
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('replied_to, tweet_posted_at, is_root_tweet')
    .eq('is_root_tweet', true);
  
  const unclaimedRoots = opps?.filter(o => !o.replied_to && o.is_root_tweet) || [];
  const now = Date.now();
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;
  const fresh3h = unclaimedRoots.filter(o => 
    o.tweet_posted_at && new Date(o.tweet_posted_at).getTime() > threeHoursAgo
  ).length;
  
  console.log(`📊 Opportunities: ${unclaimedRoots.length} unclaimed roots, ${fresh3h} fresh (<3h)`);
  
  // Check decisions last 30m
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, features, posted_tweet_id, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinAgo);
  
  const queued = decisions?.filter(d => d.status === 'queued').length || 0;
  const runtimeOk = decisions?.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'ok';
  }).length || 0;
  const posted = decisions?.filter(d => d.posted_tweet_id).length || 0;
  
  console.log(`📋 Decisions (last 30m): ${decisions?.length || 0} total, ${queued} queued, ${runtimeOk} runtime_ok, ${posted} posted`);
  
  if (posted > 0) {
    const postedDecisions = decisions?.filter(d => d.posted_tweet_id) || [];
    console.log(`\n✅ POSTED REPLIES:`);
    postedDecisions.forEach(d => {
      const f = d.features || {};
      console.log(`  - decision_id=${d.decision_id} posted_tweet_id=${d.posted_tweet_id} runtime_preflight=${f.runtime_preflight_status}`);
    });
  }
  
  // Check executor auth
  const { data: authEvents } = await supabase
    .from('system_events')
    .select('event_type, event_data, created_at')
    .in('event_type', ['EXECUTOR_AUTH_VERIFIED', 'EXECUTOR_AUTH_INVALID'])
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (authEvents && authEvents[0]) {
    const e = authEvents[0];
    const data = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
    console.log(`\n🔐 Executor Auth: ${e.event_type} logged_in=${data.logged_in} handle=${data.handle || 'N/A'}`);
  }
}

main().catch(console.error);
