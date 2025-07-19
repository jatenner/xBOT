#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixMissingRuntimeConfig() {
  console.log('🔧 EMERGENCY: Fixing missing runtime_config in bot_config...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Check if runtime_config exists
    console.log('🔍 Checking for existing runtime_config...');
    const { data: existing, error: selectError } = await supabase
      .from('bot_config')
      .select('*')
      .eq('key', 'runtime_config')
      .single();

    if (selectError && selectError.code === 'PGRST116') {
      console.log('❌ runtime_config missing - creating it...');
      
      // Create the missing runtime_config
      const { data, error } = await supabase
        .from('bot_config')
        .insert({
          key: 'runtime_config',
          value: {
            maxDailyTweets: 6,
            quality: {
              readabilityMin: 35,  // Optimized from follower strategy
              credibilityMin: 0.4  // Optimized from follower strategy
            },
            fallbackStaggerMinutes: 90,
            postingStrategy: 'balanced'
          }
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create runtime_config:', error);
        throw error;
      }

      console.log('✅ Created runtime_config:', data);
    } else if (selectError) {
      console.error('❌ Error checking runtime_config:', selectError);
      throw selectError;
    } else {
      console.log('✅ runtime_config already exists:', existing.value);
      
      // Update with optimized follower settings
      const { error: updateError } = await supabase
        .from('bot_config')
        .update({
          value: {
            ...existing.value,
            maxDailyTweets: 12, // Increased for follower growth
            quality: {
              readabilityMin: 35,  // Lowered for more posts
              credibilityMin: 0.4  // Lowered for more posts
            }
          }
        })
        .eq('key', 'runtime_config');

      if (updateError) {
        console.error('❌ Failed to update runtime_config:', updateError);
      } else {
        console.log('✅ Updated runtime_config with follower optimization');
      }
    }

    // Also ensure other required configs exist
    const requiredConfigs = [
      { key: 'DISABLE_BOT', value: 'false' },
      { key: 'API_OPTIMIZATION', value: 'true' },
      { key: 'DAILY_POST_LIMIT', value: '12' },
      { key: 'MONTHLY_POST_LIMIT', value: '360' }
    ];

    console.log('🔧 Ensuring other required configs exist...');
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

    console.log('✅ EMERGENCY FIX COMPLETE');
    console.log('🚀 Bot should now start without PGRST116 errors');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  }
}

fixMissingRuntimeConfig(); 