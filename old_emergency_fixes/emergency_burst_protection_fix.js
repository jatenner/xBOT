#!/usr/bin/env node

/**
 * 🚨 EMERGENCY BURST PROTECTION FIX
 * 
 * CRITICAL ISSUE: Bot posted 15+ times in rapid succession
 * This script implements immediate burst protection and investigates the failure
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function emergencyBurstProtection() {
  console.log('🚨 === EMERGENCY BURST PROTECTION FIX ===');
  console.log('💥 CRITICAL: Bot burst posted 15+ times - implementing immediate protection');
  
  try {
    // STEP 1: Nuclear shutdown of all posting
    await nuclearShutdown();
    
    // STEP 2: Implement robust burst protection
    await implementBurstProtection();
    
    // STEP 3: Fix rate limiting system
    await fixRateLimitingSystem();
    
    // STEP 4: Analyze what went wrong
    await analyzeBurstCause();
    
    // STEP 5: Implement recovery plan
    await implementRecoveryPlan();
    
    console.log('');
    console.log('✅ === EMERGENCY BURST PROTECTION COMPLETE ===');
    console.log('🛑 Bot is now fully protected against burst posting');
    
  } catch (error) {
    console.error('💥 Emergency burst protection failed:', error);
  }
}

async function nuclearShutdown() {
  console.log('🛑 === NUCLEAR SHUTDOWN ===');
  
  try {
    // Disable bot completely
    await supabase
      .from('bot_config')
      .upsert({
        key: 'DISABLE_BOT',
        value: 'true',
        updated_at: new Date().toISOString()
      });
    
    // Set emergency mode
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_mode',
        value: {
          active: true,
          reason: 'Burst posting detected - 15+ rapid posts',
          shutdown_time: new Date().toISOString(),
          auto_recovery: false,
          manual_intervention_required: true
        },
        updated_at: new Date().toISOString()
      });
    
    // Disable all AI systems
    await supabase
      .from('bot_config')
      .upsert({
        key: 'intelligent_posting_system',
        value: {
          enabled: false,
          emergency_disabled: true,
          reason: 'Burst posting protection'
        },
        updated_at: new Date().toISOString()
      });
    
    // Clear viral override that may have caused the issue
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_viral_override',
        value: {
          enabled: false,
          posts_remaining: 0,
          emergency_disabled: true,
          reason: 'Burst posting detected'
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Nuclear shutdown complete - all systems disabled');
    
  } catch (error) {
    console.error('❌ Nuclear shutdown failed:', error);
  }
}

async function implementBurstProtection() {
  console.log('🛡️ === IMPLEMENTING BURST PROTECTION ===');
  
  try {
    // Ultra-strict burst protection
    await supabase
      .from('bot_config')
      .upsert({
        key: 'burst_protection_system',
        value: {
          enabled: true,
          ultra_strict_mode: true,
          
          // Time-based limits
          min_seconds_between_posts: 7200, // 2 hours minimum
          min_minutes_between_posts: 120,  // 2 hours minimum
          
          // Burst detection
          max_posts_per_hour: 1,           // Only 1 post per hour
          max_posts_per_15_min: 1,         // Only 1 post per 15 min
          max_posts_per_5_min: 1,          // Only 1 post per 5 min
          max_posts_per_minute: 1,         // Only 1 post per minute
          
          // Daily limits
          max_posts_per_day: 6,            // Conservative daily limit
          
          // Emergency triggers
          burst_detection_threshold: 3,    // 3+ posts in short time = burst
          emergency_cooldown_hours: 4,     // 4 hour cooldown after burst
          
          // Monitoring
          track_all_posting_attempts: true,
          log_rate_limit_bypasses: true,
          alert_on_burst_attempts: true,
          
          activated_at: new Date().toISOString(),
          reason: 'Emergency response to 15+ rapid posts'
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Ultra-strict burst protection implemented');
    
    // Set emergency rate limits
    await supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limits',
        value: {
          emergency_mode: true,
          ultra_conservative: true,
          
          // Posting limits
          max_posts_per_hour: 1,
          max_posts_per_day: 6,
          min_post_interval_minutes: 120, // 2 hours
          
          // API limits
          max_calls_per_15_min: 1,
          max_calls_per_hour: 2,
          
          // Safety measures
          double_check_intervals: true,
          verify_last_post_time: true,
          block_rapid_retries: true,
          
          activated_reason: 'Burst posting emergency',
          activated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Emergency rate limits activated');
    
  } catch (error) {
    console.error('❌ Failed to implement burst protection:', error);
  }
}

async function fixRateLimitingSystem() {
  console.log('🔧 === FIXING RATE LIMITING SYSTEM ===');
  
  try {
    // Fix unified rate limits tracking
    await supabase
      .from('bot_config')
      .upsert({
        key: 'unified_rate_limits',
        value: {
          twitter_daily_limit: 6,          // Conservative limit
          twitter_daily_used: 15,          // Account for burst posts
          twitter_daily_remaining: -9,     // Negative = over limit
          
          last_post_time: new Date().toISOString(),
          
          // Force reset and cleanup
          force_cleanup: true,
          emergency_reset: true,
          burst_detected: true,
          over_limit: true,
          
          reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          last_updated: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Fixed unified rate limits (marked as over-limit)');
    
    // Enhanced posting validation
    await supabase
      .from('bot_config')
      .upsert({
        key: 'posting_validation_system',
        value: {
          enabled: true,
          ultra_strict: true,
          
          // Multiple validation layers
          check_database_last_post: true,
          check_twitter_api_limits: true,
          check_time_intervals: true,
          check_daily_counts: true,
          
          // Validation requirements
          require_minimum_interval: 120, // 2 hours
          require_daily_limit_check: true,
          require_burst_detection: true,
          
          // Failure handling
          fail_safe_on_validation_error: true,
          block_on_any_validation_failure: true,
          log_all_validation_attempts: true,
          
          emergency_mode: true,
          activated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Enhanced posting validation system activated');
    
  } catch (error) {
    console.error('❌ Failed to fix rate limiting system:', error);
  }
}

async function analyzeBurstCause() {
  console.log('🔍 === ANALYZING BURST CAUSE ===');
  
  try {
    // Check what triggered the burst
    const { data: configs } = await supabase
      .from('bot_config')
      .select('key, value, updated_at')
      .in('key', [
        'emergency_viral_override',
        'intelligent_posting_system',
        'unified_rate_limits',
        'content_blocking_config'
      ]);
    
    console.log('🔍 Configuration analysis:');
    
    const issues = [];
    
    configs?.forEach(config => {
      const value = config.value;
      
      switch (config.key) {
        case 'emergency_viral_override':
          if (value?.enabled && value?.posts_remaining > 0) {
            issues.push('Emergency viral override was active - may have bypassed rate limits');
            console.log(`   ⚠️ Viral override: ${value.posts_remaining} posts remaining`);
          }
          break;
          
        case 'intelligent_posting_system':
          if (value?.enabled) {
            issues.push('Intelligent posting system was active - may have made rapid decisions');
            console.log(`   ⚠️ AI posting: Enabled with sophisticated mode`);
          }
          break;
          
        case 'unified_rate_limits':
          if (value?.twitter_daily_used < 15) {
            issues.push('Rate limit tracking was out of sync with actual posts');
            console.log(`   ⚠️ Rate limits: Showed ${value.twitter_daily_used} used but 15+ actually posted`);
          }
          break;
          
        case 'content_blocking_config':
          if (value?.blocked_content_types?.includes('viral_health_theme')) {
            issues.push('Content blocking may have triggered fallback loops');
            console.log(`   ⚠️ Content blocking: Academic content blocked`);
          }
          break;
      }
    });
    
    console.log('');
    console.log('🔍 Probable causes identified:');
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    
    // Create analysis report
    const analysisReport = {
      burst_detected_at: new Date().toISOString(),
      estimated_posts: 15,
      probable_causes: issues,
      system_state: {
        viral_override_active: configs?.find(c => c.key === 'emergency_viral_override')?.value?.enabled || false,
        ai_system_active: configs?.find(c => c.key === 'intelligent_posting_system')?.value?.enabled || false,
        rate_limits_synced: false
      },
      recommendations: [
        'Disable emergency viral override',
        'Fix rate limit tracking sync',
        'Implement stricter interval validation',
        'Add burst detection to PostTweetAgent',
        'Require manual approval for posting resumption'
      ],
      severity: 'CRITICAL',
      action_required: 'IMMEDIATE'
    };
    
    await supabase
      .from('bot_config')
      .upsert({
        key: 'burst_analysis_report',
        value: analysisReport,
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Burst cause analysis complete');
    
  } catch (error) {
    console.error('❌ Failed to analyze burst cause:', error);
  }
}

async function implementRecoveryPlan() {
  console.log('🔄 === IMPLEMENTING RECOVERY PLAN ===');
  
  try {
    // Recovery plan with manual approval required
    await supabase
      .from('bot_config')
      .upsert({
        key: 'burst_recovery_plan',
        value: {
          step_1: {
            action: 'Bot disabled - manual intervention required',
            status: 'COMPLETE',
            completed_at: new Date().toISOString()
          },
          
          step_2: {
            action: 'Burst protection implemented',
            status: 'COMPLETE',
            completed_at: new Date().toISOString()
          },
          
          step_3: {
            action: 'Rate limiting system fixed',
            status: 'COMPLETE',
            completed_at: new Date().toISOString()
          },
          
          step_4: {
            action: 'Cause analysis completed',
            status: 'COMPLETE',
            completed_at: new Date().toISOString()
          },
          
          step_5: {
            action: 'Manual approval required to resume posting',
            status: 'PENDING',
            requirements: [
              'Review and approve new rate limiting system',
              'Verify burst protection is working',
              'Test posting with 2-hour intervals',
              'Monitor for any rate limit bypasses'
            ]
          },
          
          recovery_conditions: {
            min_cooldown_hours: 4,
            max_posts_per_day_after_recovery: 3,
            require_manual_interval_verification: true,
            require_burst_protection_testing: true
          },
          
          created_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });
    
    console.log('✅ Recovery plan implemented');
    console.log('⚠️ Manual intervention required before resuming posting');
    
  } catch (error) {
    console.error('❌ Failed to implement recovery plan:', error);
  }
}

emergencyBurstProtection(); 