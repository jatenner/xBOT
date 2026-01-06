/**
 * Verify SEV-closed: All posting invariants are enforced
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function verify() {
  getConfig();
  const supabase = getSupabaseClient();

  console.log('🔍 VERIFICATION A: Last 10 posts/replies in DB\n');
  
  const { data: recentPosts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, tweet_id, pipeline_source, build_sha, job_run_id, created_at, posted_at')
    .gte('posted_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(10);

  if (!recentPosts || recentPosts.length === 0) {
    console.log('⚠️ No posts in last 6 hours');
  } else {
    recentPosts.forEach((p, i) => {
      console.log(`${i+1}. decision_id=${p.decision_id.substring(0, 8)}...`);
      console.log(`   type=${p.decision_type} status=${p.status} tweet_id=${p.tweet_id || 'NULL'}`);
      console.log(`   pipeline=${p.pipeline_source} build_sha=${p.build_sha || 'NULL'}`);
      console.log(`   created=${p.created_at} posted=${p.posted_at || 'NULL'}\n`);
    });
  }

  console.log('\n🔍 VERIFICATION B: Stuck posting_attempt rows\n');
  
  const { data: stuck } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, created_at')
    .eq('status', 'posting_attempt')
    .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

  console.log(`   Count: ${stuck?.length || 0}`);
  if (stuck && stuck.length > 0) {
    console.log('   ⚠️ Found stuck attempts:');
    stuck.forEach(s => {
      const age = Math.round((Date.now() - new Date(s.created_at).getTime()) / 60000);
      console.log(`   - ${s.decision_id.substring(0, 8)}... (${age} min old)`);
    });
  } else {
    console.log('   ✅ No stuck attempts');
  }

  console.log('\n🔍 VERIFICATION C: ROOT-only violations in posted replies\n');
  
  const { data: violations } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, root_tweet_id, target_tweet_id, target_in_reply_to_tweet_id, target_conversation_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null);

  if (!violations || violations.length === 0) {
    console.log('   ✅ No posted replies found');
  } else {
    const rootViolations = violations.filter(v => 
      v.root_tweet_id !== v.target_tweet_id ||
      v.target_in_reply_to_tweet_id !== null ||
      (v.target_conversation_id !== null && v.target_conversation_id !== v.target_tweet_id)
    );
    
    console.log(`   Total posted replies: ${violations.length}`);
    console.log(`   Root violations: ${rootViolations.length}`);
    
    if (rootViolations.length > 0) {
      console.log('   ⚠️ Found violations:');
      rootViolations.forEach(v => {
        console.log(`   - ${v.decision_id.substring(0, 8)}... root=${v.root_tweet_id} target=${v.target_tweet_id}`);
      });
    } else {
      console.log('   ✅ No root violations');
    }
  }

  console.log('\n🔍 VERIFICATION D: Discovery pool tier counts (last 12h)\n');
  
  const { data: opportunities } = await supabase
    .from('reply_opportunities')
    .select('like_count, view_count, tweet_posted_at')
    .eq('replied_to', false)
    .gte('tweet_posted_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());

  if (!opportunities || opportunities.length === 0) {
    console.log('   ⚠️ No opportunities in last 12h');
  } else {
    const tierAplus = opportunities.filter(o => 
      (o.view_count && o.view_count >= 1000000) || 
      (o.like_count && o.like_count >= 100000)
    ).length;
    
    const tier25k = opportunities.filter(o => 
      o.like_count && o.like_count >= 25000 && o.like_count < 100000
    ).length;
    
    const tier10k = opportunities.filter(o => 
      o.like_count && o.like_count >= 10000 && o.like_count < 25000
    ).length;
    
    console.log(`   Total: ${opportunities.length}`);
    console.log(`   Tier A+ (1M+ views OR 100K+ likes): ${tierAplus}`);
    console.log(`   Tier 25K+ (25K-100K likes): ${tier25k}`);
    console.log(`   Tier 10K+ (10K-25K likes): ${tier10k}`);
  }

  console.log('\n✅ Verification complete\n');
}

verify().catch(console.error);

