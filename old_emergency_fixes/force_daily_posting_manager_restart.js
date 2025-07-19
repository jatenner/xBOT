#!/usr/bin/env node
/**
 * 🚀 FORCE DAILY POSTING MANAGER RESTART
 * Manually initialize daily state and activate posting for July 3rd
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceDailyPostingRestart() {
  console.log('🚀 === FORCING DAILY POSTING MANAGER RESTART ===');
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  try {
    // 1. Generate optimal posting schedule for rest of today
    console.log('📅 Generating posting schedule for rest of July 3rd...');
    
    const POSTING_WINDOWS = [
      { start_hour: 6, end_hour: 9, posts_count: 2, priority: 3 },   // Early Morning (2 posts)
      { start_hour: 9, end_hour: 12, posts_count: 4, priority: 4 }, // Morning Peak (4 posts)
      { start_hour: 12, end_hour: 15, posts_count: 4, priority: 5 }, // Lunch & Early Afternoon PEAK (4 posts)
      { start_hour: 15, end_hour: 18, posts_count: 4, priority: 5 }, // Late Afternoon PEAK (4 posts)
      { start_hour: 18, end_hour: 21, posts_count: 2, priority: 4 }, // Evening Peak (2 posts)
      { start_hour: 21, end_hour: 23, posts_count: 1, priority: 3 },  // Late Evening (1 post)
    ];
    
    const schedule = [];
    for (const window of POSTING_WINDOWS) {
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      windowStart.setHours(window.start_hour, 0, 0, 0);
      
      const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      windowEnd.setHours(window.end_hour, 0, 0, 0);
      
      // Skip windows that are completely in the past
      if (windowEnd <= now) {
        console.log(`⏰ Skipping past window: ${window.start_hour}-${window.end_hour}`);
        continue;
      }
      
      // Adjust window start to current time if partially past
      const effectiveWindowStart = windowStart < now ? now : windowStart;
      const windowDuration = (windowEnd.getTime() - effectiveWindowStart.getTime()) / (1000 * 60); // minutes
      const interval = windowDuration / window.posts_count;

      for (let i = 0; i < window.posts_count; i++) {
        const baseTime = new Date(effectiveWindowStart.getTime() + (i * interval * 60 * 1000));
        const randomOffset = (Math.random() - 0.5) * 10 * 60 * 1000; // ±5 minutes
        const postTime = new Date(baseTime.getTime() + randomOffset);
        
        // Ensure post time stays within the window and is in the future
        const clampedTime = new Date(Math.max(
          Math.max(effectiveWindowStart.getTime(), now.getTime() + 60000), // At least 1 minute from now
          Math.min(postTime.getTime(), windowEnd.getTime() - 60000) // 1 minute before window end
        ));
        
        schedule.push(clampedTime.toISOString());
      }
    }
    
    schedule.sort();
    console.log(`✅ Generated ${schedule.length} posting slots for rest of day`);
    schedule.slice(0, 5).forEach((slot, i) => {
      console.log(`   ${i + 1}. ${new Date(slot).toLocaleString()}`);
    });
    
    // 2. Initialize/Update daily posting state
    console.log('\n📊 Initializing Daily Posting Manager state...');
    
    const dailyState = {
      date: today,
      tweets_posted: 0,
      posts_completed: 0,
      posts_target: 17,
      max_daily_tweets: 17,
      next_post_time: schedule.length > 0 ? schedule[0] : new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // Next hour if no schedule
      posting_schedule: JSON.stringify(schedule),
      emergency_mode: false,
      last_post_time: null,
      strategy: 'balanced'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('daily_posting_state')
      .upsert(dailyState);
    
    if (insertError) {
      console.error('❌ Failed to insert daily state:', insertError);
      return;
    }
    
    console.log('✅ Daily posting state initialized successfully');
    console.log(`📈 Target: 0/${dailyState.posts_target} posts`);
    console.log(`⏰ Next post scheduled: ${new Date(dailyState.next_post_time).toLocaleString()}`);
    
    // 3. Force immediate first post if we're in posting hours
    const currentHour = now.getHours();
    if (currentHour >= 9 && currentHour <= 21) {
      console.log('\n🚀 FORCING IMMEDIATE POST (in posting hours)...');
      
      // Clear any rate limiting phantom times
      await supabase
        .from('bot_config')
        .upsert({
          key: 'startup_posting_override',
          value: {
            enabled: true,
            force_immediate_post: true,
            clear_phantom_times: true,
            reason: 'Manual Daily Posting Manager restart',
            timestamp: new Date().toISOString()
          }
        });
      
      console.log('🧹 Cleared phantom rate limiting state');
      console.log('🚀 Set startup posting override flag');
      console.log('💡 The bot should post within the next few minutes when it checks this flag');
      
    } else {
      console.log(`\n⏰ Outside posting hours (${currentHour}:00). Next post at 9:00 AM.`);
    }
    
    // 4. Check if we need to trigger the scheduler restart
    console.log('\n🔄 SCHEDULER RESTART TRIGGER...');
    console.log('💡 In production (Render), the scheduler is already running and will pick up the new state');
    console.log('💡 If running locally, restart the bot to activate the new schedule');
    
    // 5. Summary
    console.log('\n✅ === DAILY POSTING MANAGER RESTART COMPLETE ===');
    console.log(`📊 Status: Ready to post ${dailyState.posts_target} tweets today`);
    console.log(`📅 Slots scheduled: ${schedule.length}`);
    console.log(`⏰ Next post: ${new Date(dailyState.next_post_time).toLocaleString()}`);
    
    if (currentHour >= 9 && currentHour <= 21) {
      console.log('🚀 Immediate posting enabled - should post within minutes');
    } else {
      console.log('⏰ Waiting for posting hours (9 AM - 9 PM)');
    }
    
    console.log('\n📊 Check production logs in a few minutes to see posting activity resume!');
    
  } catch (error) {
    console.error('❌ Force restart failed:', error);
  }
}

// Run the fix
forceDailyPostingRestart().catch(console.error); 