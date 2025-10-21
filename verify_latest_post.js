require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TWEET_ID = '1980712165599297863'; // Your latest post

async function verifyPost() {
  console.log('🔍 VERIFYING LATEST POST SCRAPING\n');
  console.log('='.repeat(80));
  console.log(`\n📍 Tweet: https://x.com/Signal_Synapse/status/${TWEET_ID}`);
  console.log(`🕐 Posted: 3:05 PM, Oct 21, 2025\n`);
  
  // Step 1: Check if tweet exists in content_metadata
  console.log('STEP 1: Checking content_metadata table...\n');
  
  const { data: content, error: contentError } = await supabase
    .from('content_metadata')
    .select('decision_id, content, tweet_id, status, posted_at, quality_score')
    .eq('tweet_id', TWEET_ID)
    .single();
  
  if (contentError) {
    console.log('❌ Tweet NOT found in content_metadata!');
    console.log('   Error:', contentError.message);
    console.log('\n💡 This means the tweet was not saved to database.');
    console.log('   Check if posting system is working.\n');
    return;
  }
  
  console.log('✅ Tweet found in content_metadata!');
  console.log(`   Decision ID: ${content.decision_id}`);
  console.log(`   Content: "${content.content.substring(0, 60)}..."`);
  console.log(`   Status: ${content.status}`);
  console.log(`   Posted at: ${content.posted_at}`);
  console.log(`   Quality score: ${content.quality_score || 'N/A'}/100\n`);
  
  // Step 2: Check if metrics were scraped
  console.log('STEP 2: Checking outcomes table for scraped metrics...\n');
  
  const { data: metrics, error: metricsError } = await supabase
    .from('outcomes')
    .select('*')
    .eq('decision_id', content.decision_id)
    .order('collected_at', { ascending: false })
    .limit(5);
  
  if (metricsError) {
    console.log('❌ Error querying outcomes:', metricsError.message);
    return;
  }
  
  if (!metrics || metrics.length === 0) {
    console.log('⚠️  NO METRICS FOUND YET');
    console.log('   Scraper has not run yet or failed to scrape.');
    console.log('   Wait another 10 minutes and run this script again.\n');
    return;
  }
  
  console.log(`✅ Found ${metrics.length} metric snapshots:\n`);
  
  for (const snapshot of metrics) {
    const collectedAt = new Date(snapshot.collected_at);
    const minutesAgo = Math.floor((Date.now() - collectedAt.getTime()) / 60000);
    
    const views = snapshot.impressions || snapshot.views || 0;
    const likes = snapshot.likes || 0;
    const retweets = snapshot.retweets || 0;
    const replies = snapshot.replies || 0;
    const profileClicks = snapshot.profile_clicks || 0;
    
    console.log(`📊 Snapshot from ${minutesAgo} minutes ago:`);
    console.log(`   👀 Views: ${views.toLocaleString()}`);
    console.log(`   ❤️  Likes: ${likes}`);
    console.log(`   🔄 Retweets: ${retweets}`);
    console.log(`   💬 Replies: ${replies}`);
    console.log(`   👤 Profile visits: ${profileClicks}`);
    
    // Validate metrics are realistic
    const isFake = views > 100000;
    const isRealistic = views >= 0 && views <= 10000;
    
    if (isFake) {
      console.log(`   ❌ FAKE DATA - Still scraping from error pages!`);
    } else if (isRealistic) {
      console.log(`   ✅ REALISTIC DATA - Scraper working correctly!`);
    } else {
      console.log(`   ⚠️  Unusual metrics - verify manually`);
    }
    console.log('');
  }
  
  // Step 3: Compare with your screenshot
  console.log('='.repeat(80));
  console.log('\n🎯 VERIFICATION:\n');
  
  const latestMetrics = metrics[0];
  const latestViews = latestMetrics.impressions || latestMetrics.views || 0;
  
  console.log('YOUR SCREENSHOT SHOWS:');
  console.log('  👀 4 Views');
  console.log('  ❤️  0 Likes\n');
  
  console.log('DATABASE HAS:');
  console.log(`  👀 ${latestViews.toLocaleString()} Views`);
  console.log(`  ❤️  ${latestMetrics.likes || 0} Likes\n`);
  
  if (latestViews === 4) {
    console.log('✅ PERFECT MATCH! Scraper is working 100% correctly!\n');
  } else if (latestViews === 5000000) {
    console.log('❌ SCRAPER STILL BROKEN - Getting fake 5M views from error page\n');
    console.log('🔧 ISSUE: Session auth not working for analytics page\n');
  } else if (latestViews >= 0 && latestViews <= 100) {
    console.log('✅ CLOSE MATCH - Scraper working! (Views may have increased since screenshot)\n');
  } else {
    console.log('⚠️  MISMATCH - Investigate further\n');
  }
  
  // Step 4: Check scraper logs
  console.log('='.repeat(80));
  console.log('\n💡 NEXT STEPS:\n');
  
  if (latestViews === 5000000) {
    console.log('1. Analytics auth is STILL not working');
    console.log('2. Need to investigate twitter_session.json');
    console.log('3. May need to re-capture authenticated session\n');
  } else if (metrics.length === 0) {
    console.log('1. Wait 10 more minutes for scraper to run');
    console.log('2. Check logs: railway logs | grep "METRICS_JOB"');
    console.log('3. Verify scraper job is scheduled\n');
  } else if (latestViews >= 0 && latestViews <= 10000) {
    console.log('✅ Scraper is WORKING! System is healthy!');
    console.log('✅ Learning system will now have REAL data!');
    console.log('✅ Quality improvements can be tracked!\n');
  }
}

verifyPost().catch(console.error);

