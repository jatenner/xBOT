require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearEmergencyBlocks() {
  console.log('🔧 Clearing emergency blocks from database...');
  
  try {
    // Clear emergency timing configuration
    const { error: emergencyError } = await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'emergency_timing');
    
    if (emergencyError && emergencyError.code !== 'PGRST116') { // PGRST116 = not found, which is OK
      console.error('❌ Error clearing emergency timing:', emergencyError);
    } else {
      console.log('✅ Cleared emergency_timing config');
    }
    
    // Clear emergency posting only mode
    const { error: postingError } = await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'engagement_settings');
    
    if (postingError && postingError.code !== 'PGRST116') {
      console.error('❌ Error clearing engagement settings:', postingError);
    } else {
      console.log('✅ Cleared engagement_settings config');
    }
    
    // Clear any monthly cap workarounds
    const { error: monthlyError } = await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'monthly_cap_workaround');
    
    if (monthlyError && monthlyError.code !== 'PGRST116') {
      console.error('❌ Error clearing monthly cap workaround:', monthlyError);
    } else {
      console.log('✅ Cleared monthly_cap_workaround config');
    }
    
    // Check what emergency configs remain
    const { data: remainingConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .or('key.like.*emergency*,key.like.*block*,key.like.*cooldown*');
    
    if (remainingConfigs && remainingConfigs.length > 0) {
      console.log('⚠️ Remaining emergency-related configs:');
      remainingConfigs.forEach(config => {
        console.log(`   ${config.key}: ${JSON.stringify(config.value)}`);
      });
    } else {
      console.log('✅ No emergency blocks found in database');
    }
    
    console.log('🎯 Emergency blocks cleared! Bot should resume normal operations.');
    
  } catch (error) {
    console.error('❌ Error clearing emergency blocks:', error);
  }
}

clearEmergencyBlocks(); 