#!/usr/bin/env tsx
/**
 * Verify Scheduler Preflight Classification + Soft Mode
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Scheduler Preflight Verification');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check decisions created in last 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, features, created_at, pipeline_source')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false })
    .limit(50);
  
  console.log(`📋 Decisions created (last 30m): ${decisions?.length || 0}\n`);
  
  if (!decisions || decisions.length === 0) {
    console.log('⚠️  No decisions created yet. Waiting for scheduler to run...\n');
    return;
  }
  
  // Breakdown by preflight status
  const statusBreakdown: Record<string, number> = {};
  const markerBreakdown: Record<string, number> = {};
  
  decisions.forEach(d => {
    const f = d.features || {};
    const status = f.preflight_status || 'unknown';
    const marker = f.preflight_marker || 'none';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    markerBreakdown[marker] = (markerBreakdown[marker] || 0) + 1;
  });
  
  console.log('📊 Preflight Status Breakdown:');
  Object.entries(statusBreakdown).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  console.log('\n📊 Preflight Marker Breakdown:');
  Object.entries(markerBreakdown).forEach(([marker, count]) => {
    console.log(`  ${marker}: ${count}`);
  });
  
  // Show sample decisions
  console.log('\n📋 Sample Decisions (last 10):');
  decisions.slice(0, 10).forEach(d => {
    const f = d.features || {};
    console.log(`  decision_id=${d.decision_id.substring(0, 8)}... status=${d.status} preflight_status=${f.preflight_status || 'none'} preflight_marker=${f.preflight_marker || 'none'} preflight_reason=${(f.preflight_reason || '').substring(0, 50)}`);
  });
  
  // Check runtime preflight breakdown
  const runtimeOk = decisions.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'ok';
  }).length;
  
  const runtimeInaccessible = decisions.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'inaccessible';
  }).length;
  
  const runtimeDeleted = decisions.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'deleted';
  }).length;
  
  const runtimeTimeout = decisions.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'timeout';
  }).length;
  
  console.log('\n📊 Runtime Preflight Breakdown (last 30m):');
  console.log(`  ok: ${runtimeOk}`);
  console.log(`  inaccessible: ${runtimeInaccessible}`);
  console.log(`  deleted: ${runtimeDeleted}`);
  console.log(`  timeout: ${runtimeTimeout}`);
  
  // Check for posted replies
  const posted = decisions.filter(d => {
    const f = d.features || {};
    return f.tweet_id || d.status === 'posted';
  }).length;
  
  console.log(`\n✅ Posted replies: ${posted}`);
  
  if (posted > 0) {
    const postedDecisions = decisions.filter(d => {
      const f = d.features || {};
      return f.tweet_id || d.status === 'posted';
    });
    console.log('\n🎉 POSTED REPLIES:');
    postedDecisions.forEach(d => {
      const f = d.features || {};
      console.log(`  decision_id=${d.decision_id} posted_tweet_id=${f.tweet_id} runtime_preflight=${f.runtime_preflight_status}`);
    });
  }
}

main().catch(console.error);
