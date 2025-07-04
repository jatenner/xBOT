#!/usr/bin/env node
/**
 * 🔍 VERIFY POSTING FIX
 * Check if the daily_posting_state table was created and system is ready
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyPostingFix() {
  console.log('🔍 === VERIFYING POSTING FIX ===');
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // 1. Check if daily_posting_state table exists and has today's data
    console.log('\n📊 Checking daily_posting_state table...');
    const { data: dailyState, error: dailyError } = await supabase
      .from('daily_posting_state')
      .select('*')
      .eq('date', today)
      .single();
    
    if (dailyError) {
      console.error('❌ Daily posting state check failed:', dailyError);
      console.log('💡 The table may not exist or today\'s entry is missing');
      return;
    } else {
      console.log('✅ Daily posting state found:');
      console.log(`   📅 Date: ${dailyState.date}`);
      console.log(`   📊 Progress: ${dailyState.posts_completed}/${dailyState.posts_target}`);
      console.log(`   ⏰ Next post: ${new Date(dailyState.next_post_time).toLocaleString()}`);
      console.log(`   🚨 Emergency mode: ${dailyState.emergency_mode}`);
      console.log(`   📅 Schedule slots: ${Array.isArray(dailyState.posting_schedule) ? dailyState.posting_schedule.length : 'N/A'}`);
    }
    
    // 2. Check startup posting override flag
    console.log('\n🚀 Checking startup posting override...');
    const { data: overrideFlag, error: overrideError } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'startup_posting_override')
      .single();
    
    if (overrideError) {
      console.error('❌ Override flag check failed:', overrideError);
    } else {
      const flagValue = typeof overrideFlag.value === 'string' ? JSON.parse(overrideFlag.value) : overrideFlag.value;
      console.log('✅ Startup posting override flag:');
      console.log(`   🚀 Enabled: ${flagValue.enabled}`);
      console.log(`   💥 Force immediate post: ${flagValue.force_immediate_post}`);
      console.log(`   🧹 Clear phantom times: ${flagValue.clear_phantom_times}`);
      console.log(`   💡 Reason: ${flagValue.reason}`);
    }
    
    // 3. Check current time vs posting hours
    console.log('\n⏰ Checking posting time compatibility...');
    const now = new Date();
    const currentHour = now.getHours();
    const inPostingHours = currentHour >= 9 && currentHour <= 21;
    
    console.log(`🕐 Current time: ${now.toLocaleString()}`);
    console.log(`🕐 Current hour: ${currentHour}`);
    console.log(`🌅 In posting window (9-21): ${inPostingHours ? 'YES' : 'NO'}`);
    
    if (!inPostingHours) {
      const hoursUntil9AM = currentHour < 9 ? 9 - currentHour : 24 - currentHour + 9;
      console.log(`⏰ Next posting window starts in: ${hoursUntil9AM} hours (at 9:00 AM)`);
    }
    
    // 4. Check today's tweet count
    console.log('\n📊 Checking today\'s tweet count...');
    const { data: todaysTweets, count: tweetCount } = await supabase
      .from('tweets')
      .select('id, created_at', { count: 'exact' })
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false });
    
    console.log(`📊 Tweets posted today: ${tweetCount || 0}`);
    if (tweetCount && tweetCount > 0) {
      console.log('📝 Most recent tweet:', new Date(todaysTweets[0].created_at).toLocaleString());
    }
    
    // 5. Overall system status
    console.log('\n🎯 === SYSTEM STATUS SUMMARY ===');
    
    const isReady = dailyState && !dailyError;
    const hasOverride = overrideFlag && !overrideError;
    const canPostNow = inPostingHours && isReady && hasOverride;
    
    if (isReady) {
      console.log('✅ Daily Posting Manager: READY');
    } else {
      console.log('❌ Daily Posting Manager: NOT READY');
    }
    
    if (hasOverride) {
      console.log('✅ Posting Override Flag: SET');
    } else {
      console.log('❌ Posting Override Flag: MISSING');
    }
    
    if (canPostNow) {
      console.log('🚀 IMMEDIATE POSTING: POSSIBLE');
      console.log('💡 The bot should post within the next few minutes!');
    } else if (isReady && hasOverride) {
      console.log('⏰ SCHEDULED POSTING: READY');
      console.log('💡 The bot will start posting when posting hours begin (9 AM - 9 PM)');
    } else {
      console.log('❌ POSTING: BLOCKED');
      console.log('💡 Fix the missing components above');
    }
    
    // 6. Next steps
    console.log('\n📝 === NEXT STEPS ===');
    if (canPostNow) {
      console.log('1. 👀 Watch the Render production logs for posting activity');
      console.log('2. ⏰ Posts should appear within 5-10 minutes');
      console.log('3. 📊 Check Twitter (@SignalAndSynapse) for new tweets');
    } else if (isReady && hasOverride) {
      console.log('1. ⏰ Wait for posting hours (9 AM - 9 PM)');
      console.log('2. 👀 Watch the Render production logs starting at 9 AM');
      console.log('3. 📊 Posts should begin automatically at 9:00 AM');
    } else {
      console.log('1. ❌ Run the SQL in Supabase SQL Editor first');
      console.log('2. 🔄 Re-run this verification script');
      console.log('3. ✅ Ensure all components show as READY');
    }
    
    console.log('\n✅ VERIFICATION COMPLETE');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the verification
verifyPostingFix().catch(console.error); 