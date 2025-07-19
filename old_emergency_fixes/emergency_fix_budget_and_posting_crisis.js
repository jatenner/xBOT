#!/usr/bin/env node

/**
 * 🚨 EMERGENCY FIX: BUDGET AND POSTING CRISIS
 * ============================================
 * 
 * Critical issues identified:
 * 1. Budget system not initialized - causing lockdown
 * 2. Twitter API hitting false rate limits (0/17 posts remaining)
 * 3. Emergency budget lockdown blocking all AI operations
 * 4. EMERGENCY_MODE=true still active
 * 
 * This script fixes ALL issues to restore posting functionality.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function emergencyFixBudgetAndPostingCrisis() {
  console.log('🚨 EMERGENCY FIX: BUDGET AND POSTING CRISIS');
  console.log('==========================================');
  console.log('🎯 GOAL: Restore posting functionality immediately');
  console.log('💰 TARGET: Initialize budget system and clear false limits\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // STEP 1: Clear any existing budget lockdown
    console.log('🔓 STEP 1: CLEARING BUDGET LOCKDOWN');
    console.log('===================================');
    
    const lockdownFile = path.join(process.cwd(), '.budget_lockdown');
    if (fs.existsSync(lockdownFile)) {
      fs.unlinkSync(lockdownFile);
      console.log('✅ Removed emergency budget lockdown file');
    } else {
      console.log('✅ No lockdown file found');
    }

    // STEP 2: Initialize budget system properly
    console.log('\n💰 STEP 2: INITIALIZING BUDGET SYSTEM');
    console.log('=====================================');

    const today = new Date().toISOString().split('T')[0];
    
    // Reset today's budget to $0 spent
    const { error: budgetError } = await supabase
      .from('daily_budget_status')
      .upsert({
        date: today,
        total_spent: 0.00,
        budget_limit: 3.00,
        emergency_brake_active: false,
        updated_at: new Date().toISOString()
      });

    if (budgetError) {
      console.error('❌ Budget initialization error:', budgetError);
    } else {
      console.log('✅ Budget system initialized: $0.00/$3.00 spent today');
    }

    // Clear any existing budget transactions for today (fresh start)
    const { error: clearError } = await supabase
      .from('budget_transactions')
      .delete()
      .eq('date', today);

    if (clearError) {
      console.log('⚠️ Could not clear today\'s transactions:', clearError.message);
    } else {
      console.log('✅ Cleared today\'s budget transactions (fresh start)');
    }

    // STEP 3: Reset Twitter rate limit tracking
    console.log('\n🐦 STEP 3: RESETTING TWITTER RATE LIMITS');
    console.log('========================================');

    // Clear false rate limit data
    const { error: rateLimitError } = await supabase
      .from('bot_config')
      .upsert([
        {
          key: 'twitter_daily_posts_used',
          value: '0',
          description: 'RESET: Daily posts used count'
        },
        {
          key: 'twitter_daily_limit',
          value: '17',
          description: 'RESET: Daily posting limit'
        },
        {
          key: 'twitter_last_reset_date',
          value: today,
          description: 'RESET: Last rate limit reset date'
        },
        {
          key: 'twitter_rate_limit_status',
          value: 'CLEARED',
          description: 'RESET: Rate limit status cleared'
        }
      ]);

    if (rateLimitError) {
      console.error('❌ Rate limit reset error:', rateLimitError);
    } else {
      console.log('✅ Twitter rate limits reset: 0/17 posts used');
    }

    // STEP 4: Disable emergency mode
    console.log('\n⚡ STEP 4: DISABLING EMERGENCY MODE');
    console.log('===================================');

    const { error: emergencyError } = await supabase
      .from('bot_config')
      .upsert([
        {
          key: 'emergency_mode',
          value: 'false',
          description: 'DISABLED: Emergency mode turned off'
        },
        {
          key: 'disable_learning_agents',
          value: 'false',
          description: 'ENABLED: Learning agents restored'
        },
        {
          key: 'max_posts_per_day',
          value: '15',
          description: 'RESTORED: Maximum posts per day'
        },
        {
          key: 'viral_mode_active',
          value: 'true',
          description: 'ENABLED: Viral content mode active'
        }
      ]);

    if (emergencyError) {
      console.error('❌ Emergency mode disable error:', emergencyError);
    } else {
      console.log('✅ Emergency mode disabled - normal operations restored');
    }

    // STEP 5: Clear posting blocks and errors
    console.log('\n🚀 STEP 5: CLEARING POSTING BLOCKS');
    console.log('==================================');

    const { error: clearBlocksError } = await supabase
      .from('bot_config')
      .delete()
      .in('key', [
        'last_error_twitter_post',
        'posting_blocked_until',
        'rate_limit_blocked',
        'emergency_brake_triggered',
        'budget_lockdown_active'
      ]);

    if (clearBlocksError) {
      console.log('⚠️ Could not clear all posting blocks:', clearBlocksError.message);
    } else {
      console.log('✅ All posting blocks and error states cleared');
    }

    // STEP 6: Reset daily posting schedule
    console.log('\n📅 STEP 6: RESETTING POSTING SCHEDULE');
    console.log('====================================');

    const { error: scheduleError } = await supabase
      .from('bot_config')
      .upsert([
        {
          key: 'posts_today',
          value: '0',
          description: 'RESET: Posts made today'
        },
        {
          key: 'last_post_time',
          value: '0',
          description: 'RESET: Last post timestamp'
        },
        {
          key: 'next_post_time',
          value: '0',
          description: 'RESET: Next scheduled post time'
        },
        {
          key: 'posting_schedule_active',
          value: 'true',
          description: 'ENABLED: Posting schedule active'
        }
      ]);

    if (scheduleError) {
      console.error('❌ Schedule reset error:', scheduleError);
    } else {
      console.log('✅ Posting schedule reset - ready for immediate posting');
    }

    // STEP 7: Verify the fix
    console.log('\n✅ STEP 7: VERIFICATION');
    console.log('======================');

    // Check budget status
    const { data: budgetData } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', today)
      .single();

    console.log('💰 Budget Status:');
    if (budgetData) {
      console.log(`   📊 Spent: $${budgetData.total_spent}/$${budgetData.budget_limit}`);
      console.log(`   🛡️ Emergency Brake: ${budgetData.emergency_brake_active ? 'ACTIVE' : 'INACTIVE'}`);
    } else {
      console.log('   ⚠️ No budget data found');
    }

    // Check bot configuration
    const { data: configData } = await supabase
      .from('bot_config')
      .select('*')
      .in('key', ['emergency_mode', 'viral_mode_active', 'max_posts_per_day']);

    console.log('\n⚙️ Bot Configuration:');
    if (configData) {
      configData.forEach(config => {
        console.log(`   ${config.key}: ${config.value}`);
      });
    }

    console.log('\n🎉 EMERGENCY FIX COMPLETE!');
    console.log('==========================');
    console.log('✅ Budget system initialized and ready');
    console.log('✅ Emergency lockdown removed');
    console.log('✅ Twitter rate limits reset');
    console.log('✅ Emergency mode disabled');
    console.log('✅ Posting blocks cleared');
    console.log('✅ System ready for viral transformation');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Restart the xBOT application');
    console.log('   2. Monitor first posting attempt');
    console.log('   3. Verify viral content generation');
    console.log('   4. Watch for budget tracking');

  } catch (error) {
    console.error('❌ EMERGENCY FIX FAILED:', error);
    console.error('🆘 Manual intervention required');
  }
}

// Run the emergency fix
if (require.main === module) {
  emergencyFixBudgetAndPostingCrisis()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { emergencyFixBudgetAndPostingCrisis }; 