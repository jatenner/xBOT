#!/usr/bin/env node

/**
 * 🚀 ENVIRONMENT OVERRIDE DETECTOR
 * Detects and reports environment variable conflicts
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function detectEnvironmentConflicts() {
  console.log('🔍 === ENVIRONMENT CONFLICT DETECTION ===');
  
  // Check all possible emergency mode sources
  const sources = {
    'process.env.EMERGENCY_MODE': process.env.EMERGENCY_MODE,
    'process.env.ENABLE_EMERGENCY_MODE': process.env.ENABLE_EMERGENCY_MODE,
    'process.env.EMERGENCY_COST_MODE': process.env.EMERGENCY_COST_MODE,
    'process.env.DISABLE_LEARNING_AGENTS': process.env.DISABLE_LEARNING_AGENTS,
    'process.env.VIRAL_MODE': process.env.VIRAL_MODE,
    'process.env.NODE_ENV': process.env.NODE_ENV
  };
  
  console.log('🔧 Environment Variables:');
  for (const [key, value] of Object.entries(sources)) {
    const status = value === 'true' ? '🔴 TRUE' : value === 'false' ? '🟢 FALSE' : '⚪ UNSET';
    console.log(`  ${status} ${key}: ${value || 'undefined'}`);
  }
  
  // Check database overrides
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value')
      .in('key', ['emergency_mode_override', 'viral_mode_force_active', 'emergency_mode_active']);
    
    console.log('\n🗄️ Database Overrides:');
    for (const config of configs || []) {
      const status = config.value === 'true' || config.value === true ? '🟢 TRUE' : '🔴 FALSE';
      console.log(`  ${status} ${config.key}: ${config.value}`);
    }
  }
  
  // Provide recommendations
  console.log('\n🚀 RECOMMENDATIONS:');
  if (process.env.EMERGENCY_MODE === 'true') {
    console.log('❌ CRITICAL: EMERGENCY_MODE=true in environment - this blocks viral mode!');
    console.log('✅ FIX: Change EMERGENCY_MODE to false in Render dashboard');
  } else {
    console.log('✅ GOOD: EMERGENCY_MODE not forcing emergency state');
  }
  
  if (!process.env.VIRAL_MODE || process.env.VIRAL_MODE !== 'true') {
    console.log('💡 SUGGESTION: Add VIRAL_MODE=true to environment for extra activation');
  } else {
    console.log('✅ GOOD: VIRAL_MODE active in environment');
  }
}

detectEnvironmentConflicts().catch(console.error);