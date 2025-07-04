#!/usr/bin/env node
/**
 * 🚀 SET POSTING OVERRIDE FLAG
 * Set the immediate posting flag in bot_config table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setPostingOverrideFlag() {
  console.log('🚀 === SETTING POSTING OVERRIDE FLAG ===');
  
  try {
    // Set the override flag using proper JSONB
    const overrideValue = {
      enabled: true,
      force_immediate_post: true,
      clear_phantom_times: true,
      reason: 'Daily Posting Manager initialization - July 3rd',
      timestamp: new Date().toISOString()
    };
    
    console.log('🔧 Setting startup posting override...');
    
    const { data, error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'startup_posting_override',
        value: overrideValue,
        description: 'Emergency flag to force immediate posting after Daily Posting Manager restart'
      })
      .select();
    
    if (error) {
      console.error('❌ Failed to set override flag:', error);
      return;
    }
    
    console.log('✅ Override flag set successfully:');
    console.log('   🚀 Enabled:', overrideValue.enabled);
    console.log('   💥 Force immediate post:', overrideValue.force_immediate_post);
    console.log('   🧹 Clear phantom times:', overrideValue.clear_phantom_times);
    console.log('   💡 Reason:', overrideValue.reason);
    
    // Verify it was set
    console.log('\n🔍 Verifying override flag...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'startup_posting_override')
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      console.log('   🔧 Key:', verifyData.key);
      console.log('   ⚙️ Value:', JSON.stringify(verifyData.value, null, 2));
    }
    
    console.log('\n✅ OVERRIDE FLAG SET COMPLETE');
    console.log('💡 The bot should now have the immediate posting flag active');
    
  } catch (error) {
    console.error('❌ Setting override flag failed:', error);
  }
}

// Run the script
setPostingOverrideFlag().catch(console.error); 