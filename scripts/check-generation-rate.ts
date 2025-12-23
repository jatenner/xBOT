#!/usr/bin/env tsx
/**
 * Check if planJob is generating enough content
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('📊 CONTENT GENERATION VS POSTING ANALYSIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Count all generated content (queued or posted)
  const { count: generatedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo.toISOString())
    .in('status', ['queued', 'posted', 'retrying', 'failed']);

  // Count posted
  const { count: postedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo.toISOString());

  // Count queued
  const { count: queuedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');

  // Count failed
  const { count: failedCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', oneDayAgo.toISOString());

  console.log('📈 LAST 24 HOURS:\n');
  console.log(`   Generated: ${generatedCount || 0} posts`);
  console.log(`   Posted:    ${postedCount || 0} posts`);
  console.log(`   Failed:    ${failedCount || 0} posts`);
  console.log(`   Queued:    ${queuedCount || 0} posts (current)`);
  console.log('');

  const genRate = (generatedCount || 0) / 24;
  const postRate = (postedCount || 0) / 24;

  console.log('📊 RATES:\n');
  console.log(`   Generation: ${genRate.toFixed(1)} posts/hour`);
  console.log(`   Posting:    ${postRate.toFixed(1)} posts/hour`);
  console.log(`   Target:     2.0 posts/hour`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (genRate < 1.5) {
    console.log('🚨 PROBLEM: planJob generating TOO SLOWLY');
    console.log(`   Current: ${genRate.toFixed(1)} posts/hour`);
    console.log(`   Expected: 2.0 posts/hour`);
    console.log('');
    console.log('   DIAGNOSIS: planJob not running frequently enough');
    console.log('   CHECK: JOBS_PLAN_INTERVAL_MIN should be 30 (not 60)');
  } else if (genRate >= 1.5 && postRate < 1.5) {
    console.log('🚨 PROBLEM: postingQueue NOT processing fast enough');
    console.log(`   Generated: ${genRate.toFixed(1)} posts/hour`);
    console.log(`   Posted:    ${postRate.toFixed(1)} posts/hour`);
    console.log('');
    console.log('   DIAGNOSIS: Queue is building up but not posting');
    console.log(`   CHECK: Current queue depth: ${queuedCount || 0}`);
    if ((queuedCount || 0) > 5) {
      console.log('   → Queue is BACKING UP (postingQueue blocked or slow)');
    }
  } else {
    console.log('✅ Both generation and posting rates are healthy');
  }

  // Check recent generation timing
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📍 RECENT GENERATION TIMING:\n');

  const { data: recentGen } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentGen && recentGen.length > 0) {
    recentGen.forEach((gen, i) => {
      const createdAt = new Date(gen.created_at);
      const minutesAgo = Math.round((Date.now() - createdAt.getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. ${gen.decision_type.padEnd(7)} | ${gen.status.padEnd(8)} | ${minutesAgo}m ago`);
    });
  } else {
    console.log('   ⚠️  NO content generated in last 6 hours!');
  }

  console.log('');
}

check();

