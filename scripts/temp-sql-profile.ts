#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('=== Query A: candidate_evaluations table ===');
  const { data: evals, count: evalsCount } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  console.log(`Total evaluations (last 24h): ${evalsCount || 0}`);
  
  const { data: evalsBreakdown } = await supabase
    .from('candidate_evaluations')
    .select('passed_hard_filters, predicted_tier, status')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const breakdown: Record<string, number> = {};
  evalsBreakdown?.forEach(e => {
    const key = `passed=${e.passed_hard_filters}_tier=${e.predicted_tier}_status=${e.status}`;
    breakdown[key] = (breakdown[key] || 0) + 1;
  });
  
  console.log('\nBreakdown:');
  Object.entries(breakdown).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
  
  console.log('\n=== Query B: Freshness windows ===');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: fresh2h } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .in('status', ['evaluated', 'queued'])
    .gte('created_at', twoHoursAgo);
  
  const { data: fresh6h } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .in('status', ['evaluated', 'queued'])
    .gte('created_at', sixHoursAgo);
  
  const { data: fresh24h } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .in('status', ['evaluated', 'queued'])
    .gte('created_at', twentyFourHoursAgo);
  
  console.log(`Fresh 2h: ${fresh2h?.length || 0}`);
  console.log(`Fresh 6h: ${fresh6h?.length || 0}`);
  console.log(`Fresh 24h: ${fresh24h?.length || 0}`);
  
  console.log('\n=== Query C: Recent evaluations (last 50) ===');
  const { data: recent } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, created_at, passed_hard_filters, predicted_tier, status, candidate_author_username, candidate_content')
    .order('created_at', { ascending: false })
    .limit(50);
  
  recent?.forEach(e => {
    const hasMetadata = !!(e.candidate_tweet_id && e.candidate_author_username && e.candidate_content);
    console.log(`${e.candidate_tweet_id?.substring(0, 8) || 'null'}... | passed=${e.passed_hard_filters} tier=${e.predicted_tier} status=${e.status} has_metadata=${hasMetadata} | ${e.created_at}`);
  });
  
  console.log('\n=== Query D: reply_candidate_queue status ===');
  const { data: queue } = await supabase
    .from('reply_candidate_queue')
    .select('status, expires_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  const queueStatus: Record<string, number> = {};
  const now = new Date();
  let expired = 0;
  queue?.forEach(q => {
    const status = q.status || 'unknown';
    queueStatus[status] = (queueStatus[status] || 0) + 1;
    if (q.expires_at && new Date(q.expires_at) < now) {
      expired++;
    }
  });
  
  console.log('Queue status breakdown:');
  Object.entries(queueStatus).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
  console.log(`  Expired entries: ${expired}`);
}

main().catch(console.error);
