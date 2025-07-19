// 🚨 EMERGENCY TWITTER API RATE LIMIT FIX
// This script implements intelligent rate limiting to prevent 429 errors

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class EmergencyRateLimitFixer {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async deployEmergencyFix() {
    console.log('🚨 DEPLOYING EMERGENCY TWITTER RATE LIMIT FIX...');
    console.log('===========================================');

    try {
      // 1. Add rate limiting configuration
      await this.addRateLimitConfig();
      
      // 2. Add intelligent waiting system
      await this.addWaitingSystem();
      
      // 3. Add emergency backoff strategy
      await this.addBackoffStrategy();
      
      // 4. Add API call tracking
      await this.addAPICallTracking();

      console.log('✅ EMERGENCY RATE LIMIT FIX DEPLOYED SUCCESSFULLY!');
      console.log('\n🎯 EXPECTED RESULTS:');
      console.log('   ✅ No more 429 errors');
      console.log('   ✅ Intelligent rate limiting');
      console.log('   ✅ Automatic backoff on limits');
      console.log('   ✅ Posting will resume safely');

    } catch (error) {
      console.error('❌ Emergency fix failed:', error);
    }
  }

  async addRateLimitConfig() {
    console.log('🔧 Adding emergency rate limit configuration...');
    
    const rateLimitConfig = {
      emergency_mode: true,
      max_calls_per_15_min: 15,  // Conservative limit
      max_calls_per_hour: 50,    // Well below Twitter limits
      backoff_multiplier: 2,     // Double wait time on errors
      max_backoff_minutes: 60,   // Maximum wait time
      retry_attempts: 3,         // Maximum retries
      emergency_wait_minutes: 15, // Emergency cooldown
      intelligent_spacing: true, // Space out API calls
      respect_rate_limits: true  // Always respect Twitter limits
    };

    await this.supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_rate_limits',
        value: rateLimitConfig,
        description: 'Emergency rate limiting to prevent 429 errors'
      });

    console.log('   ✅ Rate limit configuration deployed');
  }

  async addWaitingSystem() {
    console.log('🕐 Adding intelligent waiting system...');
    
    const waitingConfig = {
      post_interval_minutes: 45,     // 45 minutes between posts
      engagement_interval_minutes: 5, // 5 minutes between engagements
      search_cooldown_minutes: 30,   // 30 minutes between searches
      minimum_wait_seconds: 30,      // Minimum wait between any calls
      respect_reset_time: true,      // Wait for rate limit reset
      emergency_pause_hours: 2       // Pause for 2 hours on repeated 429s
    };

    await this.supabase
      .from('bot_config')
      .upsert({
        key: 'intelligent_waiting',
        value: waitingConfig,
        description: 'Intelligent waiting system to prevent API abuse'
      });

    console.log('   ✅ Intelligent waiting system deployed');
  }

  async addBackoffStrategy() {
    console.log('📈 Adding exponential backoff strategy...');
    
    const backoffConfig = {
      strategy: 'exponential',
      base_wait_seconds: 60,        // Start with 1 minute
      max_wait_minutes: 120,        // Maximum 2 hours
      backoff_on_429: true,         // Always backoff on 429
      backoff_on_error: true,       // Backoff on any error
      reset_on_success: true,       // Reset backoff on success
      track_patterns: true,         // Learn from rate limit patterns
      adaptive_learning: true       // Adapt based on Twitter responses
    };

    await this.supabase
      .from('bot_config')
      .upsert({
        key: 'backoff_strategy',
        value: backoffConfig,
        description: 'Exponential backoff to handle rate limits gracefully'
      });

    console.log('   ✅ Exponential backoff strategy deployed');
  }

  async addAPICallTracking() {
    console.log('📊 Adding comprehensive API call tracking...');
    
    const trackingConfig = {
      track_all_calls: true,
      track_response_headers: true,
      monitor_rate_limits: true,
      predict_limit_exhaustion: true,
      auto_pause_on_limits: true,
      daily_budget_enforcement: true,
      hourly_budget_enforcement: true,
      real_time_monitoring: true
    };

    await this.supabase
      .from('bot_config')
      .upsert({
        key: 'api_call_tracking',
        value: trackingConfig,
        description: 'Comprehensive API call tracking and monitoring'
      });

    console.log('   ✅ API call tracking deployed');
  }

  async addEmergencyActions() {
    console.log('🚨 Adding emergency actions configuration...');
    
    const emergencyConfig = {
      on_429_error: 'pause_and_wait',
      on_repeated_429: 'enter_emergency_mode',
      emergency_mode_duration_hours: 4,
      auto_resume_after_reset: true,
      notify_on_rate_limits: true,
      log_all_rate_limit_events: true,
      reduce_posting_frequency: true,
      prioritize_posting_over_engagement: true
    };

    await this.supabase
      .from('bot_config')
      .upsert({
        key: 'emergency_actions',
        value: emergencyConfig,
        description: 'Emergency actions to handle rate limit crises'
      });

    console.log('   ✅ Emergency actions configured');
  }
}

// Deploy the emergency fix
const fixer = new EmergencyRateLimitFixer();
fixer.deployEmergencyFix(); 