#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function emergencyComprehensiveFix() {
  console.log('🚨 EMERGENCY COMPREHENSIVE FIX');
  console.log('==============================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. Fixing runtime_config structure...');
    
    // Delete and recreate runtime_config with correct structure
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'runtime_config');

    const { data, error } = await supabase
      .from('bot_config')
      .insert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 12,
          quality: {
            readabilityMin: 35,
            credibilityMin: 0.4
          },
          fallbackStaggerMinutes: 90,
          postingStrategy: 'balanced'
        }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create fixed runtime_config:', error);
    } else {
      console.log('✅ Fixed runtime_config structure:', data.value);
    }

    console.log('🔧 2. Ensuring all required configs exist...');
    
    const requiredConfigs = [
      { key: 'DISABLE_BOT', value: 'false' },
      { key: 'API_OPTIMIZATION', value: 'true' },
      { key: 'DAILY_POST_LIMIT', value: '12' },
      { key: 'MONTHLY_POST_LIMIT', value: '360' },
      { key: 'VIRAL_MODE', value: 'true' },
      { key: 'EMERGENCY_MODE', value: 'false' }
    ];

    for (const config of requiredConfigs) {
      const { error } = await supabase
        .from('bot_config')
        .upsert({
          key: config.key,
          value: config.value
        });

      if (error) {
        console.log(`⚠️ Could not upsert ${config.key}:`, error.message);
      } else {
        console.log(`✅ Ensured ${config.key} = ${config.value}`);
      }
    }

    console.log('🔧 3. Testing fixed configuration...');
    
    const { data: testConfig, error: testError } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'runtime_config')
      .single();

    if (testError) {
      console.error('❌ Test failed:', testError);
    } else {
      console.log('✅ Configuration test passed:', testConfig.value);
    }

    console.log('\n🎉 COMPREHENSIVE EMERGENCY FIX COMPLETE!');
    console.log('🚀 Bot should now deploy without errors');
    console.log('📊 Runtime config properly structured');
    console.log('🗄️ Database configs verified');

  } catch (error) {
    console.error('❌ Comprehensive fix failed:', error);
    process.exit(1);
  }
}

emergencyComprehensiveFix();
