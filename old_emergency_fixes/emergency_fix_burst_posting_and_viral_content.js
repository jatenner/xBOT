#!/usr/bin/env node

/**
 * 🚨 EMERGENCY FIX: 17-Tweet Burst Posting + Viral Content Issues
 * ==============================================================
 * 
 * ROOT CAUSES IDENTIFIED:
 * 1. Strategic monitoring job creating "catch-up" bursts every 2 hours
 * 2. Emergency mode detection blocking viral content transformation
 * 3. Conflicting daily targets (6 vs 17 tweets) causing confusion
 * 4. Missing distributed posting schedule implementation
 * 
 * THIS SCRIPT FIXES ALL ISSUES IMMEDIATELY
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function emergencyFixBurstAndViral() {
  console.log('🚨 === EMERGENCY FIX: BURST POSTING + VIRAL CONTENT ===');
  console.log('🎯 Mission: Stop 17-tweet bursts at 10:30 AM + Activate viral content');
  console.log('');

  try {
    // ===== PHASE 1: DISABLE EMERGENCY CATCH-UP POSTING =====
    console.log('🛑 PHASE 1: DISABLE EMERGENCY CATCH-UP MECHANISMS');
    console.log('==================================================');
    
    // 1. Disable strategic monitoring catch-up
    await supabase
      .from('bot_config')
      .upsert({
        key: 'disable_strategic_catch_up',
        value: {
          strategic_monitoring_disabled: true,
          catch_up_posting_disabled: true,
          emergency_posting_disabled: true,
          burst_posting_prevention: true,
          reason: 'Prevent 17-tweet bursts at 10:30 AM',
          timestamp: new Date().toISOString()
        },
        description: 'CRITICAL: Disable all catch-up mechanisms causing burst posting'
      });

    console.log('✅ Strategic catch-up posting disabled');

    // 2. Set unified daily target (6 tweets, not 17)
    await supabase
      .from('bot_config')
      .upsert({
        key: 'unified_daily_target',
        value: {
          max_posts_per_day: 6,
          target_posts_per_day: 6,
          max_posts_per_hour: 1,
          min_interval_minutes: 120,
          no_catch_up_posting: true,
          no_emergency_posting: true
        },
        description: 'Unified 6-post daily target - NO MORE 17-tweet confusion'
      });

    console.log('✅ Daily target unified: 6 tweets maximum');

    // 3. Force distributed schedule (no bursts allowed)
    const distributedTimes = [
      { hour: 8, minute: 0, description: 'Morning professionals' },
      { hour: 11, minute: 30, description: 'Late morning break' },
      { hour: 14, minute: 0, description: 'Lunch audience' },
      { hour: 16, minute: 30, description: 'Afternoon break' },
      { hour: 19, minute: 0, description: 'Evening engagement' },
      { hour: 21, minute: 30, description: 'Late evening' }
    ];

    await supabase
      .from('bot_config')
      .upsert({
        key: 'perfect_distributed_schedule',
        value: {
          enabled: true,
          daily_schedule: distributedTimes,
          posts_per_day: 6,
          min_interval_minutes: 150, // 2.5 hours minimum
          max_posts_per_hour: 1,
          burst_protection: true,
          distributed_only: true,
          no_catch_up_allowed: true
        },
        description: 'Perfect 6-post schedule - NEVER post more than 1 per 2.5 hours'
      });

    console.log('✅ Perfect distributed schedule: 6 posts, 2.5-hour spacing');

    // ===== PHASE 2: FORCE VIRAL CONTENT ACTIVATION =====
    console.log('\n🔥 PHASE 2: FORCE VIRAL CONTENT ACTIVATION');
    console.log('===========================================');

    // 1. Override ALL emergency mode sources
    const emergencyOverrides = [
      { key: 'EMERGENCY_MODE_OVERRIDE', value: 'false' },
      { key: 'emergency_mode_active', value: 'false' },
      { key: 'force_viral_mode', value: 'true' },
      { key: 'ignore_emergency_env_vars', value: 'true' },
      { key: 'viral_transformation_active', value: 'true' }
    ];

    for (const override of emergencyOverrides) {
      await supabase.from('bot_config').upsert(override);
      console.log(`   ✅ ${override.key}: ${override.value}`);
    }

    // 2. Viral content strategy (60% viral, 5% academic)
    await supabase
      .from('bot_config')
      .upsert({
        key: 'viral_content_strategy',
        value: {
          mode: 'viral_first',
          viral_percentage: 60,
          controversial_percentage: 20,
          behind_scenes_percentage: 15,
          academic_percentage: 5,
          force_viral_hooks: true,
          banned_academic_phrases: [
            'BREAKTHROUGH:', 'Research shows', 'Studies indicate', 'According to research',
            'Clinical trials', 'Scientific evidence', 'Data suggests', 'Machine learning algorithms identify'
          ],
          required_viral_hooks: [
            'Hot take:', 'Unpopular opinion:', 'Plot twist:', 'What they don\'t tell you:',
            'Behind the scenes:', 'Real talk:', 'Controversial take:', 'Industry secret:',
            'The truth about', 'Everyone thinks... but', 'Nobody talks about this but'
          ]
        },
        description: 'FORCE VIRAL CONTENT: 60% viral vs 5% academic'
      });

    console.log('✅ Viral content strategy: 60% viral, 20% controversial, 5% academic');

    // 3. Content type distribution for engagement
    await supabase
      .from('bot_config')
      .upsert({
        key: 'viral_content_types',
        value: {
          hot_takes: 25,           // "Unpopular opinion: ..."
          behind_scenes: 20,       // "What they don't tell you..."
          personal_stories: 20,    // "3 years ago I learned..."
          trend_jacking: 15,       // Hijack trending topics
          value_bombs: 15,         // Actionable insights
          controversy: 5           // Debate starters
        },
        description: 'Viral content type weights for maximum engagement'
      });

    console.log('✅ Viral content types: Hot takes, behind scenes, personal stories');

    // ===== PHASE 3: EMERGENCY SYSTEM CLEANUP =====
    console.log('\n🧹 PHASE 3: EMERGENCY SYSTEM CLEANUP');
    console.log('====================================');

    // Clear current daily state to reset burst posting
    const today = new Date().toISOString().split('T')[0];
    
    await supabase
      .from('daily_posting_state')
      .delete()
      .eq('date', today);

    // Create fresh state with proper limits
    const nextPostTime = new Date();
    nextPostTime.setHours(nextPostTime.getHours() + 2); // Next post in 2 hours

    await supabase
      .from('daily_posting_state')
      .insert({
        date: today,
        tweets_posted: 0,
        posts_completed: 0,
        posts_target: 6,           // 6, not 17!
        max_daily_tweets: 6,       // 6, not 17!
        next_post_time: nextPostTime.toISOString(),
        posting_schedule: JSON.stringify(distributedTimes),
        emergency_mode: false,
        strategy: 'distributed_viral'
      });

    console.log('✅ Daily state reset: 6-post target, distributed schedule');

    // Disable all problematic scheduled jobs
    await supabase
      .from('bot_config')
      .upsert({
        key: 'disable_problematic_jobs',
        value: {
          strategic_monitoring_disabled: true,
          catch_up_jobs_disabled: true,
          emergency_jobs_disabled: true,
          burst_detection_active: true,
          only_distributed_posting: true
        },
        description: 'Disable all jobs that can cause burst posting'
      });

    console.log('✅ Problematic scheduled jobs disabled');

    // ===== PHASE 4: FORCE IMMEDIATE VIRAL CONTENT TEST =====
    console.log('\n🧪 PHASE 4: FORCE VIRAL CONTENT TEST');
    console.log('=====================================');

    // Override content generation for next post
    await supabase
      .from('bot_config')
      .upsert({
        key: 'force_viral_next_post',
        value: {
          enabled: true,
          force_viral_template: true,
          required_hook: 'Hot take:',
          content_type: 'controversial_opinion',
          academic_content_blocked: true,
          viral_override_active: true,
          test_post: true
        },
        description: 'Force next post to use viral content template as test'
      });

    console.log('✅ Next post will be forced viral content (test)');

    // SUCCESS SUMMARY
    console.log('\n🎉 === EMERGENCY FIX COMPLETE ===');
    console.log('=================================');
    console.log('');
    console.log('✅ BURST POSTING FIXED:');
    console.log('   🛑 Strategic catch-up disabled');
    console.log('   🛑 Emergency posting disabled');
    console.log('   📊 Daily target: 6 tweets (not 17)');
    console.log('   ⏰ Min spacing: 2.5 hours');
    console.log('   🛡️ Burst protection active');
    console.log('');
    console.log('✅ VIRAL CONTENT ACTIVATED:');
    console.log('   🔥 60% viral content (was academic)');
    console.log('   💬 20% controversial takes');
    console.log('   🎭 15% behind-the-scenes');
    console.log('   📚 5% academic (minimal)');
    console.log('   🚀 Viral hooks mandatory');
    console.log('');
    console.log('📅 NEW POSTING SCHEDULE:');
    distributedTimes.forEach((time, index) => {
      console.log(`   ${index + 1}. ${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')} - ${time.description}`);
    });
    console.log('');
    console.log('🚀 EXPECTED RESULTS:');
    console.log('   • NO MORE 17-tweet bursts at 10:30 AM');
    console.log('   • 6 tweets perfectly spaced throughout day');
    console.log('   • "Hot take:" and viral content instead of academic');
    console.log('   • 2.5-hour minimum between any posts');
    console.log('   • Real viral growth potential activated');
    console.log('');
    console.log('💡 MONITOR: Watch for viral hooks like "Hot take:" in next posts');
    console.log('🔧 If issues persist, the problem is in Render environment variables');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    throw error;
  }
}

// Run the emergency fix
emergencyFixBurstAndViral()
  .then(() => {
    console.log('✅ Emergency fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  }); 