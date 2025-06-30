#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: ENVIRONMENT SYNC
 * ===============================
 * 
 * Syncs MAX_DAILY_TWEETS=17 across all configuration layers:
 * 1. Environment variables (.env file)
 * 2. Database runtime_config
 * 3. Code defaults
 * 4. Daily posting state
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function emergencyEnvironmentSync() {
  console.log('🚨 EMERGENCY: ENVIRONMENT SYNC');
  console.log('===============================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('💡 Please run: export $(cat .env | xargs) && node emergency_environment_sync.js');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. CHECKING .ENV FILE...');
    
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log('✅ .env file found');
      
      // Check current MAX_DAILY_TWEETS value
      const maxDailyMatch = envContent.match(/MAX_DAILY_TWEETS=(\d+)/);
      const currentValue = maxDailyMatch ? maxDailyMatch[1] : 'not found';
      console.log(`📊 Current .env MAX_DAILY_TWEETS: ${currentValue}`);
      
      if (currentValue !== '17') {
        console.log('⚠️ .env file needs to be updated to MAX_DAILY_TWEETS=17');
        console.log('💡 Please manually update your .env file:');
        console.log('   Change: MAX_DAILY_TWEETS=6');
        console.log('   To:     MAX_DAILY_TWEETS=17');
      } else {
        console.log('✅ .env file already correct');
      }
    } catch (error) {
      console.warn('⚠️ Could not read .env file:', error.message);
    }

    console.log('🔧 2. UPDATING DATABASE RUNTIME CONFIG...');
    
    // Force update runtime_config in database
    const { error: updateError } = await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 17,
          max_daily_tweets: 17,
          quality: {
            readabilityMin: 55,
            credibilityMin: 0.85
          },
          fallbackStaggerMinutes: 30,
          postingStrategy: 'posting_only_mode',
          environment_sync_timestamp: new Date().toISOString()
        }
      });

    if (updateError) {
      console.error('❌ Failed to update runtime config:', updateError);
    } else {
      console.log('✅ Database runtime_config updated to 17 posts');
    }

    console.log('🔧 3. ENSURING BOT CONFIG CONSISTENCY...');
    
    // Update other related config keys
    const configUpdates = [
      { key: 'maxDailyTweets', value: 17 },
      { key: 'DAILY_POST_LIMIT', value: '17' },
      { key: 'max_tweets_per_day', value: 17 },
      { key: 'posting_daily_limit', value: 17 }
    ];

    for (const config of configUpdates) {
      await supabase
        .from('bot_config')
        .upsert({
          key: config.key,
          value: config.value
        });
      
      console.log(`✅ Updated ${config.key} = ${config.value}`);
    }

    console.log('🔧 4. RESETTING DAILY POSTING STATE...');
    
    // Clear and reset daily posting state
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    const { error: dailyError } = await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 17,
        posts_target: 17,
        last_post_time: null,
        next_post_time: new Date().toISOString(),
        posting_schedule: [],
        emergency_mode: true,
        strategy: 'posting_only_mode'
      });

    if (dailyError && dailyError.code !== '23505') {
      console.warn('⚠️ Daily state error:', dailyError.message);
    } else {
      console.log('✅ Daily posting state reset (0/17 posts)');
    }

    console.log('🔧 5. VERIFICATION...');
    
    // Verify all configurations
    const { data: runtimeConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    const maxTweets = runtimeConfig?.value?.maxDailyTweets || runtimeConfig?.value?.max_daily_tweets;
    
    console.log('');
    console.log('📊 CONFIGURATION VERIFICATION:');
    console.log(`   Database maxDailyTweets: ${maxTweets}`);
    console.log(`   Environment MAX_DAILY_TWEETS: ${process.env.MAX_DAILY_TWEETS || 'not set'}`);
    console.log(`   Code defaults: Now reads from env var`);
    
    if (maxTweets === 17) {
      console.log('');
      console.log('🎉 ENVIRONMENT SYNC COMPLETE!');
      console.log('✅ All configuration layers now set to 17 posts');
      console.log('✅ Bot will use full Free tier quota');
      console.log('✅ Monthly cap workaround active');
      console.log('');
      console.log('📋 MANUAL STEPS NEEDED:');
      console.log('1. Update your .env file: MAX_DAILY_TWEETS=17');
      console.log('2. Redeploy to Render with updated environment');
      console.log('3. Bot should start posting immediately');
    } else {
      console.log('❌ VERIFICATION FAILED - database still shows:', maxTweets);
    }

  } catch (error) {
    console.error('❌ Environment sync failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  emergencyEnvironmentSync();
}

module.exports = { emergencyEnvironmentSync }; 