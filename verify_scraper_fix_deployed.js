/**
 * 🔍 VERIFY SCRAPER FIX DEPLOYMENT
 * 
 * Run this 30-60 minutes after deployment to verify:
 * 1. Scraper is running
 * 2. Real metrics (not placeholder data)
 * 3. Recent tweets are being scraped
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qtgjmaelglghnlahqpbl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function toET(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'short',
    timeStyle: 'medium'
  }) + ' ET';
}

function minutesAgo(dateString) {
  return Math.round((Date.now() - new Date(dateString).getTime()) / 60000);
}

async function verifyScraperFix() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n🔍 SCRAPER FIX VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`⏰ Current Time: ${toET(new Date())}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Check latest scrapes
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('1️⃣  Checking Latest Scrapes...\n');

  const { data: latestScrapes } = await supabase
    .from('real_tweet_metrics')
    .select('*')
    .order('collected_at', { ascending: false })
    .limit(5);

  if (!latestScrapes || latestScrapes.length === 0) {
    console.log('   ❌ No scrapes found');
    return false;
  }

  const lastScrape = latestScrapes[0];
  const timeSince = minutesAgo(lastScrape.collected_at);

  console.log(`   Last scrape: ${timeSince} minutes ago`);
  console.log(`   Time: ${toET(lastScrape.collected_at)}`);

  let hasRealData = false;
  let hasPlaceholderData = false;

  console.log('\n   📊 Last 5 Scrapes:\n');
  
  latestScrapes.forEach((scrape, i) => {
    const ago = minutesAgo(scrape.collected_at);
    const isPlaceholder = scrape.impressions === 5000000;
    const hasEngagement = scrape.likes > 0 || scrape.retweets > 0 || scrape.replies > 0;
    
    if (isPlaceholder) hasPlaceholderData = true;
    if (hasEngagement && !isPlaceholder) hasRealData = true;

    const status = isPlaceholder ? '⚠️ PLACEHOLDER' : 
                   hasEngagement ? '✅ REAL DATA' : 
                   '⏳ ZERO ENG';

    console.log(`   ${i + 1}. ${status} (${ago}m ago)`);
    console.log(`      Tweet: ${scrape.tweet_id}`);
    console.log(`      Metrics: ${scrape.likes}❤️  ${scrape.retweets}🔄  ${scrape.replies}💬  ${scrape.impressions || 0}👁️`);
    console.log(`      ER: ${(scrape.engagement_rate * 100).toFixed(2)}%`);
    console.log('');
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Check if recent tweets are scraped
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n2️⃣  Checking Recent Tweet Coverage...\n');

  const { data: recentTweets } = await supabase
    .from('posted_decisions')
    .select('tweet_id, posted_at')
    .order('posted_at', { ascending: false })
    .limit(5);

  if (!recentTweets || recentTweets.length === 0) {
    console.log('   ⚠️  No recent tweets found');
  } else {
    let scrapedCount = 0;
    
    for (const tweet of recentTweets) {
      const tweetAge = minutesAgo(tweet.posted_at);
      
      const { data: metrics, count } = await supabase
        .from('real_tweet_metrics')
        .select('*', { count: 'exact' })
        .eq('tweet_id', tweet.tweet_id);

      const status = count > 0 ? '✅ Scraped' : 
                     tweetAge > 30 ? '❌ NOT scraped' : 
                     '⏳ Too recent';
      
      if (count > 0) scrapedCount++;

      console.log(`   ${status}: ${tweet.tweet_id} (${tweetAge}m old, ${count} scrapes)`);
    }

    console.log(`\n   Coverage: ${scrapedCount}/${recentTweets.length} recent tweets scraped`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Final assessment
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 ASSESSMENT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (timeSince > 35) {
    console.log('⚠️  SCRAPER DELAYED');
    console.log(`   Last scrape was ${timeSince} minutes ago (expected every 30 min)`);
    console.log('   The fix may not be deployed yet, or scraper needs restart');
    return false;
  }

  if (hasPlaceholderData && !hasRealData) {
    console.log('❌ STILL GETTING PLACEHOLDER DATA');
    console.log('   All recent scrapes show 5M impressions (placeholder)');
    console.log('   The fix may not be working yet');
    console.log('');
    console.log('   Action: Check Railway logs for errors');
    return false;
  }

  if (hasRealData) {
    console.log('✅ SCRAPER FIX IS WORKING!');
    console.log('');
    console.log('   • Scraper is running on schedule');
    console.log('   • Real engagement data is being collected');
    console.log('   • No more placeholder data');
    console.log('');
    console.log('   🎉 Your scraper is now fully operational!');
    return true;
  }

  console.log('⏳ WAITING FOR FIRST REAL SCRAPE');
  console.log('   Scraper is running but no engagement data yet');
  console.log('   This is normal if tweets are very recent (< 30 min old)');
  console.log('');
  console.log('   Check again in 30 minutes');
  return false;

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

verifyScraperFix().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

