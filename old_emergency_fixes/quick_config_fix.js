#!/usr/bin/env node

/**
 * 🔧 QUICK CONFIG FIX
 * ===================
 * 
 * Sets runtime config: 17 tweets + your quality gates (55/0.85)
 */

const { createClient } = require('@supabase/supabase-js');

async function quickConfigFix() {
  console.log('🔧 QUICK CONFIG FIX');
  console.log('===================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. SETTING RUNTIME CONFIG...');
    
    // Set runtime config with your preferred settings
    const configValue = {
      maxDailyTweets: 17,
      max_daily_tweets: 17,
      quality: {
        readabilityMin: 55,   // Your preference
        credibilityMin: 0.85  // Your preference
      },
      fallbackStaggerMinutes: 45,
      postingStrategy: 'posting_only_mode',
      updated_timestamp: new Date().toISOString()
    };

    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: configValue
      });

    console.log('🔧 2. CLEARING DAILY STATE...');
    
    // Clear today's state
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create fresh daily state
    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 17,
        posts_target: 17,
        last_post_time: null,
        next_post_time: new Date().toISOString(),
        posting_schedule: [],
        emergency_mode: false,
        strategy: 'posting_only_mode'
      });

    console.log('🔧 3. VERIFICATION...');
    
    // Verify the config was set
    const { data: config, error } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (error) {
      console.error('❌ Error reading config:', error);
      return;
    }

    console.log('');
    console.log('✅ CONFIG SUCCESSFULLY SET!');
    console.log('📊 Current settings:');
    console.log(`   • Daily tweets: ${config.value.maxDailyTweets}`);
    console.log(`   • Readability min: ${config.value.quality.readabilityMin}`);
    console.log(`   • Credibility min: ${config.value.quality.credibilityMin}`);
    console.log(`   • Strategy: ${config.value.postingStrategy}`);
    console.log('');
    console.log('🚀 Bot should now be able to post with your quality standards!');
    console.log('📈 Check Render logs in the next few minutes for posting activity.');

  } catch (error) {
    console.error('❌ Config fix failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  quickConfigFix();
}

module.exports = { quickConfigFix }; 