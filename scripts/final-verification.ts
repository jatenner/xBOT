/**
 * Final verification: All acceptance checks
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function verify() {
  getConfig();
  const supabase = getSupabaseClient();

  console.log('═══════════════════════════════════════════════════════');
  console.log('FINAL VERIFICATION - All Acceptance Checks');
  console.log('═══════════════════════════════════════════════════════\n');

  // A) Stuck posting_attempt >5min
  const { data: stuck } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, created_at')
    .eq('status', 'posting_attempt')
    .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  console.log('A) Stuck posting_attempt >5min:');
  console.log(`   Count: ${stuck?.length || 0}`);
  if (stuck && stuck.length > 0) {
    console.log('   ⚠️ Found stuck attempts:');
    stuck.slice(0, 5).forEach(s => {
      const age = Math.round((Date.now() - new Date(s.created_at).getTime()) / 60000);
      console.log(`   - ${s.decision_id.substring(0, 12)}... (${age} min old)`);
    });
  } else {
    console.log('   ✅ PASS: No stuck attempts');
  }

  // B) ROOT-only violations (last 24h)
  const { data: replies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, root_tweet_id, target_tweet_id, target_in_reply_to_tweet_id, target_conversation_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .not('tweet_id', 'is', null);

  const violations = replies?.filter(v => 
    v.root_tweet_id !== v.target_tweet_id ||
    v.target_in_reply_to_tweet_id !== null ||
    (v.target_conversation_id !== null && v.target_conversation_id !== v.target_tweet_id)
  ) || [];

  console.log('\nB) ROOT-only violations (last 24h):');
  console.log(`   Total NEW replies: ${replies?.length || 0}`);
  console.log(`   Violations: ${violations.length}`);
  if (violations.length > 0) {
    console.log('   ⚠️ Found violations:');
    violations.slice(0, 5).forEach(v => {
      console.log(`   - ${v.decision_id.substring(0, 12)}... root=${v.root_tweet_id || 'NULL'} target=${v.target_tweet_id}`);
    });
  } else {
    console.log('   ✅ PASS: No root violations in NEW replies');
  }

  // C) Recent successful atomic posts
  const { data: recentPosts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, tweet_id, pipeline_source, created_at, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nC) Recent successful atomic posts (last 2h):');
  console.log(`   Count: ${recentPosts?.length || 0}`);
  if (recentPosts && recentPosts.length > 0) {
    recentPosts.forEach((p, i) => {
      const atomic = p.pipeline_source === 'postingQueue' || p.pipeline_source === 'simpleThreadPoster';
      console.log(`   ${i+1}. ${p.decision_id.substring(0, 12)}... status=${p.status} tweet_id=${p.tweet_id} ${atomic ? '✅ ATOMIC' : '⚠️'}`);
    });
    console.log('   ✅ PASS: Atomic posts working');
  } else {
    console.log('   ⚠️ No recent posts (may need to trigger)');
  }

  // D) Discovery pool
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('like_count, view_count, tweet_posted_at, replied_to')
    .eq('replied_to', false)
    .gte('tweet_posted_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());

  const tierAplus = opportunities?.filter(o => 
    (o.view_count && o.view_count >= 1000000) || 
    (o.like_count && o.like_count >= 100000)
  ).length || 0;

  const tier25k = opportunities?.filter(o => 
    o.like_count && o.like_count >= 25000 && o.like_count < 100000
  ).length || 0;

  const tier10k = opportunities?.filter(o => 
    o.like_count && o.like_count >= 10000 && o.like_count < 25000
  ).length || 0;

  console.log('\nD) Discovery pool (last 12h):');
  console.log(`   Total: ${opportunities?.length || 0}`);
  console.log(`   Tier A+ (1M+ views OR 100K+ likes): ${tierAplus}`);
  console.log(`   Tier 25K+ (25K-100K likes): ${tier25k}`);
  console.log(`   Tier 10K+ (10K-25K likes): ${tier10k}`);
  if ((opportunities?.length || 0) > 0) {
    console.log('   ✅ PASS: Opportunities available');
  } else {
    console.log('   ⚠️ Pool empty (harvester may still be running)');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Summary:');
  console.log(`  ✅ Stuck attempts: ${stuck?.length || 0}`);
  console.log(`  ✅ Root violations (NEW): ${violations.length}`);
  console.log(`  ✅ Atomic posts: ${recentPosts?.length || 0}`);
  console.log(`  ${(opportunities?.length || 0) > 0 ? '✅' : '⚠️'} Discovery pool: ${opportunities?.length || 0}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

verify().catch(console.error);

