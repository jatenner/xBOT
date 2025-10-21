require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function monitorScraperLogs() {
  console.log('👁️  MONITORING FOR NEXT SCRAPER RUN\n');
  console.log('='.repeat(80));
  
  // Get baseline
  const { data: baseline } = await supabase
    .from('outcomes')
    .select('tweet_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!baseline) {
    console.log('❌ No baseline data');
    return;
  }
  
  const lastUpdate = new Date(baseline.updated_at);
  const now = new Date();
  const minutesSince = Math.floor((now - lastUpdate) / 60000);
  
  console.log(`\n📊 BASELINE:`);
  console.log(`   Last scrape: ${lastUpdate.toLocaleTimeString()} (${minutesSince} min ago)`);
  console.log(`   Last tweet: ${baseline.tweet_id}`);
  console.log(`   Scraper runs: Every 10 minutes`);
  console.log(`   Next run in: ~${10 - (minutesSince % 10)} minutes`);
  
  console.log(`\n⏳ Waiting for next scraper run...`);
  console.log(`   Checking every 30 seconds for new data\n`);
  
  let checks = 0;
  const maxChecks = 20; // 10 minutes
  
  const interval = setInterval(async () => {
    checks++;
    
    const { data: current } = await supabase
      .from('outcomes')
      .select('tweet_id, updated_at, views, impressions, likes, retweets, replies, profile_clicks')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!current) return;
    
    const newUpdate = new Date(current.updated_at);
    
    if (newUpdate > lastUpdate) {
      clearInterval(interval);
      
      console.log('\n🎉 NEW SCRAPE DETECTED!\n');
      console.log('='.repeat(80));
      console.log(`\n📊 LATEST SCRAPE RESULT:\n`);
      console.log(`   Tweet: ${current.tweet_id}`);
      console.log(`   Updated: ${newUpdate.toLocaleTimeString()}`);
      console.log(`\n   Metrics:`);
      console.log(`      views: ${current.views ?? 'null'} ${current.views ? '✅' : '❌'}`);
      console.log(`      impressions: ${current.impressions ?? 'null'} ${current.impressions ? '✅' : '❌'}`);
      console.log(`      profile_clicks: ${current.profile_clicks ?? 'null'} ${current.profile_clicks !== null ? '✅' : '❌'}`);
      console.log(`      likes: ${current.likes ?? 'null'} ${current.likes !== null ? '✅' : '❌'}`);
      console.log(`      retweets: ${current.retweets ?? 'null'} ${current.retweets !== null ? '✅' : '❌'}`);
      console.log(`      replies: ${current.replies ?? 'null'} ${current.replies !== null ? '✅' : '❌'}`);
      
      const successCount = [
        current.views !== null,
        current.impressions !== null,
        current.profile_clicks !== null,
        current.likes !== null,
        current.retweets !== null,
        current.replies !== null
      ].filter(Boolean).length;
      
      console.log(`\n   Success Rate: ${successCount}/6 metrics (${((successCount/6)*100).toFixed(0)}%)`);
      
      if (successCount >= 4) {
        console.log(`\n   ✅✅✅ SCRAPER WORKING!`);
        console.log(`   Most metrics captured successfully!`);
      } else if (successCount >= 1) {
        console.log(`\n   ⚠️  PARTIAL SUCCESS`);
        console.log(`   Some metrics captured, others failed.`);
        console.log(`   Check Railway logs for details.`);
      } else {
        console.log(`\n   ❌ SCRAPER STILL FAILING`);
        console.log(`   No metrics captured.`);
        console.log(`   Check Railway logs for error messages.`);
      }
      
      console.log(`\n💡 TO SEE DEBUG LOGS:`);
      console.log(`   npm run logs | grep "URL CHECK\\|ANALYTICS\\|VALIDATION"`);
      console.log(`   Or check Railway dashboard for full logs`);
      
      process.exit(0);
    } else {
      process.stdout.write(`   Check ${checks}/${maxChecks}: Waiting...\r`);
    }
    
    if (checks >= maxChecks) {
      clearInterval(interval);
      console.log(`\n\n⏰ Timeout: No new scrape in 10 minutes`);
      console.log(`   Scraper may not be running or is skipping tweets`);
      process.exit(1);
    }
  }, 30000);
}

monitorScraperLogs().catch(console.error);

