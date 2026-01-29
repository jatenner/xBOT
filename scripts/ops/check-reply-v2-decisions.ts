#!/usr/bin/env tsx
/**
 * Check Reply V2 Decisions
 * 
 * Queries content_generation_metadata_comprehensive for Reply V2 decisions.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Reply V2 Decisions Check');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check decisions in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: decisions, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, pipeline_source, features, created_at, target_tweet_id')
    .eq('decision_type', 'reply')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  // Filter by pipeline_source in features
  const replyV2Decisions = (decisions || []).filter((d: any) => {
    const features = d.features || {};
    const source = features.pipeline_source || d.pipeline_source;
    return source === 'reply_v2_planner' || source === 'reply_v2_scheduler';
  });
  
  console.log(`Found ${replyV2Decisions.length} Reply V2 decisions in last hour\n`);
  
  // Group by pipeline_source
  const grouped = replyV2Decisions.reduce((acc: any, d: any) => {
    const features = d.features || {};
    const source = features.pipeline_source || d.pipeline_source || 'unknown';
    if (!acc[source]) {
      acc[source] = {
        total: 0,
        queued: 0,
        posting: 0,
        posted: 0,
        runtime_ok: 0,
        runtime_deleted: 0,
        runtime_timeout: 0
      };
    }
    acc[source].total++;
    if (d.status === 'queued') acc[source].queued++;
    if (d.status === 'posting') acc[source].posting++;
    if (d.status === 'posted') acc[source].posted++;
    
    if (features.runtime_preflight_status === 'ok') acc[source].runtime_ok++;
    if (features.runtime_preflight_status === 'deleted') acc[source].runtime_deleted++;
    if (features.runtime_preflight_status === 'timeout') acc[source].runtime_timeout++;
    
    return acc;
  }, {});
  
  for (const [source, stats] of Object.entries(grouped)) {
    console.log(`pipeline_source: ${source}`);
    console.log(`  total: ${(stats as any).total}`);
    console.log(`  queued: ${(stats as any).queued}`);
    console.log(`  posting: ${(stats as any).posting}`);
    console.log(`  posted: ${(stats as any).posted}`);
    console.log(`  runtime_ok: ${(stats as any).runtime_ok}`);
    console.log(`  runtime_deleted: ${(stats as any).runtime_deleted}`);
    console.log(`  runtime_timeout: ${(stats as any).runtime_timeout}`);
    console.log('');
  }
  
  // Show recent decisions
  if (replyV2Decisions.length > 0) {
    console.log('Recent decisions:');
    replyV2Decisions.slice(0, 10).forEach((d: any) => {
      const features = d.features || {};
      const source = features.pipeline_source || d.pipeline_source || 'unknown';
      console.log(`  ${d.decision_id.substring(0, 8)}... status=${d.status} source=${source} runtime_preflight=${features.runtime_preflight_status || 'null'}`);
    });
  } else {
    console.log('No Reply V2 decisions found in last hour');
  }
}

main().catch(console.error);
