#!/usr/bin/env node
/**
 * 🔧 CREATE DAILY POSTING TABLE AND FIX
 * Ensure table exists and initialize posting for July 3rd
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTableAndFix() {
  console.log('🔧 === CREATE DAILY POSTING TABLE AND FIX ===');
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  try {
    // 1. Ensure the table exists
    console.log('🗄️ Ensuring daily_posting_state table exists...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS daily_posting_state (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        tweets_posted INTEGER DEFAULT 0,
        posts_completed INTEGER DEFAULT 0,
        posts_target INTEGER DEFAULT 17,
        max_daily_tweets INTEGER DEFAULT 17,
        next_post_time TIMESTAMP WITH TIME ZONE,
        posting_schedule JSONB DEFAULT '[]'::jsonb,
        emergency_mode BOOLEAN DEFAULT false,
        last_post_time TIMESTAMP WITH TIME ZONE,
        strategy TEXT DEFAULT 'balanced',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql_query: createTableSQL });
    
    if (createError) {
      console.log('⚠️ Could not create table via RPC (may already exist):', createError.message);
      console.log('📝 Proceeding with insert attempt...');
    } else {
      console.log('✅ Table ensured to exist');
    }
    
    // 2. Generate posting schedule for rest of today
    console.log('📅 Generating posting schedule for rest of July 3rd...');
    
    const POSTING_WINDOWS = [
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
    if (schedule.length > 0) {
      schedule.slice(0, 5).forEach((slot, i) => {
        console.log(`   ${i + 1}. ${new Date(slot).toLocaleString()}`);
      });
    }
    
    // 3. Delete existing record for today (if any)
    console.log('\n🧹 Cleaning existing state for today...');
    const { error: deleteError } = await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);
    
    if (deleteError) {
      console.log('⚠️ Could not delete existing record (may not exist):', deleteError.message);
    } else {
      console.log('✅ Cleaned existing state');
    }
    
    // 4. Insert new daily state using direct SQL insert
    console.log('\n📊 Inserting Daily Posting Manager state...');
    
    const insertSQL = `
      INSERT INTO daily_posting_state (
        date,
        tweets_posted,
        posts_completed,
        posts_target,
        max_daily_tweets,
        next_post_time,
        posting_schedule,
        emergency_mode,
        last_post_time,
        strategy
      ) VALUES (
        '${today}',
        0,
        0,
        17,
        17,
        '${schedule.length > 0 ? schedule[0] : new Date(now.getTime() + 60 * 60 * 1000).toISOString()}',
        '${JSON.stringify(schedule)}'::jsonb,
        false,
        NULL,
        'balanced'
      )
      RETURNING *;
    `;
    
    const { data: insertData, error: insertError } = await supabase.rpc('exec_sql', { sql_query: insertSQL });
    
    if (insertError) {
      console.error('❌ Failed to insert via SQL RPC:', insertError);
      
      // Try direct supabase insert as fallback
      console.log('🔄 Trying direct Supabase insert...');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('daily_posting_state')
        .insert({
          date: today,
          tweets_posted: 0,
          posts_completed: 0,
          posts_target: 17,
          max_daily_tweets: 17,
          next_post_time: schedule.length > 0 ? schedule[0] : new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
          posting_schedule: schedule,
          emergency_mode: false,
          last_post_time: null,
          strategy: 'balanced'
        })
        .select();
      
      if (fallbackError) {
        console.error('❌ Fallback insert also failed:', fallbackError);
        console.log('💡 Attempting simple fix using emergency reset...');
        
        // Last resort: use the emergency reset approach
        const { error: simpleInsertError } = await supabase
          .from('daily_posting_state')
          .upsert({
            date: today,
            tweets_posted: 0,
            posts_completed: 0,
            posts_target: 17,
            max_daily_tweets: 17
          });
        
        if (simpleInsertError) {
          console.error('❌ Simple insert failed too:', simpleInsertError);
          return;
        } else {
          console.log('✅ Simple daily state created successfully');
        }
      } else {
        console.log('✅ Fallback insert successful');
      }
    } else {
      console.log('✅ Daily posting state inserted successfully via SQL');
    }
    
    // 5. Force immediate posting flag if in posting hours
    const currentHour = now.getHours();
    if (currentHour >= 9 && currentHour <= 21) {
      console.log('\n🚀 SETTING IMMEDIATE POST FLAG (in posting hours)...');
      
      const { error: flagError } = await supabase
        .from('bot_config')
        .upsert({
          key: 'startup_posting_override',
          value: {
            enabled: true,
            force_immediate_post: true,
            clear_phantom_times: true,
            reason: 'Daily Posting Manager manual restart - July 3rd',
            timestamp: new Date().toISOString()
          }
        });
      
      if (flagError) {
        console.error('❌ Failed to set posting flag:', flagError);
      } else {
        console.log('✅ Immediate posting flag set');
      }
    } else {
      console.log(`\n⏰ Outside posting hours (${currentHour}:00). Will start posting at 9:00 AM.`);
    }
    
    // 6. Verify the fix
    console.log('\n🔍 Verifying the fix...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('daily_posting_state')
      .select('*')
      .eq('date', today)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      console.log(`   📅 Date: ${verifyData.date}`);
      console.log(`   📊 Progress: ${verifyData.posts_completed}/${verifyData.posts_target}`);
      console.log(`   ⏰ Next post: ${new Date(verifyData.next_post_time).toLocaleString()}`);
      console.log(`   📅 Schedule slots: ${Array.isArray(verifyData.posting_schedule) ? verifyData.posting_schedule.length : 'N/A'}`);
    }
    
    console.log('\n✅ === DAILY POSTING MANAGER FIX COMPLETE ===');
    console.log('🎯 The bot should now be able to post starting at 9:00 AM');
    console.log('📊 Check production logs for posting activity!');
    
  } catch (error) {
    console.error('❌ Table creation and fix failed:', error);
  }
}

// Run the fix
createTableAndFix().catch(console.error); 