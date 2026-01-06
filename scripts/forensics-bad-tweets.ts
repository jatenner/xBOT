/**
 * FORENSICS: Check bad tweet IDs in database
 * Run: tsx scripts/forensics-bad-tweets.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const BAD_TWEET_IDS = [
  '2008351265785360647',
  '2008383011218170281',
];

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 FORENSICS: Checking bad tweet IDs in database\n');
  
  for (const tweetId of BAD_TWEET_IDS) {
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`Tweet ID: ${tweetId}`);
    console.log(`═══════════════════════════════════════════════════════\n`);
    
    // Check content_metadata (primary table) - skip columns that don't exist
    const { data: contentData, error: contentError } = await supabase
      .from('content_metadata')
      .select('decision_id, status, decision_type, pipeline_source, build_sha, job_run_id, target_tweet_id, root_tweet_id, content, posted_at, created_at')
      .eq('tweet_id', tweetId)
      .limit(1);
    
    if (contentError) {
      console.error(`❌ Query error (content_metadata): ${contentError.message}`);
    } else if (contentData && contentData.length > 0) {
      const row = contentData[0];
      console.log('✅ FOUND IN content_metadata:');
      console.log(`   decision_id: ${row.decision_id}`);
      console.log(`   status: ${row.status}`);
      console.log(`   decision_type: ${row.decision_type}`);
      console.log(`   pipeline_source: ${row.pipeline_source || 'NULL'}`);
      console.log(`   build_sha: ${row.build_sha || 'NULL'}`);
      console.log(`   job_run_id: ${row.job_run_id || 'NULL'}`);
      console.log(`   target_tweet_id: ${row.target_tweet_id || 'NULL'}`);
      console.log(`   root_tweet_id: ${row.root_tweet_id || 'NULL'}`);
      console.log(`   target_in_reply_to_tweet_id: ${row.target_in_reply_to_tweet_id || 'NULL'}`);
      console.log(`   target_conversation_id: ${row.target_conversation_id || 'NULL'}`);
      console.log(`   content (first 200 chars): ${row.content?.substring(0, 200) || 'NULL'}`);
      console.log(`   posted_at: ${row.posted_at || 'NULL'}`);
      console.log(`   created_at: ${row.created_at || 'NULL'}`);
      
      // Check for thread-like content
      if (row.content) {
        const hasThreadMarker = /\b\d+\/\d+\b/.test(row.content) || 
                                row.content.startsWith('1/') || 
                                row.content.includes('🧵') ||
                                row.content.includes('\n');
        if (hasThreadMarker && row.decision_type === 'reply') {
          console.log(`\n🚨 VIOLATION: Reply contains thread markers!`);
          console.log(`   Content: "${row.content}"`);
        }
      }
      
      // Check if replying to a reply
      if (row.decision_type === 'reply' && row.target_in_reply_to_tweet_id) {
        console.log(`\n🚨 VIOLATION: Reply targets another reply (not root)!`);
        console.log(`   target_in_reply_to_tweet_id: ${row.target_in_reply_to_tweet_id}`);
      }
    } else {
      console.log('❌ NOT FOUND in content_metadata');
    }
    
    // Check content_generation_metadata_comprehensive
    const { data: comprehensiveData, error: comprehensiveError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, decision_type, pipeline_source, build_sha, job_run_id, target_tweet_id, root_tweet_id, content, posted_at, created_at')
      .eq('tweet_id', tweetId)
      .limit(1);
    
    if (comprehensiveError) {
      console.error(`❌ Query error (comprehensive): ${comprehensiveError.message}`);
    } else if (comprehensiveData && comprehensiveData.length > 0) {
      const row = comprehensiveData[0];
      console.log('\n✅ FOUND IN content_generation_metadata_comprehensive:');
      console.log(`   decision_id: ${row.decision_id}`);
      console.log(`   status: ${row.status}`);
      console.log(`   decision_type: ${row.decision_type}`);
      console.log(`   pipeline_source: ${row.pipeline_source || 'NULL'}`);
      console.log(`   build_sha: ${row.build_sha || 'NULL'}`);
      console.log(`   job_run_id: ${row.job_run_id || 'NULL'}`);
      console.log(`   target_tweet_id: ${row.target_tweet_id || 'NULL'}`);
      console.log(`   root_tweet_id: ${row.root_tweet_id || 'NULL'}`);
      console.log(`   content (first 200 chars): ${row.content?.substring(0, 200) || 'NULL'}`);
      console.log(`   posted_at: ${row.posted_at || 'NULL'}`);
    } else {
      console.log('\n❌ NOT FOUND in content_generation_metadata_comprehensive');
    }
  }
  
  // Check for multiple build SHAs posting
  console.log(`\n\n═══════════════════════════════════════════════════════`);
  console.log('Checking for multiple build SHAs...');
  console.log(`═══════════════════════════════════════════════════════\n`);
  
  const { data: recentPosts, error: recentError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('build_sha, pipeline_source, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(100);
  
  if (recentError) {
    console.error(`❌ Query error: ${recentError.message}`);
  } else if (recentPosts) {
    const shaCounts: Record<string, number> = {};
    for (const post of recentPosts) {
      const sha = post.build_sha || 'NULL';
      shaCounts[sha] = (shaCounts[sha] || 0) + 1;
    }
    
    console.log('Build SHA counts (last 24h):');
    for (const [sha, count] of Object.entries(shaCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${sha}: ${count} posts`);
    }
    
    if (Object.keys(shaCounts).length > 1) {
      console.log(`\n🚨 MULTIPLE BUILD SHAS DETECTED - Possible multi-instance issue!`);
    }
  }
  
  process.exit(0);
}

main().catch(console.error);

