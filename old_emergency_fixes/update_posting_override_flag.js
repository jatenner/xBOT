#!/usr/bin/env node
/**
 * 🔄 UPDATE POSTING OVERRIDE FLAG
 * Update the existing immediate posting flag in bot_config table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updatePostingOverrideFlag() {
  console.log('🔄 === UPDATING POSTING OVERRIDE FLAG ===');
  
  try {
    // Update the existing override flag
    const overrideValue = {
      enabled: true,
      force_immediate_post: true,
      clear_phantom_times: true,
      reason: 'Daily Posting Manager restart - July 3rd fix',
      timestamp: new Date().toISOString()
    };
    
    console.log('🔧 Updating startup posting override...');
    
    const { data, error } = await supabase
      .from('bot_config')
      .update({
        value: overrideValue,
        updated_at: new Date().toISOString()
      })
      .eq('key', 'startup_posting_override')
      .select();
    
    if (error) {
      console.error('❌ Failed to update override flag:', error);
      return;
    }
    
    console.log('✅ Override flag updated successfully:');
    console.log('   🚀 Enabled:', overrideValue.enabled);
    console.log('   💥 Force immediate post:', overrideValue.force_immediate_post);
    console.log('   🧹 Clear phantom times:', overrideValue.clear_phantom_times);
    console.log('   💡 Reason:', overrideValue.reason);
    
    // Verify the update
    console.log('\n🔍 Verifying updated flag...');
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
      console.log('   🕐 Updated:', verifyData.updated_at);
    }
    
    console.log('\n✅ OVERRIDE FLAG UPDATE COMPLETE');
    console.log('💡 The bot should now detect the updated immediate posting flag');
    
  } catch (error) {
    console.error('❌ Updating override flag failed:', error);
  }
}

// Run the script
updatePostingOverrideFlag().catch(console.error); 