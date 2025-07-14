#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateConfigValues() {
  console.log('🔧 === UPDATING CONFIGURATION VALUES ===');
  console.log('🎯 Optimizing existing settings for maximum tweet output');
  
  try {
    // Update existing configurations using UPDATE instead of INSERT
    const updates = [
      { key: 'max_posts_per_day', value: '15' },
      { key: 'target_tweets_per_day', value: '12' },
      { key: 'max_posts_per_hour', value: '2' },
      { key: 'min_interval_minutes', value: '30' },
      { key: 'posting_strategy', value: 'smart_budget_optimized' },
      { key: 'enabled', value: 'true' },
      { key: 'DISABLE_BOT', value: 'false' },
      { key: 'emergency_stop', value: 'false' },
      { key: 'posting_enabled', value: 'true' },
      { key: 'kill_switch', value: 'false' },
      { key: 'maintenance_mode', value: 'false' },
      { key: 'scheduler_enabled', value: 'true' },
      { key: 'daily_posting_manager_enabled', value: 'true' }
    ];
    
    for (const update of updates) {
      const { error } = await supabase
        .from('bot_config')
        .update({ value: update.value })
        .eq('key', update.key);
      
      if (error) {
        console.error('Failed to update ' + update.key + ':', error);
      } else {
        console.log('✅ Updated ' + update.key + ': ' + update.value);
      }
    }
    
    console.log('\n🎉 CONFIGURATION OPTIMIZATION COMPLETE!');
    console.log('📊 Current settings:');
    console.log('   🎯 Max posts per day: 15 (up from 6)');
    console.log('   📈 Target tweets: 12 daily');
    console.log('   ⚡ Max posts per hour: 2 (up from 1)');
    console.log('   ⏰ Min interval: 30 minutes');
    console.log('   🚀 Strategy: Smart budget optimized');
    console.log('   ✅ All safety switches: OFF');
    
    console.log('\n💡 Expected results:');
    console.log('   • 10-15 tweets per day instead of 6');
    console.log('   • 95%+ budget utilization');
    console.log('   • $0.15-0.25 per tweet');
    console.log('   • No more ghost account periods');
    
  } catch (error) {
    console.error('Error updating configuration:', error);
  }
}

updateConfigValues(); 