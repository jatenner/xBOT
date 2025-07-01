#!/usr/bin/env node

/**
 * 🎉 RESTORE FULL FUNCTIONALITY - AUGUST 1ST MONTHLY RESET
 * ========================================================
 * 
 * This script restores full bot functionality when Twitter API monthly cap resets.
 * Run this on or after August 1st, 2025 to re-enable all features.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function restoreFullFunctionality() {
  console.log('🎉 RESTORING FULL BOT FUNCTIONALITY');
  console.log('=====================================');
  console.log('📅 Twitter API Monthly Cap Reset - August 1st, 2025');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. DISABLING MONTHLY CAP MODE...');
    
    // Disable monthly cap mode
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_monthly_cap_mode',
        value: {
          enabled: false,
          mode: 'full_functionality',
          disable_all_search_operations: false,
          monthly_reset_date: new Date().toISOString(),
          restored_by: 'monthly_reset_script'
        }
      });

    console.log('✅ Monthly cap mode: DISABLED');

    console.log('🔧 2. RESTORING FULL STRATEGIST FUNCTIONALITY...');
    
    // Restore full strategist functionality
    await supabase
      .from('bot_config')
      .upsert({
        key: 'strategist_override',
        value: {
          force_posting_only: false,
          posting_weight: 70,    // Back to balanced strategy
          engagement_weight: 20,
          research_weight: 10,
          disable_reply_search: false,
          disable_trend_research: false,
          focus_on_original_content: false,
          restored_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Full strategist functionality: RESTORED');

    console.log('🔧 3. RESTORING NORMAL RATE LIMITING...');
    
    // Restore normal rate limiting
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limiting',
        value: {
          enabled: false,
          min_post_interval_minutes: 30, // Back to normal frequency
          max_posts_per_hour: 3,
          max_posts_per_day: 17, // Full Twitter free tier limit
          disable_startup_throttling: false,
          reduce_api_calls: false,
          skip_rate_limit_checks: false,
          restored_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Normal rate limiting: RESTORED');

    console.log('🔧 4. RESTORING RUNTIME CONFIG...');
    
    // Restore full runtime config
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 17, // Full free tier limit
          quality: {
            readabilityMin: 55,
            credibilityMin: 0.85
          },
          fallbackStaggerMinutes: 30, // Normal posting frequency
          postingStrategy: 'balanced',
          mode: 'production'
        }
      });

    console.log('✅ Runtime config: RESTORED to full functionality');

    console.log('🔧 5. RE-ENABLING ALL AGENTS...');
    
    // Re-enable all agents
    await supabase
      .from('bot_config')
      .upsert({
        key: 'disabled_agents',
        value: {
          disable_reply_agent: false,
          disable_trend_research: false,
          disable_competitive_intelligence: false,
          disable_real_time_engagement: false,
          disable_search_operations: false,
          keep_posting_agent: true,
          keep_content_creation: true,
          restored_timestamp: new Date().toISOString(),
          reason: 'Monthly reset - full functionality restored'
        }
      });

    console.log('✅ All agents: RE-ENABLED');

    console.log('🔧 6. RESTORING IMAGE GENERATION...');
    
    // Re-enable image generation
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_text_only_mode',
        value: {
          enabled: false,
          force_text_only: false,
          disable_image_generation: false,
          disable_pexels_api: false,
          text_only_percentage: 0,
          restored_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Image generation: RESTORED');

    console.log('🔧 7. UPDATING POSTING SCHEDULE...');
    
    // Update posting schedule for full functionality
    const today = new Date().toISOString().split('T')[0];
    
    // Clear emergency state
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create normal posting state
    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 17,
        posts_target: 17,
        last_post_time: null,
        next_post_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Next post in 30 minutes
        posting_schedule: [],
        emergency_mode: false,
        strategy: 'balanced'
      });

    console.log('✅ Normal posting schedule: RESTORED');

    console.log('🔧 8. VERIFICATION...');
    
    // Verify all configurations are restored
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

    const { data: agentsConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'disabled_agents')
      .single();

    console.log('');
    console.log('🎉 FULL FUNCTIONALITY RESTORED!');
    console.log('===============================');
    console.log('');
    console.log('🎯 CONFIGURATION SUMMARY:');
    console.log(`   📝 Monthly Cap Mode: ${monthlyCapConfig?.value?.enabled ? '❌ STILL ACTIVE' : '✅ DISABLED'}`);
    console.log(`   🎯 Balanced Strategy: ${strategistConfig?.value?.force_posting_only ? '❌ STILL POSTING-ONLY' : '✅ RESTORED'}`);
    console.log(`   🤖 All Agents: ${agentsConfig?.value?.disable_search_operations ? '❌ STILL DISABLED' : '✅ ENABLED'}`);
    console.log('');
    console.log('🚀 RESTORED CAPABILITIES:');
    console.log('   ✅ Tweet searching and reply discovery');
    console.log('   ✅ User discovery and following');
    console.log('   ✅ Timeline reading and engagement');
    console.log('   ✅ Trend research and analysis');
    console.log('   ✅ Competitive intelligence gathering');
    console.log('   ✅ Image generation and visual content');
    console.log('   ✅ Full posting frequency (17 tweets/day)');
    console.log('   ✅ Engagement activities (likes, follows, retweets)');
    console.log('');
    console.log('📊 EXPECTED BEHAVIOR:');
    console.log('   🎯 Balanced strategy: 70% posting, 20% engagement, 10% research');
    console.log('   ⏱️ Normal posting frequency: Every 30 minutes during peak hours');
    console.log('   🖼️ Images and visual content: Re-enabled');
    console.log('   🔍 Search operations: Fully functional');
    console.log('   💬 Reply discovery: Active');
    console.log('   📈 Trend analysis: Real-time');
    console.log('');
    console.log('⚠️ NEXT STEPS:');
    console.log('   1. Monitor bot for first 24 hours');
    console.log('   2. Verify search operations work without 429 errors');
    console.log('   3. Confirm posting frequency returns to normal');
    console.log('   4. Watch for re-engagement with community');
    console.log('   5. Monitor monthly usage to avoid hitting cap again');
    console.log('');

  } catch (error) {
    console.error('❌ Restoration failed:', error);
    console.error('');
    console.error('🚨 MANUAL RESTORATION REQUIRED:');
    console.error('   1. Check Supabase bot_config table manually');
    console.error('   2. Disable emergency_monthly_cap_mode manually');
    console.error('   3. Re-enable disabled agents manually');
    console.error('   4. Update runtime config to normal values');
    process.exit(1);
  }
}

// Check if it's August 1st or later
const now = new Date();
const august1st2025 = new Date('2025-08-01T00:00:00Z');

if (now >= august1st2025) {
  console.log('✅ Monthly reset date reached - proceeding with restoration...');
  restoreFullFunctionality();
} else {
  console.log('⏰ Monthly reset not yet reached');
  console.log(`   Current date: ${now.toISOString()}`);
  console.log(`   Reset date: ${august1st2025.toISOString()}`);
  console.log(`   Days remaining: ${Math.ceil((august1st2025.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))}`);
  console.log('');
  console.log('🎯 TO RUN MANUALLY:');
  console.log('   Add --force flag to bypass date check');
  console.log('   Example: node restore_full_functionality_august_1st.js --force');
  
  if (process.argv.includes('--force')) {
    console.log('');
    console.log('🚨 FORCE FLAG DETECTED - PROCEEDING WITH RESTORATION...');
    restoreFullFunctionality();
  }
} 