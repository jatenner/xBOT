/**
 * Verify that the scraped tweets are actually OUR tweets
 */

import { getSupabaseClient } from '../src/db/index';

async function verifyScrapedTweets() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Verifying scraped tweet ownership...\n');
  
  // These are the tweet IDs from the metrics scraper logs
  const scrapedIds = [
    '1979554061663002627',
    '1979533751072768379',
    '1979590554586648986',
    '1979069564299133320',
    '1979325294977626115',
    '1979511562655133710',
    '1979524331429335297'
  ];
  
  for (const tweetId of scrapedIds) {
    const { data: post } = await supabase
      .from('posted_decisions')
      .select('tweet_id, content, posted_at')
      .eq('tweet_id', tweetId)
      .single();
    
    if (post) {
      console.log(`✅ ${tweetId}`);
      console.log(`   Content: "${(post.content || '').substring(0, 60)}..."`);
      console.log(`   Posted: ${new Date(post.posted_at).toLocaleString()}`);
    } else {
      console.log(`❌ ${tweetId} - NOT IN OUR DATABASE!`);
      console.log(`   This means we're scraping someone else's tweet!`);
    }
    console.log('');
  }
  
  // Check if the scraper is still using the wrong URL
  console.log('═══════════════════════════════════════');
  console.log('RECOMMENDATION:');
  console.log('If ANY tweets show ❌, the scraper is still broken');
  console.log('and needs to use: https://x.com/Signal_Synapse/status/{tweetId}');
}

verifyScrapedTweets().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

