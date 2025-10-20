/**
 * Clean wrong tweet IDs from database
 */

import { getSupabaseClient } from '../src/db/index';

async function cleanWrongTweets() {
  const supabase = getSupabaseClient();
  
  console.log('🧹 CLEANING WRONG TWEET IDS...\n');
  
  const wrongTweetId = '1979987035063771345';
  
  console.log(`1️⃣ Removing wrong tweet ID: ${wrongTweetId} (from @Maga_Trigger)\n`);
  
  // Update content_metadata - set tweet_id to NULL, preserve the decision
  console.log('   Updating content_metadata...');
  const { error: cmError } = await supabase
    .from('content_metadata')
    .update({
      tweet_id: null,
      status: 'posted_failed_id_capture',
      updated_at: new Date().toISOString()
    })
    .eq('tweet_id', wrongTweetId);
    
  if (cmError) {
    console.error('   ❌ Error updating content_metadata:', cmError.message);
  } else {
    console.log('   ✅ Updated content_metadata (set tweet_id to NULL)');
  }
  
  // Delete from outcomes (if exists)
  console.log('   Checking outcomes...');
  const { error: outError } = await supabase
    .from('outcomes')
    .delete()
    .eq('tweet_id', wrongTweetId);
    
  if (outError) {
    console.error('   ❌ Error deleting from outcomes:', outError.message);
  } else {
    console.log('   ✅ Deleted from outcomes (if existed)');
  }
  
  // Delete from learning_posts (if exists)
  console.log('   Checking learning_posts...');
  const { error: lpError } = await supabase
    .from('learning_posts')
    .delete()
    .eq('tweet_id', wrongTweetId);
    
  if (lpError && !lpError.message.includes('0 rows')) {
    console.error('   ❌ Error deleting from learning_posts:', lpError.message);
  } else {
    console.log('   ✅ Deleted from learning_posts (if existed)');
  }
  
  // Delete from tweet_metrics (if exists)
  console.log('   Checking tweet_metrics...');
  const { error: tmError } = await supabase
    .from('tweet_metrics')
    .delete()
    .eq('tweet_id', wrongTweetId);
    
  if (tmError && !tmError.message.includes('0 rows')) {
    console.error('   ❌ Error deleting from tweet_metrics:', tmError.message);
  } else {
    console.log('   ✅ Deleted from tweet_metrics (if existed)');
  }
  
  console.log('\n2️⃣ Verifying cleanup...');
  
  // Verify it's gone
  const { data: verify } = await supabase
    .from('content_metadata')
    .select('id, tweet_id, status')
    .eq('id', 69)
    .single();
    
  if (verify) {
    console.log(`   Decision ID 69:`);
    console.log(`   - Tweet ID: ${verify.tweet_id || 'NULL ✅'}`);
    console.log(`   - Status: ${verify.status}`);
  }
  
  console.log('\n✅ Cleanup complete!\n');
  console.log('Summary:');
  console.log('  - Wrong tweet ID (1979987035063771345) removed from all tables');
  console.log('  - Decision preserved with status "posted_failed_id_capture"');
  console.log('  - Next post will capture the correct ID with the new verification system\n');
}

cleanWrongTweets()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

