const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearEmergencyBlocksAndRestoreNormalPosting() {
  console.log('🔧 === CLEARING EMERGENCY BLOCKS AND RESTORING NORMAL POSTING ===');
  console.log('');
  console.log('🎯 GOAL: Enable normal content generation instead of emergency content');
  console.log('');

  try {
    // 1. Clear emergency search blocks
    console.log('🔍 1. Clearing emergency search blocks...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_search_block',
        value: {
          block_all_searches: false,
          emergency_mode: false,
          enable_posting_only_mode: false,
          emergency_mode_until: null,
          reason: 'Normal posting restored - emergency blocks cleared'
        }
      });
    console.log('   ✅ Emergency search blocks cleared');

    // 2. Clear emergency timing restrictions
    console.log('⏰ 2. Clearing emergency timing restrictions...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_timing',
        value: {
          emergency_mode: false,
          emergency_mode_until: null,
          minimum_post_interval_minutes: 20, // Normal 20-minute interval
          max_daily_tweets: 17,
          reason: 'Normal posting restored - timing restrictions cleared'
        }
      });
    console.log('   ✅ Emergency timing restrictions cleared');

    // 3. Clear emergency rate limits
    console.log('📊 3. Clearing emergency rate limits...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limits',
        value: {
          emergency_mode: false,
          max_calls_per_15_min: 10, // Normal rate
          normal_operations: true,
          reason: 'Normal posting restored - rate limits normalized'
        }
      });
    console.log('   ✅ Emergency rate limits cleared');

    // 4. Clear startup posting override (so it doesn't force emergency content)
    console.log('🚀 4. Clearing startup posting override...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'startup_posting_override',
        value: {
          enabled: false,
          force_immediate_post: false,
          clear_phantom_times: false,
          reason: 'Normal posting restored - no override needed'
        }
      });
    console.log('   ✅ Startup posting override cleared');

    // 5. Restore normal engagement settings
    console.log('💬 5. Restoring normal engagement settings...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'engagement_settings',
        value: {
          emergency_posting_only: false,
          enable_parallel_operations: true,
          normal_operations: true,
          reason: 'Normal posting restored - engagement operations enabled'
        }
      });
    console.log('   ✅ Normal engagement settings restored');

    // 6. Clear monthly cap emergency modes
    console.log('📅 6. Clearing false monthly cap blocks...');
    
    const monthlyCapKeys = [
      'monthly_cap_emergency_mode',
      'emergency_monthly_cap_mode',
      'monthly_cap_workaround',
      'emergency_disable_all_reads',
      'force_posting_only_mode'
    ];

    for (const key of monthlyCapKeys) {
      await supabase
        .from('bot_config')
        .delete()
        .eq('key', key);
      console.log(`   ✅ Cleared ${key}`);
    }

    // 7. Restore normal runtime config
    console.log('⚙️ 7. Restoring normal runtime config...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 17,
          quality: {
            readabilityMin: 55,
            credibilityMin: 0.85
          },
          fallbackStaggerMinutes: 20,
          postingStrategy: 'balanced',
          emergency_mode: false,
          normal_operations: true,
          reason: 'Normal posting restored - balanced configuration'
        }
      });
    console.log('   ✅ Normal runtime config restored');

    // 8. Reset daily posting state to normal
    console.log('📊 8. Resetting daily posting state...');
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .upsert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 17,
        posts_target: 17,
        last_post_time: null,
        next_post_time: new Date().toISOString(),
        posting_schedule: [],
        emergency_mode: false,
        strategy: 'balanced'
      });
    console.log('   ✅ Daily posting state reset to normal');

    // 9. Verification
    console.log('🔍 9. Verifying configurations...');
    
    const verificationKeys = [
      'emergency_search_block',
      'emergency_timing',
      'emergency_rate_limits',
      'startup_posting_override',
      'engagement_settings',
      'runtime_config'
    ];

    for (const key of verificationKeys) {
      const { data } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();

      if (data) {
        const isEmergencyMode = data.value?.emergency_mode || data.value?.enabled || data.value?.emergency_posting_only;
        const status = isEmergencyMode ? '⚠️ STILL IN EMERGENCY MODE' : '✅ NORMAL';
        console.log(`   ${key}: ${status}`);
      }
    }

    console.log('');
    console.log('🎉 === EMERGENCY BLOCKS CLEARED SUCCESSFULLY ===');
    console.log('');
    console.log('✅ WHAT SHOULD HAPPEN NOW:');
    console.log('   1. Normal content generation via PostTweetAgent');
    console.log('   2. Human Expert, Viral, and Comprehensive content modes working');
    console.log('   3. Emergency content only as last resort');
    console.log('   4. Balanced 20-minute posting intervals');
    console.log('   5. Up to 17 posts per day (Twitter Free Tier limit)');
    console.log('');
    console.log('🔄 NEXT STEPS:');
    console.log('   1. Restart the bot to pick up new configurations');
    console.log('   2. Monitor logs to confirm normal content generation');
    console.log('   3. Verify posts are unique and high-quality');
    console.log('');
    console.log('📝 EXPECTED BEHAVIOR:');
    console.log('   - METHOD 1 (Normal posting) should succeed');
    console.log('   - Emergency content only if normal posting fails');
    console.log('   - Diverse content types (not just emergency library)');

  } catch (error) {
    console.error('❌ Failed to clear emergency blocks:', error);
    process.exit(1);
  }
}

clearEmergencyBlocksAndRestoreNormalPosting(); 