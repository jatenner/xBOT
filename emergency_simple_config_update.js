#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencySimpleUpdate() {
  console.log('🚨 EMERGENCY: Simple config update...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. Updating runtime config directly...');
    
    // Update existing config with ultra-low settings
    const emergencyConfig = {
      maxDailyTweets: 12,
      quality: {
        readabilityMin: 15,    // Ultra-low
        credibilityMin: 0.1    // Ultra-low
      },
      fallbackStaggerMinutes: 30,
      postingStrategy: 'emergency_growth',
      emergency: {
        mode: true,
        bypassQualityGates: true,
        maxPostsPerHour: 4,
        ultraLowQuality: true
      }
    };

    const { data: updateData, error: updateError } = await supabase
      .from('bot_config')
      .update({ value: emergencyConfig })
      .eq('key', 'runtime_config');

    if (updateError) {
      console.error('❌ Update failed:', updateError);
      
      // Try delete and insert as fallback
      console.log('🔧 Trying delete and insert...');
      await supabase.from('bot_config').delete().eq('key', 'runtime_config');
      
      const { error: insertError } = await supabase
        .from('bot_config')
        .insert({
          key: 'runtime_config',
          value: emergencyConfig
        });
        
      if (insertError) {
        throw insertError;
      }
    }

    console.log('✅ Ultra-low quality config applied');
    console.log('📊 New settings:');
    console.log('   • Readability: 15 (ultra-low)');
    console.log('   • Credibility: 0.1 (ultra-low)');
    console.log('   • Daily tweets: 12');
    console.log('   • Emergency mode: enabled');

    console.log('🔧 2. Resetting daily posting state...');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Try to update existing state first
    const { error: updateStateError } = await supabase
      .from('daily_posting_state')
      .update({ posts_count: 0, target_posts: 12 })
      .eq('date', today);

    if (updateStateError) {
      console.log('⚠️ No existing state, creating new...');
      // Create new state if update failed
      await supabase
        .from('daily_posting_state')
        .insert({
          date: today,
          posts_count: 0,
          target_posts: 12
        });
    }

    console.log('✅ Daily posting state reset to 0/12');

    console.log('');
    console.log('🎯 EMERGENCY CONFIG UPDATE COMPLETE!');
    console.log('=====================================');
    console.log('🚀 Bot should start posting with ultra-low barriers!');
    console.log('📊 Quality requirements drastically reduced');
    console.log('⚡ Emergency mode enabled');
    console.log('');
    console.log('Next: Wait for bot to reload config and start posting');

  } catch (error) {
    console.error('❌ Emergency config update failed:', error);
    process.exit(1);
  }
}

emergencySimpleUpdate();
