#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: Monthly Cap Fix for Render Deployment
 * =====================================================
 * 
 * CRITICAL ISSUE: Bot has hit Twitter API monthly cap and is spamming 429 errors
 * 
 * SOLUTION: Immediately activate monthly cap mode that:
 * 1. Stops ALL search operations (causing 429 errors)
 * 2. Keeps posting active (still works with monthly cap)
 * 3. Reduces logging spam
 * 4. Activates posting-only mode
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencyMonthlyCapFix() {
  console.log('🚨 EMERGENCY: Monthly Cap Fix for Render Deployment');
  console.log('==================================================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. ACTIVATING EMERGENCY MONTHLY CAP MODE...');
    
    // Activate monthly cap mode - stops all search operations
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_monthly_cap_mode',
        value: {
          enabled: true,
          mode: 'posting_only',
          disable_all_search_operations: true,
          disable_tweet_search: true,
          disable_user_search: true,
          disable_timeline_reading: true,
          disable_engagement_discovery: true,
          allow_posting: true,
          allow_content_creation: true,
          force_original_content: true,
          deployment_timestamp: new Date().toISOString(),
          reason: 'Monthly Twitter API cap exceeded - 429 errors'
        }
      });

    console.log('✅ Emergency monthly cap mode: ACTIVATED');

    console.log('🔧 2. CONFIGURING POSTING-ONLY STRATEGY...');
    
    // Force strategist to posting-only mode
    await supabase
      .from('bot_config')
      .upsert({
        key: 'strategist_override',
        value: {
          force_posting_only: true,
          posting_weight: 100,
          engagement_weight: 0,
          research_weight: 0,
          disable_reply_search: true,
          disable_trend_research: true,
          focus_on_original_content: true,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Posting-only strategy: CONFIGURED');

    console.log('🔧 3. REDUCING RATE LIMIT SPAM...');
    
    // Configure conservative rate limiting to reduce API calls
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limiting',
        value: {
          enabled: true,
          min_post_interval_minutes: 90, // 1.5 hours between posts
          max_posts_per_hour: 1,
          max_posts_per_day: 8, // Conservative daily limit
          disable_startup_throttling: false,
          reduce_api_calls: true,
          skip_rate_limit_checks: false,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Conservative rate limiting: ACTIVE');

    console.log('🔧 4. UPDATING RUNTIME CONFIG...');
    
    // Update runtime config for monthly cap mode
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 8, // Conservative limit during monthly cap
          quality: {
            readabilityMin: 55,
            credibilityMin: 0.85
          },
          fallbackStaggerMinutes: 90, // Slower posting
          postingStrategy: 'monthly_cap_mode',
          mode: 'monthly_cap_emergency'
        }
      });

    console.log('✅ Runtime config: UPDATED for monthly cap');

    console.log('🔧 5. DISABLING PROBLEMATIC AGENTS...');
    
    // Disable agents that cause excessive API calls
    await supabase
      .from('bot_config')
      .upsert({
        key: 'disabled_agents',
        value: {
          disable_reply_agent: true,
          disable_trend_research: true,
          disable_competitive_intelligence: true,
          disable_real_time_engagement: true,
          disable_search_operations: true,
          keep_posting_agent: true,
          keep_content_creation: true,
          deployment_timestamp: new Date().toISOString(),
          reason: 'Monthly cap exceeded - reduce API calls'
        }
      });

    console.log('✅ High-API-usage agents: DISABLED');

    console.log('🔧 6. FORCING TEXT-ONLY MODE...');
    
    // Force text-only mode to avoid image API calls
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_text_only_mode',
        value: {
          enabled: true,
          force_text_only: true,
          disable_image_generation: true,
          disable_pexels_api: true,
          text_only_percentage: 100,
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Text-only mode: ENFORCED');

    console.log('🔧 7. CREATING POSTING SCHEDULE...');
    
    // Create conservative posting schedule
    const today = new Date().toISOString().split('T')[0];
    
    // Clear existing state
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create new conservative state
    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 8,
        posts_target: 8,
        last_post_time: null,
        next_post_time: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // Next post in 90 minutes
        posting_schedule: [],
        emergency_mode: true,
        strategy: 'monthly_cap_emergency'
      });

    console.log('✅ Conservative posting schedule: CREATED');

    console.log('🔧 8. VERIFICATION...');
    
    // Verify all configurations are in place
    const { data: monthlyCapConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'emergency_monthly_cap_mode')
      .single();

    const { data: strategistConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'strategist_override')
      .single();

    const { data: rateLimitConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'emergency_rate_limiting')
      .single();

    console.log('');
    console.log('✅ EMERGENCY MONTHLY CAP FIX DEPLOYED!');
    console.log('=====================================');
    console.log('');
    console.log('🎯 CONFIGURATION SUMMARY:');
    console.log(`   📝 Monthly Cap Mode: ${monthlyCapConfig?.value?.enabled ? '✅ ACTIVE' : '❌ FAILED'}`);
    console.log(`   🎯 Posting-Only Strategy: ${strategistConfig?.value?.force_posting_only ? '✅ ACTIVE' : '❌ FAILED'}`);
    console.log(`   ⏱️ Conservative Rate Limiting: ${rateLimitConfig?.value?.enabled ? '✅ ACTIVE' : '❌ FAILED'}`);
    console.log('');
    console.log('🚀 EXPECTED BEHAVIOR:');
    console.log('   ✅ Bot will stop all search operations (no more 429 errors)');
    console.log('   ✅ Bot will only post original content (every 90 minutes)');
    console.log('   ✅ Bot will use text-only mode (no image API calls)');
    console.log('   ✅ Bot will post 8 times per day maximum');
    console.log('   ✅ Bot will function normally until monthly reset');
    console.log('');
    console.log('⚠️ MANUAL ACTION REQUIRED:');
    console.log('   1. Monitor Render logs for reduced 429 error spam');
    console.log('   2. Bot should continue posting every 90 minutes');
    console.log('   3. All search operations should be disabled');
    console.log('   4. Monthly cap will reset on August 1st');
    console.log('');

  } catch (error) {
    console.error('❌ Emergency deployment failed:', error);
    console.error('');
    console.error('🚨 MANUAL FALLBACK REQUIRED:');
    console.error('   1. Restart the Render service to apply configs');
    console.error('   2. Check Supabase bot_config table manually');
    console.error('   3. Consider temporarily disabling the bot');
    process.exit(1);
  }
}

emergencyMonthlyCapFix(); 