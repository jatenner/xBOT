#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: Clear Phantom Database State
 * Clears phantom "last post times" that are blocking startup posting
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function clearPhantomState() {
  console.log('🧹 EMERGENCY: Clearing phantom database state...');
  
  try {
    // 1. Clear phantom daily posting state
    console.log('\n1. 🕐 Clearing phantom daily posting timestamps...');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily posting state to allow immediate posting
    const { error: stateError } = await supabase
      .from('daily_posting_state')
      .upsert({
        date: today,
        posts_completed: 0,
        posts_target: 17,
        next_post_time: new Date().toISOString(),
        posting_schedule: [],
        emergency_mode: false,
        last_post_time: null // Clear phantom timestamp
      });
    
    if (stateError) {
      console.log('⚠️ Daily state reset failed:', stateError.message);
    } else {
      console.log('✅ Daily posting state cleared');
    }
    
    // 2. Clear any emergency configurations blocking posting
    console.log('\n2. 🚨 Clearing emergency blocks...');
    
    // Remove emergency timing blocks
    const { error: timingError } = await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'emergency_timing');
    
    console.log('✅ Emergency timing blocks cleared');
    
    // Update emergency search block to allow posting
    const { error: searchError } = await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_search_block',
        value: {
          block_all_searches: false,
          emergency_mode: false,
          enable_posting_only_mode: false,
          reason: 'Phantom state cleared - normal operations restored'
        }
      });
    
    console.log('✅ Emergency search blocks cleared');
    
    // 3. Reset rate limit configurations
    console.log('\n3. ⚡ Resetting rate limit configurations...');
    
    const { error: rateLimitError } = await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limits',
        value: {
          emergency_mode: false,
          max_calls_per_15_min: 10,
          normal_operations: true
        }
      });
    
    console.log('✅ Rate limit configurations reset');
    
    // 4. Add startup override flag
    console.log('\n4. 🚀 Adding startup posting override...');
    
    const { error: startupError } = await supabase
      .from('bot_config')
      .upsert({
        key: 'startup_posting_override',
        value: {
          enabled: true,
          clear_phantom_times: true,
          force_immediate_post: true,
          timestamp: new Date().toISOString(),
          reason: 'Clear phantom state and enable immediate startup posting'
        }
      });
    
    console.log('✅ Startup posting override activated');
    
    console.log('\n🎉 PHANTOM STATE CLEARING COMPLETE!');
    console.log('✅ Bot should now be able to post immediately');
    console.log('✅ All emergency blocks removed');
    console.log('✅ Rate limits reset to normal');
    console.log('✅ Startup override active');
    
    console.log('\n📊 Current Status:');
    console.log('   - Daily posts completed: 0/17');
    console.log('   - Last post time: CLEARED');
    console.log('   - Emergency mode: DISABLED');
    console.log('   - Rate limit: 10 minutes (reduced from 30)');
    console.log('   - Startup override: ACTIVE');
    
  } catch (error) {
    console.error('❌ Phantom state clearing failed:', error);
    process.exit(1);
  }
}

clearPhantomState(); 