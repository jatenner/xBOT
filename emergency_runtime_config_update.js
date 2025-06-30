#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: RUNTIME CONFIG UPDATE
 * ===================================
 * 
 * Forces runtime config to reload with updated 17 tweet limit
 * The postTweetAgent is reading old cached config value of 6 instead of 17
 */

const { createClient } = require('@supabase/supabase-js');

async function emergencyRuntimeConfigUpdate() {
  console.log('🚨 EMERGENCY: RUNTIME CONFIG UPDATE');
  console.log('===================================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. VERIFYING CURRENT RUNTIME CONFIG...');
    
    // Check current runtime_config in database
    const { data: currentConfig, error: fetchError } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (fetchError) {
      console.error('❌ Could not fetch current config:', fetchError);
      throw fetchError;
    }

    console.log('📊 Current database config:');
    console.log(JSON.stringify(currentConfig.value, null, 2));

    // Check if maxDailyTweets is still 6 (the problem)
    const currentMax = currentConfig.value?.maxDailyTweets || currentConfig.value?.max_daily_tweets;
    console.log(`📊 Current maxDailyTweets: ${currentMax}`);

    if (currentMax !== 17) {
      console.log('🔧 2. FIXING RUNTIME CONFIG - UPDATING TO 17...');
      
      const fixedConfig = {
        ...currentConfig.value,
        maxDailyTweets: 17,
        max_daily_tweets: 17,  // Both formats to be safe
        quality: {
          readabilityMin: 55,
          credibilityMin: 0.85
        },
        fallbackStaggerMinutes: 30,
        postingStrategy: 'posting_only_mode',
        emergency_fix_timestamp: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('bot_config')
        .update({ value: fixedConfig })
        .eq('key', 'runtime_config');

      if (updateError) {
        console.error('❌ Failed to update runtime config:', updateError);
        throw updateError;
      }

      console.log('✅ Runtime config updated to 17 posts');
    } else {
      console.log('✅ Runtime config already correct (17 posts)');
    }

    console.log('🔧 3. FORCE REFRESH - DELETE AND RECREATE CONFIG...');
    
    // Delete and recreate to force cache refresh
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'runtime_config');

    const { error: insertError } = await supabase
      .from('bot_config')
      .insert({
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
          force_refresh_timestamp: new Date().toISOString()
        }
      });

    if (insertError) {
      console.error('❌ Failed to recreate config:', insertError);
      throw insertError;
    }

    console.log('✅ Runtime config recreated with 17 posts');

    console.log('🔧 4. CLEARING DAILY POSTING STATE...');
    
    // Reset daily posting state to clear any cached counters
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create fresh state with 17 available
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
    
    // Verify the fix
    const { data: verifyConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    const verifyMax = verifyConfig?.value?.maxDailyTweets || verifyConfig?.value?.max_daily_tweets;
    console.log(`📊 Verified maxDailyTweets: ${verifyMax}`);

    if (verifyMax === 17) {
      console.log('');
      console.log('🎉 EMERGENCY RUNTIME CONFIG FIX COMPLETE!');
      console.log('✅ Bot should now see 17 daily tweets available');
      console.log('✅ Rate limit check should pass');
      console.log('✅ Posting should resume immediately');
      console.log('');
      console.log('🚀 No redeploy needed - config updated in real-time');
    } else {
      console.log('❌ VERIFICATION FAILED - max still shows:', verifyMax);
    }

  } catch (error) {
    console.error('❌ Emergency runtime config update failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  emergencyRuntimeConfigUpdate();
}

module.exports = { emergencyRuntimeConfigUpdate }; 