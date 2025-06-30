#!/usr/bin/env node

/**
 * 🔧 RESTORE NORMAL CONFIG
 * ========================
 * 
 * Restores normal posting configuration with optimized quality gates
 */

const { createClient } = require('@supabase/supabase-js');

async function restoreNormalConfig() {
  console.log('🔧 RESTORE NORMAL CONFIG');
  console.log('========================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('💡 Please run: export $(cat .env | xargs) && node restore_normal_config.js');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. REMOVING TEST MODE FLAGS...');
    
    // Remove test mode bypass
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'test_mode_bypass');

    console.log('🔧 2. RESTORING RUNTIME CONFIG WITH YOUR PREFERRED QUALITY GATES...');
    
    // Set normal config with your preferred quality gates
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 17,  // Full Free tier
          max_daily_tweets: 17,
          quality: {
            readabilityMin: 55,   // Your preferred setting
            credibilityMin: 0.85  // Your preferred setting
          },
          fallbackStaggerMinutes: 45,  // Faster posting
          postingStrategy: 'posting_only_mode',  // Monthly cap workaround
          restored_timestamp: new Date().toISOString()
        }
      });

    console.log('🔧 3. RESETTING DAILY POSTING STATE...');
    
    // Reset daily state to normal
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create normal daily state
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

    console.log('🔧 4. VERIFICATION...');
    
    // Verify config
    const { data: config } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    console.log('');
    console.log('✅ NORMAL CONFIG RESTORED!');
    console.log('📊 Settings:');
    console.log(`   • Daily tweets: ${config.value.maxDailyTweets}`);
    console.log(`   • Readability: ${config.value.quality.readabilityMin} (your preferred setting)`);
    console.log(`   • Credibility: ${config.value.quality.credibilityMin} (your preferred setting)`);
    console.log(`   • Posting strategy: ${config.value.postingStrategy}`);
    console.log('');
    console.log('🚀 Bot should now post with 17 daily tweets and your quality standards!');

  } catch (error) {
    console.error('❌ Config restoration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  restoreNormalConfig();
}

module.exports = { restoreNormalConfig }; 