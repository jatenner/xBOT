/**
 * Audit all posted tweets to find discrepancies
 */

import { getSupabaseClient } from '../src/db/index';

async function auditPostedTweets() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Auditing posted tweets...\n');
  
  // Get all posts from last 7 days
  const { data: recentPosts, error } = await supabase
    .from('posted_decisions')
    .select('tweet_id, content, posted_at')
    .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Found ${recentPosts?.length || 0} posts in last 7 days\n`);
  
  // Count by ID type
  let realIds = 0;
  let mockIds = 0;
  let emergencyIds = 0;
  let bulletproofIds = 0;
  
  recentPosts?.forEach(post => {
    const id = String(post.tweet_id);
    if (id.startsWith('mock_')) mockIds++;
    else if (id.startsWith('emergency_')) emergencyIds++;
    else if (id.startsWith('bulletproof_')) bulletproofIds++;
    else if (id.length >= 19) realIds++;
  });
  
  console.log('📊 ID Type Breakdown:');
  console.log(`   ✅ Real Twitter IDs: ${realIds}`);
  console.log(`   ❌ Mock IDs: ${mockIds}`);
  console.log(`   ❌ Emergency IDs: ${emergencyIds}`);
  console.log(`   ❌ Bulletproof IDs: ${bulletproofIds}`);
  console.log('');
  
  // Show the 10 most recent real IDs
  console.log('═══════════════════════════════════════');
  console.log('Most Recent REAL Tweet IDs:');
  console.log('');
  
  const realPosts = recentPosts?.filter(p => {
    const id = String(p.tweet_id);
    return !id.startsWith('mock_') && 
           !id.startsWith('emergency_') && 
           !id.startsWith('bulletproof_') &&
           id.length >= 19;
  }).slice(0, 10) || [];
  
  realPosts.forEach((post, idx) => {
    console.log(`${idx + 1}. ${post.tweet_id}`);
    console.log(`   "${(post.content || '').substring(0, 50)}..."`);
    console.log(`   Posted: ${new Date(post.posted_at).toLocaleString()}`);
    console.log('');
  });
  
  console.log('═══════════════════════════════════════');
  console.log('SUMMARY:');
  console.log(`Total posts (7 days): ${recentPosts?.length || 0}`);
  console.log(`Real tweets that CAN be scraped: ${realIds}`);
  console.log(`Fake tweets that CANNOT be scraped: ${mockIds + emergencyIds + bulletproofIds}`);
  
  if (realIds > 0) {
    console.log('\n✅ System IS posting real tweets!');
    console.log('✅ Metrics scraper CAN collect engagement data');
  } else {
    console.log('\n❌ NO REAL TWEETS FOUND');
    console.log('   All tweet IDs are fake - posting is failing!');
  }
}

auditPostedTweets().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

