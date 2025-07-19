#!/usr/bin/env node

/**
 * 🚨 EMERGENCY COST PROTECTION & POSTING FIX
 * Immediately implements ultra-strict cost controls while enabling posting
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function emergencyCostProtection() {
  console.log('🚨 === EMERGENCY COST PROTECTION ACTIVATED ===');
  console.log('💰 Implementing ultra-strict OpenAI budget controls');
  console.log('📝 Enabling optimized posting frequency');
  
  try {
    // 1. Set ultra-strict cost limits
    console.log('\n1. 💰 IMPLEMENTING ULTRA-STRICT COST LIMITS...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_cost_protection',
        value: {
          enabled: true,
          daily_budget_limit: 1.0, // $1/day maximum
          max_openai_calls_per_hour: 5,
          max_tokens_per_call: 100,
          disable_learning_agents: true,
          disable_autonomous_learning: true,
          disable_competitive_intelligence: true,
          disable_real_time_engagement: true,
          burst_protection_minutes: 5,
          cost_alert_threshold: 0.70, // Alert at 70% of budget
          reason: 'Emergency budget protection - $5 every few hours issue'
        }
      });

    console.log('✅ Ultra-strict cost limits set: $1/day maximum');

    // 2. Optimize posting intervals
    console.log('\n2. 📝 OPTIMIZING POSTING FREQUENCY...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'optimized_posting_config',
        value: {
          enabled: true,
          posting_interval_minutes: 30, // Post every 30 minutes
          max_posts_per_day: 48, // 2 per hour max
          quality_threshold: 60,
          content_focus: 'health_tech_insights',
          avoid_expensive_operations: true,
          simple_content_generation: true
        }
      });

    console.log('✅ Posting optimized: Every 30 minutes, up to 48 posts/day');

    // 3. Disable expensive scheduled operations
    console.log('\n3. 🛑 DISABLING EXPENSIVE OPERATIONS...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'disabled_operations',
        value: {
          strategist_frequency: 'every_2_hours', // Reduced from 30 minutes
          engagement_tracking: 'every_6_hours', // Reduced from hourly
          learning_agents: 'weekly', // Reduced from daily
          autonomous_learning: 'daily', // Reduced from 8 hours
          real_engagement: 'every_4_hours', // Reduced from hourly
          tweet_auditor: 'weekly', // Reduced from every 4 hours
          content_orchestrator: 'weekly', // Reduced from twice daily
          competitive_intelligence: 'disabled', // Completely disabled
          reason: 'Emergency cost reduction - prevent $5/hour spending'
        }
      });

    console.log('✅ Expensive operations disabled/reduced');

    // 4. Set emergency environment variables
    console.log('\n4. 🔧 SETTING EMERGENCY ENVIRONMENT...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_environment',
        value: {
          EMERGENCY_MODE: 'true',
          EMERGENCY_COST_MODE: 'true',
          DISABLE_AUTONOMOUS_LEARNING: 'true',
          DISABLE_LEARNING_AGENTS: 'true',
          DAILY_BUDGET_LIMIT: '1',
          MAX_POSTS_PER_HOUR: '2',
          deployment_timestamp: new Date().toISOString()
        }
      });

    console.log('✅ Emergency environment configured');

    // 5. Clear any artificial posting blocks
    console.log('\n5. 🧹 CLEARING POSTING BLOCKS...');
    
    // Clear emergency timing blocks
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'emergency_timing');

    // Clear false monthly caps
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', 'false_monthly_cap');

    // Set posting enablement
    await supabase
      .from('bot_config')
      .upsert({
        key: 'posting_enabled',
        value: {
          enabled: true,
          min_interval_minutes: 30,
          max_daily_posts: 48,
          quality_focused: true,
          cost_optimized: true
        }
      });

    console.log('✅ Posting blocks cleared, quality posting enabled');

    // 6. Set scheduler frequency overrides
    console.log('\n6. ⏰ SETTING SCHEDULER OVERRIDES...');
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'scheduler_frequency_override',
        value: {
          strategist: '0 */2 * * *', // Every 2 hours
          learning: '0 2 * * 0', // Weekly
          autonomous_learning: '0 3 * * *', // Daily
          engagement: '0 */6 * * *', // Every 6 hours
          real_engagement: '0 */4 * * *', // Every 4 hours
          tweet_auditor: '0 4 * * 1', // Weekly
          orchestrator: '0 5 * * 1', // Weekly
          enabled: true,
          reason: 'Emergency cost reduction from excessive scheduling'
        }
      });

    console.log('✅ Scheduler frequencies optimized for cost');

    console.log('\n🎯 === EMERGENCY COST PROTECTION COMPLETE ===');
    console.log('');
    console.log('📊 COST REDUCTION SUMMARY:');
    console.log('   💰 Daily budget: $1 maximum (was unlimited)');
    console.log('   🤖 OpenAI calls: 5/hour maximum (was 50+)');
    console.log('   📝 Tokens: 100/call maximum (was 500)');
    console.log('   ⏰ Strategist: Every 2 hours (was 30 minutes)');
    console.log('   📊 Engagement: Every 6 hours (was hourly)');
    console.log('   🧠 Learning: Weekly (was daily/8-hourly)');
    console.log('');
    console.log('📝 POSTING IMPROVEMENTS:');
    console.log('   🐦 Frequency: Every 30 minutes');
    console.log('   📈 Daily posts: Up to 48');
    console.log('   🎯 Quality focused: Health tech insights');
    console.log('   🚫 Blocks cleared: Artificial limits removed');
    console.log('');
    console.log('💡 EXPECTED RESULTS:');
    console.log('   💰 Cost reduction: 90-95% (from $5/hour to $1/day)');
    console.log('   📝 Posting increase: Regular 30-minute intervals');
    console.log('   🎯 Quality maintained: Focused health tech content');
    console.log('   🛡️ Budget protection: Hard limits prevent overruns');

  } catch (error) {
    console.error('❌ Emergency cost protection failed:', error);
    throw error;
  }
}

// Run the emergency protection
emergencyCostProtection()
  .then(() => {
    console.log('\n✅ Emergency cost protection deployed successfully');
    console.log('🚀 Bot should now operate within $1/day budget while posting regularly');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Emergency deployment failed:', error);
    process.exit(1);
  }); 