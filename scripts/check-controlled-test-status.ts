/**
 * Check status of controlled test post
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = process.argv[2] || '497a9126-e638-49ba-9420-192017d08f13';

async function main() {
  const supabase = getSupabaseClient();
  
  // Get controlled test post status
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_id', decisionId)
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  // Count queued posts at this time
  const { count: queuedCount } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  // Get posts posted in last 30 minutes (controlled window)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentPosts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, posted_at, decision_type')
    .eq('status', 'posted')
    .gte('posted_at', thirtyMinAgo)
    .order('posted_at', { ascending: false });
  
  console.log(`📊 Controlled Test Post Status:\n`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   status: ${data.status}`);
  console.log(`   tweet_id: ${data.tweet_id || 'NOT POSTED YET'}`);
  console.log(`   build_sha: ${data.build_sha || 'NULL'}`);
  console.log(`   pipeline_source: ${data.pipeline_source || 'NULL'}`);
  console.log(`   post_attempt_at: ${data.post_attempt_at || 'null'}`);
  console.log(`   error_message: ${data.error_message || 'null'}`);
  console.log(`   scheduled_at: ${data.scheduled_at}`);
  console.log(`   posted_at: ${data.posted_at || 'NOT POSTED YET'}`);
  
  console.log(`\n📋 Queue Status:`);
  console.log(`   Queued posts: ${queuedCount || 0}`);
  
  console.log(`\n📊 Posts Posted in Last 30 Minutes:`);
  if (recentPosts && recentPosts.length > 0) {
    recentPosts.forEach((post, idx) => {
      const isControlled = post.decision_id === decisionId;
      const marker = isControlled ? '🎯' : '  ';
      console.log(`   ${marker} ${idx + 1}. ${post.decision_id.substring(0, 8)}... (${post.decision_type})`);
      if (post.tweet_id) {
        console.log(`      tweet_id: ${post.tweet_id}`);
        console.log(`      posted_at: ${post.posted_at}`);
      }
    });
  } else {
    console.log(`   No posts in last 30 minutes`);
  }
  
  if (data.tweet_id) {
    console.log(`\n✅ POST SUCCESSFUL!`);
    console.log(`   Tweet URL: https://twitter.com/Signal_Synapse/status/${data.tweet_id}`);
  } else {
    console.log(`\n⏳ Post not yet successful`);
  }
  
  process.exit(0);
}

main().catch(console.error);

