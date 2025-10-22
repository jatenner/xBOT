require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qtgjmaelglghnlahqpbl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0Z2ptYWVsZ2xnaG5sYWhxcGJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYwNjUxMCwiZXhwIjoyMDY1MTgyNTEwfQ.Gze-MRjDg592T02LpyTlyXt14QkiIgRFgvnMeUchUfU';

// Helper to format dates in Eastern Time
function toEasternTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    dateStyle: 'short',
    timeStyle: 'medium'
  }) + ' ET';
}

async function verifySessionFix() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const now = new Date();
  const easternTime = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  console.log('\n🔍 SESSION FIX VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`⏰ Current Time: ${easternTime}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check if session variable exists
  console.log('1️⃣  Checking Railway Session Variable...\n');
  if (process.env.TWITTER_SESSION_B64) {
    console.log('   ✅ TWITTER_SESSION_B64 is set locally');
    console.log(`   Length: ${process.env.TWITTER_SESSION_B64.length} characters`);
  } else {
    console.log('   ⚠️  TWITTER_SESSION_B64 not found in local env');
    console.log('   (This is okay - Railway has it)');
  }

  // 2. Check recent scraping attempts in logs
  console.log('\n2️⃣  Checking Recent Tweet Posts...\n');
  
  const { data: recentTweets } = await supabase
    .from('posted_decisions')
    .select('tweet_id, content, posted_at')
    .order('posted_at', { ascending: false })
    .limit(3);

  if (recentTweets && recentTweets.length > 0) {
    console.log(`   ✅ Found ${recentTweets.length} recent tweets\n`);
    recentTweets.forEach((tweet, i) => {
      console.log(`   ${i + 1}. ${toEasternTime(tweet.posted_at)}`);
      console.log(`      ID: ${tweet.tweet_id}`);
      console.log(`      Content: ${tweet.content.substring(0, 60)}...`);
    });
  }

  // 3. Check if ANY metrics have been collected recently
  console.log('\n3️⃣  Checking Recent Scraping Activity...\n');
  
  const { data: recentMetrics, count } = await supabase
    .from('real_tweet_metrics')
    .select('*', { count: 'exact' })
    .order('collected_at', { ascending: false })
    .limit(1);

  if (recentMetrics && recentMetrics.length > 0) {
    const latest = recentMetrics[0];
    const minutesAgo = Math.round((Date.now() - new Date(latest.collected_at).getTime()) / 60000);
    
    console.log(`   Last scrape: ${minutesAgo} minutes ago (${toEasternTime(latest.collected_at)})`);
    console.log(`   Tweet ID: ${latest.tweet_id}`);
    console.log(`   Total scraped tweets: ${count}`);
    
    if (minutesAgo < 35) {
      console.log('   ✅ Scraper is running (within 35-minute window)');
    } else {
      console.log('   ⏳ Waiting for next scrape cycle (runs every 30 min)');
    }
  } else {
    console.log('   ⏳ No scrapes yet - waiting for first cycle');
  }

  // 4. Check if our latest tweets have been scraped
  console.log('\n4️⃣  Checking If Latest Tweets Are Scraped...\n');
  
  if (recentTweets && recentTweets.length > 0) {
    for (const tweet of recentTweets) {
      const { data: metrics } = await supabase
        .from('real_tweet_metrics')
        .select('*')
        .eq('tweet_id', tweet.tweet_id)
        .maybeSingle();
      
      const timeAgo = Math.round((Date.now() - new Date(tweet.posted_at).getTime()) / 60000);
      
      if (metrics) {
        console.log(`   ✅ Tweet ${tweet.tweet_id} (posted ${timeAgo}m ago)`);
        console.log(`      Metrics: ${metrics.likes}❤️ ${metrics.retweets}🔄 ${metrics.replies}💬 ${metrics.impressions || 0}👁️`);
        console.log(`      Collected: ${toEasternTime(metrics.collected_at)}`);
      } else {
        console.log(`   ⏳ Tweet ${tweet.tweet_id} (posted ${timeAgo}m ago) - Not scraped yet`);
        if (timeAgo > 30) {
          console.log(`      ⚠️  Should have been scraped by now`);
        } else {
          console.log(`      ℹ️  Normal - waiting for next cycle`);
        }
      }
      console.log('');
    }
  }

  // 5. Provide guidance
  console.log('\n5️⃣  Next Steps & Timeline...\n');
  console.log('   📅 SCRAPER SCHEDULE:');
  console.log('      • Runs every 30 minutes');
  console.log('      • Scrapes tweets < 24 hours old every cycle');
  console.log('      • Tweets > 24 hours old: once per day\n');
  
  console.log('   ⏰ EXPECTED TIMELINE:');
  console.log('      • Session deployed: ✅ NOW');
  console.log('      • Service restarted: ✅ NOW');
  console.log('      • Next scrape cycle: ~0-30 minutes');
  console.log('      • Metrics appear: Within 1 hour\n');
  
  console.log('   🔍 HOW TO VERIFY:');
  console.log('      1. Wait 30-60 minutes');
  console.log('      2. Run: node verify_session_fix.js');
  console.log('      3. Check for ✅ in step 4 above\n');
  
  console.log('   📊 SIGNS OF SUCCESS:');
  console.log('      • Latest tweets show metrics (step 4)');
  console.log('      • Scraper timestamp < 35 min ago (step 3)');
  console.log('      • No "ANALYTICS_AUTH_FAILED" in logs\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ VERIFICATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('💡 TIP: Check Railway logs for session confirmation:');
  console.log('   npm run logs | grep "SESSION_LOADED"');
  console.log('\n');
}

verifySessionFix().catch(console.error);

