#!/usr/bin/env node

/**
 * 🚀 IMMEDIATE AFTERNOON ENGAGEMENT OPTIMIZATION
 * Fixes conservative posting behavior and boosts engagement for peak 2-5 PM window
 */

const { supabaseClient } = require('./dist/utils/supabaseClient');

async function optimizeAfternoonEngagement() {
  console.log('🚀 OPTIMIZING AFTERNOON ENGAGEMENT...');
  console.log('⏰ Target: Peak 2-5 PM performance boost');
  
  try {
    // 1. 🎯 Set aggressive afternoon posting strategy
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'afternoon_boost_mode',
        value: {
          enabled: true,
          peak_hours: [13, 14, 15, 16, 17], // 1-5 PM
          min_interval_minutes: 45, // Reduced from 90 to 45 minutes
          engagement_weight: 0.5, // Reduced from 0.7 to increase posting
          force_activity: true,
          boost_expires: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours
        }
      });

    // 2. 📈 Reset today's posting count to allow more posts
    const today = new Date().toISOString().split('T')[0];
    
    await supabaseClient.supabase
      .from('daily_posting_state')
      .upsert({
        date: today,
        posts_completed: 0, // Reset to allow more posts
        posts_target: 6,
        next_post_time: new Date().toISOString(),
        emergency_mode: false,
        posting_schedule: [],
        strategy: 'aggressive_afternoon'
      });

    // 3. 🔥 Emergency posting bypass for next 4 hours
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_posting_bypass',
        value: {
          daily_limit_bypass: true,
          afternoon_boost: true,
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          reason: 'Afternoon engagement optimization'
        }
      });

    // 4. 💪 Force immediate engagement actions
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'force_engagement_mode',
        value: {
          enabled: true,
          priority_actions: ['reply', 'post', 'thread'],
          min_actions_per_hour: 3, // At least 3 actions per hour
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        }
      });

    // 5. 📊 Update strategist settings for afternoon boost
    await supabaseClient.supabase
      .from('bot_config')
      .upsert({
        key: 'strategist_afternoon_config',
        value: {
          sleep_action_weight: 0.1, // Drastically reduce sleep decisions
          reply_weight: 0.4,
          post_weight: 0.3,
          thread_weight: 0.2,
          min_post_interval: 45, // 45 minutes instead of 90
          peak_multiplier: 2.0
        }
      });

    console.log('✅ AFTERNOON OPTIMIZATION COMPLETE!');
    console.log('');
    console.log('🎯 CHANGES MADE:');
    console.log('   📈 Posting interval: 90min → 45min');
    console.log('   💪 Engagement weight: 70% → 50% (more posting)');
    console.log('   🔥 Sleep decisions: 60% → 10%');
    console.log('   ⚡ Force 3+ actions per hour');
    console.log('   🚀 Emergency bypass: 4 hours');
    console.log('');
    console.log('⏰ ACTIVE UNTIL: ' + new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleTimeString());
    console.log('');
    console.log('📊 EXPECTED RESULTS:');
    console.log('   🔥 More aggressive posting at 2-5 PM');
    console.log('   💬 Active replies and engagement');
    console.log('   📈 Increased follower growth rate');
    console.log('   🎯 Strategic content during peak hours');

  } catch (error) {
    console.error('❌ Optimization failed:', error);
  }
}

// Run immediately
optimizeAfternoonEngagement(); 