/**
 * Query DB for bad tweet IDs
 * Run: DATABASE_URL="..." tsx scripts/query-bad-tweets.ts
 */

import { getSupabaseClient } from '../src/db/index';

const BAD_TWEET_IDS = [
  '2008351265785360647',
  '2008383011218170281',
];

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 FORENSICS: Querying DB for bad tweet IDs\n');
  
  for (const tweetId of BAD_TWEET_IDS) {
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`Tweet ID: ${tweetId}`);
    console.log(`═══════════════════════════════════════════════════════\n`);
    
    // Query content_generation_metadata_comprehensive
    const { data, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, tweet_id, decision_type, pipeline_source, build_sha, job_run_id, content, target_tweet_id, root_tweet_id, target_in_reply_to_tweet_id, target_conversation_id, posted_at, created_at')
      .eq('tweet_id', tweetId)
      .limit(1)
      .single();
    
    if (error) {
      console.error(`❌ Query error: ${error.message}`);
      console.error(`   Code: ${error.code}`);
    } else if (data) {
      console.log('✅ FOUND IN DATABASE:');
      console.log(`   decision_id: ${data.decision_id}`);
      console.log(`   status: ${data.status}`);
      console.log(`   tweet_id: ${data.tweet_id}`);
      console.log(`   decision_type: ${data.decision_type}`);
      console.log(`   pipeline_source: ${data.pipeline_source || 'NULL'}`);
      console.log(`   build_sha: ${data.build_sha || 'NULL'}`);
      console.log(`   job_run_id: ${data.job_run_id || 'NULL'}`);
      console.log(`   content (first 200 chars): ${data.content?.substring(0, 200) || 'NULL'}`);
      console.log(`   target_tweet_id: ${data.target_tweet_id || 'NULL'}`);
      console.log(`   root_tweet_id: ${data.root_tweet_id || 'NULL'}`);
      console.log(`   target_in_reply_to_tweet_id: ${data.target_in_reply_to_tweet_id || 'NULL'}`);
      console.log(`   target_conversation_id: ${data.target_conversation_id || 'NULL'}`);
      console.log(`   posted_at: ${data.posted_at || 'NULL'}`);
      console.log(`   created_at: ${data.created_at || 'NULL'}`);
      
      // Check for violations
      if (data.decision_type === 'reply') {
        const content = data.content || '';
        const hasThreadMarker = /\b\d+\/\d+\b/.test(content) || 
                                content.startsWith('1/') || 
                                content.includes('🧵') ||
                                content.includes('\n');
        if (hasThreadMarker) {
          console.log(`\n🚨 VIOLATION: Reply contains thread markers!`);
        }
        
        if (data.target_in_reply_to_tweet_id) {
          console.log(`\n🚨 VIOLATION: target_in_reply_to_tweet_id is set (replying to reply)!`);
        }
        
        if (data.target_conversation_id && data.target_conversation_id !== data.target_tweet_id) {
          console.log(`\n🚨 VIOLATION: target_conversation_id != target_tweet_id!`);
        }
        
        if (data.root_tweet_id && data.root_tweet_id !== data.target_tweet_id) {
          console.log(`\n🚨 VIOLATION: root_tweet_id != target_tweet_id (ROOT-ONLY violation)!`);
        }
      }
    } else {
      console.log('❌ NOT FOUND in content_generation_metadata_comprehensive');
      console.log('   This indicates a BYPASS or another instance posting!');
    }
  }
  
  process.exit(0);
}

main().catch(console.error);

