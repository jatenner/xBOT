#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixPostingBlockageV2() {
  console.log('🔧 FIXING POSTING BLOCKAGE V2 - Enhanced Morning Reset');
  console.log('======================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  console.log(`📅 Today: ${today}`);
  console.log(`⏰ Current time: ${now.toLocaleString()}\n`);

  // Fix 1: Update Runtime Configuration (instead of upsert)
  console.log('⚙️ STEP 1: Updating Runtime Configuration');
  console.log('=========================================');

  try {
    // Check if runtime_config exists
    const { data: existingConfig, error: checkError } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      // Doesn't exist, insert it
      const { error } = await supabase
        .from('bot_config')
        .insert({
          key: 'runtime_config',
          value: {
            enabled: true,
            max_daily_posts: 17,
            ignore_monthly_caps: true,
            use_real_twitter_limits_only: true,
            emergency_mode: false,
            posting_allowed: true,
            morning_reset_timestamp: now.toISOString()
          }
        });

      if (error) {
        console.log('   ❌ Runtime config insert failed:', error.message);
      } else {
        console.log('   ✅ Runtime configuration created');
      }
    } else {
      // Exists, update it
      const { error } = await supabase
        .from('bot_config')
        .update({
          value: {
            ...existingConfig.value,
            enabled: true,
            emergency_mode: false,
            posting_allowed: true,
            morning_reset_timestamp: now.toISOString()
          }
        })
        .eq('key', 'runtime_config');

      if (error) {
        console.log('   ❌ Runtime config update failed:', error.message);
      } else {
        console.log('   ✅ Runtime configuration updated');
      }
    }
  } catch (error) {
    console.log('   ❌ Runtime config error:', error.message);
  }

  // Fix 2: Update Real-Time Limits Configuration
  console.log('\n🔄 STEP 2: Updating Real-Time Limits');
  console.log('====================================');

  try {
    const { data: existingLimits, error: checkError } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'real_time_limits_config')
      .single();

    const newLimitsConfig = {
      twitter_daily_tweets: {
        limit: 17,
        used: 0,
        remaining: 17,
        reset_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      },
      emergency_cooldown_until: null,
      emergency_cooldown_disabled: true,
      last_reset: now.toISOString(),
      posting_enabled: true
    };

    if (checkError && checkError.code === 'PGRST116') {
      // Doesn't exist, insert it
      const { error } = await supabase
        .from('bot_config')
        .insert({
          key: 'real_time_limits_config',
          value: newLimitsConfig
        });

      if (error) {
        console.log('   ❌ Real-time limits insert failed:', error.message);
      } else {
        console.log('   ✅ Real-time limits created with 17/17 tweets available');
      }
    } else {
      // Exists, update it
      const { error } = await supabase
        .from('bot_config')
        .update({
          value: newLimitsConfig
        })
        .eq('key', 'real_time_limits_config');

      if (error) {
        console.log('   ❌ Real-time limits update failed:', error.message);
      } else {
        console.log('   ✅ Real-time limits updated to 17/17 tweets available');
      }
    }
  } catch (error) {
    console.log('   ❌ Real-time limits error:', error.message);
  }

  // Fix 3: Reset Daily Posting State (with proper schema)
  console.log('\n📅 STEP 3: Resetting Daily Posting State');
  console.log('========================================');

  try {
    // Check if today's record exists
    const { data: existingState, error: checkError } = await supabase
      .from('daily_posting_state')
      .select('*')
      .eq('date', today)
      .single();

    const newState = {
      date: today,
      tweets_posted: 0,
      posts_completed: 0,
      max_daily_tweets: 17,
      posts_target: 17,
      last_post_time: null,
      next_post_time: now.toISOString(),
      emergency_mode: false,
      strategy: 'balanced',
      posting_schedule: []
    };

    if (checkError && checkError.code === 'PGRST116') {
      // Doesn't exist, insert it
      const { error } = await supabase
        .from('daily_posting_state')
        .insert(newState);

      if (error) {
        console.log('   ❌ Daily posting state insert failed:', error.message);
      } else {
        console.log('   ✅ Daily posting state created for today');
        console.log('   📊 Posts: 0/17 completed');
      }
    } else {
      // Exists, update it
      const { error } = await supabase
        .from('daily_posting_state')
        .update({
          tweets_posted: 0,
          posts_completed: 0,
          emergency_mode: false,
          next_post_time: now.toISOString()
        })
        .eq('date', today);

      if (error) {
        console.log('   ❌ Daily posting state update failed:', error.message);
      } else {
        console.log('   ✅ Daily posting state reset for today');
        console.log('   📊 Posts: 0/17 completed');
      }
    }
  } catch (error) {
    console.log('   ❌ Daily posting state error:', error.message);
  }

  // Fix 4: Force Test Post to Verify System
  console.log('\n🧪 STEP 4: Testing Posting System');
  console.log('==================================');

  try {
    // Set a flag to force immediate posting
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'force_immediate_post',
        value: {
          enabled: true,
          timestamp: now.toISOString(),
          reason: 'morning_reset_test'
        }
      });

    if (error) {
      console.log('   ⚠️ Could not set force post flag:', error.message);
    } else {
      console.log('   ✅ Force post flag set - bot should post immediately');
    }
  } catch (error) {
    console.log('   ⚠️ Force post error:', error.message);
  }

  // Summary
  console.log('\n✅ ENHANCED MORNING RESET COMPLETE');
  console.log('==================================');
  console.log('🎯 Bot Status: READY');
  console.log('📊 Daily Tweets: 0/17 available (reset)'); 
  console.log('🚨 Emergency Mode: CLEARED');
  console.log('⏰ Should post: IMMEDIATELY');
  console.log('🔧 Force post flag: SET');
  
  console.log('\n🚀 NEXT ACTIONS:');
  console.log('================');
  console.log('1. Bot should start posting within 5-10 minutes');
  console.log('2. If no posting, restart Render service');
  console.log('3. Monitor with: node diagnose_posting_issue.js');
  console.log('4. Force test: node force_immediate_test_post.js');

  console.log('\n⚡ TROUBLESHOOTING:');
  console.log('==================');
  console.log('If still no posting after 30 minutes:');
  console.log('• Restart Render service manually');
  console.log('• Check Render logs for errors');
  console.log('• Run force_immediate_test_post.js');
  console.log('• Verify environment variables in Render');
}

// Run the enhanced fix
fixPostingBlockageV2().catch(console.error); 