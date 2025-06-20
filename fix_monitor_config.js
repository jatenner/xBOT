#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMonitorConfig() {
  console.log('🔧 === FIXING MONITOR CONFIG ===');
  
  try {
    // Add missing bot_config entries needed by monitor
    const missingConfigs = [
      {
        key: 'bot_enabled',
        value: 'true',
        description: 'Whether the bot is currently enabled'
      },
      {
        key: 'last_activity', 
        value: new Date().toISOString(),
        description: 'Timestamp of last bot activity'
      },
      {
        key: 'current_mode',
        value: 'autonomous',
        description: 'Current bot operation mode'
      },
      {
        key: 'reply_enabled',
        value: 'true', 
        description: 'Whether reply functionality is enabled'
      },
      {
        key: 'engagement_enabled',
        value: 'true',
        description: 'Whether engagement actions are enabled'
      }
    ];

    console.log('📝 Adding missing configuration entries...');
    
    for (const config of missingConfigs) {
      const { error } = await supabase
        .from('bot_config')
        .upsert(config, { 
          onConflict: 'key',
          ignoreDuplicates: false 
        });
        
      if (error) {
        console.error(`❌ Error adding ${config.key}:`, error);
      } else {
        console.log(`✅ Added/updated ${config.key}: ${config.value}`);
      }
    }
    
    // Verify the entries exist
    console.log('\n🔍 Verifying configuration...');
    const { data: configs, error: fetchError } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', missingConfigs.map(c => c.key));
      
    if (fetchError) {
      console.error('❌ Error fetching configs:', fetchError);
    } else {
      console.log('📋 Current bot_config entries:');
      configs.forEach(config => {
        console.log(`   ${config.key}: ${config.value}`);
      });
    }
    
    console.log('\n✅ Monitor configuration fixed!');
    console.log('🔄 Try running the monitor again: ./start_remote_bot_monitor.js');
    
  } catch (error) {
    console.error('❌ Error fixing monitor config:', error);
  }
}

fixMonitorConfig(); 