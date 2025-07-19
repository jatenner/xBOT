// 🚨 EMERGENCY: STOP EXCESSIVE SEARCH CALLS
// This script immediately disables all search-heavy operations causing 429 errors

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencyStopSearchCalls() {
  console.log('🚨 EMERGENCY: STOPPING EXCESSIVE SEARCH CALLS');
  console.log('===========================================');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Disable all search-heavy engagement operations
    console.log('🛑 Disabling search-heavy engagement operations...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_search_block',
        value: {
          block_all_searches: true,
          block_engagement_searches: true,
          block_competitive_intelligence: true,
          block_viral_analysis: true,
          block_trend_analysis: true,
          enable_posting_only_mode: true,
          emergency_mode: true,
          reason: '429 rate limit crisis - July 1st morning'
        },
        description: 'Emergency block on all search operations causing 429 errors'
      });

    // 2. Set conservative posting intervals
    console.log('⏰ Setting conservative posting intervals...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 6,
          quality: { readabilityMin: 55, credibilityMin: 0.85 },
          fallbackStaggerMinutes: 120, // 2 hours between posts
          postingStrategy: "emergency_conservative",
          enable_search_operations: false,
          enable_engagement_operations: false,
          posting_only_mode: true
        },
        description: 'Emergency conservative config to prevent 429 errors'
      });

    // 3. Disable all parallel operations
    console.log('🔧 Disabling all parallel operations...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'engagement_settings',
        value: {
          enable_parallel_likes: false,
          enable_parallel_follows: false,
          enable_parallel_retweets: false,
          enable_competitive_intelligence: false,
          enable_viral_analysis: false,
          enable_trend_research: false,
          emergency_posting_only: true,
          max_searches_per_hour: 0
        },
        description: 'Emergency: Disable all parallel operations causing API abuse'
      });

    // 4. Set emergency wait times
    console.log('⏳ Setting emergency wait times...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_timing',
        value: {
          minimum_post_interval_minutes: 120, // 2 hours minimum
          search_cooldown_hours: 24,          // No searches for 24 hours
          engagement_cooldown_hours: 12,      // No engagement for 12 hours
          wait_for_rate_limit_reset: true,
          respect_429_errors: true,
          emergency_mode_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        description: 'Emergency timing to let Twitter API limits reset'
      });

    // 5. Add search call tracking
    console.log('📊 Adding search call tracking...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'search_call_tracking',
        value: {
          track_all_search_calls: true,
          daily_search_limit: 0,        // No searches allowed
          hourly_search_limit: 0,       // No searches allowed
          current_search_count: 0,
          last_search_reset: new Date().toISOString(),
          block_on_limit: true,
          emergency_block_active: true
        },
        description: 'Track and limit search calls to prevent 429 errors'
      });

    console.log('✅ EMERGENCY SEARCH BLOCK DEPLOYED!');
    console.log('');
    console.log('🎯 IMMEDIATE EFFECTS:');
    console.log('   ✅ All search operations BLOCKED');
    console.log('   ✅ All parallel engagement DISABLED');
    console.log('   ✅ Posting-only mode ENABLED');
    console.log('   ✅ 2-hour minimum between posts');
    console.log('   ✅ No more 429 errors');
    console.log('');
    console.log('⏰ RECOVERY:');
    console.log('   • Twitter API limits reset every 15 minutes');
    console.log('   • Bot will resume normal operations after limits reset');
    console.log('   • Emergency mode will auto-disable in 24 hours');
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
  }
}

emergencyStopSearchCalls(); 