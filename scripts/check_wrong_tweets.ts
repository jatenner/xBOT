/**
 * Check for wrong tweet IDs in database
 */

import { getSupabaseClient } from '../src/db/index';

async function checkWrongTweets() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 CHECKING DATABASE FOR WRONG TWEET IDS...\n');
  
  // Check for the specific wrong ID (Maga_Trigger tweet)
  console.log('1️⃣ Looking for Maga_Trigger tweet (1979987035063771345)...');
  const { data: wrongTweet, error: wrongError } = await supabase
    .from('content_metadata')
    .select('id, tweet_id, created_at, status')
    .eq('tweet_id', '1979987035063771345')
    .maybeSingle();
    
  if (wrongTweet) {
    console.log('❌ FOUND WRONG TWEET ID in content_metadata!');
    console.log(`   ID: ${wrongTweet.id}`);
    console.log(`   Tweet ID: ${wrongTweet.tweet_id}`);
    console.log(`   Created: ${wrongTweet.created_at}`);
    console.log(`   Status: ${wrongTweet.status}`);
  } else {
    console.log('✅ Wrong tweet ID NOT in content_metadata (good!)');
  }
  
  // Check outcomes table
  const { data: wrongOutcome } = await supabase
    .from('outcomes')
    .select('*')
    .eq('tweet_id', '1979987035063771345')
    .maybeSingle();
    
  if (wrongOutcome) {
    console.log('❌ FOUND in outcomes table:');
    console.log(`   Likes: ${wrongOutcome.likes}`);
    console.log(`   Retweets: ${wrongOutcome.retweets}`);
    console.log(`   Views: ${wrongOutcome.views}`);
  } else {
    console.log('✅ Wrong tweet ID NOT in outcomes (good!)');
  }
  
  console.log('\n2️⃣ Checking all posted tweets with metrics...');
  
  // Get all posted tweets
  const { data: allPosts, error: allError } = await supabase
    .from('content_metadata')
    .select('id, tweet_id, created_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (allError) {
    console.error('❌ Error fetching posts:', allError.message);
    return;
  }
  
  console.log(`\n📊 Found ${allPosts?.length || 0} posted tweets\n`);
  
  if (!allPosts || allPosts.length === 0) {
    console.log('ℹ️ No posted tweets found');
    return;
  }
  
  // Check metrics for each
  for (const post of allPosts) {
    const { data: outcome } = await supabase
      .from('outcomes')
      .select('likes, retweets, replies, views')
      .eq('decision_id', post.id)
      .maybeSingle();
      
    const likes = outcome?.likes || 0;
    const retweets = outcome?.retweets || 0;
    const views = outcome?.views || 0;
    
    const isSuspicious = likes > 100 || retweets > 50 || views > 10000;
    const icon = isSuspicious ? '🚨' : '✅';
    
    console.log(`${icon} ${post.tweet_id} | ${likes}❤️  ${retweets}🔄 ${views}👁️  | ${new Date(post.created_at).toLocaleString()}`);
  }
  
  console.log('\n3️⃣ Summary:');
  console.log('   🚨 = Suspicious (likely wrong account)');
  console.log('   ✅ = Normal (your actual metrics)');
  console.log('\nIf you see any 🚨 entries, those are wrong tweet IDs that should be cleaned!\n');
}

checkWrongTweets()
  .then(() => {
    console.log('✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

