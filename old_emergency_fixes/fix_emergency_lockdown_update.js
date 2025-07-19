#!/usr/bin/env node

/**
 * 🔧 FIX EMERGENCY LOCKDOWN - UPDATE VERSION
 * ==========================================
 * 
 * The previous script failed due to unique constraint violations.
 * This version uses UPDATE instead of UPSERT.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateEmergencyLockdowns() {
  console.log('🔧 UPDATING EMERGENCY LOCKDOWN CONFIGURATIONS');
  console.log('=' .repeat(60));
  
  const updates = [
    {
      key: 'emergency_cost_protection',
      value: {
        reason: 'Emergency lockdown DISABLED - bot operations restored',
        enabled: false,
        daily_budget_limit: 3,
        max_tokens_per_call: 500,
        cost_alert_threshold: 0.9,
        disable_learning_agents: false,
        burst_protection_minutes: 5,
        max_openai_calls_per_hour: 20,
        disable_autonomous_learning: false,
        disable_real_time_engagement: false,
        disable_competitive_intelligence: false,
        restored_at: new Date().toISOString()
      }
    },
    {
      key: 'emergency_environment',
      value: {
        EMERGENCY_MODE: 'false',
        DAILY_BUDGET_LIMIT: '3',
        MAX_POSTS_PER_HOUR: '1',
        EMERGENCY_COST_MODE: 'false',
        deployment_timestamp: new Date().toISOString(),
        DISABLE_LEARNING_AGENTS: 'false',
        DISABLE_AUTONOMOUS_LEARNING: 'false',
        RESTORED: 'true'
      }
    },
    {
      key: 'enable_emergency_posting',
      value: 'false'
    },
    {
      key: 'enable_emergency_content',
      value: 'false'
    },
    {
      key: 'emergency_simple_mode',
      value: 'false'
    },
    {
      key: 'emergency_ultra_cost_mode',
      value: 'false'
    }
  ];
  
  for (const update of updates) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .update({
          value: update.value,
          updated_at: new Date().toISOString()
        })
        .eq('key', update.key);
      
      if (error) {
        console.error(`❌ Failed to update ${update.key}:`, error);
      } else {
        console.log(`✅ ${update.key}: Updated successfully`);
      }
    } catch (err) {
      console.error(`❌ Error updating ${update.key}:`, err);
    }
  }
}

async function checkCurrentLockdownStatus() {
  console.log('\n🔍 CHECKING CURRENT LOCKDOWN STATUS');
  console.log('=' .repeat(60));
  
  try {
    // Check key emergency configurations
    const { data: emergencyConfigs, error } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', [
        'emergency_cost_protection',
        'emergency_environment',
        'enable_emergency_posting',
        'enable_emergency_content'
      ]);
    
    if (error) {
      console.error('❌ Error fetching configs:', error);
      return;
    }
    
    emergencyConfigs.forEach(config => {
      console.log(`\n📋 ${config.key}:`);
      
      // Check if this config indicates lockdown
      let lockdownActive = false;
      if (config.value && typeof config.value === 'object') {
        if (config.value.enabled === true || 
            config.value.EMERGENCY_MODE === 'true' ||
            config.value.EMERGENCY_COST_MODE === 'true' ||
            config.value.disable_learning_agents === true) {
          lockdownActive = true;
        }
      } else if (config.value === 'true' || config.value === true) {
        lockdownActive = true;
      }
      
      if (lockdownActive) {
        console.log('   🚨 LOCKDOWN STILL ACTIVE');
      } else {
        console.log('   ✅ Lockdown disabled');
      }
      
      console.log(`   Value: ${JSON.stringify(config.value)}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking lockdown status:', error);
  }
}

async function forceDisableBudgetLockdown() {
  console.log('\n🚨 FORCE DISABLING BUDGET LOCKDOWN');
  console.log('=' .repeat(60));
  
  try {
    // Force disable the main emergency cost protection
    const { error: costError } = await supabase
      .from('bot_config')
      .update({
        value: { enabled: false, reason: 'FORCE DISABLED - Bot restoration', disabled_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq('key', 'emergency_cost_protection');
    
    if (costError) {
      console.error('❌ Failed to disable cost protection:', costError);
    } else {
      console.log('✅ Emergency cost protection FORCE DISABLED');
    }
    
    // Force disable emergency environment
    const { error: envError } = await supabase
      .from('bot_config')
      .update({
        value: { 
          EMERGENCY_MODE: 'false',
          EMERGENCY_COST_MODE: 'false',
          DISABLE_LEARNING_AGENTS: 'false',
          DISABLE_AUTONOMOUS_LEARNING: 'false',
          FORCE_DISABLED: 'true',
          disabled_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('key', 'emergency_environment');
    
    if (envError) {
      console.error('❌ Failed to disable emergency environment:', envError);
    } else {
      console.log('✅ Emergency environment FORCE DISABLED');
    }
    
  } catch (error) {
    console.error('❌ Error force disabling lockdown:', error);
  }
}

async function main() {
  console.log('🔧 EMERGENCY LOCKDOWN FIX');
  console.log('Using UPDATE to fix existing configurations...\n');
  
  await checkCurrentLockdownStatus();
  await updateEmergencyLockdowns();
  await forceDisableBudgetLockdown();
  await checkCurrentLockdownStatus();
  
  console.log('\n🎯 SUMMARY:');
  console.log('=' .repeat(60));
  console.log('Emergency lockdown configurations have been updated.');
  console.log('If the bot is still not posting, the issue may be:');
  console.log('1. 🏗️  Deployment/code issues on Render');
  console.log('2. 🔧 System not reading updated database configurations');
  console.log('3. 💥 Code changes broke the posting mechanism');
  
  console.log('\n⚠️  IMPORTANT: Check Render logs for deployment errors.');
}

main().catch(console.error); 