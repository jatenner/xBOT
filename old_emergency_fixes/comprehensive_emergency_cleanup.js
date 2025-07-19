require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function comprehensiveEmergencyCleanup() {
  console.log('🧹 COMPREHENSIVE EMERGENCY CLEANUP - Clearing ALL emergency blocks...');
  
  try {
    // List of all emergency-related config keys to remove
    const emergencyKeys = [
      'emergency_timing',
      'engagement_settings', 
      'monthly_cap_workaround',
      'emergency_posting_bypass',
      'emergency_posting_strategy',
      'emergency_daily_targets',
      'emergency_rate_limits',
      'emergency_fallback_content',
      'emergency_text_only_mode',
      'emergency_rate_limiting',
      'emergency_immediate_posting',
      'nuclear_image_block',
      'repetition_nuclear_block',
      'emergency_search_block'
    ];
    
    console.log(`🎯 Removing ${emergencyKeys.length} emergency configurations...`);
    
    let deletedCount = 0;
    let notFoundCount = 0;
    
    for (const key of emergencyKeys) {
      const { error } = await supabase
        .from('bot_config')
        .delete()
        .eq('key', key);
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`   ℹ️ ${key}: Not found (already clean)`);
          notFoundCount++;
        } else {
          console.error(`   ❌ ${key}: Error - ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${key}: Deleted`);
        deletedCount++;
      }
    }
    
    console.log(`\n📊 CLEANUP SUMMARY:`);
    console.log(`   ✅ Deleted: ${deletedCount} configs`);
    console.log(`   ℹ️ Not found: ${notFoundCount} configs`);
    console.log(`   🧹 Total processed: ${emergencyKeys.length} configs`);
    
    // Verify cleanup - check for any remaining emergency configs
    const { data: remainingConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .or('key.like.*emergency*,key.like.*block*,key.like.*cooldown*,key.like.*nuclear*');
    
    if (remainingConfigs && remainingConfigs.length > 0) {
      console.log(`\n⚠️ Found ${remainingConfigs.length} remaining emergency-related configs:`);
      remainingConfigs.forEach(config => {
        console.log(`   🔍 ${config.key}: ${JSON.stringify(config.value).substring(0, 100)}...`);
      });
      
      // Clean these up too
      console.log(`\n🧹 Cleaning up remaining emergency configs...`);
      for (const config of remainingConfigs) {
        const { error } = await supabase
          .from('bot_config')
          .delete()
          .eq('key', config.key);
        
        if (error) {
          console.error(`   ❌ ${config.key}: Error - ${error.message}`);
        } else {
          console.log(`   ✅ ${config.key}: Deleted`);
          deletedCount++;
        }
      }
    } else {
      console.log('\n✅ No remaining emergency configs found');
    }
    
    // Final verification
    const { data: finalCheck } = await supabase
      .from('bot_config')
      .select('*')
      .or('key.like.*emergency*,key.like.*block*,key.like.*cooldown*,key.like.*nuclear*');
    
    if (finalCheck && finalCheck.length > 0) {
      console.log(`\n🚨 WARNING: ${finalCheck.length} emergency configs still remain!`);
      finalCheck.forEach(config => {
        console.log(`   🔍 ${config.key}`);
      });
    } else {
      console.log('\n🎉 SUCCESS: All emergency blocks have been cleared!');
    }
    
    console.log('\n🚀 Bot should now resume normal operations without emergency blocks!');
    console.log('📝 You may want to restart the bot to ensure it picks up the cleared state.');
    
  } catch (error) {
    console.error('❌ Error during emergency cleanup:', error);
  }
}

comprehensiveEmergencyCleanup(); 