#!/usr/bin/env tsx
/**
 * P1 Diagnostic Queries
 * 
 * Runs diagnostic queries to identify the blocker preventing Reply V2 from posting.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 P1 Diagnostic Queries');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Query 1: Opportunities freshness + volume
  console.log('1️⃣ Opportunities freshness + volume:');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: oppData, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('replied_to, tweet_posted_at');
  
  if (oppError) {
    console.error('Error:', oppError);
  } else {
    const poolSize = oppData?.length || 0;
    const unclaimed = oppData?.filter(o => !o.replied_to).length || 0;
    const now = Date.now();
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    
    const fresh12h = oppData?.filter(o => 
      !o.replied_to && 
      o.tweet_posted_at && 
      new Date(o.tweet_posted_at).getTime() > twelveHoursAgo
    ).length || 0;
    
    const fresh24h = oppData?.filter(o => 
      !o.replied_to && 
      o.tweet_posted_at && 
      new Date(o.tweet_posted_at).getTime() > twentyFourHoursAgo
    ).length || 0;
    
    const unclaimedOpps = oppData?.filter(o => !o.replied_to) || [];
    const oldestUnclaimed = unclaimedOpps.length > 0
      ? unclaimedOpps.reduce((oldest, o) => {
          if (!o.tweet_posted_at) return oldest;
          const oTime = new Date(o.tweet_posted_at).getTime();
          const oldestTime = oldest ? new Date(oldest).getTime() : Infinity;
          return oTime < oldestTime ? o.tweet_posted_at : oldest;
        }, null as string | null)
      : null;
    
    const newestUnclaimed = unclaimedOpps.length > 0
      ? unclaimedOpps.reduce((newest, o) => {
          if (!o.tweet_posted_at) return newest;
          const oTime = new Date(o.tweet_posted_at).getTime();
          const newestTime = newest ? new Date(newest).getTime() : 0;
          return oTime > newestTime ? o.tweet_posted_at : newest;
        }, null as string | null)
      : null;
    
    console.log(`pool_size: ${poolSize}`);
    console.log(`unclaimed: ${unclaimed}`);
    console.log(`fresh_12h: ${fresh12h}`);
    console.log(`fresh_24h: ${fresh24h}`);
    console.log(`oldest_unclaimed: ${oldestUnclaimed || 'N/A'}`);
    console.log(`newest_unclaimed: ${newestUnclaimed || 'N/A'}`);
  }
  
  console.log('\n');
  
  // Query 2: Decisions created by Reply V2 (last 24h)
  console.log('2️⃣ Decisions created by Reply V2 (last 24h):');
  console.log('─────────────────────────────────────────────────────────────');
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: decisionData, error: decisionError } = await supabase
    .from('content_metadata')
    .select('status, features')
    .eq('decision_type', 'reply')
    .gte('created_at', twentyFourHoursAgo);
  
  if (decisionError) {
    console.error('Error:', decisionError);
  } else {
    const filtered = (decisionData || []).filter((d: any) => {
      const features = d.features || {};
      const source = features.pipeline_source;
      return source === 'reply_v2_planner' || source === 'reply_v2_scheduler';
    });
    
    const grouped = filtered.reduce((acc: any, d: any) => {
      const features = d.features || {};
      const source = features.pipeline_source || 'unknown';
      if (!acc[source]) {
        acc[source] = {
          decisions_24h: 0,
          queued: 0,
          posting: 0,
          posted: 0,
          runtime_ok: 0,
          runtime_deleted: 0,
          runtime_timeout: 0
        };
      }
      acc[source].decisions_24h++;
      if (d.status === 'queued') acc[source].queued++;
      if (d.status === 'posting') acc[source].posting++;
      if (d.status === 'posted') acc[source].posted++;
      
      if (features.runtime_preflight_status === 'ok') acc[source].runtime_ok++;
      if (features.runtime_preflight_status === 'deleted') acc[source].runtime_deleted++;
      if (features.runtime_preflight_status === 'timeout') acc[source].runtime_timeout++;
      
      return acc;
    }, {});
    
    for (const [source, stats] of Object.entries(grouped)) {
      console.log(`\npipeline_source: ${source}`);
      console.log(`  decisions_24h: ${(stats as any).decisions_24h}`);
      console.log(`  queued: ${(stats as any).queued}`);
      console.log(`  posting: ${(stats as any).posting}`);
      console.log(`  posted: ${(stats as any).posted}`);
      console.log(`  runtime_ok: ${(stats as any).runtime_ok}`);
      console.log(`  runtime_deleted: ${(stats as any).runtime_deleted}`);
      console.log(`  runtime_timeout: ${(stats as any).runtime_timeout}`);
    }
    
    if (Object.keys(grouped).length === 0) {
      console.log('No decisions found in last 24 hours');
    }
  }
  
  console.log('\n');
  
  // Query 3: Runtime preflight failure breakdown (last 50)
  console.log('3️⃣ Runtime preflight failure breakdown (last 50):');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: runtimeData, error: runtimeError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, created_at, features, target_tweet_id')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (runtimeError) {
    console.error('Error:', runtimeError);
  } else {
    const filtered = (runtimeData || []).filter((d: any) => {
      const features = d.features || {};
      const source = features.pipeline_source;
      return source === 'reply_v2_planner' || source === 'reply_v2_scheduler';
    });
    
    console.log(`Found ${filtered.length} Reply V2 decisions (out of ${runtimeData?.length || 0} total)`);
    filtered.slice(0, 10).forEach((d: any) => {
      const features = d.features || {};
      console.log(`\n  decision_id: ${d.decision_id}`);
      console.log(`  pipeline_source: ${features.pipeline_source || 'null'}`);
      console.log(`  status: ${d.status}`);
      console.log(`  created_at: ${d.created_at}`);
      console.log(`  runtime_preflight_status: ${features.runtime_preflight_status || 'null'}`);
      console.log(`  runtime_preflight_reason: ${features.runtime_preflight_reason || 'null'}`);
      console.log(`  target_tweet_id: ${d.target_tweet_id || 'null'}`);
    });
    if (filtered.length > 10) {
      console.log(`\n  ... and ${filtered.length - 10} more`);
    }
  }
  
  console.log('\n');
  
  // Query 4: Claim latency proxy
  console.log('4️⃣ Claim latency proxy (how long between decision creation and update):');
  console.log('─────────────────────────────────────────────────────────────');
  
  const { data: latencyData, error: latencyError } = await supabase
    .from('content_metadata')
    .select('created_at, updated_at, features')
    .eq('decision_type', 'reply')
    .gte('created_at', twentyFourHoursAgo);
  
  if (latencyError) {
    console.error('Error:', latencyError);
  } else {
    const filtered = (latencyData || []).filter((d: any) => {
      const features = d.features || {};
      const source = features.pipeline_source;
      return source === 'reply_v2_planner' || source === 'reply_v2_scheduler';
    });
    
    const latencies = filtered
      .map(d => {
        const created = new Date(d.created_at).getTime();
        const updated = new Date(d.updated_at).getTime();
        return (updated - created) / 1000; // seconds
      })
      .filter(l => l >= 0);
    
    if (latencies.length > 0) {
      const sorted = latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      
      console.log(`avg_seconds_to_update: ${avg.toFixed(2)}`);
      console.log(`p50_seconds_to_update: ${p50.toFixed(2)}`);
      console.log(`p90_seconds_to_update: ${p90.toFixed(2)}`);
      console.log(`sample_count: ${latencies.length}`);
    } else {
      console.log('No data available for latency calculation');
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
