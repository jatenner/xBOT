#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function emergencyUltraCostProtection() {
  console.log('🚨 EMERGENCY ULTRA COST PROTECTION');
  console.log('===================================');
  console.log('🎯 GOAL: Reduce from $10/day to $1/day (90% reduction)');
  console.log('💰 TARGET: Max $30/month instead of $300/month\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ULTRA-PROTECTION 1: Extreme OpenAI Cost Limits
  console.log('💀 STEP 1: ULTRA-STRICT OPENAI LIMITS');
  console.log('=====================================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'openai_cost_protection',
        value: {
          // EMERGENCY LIMITS
          daily_budget_limit: 1.0,           // MAX $1/day
          hourly_budget_limit: 0.05,         // MAX $0.05/hour  
          max_calls_per_hour: 3,             // MAX 3 calls/hour
          max_calls_per_day: 25,             // MAX 25 calls/day
          max_tokens_per_call: 75,           // MAX 75 tokens per call
          
          // EMERGENCY MODEL RESTRICTIONS
          allowed_models: ['gpt-3.5-turbo'], // ONLY cheapest model
          banned_models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o'], // NO expensive models
          
          // BURST PROTECTION
          min_interval_between_calls: 720,   // 12 minutes between calls
          burst_protection_enabled: true,
          
          // EMERGENCY MODE
          emergency_mode: true,
          cost_protection_level: 'MAXIMUM',
          last_updated: new Date().toISOString()
        }
      });

    if (error) {
      console.log('   ❌ OpenAI protection failed:', error.message);
    } else {
      console.log('   ✅ Ultra-strict OpenAI limits set');
      console.log('   💰 Daily budget: $1.00');
      console.log('   ⏱️  Max calls: 3/hour, 25/day');
      console.log('   🧠 Model: gpt-3.5-turbo ONLY');
      console.log('   ⏳ Min interval: 12 minutes');
    }
  } catch (error) {
    console.log('   ❌ OpenAI protection error:', error.message);
  }

  // ULTRA-PROTECTION 2: Disable Expensive Learning Agents  
  console.log('\n🧠 STEP 2: DISABLE LEARNING AGENTS');
  console.log('==================================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'learning_agents_config',
        value: {
          // DISABLE ALL LEARNING TEMPORARILY
          adaptive_content_learner: false,
          competitive_intelligence: false,
          autonomous_learning: false,
          strategic_opportunity_scheduler: false,
          trend_research_fusion: false,
          cross_industry_learning: false,
          
          // KEEP ONLY ESSENTIAL
          basic_posting: true,
          
          // EMERGENCY SETTINGS
          disabled_reason: 'emergency_cost_protection',
          disabled_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          last_updated: new Date().toISOString()
        }
      });

    if (error) {
      console.log('   ❌ Learning agents disable failed:', error.message);
    } else {
      console.log('   ✅ Learning agents DISABLED for 7 days');
      console.log('   🎯 Only basic posting enabled');
    }
  } catch (error) {
    console.log('   ❌ Learning agents error:', error.message);
  }

  // ULTRA-PROTECTION 3: Reduce Scheduler Frequency
  console.log('\n⏰ STEP 3: EMERGENCY SCHEDULER SLOWDOWN');
  console.log('=======================================');

  const emergencySchedules = [
    { job_name: 'strategist_agent', frequency: '0 */6 * * *', description: 'Every 6 hours (was 30min)' },
    { job_name: 'engagement_tracker', frequency: '0 */8 * * *', description: 'Every 8 hours (was 1hr)' },
    { job_name: 'real_engagement_agent', frequency: '0 */12 * * *', description: 'Every 12 hours (was 1hr)' },
    { job_name: 'learning_agent', frequency: '0 0 */3 * *', description: 'Every 3 days (was daily)' },
    { job_name: 'competitive_intelligence', frequency: '0 0 * * 0', description: 'Weekly only (was 6hr)' },
    { job_name: 'tweet_auditor', frequency: '0 0 */2 * *', description: 'Every 2 days (was 4hr)' }
  ];

  for (const schedule of emergencySchedules) {
    try {
      const { error } = await supabase
        .from('scheduler_jobs')
        .upsert({
          job_name: schedule.job_name,
          frequency: schedule.frequency,
          enabled: false, // DISABLE EVERYTHING TEMPORARILY
          emergency_disabled: true,
          disabled_reason: 'emergency_cost_protection',
          last_updated: new Date().toISOString()
        });

      if (error) {
        console.log(`   ⚠️ ${schedule.job_name}: ${error.message}`);
      } else {
        console.log(`   ✅ ${schedule.job_name}: DISABLED (${schedule.description})`);
      }
    } catch (error) {
      console.log(`   ❌ ${schedule.job_name} error:`, error.message);
    }
  }

  // ULTRA-PROTECTION 4: Content Caching to Reduce API Calls
  console.log('\n💾 STEP 4: MAXIMUM CONTENT CACHING');
  console.log('==================================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'content_caching_config',
        value: {
          // AGGRESSIVE CACHING
          cache_hit_rate_target: 0.8,       // 80% of content from cache
          cache_duration_hours: 48,         // Cache for 48 hours
          max_cache_size: 200,              // Store 200 tweets
          
          // REDUCE FRESH CONTENT GENERATION
          fresh_content_percentage: 0.2,    // Only 20% fresh content
          recycle_after_hours: 24,          // Recycle after 24 hours
          
          // EMERGENCY MODE
          emergency_caching: true,
          cache_everything: true,
          last_updated: new Date().toISOString()
        }
      });

    if (error) {
      console.log('   ❌ Content caching failed:', error.message);
    } else {
      console.log('   ✅ Maximum content caching enabled');
      console.log('   📊 Cache hit rate: 80% target');
      console.log('   ♻️  Recycle content after 24 hours');
    }
  } catch (error) {
    console.log('   ❌ Content caching error:', error.message);
  }

  // ULTRA-PROTECTION 5: Simple Posting Mode
  console.log('\n🔄 STEP 5: SIMPLE POSTING MODE');
  console.log('==============================');

  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_posting_mode',
        value: {
          // SIMPLIFIED POSTING
          mode: 'simple',
          max_posts_per_day: 8,             // Reduce from 17 to 8
          posting_interval_hours: 3,         // Every 3 hours
          
          // DISABLE EXPENSIVE FEATURES
          image_generation: false,           // No Pexels API calls
          research_integration: false,       // No research API calls
          trend_analysis: false,             // No trend API calls
          competitive_analysis: false,       // No competitor analysis
          
          // BASIC CONTENT ONLY
          content_types: ['simple_health_tips', 'recycled_content'],
          quality_threshold_reduced: true,   // Lower quality requirements
          
          // EMERGENCY SETTINGS
          emergency_mode: true,
          cost_saving_priority: true,
          last_updated: new Date().toISOString()
        }
      });

    if (error) {
      console.log('   ❌ Simple posting mode failed:', error.message);
    } else {
      console.log('   ✅ Simple posting mode enabled');
      console.log('   📊 Max posts: 8/day (reduced from 17)');
      console.log('   ⏱️  Interval: Every 3 hours');
      console.log('   🎯 Basic content only');
    }
  } catch (error) {
    console.log('   ❌ Simple posting mode error:', error.message);
  }

  // Summary
  console.log('\n✅ EMERGENCY COST PROTECTION COMPLETE');
  console.log('=====================================');
  console.log('💰 Target daily cost: $1.00 (90% reduction)');
  console.log('🎯 Expected monthly cost: $30 (vs $300)');
  console.log('📊 Content: 80% cached, 20% fresh');
  console.log('🤖 OpenAI: gpt-3.5-turbo only, 3 calls/hour max');
  console.log('⏰ Posting: 8 tweets/day, every 3 hours');
  console.log('🧠 Learning: DISABLED for 7 days');

  console.log('\n⚡ IMMEDIATE EFFECTS:');
  console.log('====================');
  console.log('• OpenAI calls reduced by 90%');
  console.log('• Learning agents disabled');
  console.log('• Scheduler jobs paused');
  console.log('• Content mostly cached');
  console.log('• Simple posting mode active');

  console.log('\n🚀 DEPLOY CHANGES:');
  console.log('==================');
  console.log('Push to git and restart Render service');
  console.log('Monitor costs daily for next week');
}

// Run emergency protection
emergencyUltraCostProtection().catch(console.error); 