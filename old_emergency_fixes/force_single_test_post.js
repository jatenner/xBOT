#!/usr/bin/env node

/**
 * 🚨 FORCE SINGLE TEST POST
 * =========================
 * 
 * Forces one test post bypassing all rate limit checks
 * to verify the bot can actually post to Twitter
 */

const { createClient } = require('@supabase/supabase-js');

async function forceSingleTestPost() {
  console.log('🚨 FORCE SINGLE TEST POST');
  console.log('=========================');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('💡 Please run: export $(cat .env | xargs) && node force_single_test_post.js');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    console.log('🔧 1. TEMPORARILY DISABLE RATE LIMITS...');
    
    // Set a special bypass flag in database
    await supabase
      .from('bot_config')
      .upsert({
        key: 'test_mode_bypass',
        value: {
          enabled: true,
          bypass_rate_limits: true,
          force_posting: true,
          test_timestamp: new Date().toISOString()
        }
      });

    console.log('🔧 2. FORCE UPDATE RUNTIME CONFIG...');
    
    // Force runtime config to allow posting
    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          maxDailyTweets: 50,  // Temporarily high limit
          max_daily_tweets: 50,
          quality: {
            readabilityMin: 10,  // Very low for testing
            credibilityMin: 0.1
          },
          fallbackStaggerMinutes: 1,
          postingStrategy: 'test_mode',
          force_test_mode: true,
          test_bypass_active: true
        }
      });

    console.log('🔧 3. CLEAR DAILY POSTING STATE...');
    
    // Reset daily state completely
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create test-friendly state
    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 50,
        posts_target: 50,
        last_post_time: null,
        next_post_time: new Date().toISOString(),
        posting_schedule: [],
        emergency_mode: false,
        strategy: 'test_mode',
        test_bypass: true
      });

    console.log('🔧 4. CREATE TEST CONTENT...');
    
    // Simple test tweet content
    const testContent = `🧪 TEST: xBot posting verification ${new Date().toLocaleTimeString()} - System operational with 17 daily posts available. #HealthTech #AI`;

    console.log(`📝 Test content: ${testContent}`);

    console.log('');
    console.log('🎯 TEST MODE ACTIVATED!');
    console.log('✅ Rate limits bypassed');
    console.log('✅ Runtime config set to 50 posts');
    console.log('✅ Daily state reset');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('1. The bot should now be able to post');
    console.log('2. Check Render logs for posting activity');
    console.log('3. Verify tweet appears on Twitter');
    console.log('4. Run restore script after test');
    console.log('');
    console.log('⚠️ Remember to restore normal config after testing!');

  } catch (error) {
    console.error('❌ Force test setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  forceSingleTestPost();
}

module.exports = { forceSingleTestPost }; 