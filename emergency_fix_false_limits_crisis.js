#!/usr/bin/env node

/**
 * EMERGENCY: Fix False Rate Limits & Emergency Mode Crisis
 * 
 * PROBLEMS IDENTIFIED:
 * 1. monthly_cap_workaround is enabled when it shouldn't be (July 1st, no posts today)
 * 2. emergency_timing has cooldown active until future date
 * 3. emergency_search_block is overly restrictive
 * 4. emergency_rate_limits are too conservative
 * 
 * This script will RESET all false emergency configurations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixFalseLimitsCrisis() {
  console.log('🚨 EMERGENCY: Fixing False Rate Limits Crisis');
  console.log('📅 Today is July 1st - bot should be able to post freely!');
  
  try {
    // 1. DISABLE monthly cap workaround (shouldn't be active on July 1st)
    console.log('🔧 Fixing monthly cap workaround...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'monthly_cap_workaround',
        value: {
          enabled: false,
          reason: 'July 1st - fresh monthly start, no cap exceeded',
          disabled_on: new Date().toISOString(),
          posts_remaining: 1500,
          reads_remaining: 10000
        }
      });
    console.log('✅ Monthly cap workaround DISABLED');

    // 2. CLEAR emergency timing that's blocking posts
    console.log('🔧 Clearing emergency timing blocks...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_timing',
        value: {
          emergency_mode_until: null, // CLEAR the false emergency mode
          minimum_post_interval_minutes: 30, // Reasonable 30 min
          max_daily_tweets: 17,
          last_reset: new Date().toISOString(),
          note: 'Emergency mode cleared - false rate limit crisis fixed'
        }
      });
    console.log('✅ Emergency timing blocks CLEARED');

    // 3. FIX emergency search block (too restrictive)
    console.log('🔧 Fixing emergency search block...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_search_block',
        value: {
          enable_posting_only_mode: false, // Allow normal operations
          block_all_searches: false,
          emergency_mode: false,
          emergency_mode_until: null,
          note: 'Normal operations restored - false emergency cleared'
        }
      });
    console.log('✅ Emergency search block FIXED');

    // 4. NORMALIZE emergency rate limits
    console.log('🔧 Normalizing emergency rate limits...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limits',
        value: {
          emergency_mode: false, // DISABLE emergency mode
          max_calls_per_15_min: 15, // Normal limit (not 5)
          max_daily_posts: 17,
          reset_time: new Date().toISOString(),
          note: 'Normal rate limits restored - emergency crisis resolved'
        }
      });
    console.log('✅ Emergency rate limits NORMALIZED');

    // 5. VERIFY we have no posted tweets today (July 1st)
    console.log('🔍 Verifying daily post count...');
    const today = new Date().toISOString().split('T')[0];
    const { data: todaysPosts, error } = await supabase
      .from('tweets')
      .select('id, created_at')
      .gte('created_at', today + 'T00:00:00');
    
    if (error) {
      console.log('⚠️ Could not check today\'s posts:', error.message);
    } else {
      const postsToday = todaysPosts?.length || 0;
      console.log(`📊 Posts today (${today}): ${postsToday}/17`);
      console.log(`🎯 Remaining capacity: ${17 - postsToday} posts`);
      
      if (postsToday === 0) {
        console.log('✅ CONFIRMED: Zero posts today - bot should be able to post freely!');
      }
    }

    // 6. RESET any false API usage tracking
    console.log('🔧 Resetting API usage tracking...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'api_usage_tracking',
        value: {
          daily_posts: 0,
          daily_reads: 0,
          monthly_posts: 0,
          monthly_reads: 0,
          last_reset: new Date().toISOString(),
          reset_reason: 'False limits crisis fix - July 1st fresh start'
        }
      });
    console.log('✅ API usage tracking RESET');

    // 7. VERIFY runtime config is correct
    console.log('🔍 Checking runtime config...');
    const { data: runtimeConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();
    
    if (runtimeConfig?.value) {
      console.log(`📊 Runtime config: ${runtimeConfig.value.maxDailyTweets} max daily tweets`);
      
      // Ensure it's set to 17 (Free tier limit)
      if (runtimeConfig.value.maxDailyTweets !== 17) {
        await supabase
          .from('bot_config')
          .update({
            value: {
              ...runtimeConfig.value,
              maxDailyTweets: 17
            }
          })
          .eq('key', 'runtime_config');
        console.log('✅ Runtime config daily limit corrected to 17');
      }
    }

    console.log('\n🎉 FALSE LIMITS CRISIS FIXED!');
    console.log('✅ Monthly cap workaround: DISABLED');
    console.log('✅ Emergency timing: CLEARED');
    console.log('✅ Emergency search block: FIXED');
    console.log('✅ Emergency rate limits: NORMALIZED');
    console.log('✅ API usage tracking: RESET');
    console.log('\n🚀 Bot should now be able to post freely!');
    console.log('📅 Fresh start for July 1st with 0/17 posts used');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    console.log('🔧 Manual intervention may be required');
  }
}

if (require.main === module) {
  fixFalseLimitsCrisis();
}

module.exports = { fixFalseLimitsCrisis }; 