require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function monitorNextScrape() {
  console.log('👁️  MONITORING NEXT SCRAPER RUN\n');
  console.log('='.repeat(80));
  
  // Get current state
  const { data: current } = await supabase
    .from('outcomes')
    .select('tweet_id, updated_at, views, impressions, profile_clicks, likes')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!current) {
    console.log('\n❌ No outcomes found');
    return;
  }
  
  const lastUpdate = new Date(current.updated_at);
  const now = new Date();
  const minutesSinceUpdate = Math.floor((now - lastUpdate) / 60000);
  
  console.log(`\n📊 CURRENT STATE:`);
  console.log(`   Last scraped: ${lastUpdate.toLocaleTimeString()} (${minutesSinceUpdate} min ago)`);
  console.log(`   Tweet ID: ${current.tweet_id}`);
  console.log(`   Views: ${current.views ?? 'null'}`);
  console.log(`   Impressions: ${current.impressions ?? 'null'}`);
  console.log(`   Profile clicks: ${current.profile_clicks ?? 'null'}`);
  console.log(`   Likes: ${current.likes ?? 'null'}`);
  
  console.log(`\n⏰ TIMELINE:`);
  console.log(`   ✅ Enhanced scraper deployed (2 min ago)`);
  console.log(`   📊 Changes:`);
  console.log(`      - Now saves profile_clicks to database`);
  console.log(`      - Logs extracted metrics before saving`);
  console.log(`      - 4 different regex patterns for Impressions`);
  console.log(`      - Shows page content preview (first 1000 chars)`);
  
  const nextScrapeIn = 10 - (minutesSinceUpdate % 10);
  console.log(`\n⏳ NEXT SCRAPER RUN:`);
  console.log(`   Expected in: ~${nextScrapeIn} minutes`);
  console.log(`   Will scrape: ${current.tweet_id} (and other recent tweets)`);
  
  console.log(`\n🔍 WHAT TO LOOK FOR IN LOGS:`);
  console.log(`   1. "[METRICS_JOB] 🔍 Extracted metrics for..." ← Shows what scraper found`);
  console.log(`   2. "📊 ANALYTICS: Page content preview" ← First 1000 chars of page`);
  console.log(`   3. "✅ IMPRESSIONS:" or "❌ IMPRESSIONS:" ← Did regex match?`);
  console.log(`   4. "🐛 Found Impression context" ← Text around "Impression"`);
  
  console.log(`\n📋 EXPECTED OUTCOMES:`);
  console.log(`\n   SCENARIO A: Regex patterns work`);
  console.log(`      Logs: "✅ IMPRESSIONS: 8"`);
  console.log(`      Logs: "✅ PROFILE VISITS: 0"`);
  console.log(`      Database: views: 8, impressions: 8, profile_clicks: 0`);
  console.log(`      Result: 🎉 SUCCESS! Learning system activated!`);
  
  console.log(`\n   SCENARIO B: Analytics page has different format`);
  console.log(`      Logs: "❌ IMPRESSIONS: No match found"`);
  console.log(`      Logs: "🐛 Found Impression context: [...some text...]"`);
  console.log(`      Database: Still null`);
  console.log(`      Result: Need to adjust regex based on context shown`);
  
  console.log(`\n   SCENARIO C: Can't access analytics page`);
  console.log(`      Logs: "Contains 'permission'? true"`);
  console.log(`      Database: Still null`);
  console.log(`      Result: Need to implement fallback to regular page`);
  
  console.log(`\n🎯 TO CHECK RESULTS (after ${nextScrapeIn} min):`);
  console.log(`   Run: node check_if_impressions_fixed.js`);
  console.log(`   Or check Railway logs for [METRICS_JOB] lines\n`);
  
  // Set up a simple poller
  console.log('='.repeat(80));
  console.log(`\n⏳ Waiting for next update... (checking every 30 seconds)\n`);
  
  let checks = 0;
  const maxChecks = 20; // Check for 10 minutes
  
  const interval = setInterval(async () => {
    checks++;
    
    const { data: updated } = await supabase
      .from('outcomes')
      .select('tweet_id, updated_at, views, impressions, profile_clicks, likes')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!updated) return;
    
    const newUpdate = new Date(updated.updated_at);
    
    if (newUpdate > lastUpdate) {
      clearInterval(interval);
      
      console.log('🎉 NEW SCRAPE DETECTED!\n');
      console.log('='.repeat(80));
      console.log(`\n📊 RESULTS:`);
      console.log(`   Tweet ID: ${updated.tweet_id}`);
      console.log(`   Updated: ${newUpdate.toLocaleTimeString()}`);
      console.log(`\n   Metrics:`);
      console.log(`      Views: ${updated.views ?? 'null'} ${updated.views !== null ? '✅' : '❌'}`);
      console.log(`      Impressions: ${updated.impressions ?? 'null'} ${updated.impressions !== null ? '✅' : '❌'}`);
      console.log(`      Profile clicks: ${updated.profile_clicks ?? 'null'} ${updated.profile_clicks !== null ? '✅' : '❌'}`);
      console.log(`      Likes: ${updated.likes ?? 'null'} ${updated.likes !== null ? '✅' : '❌'}`);
      
      if (updated.views !== null && updated.impressions !== null) {
        console.log(`\n🎉🎉🎉 SUCCESS! IMPRESSIONS ARE BEING SAVED! 🎉🎉🎉`);
        console.log(`\n✅ Learning system is now FULLY OPERATIONAL!`);
        console.log(`✅ Bot will learn from: ${updated.views} views → more views over time`);
        console.log(`✅ AI will optimize content based on what gets impressions!`);
      } else {
        console.log(`\n❌ Still not working. Check Railway logs for debug output.`);
        console.log(`   Search for: "[METRICS_JOB] 🔍 Extracted metrics"`);
        console.log(`   Search for: "📊 ANALYTICS: Page content preview"`);
      }
      
      process.exit(0);
    } else {
      process.stdout.write(`   Check ${checks}/${maxChecks}: No update yet...\r`);
    }
    
    if (checks >= maxChecks) {
      clearInterval(interval);
      console.log(`\n\n⏰ Timeout: No scraper run detected in 10 minutes`);
      console.log(`   Scraper might be paused or failing silently`);
      console.log(`   Check Railway logs to see if scraper job is running`);
      process.exit(1);
    }
  }, 30000); // Check every 30 seconds
}

monitorNextScrape().catch(console.error);

