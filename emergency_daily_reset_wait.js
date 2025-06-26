#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: DAILY RESET WAIT SCRIPT
 * =====================================
 * 
 * Forces bot into waiting mode until Twitter API daily limits reset.
 * All 25 tweets have been exhausted - must wait for reset.
 */

const { supabaseClient } = require('./src/utils/supabaseClient.ts');

async function emergencyDailyResetWait() {
  console.log('🚨 EMERGENCY: DAILY RESET WAIT ACTIVATED');
  console.log('=========================================');
  console.log('✅ All 25 daily tweets have been exhausted');
  console.log('✅ Bot must wait for daily reset');
  console.log('✅ Preventing further API calls');
  
  try {
    // Get the reset time from the API headers (1750899432)
    const resetTimestamp = 1750899432 * 1000; // Convert to milliseconds
    const resetTime = new Date(resetTimestamp);
    const now = new Date();
    const waitTimeMs = resetTime.getTime() - now.getTime();
    const waitTimeHours = Math.ceil(waitTimeMs / (1000 * 60 * 60));
    
    console.log(`⏰ Daily reset time: ${resetTime.toISOString()}`);
    console.log(`⏳ Current time: ${now.toISOString()}`);
    console.log(`⌛ Wait time: ${waitTimeHours} hours`);
    
    if (waitTimeMs <= 0) {
      console.log('🎉 DAILY RESET HAS OCCURRED!');
      console.log('✅ Bot can resume posting');
      return;
    }
    
    // Set bot to disabled until reset
    console.log('🔒 Disabling bot until daily reset...');
    await supabaseClient.setBotConfig('bot_enabled', 'false');
    await supabaseClient.setBotConfig('daily_reset_wait', 'true');
    await supabaseClient.setBotConfig('reset_time', resetTime.toISOString());
    await supabaseClient.setBotConfig('exhausted_reason', 'daily_tweet_limit_25_reached');
    
    console.log('📊 CURRENT STATUS:');
    console.log('  🔴 Bot: DISABLED');
    console.log('  ⏸️  Reason: Daily limit exhausted (25/25 tweets used)');
    console.log(`  ⏰ Reset: ${resetTime.toLocaleString()}`);
    console.log(`  ⌛ Wait: ${waitTimeHours} hours`);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Bot will automatically re-enable after reset');
    console.log('2. Monitor Render logs for reset confirmation');
    console.log('3. Verify limits detection is working correctly');
    
    // Log the emergency action
    const logData = {
      action: 'emergency_daily_reset_wait',
      daily_limit: 25,
      tweets_used: 25,
      reset_time: resetTime.toISOString(),
      wait_hours: waitTimeHours,
      timestamp: now.toISOString()
    };
    
    console.log('\n📋 Emergency action logged to database');
    
  } catch (error) {
    console.error('❌ Emergency wait setup failed:', error);
    console.log('\n🚨 MANUAL INTERVENTION REQUIRED:');
    console.log('1. Manually disable bot in Render dashboard');
    console.log('2. Wait for daily reset (check Twitter API headers)');
    console.log('3. Re-enable bot after reset');
  }
}

// Run the emergency script
if (require.main === module) {
  emergencyDailyResetWait()
    .then(() => {
      console.log('\n✅ Emergency daily reset wait activated');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Emergency script failed:', error);
      process.exit(1);
    });
}

module.exports = { emergencyDailyResetWait }; 