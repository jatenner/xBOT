#!/usr/bin/env node

// 🚨 EMERGENCY FIX: False Monthly Cap on July 1st
// This script clears incorrect monthly cap configurations from the database

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixFalseMonthlyCapIssue() {
  console.log('🚨 EMERGENCY FIX: Clearing false monthly cap settings');
  console.log('📅 Date: July 1st - No monthly cap should be active!');
  
  try {
    // 1. Check current bot_config entries
    console.log('\n🔍 Checking current bot_config entries...');
    const { data: configs, error: fetchError } = await supabase
      .from('bot_config')
      .select('*')
      .or('key.eq.emergency_monthly_cap_mode,key.eq.smart_monthly_cap_mode');
    
    if (fetchError) {
      console.error('Error fetching configs:', fetchError);
      return;
    }
    
    console.log('📊 Current configs:', configs);
    
    // 2. UPDATE existing emergency monthly cap mode (not upsert)
    console.log('\n🔧 Disabling emergency_monthly_cap_mode...');
    const { error: emergencyError } = await supabase
      .from('bot_config')
      .update({
        value: {
          enabled: false,
          mode: 'disabled',
          disabled_reason: 'False monthly cap fixed on July 1st',
          fixed_at: new Date().toISOString(),
          original_mode: 'posting_only',
          disable_all_search_operations: false
        }
      })
      .eq('key', 'emergency_monthly_cap_mode');
    
    if (emergencyError) {
      console.error('Error updating emergency_monthly_cap_mode:', emergencyError);
    } else {
      console.log('✅ Emergency monthly cap mode DISABLED');
    }
    
    // 3. UPDATE existing smart monthly cap mode (not upsert)
    console.log('\n🔧 Disabling smart_monthly_cap_mode...');
    const { error: smartError } = await supabase
      .from('bot_config')
      .update({
        value: {
          enabled: false,
          mode: 'disabled',
          disable_search_operations: false,
          disable_engagement_discovery: false,
          allow_posting: true,
          allow_original_content: true,
          disabled_reason: 'False monthly cap fixed on July 1st',
          fixed_at: new Date().toISOString(),
          original_mode: 'search_limited_posting_active'
        }
      })
      .eq('key', 'smart_monthly_cap_mode');
    
    if (smartError) {
      console.error('Error updating smart_monthly_cap_mode:', smartError);
    } else {
      console.log('✅ Smart monthly cap mode DISABLED');
    }
    
    // 4. Reset Twitter API limits for July
    console.log('\n🔧 Resetting Twitter API limits for July...');
    const { error: limitsError } = await supabase
      .from('twitter_api_limits')
      .upsert({
        id: 1,
        tweets_this_month: 0,
        monthly_tweet_cap: 1500,
        daily_posts_count: 0,
        daily_post_limit: 75,
        reads_this_month: 0,
        monthly_read_cap: 50000,
        emergency_monthly_cap_mode: false,
        last_monthly_reset: new Date().toISOString(),
        last_updated: new Date().toISOString()
      });
    
    if (limitsError) {
      console.error('Error resetting Twitter API limits:', limitsError);
    } else {
      console.log('✅ Twitter API limits reset for July');
    }
    
    // 5. Update daily posting state
    console.log('\n🔧 Resetting daily posting state...');
    const { error: dailyError } = await supabase
      .from('daily_posting_state')
      .delete()
      .neq('id', 0); // Delete all entries to force refresh
    
    if (dailyError) {
      console.log('Note: daily_posting_state table may not exist yet');
    } else {
      console.log('✅ Daily posting state cleared (will refresh)');
    }
    
    // 6. Verify fixes
    console.log('\n🔍 Verifying fixes...');
    const { data: updatedConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .or('key.eq.emergency_monthly_cap_mode,key.eq.smart_monthly_cap_mode');
    
    console.log('📊 Updated configs:');
    updatedConfigs.forEach(config => {
      console.log(`   ${config.key}: enabled = ${config.value.enabled}`);
    });
    
    // 7. Check Twitter API limits
    const { data: limits } = await supabase
      .from('twitter_api_limits')
      .select('*')
      .eq('id', 1)
      .single();
    
    console.log('\n📊 Current Twitter limits:');
    console.log(`   Tweets this month: ${limits.tweets_this_month}/${limits.monthly_tweet_cap}`);
    console.log(`   Emergency mode: ${limits.emergency_monthly_cap_mode}`);
    
    console.log('\n✅ FALSE MONTHLY CAP FIX COMPLETE!');
    console.log('🎯 Bot should now have full API access on July 1st');
    console.log('🔄 Restart the bot to apply changes');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    process.exit(1);
  }
}

fixFalseMonthlyCapIssue().then(() => {
  console.log('🎉 Fix completed successfully');
  process.exit(0);
}); 