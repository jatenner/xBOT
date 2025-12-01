/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * Full investigation: Learning, Growth, Functionality
 */

import { getSupabaseClient } from '../src/db';

interface AuditResult {
  section: string;
  status: 'working' | 'partial' | 'broken' | 'unknown';
  findings: string[];
  metrics?: any;
}

async function runComprehensiveAudit() {
  const supabase = getSupabaseClient();
  const results: AuditResult[] = [];
  
  console.log('🔍 COMPREHENSIVE SYSTEM AUDIT\n');
  console.log('=' .repeat(80));
  console.log('Investigating: Learning, Growth, Functionality\n');
  
  // ============================================
  // 1. LEARNING SYSTEM AUDIT
  // ============================================
  console.log('📚 1. LEARNING SYSTEM AUDIT\n');
  
  // Check if learning system is being called
  const { data: learningPosts } = await supabase
    .from('learning_posts')
    .select('tweet_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  
  // Check if patterns are being stored
  const { data: patterns } = await supabase
    .from('content_patterns')
    .select('*')
    .limit(10);
  
  // Check if bandit arms are updating
  const { data: banditArms } = await supabase
    .from('bandit_arms')
    .select('arm_id, successes, trials, success_rate')
    .order('success_rate', { ascending: false })
    .limit(10);
  
  // Check if planJob uses learning
  const { data: recentPlans } = await supabase
    .from('content_metadata')
    .select('decision_id, bandit_arm, raw_topic, generator_name, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  const learningFindings: string[] = [];
  let learningStatus: 'working' | 'partial' | 'broken' | 'unknown' = 'unknown';
  
  if (learningPosts && learningPosts.length > 0) {
    learningFindings.push(`✅ Learning posts table has ${learningPosts.length} recent entries`);
    const recentLearning = learningPosts.filter(p => {
      const updated = new Date(p.updated_at);
      return Date.now() - updated.getTime() < 7 * 24 * 60 * 60 * 1000;
    });
    learningFindings.push(`   - ${recentLearning.length} updated in last 7 days`);
  } else {
    learningFindings.push(`❌ Learning posts table is empty or not being updated`);
    learningStatus = 'broken';
  }
  
  if (banditArms && banditArms.length > 0) {
    learningFindings.push(`✅ Bandit arms exist: ${banditArms.length} arms tracked`);
    const activeArms = banditArms.filter(a => a.trials > 0);
    learningFindings.push(`   - ${activeArms.length} arms have trials (learning happening)`);
    if (activeArms.length > 0) {
      learningStatus = 'working';
    }
  } else {
    learningFindings.push(`⚠️ No bandit arms found - learning may not be active`);
    if (learningStatus === 'unknown') learningStatus = 'partial';
  }
  
  if (recentPlans && recentPlans.length > 0) {
    const withBandit = recentPlans.filter(p => p.bandit_arm);
    learningFindings.push(`✅ Recent content generation: ${recentPlans.length} posts`);
    learningFindings.push(`   - ${withBandit.length} have bandit_arm (${Math.round(withBandit.length / recentPlans.length * 100)}%)`);
    if (withBandit.length / recentPlans.length < 0.5) {
      learningFindings.push(`   ⚠️ Only ${Math.round(withBandit.length / recentPlans.length * 100)}% using bandit arms`);
      if (learningStatus === 'working') learningStatus = 'partial';
    }
  }
  
  results.push({
    section: 'Learning System',
    status: learningStatus,
    findings: learningFindings,
    metrics: {
      learningPostsCount: learningPosts?.length || 0,
      banditArmsCount: banditArms?.length || 0,
      recentPlansWithBandit: recentPlans?.filter(p => p.bandit_arm).length || 0
    }
  });
  
  // ============================================
  // 2. FOLLOWER GROWTH TRACKING
  // ============================================
  console.log('👥 2. FOLLOWER GROWTH TRACKING\n');
  
  // Check follower snapshots
  const { data: followerSnapshots } = await supabase
    .from('follower_snapshots')
    .select('follower_count, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  
  // Check follower attribution
  const { data: followerAttributions } = await supabase
    .from('follower_attributions')
    .select('decision_id, followers_gained, confidence_score')
    .order('created_at', { ascending: false })
    .limit(50);
  
  // Check if posts have follower_gained data
  const { data: postsWithFollowers } = await supabase
    .from('content_metadata')
    .select('decision_id, actual_impressions, actual_likes, posted_at')
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(100);
  
  const followerFindings: string[] = [];
  let followerStatus: 'working' | 'partial' | 'broken' | 'unknown' = 'unknown';
  
  if (followerSnapshots && followerSnapshots.length > 0) {
    followerFindings.push(`✅ Follower snapshots: ${followerSnapshots.length} records`);
    const recentSnapshots = followerSnapshots.filter(s => {
      const created = new Date(s.created_at);
      return Date.now() - created.getTime() < 7 * 24 * 60 * 60 * 1000;
    });
    followerFindings.push(`   - ${recentSnapshots.length} in last 7 days`);
    
    if (recentSnapshots.length > 0) {
      const counts = recentSnapshots.map(s => s.follower_count).filter(c => c !== null);
      if (counts.length > 1) {
        const growth = counts[0] - counts[counts.length - 1];
        followerFindings.push(`   - Growth trend: ${growth > 0 ? '+' : ''}${growth} followers (last 7 days)`);
        followerStatus = growth > 0 ? 'working' : 'partial';
      }
    }
  } else {
    followerFindings.push(`❌ No follower snapshots found - growth not being tracked`);
    followerStatus = 'broken';
  }
  
  if (followerAttributions && followerAttributions.length > 0) {
    followerFindings.push(`✅ Follower attributions: ${followerAttributions.length} posts attributed`);
    const totalGained = followerAttributions.reduce((sum, a) => sum + (a.followers_gained || 0), 0);
    followerFindings.push(`   - Total followers gained: ${totalGained}`);
    followerStatus = 'working';
  } else {
    followerFindings.push(`⚠️ No follower attributions found - posts not linked to follower growth`);
    if (followerStatus === 'working') followerStatus = 'partial';
  }
  
  results.push({
    section: 'Follower Growth Tracking',
    status: followerStatus,
    findings: followerFindings,
    metrics: {
      snapshotsCount: followerSnapshots?.length || 0,
      attributionsCount: followerAttributions?.length || 0,
      totalFollowersGained: followerAttributions?.reduce((sum, a) => sum + (a.followers_gained || 0), 0) || 0
    }
  });
  
  // ============================================
  // 3. PERFORMANCE TRENDS (Impressions/Likes Growth)
  // ============================================
  console.log('📈 3. PERFORMANCE TRENDS\n');
  
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Get posts by time period
  const { data: posts30Days } = await supabase
    .from('content_metadata')
    .select('actual_impressions, actual_likes, posted_at')
    .gte('posted_at', last30Days.toISOString())
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: true });
  
  const { data: posts7Days } = await supabase
    .from('content_metadata')
    .select('actual_impressions, actual_likes, posted_at')
    .gte('posted_at', last7Days.toISOString())
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: true });
  
  const performanceFindings: string[] = [];
  let performanceStatus: 'working' | 'partial' | 'broken' | 'unknown' = 'unknown';
  
  if (posts30Days && posts30Days.length > 10) {
    // Calculate trends
    const firstHalf = posts30Days.slice(0, Math.floor(posts30Days.length / 2));
    const secondHalf = posts30Days.slice(Math.floor(posts30Days.length / 2));
    
    const avgImpressionsFirst = firstHalf.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / firstHalf.length;
    const avgImpressionsSecond = secondHalf.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / secondHalf.length;
    
    const avgLikesFirst = firstHalf.reduce((sum, p) => sum + (p.actual_likes || 0), 0) / firstHalf.length;
    const avgLikesSecond = secondHalf.reduce((sum, p) => sum + (p.actual_likes || 0), 0) / secondHalf.length;
    
    const impressionsChange = ((avgImpressionsSecond - avgImpressionsFirst) / avgImpressionsFirst) * 100;
    const likesChange = ((avgLikesSecond - avgLikesFirst) / avgLikesFirst) * 100;
    
    performanceFindings.push(`✅ Performance data: ${posts30Days.length} posts with metrics (last 30 days)`);
    performanceFindings.push(`   - Avg impressions: ${Math.round(avgImpressionsFirst)} → ${Math.round(avgImpressionsSecond)} (${impressionsChange >= 0 ? '+' : ''}${impressionsChange.toFixed(1)}%)`);
    performanceFindings.push(`   - Avg likes: ${Math.round(avgLikesFirst)} → ${Math.round(avgLikesSecond)} (${likesChange >= 0 ? '+' : ''}${likesChange.toFixed(1)}%)`);
    
    if (impressionsChange > 5 || likesChange > 5) {
      performanceStatus = 'working';
      performanceFindings.push(`   ✅ TRENDING UP: System is improving!`);
    } else if (impressionsChange < -5 || likesChange < -5) {
      performanceStatus = 'broken';
      performanceFindings.push(`   ❌ TRENDING DOWN: Performance declining`);
    } else {
      performanceStatus = 'partial';
      performanceFindings.push(`   ⚠️ FLAT: No significant improvement`);
    }
  } else {
    performanceFindings.push(`⚠️ Insufficient data: ${posts30Days?.length || 0} posts with metrics (need 10+)`);
    performanceStatus = 'partial';
  }
  
  if (posts7Days && posts7Days.length > 0) {
    const totalImpressions = posts7Days.reduce((sum, p) => sum + (p.actual_impressions || 0), 0);
    const totalLikes = posts7Days.reduce((sum, p) => sum + (p.actual_likes || 0), 0);
    performanceFindings.push(`   - Last 7 days: ${totalImpressions.toLocaleString()} impressions, ${totalLikes.toLocaleString()} likes`);
  }
  
  results.push({
    section: 'Performance Trends',
    status: performanceStatus,
    findings: performanceFindings,
    metrics: {
      postsWithMetrics30d: posts30Days?.length || 0,
      postsWithMetrics7d: posts7Days?.length || 0
    }
  });
  
  // ============================================
  // 4. LEARNING APPLICATION (Is planJob using learned patterns?)
  // ============================================
  console.log('🎯 4. LEARNING APPLICATION\n');
  
  // Check if recent content uses learned patterns
  const { data: recentContent } = await supabase
    .from('content_metadata')
    .select('decision_id, raw_topic, generator_name, bandit_arm, quality_score, predicted_er, actual_engagement_rate, posted_at')
    .order('created_at', { ascending: false })
    .limit(50);
  
  const applicationFindings: string[] = [];
  let applicationStatus: 'working' | 'partial' | 'broken' | 'unknown' = 'unknown';
  
  if (recentContent && recentContent.length > 0) {
    const withLearning = recentContent.filter(c => c.bandit_arm || c.predicted_er);
    applicationFindings.push(`✅ Recent content: ${recentContent.length} posts`);
    applicationFindings.push(`   - ${withLearning.length} using learning (${Math.round(withLearning.length / recentContent.length * 100)}%)`);
    
    // Check prediction accuracy
    const withBoth = recentContent.filter(c => c.predicted_er && c.actual_engagement_rate);
    if (withBoth.length > 0) {
      const predictionErrors = withBoth.map(c => {
        const predicted = c.predicted_er || 0;
        const actual = c.actual_engagement_rate || 0;
        return Math.abs(predicted - actual);
      });
      const avgError = predictionErrors.reduce((sum, e) => sum + e, 0) / predictionErrors.length;
      applicationFindings.push(`   - Prediction accuracy: ${((1 - avgError) * 100).toFixed(1)}% (${withBoth.length} posts)`);
      
      if (avgError < 0.1) {
        applicationStatus = 'working';
        applicationFindings.push(`   ✅ Predictions are accurate - learning is working!`);
      } else {
        applicationStatus = 'partial';
        applicationFindings.push(`   ⚠️ Predictions have ${(avgError * 100).toFixed(1)}% error - learning needs improvement`);
      }
    }
    
    // Check if topics are diverse (learning should diversify)
    const topics = new Set(recentContent.map(c => c.raw_topic).filter(t => t));
    applicationFindings.push(`   - Topic diversity: ${topics.size} unique topics`);
    
    if (withLearning.length / recentContent.length < 0.5) {
      applicationStatus = 'partial';
      applicationFindings.push(`   ⚠️ Only ${Math.round(withLearning.length / recentContent.length * 100)}% using learning`);
    }
  }
  
  results.push({
    section: 'Learning Application',
    status: applicationStatus,
    findings: applicationFindings
  });
  
  // ============================================
  // 5. SYSTEM FUNCTIONALITY CHECK
  // ============================================
  console.log('⚙️ 5. SYSTEM FUNCTIONALITY\n');
  
  // Check job heartbeats
  const { data: heartbeats } = await supabase
    .from('job_heartbeats')
    .select('job_name, last_success, consecutive_failures, status')
    .order('last_success', { ascending: false });
  
  // Check posting attempts
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: recentAttempts } = await supabase
    .from('posting_attempts')
    .select('status, created_at')
    .gte('created_at', yesterday.toISOString());
  
  const functionalityFindings: string[] = [];
  let functionalityStatus: 'working' | 'partial' | 'broken' | 'unknown' = 'unknown';
  
  if (heartbeats && heartbeats.length > 0) {
    const activeJobs = heartbeats.filter(h => {
      const lastSuccess = h.last_success ? new Date(h.last_success) : null;
      if (!lastSuccess) return false;
      return Date.now() - lastSuccess.getTime() < 2 * 60 * 60 * 1000; // Last 2 hours
    });
    
    functionalityFindings.push(`✅ Job heartbeats: ${heartbeats.length} jobs tracked`);
    functionalityFindings.push(`   - ${activeJobs.length} active in last 2 hours`);
    
    const failedJobs = heartbeats.filter(h => h.consecutive_failures > 3);
    if (failedJobs.length > 0) {
      functionalityFindings.push(`   ⚠️ ${failedJobs.length} jobs with >3 consecutive failures`);
      functionalityStatus = 'partial';
    } else {
      functionalityStatus = 'working';
    }
  }
  
  if (recentAttempts && recentAttempts.length > 0) {
    const finalAttempts = recentAttempts.filter(a => a.status !== 'attempting');
    const successCount = finalAttempts.filter(a => a.status === 'success').length;
    const successRate = finalAttempts.length > 0 ? (successCount / finalAttempts.length) * 100 : 0;
    
    functionalityFindings.push(`✅ Posting attempts: ${finalAttempts.length} in last 24h`);
    functionalityFindings.push(`   - Success rate: ${successRate.toFixed(1)}%`);
    
    if (successRate >= 70) {
      functionalityStatus = 'working';
    } else if (successRate >= 50) {
      functionalityStatus = 'partial';
    } else {
      functionalityStatus = 'broken';
    }
  }
  
  results.push({
    section: 'System Functionality',
    status: functionalityStatus,
    findings: functionalityFindings
  });
  
  // ============================================
  // SUMMARY REPORT
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 AUDIT SUMMARY\n');
  
  results.forEach(result => {
    const icon = result.status === 'working' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
    console.log(`${icon} ${result.section}: ${result.status.toUpperCase()}`);
    result.findings.forEach(f => console.log(`   ${f}`));
    console.log('');
  });
  
  // Overall assessment
  const workingCount = results.filter(r => r.status === 'working').length;
  const partialCount = results.filter(r => r.status === 'partial').length;
  const brokenCount = results.filter(r => r.status === 'broken').length;
  
  console.log('='.repeat(80));
  console.log('🎯 OVERALL ASSESSMENT\n');
  console.log(`Working: ${workingCount}/${results.length}`);
  console.log(`Partial: ${partialCount}/${results.length}`);
  console.log(`Broken: ${brokenCount}/${results.length}\n`);
  
  if (workingCount === results.length) {
    console.log('✅ SYSTEM IS FULLY FUNCTIONAL');
  } else if (brokenCount === 0) {
    console.log('⚠️ SYSTEM IS MOSTLY WORKING - Some improvements needed');
  } else {
    console.log('❌ SYSTEM HAS CRITICAL ISSUES - Needs immediate attention');
  }
  
  return results;
}

runComprehensiveAudit().catch(console.error);

