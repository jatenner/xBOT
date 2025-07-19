#!/usr/bin/env node

/**
 * 🚨 EMERGENCY BOT DISABLE
 * 
 * IMMEDIATELY DISABLE THE BOT to prevent posting during optimization
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function emergencyDisableBot() {
  console.log('🚨 === EMERGENCY BOT DISABLE ===');
  console.log('⏸️ STOPPING ALL BOT ACTIVITY IMMEDIATELY');
  console.log('💡 Reason: Applying critical cost and posting optimizations\n');

  try {
    // 1. DISABLE BOT COMPLETELY
    console.log('⏸️ 1. Disabling bot globally...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'enabled',
        value: 'false',
        description: 'Emergency disable during optimization'
      });

    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_stop',
        value: 'true',
        description: 'Emergency stop - optimization in progress'
      });

    console.log('✅ Bot disabled globally');

    // 2. STOP ALL POSTING
    console.log('🛑 2. Stopping all posting activity...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'posting_enabled',
        value: 'false',
        description: 'Posting disabled during optimization'
      });

    await supabase
      .from('bot_config')
      .upsert({
        key: 'max_posts_per_day',
        value: '0',
        description: 'Zero posts allowed during optimization'
      });

    console.log('✅ All posting stopped');

    // 3. DISABLE SCHEDULERS
    console.log('⏰ 3. Disabling all schedulers...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'scheduler_enabled',
        value: 'false',
        description: 'Schedulers disabled during optimization'
      });

    await supabase
      .from('bot_config')
      .upsert({
        key: 'daily_posting_manager_enabled',
        value: 'false',
        description: 'Daily posting manager disabled'
      });

    console.log('✅ All schedulers disabled');

    // 4. SET MAINTENANCE MODE
    console.log('🔧 4. Setting maintenance mode...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'maintenance_mode',
        value: 'true',
        description: 'Maintenance mode - optimization in progress'
      });

    await supabase
      .from('bot_config')
      .upsert({
        key: 'maintenance_reason',
        value: 'Cost and posting optimization in progress',
        description: 'Reason for maintenance mode'
      });

    console.log('✅ Maintenance mode activated');

    // 5. KILL SWITCH ACTIVATION
    console.log('🚨 5. Activating kill switch...');
    await supabase
      .from('bot_config')
      .upsert({
        key: 'kill_switch',
        value: 'true',
        description: 'Kill switch activated during optimization'
      });

    console.log('✅ Kill switch activated');

    console.log('\n🎯 BOT EMERGENCY DISABLE COMPLETE!');
    console.log('==================================');
    console.log('⏸️ Bot is now COMPLETELY DISABLED');
    console.log('🛑 NO posting will occur');
    console.log('⏰ ALL schedulers stopped');
    console.log('🔧 Maintenance mode active');
    console.log('🚨 Kill switch engaged');
    console.log('\n💡 SAFE TO PROCEED WITH OPTIMIZATIONS');
    console.log('✅ Bot will remain disabled until manually re-enabled');

  } catch (error) {
    console.error('❌ Emergency disable failed:', error);
    console.log('\n🚨 CRITICAL: Manual intervention may be required');
    console.log('If bot is still running, you may need to:');
    console.log('1. Stop the bot process manually');
    console.log('2. Set enabled=false in Supabase manually');
    console.log('3. Check for any scheduled jobs still running');
  }
}

if (require.main === module) {
  emergencyDisableBot().catch(console.error);
}

module.exports = { emergencyDisableBot }; 