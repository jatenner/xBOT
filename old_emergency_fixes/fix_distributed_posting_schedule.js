#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDistributedPostingSchedule() {
  console.log('⏰ === FIXING DISTRIBUTED POSTING SCHEDULE ===');
  console.log('🎯 Mission: Stop burst posting, enable perfect distribution');
  console.log('⚡ Fixing: 10 tweets at once → 1 tweet every 90 minutes');
  console.log('');

  try {
    // 1. ANTI-BURST POSTING CONFIGURATION
    console.log('🛡️ STEP 1: ANTI-BURST POSTING PROTECTION');
    console.log('==========================================');

    await supabase
      .from('bot_config')
      .upsert({
        key: 'anti_burst_posting_config',
        value: {
          // STRICT POSTING INTERVALS
          minimum_interval_minutes: 90,             // MINIMUM 90 minutes between posts
          maximum_interval_minutes: 180,            // MAXIMUM 3 hours between posts
          target_interval_minutes: 120,             // TARGET: Every 2 hours
          
          // DAILY RHYTHM
          posts_per_day: 10,                        // 10 posts per day (every 2.4 hours)
          posting_window_start: 8,                  // Start at 8 AM
          posting_window_end: 22,                   // End at 10 PM
          
          // OPTIMAL TIMES (Spread throughout day)
          optimal_posting_hours: [8, 10, 12, 14, 16, 18, 20, 22], // 8 posts spread evenly
          avoid_burst_hours: [],                    // No burst hours allowed
          
          // BURST PREVENTION
          max_posts_per_hour: 1,                    // NEVER more than 1 post per hour
          cooldown_after_post_minutes: 90,          // 90-minute cooldown after each post
          burst_detection_enabled: true,            // Detect and prevent bursts
          
          // EMERGENCY BRAKE
          stop_posting_if_burst_detected: true,     // Stop if burst detected
          burst_penalty_hours: 2,                   // 2-hour penalty if burst occurs
          
          last_updated: new Date().toISOString()
        },
        description: 'Anti-burst posting configuration for perfect distribution'
      });

    console.log('✅ Anti-burst posting configured (90 minutes minimum spacing)');

    // 2. PERFECT VIRAL POSTING SCHEDULE
    console.log('\n📅 STEP 2: PERFECT VIRAL POSTING SCHEDULE');
    console.log('=========================================');
    
    // Calculate perfect timing for distributed viral content
    const perfectViralTimes = [
      { hour: 8, minute: 0, description: 'Morning viral hook', viral_type: 'hot_take' },
      { hour: 10, minute: 0, description: 'Late morning engagement', viral_type: 'behind_scenes' },
      { hour: 12, minute: 0, description: 'Lunch viral content', viral_type: 'personal_story' },
      { hour: 14, minute: 0, description: 'Afternoon value bomb', viral_type: 'value_bomb' },
      { hour: 16, minute: 0, description: 'Late afternoon hot take', viral_type: 'hot_take' },
      { hour: 18, minute: 0, description: 'Evening viral story', viral_type: 'personal_story' },
      { hour: 20, minute: 0, description: 'Prime time engagement', viral_type: 'trend_jack' },
      { hour: 22, minute: 0, description: 'Night controversy', viral_type: 'controversy' }
    ];

    await supabase
      .from('bot_config')
      .upsert({
        key: 'perfect_viral_posting_schedule',
        value: {
          // PERFECT DAILY SCHEDULE for viral growth
          daily_schedule: perfectViralTimes,
          schedule_type: 'fixed_viral_optimal',
          
          // SCHEDULE PROPERTIES
          total_daily_posts: perfectViralTimes.length,
          average_interval_hours: 2,                 // Every 2 hours
          variance_minutes: 0,                       // No variance - perfect timing
          
          // VIRAL CONTENT STRATEGY
          morning_content: 'hot_takes_and_hooks',
          midday_content: 'value_bombs_and_insights',
          afternoon_content: 'personal_stories',
          evening_content: 'controversial_takes',
          
          // ENGAGEMENT OPTIMIZATION
          skip_if_low_engagement_predicted: false,   // Always post for consistency
          adaptive_timing_enabled: false,            // Fixed timing for reliability
          track_performance_by_time: true,           // Learn optimal times
          
          // QUALITY CONTROL
          minimum_viral_score: 70,                   // High viral potential required
          prefer_quality_over_frequency: true,       // Quality first
          
          last_updated: new Date().toISOString()
        },
        description: 'Perfect viral posting schedule - 8 posts distributed every 2 hours'
      });

    console.log('✅ Perfect viral schedule created (8 posts, 2-hour intervals)');

    // 3. DISABLE ALL EMERGENCY/CATCHUP POSTING
    console.log('\n🚫 STEP 3: DISABLE EMERGENCY/CATCHUP POSTING');
    console.log('============================================');

    await supabase
      .from('bot_config')
      .upsert({
        key: 'disable_catchup_posting',
        value: {
          emergency_posting_disabled: true,
          catchup_posting_disabled: true,
          burst_posting_disabled: true,
          rapid_fire_posting_disabled: true,
          multiple_simultaneous_posts_disabled: true,
          only_scheduled_posts_allowed: true,
          distributed_posting_only: true,
          reason: 'Prevent burst posting - only allow scheduled distributed posts'
        },
        description: 'Complete disable of catchup and emergency posting'
      });

    console.log('✅ Emergency/catchup posting completely disabled');

    // 4. SCHEDULER OPTIMIZATION
    console.log('\n⚡ STEP 4: SCHEDULER OPTIMIZATION');
    console.log('================================');

    await supabase
      .from('bot_config')
      .upsert({
        key: 'optimized_scheduler_config',
        value: {
          // REDUCED FREQUENCIES (Prevent overactive scheduling)
          main_scheduler_check_minutes: 15,          // Check every 15 minutes (reasonable)
          posting_decision_check_minutes: 30,        // Posting decisions every 30 minutes
          engagement_check_hours: 2,                 // Engagement check every 2 hours
          learning_update_hours: 4,                  // Learning updates every 4 hours
          
          // SMART SCHEDULING
          only_post_at_scheduled_times: true,        // ONLY post at scheduled times
          ignore_opportunity_posting: true,          // Ignore "opportunity" posts
          strict_schedule_adherence: true,           // Strict adherence to schedule
          
          // VIRAL CONTENT BATCHING
          batch_viral_content_generation: true,      // Generate viral content in batches
          batch_size: 4,                            // Generate 4 viral posts at once
          batch_frequency_hours: 8,                  // Every 8 hours
          
          // ENERGY SAVING
          sleep_mode_hours: [0, 1, 2, 3, 4, 5, 6, 7],  // Sleep 12 AM - 7 AM
          reduced_activity_hours: [23],              // Reduced activity 11 PM
          
          last_updated: new Date().toISOString()
        },
        description: 'Optimized scheduler for perfect viral distribution'
      });

    console.log('✅ Scheduler optimized for distributed posting');

    // 5. RUNTIME CONFIG UPDATE
    console.log('\n🔧 STEP 5: RUNTIME CONFIG UPDATE');
    console.log('================================');

    await supabase
      .from('bot_config')
      .upsert({
        key: 'runtime_config',
        value: {
          // DISTRIBUTED POSTING SETTINGS
          maxDailyTweets: 10,                        // 10 distributed tweets
          minIntervalMinutes: 90,                    // 90 minutes minimum
          fallbackStaggerMinutes: 120,               // 2 hours fallback
          postingStrategy: "distributed_viral",      // New strategy
          
          // QUALITY SETTINGS (Viral-optimized)
          quality: { 
            readabilityMin: 30,                      // Lower for viral content
            credibilityMin: 0.3,                     // Lower for engagement
            viralPotentialMin: 70                    // High viral potential required
          },
          
          // VIRAL FEATURES
          enable_viral_content_generation: true,
          enable_engagement_optimization: true,
          enable_follower_growth_tracking: true,
          
          // BURST PREVENTION
          anti_burst_posting: true,
          distributed_posting_only: true,
          emergency_posting_disabled: true,
          
          last_updated: new Date().toISOString()
        },
        description: 'Runtime config optimized for distributed viral posting'
      });

    console.log('✅ Runtime config updated for viral distribution');

    // 6. CLEAR AND RESET DAILY STATE
    console.log('\n🔄 STEP 6: RESET DAILY STATE');
    console.log('============================');

    const today = new Date().toISOString().split('T')[0];
    
    // Clear existing daily state
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create fresh state with distributed schedule
    const nextPostTime = new Date();
    nextPostTime.setMinutes(0, 0, 0);
    if (nextPostTime.getHours() < 8) {
      nextPostTime.setHours(8);
    } else {
      // Find next even hour (8, 10, 12, 14, 16, 18, 20, 22)
      const currentHour = nextPostTime.getHours();
      const nextHour = Math.ceil(currentHour / 2) * 2;
      if (nextHour > 22) {
        nextPostTime.setDate(nextPostTime.getDate() + 1);
        nextPostTime.setHours(8);
      } else {
        nextPostTime.setHours(nextHour);
      }
    }

    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        max_daily_tweets: 10,
        posts_target: 10,
        last_post_time: null,
        next_post_time: nextPostTime.toISOString(),
        posting_schedule: JSON.stringify(perfectViralTimes),
        emergency_mode: false,
        strategy: 'distributed_viral',
        anti_burst_active: true
      });

    console.log(`✅ Daily state reset - next post at ${nextPostTime.toLocaleTimeString()}`);

    // SUCCESS SUMMARY
    console.log('\n🎉 === DISTRIBUTED POSTING SCHEDULE FIXED ===');
    console.log('============================================');
    console.log('');
    console.log('✅ BURST POSTING ELIMINATED:');
    console.log('   🚫 No more 10 tweets at once');
    console.log('   ⏰ 90 minutes minimum between posts');
    console.log('   🛡️ Burst detection and prevention active');
    console.log('   🚨 Emergency posting completely disabled');
    console.log('');
    console.log('📅 NEW POSTING SCHEDULE:');
    perfectViralTimes.forEach((time, index) => {
      console.log(`   ${index + 1}. ${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')} - ${time.description}`);
    });
    console.log('');
    console.log('🔥 VIRAL STRATEGY:');
    console.log('   🎯 8-10 posts per day perfectly distributed');
    console.log('   ⏱️ Every 2 hours (8 AM - 10 PM)');
    console.log('   🚀 Each post optimized for viral potential');
    console.log('   📈 Content type varies by time for maximum engagement');
    console.log('');
    console.log(`⏰ NEXT POST: ${nextPostTime.toLocaleString()}`);
    console.log('🚀 YOUR POSTING SCHEDULE IS NOW PERFECT FOR VIRAL GROWTH!');

  } catch (error) {
    console.error('❌ Distributed posting fix failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  fixDistributedPostingSchedule()
    .then(() => {
      console.log('\n✅ DISTRIBUTED POSTING SCHEDULE FIX COMPLETE!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDistributedPostingSchedule }; 