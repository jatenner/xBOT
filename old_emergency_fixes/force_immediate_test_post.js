#!/usr/bin/env node
/**
 * 🚀 FORCE IMMEDIATE TEST POST
 * Clear all blocks and force a test post to verify the system works
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceTestPost() {
  console.log('🚀 === FORCING IMMEDIATE TEST POST ===');
  console.log('🧹 Clearing all blocking configurations...');
  
  try {
    // 1. Clear emergency timing blocks
    console.log('⏰ Clearing emergency timing blocks...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_timing',
        value: {
          emergency_mode: false,
          emergency_mode_until: null,
          minimum_post_interval_minutes: 5, // Reduced to 5 minutes
          max_daily_tweets: 300,
          enabled: false
        },
        updated_at: new Date().toISOString()
      });

    // 2. Disable emergency search block
    console.log('🔍 Disabling emergency search blocks...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_search_block',
        value: {
          enable_posting_only_mode: false,
          block_all_searches: false,
          emergency_mode: false,
          emergency_mode_until: null
        },
        updated_at: new Date().toISOString()
      });

    // 3. Disable emergency rate limits
    console.log('📊 Disabling emergency rate limits...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limits',
        value: {
          emergency_mode: false,
          max_calls_per_15_min: 50,
          enabled: false
        },
        updated_at: new Date().toISOString()
      });

    // 4. Enable startup posting override
    console.log('🚀 Enabling startup posting override...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'startup_posting_override',
        value: {
          enabled: true,
          force_immediate_post: true,
          bypass_all_timing: true,
          reason: 'Manual test post to verify system',
          created_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });

    // 5. Enable emergency posting bypass
    console.log('⚡ Enabling emergency posting bypass...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_posting_bypass',
        value: {
          daily_limit_bypass: true,
          timing_bypass: true,
          force_post_now: true,
          reason: 'Manual verification post',
          enabled_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });

    // 6. Reset daily posting state for today
    console.log('🔄 Resetting daily posting state...');
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('daily_posting_state')
      .upsert({
        date: today,
        posts_completed: 0,
        posts_target: 17,
        last_post_time: null,
        emergency_mode: false,
        next_post_time: new Date().toISOString()
      });

    // 7. Ensure bot is enabled
    console.log('✅ Ensuring bot is enabled...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'DISABLE_BOT',
        value: 'false',
        updated_at: new Date().toISOString()
      });

    // 8. Check and display current environment variable
    console.log('\n📋 === ENVIRONMENT CHECK ===');
    console.log(`🔧 LIVE_POSTING_ENABLED: ${process.env.LIVE_POSTING_ENABLED || 'NOT SET'}`);
    
    if (!process.env.LIVE_POSTING_ENABLED || process.env.LIVE_POSTING_ENABLED === 'false') {
      console.log('🚨 WARNING: LIVE_POSTING_ENABLED is not set to true!');
      console.log('💡 Set LIVE_POSTING_ENABLED=true in your environment or .env file');
      console.log('💡 In Render, go to Environment > LIVE_POSTING_ENABLED > true');
    } else {
      console.log('✅ LIVE_POSTING_ENABLED is configured correctly');
    }

    console.log('\n✅ === ALL BLOCKS CLEARED ===');
    console.log('🎯 The bot should now be able to post immediately');
    console.log('📊 Emergency configurations have been disabled');
    console.log('⚡ Startup override is active for immediate posting');
    console.log('⏰ All timing restrictions have been relaxed');
    
    console.log('\n🚀 === NEXT STEPS ===');
    console.log('1. ✅ Blocks cleared (this script)');
    console.log('2. 🔧 Ensure LIVE_POSTING_ENABLED=true in Render environment');
    console.log('3. 🔄 Restart the bot service in Render');
    console.log('4. 📊 Monitor logs for immediate posting attempt');
    console.log('5. 🎉 First post should appear within 5 minutes of restart');

    return true;

  } catch (error) {
    console.error('❌ Failed to clear blocks:', error);
    return false;
  }
}

// Run the script
forceTestPost()
  .then(success => {
    if (success) {
      console.log('\n🎉 SCRIPT COMPLETED SUCCESSFULLY');
      console.log('💡 Now set LIVE_POSTING_ENABLED=true in Render and restart the bot');
    } else {
      console.log('\n❌ SCRIPT FAILED');
      console.log('💡 Check the error messages above and try again');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 SCRIPT CRASHED:', error);
    process.exit(1);
  }); 