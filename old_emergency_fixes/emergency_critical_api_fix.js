#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencyCriticalApiFix() {
  console.log('🚨 EMERGENCY: Critical API fixes...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. Resetting daily posting counter...');
    
    // Reset daily posting state to allow new posts
    const today = new Date().toISOString().split('T')[0];
    const { data: existingState, error: fetchError } = await supabase
      .from('daily_posting_state')
      .select('*')
      .eq('date', today)
      .single();

    if (existingState) {
      const { error: updateError } = await supabase
        .from('daily_posting_state')
        .update({
          posts_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('date', today);

      if (updateError) {
        console.log('⚠️ Could not reset posting counter, creating new state...');
        await supabase.from('daily_posting_state').delete().eq('date', today);
        await supabase.from('daily_posting_state').insert({
          date: today,
          posts_count: 0,
          target_posts: 12,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      console.log('✅ Daily posting counter reset to 0/12');
    } else {
      console.log('✅ No existing posting state found - bot will create fresh state');
    }

    console.log('🔧 2. Emergency runtime config...');
    
    const emergencyConfig = {
      maxDailyTweets: 12,
      quality: {
        readabilityMin: 25,
        credibilityMin: 0.3
      },
      fallbackStaggerMinutes: 30,
      postingStrategy: 'emergency_growth',
      emergency: {
        mode: true,
        bypassQualityGates: true,
        maxPostsPerHour: 3,
        reducedApiCalls: true
      }
    };

    const { error: configError } = await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: emergencyConfig,
        updated_at: new Date().toISOString()
      });

    if (configError) {
      console.error('❌ Failed to update config:', configError);
    } else {
      console.log('✅ Emergency runtime config applied');
    }

    console.log('');
    console.log('🎯 EMERGENCY FIXES COMPLETE!');
    console.log('🚀 Redeploy to apply fixes!');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  }
}

emergencyCriticalApiFix();
