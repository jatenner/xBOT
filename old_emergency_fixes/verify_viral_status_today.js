#!/usr/bin/env node

// 🔍 VIRAL TRANSFORMATION VERIFICATION
console.log('🔍 === CHECKING VIRAL TRANSFORMATION STATUS ===');

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  try {
    const { data } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', ['emergency_mode_override', 'viral_mode_force_active', 'content_generation_mode']);
    
    console.log('📊 CURRENT STATUS:');
    for (const config of data || []) {
      if (config.key === 'content_generation_mode') {
        const parsed = JSON.parse(config.value);
        console.log(`  ✅ ${config.key}: ${parsed.mode} - ${parsed.viral_percentage}% viral`);
      } else {
        console.log(`  ✅ ${config.key}: ${config.value}`);
      }
    }
    
    console.log('\n🚨 REMEMBER: Check Render logs for EMERGENCY_MODE=false');
    console.log('🎯 If still seeing EMERGENCY_MODE=true in logs, fix Render environment variable');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verify();