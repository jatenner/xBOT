/**
 * 🚨 RAILWAY POSTING DIAGNOSTIC
 * Run via: railway run pnpm exec tsx scripts/railway-diagnose.ts
 */

import { getSupabaseClient } from '../src/db/index';

async function diagnose() {
  console.log('🔍 DIAGNOSING POSTING ISSUE...\n');
  
  const supabase = getSupabaseClient();
  
  // 1. Queued content
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  console.log(`1️⃣ Queued content: ${queued?.length || 0}`);
  
  // 2. Recent posts
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from('content_metadata')
    .select('status, posted_at, created_at')
    .in('decision_type', ['single', 'thread'])
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  const posted = recent?.filter(p => p.status === 'posted') || [];
  const lastPost = posted[0];
  const hoursAgo = lastPost ? (Date.now() - new Date(lastPost.posted_at || lastPost.created_at).getTime()) / (1000 * 60 * 60) : Infinity;
  
  console.log(`2️⃣ Recent posts: ${posted.length} posted, last: ${hoursAgo.toFixed(1)}h ago`);
  
  // 3. Stuck posts
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuck } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .eq('status', 'posting')
    .lt('created_at', thirtyMinAgo);
  
  console.log(`3️⃣ Stuck posts: ${stuck?.length || 0}`);
  
  // 4. Plan job
  const { data: plan } = await supabase
    .from('job_heartbeats')
    .select('status, created_at')
    .eq('job_name', 'plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const planHoursAgo = plan ? (Date.now() - new Date(plan.created_at).getTime()) / (1000 * 60 * 60) : Infinity;
  console.log(`4️⃣ Plan job: ${planHoursAgo.toFixed(1)}h ago (${plan?.status || 'none'})`);
  
  // Summary
  console.log('\n📊 SUMMARY:');
  if (!queued?.length && planHoursAgo > 3) {
    console.log('🚨 ISSUE: No content + plan job not running');
    console.log('💡 FIX: Trigger plan job');
  } else if (queued?.length) {
    console.log('✅ Content queued - should post soon');
  } else if (stuck?.length) {
    console.log('⚠️ Stuck posts need recovery');
  }
}

diagnose().catch(console.error);

