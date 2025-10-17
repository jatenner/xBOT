/**
 * POSTING SYSTEM VERIFICATION
 * Checks if all your sophisticated systems are actually being used
 */

import { getSupabaseClient } from './src/db/index';

async function verifyPostingSystem() {
  console.log('🔍 VERIFYING POSTING SYSTEM INTEGRATION\n');
  
  const supabase = getSupabaseClient();
  
  // ═══════════════════════════════════════════════════════════
  // 1. CHECK DATA COLLECTION
  // ═══════════════════════════════════════════════════════════
  console.log('📊 1. CHECKING DATA COLLECTION:');
  
  // Check if comprehensive_metrics table has data
  const { data: metricsData, error: metricsError } = await supabase
    .from('comprehensive_metrics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (metricsError) {
    console.log('   ❌ comprehensive_metrics table error:', metricsError.message);
  } else if (!metricsData || metricsData.length === 0) {
    console.log('   ⚠️  comprehensive_metrics table is EMPTY');
    console.log('   → 40+ data points are NOT being collected!');
  } else {
    console.log(`   ✅ ${metricsData.length} recent posts have comprehensive metrics`);
    console.log(`   → Sample data points collected: ${Object.keys(metricsData[0]).length} columns`);
    
    // Check key metrics
    const sample = metricsData[0];
    console.log(`   → Has engagement_velocity: ${sample.engagement_velocity !== null}`);
    console.log(`   → Has hook_type: ${sample.hook_type !== null}`);
    console.log(`   → Has followers_attributed: ${sample.followers_attributed !== null}`);
    console.log(`   → Has prediction_accuracy: ${sample.prediction_accuracy !== null}`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // 2. CHECK QUALITY GATES
  // ═════════════════════════════════════════════════════════
  console.log('\n🚦 2. CHECKING QUALITY GATES:');
  
  // Check posted_decisions table for quality scores
  const { data: decisionsData } = await supabase
    .from('posted_decisions')
    .select('quality_score, predicted_er, status')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (decisionsData && decisionsData.length > 0) {
    const avgQuality = decisionsData.reduce((sum, d) => sum + (d.quality_score || 0), 0) / decisionsData.length;
    const lowQualityCount = decisionsData.filter(d => (d.quality_score || 0) < 0.7).length;
    
    console.log(`   📊 Last 20 posts average quality: ${(avgQuality * 100).toFixed(1)}/100`);
    console.log(`   ⚠️  Posts below 70 quality: ${lowQualityCount}/${decisionsData.length}`);
    
    if (lowQualityCount > 0) {
      console.log('   → Quality gates may NOT be rejecting low-quality content!');
    } else {
      console.log('   ✅ All recent posts meet quality threshold');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 3. CHECK LEARNING APPLICATION
  // ═══════════════════════════════════════════════════════════
  console.log('\n🧠 3. CHECKING IF LEARNING IS APPLIED:');
  
  // Check if bandit_arms table exists and has data
  const { data: banditsData, error: banditsError } = await supabase
    .from('bandit_arms')
    .select('arm_key, pulls, rewards, avg_reward')
    .order('avg_reward', { ascending: false })
    .limit(5);
  
  if (banditsError) {
    console.log('   ❌ bandit_arms table error:', banditsError.message);
    console.log('   → Learning system may not be active!');
  } else if (!banditsData || banditsData.length === 0) {
    console.log('   ⚠️  bandit_arms table is EMPTY');
    console.log('   → No learning patterns being tracked!');
  } else {
    console.log(`   ✅ ${banditsData.length} learning patterns active`);
    console.log('   → Top performing patterns:');
    banditsData.slice(0, 3).forEach((arm, i) => {
      console.log(`      ${i + 1}. ${arm.arm_key}: ${arm.pulls} pulls, ${(arm.avg_reward * 100).toFixed(2)}% avg reward`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 4. CHECK FOLLOWER GROWTH TRACKING
  // ═══════════════════════════════════════════════════════════
  console.log('\n📈 4. CHECKING FOLLOWER GROWTH TRACKING:');
  
  // Check if posts have follower attribution
  const { data: followerData } = await supabase
    .from('comprehensive_metrics')
    .select('post_id, followers_before, followers_24h_after, followers_attributed')
    .not('followers_attributed', 'is', null)
    .order('followers_attributed', { ascending: false })
    .limit(10);
  
  if (!followerData || followerData.length === 0) {
    console.log('   ⚠️  NO follower attribution data found');
    console.log('   → Not tracking which posts gain followers!');
  } else {
    const totalFollowersGained = followerData.reduce((sum, d) => sum + (d.followers_attributed || 0), 0);
    console.log(`   ✅ Tracking follower attribution for ${followerData.length} posts`);
    console.log(`   → Total followers attributed: ${totalFollowersGained}`);
    console.log(`   → Best post: +${Math.max(...followerData.map(d => d.followers_attributed || 0))} followers`);
  }
  
  // ═══════════════════════════════════════════════════════════
  // 5. CHECK VIRAL PATTERN RECOGNITION
  // ═══════════════════════════════════════════════════════════
  console.log('\n🔥 5. CHECKING VIRAL PATTERN RECOGNITION:');
  
  // Check if we're tracking hook effectiveness
  const { data: hookData } = await supabase
    .from('comprehensive_metrics')
    .select('hook_type, hook_effectiveness, shareability_score')
    .not('hook_type', 'is', null)
    .order('shareability_score', { ascending: false })
    .limit(10);
  
  if (!hookData || hookData.length === 0) {
    console.log('   ⚠️  NO hook effectiveness data');
    console.log('   → Not learning which hooks work!');
  } else {
    const hookTypes = [...new Set(hookData.map(d => d.hook_type))];
    console.log(`   ✅ Tracking ${hookTypes.length} different hook types`);
    console.log(`   → Types: ${hookTypes.join(', ')}`);
    
    // Group by hook type and calculate average effectiveness
    const hookPerformance = hookTypes.map(type => {
      const posts = hookData.filter(d => d.hook_type === type);
      const avgShareability = posts.reduce((sum, p) => sum + (p.shareability_score || 0), 0) / posts.length;
      return { type, avgShareability, count: posts.length };
    }).sort((a, b) => b.avgShareability - a.avgShareability);
    
    console.log('   → Best performing hooks:');
    hookPerformance.slice(0, 3).forEach((hook, i) => {
      console.log(`      ${i + 1}. ${hook.type}: ${hook.avgShareability.toFixed(1)} shareability (${hook.count} posts)`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 6. FINAL VERDICT
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 FINAL VERDICT:');
  console.log('═'.repeat(60));
  
  const hasMetrics = metricsData && metricsData.length > 0;
  const hasLearning = banditsData && banditsData.length > 0;
  const hasFollowerTracking = followerData && followerData.length > 0;
  const hasHookAnalysis = hookData && hookData.length > 0;
  
  if (hasMetrics && hasLearning && hasFollowerTracking && hasHookAnalysis) {
    console.log('✅ EXCELLENT: All systems are collecting and learning!');
  } else {
    console.log('⚠️  ISSUES FOUND:');
    if (!hasMetrics) console.log('   - Comprehensive metrics NOT being collected');
    if (!hasLearning) console.log('   - Learning system NOT tracking patterns');
    if (!hasFollowerTracking) console.log('   - Follower growth NOT being attributed');
    if (!hasHookAnalysis) console.log('   - Hook effectiveness NOT being analyzed');
  }
  
  // ═══════════════════════════════════════════════════════════
  // 7. RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Enable all data collection hooks in posting flow');
  console.log('2. Set quality gate REJECTION threshold (e.g., reject < 70)');
  console.log('3. Integrate FollowerGrowthOptimizer into active path');
  console.log('4. Add viral pattern retrieval before content generation');
  console.log('5. Apply learning insights to prompt generation');
  
  console.log('\n' + '═'.repeat(60) + '\n');
}

// Run verification
verifyPostingSystem()
  .then(() => {
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

