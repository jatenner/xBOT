/**
 * Verify atomic posting system is working correctly
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function verify() {
  getConfig();
  const supabase = getSupabaseClient();

  // Check for stuck attempts
  const { data: stuck } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, created_at')
    .eq('status', 'posting_attempt')
    .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  console.log(`\n📊 Stuck attempts (>5 min): ${stuck?.length || 0}`);
  if (stuck && stuck.length > 0) {
    console.log('   ⚠️ Found stuck attempts:');
    stuck.forEach(s => {
      const age = Math.round((Date.now() - new Date(s.created_at).getTime()) / 60000);
      console.log(`   - ${s.decision_id.substring(0, 8)}... (${age} min old)`);
    });
  } else {
    console.log('   ✅ No stuck attempts found');
  }

  // Check recent successful posts
  const { data: posts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, tweet_id, pipeline_source, created_at, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n✅ Recent successful atomic posts (last 2h): ${posts?.length || 0}`);
  posts?.forEach((p, i) => {
    const age = Math.round((new Date(p.posted_at || p.created_at).getTime() - new Date(p.created_at).getTime()) / 1000);
    const hasAtomicFlow = p.pipeline_source === 'postingQueue' || p.pipeline_source === 'simpleThreadPoster';
    console.log(`   ${i+1}. decision_id=${p.decision_id.substring(0, 8)}...`);
    console.log(`      status=${p.status} tweet_id=${p.tweet_id}`);
    console.log(`      pipeline=${p.pipeline_source} ${hasAtomicFlow ? '✅ ATOMIC' : '⚠️'}`);
    console.log(`      created→posted: ${age}s`);
  });

  // Check for posting_attempt rows (should be <5 min old or none)
  const { data: recentAttempts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, created_at')
    .eq('status', 'posting_attempt')
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  console.log(`\n🔄 Recent posting_attempt rows (<10 min): ${recentAttempts?.length || 0}`);
  if (recentAttempts && recentAttempts.length > 0) {
    recentAttempts.forEach(a => {
      const age = Math.round((Date.now() - new Date(a.created_at).getTime()) / 1000);
      console.log(`   - ${a.decision_id.substring(0, 8)}... (${age}s old)`);
    });
  }

  console.log('\n🎯 System Status:');
  console.log(`   ✅ Atomic flow: ${posts && posts.length > 0 ? 'WORKING' : 'NO RECENT POSTS'}`);
  console.log(`   ✅ Stuck cleanup: ${stuck && stuck.length === 0 ? 'WORKING' : 'NEEDS ATTENTION'}`);
}

verify().catch(console.error);

