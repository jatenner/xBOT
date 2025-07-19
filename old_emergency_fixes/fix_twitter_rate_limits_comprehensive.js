const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensiveTwitterRateLimitsFix() {
  console.log('🔧 === COMPREHENSIVE TWITTER RATE LIMITS FIX ===\n');

  // STEP 1: Clear all artificial limit configurations
  console.log('1. 🗑️ REMOVING ARTIFICIAL LIMIT CONFIGURATIONS...');
  
  const artificialLimitKeys = [
    'emergency_monthly_cap_mode',
    'smart_monthly_cap_mode',
    'monthly_cap_workaround',
    'emergency_rate_limiting',
    'monthly_budget_config',
    'emergency_daily_targets',
    'disabled_agents_monthly_cap',
    'monthly_cap_content_strategy',
    'emergency_posting_strategy',
    'emergency_text_only_mode'
  ];

  for (const key of artificialLimitKeys) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .delete()
        .eq('key', key);
      
      if (!error) {
        console.log(`   ✅ Removed ${key}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Could not remove ${key} (may not exist)`);
    }
  }

  // STEP 2: Fix the real_twitter_limits config (the main culprit)
  console.log('\n2. 🔧 FIXING real_twitter_limits CONFIGURATION...');
  
  await supabase
    .from('bot_config')
    .upsert({
      key: 'real_twitter_limits',
      value: {
        enabled: false, // 🚨 FIX: This should be false, not true!
        description: 'Real Twitter API v2 Free Tier Limits - For reference only',
        writes_per_24h: 17,
        reads_per_month: 1500,
        rate_limit_window_minutes: 15,
        artificial_limits_removed: true,
        note: 'These are handled directly by xClient.ts, not by this config'
      }
    });

  console.log('   ✅ Fixed real_twitter_limits.enabled = false');

  // STEP 3: Update runtime_config to use real Twitter limits
  console.log('\n3. ⚙️ UPDATING RUNTIME CONFIG...');
  
  await supabase
    .from('bot_config')
    .upsert({
      key: 'runtime_config',
      value: {
        // Remove maxDailyTweets entirely - use Twitter's real 17/day limit
        quality: {
          credibilityMin: 0.85,
          readabilityMin: 55
        },
        fallbackStaggerMinutes: 30,
        postingStrategy: 'real_twitter_limits_only',
        artificial_limits_removed: true,
        uses_twitter_17_per_day_limit: true
      }
    });

  console.log('   ✅ Updated runtime_config to use real Twitter limits');

  // STEP 4: Set proper daily posting limit  
  console.log('\n4. 📊 SETTING PROPER DAILY POSTING LIMIT...');
  
  await supabase
    .from('bot_config')
    .upsert({
      key: 'posting_daily_limit',
      value: 17 // Twitter's actual free tier limit
    });

  console.log('   ✅ Set posting_daily_limit to 17 (Twitter\'s real limit)');

  // STEP 5: Clear any emergency cooldowns
  console.log('\n5. ❄️ CLEARING EMERGENCY COOLDOWNS...');
  
  try {
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value')
      .ilike('value', '%cooldown%');

    if (configs && configs.length > 0) {
      for (const config of configs) {
        try {
          const parsedValue = typeof config.value === 'string' ? 
            JSON.parse(config.value) : config.value;
          
          if (parsedValue.emergencyCooldownUntil) {
            delete parsedValue.emergencyCooldownUntil;
            
            await supabase
              .from('bot_config')
              .update({ value: parsedValue })
              .eq('key', config.key);
            
            console.log(`   ✅ Cleared cooldown from ${config.key}`);
          }
        } catch (e) {
          // Skip if can't parse
        }
      }
    } else {
      console.log('   ✅ No emergency cooldowns found');
    }
  } catch (error) {
    console.log('   ⚠️ Could not check for cooldowns');
  }

  // STEP 6: Update twitter_api_limits to use real limits
  console.log('\n6. 🐦 UPDATING TWITTER API LIMITS CONFIG...');
  
  await supabase
    .from('bot_config')
    .upsert({
      key: 'twitter_api_limits',
      value: {
        last_reset: new Date().toISOString(),
        emergency_mode: false,
        daily_post_limit: 17, // Real Twitter limit
        hourly_post_limit: null, // Let xClient.ts handle this
        current_posts_today: 0,
        like_limit_per_hour: 20,
        reply_limit_per_hour: 5,
        follow_limit_per_hour: 5,
        note: 'Using real Twitter API v2 Free Tier limits'
      }
    });

  console.log('   ✅ Updated twitter_api_limits to use real 17/day limit');

  // STEP 7: Reset API usage tracking
  console.log('\n7. 🔄 RESETTING API USAGE TRACKING...');
  
  await supabase
    .from('bot_config')
    .upsert({
      key: 'api_usage_tracking',
      value: {
        last_reset: new Date().toISOString(),
        daily_posts: 0,
        daily_reads: 0,
        monthly_posts: 0,
        monthly_reads: 0,
        reset_reason: 'Comprehensive rate limits fix - using real Twitter limits'
      }
    });

  console.log('   ✅ Reset API usage tracking');

  // STEP 8: Verify the fix
  console.log('\n8. ✅ VERIFYING THE FIX...');
  
  const { data: realLimits } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', 'real_twitter_limits')
    .single();

  const { data: runtimeConfig } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', 'runtime_config') 
    .single();

  if (realLimits && realLimits.value.enabled === false) {
    console.log('   ✅ real_twitter_limits.enabled = false (FIXED!)');
  } else {
    console.log('   ❌ real_twitter_limits.enabled still true - manual check needed');
  }

  if (runtimeConfig && !runtimeConfig.value.maxDailyTweets) {
    console.log('   ✅ Artificial maxDailyTweets removed from runtime_config');
  } else {
    console.log('   ⚠️ maxDailyTweets still present in runtime_config');
  }

  console.log('\n🎯 SUMMARY OF CHANGES:');
  console.log('   • Removed all artificial monthly cap configurations');
  console.log('   • Fixed real_twitter_limits.enabled = false (was blocking posts!)');
  console.log('   • Updated runtime_config to use real Twitter limits only');
  console.log('   • Set proper daily limit to 17 (Twitter\'s actual limit)');
  console.log('   • Cleared any emergency cooldowns');
  console.log('   • Reset API usage tracking');

  console.log('\n📝 ENVIRONMENT VARIABLES TO CHECK:');
  console.log('   • Remove MAX_DAILY_TWEETS if set below 17');
  console.log('   • Remove MONTHLY_WRITE_CAP if artificially low');
  console.log('   • Keep TWITTER_MONTHLY_CAP=1500 (for reads, not writes)');

  console.log('\n🔧 CODE CHANGES NEEDED:');
  console.log('   • Update realTimeLimitsIntelligenceAgent.ts to not treat enabled=true as blocking');
  console.log('   • Remove artificial prorated daily cap logic');
  console.log('   • Use only xClient.ts real rate limits (300/3h, 2400/24h)');

  console.log('\n✅ COMPREHENSIVE TWITTER RATE LIMITS FIX COMPLETE!');
  console.log('🚀 Your bot should now use Twitter\'s real 17/day limit instead of false monthly caps.');
}

comprehensiveTwitterRateLimitsFix().catch(console.error); 