const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function enableBot() {
  console.log('🚀 === ENABLING BOT ===');
  console.log('Updating existing configurations...');
  
  try {
    // Update existing configurations using UPDATE
    const updates = [
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
    
    // Also set max_posts_per_day to proper value
    const { error } = await supabase
      .from('bot_config')
      .update({ value: '16' })
      .eq('key', 'max_posts_per_day');
    
    if (!error) {
      console.log('✅ Updated max_posts_per_day: 16');
    }
    
    console.log('');
    console.log('🎉 BOT ENABLED - All safety switches turned off');
    console.log('🚀 Bot should now start posting normally');
    
    // Verify final state
    const { data: verifyConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', ['enabled', 'DISABLE_BOT', 'kill_switch', 'maintenance_mode']);
    
    console.log('\n📋 Final configuration:');
    for (const config of verifyConfigs || []) {
      console.log(`   ${config.key}: ${config.value}`);
    }
    
  } catch (error) {
    console.error('Error enabling bot:', error);
  }
}

enableBot(); 