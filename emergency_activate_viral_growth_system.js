#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function emergencyActivateViralGrowthSystem() {
  console.log('🚀 === EMERGENCY VIRAL GROWTH SYSTEM ACTIVATION ===');
  console.log('🎯 Mission: Transform from academic bot → Viral follower growth machine');
  console.log('⚡ Fixing: Emergency mode, burst posting, academic content');
  console.log('');

  try {
    // ===== PHASE 1: DISABLE EMERGENCY MODE =====
    console.log('🚨 PHASE 1: DISABLING EMERGENCY MODE');
    console.log('=====================================');
    
    // 1. Disable emergency configurations
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_mode_disabled',
        value: {
          emergency_mode: false,
          disable_learning_agents: false,
          disable_autonomous_learning: false,
          normal_operation: true,
          daily_budget_limit: 3.00, // Keep cost protection but enable full features
          max_posts_per_day: 15,    // Enable viral posting frequency
          enable_viral_agents: true,
          enable_growth_optimization: true,
          timestamp: new Date().toISOString()
        },
        description: 'Emergency mode disabled - viral growth system activated'
      });

    console.log('✅ Emergency mode disabled');

    // 2. Remove emergency search blocks
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'emergency_search_block');

    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'emergency_timing');

    console.log('✅ Emergency blocks removed');

    // ===== PHASE 2: ACTIVATE VIRAL CONTENT STRATEGY =====
    console.log('\n🔥 PHASE 2: ACTIVATING VIRAL CONTENT STRATEGY');
    console.log('===============================================');

    // 1. Switch to viral content mode
    await supabase
      .from('bot_config')
      .upsert({
        key: 'content_mode_override',
        value: {
          mode: 'viral_follower_growth',
          academic_content_percentage: 10,  // Drastically reduce academic
          viral_content_percentage: 50,     // Maximum viral content
          controversial_percentage: 20,     // Engagement drivers
          personality_percentage: 20,       // Human connection
          enabled: true,
          priority: 'HIGHEST'
        },
        description: 'VIRAL MODE: Optimized for maximum follower growth'
      });

    console.log('✅ Viral content strategy activated (50% viral vs 10% academic)');

    // 2. Content type weights for viral focus
    await supabase
      .from('bot_config')
      .upsert({
        key: 'viral_content_weights',
        value: {
          hot_takes: 25,           // "Unpopular opinion: ..."
          behind_scenes: 20,       // "What they don't tell you..."
          personal_stories: 20,    // "3 years ago I learned..."
          trend_jacking: 15,       // Hijack trending topics
          value_bombs: 15,         // Actionable insights
          controversy: 5           // Debate starters
        },
        description: 'Content type distribution for viral growth'
      });

    console.log('✅ Viral content types configured');

    // 3. Enable all viral agents
    await supabase
      .from('bot_config')
      .upsert({
        key: 'viral_agents_enabled',
        value: {
          viral_follower_growth_agent: true,
          viral_health_theme_agent: true,
          engagement_maximizer_agent: true,
          streamlined_post_agent: true,
          ultra_viral_generator: true,
          aggressive_engagement_agent: true,
          audience_engagement_engine: true,
          all_systems_active: true
        },
        description: 'All viral growth agents activated'
      });

    console.log('✅ All viral agents activated');

    // ===== PHASE 3: FIX POSTING SCHEDULE =====
    console.log('\n⏰ PHASE 3: FIXING POSTING SCHEDULE');
    console.log('==================================');

    // 1. Perfect distributed schedule (no burst posting)
    await supabase
      .from('bot_config')
      .upsert({
        key: 'perfect_posting_schedule',
        value: {
          daily_schedule: [
            { hour: 8, minute: 0, description: 'Morning viral content' },
            { hour: 10, minute: 30, description: 'Late morning engagement' },
            { hour: 12, minute: 0, description: 'Lunch audience viral' },
            { hour: 14, minute: 30, description: 'Afternoon hot takes' },
            { hour: 16, minute: 0, description: 'Late afternoon value' },
            { hour: 18, minute: 30, description: 'Evening viral stories' },
            { hour: 20, minute: 0, description: 'Prime time engagement' },
            { hour: 21, minute: 30, description: 'Night viral content' }
          ],
          schedule_type: 'distributed_viral',
          target_posts_per_day: 12,      // Viral growth target
          min_interval_minutes: 90,      // 1.5 hours minimum spacing
          max_posts_per_hour: 1,         // NEVER burst post
          anti_burst_protection: true,
          viral_timing_optimization: true
        },
        description: 'Perfect distributed schedule for viral growth'
      });

    console.log('✅ Perfect distributed schedule created (8 posts throughout day)');

    // 2. Disable emergency posting
    await supabase
      .from('bot_config')
      .upsert({
        key: 'disable_emergency_posting',
        value: {
          emergency_posting_disabled: true,
          catch_up_posting_disabled: true,
          burst_posting_prevention: true,
          distributed_only: true,
          reason: 'Prevent 10 tweets at once - distributed posting only'
        },
        description: 'Emergency/burst posting completely disabled'
      });

    console.log('✅ Burst posting disabled - distributed posting only');

    // ===== PHASE 4: ENABLE LEARNING & GROWTH SYSTEMS =====
    console.log('\n🧠 PHASE 4: ENABLING LEARNING & GROWTH SYSTEMS');
    console.log('===============================================');

    // 1. Enable learning agents
    await supabase
      .from('bot_config')
      .upsert({
        key: 'learning_agents_enabled',
        value: {
          adaptive_content_learner: true,
          autonomous_learning_agent: true,
          engagement_feedback_agent: true,
          strategy_learner: true,
          competitive_intelligence_learner: true,
          real_time_engagement_tracker: true,
          learning_from_engagement: true,
          self_optimization: true
        },
        description: 'All learning agents enabled for follower growth'
      });

    console.log('✅ Learning agents activated');

    // 2. Engagement optimization settings
    await supabase
      .from('bot_config')
      .upsert({
        key: 'engagement_optimization',
        value: {
          target_engagement_rate: 5.0,      // 5% minimum engagement rate
          follower_growth_priority: true,
          learn_from_viral_posts: true,
          optimize_posting_times: true,
          track_engagement_patterns: true,
          adapt_content_strategy: true,
          viral_content_boost: true,
          engagement_triggers_enabled: true
        },
        description: 'Engagement optimization for follower growth'
      });

    console.log('✅ Engagement optimization enabled');

    // 3. Growth metrics tracking
    await supabase
      .from('bot_config')
      .upsert({
        key: 'growth_metrics_tracking',
        value: {
          track_follower_growth: true,
          track_engagement_rates: true,
          track_viral_content_performance: true,
          daily_growth_targets: {
            followers: 5,           // 5 new followers per day
            likes: 50,             // 50 likes per day
            retweets: 10,          // 10 retweets per day
            replies: 20            // 20 replies per day
          },
          optimize_for_growth: true
        },
        description: 'Growth metrics and targets for viral success'
      });

    console.log('✅ Growth metrics tracking enabled');

    // ===== PHASE 5: ACTIVATE MAIN POSTING AGENT SWITCH =====
    console.log('\n🎯 PHASE 5: SWITCHING TO VIRAL POSTING AGENT');
    console.log('===========================================');

    await supabase
      .from('bot_config')
      .upsert({
        key: 'main_posting_agent',
        value: {
          agent: 'StreamlinedPostAgent',  // Switch from academic PostTweetAgent
          mode: 'viral_follower_growth',
          priority: 'HIGHEST',
          academic_mode_disabled: true,
          viral_mode_active: true
        },
        description: 'Switched to StreamlinedPostAgent for viral growth'
      });

    console.log('✅ Switched to StreamlinedPostAgent (viral growth specialist)');

    // ===== FINAL: CLEAR DAILY STATE FOR FRESH START =====
    console.log('\n🔄 FINAL: CLEARING DAILY STATE FOR FRESH START');
    console.log('==============================================');

    const today = new Date().toISOString().split('T')[0];
    
    // Reset daily posting state
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 12,
        posts_target: 12,
        last_post_time: null,
        next_post_time: new Date().toISOString(),
        posting_schedule: JSON.stringify([]),
        emergency_mode: false,
        strategy: 'viral_growth'
      });

    console.log('✅ Daily state reset for viral growth');

    // ===== SUCCESS SUMMARY =====
    console.log('\n🎉 === VIRAL GROWTH SYSTEM ACTIVATION COMPLETE ===');
    console.log('================================================');
    console.log('');
    console.log('✅ PROBLEMS FIXED:');
    console.log('   🚨 Emergency mode → DISABLED');
    console.log('   📚 Academic content (90%) → Viral content (50%)');
    console.log('   💥 Burst posting → Distributed posting');
    console.log('   🧠 Learning disabled → ALL learning agents active');
    console.log('   📈 Growth optimization → ENABLED');
    console.log('');
    console.log('🔥 VIRAL SYSTEM NOW ACTIVE:');
    console.log('   🎯 Target: 12 posts/day distributed perfectly');
    console.log('   🔥 Content: 50% viral, 20% controversial, 20% personality');
    console.log('   📈 Learning: Real-time optimization from engagement');
    console.log('   👥 Goal: 5+ new followers per day');
    console.log('   💡 Strategy: Hot takes, behind-scenes, personal stories');
    console.log('');
    console.log('⏰ POSTING SCHEDULE:');
    console.log('   📅 8:00 AM - Morning viral content');
    console.log('   📅 10:30 AM - Late morning engagement');
    console.log('   📅 12:00 PM - Lunch audience viral');
    console.log('   📅 2:30 PM - Afternoon hot takes');
    console.log('   📅 4:00 PM - Late afternoon value');
    console.log('   📅 6:30 PM - Evening viral stories');
    console.log('   📅 8:00 PM - Prime time engagement');
    console.log('   📅 9:30 PM - Night viral content');
    console.log('');
    console.log('🚀 YOUR BOT IS NOW OPTIMIZED FOR VIRAL FOLLOWER GROWTH!');

  } catch (error) {
    console.error('❌ Emergency activation failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  emergencyActivateViralGrowthSystem()
    .then(() => {
      console.log('\n✅ EMERGENCY VIRAL ACTIVATION COMPLETE - READY FOR DEPLOYMENT!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Emergency activation failed:', error);
      process.exit(1);
    });
}

module.exports = { emergencyActivateViralGrowthSystem }; 