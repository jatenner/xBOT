/**
 * 🧪 TEST METRICS SCRAPER MANUALLY
 * Diagnose why scraper isn't collecting real engagement data
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function testMetricsScraper() {
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 METRICS SCRAPER DIAGNOSTIC TEST');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Get a recent post to test with
  const { data: recentPost } = await supabase
    .from('posted_decisions')
    .select('*')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!recentPost) {
    console.log('❌ No posts found to test with');
    return;
  }
  
  const tweetId = recentPost.tweet_id;
  const postedTime = new Date(recentPost.posted_at);
  const hoursAgo = Math.round((Date.now() - postedTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
  
  console.log('📝 Test Post:');
  console.log(`   Tweet ID: ${tweetId}`);
  console.log(`   Posted: ${hoursAgo}h ago`);
  console.log(`   Content: ${recentPost.content?.substring(0, 60)}...\n`);
  
  // Check current engagement data
  const { data: currentData } = await supabase
    .from('outcomes')
    .select('*')
    .eq('tweet_id', tweetId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();
  
  console.log('📊 Current Database Data:');
  if (currentData) {
    console.log(`   Likes: ${currentData.likes || 0}`);
    console.log(`   Retweets: ${currentData.retweets || 0}`);
    console.log(`   Replies: ${currentData.replies || 0}`);
    console.log(`   Views: ${currentData.views || 0}`);
    console.log(`   Source: ${currentData.data_source}`);
    console.log(`   Last Collected: ${new Date(currentData.collected_at).toLocaleString()}\n`);
  } else {
    console.log('   ❌ No engagement data found\n');
  }
  
  // Now try to scrape it manually
  console.log('🔍 Attempting manual scrape...\n');
  
  try {
    // Import the scraping orchestrator
    const { ScrapingOrchestrator } = await import('../src/metrics/scrapingOrchestrator');
    const { UnifiedBrowserPool } = await import('../src/browser/UnifiedBrowserPool');
    
    const orchestrator = ScrapingOrchestrator.getInstance();
    const browserPool = UnifiedBrowserPool.getInstance();
    
    console.log('✅ Acquiring browser page...');
    const page = await browserPool.acquirePage('manual_test');
    
    console.log('✅ Browser acquired, starting scrape...');
    const result = await orchestrator.scrapeAndStore(
      page,
      tweetId,
      {
        collectionPhase: 'manual_test',
        postedAt: postedTime
      },
      { useAnalytics: false }
    );
    
    await browserPool.releasePage(page);
    
    console.log('\n📊 Scrape Result:');
    console.log(`   Success: ${result.success}`);
    
    if (result.success && result.metrics) {
      console.log(`   Likes: ${result.metrics.likes}`);
      console.log(`   Retweets: ${result.metrics.retweets}`);
      console.log(`   Replies: ${result.metrics.replies}`);
      console.log(`   Views: ${result.metrics.views || 0}`);
      console.log(`   Bookmarks: ${result.metrics.bookmarks || 0}\n`);
      
      // Check if it was stored
      const { data: updatedData } = await supabase
        .from('outcomes')
        .select('*')
        .eq('tweet_id', tweetId)
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();
      
      if (updatedData && updatedData.collected_at !== currentData?.collected_at) {
        console.log('✅ SUCCESS: Data was stored in database!');
        console.log(`   New Likes: ${updatedData.likes}`);
        console.log(`   New Source: ${updatedData.data_source}\n`);
      } else {
        console.log('⚠️  WARNING: Data not stored in database');
        console.log('   Scraping worked but storage failed\n');
      }
    } else {
      console.log(`   ❌ Scraping failed: ${result.error}\n`);
    }
    
  } catch (error: any) {
    console.error('\n❌ SCRAPER TEST FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack?.split('\n').slice(0, 3).join('\n')}\n`);
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 DIAGNOSTIC COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
}

testMetricsScraper()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

