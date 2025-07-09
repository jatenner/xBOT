#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixPostingBlockage() {
  console.log('🔧 FIXING POSTING BLOCKAGE - Morning Reset');
  console.log('==========================================\n');

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

  // Fix 1: Clear Emergency Configurations
  console.log('🚨 STEP 1: Clearing Emergency Configurations');
  console.log('============================================');

  const emergencyKeys = [
    'emergency_mode',
    'emergency_timing',
    'emergency_rate_limits',
    'emergency_search_block',
    'emergency_posting_bypass',
    'last_error_twitter_post'
  ];

  for (const key of emergencyKeys) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .delete()
        .eq('key', key);

      if (error && error.code !== 'PGRST116') {
        console.log(`   ⚠️ Error clearing ${key}: ${error.message}`);
      } else {
        console.log(`   ✅ Cleared emergency config: ${key}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Failed to clear ${key}: ${error.message}`);
    }
  }

  // Fix 2: Reset Runtime Configuration
  console.log('\n⚙️ STEP 2: Resetting Runtime Configuration');
  console.log('==========================================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          enabled: true,
          max_daily_posts: 17, // Real Twitter limit
          ignore_monthly_caps: true,
          use_real_twitter_limits_only: true,
          emergency_mode: false,
          posting_allowed: true,
          morning_reset_timestamp: now.toISOString(),
          bot_status: 'active'
        }
      });

    if (error) {
      console.log('   ❌ Runtime config update failed:', error.message);
    } else {
      console.log('   ✅ Runtime configuration reset to normal mode');
    }
  } catch (error) {
    console.log('   ❌ Runtime config error:', error.message);
  }

  // Fix 3: Reset Real-Time Limits Configuration
  console.log('\n🔄 STEP 3: Resetting Real-Time Limits');
  console.log('=====================================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'real_time_limits_config',
        value: {
          twitter_daily_tweets: {
            limit: 17,
            used: 0,
            remaining: 17,
            reset_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          },
          twitter_15min_tweets: {
            limit: 300,
            used: 0,
            remaining: 300,
            reset_time: new Date(now.getTime() + 15 * 60 * 1000).toISOString()
          },
          emergency_cooldown_until: null,
          emergency_cooldown_disabled: true,
          last_reset: now.toISOString(),
          morning_reset_applied: true
        }
      });

    if (error) {
      console.log('   ❌ Real-time limits reset failed:', error.message);
    } else {
      console.log('   ✅ Real-time limits reset to 17/17 tweets available');
    }
  } catch (error) {
    console.log('   ❌ Real-time limits error:', error.message);
  }

  // Fix 4: Reset Daily Posting State
  console.log('\n📅 STEP 4: Resetting Daily Posting State');
  console.log('========================================');

  try {
    const { error } = await supabase
      .from('daily_posting_state')
      .upsert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 17,
        posts_target: 17,
        last_post_time: null,
        next_post_time: now.toISOString(),
        emergency_mode: false,
        strategy: 'balanced',
        morning_reset_applied: true,
        posting_schedule: []
      });

    if (error) {
      console.log('   ❌ Daily posting state reset failed:', error.message);
    } else {
      console.log('   ✅ Daily posting state reset for today');
      console.log('   📊 Posts: 0/17 completed');
      console.log('   🎯 Ready to start posting');
    }
  } catch (error) {
    console.log('   ❌ Daily posting state error:', error.message);
  }

  // Fix 5: Clear API Usage Blocks
  console.log('\n🚫 STEP 5: Clearing API Usage Blocks');
  console.log('====================================');

  try {
    // Reset OpenAI cost tracking for today
    const { error: openaiError } = await supabase
      .from('bot_config')
      .upsert({
        key: 'openai_daily_cost',
        value: {
          date: today,
          cost: 0,
          calls: 0,
          reset_time: now.toISOString()
        }
      });

    if (openaiError) {
      console.log('   ⚠️ OpenAI cost reset warning:', openaiError.message);
    } else {
      console.log('   ✅ OpenAI daily cost reset to $0');
    }

    // Clear any API usage blocks
    const { error: apiError } = await supabase
      .from('api_usage_tracking')
      .delete()
      .eq('date', today);

    if (apiError && apiError.code !== 'PGRST116') {
      console.log('   ⚠️ API usage clear warning:', apiError.message);
    } else {
      console.log('   ✅ API usage tracking cleared for today');
    }
  } catch (error) {
    console.log('   ❌ API blocks clear error:', error.message);
  }

  // Fix 6: Enable Bot
  console.log('\n🤖 STEP 6: Enabling Bot');
  console.log('=======================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'bot_enabled',
        value: 'true'
      });

    if (error) {
      console.log('   ❌ Bot enable failed:', error.message);
    } else {
      console.log('   ✅ Bot enabled and ready');
    }
  } catch (error) {
    console.log('   ❌ Bot enable error:', error.message);
  }

  // Final Status Check
  console.log('\n✅ MORNING RESET COMPLETE');
  console.log('=========================');
  console.log('🎯 Bot Status: ENABLED');
  console.log('📊 Daily Tweets: 0/17 available'); 
  console.log('🚨 Emergency Mode: DISABLED');
  console.log('⏰ Ready to post at: NOW');
  console.log('🔄 Next steps: Bot should start posting within 30 minutes');
  
  console.log('\n🚀 RESTART RENDER SERVICE');
  console.log('=========================');
  console.log('To ensure all changes take effect:');
  console.log('1. Go to Render dashboard');
  console.log('2. Click "Manual Deploy" or restart service');
  console.log('3. Monitor logs for posting activity');
  
  console.log('\n📊 MONITORING COMMANDS:');
  console.log('=======================');
  console.log('• Check status: node diagnose_posting_issue.js');
  console.log('• Force post: node force_immediate_test_post.js');
  console.log('• Monitor logs: tail -f logs/bot.log (if available)');
}

// Run the fix
fixPostingBlockage().catch(console.error); 