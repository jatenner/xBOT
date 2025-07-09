#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function diagnosePostingIssue() {
  console.log('🔍 DIAGNOSING POSTING ISSUE - 9:10 AM Analysis');
  console.log('===============================================\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('📊 POTENTIAL ISSUES FROM YESTERDAY\'S LOGS:');
  console.log('==========================================');
  console.log('1. ✅ Hit Twitter rate limit (0/17 remaining) - EXPECTED');
  console.log('2. ⚠️  Database config insert errors (duplicate key violations)');
  console.log('3. ⚠️  News API insert failures ("Cannot read properties of undefined")');
  console.log('4. ⚠️  Bot may be stuck in emergency mode or waiting state\n');

  // Check 1: Bot Configuration Status
  console.log('🔧 CHECKING BOT CONFIGURATION:');
  console.log('==============================');
  
  try {
    const { data: botConfigs, error } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', [
        'bot_enabled',
        'emergency_mode',
        'runtime_config',
        'real_time_limits_config',
        'emergency_timing',
        'last_error_twitter_post',
        'emergency_rate_limits'
      ]);

    if (error) {
      console.log('❌ Error fetching bot config:', error.message);
    } else {
      botConfigs.forEach(config => {
        const value = typeof config.value === 'string' ? config.value : JSON.stringify(config.value);
        console.log(`   ${config.key}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
      });
    }
  } catch (error) {
    console.log('❌ Bot config check failed:', error.message);
  }

  // Check 2: Daily Posting State
  console.log('\n📅 CHECKING DAILY POSTING STATE:');
  console.log('================================');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyState, error } = await supabase
      .from('daily_posting_state')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code === 'PGRST116') {
      console.log('⚠️  No daily posting state found for today');
      console.log('💡 This could mean the daily reset didn\'t happen');
    } else if (error) {
      console.log('❌ Error fetching daily state:', error.message);
    } else {
      console.log('✅ Daily posting state found:');
      console.log(`   Date: ${dailyState.date}`);
      console.log(`   Posts completed: ${dailyState.posts_completed || 0}`);
      console.log(`   Posts target: ${dailyState.posts_target || 'unknown'}`);
      console.log(`   Last post time: ${dailyState.last_post_time || 'never'}`);
      console.log(`   Emergency mode: ${dailyState.emergency_mode || false}`);
      console.log(`   Strategy: ${dailyState.strategy || 'unknown'}`);
    }
  } catch (error) {
    console.log('❌ Daily state check failed:', error.message);
  }

  // Check 3: Recent Tweets
  console.log('\n🐦 CHECKING RECENT TWEETS:');
  console.log('==========================');
  
  try {
    const { data: recentTweets, error } = await supabase
      .from('tweets')
      .select('tweet_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log('❌ Error fetching recent tweets:', error.message);
    } else if (recentTweets.length === 0) {
      console.log('⚠️  No tweets found in database');
    } else {
      console.log(`✅ Found ${recentTweets.length} recent tweets:`);
      recentTweets.forEach((tweet, index) => {
        const time = new Date(tweet.created_at).toLocaleString();
        console.log(`   ${index + 1}. ${time}: "${tweet.content.substring(0, 50)}..."`);
      });
    }
  } catch (error) {
    console.log('❌ Recent tweets check failed:', error.message);
  }

  // Check 4: API Usage Today
  console.log('\n📊 CHECKING TODAY\'S API USAGE:');
  console.log('==============================');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: apiUsage, error } = await supabase
      .from('api_usage_tracking')
      .select('*')
      .eq('date', today);

    if (error) {
      console.log('❌ Error fetching API usage:', error.message);
    } else if (apiUsage.length === 0) {
      console.log('⚠️  No API usage recorded today');
      console.log('💡 This suggests the bot hasn\'t been active');
    } else {
      console.log('✅ API usage today:');
      apiUsage.forEach(usage => {
        console.log(`   ${usage.api_type}: ${usage.count} calls, $${usage.cost}`);
      });
    }
  } catch (error) {
    console.log('❌ API usage check failed:', error.message);
  }

  // Check 5: System Logs for Errors
  console.log('\n📋 CHECKING RECENT SYSTEM LOGS:');
  console.log('===============================');
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: logs, error } = await supabase
      .from('system_logs')
      .select('action, timestamp, data')
      .gte('timestamp', yesterday.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.log('❌ Error fetching system logs:', error.message);
    } else if (logs.length === 0) {
      console.log('⚠️  No recent system logs found');
    } else {
      console.log(`✅ Found ${logs.length} recent system logs:`);
      logs.forEach((log, index) => {
        const time = new Date(log.timestamp).toLocaleString();
        console.log(`   ${index + 1}. ${time}: ${log.action}`);
      });
    }
  } catch (error) {
    console.log('❌ System logs check failed:', error.message);
  }

  // Recommendations
  console.log('\n💡 DIAGNOSIS AND RECOMMENDATIONS:');
  console.log('==================================');
  
  const now = new Date();
  const currentHour = now.getHours();
  
  console.log(`⏰ Current time: ${now.toLocaleString()}`);
  console.log(`🕘 Current hour: ${currentHour} (Good posting time: 6-18)`);
  
  if (currentHour >= 6 && currentHour <= 18) {
    console.log('✅ We\'re in a good posting window (6 AM - 6 PM)');
  } else {
    console.log('⚠️  Outside optimal posting hours');
  }
  
  console.log('\n🔧 LIKELY FIXES:');
  console.log('================');
  console.log('1. 🔄 Twitter daily limits should have reset at midnight');
  console.log('2. 🚨 Bot may be stuck in emergency/rate-limit mode from yesterday');
  console.log('3. 🗄️ Daily posting state may need to be reset for today');
  console.log('4. ⚙️ Configuration conflicts from duplicate key errors');
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('==============');
  console.log('1. Check if Twitter limits actually reset (should be 17/17 available)');
  console.log('2. Clear any emergency configurations blocking posting');
  console.log('3. Reset daily posting state if needed');
  console.log('4. Restart the bot service to clear any stuck states');
  console.log('5. Monitor logs for continued posting activity');

  console.log('\n🚀 WANT TO FIX AUTOMATICALLY?');
  console.log('=============================');
  console.log('Run: node fix_posting_blockage.js');
  console.log('This will clear emergency states and reset for today');
}

// Run the diagnostic
diagnosePostingIssue().catch(console.error); 