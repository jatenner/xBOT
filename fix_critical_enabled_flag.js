// Use the existing comprehensive fix script pattern
const fs = require('fs');
const path = require('path');

// Import dynamically to handle TypeScript modules
async function getSupabaseClient() {
  try {
    const supabaseModule = await import('./src/utils/supabaseClient.js');
    return supabaseModule.supabaseClient;
  } catch (error) {
    console.log('Falling back to direct Supabase connection...');
    const { createClient } = require('@supabase/supabase-js');
    const dotenv = require('dotenv');
    dotenv.config();
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    return { supabase };
  }
}

async function fixCriticalEnabledFlag() {
  console.log('🚨 CRITICAL FIX: real_twitter_limits.enabled flag');
  console.log('This flag being true is BLOCKING all posts!');
  
  try {
    const supabaseClient = await getSupabaseClient();
    
    // The critical fix: set enabled = false
    const { data, error } = await supabaseClient.supabase
      .from('bot_config')
      .update({
        value: {
          enabled: false,  // 🚨 CRITICAL: This was true and blocking posts!
          tweets_3_hour: { limit: 300 },
          tweets_24_hour: { limit: 2400 },
          artificial_limits_removed: true,
          critical_fix_applied: new Date().toISOString(),
          description: 'Real Twitter limits - enabled=false means use these limits for reference only, do not block'
        }
      })
      .eq('key', 'real_twitter_limits');
      
    if (error) {
      console.error('❌ Error updating config:', error);
      return;
    }
    
    console.log('✅ Successfully updated real_twitter_limits.enabled = false');
    
    // Verify the fix
    const { data: verification, error: verifyError } = await supabaseClient.supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'real_twitter_limits')
      .single();
      
    if (verifyError) {
      console.error('❌ Error verifying:', verifyError);
      return;
    }
    
    const isFixed = verification?.value?.enabled === false;
    console.log('\n🔍 VERIFICATION:');
    console.log(`   enabled: ${verification?.value?.enabled} ${isFixed ? '✅' : '❌'}`);
    console.log(`   Status: ${isFixed ? 'FIXED - Posts will no longer be blocked!' : 'STILL BROKEN'}`);
    
    if (isFixed) {
      console.log('\n🎉 SUCCESS! The critical blocking issue has been resolved.');
      console.log('🚀 Your bot should now be able to post within Twitter\'s real 17/day limit.');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

if (require.main === module) {
  fixCriticalEnabledFlag();
}

module.exports = { fixCriticalEnabledFlag }; 