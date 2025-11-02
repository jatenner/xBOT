/**
 * Fix posts that are marked as 'failed' but have real tweet IDs
 * These posts are actually live on Twitter but our verification failed
 */

import { getSupabaseClient } from '../src/db/index';

async function fixFailedPosts() {
  console.log('🔧 Starting database fix for failed posts with real tweet IDs...');
  
  const supabase = getSupabaseClient();
  
  // Find and fix posts with real tweet IDs but marked as failed
  const { data, error } = await supabase
    .from('content_metadata')
    .update({ status: 'posted' })
    .eq('status', 'failed')
    .not('tweet_id', 'is', null)
    .filter('tweet_id', 'not.like', 'posted_%')  // Not placeholder
    .filter('tweet_id', 'not.like', 'reply_%')   // Not placeholder
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .select('decision_id, decision_type, tweet_id, posted_at');
  
  if (error) {
    console.error('❌ Database update failed:', error.message);
    process.exit(1);
  }
  
  if (!data || data.length === 0) {
    console.log('✅ No failed posts with real tweet IDs found - database is clean!');
  } else {
    console.log(`✅ Fixed ${data.length} posts that were marked as failed:`);
    data.forEach((post: any) => {
      console.log(`   • ${post.decision_type} - ID: ${post.tweet_id} - Posted: ${new Date(post.posted_at).toLocaleString()}`);
    });
  }
  
  process.exit(0);
}

fixFailedPosts().catch((error) => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});

