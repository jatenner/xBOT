#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function hardeningProof() {
  const supabase = getSupabaseClient();
  
  console.log('=== HARDENING PROOF REPORT ===\n');
  
  // 1) Deferrals expired last 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: expiredCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'posting_retry_deferred')
    .eq('event_data->>reason', 'ttl_expired')
    .gte('created_at', twentyFourHoursAgo);
  
  console.log('1) DEFERRALS EXPIRED (last 24h):', expiredCount || 0);
  
  // 2) Auto-heal runs last 6h
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { count: autohealCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'posting_retry_cleared')
    .eq('event_data->>reason', 'autoheal_permit_approved')
    .gte('created_at', sixHoursAgo);
  
  console.log('2) AUTOHEAL RUNS (last 6h):', autohealCount || 0);
  
  // 3) Queued to USED latency (p50/p95)
  const { data: recentPermits } = await supabase
    .from('post_attempts')
    .select('created_at, used_at')
    .eq('status', 'USED')
    .not('used_at', 'is', null)
    .gte('used_at', twentyFourHoursAgo)
    .order('used_at', { ascending: false })
    .limit(100);
  
  const latencies = (recentPermits || [])
    .map(p => {
      const created = new Date(p.created_at).getTime();
      const used = new Date(p.used_at!).getTime();
      return (used - created) / 1000 / 60; // minutes
    })
    .sort((a, b) => a - b);
  
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  
  console.log('3) QUEUED TO USED LATENCY:');
  console.log('   p50:', p50.toFixed(1), 'minutes');
  console.log('   p95:', p95.toFixed(1), 'minutes');
  console.log('   samples:', latencies.length);
  
  // 4) New ghosts last 24h
  const { count: ghostCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .is('permit_id', null)
    .gte('posted_at', twentyFourHoursAgo);
  
  console.log('4) NEW GHOSTS (last 24h):', ghostCount || 0);
  
  // Summary table
  console.log('\n=== HARDENING PROOF SUMMARY ===');
  console.log('| Metric | Value |');
  console.log('|--------|-------|');
  console.log(`| Deferrals expired (24h) | ${expiredCount || 0} |`);
  console.log(`| Auto-heal runs (6h) | ${autohealCount || 0} |`);
  console.log(`| Queued→USED p50 latency | ${p50.toFixed(1)} min |`);
  console.log(`| Queued→USED p95 latency | ${p95.toFixed(1)} min |`);
  console.log(`| New ghosts (24h) | ${ghostCount || 0} |`);
  
  process.exit(0);
}

hardeningProof();

