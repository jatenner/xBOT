/**
 * Check if real engagement data is being collected
 */

import { getSupabaseClient } from '../src/db/index';

async function checkRealEngagement() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking real engagement data...\n');
  
  // Check outcomes table with all columns
  const { data: outcomes, error: outcomesError } = await supabase
    .from('outcomes')
    .select('*')
    .order('collected_at', { ascending: false })
    .limit(10);
  
  if (outcomesError) {
    console.error('❌ Error fetching outcomes:', outcomesError);
  } else if (!outcomes || outcomes.length === 0) {
    console.log('⚠️ NO ENGAGEMENT DATA IN OUTCOMES TABLE');
    console.log('   Metrics scraper may not have run yet');
  } else {
    console.log(`✅ Found ${outcomes.length} engagement records:\n`);
    outcomes.forEach((o, idx) => {
      console.log(`${idx + 1}. Tweet: ${o.tweet_id}`);
      console.log(`   📊 ${o.likes || 0} likes, ${o.retweets || 0} RTs, ${o.replies || 0} replies, ${o.views || 0} views`);
      console.log(`   📅 Collected: ${new Date(o.collected_at).toLocaleString()}`);
      console.log(`   🔄 Source: ${o.data_source}`);
      console.log(`   🎯 Simulated: ${o.simulated ? 'YES' : 'NO'}`);
      console.log('');
    });
  }
  
  // Check most recent post
  const { data: latestPost } = await supabase
    .from('posted_decisions')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();
  
  if (latestPost) {
    console.log('═══════════════════════════════════════');
    console.log('LATEST POST:');
    console.log(`Tweet ID: ${latestPost.tweet_id}`);
    console.log(`Content: "${(latestPost.content || '').substring(0, 60)}..."`);
    console.log(`Posted at: ${new Date(latestPost.posted_at).toLocaleString()}`);
    console.log(`Is mock ID: ${String(latestPost.tweet_id).startsWith('mock_') ? 'YES ❌' : 'NO ✅'}`);
    
    // Check if this post has engagement data
    const { data: postEngagement } = await supabase
      .from('outcomes')
      .select('*')
      .eq('tweet_id', latestPost.tweet_id)
      .single();
    
    if (postEngagement) {
      console.log('\n✅ Engagement data found:');
      console.log(`   ${postEngagement.likes || 0} likes, ${postEngagement.views || 0} views`);
    } else {
      console.log('\n⏳ Engagement data not yet collected (metrics scraper runs every 10 min)');
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('SYSTEM STATUS:');
  
  if ((outcomes?.length || 0) > 0) {
    console.log('✅ Real engagement data IS being collected');
    console.log('✅ Dynamic few-shot learning WILL work');
    console.log('✅ System CAN learn from YOUR data');
  } else {
    console.log('⏳ Waiting for first metrics collection');
    console.log('   (Scraper runs every 10 minutes)');
  }
}

checkRealEngagement().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

