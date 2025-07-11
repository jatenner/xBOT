require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearEmergencyBlocks() {
  console.log('🧹 === CLEARING EMERGENCY BLOCKS ===');
  
  try {
    // Delete emergency blocking configurations
    const emergencyKeys = [
      'emergency_timing',
      'emergency_rate_limits', 
      'emergency_search_block',
      'emergency_monthly_cap_mode',
      'emergency_disable_all_reads',
      'monthly_cap_emergency_mode',
      'emergency_content_mode',
      'disable_supreme_ai_complex_ops',
      'emergency_posting_schedule',
      'force_posting_only_mode',
      'emergency_force_post_now',
      'disable_failing_systems'
    ];
    
    let cleared = 0;
    for (const key of emergencyKeys) {
      const { error, count } = await supabase
        .from('bot_config')
        .delete()
        .eq('key', key);
      
      if (!error) {
        console.log('✅ Cleared emergency config: ' + key);
        cleared++;
      }
    }
    
    console.log('');
    console.log('🎯 Cleared ' + cleared + ' emergency configurations');
    console.log('🚀 Bot should now be free to post normally');
    
  } catch (error) {
    console.error('Error clearing emergency blocks:', error);
  }
}

clearEmergencyBlocks(); 