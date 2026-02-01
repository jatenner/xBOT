#!/usr/bin/env tsx
/**
 * P1 Status Dashboard - Single table showing where candidates die
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  console.log('📊 P1 Status Dashboard (Last 60 minutes)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  // 1. Opportunities
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('tweet_posted_at, is_root_tweet, replied_to')
    .eq('is_root_tweet', true)
    .eq('replied_to', false);
  
  const now = Date.now();
  const fresh1h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > now - 60 * 60 * 1000;
  }).length || 0;
  const fresh3h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > now - 3 * 60 * 60 * 1000;
  }).length || 0;
  const fresh6h = opps?.filter(o => {
    if (!o.tweet_posted_at) return false;
    return new Date(o.tweet_posted_at).getTime() > now - 6 * 60 * 60 * 1000;
  }).length || 0;
  
  // 2. Scheduler attempts (from system_events)
  const { data: schedulerEvents } = await supabase
    .from('system_events')
    .select('event_type, event_data, created_at')
    .in('event_type', ['SCHEDULER_CANDIDATE_ATTEMPTED', 'SCHEDULER_CANDIDATE_SKIPPED'])
    .gte('created_at', oneHourAgo);
  
  let schedulerAttempted = 0;
  const skipReasons: Record<string, number> = {};
  
  schedulerEvents?.forEach(e => {
    if (e.event_type === 'SCHEDULER_CANDIDATE_ATTEMPTED') {
      schedulerAttempted++;
    } else if (e.event_type === 'SCHEDULER_CANDIDATE_SKIPPED') {
      const data = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
      const marker = data.preflight_marker || data.marker || data.reason || 'unknown';
      skipReasons[marker] = (skipReasons[marker] || 0) + 1;
    }
  });
  
  // Also check from decisions (preflight_marker in features)
  const { data: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('features, status, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', oneHourAgo);
  
  decisions?.forEach(d => {
    const f = d.features || {};
    const marker = f.preflight_marker || f.preflight_reason;
    if (marker && d.status !== 'queued' && d.status !== 'posted') {
      skipReasons[marker] = (skipReasons[marker] || 0) + 1;
    }
  });
  
  // 3. Decisions breakdown
  const decisionsCreated = decisions?.length || 0;
  const queued = decisions?.filter(d => d.status === 'queued').length || 0;
  const runtimeOk = decisions?.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'ok';
  }).length || 0;
  const runtimeInaccessible = decisions?.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'inaccessible';
  }).length || 0;
  const runtimeDeleted = decisions?.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'deleted';
  }).length || 0;
  const runtimeTimeout = decisions?.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'timeout';
  }).length || 0;
  const posted = decisions?.filter(d => d.posted_tweet_id).length || 0;
  
  // Print table
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Category                    │ Metric                          │ Count       │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Opportunities               │ Total                           │ ${String(opps?.length || 0).padStart(11)} │`);
  console.log(`│                             │ Fresh <1h                       │ ${String(fresh1h).padStart(11)} │`);
  console.log(`│                             │ Fresh <3h                       │ ${String(fresh3h).padStart(11)} │`);
  console.log(`│                             │ Fresh <6h                       │ ${String(fresh6h).padStart(11)} │`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Scheduler                   │ Attempted                       │ ${String(schedulerAttempted).padStart(11)} │`);
  console.log(`│                             │ Skipped (total)                 │ ${String(Object.values(skipReasons).reduce((a, b) => a + b, 0)).padStart(11)} │`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  
  // Top skip reasons
  const sortedSkips = Object.entries(skipReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
  sortedSkips.forEach(([marker, count], i) => {
    const label = i === 0 ? '│                             │ Top skip: ' : '│                             │   - ';
    const markerLabel = marker.length > 30 ? marker.substring(0, 27) + '...' : marker;
    console.log(`${label}${markerLabel.padEnd(30)} │ ${String(count).padStart(11)} │`);
  });
  
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ Decisions                   │ Created                         │ ${String(decisionsCreated).padStart(11)} │`);
  console.log(`│                             │ Queued                          │ ${String(queued).padStart(11)} │`);
  console.log(`│                             │ Runtime OK                      │ ${String(runtimeOk).padStart(11)} │`);
  console.log(`│                             │ Runtime Inaccessible            │ ${String(runtimeInaccessible).padStart(11)} │`);
  console.log(`│                             │ Runtime Deleted                 │ ${String(runtimeDeleted).padStart(11)} │`);
  console.log(`│                             │ Runtime Timeout                 │ ${String(runtimeTimeout).padStart(11)} │`);
  console.log(`│                             │ Posted                          │ ${String(posted).padStart(11)} │`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');
  
  // Show posted URLs if any
  if (posted > 0) {
    const postedDecisions = decisions?.filter(d => d.posted_tweet_id) || [];
    console.log('✅ POSTED REPLIES:');
    postedDecisions.forEach(d => {
      const f = d.features || {};
      const url = d.posted_tweet_id ? `https://x.com/i/status/${d.posted_tweet_id}` : 'N/A';
      console.log(`   ${url}`);
      console.log(`   decision_id=${d.decision_id?.substring(0, 8)}... runtime_preflight=${f.runtime_preflight_status || 'N/A'}`);
    });
    console.log('');
  }
}

main().catch(console.error);
