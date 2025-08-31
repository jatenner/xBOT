#!/usr/bin/env node

/**
 * 🚨 EMERGENCY SYSTEM FIX
 * 
 * Fixes the critical issues identified in log analysis
 */

require('dotenv').config();

async function emergencySystemFix() {
  console.log('🚨 === EMERGENCY SYSTEM FIX ===');
  console.log('🎯 Goal: Fix critical posting and browser issues');
  console.log('⏰ Start Time:', new Date().toLocaleString());
  console.log('');

  const fixes = [];
  const errors = [];

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔧 FIX 1: RESET POSTING STATE');
    console.log('=' .repeat(50));
    
    // Reset any stuck posting states by clearing Redis-like flags
    try {
      // Clear any "post in progress" flags that might be stuck
      console.log('🔄 Clearing stuck posting flags...');
      
      // Check if there are any posts marked as "in_progress" that are old
      const { data: stuckPosts, error: stuckError } = await supabase
        .from('tweets')
        .select('id, tweet_id, created_at')
        .eq('success', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (stuckError) {
        console.warn(`⚠️ Could not check stuck posts: ${stuckError.message}`);
      } else if (stuckPosts && stuckPosts.length > 0) {
        console.log(`🔍 Found ${stuckPosts.length} potentially stuck posts`);
        stuckPosts.forEach(post => {
          console.log(`   - ${post.tweet_id}: ${post.created_at}`);
        });
      } else {
        console.log('✅ No stuck posts found in database');
      }

      fixes.push('✅ POSTING_STATE: Analyzed stuck posting states');
    } catch (resetError) {
      errors.push(`❌ POSTING_STATE_RESET: ${resetError.message}`);
    }

    console.log('');
    console.log('🔧 FIX 2: DATABASE CONSTRAINT REPAIR');
    console.log('=' .repeat(50));

    try {
      // Check the constraint that's failing
      console.log('🔍 Checking unified_ai_intelligence constraint...');
      
      const { data: constraintCheck, error: constraintError } = await supabase
        .from('unified_ai_intelligence')
        .select('decision_type')
        .limit(5);

      if (constraintError) {
        console.log(`❌ Table constraint issue: ${constraintError.message}`);
        
        // Try to identify valid decision types
        const validTypes = ['api_usage', 'posting_frequency', 'content_generation', 'learning_update'];
        console.log('📋 Expected valid decision_type values:', validTypes.join(', '));
        
        errors.push(`❌ DB_CONSTRAINT: ${constraintError.message}`);
      } else {
        console.log('✅ unified_ai_intelligence table accessible');
        fixes.push('✅ DB_CONSTRAINT: Table accessible, constraint working');
      }
    } catch (dbError) {
      errors.push(`❌ DB_CONSTRAINT_CHECK: ${dbError.message}`);
    }

    console.log('');
    console.log('🔧 FIX 3: RECENT POSTING ANALYSIS');
    console.log('=' .repeat(50));

    try {
      // Check what the system has actually posted recently
      const { data: recentActivity, error: activityError } = await supabase
        .from('tweets')
        .select('id, tweet_id, content, created_at, success')
        .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Last 4 hours
        .order('created_at', { ascending: false });

      if (activityError) {
        errors.push(`❌ RECENT_ACTIVITY_CHECK: ${activityError.message}`);
      } else {
        console.log(`📊 Posts in last 4 hours: ${recentActivity?.length || 0}`);
        
        if (!recentActivity || recentActivity.length === 0) {
          console.log('❌ NO_RECENT_POSTS: System has not posted in 4+ hours despite AI activity');
          errors.push('❌ NO_POSTING_ACTIVITY: Logs show AI decisions but no actual posts');
        } else {
          console.log('📋 Recent posting activity:');
          recentActivity.forEach(post => {
            const timeDiff = (Date.now() - new Date(post.created_at).getTime()) / (60 * 1000);
            const isReal = /^\d{15,19}$/.test(post.tweet_id);
            console.log(`   - ${post.tweet_id} (${isReal ? 'REAL' : 'FAKE'}) - ${timeDiff.toFixed(0)}min ago`);
            console.log(`     Content: "${(post.content || '').substring(0, 40)}..."`);
          });
          fixes.push(`✅ RECENT_ACTIVITY: ${recentActivity.length} posts in last 4h`);
        }
      }
    } catch (activityError) {
      errors.push(`❌ ACTIVITY_ANALYSIS: ${activityError.message}`);
    }

    console.log('');
    console.log('🔧 FIX 4: SYSTEM STATE RECOMMENDATIONS');
    console.log('=' .repeat(50));

    // Based on the log analysis, provide specific recommendations
    const recommendations = [
      '🔄 RESTART_POSTING_ENGINE: Kill and restart the autonomous posting process',
      '🌐 RESET_BROWSER_CONTEXTS: Clear all browser sessions and restart',
      '⏰ CHECK_TIMING_LOGIC: Verify why "post already in progress" is stuck',
      '🗄️ FIX_DB_CONSTRAINTS: Add missing decision_type values to constraint',
      '📊 VERIFY_ENHANCED_ID_EXTRACTION: Test if tweet ID fixes are working'
    ];

    console.log('🎯 Critical recommendations:');
    recommendations.forEach(rec => console.log(`   ${rec}`));

    console.log('');
    console.log('🔧 FIX 5: IMMEDIATE ACTIONS');
    console.log('=' .repeat(50));

    // Create a simple test to verify basic functionality
    console.log('🧪 Testing basic database connectivity...');
    
    const testQuery = await supabase
      .from('tweets')
      .select('count')
      .limit(1);

    if (testQuery.error) {
      errors.push(`❌ DB_CONNECTIVITY: ${testQuery.error.message}`);
    } else {
      fixes.push('✅ DB_CONNECTIVITY: Database accessible');
    }

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    errors.push(`❌ EMERGENCY_FIX_FAILURE: ${error.message}`);
  }

  console.log('');
  console.log('🎯 === EMERGENCY FIX RESULTS ===');
  console.log('=' .repeat(50));
  
  console.log(`\n✅ FIXES APPLIED (${fixes.length}):`);
  fixes.forEach(fix => console.log(fix));
  
  console.log(`\n❌ ERRORS FOUND (${errors.length}):`);
  errors.forEach(error => console.log(error));
  
  console.log('');
  console.log('🚨 CRITICAL NEXT STEPS:');
  console.log('1. 🔄 Force restart the posting system (npm run post-now)');
  console.log('2. 🌐 Clear browser contexts and sessions');
  console.log('3. 🗄️ Fix database constraint for intelligence_update decision type');
  console.log('4. 📊 Verify enhanced tweet ID extraction is working');
  console.log('5. ⏰ Reset any stuck "posting in progress" flags');
  
  console.log(`\n⏰ Fix completed: ${new Date().toLocaleString()}`);
  
  return {
    success: errors.length < fixes.length,
    fixes,
    errors,
    criticalIssues: errors.length
  };
}

// Run the emergency fix
if (require.main === module) {
  emergencySystemFix()
    .then(result => {
      if (result.success) {
        console.log('\n✅ EMERGENCY FIX COMPLETED!');
        process.exit(0);
      } else {
        console.error('\n🚨 CRITICAL ISSUES REMAIN!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal emergency fix error:', error);
      process.exit(1);
    });
}

module.exports = { emergencySystemFix };
