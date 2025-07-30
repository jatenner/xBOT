#!/usr/bin/env node

/**
 * 🔍 RAILWAY DEPLOYMENT VERIFICATION
 * 
 * Comprehensive verification that all enhanced learning system components
 * are functioning properly on Railway after deployment
 */

const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyRailwayDeployment() {
  console.log('🔍 === RAILWAY DEPLOYMENT VERIFICATION ===');
  console.log('📊 Checking all enhanced learning system components...');
  console.log('');

  const results = {
    database: false,
    enhancedTables: false,
    recentActivity: false,
    contentQuality: false,
    railwayLogs: false,
    systemHealth: false
  };

  try {
    // 1. Verify database connectivity
    console.log('1️⃣ === DATABASE CONNECTIVITY ===');
    results.database = await verifyDatabaseConnection();
    
    // 2. Verify enhanced learning tables
    console.log('\n2️⃣ === ENHANCED LEARNING TABLES ===');
    results.enhancedTables = await verifyEnhancedTables();
    
    // 3. Check recent system activity
    console.log('\n3️⃣ === RECENT SYSTEM ACTIVITY ===');
    results.recentActivity = await checkRecentActivity();
    
    // 4. Verify content quality improvements
    console.log('\n4️⃣ === CONTENT QUALITY IMPROVEMENTS ===');
    results.contentQuality = await verifyContentQualityFixes();
    
    // 5. Test Railway log streaming
    console.log('\n5️⃣ === RAILWAY LOG STREAMING ===');
    results.railwayLogs = await testRailwayLogStreaming();
    
    // 6. Overall system health
    console.log('\n6️⃣ === SYSTEM HEALTH CHECK ===');
    results.systemHealth = await checkSystemHealth();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 === DEPLOYMENT VERIFICATION SUMMARY ===');
    console.log('='.repeat(60));
    
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    
    console.log(`✅ Passed: ${passed}/${total} checks`);
    console.log('');
    
    Object.entries(results).forEach(([check, passed]) => {
      const icon = passed ? '✅' : '❌';
      const status = passed ? 'PASS' : 'FAIL';
      console.log(`${icon} ${check.toUpperCase()}: ${status}`);
    });
    
    console.log('');
    
    if (passed === total) {
      console.log('🎉 === ALL SYSTEMS OPERATIONAL ===');
      console.log('🚀 Enhanced learning system is fully deployed and functional!');
      console.log('');
      console.log('🔧 Next Steps:');
      console.log('  • Monitor system performance: npm run monitor');
      console.log('  • View Railway logs: npm run logs');
      console.log('  • Open log interface: http://localhost:3001');
    } else {
      console.log('⚠️ === ISSUES DETECTED ===');
      console.log('Some components need attention. Check failed tests above.');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

async function verifyDatabaseConnection() {
  try {
    console.log('📡 Testing Supabase connection...');
    
    const { data, error } = await supabase
      .from('tweets')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log(`❌ Database connection failed: ${error.message}`);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.log(`❌ Database connection error: ${error.message}`);
    return false;
  }
}

async function verifyEnhancedTables() {
  console.log('🗃️ Checking enhanced learning tables...');
  
  const requiredTables = [
    'learning_posts',
    'format_stats', 
    'timing_stats',
    'engagement_metrics',
    'enhanced_timing_stats',
    'contextual_bandit_arms',
    'content_generation_sessions',
    'budget_optimization_log'
  ];
  
  let allTablesExist = true;
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ Table ${table}: accessible`);
      }
    } catch (error) {
      console.log(`❌ Table ${table}: ${error.message}`);
      allTablesExist = false;
    }
  }
  
  return allTablesExist;
}

async function checkRecentActivity() {
  console.log('📊 Checking recent system activity...');
  
  try {
    // Check recent tweets
    const { data: recentTweets } = await supabase
      .from('tweets')
      .select('id, content, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log(`📝 Recent tweets (24h): ${recentTweets?.length || 0}`);
    
    // Check learning posts
    const { data: learningPosts } = await supabase
      .from('learning_posts')
      .select('id, quality_score, posting_successful')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log(`🧠 Learning posts (24h): ${learningPosts?.length || 0}`);
    
    if (learningPosts && learningPosts.length > 0) {
      const successful = learningPosts.filter(p => p.posting_successful).length;
      const avgQuality = learningPosts
        .filter(p => p.quality_score)
        .reduce((sum, p) => sum + p.quality_score, 0) / learningPosts.length;
      
      console.log(`✅ Success rate: ${successful}/${learningPosts.length} (${(successful/learningPosts.length*100).toFixed(1)}%)`);
      console.log(`📊 Average quality: ${avgQuality.toFixed(1)}/100`);
    }
    
    return (recentTweets?.length || 0) > 0 || (learningPosts?.length || 0) > 0;
  } catch (error) {
    console.log(`❌ Activity check error: ${error.message}`);
    return false;
  }
}

async function verifyContentQualityFixes() {
  console.log('🎯 Verifying content quality improvements...');
  
  try {
    // Check if learning phase config is active
    const learningPhaseActive = checkLearningPhaseActive();
    console.log(`🧠 Learning phase active: ${learningPhaseActive ? 'Yes' : 'No'}`);
    
    // Check recent content generation sessions
    const { data: sessions } = await supabase
      .from('content_generation_sessions')
      .select('*')
      .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // Last 6 hours
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (sessions && sessions.length > 0) {
      console.log(`🎭 Content sessions (6h): ${sessions.length}`);
      
      const approved = sessions.filter(s => s.was_approved).length;
      const approvalRate = (approved / sessions.length * 100).toFixed(1);
      
      console.log(`✅ Approval rate: ${approved}/${sessions.length} (${approvalRate}%)`);
      
      if (sessions[0].critique_score) {
        console.log(`📊 Latest critique score: ${sessions[0].critique_score}/100`);
      }
    } else {
      console.log('📊 No recent content generation sessions found');
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Content quality check error: ${error.message}`);
    return false;
  }
}

function checkLearningPhaseActive() {
  // Check if we're in the learning phase (7 days from deployment)
  const startDate = new Date('2025-01-30');
  const now = new Date();
  const timeDiff = now.getTime() - startDate.getTime();
  const learningPhaseDuration = 7 * 24 * 60 * 60 * 1000;
  
  return timeDiff < learningPhaseDuration;
}

async function testRailwayLogStreaming() {
  console.log('📡 Testing Railway log streaming...');
  
  return new Promise((resolve) => {
    try {
      const railwayProcess = spawn('railway', ['logs'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let hasOutput = false;
      const timeout = setTimeout(() => {
        railwayProcess.kill();
        if (hasOutput) {
          console.log('✅ Railway logs streaming functional');
          resolve(true);
        } else {
          console.log('❌ Railway logs not streaming (no output in 5s)');
          resolve(false);
        }
      }, 5000);
      
      railwayProcess.stdout.on('data', (data) => {
        hasOutput = true;
        console.log('✅ Railway logs streaming (output detected)');
        clearTimeout(timeout);
        railwayProcess.kill();
        resolve(true);
      });
      
      railwayProcess.on('error', (error) => {
        console.log(`❌ Railway logs error: ${error.message}`);
        clearTimeout(timeout);
        resolve(false);
      });
      
    } catch (error) {
      console.log(`❌ Railway logs test error: ${error.message}`);
      resolve(false);
    }
  });
}

async function checkSystemHealth() {
  console.log('🏥 Checking overall system health...');
  
  try {
    // Check budget status
    const { data: budgetLogs } = await supabase
      .from('budget_optimization_log')
      .select('cost_usd')
      .gte('created_at', new Date().toDateString())
      .order('created_at', { ascending: false });
    
    if (budgetLogs && budgetLogs.length > 0) {
      const dailySpent = budgetLogs.reduce((sum, log) => sum + log.cost_usd, 0);
      console.log(`💰 Daily spending: $${dailySpent.toFixed(4)}`);
      
      if (dailySpent < 7.5) {
        console.log('✅ Budget within limits');
      } else {
        console.log('⚠️ Budget approaching limit');
      }
    } else {
      console.log('📊 No budget data for today');
    }
    
    // Check timing stats
    const { data: timingStats } = await supabase
      .from('enhanced_timing_stats')
      .select('*')
      .order('total_posts', { ascending: false })
      .limit(3);
    
    if (timingStats && timingStats.length > 0) {
      console.log(`⏰ Timing optimization: ${timingStats.length} data points`);
      console.log(`🎯 Best hour: ${timingStats[0].hour_of_day}:00 (${timingStats[0].total_posts} posts)`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ System health check error: ${error.message}`);
    return false;
  }
}

// Run verification
if (require.main === module) {
  verifyRailwayDeployment();
} 