#!/usr/bin/env node

/**
 * 📊 ENHANCED SYSTEM MONITOR
 * 
 * Monitors the enhanced learning system performance and provides real-time insights
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function monitorEnhancedSystem() {
  console.log('📊 === ENHANCED LEARNING SYSTEM MONITOR ===');
  console.log('🔍 Checking system performance and content quality...');
  console.log('');

  try {
    // Check recent posts and their quality scores
    await checkRecentPosts();
    
    // Check timing optimization data
    await checkTimingOptimization();
    
    // Check bandit performance
    await checkBanditPerformance();
    
    // Check budget utilization
    await checkBudgetStatus();
    
    // Check engagement actions
    await checkEngagementActions();

    console.log('');
    console.log('✅ Enhanced system monitoring complete');
    console.log('🔄 Run this script periodically to track system learning progress');

  } catch (error) {
    console.error('❌ Monitoring failed:', error);
    process.exit(1);
  }
}

async function checkRecentPosts() {
  console.log('📝 === RECENT POSTS ANALYSIS ===');
  
  try {
    // Check learning_posts table
    const { data: recentPosts, error } = await supabase
      .from('learning_posts')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log('⚠️ Could not fetch learning_posts:', error.message);
      return;
    }

    if (recentPosts && recentPosts.length > 0) {
      console.log(`📊 Posts in last 24h: ${recentPosts.length}`);
      
      const successfulPosts = recentPosts.filter(p => p.posting_successful);
      const avgQualityScore = recentPosts
        .filter(p => p.quality_score)
        .reduce((sum, p) => sum + p.quality_score, 0) / recentPosts.length;

      console.log(`✅ Successful posts: ${successfulPosts.length}/${recentPosts.length} (${(successfulPosts.length/recentPosts.length*100).toFixed(1)}%)`);
      console.log(`🎯 Average quality score: ${avgQualityScore.toFixed(1)}/100`);
      
      // Show recent post samples
      console.log('\n📄 Recent post samples:');
      recentPosts.slice(0, 3).forEach((post, i) => {
        console.log(`   ${i+1}. ${post.content?.substring(0, 80)}... (Quality: ${post.quality_score || 'N/A'})`);
      });
    } else {
      console.log('📊 No recent posts found in learning_posts table');
    }

    // Also check content_generation_sessions
    const { data: sessions } = await supabase
      .from('content_generation_sessions')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (sessions && sessions.length > 0) {
      console.log(`\n🎭 Content generation sessions: ${sessions.length}`);
      const approvedSessions = sessions.filter(s => s.was_approved);
      console.log(`✅ Approval rate: ${(approvedSessions.length/sessions.length*100).toFixed(1)}%`);
      
      const avgCritique = sessions
        .filter(s => s.critique_score)
        .reduce((sum, s) => sum + s.critique_score, 0) / sessions.length;
      console.log(`📊 Average critique score: ${avgCritique.toFixed(1)}/100`);
    }

  } catch (error) {
    console.log('⚠️ Error checking recent posts:', error.message);
  }
}

async function checkTimingOptimization() {
  console.log('\n⏰ === TIMING OPTIMIZATION STATUS ===');
  
  try {
    const { data: timingStats } = await supabase
      .from('enhanced_timing_stats')
      .select('*')
      .order('avg_engagement_rate', { ascending: false })
      .limit(5);

    if (timingStats && timingStats.length > 0) {
      console.log(`📊 Timing data points: ${timingStats.length}`);
      console.log('\n🏆 Top performing hours:');
      
      timingStats.forEach((stat, i) => {
        console.log(`   ${i+1}. Hour ${stat.hour_of_day} (Day ${stat.day_of_week}): ${(stat.avg_engagement_rate * 100).toFixed(2)}% engagement (${stat.total_posts} posts, ${(stat.confidence_score * 100).toFixed(0)}% confidence)`);
      });
    } else {
      console.log('📊 No timing optimization data yet - system is still learning');
    }
  } catch (error) {
    console.log('⚠️ Error checking timing data:', error.message);
  }
}

async function checkBanditPerformance() {
  console.log('\n🎰 === BANDIT ALGORITHM STATUS ===');
  
  try {
    const { data: arms } = await supabase
      .from('contextual_bandit_arms')
      .select('*')
      .order('avg_reward', { ascending: false })
      .limit(5);

    if (arms && arms.length > 0) {
      console.log(`🎯 Active bandit arms: ${arms.length}`);
      console.log('\n🏆 Top performing formats:');
      
      arms.forEach((arm, i) => {
        console.log(`   ${i+1}. ${arm.arm_name}: ${arm.avg_reward.toFixed(3)} avg reward (${arm.total_selections} selections, ${(arm.confidence_score * 100).toFixed(0)}% confidence)`);
      });

      // Check exploration vs exploitation balance
      const totalSelections = arms.reduce((sum, arm) => sum + arm.total_selections, 0);
      const explorationArms = arms.filter(arm => arm.total_selections < 10).length;
      const explorationRate = explorationArms / arms.length;

      console.log(`\n📊 Exploration rate: ${(explorationRate * 100).toFixed(1)}% (${explorationArms}/${arms.length} arms under-explored)`);
      console.log(`🔄 Total selections: ${totalSelections}`);
    } else {
      console.log('🎰 No bandit arms found - system may not be initialized yet');
    }

    // Check bandit history
    const { data: history } = await supabase
      .from('contextual_bandit_history')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (history && history.length > 0) {
      console.log(`\n📈 Recent bandit decisions: ${history.length}`);
      const avgReward = history.reduce((sum, h) => sum + (h.actual_reward || 0), 0) / history.length;
      console.log(`🎯 Average reward: ${avgReward.toFixed(3)}`);
    }

  } catch (error) {
    console.log('⚠️ Error checking bandit performance:', error.message);
  }
}

async function checkBudgetStatus() {
  console.log('\n💰 === BUDGET OPTIMIZATION STATUS ===');
  
  try {
    const { data: budgetLogs } = await supabase
      .from('budget_optimization_log')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (budgetLogs && budgetLogs.length > 0) {
      console.log(`💵 Budget operations (24h): ${budgetLogs.length}`);
      
      const totalCost = budgetLogs.reduce((sum, log) => sum + log.cost_usd, 0);
      const avgROI = budgetLogs
        .filter(log => log.roi_ratio)
        .reduce((sum, log) => sum + log.roi_ratio, 0) / budgetLogs.length;

      console.log(`💸 Total cost: $${totalCost.toFixed(4)}`);
      console.log(`📊 Average ROI: ${avgROI.toFixed(2)}x`);

      // Break down by operation type
      const operationTypes = [...new Set(budgetLogs.map(log => log.operation_type))];
      console.log('\n📋 Operations breakdown:');
      operationTypes.forEach(type => {
        const ops = budgetLogs.filter(log => log.operation_type === type);
        const cost = ops.reduce((sum, op) => sum + op.cost_usd, 0);
        console.log(`   ${type}: ${ops.length} ops, $${cost.toFixed(4)}`);
      });
    } else {
      console.log('💰 No budget operations logged yet');
    }
  } catch (error) {
    console.log('⚠️ Error checking budget status:', error.message);
  }
}

async function checkEngagementActions() {
  console.log('\n🤝 === ENGAGEMENT INTELLIGENCE STATUS ===');
  
  try {
    const { data: actions } = await supabase
      .from('intelligent_engagement_actions')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (actions && actions.length > 0) {
      console.log(`🎯 Engagement actions (24h): ${actions.length}`);
      
      const successfulActions = actions.filter(a => a.action_successful);
      const avgValue = actions
        .filter(a => a.engagement_value)
        .reduce((sum, a) => sum + a.engagement_value, 0) / actions.length;

      console.log(`✅ Success rate: ${(successfulActions.length/actions.length*100).toFixed(1)}%`);
      console.log(`📊 Average engagement value: ${avgValue.toFixed(2)}`);

      // Break down by action type
      const actionTypes = [...new Set(actions.map(a => a.action_type))];
      console.log('\n📋 Actions breakdown:');
      actionTypes.forEach(type => {
        const typeActions = actions.filter(a => a.action_type === type);
        console.log(`   ${type}: ${typeActions.length} actions`);
      });

      // Top targets
      const targets = {};
      actions.forEach(action => {
        if (!targets[action.target_username]) {
          targets[action.target_username] = 0;
        }
        targets[action.target_username]++;
      });

      const topTargets = Object.entries(targets)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      if (topTargets.length > 0) {
        console.log('\n🎯 Top engagement targets:');
        topTargets.forEach(([username, count], i) => {
          console.log(`   ${i+1}. @${username}: ${count} actions`);
        });
      }
    } else {
      console.log('🤝 No engagement actions logged yet');
    }
  } catch (error) {
    console.log('⚠️ Error checking engagement actions:', error.message);
  }
}

// Run monitoring
if (require.main === module) {
  monitorEnhancedSystem();
} 