#!/usr/bin/env tsx
/**
 * 🧠 LEARNING SYSTEM STATUS VERIFIER
 * 
 * Checks if all 12 learning layers are operational
 * Run: pnpm verify:learning:status
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LayerStatus {
  layer: string;
  status: 'ACTIVE' | 'READY' | 'WAITING' | 'BLOCKED';
  reason: string;
  dataPoints?: number;
}

async function verifyLearningStatus() {
  console.log('🧠 LEARNING SYSTEM STATUS VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const statuses: LayerStatus[] = [];
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // ═══════════════════════════════════════════════════════════
  // CHECK DATA AVAILABILITY
  // ═══════════════════════════════════════════════════════════

  // Check recent posts with tweet_id (critical for all layers)
  const { count: recentPostsCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo.toISOString());

  const { count: postsLast6h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .not('tweet_id', 'is', null)
    .gte('posted_at', sixHoursAgo.toISOString());

  const { count: postsLast24h } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneDayAgo.toISOString());

  // Check metrics collection
  const { count: metricsCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .not('tweet_id', 'is', null)
    .not('actual_impressions', 'is', null)
    .gte('posted_at', twoHoursAgo.toISOString());

  // Check outcomes (learning data)
  const { count: outcomesCount } = await supabase
    .from('outcomes')
    .select('*', { count: 'exact', head: true })
    .gte('collected_at', sixHoursAgo.toISOString());

  // Check VI data
  const { count: viCount } = await supabase
    .from('vi_collected_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('scraped_at', oneDayAgo.toISOString());

  // Check replies
  const { count: repliesCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo.toISOString());

  // ═══════════════════════════════════════════════════════════
  // EVALUATE EACH LAYER
  // ═══════════════════════════════════════════════════════════

  // Layer 1: Generator Performance
  if (outcomesCount && outcomesCount >= 5) {
    statuses.push({
      layer: 'Layer 1: Generator Performance',
      status: 'ACTIVE',
      reason: `${outcomesCount} outcomes available for learning`,
      dataPoints: outcomesCount
    });
  } else if (postsLast6h && postsLast6h >= 3) {
    statuses.push({
      layer: 'Layer 1: Generator Performance',
      status: 'READY',
      reason: `${postsLast6h} posts with tweet_id, waiting for metrics`,
      dataPoints: postsLast6h
    });
  } else {
    statuses.push({
      layer: 'Layer 1: Generator Performance',
      status: 'WAITING',
      reason: `Need 3+ posts with tweet_id (current: ${postsLast6h || 0})`,
      dataPoints: postsLast6h || 0
    });
  }

  // Layer 2: Follower Growth
  if (postsLast24h && postsLast24h >= 20) {
    statuses.push({
      layer: 'Layer 2: Follower Growth',
      status: 'ACTIVE',
      reason: `${postsLast24h} posts for attribution analysis`,
      dataPoints: postsLast24h
    });
  } else {
    statuses.push({
      layer: 'Layer 2: Follower Growth',
      status: 'WAITING',
      reason: `Need 20+ posts for meaningful follower attribution (current: ${postsLast24h || 0})`,
      dataPoints: postsLast24h || 0
    });
  }

  // Layer 3: Visual Intelligence
  if (viCount && viCount >= 10) {
    statuses.push({
      layer: 'Layer 3: Visual Intelligence (VI)',
      status: 'ACTIVE',
      reason: `${viCount} competitor tweets collected in last 24h`,
      dataPoints: viCount
    });
  } else {
    statuses.push({
      layer: 'Layer 3: Visual Intelligence (VI)',
      status: 'WAITING',
      reason: `Peer scraper starting (${viCount || 0} tweets collected)`,
      dataPoints: viCount || 0
    });
  }

  // Layer 4: Multi-Dimensional
  if (metricsCount && metricsCount >= 3) {
    statuses.push({
      layer: 'Layer 4: Multi-Dimensional',
      status: 'ACTIVE',
      reason: `${metricsCount} posts with metrics for velocity analysis`,
      dataPoints: metricsCount
    });
  } else {
    statuses.push({
      layer: 'Layer 4: Multi-Dimensional',
      status: 'WAITING',
      reason: `Need metrics collection (posts: ${recentPostsCount || 0}, metrics: ${metricsCount || 0})`,
      dataPoints: metricsCount || 0
    });
  }

  // Layer 5: Performance Prediction
  if (outcomesCount && outcomesCount >= 10) {
    statuses.push({
      layer: 'Layer 5: Performance Prediction',
      status: 'ACTIVE',
      reason: `${outcomesCount} outcomes for ML training`,
      dataPoints: outcomesCount
    });
  } else {
    statuses.push({
      layer: 'Layer 5: Performance Prediction',
      status: 'WAITING',
      reason: `Need 10+ outcomes for prediction model (current: ${outcomesCount || 0})`,
      dataPoints: outcomesCount || 0
    });
  }

  // Layer 6: Hook Intelligence
  if (outcomesCount && outcomesCount >= 5) {
    statuses.push({
      layer: 'Layer 6: Hook Intelligence',
      status: 'ACTIVE',
      reason: `${outcomesCount} posts with hook data`,
      dataPoints: outcomesCount
    });
  } else {
    statuses.push({
      layer: 'Layer 6: Hook Intelligence',
      status: 'WAITING',
      reason: `Need hook performance data (current: ${outcomesCount || 0})`,
      dataPoints: outcomesCount || 0
    });
  }

  // Layer 7: Reply Intelligence
  if (repliesCount && repliesCount >= 4) {
    statuses.push({
      layer: 'Layer 7: Reply Intelligence',
      status: 'ACTIVE',
      reason: `${repliesCount} replies posted in last 2h`,
      dataPoints: repliesCount
    });
  } else {
    statuses.push({
      layer: 'Layer 7: Reply Intelligence',
      status: 'WAITING',
      reason: `Need reply data (current: ${repliesCount || 0} in last 2h)`,
      dataPoints: repliesCount || 0
    });
  }

  // Layer 8: Content Slot
  if (postsLast24h && postsLast24h >= 12) {
    statuses.push({
      layer: 'Layer 8: Content Slot',
      status: 'ACTIVE',
      reason: `${postsLast24h} posts across multiple time slots`,
      dataPoints: postsLast24h
    });
  } else {
    statuses.push({
      layer: 'Layer 8: Content Slot',
      status: 'WAITING',
      reason: `Need 24h of posts (current: ${postsLast24h || 0})`,
      dataPoints: postsLast24h || 0
    });
  }

  // Layer 9: Topic & Angle
  if (outcomesCount && outcomesCount >= 8) {
    statuses.push({
      layer: 'Layer 9: Topic & Angle',
      status: 'ACTIVE',
      reason: `${outcomesCount} posts with topic diversity data`,
      dataPoints: outcomesCount
    });
  } else {
    statuses.push({
      layer: 'Layer 9: Topic & Angle',
      status: 'WAITING',
      reason: `Need diverse topic data (current: ${outcomesCount || 0})`,
      dataPoints: outcomesCount || 0
    });
  }

  // Layer 10: Meta-Learning
  if (outcomesCount && outcomesCount >= 20) {
    statuses.push({
      layer: 'Layer 10: Meta-Learning',
      status: 'ACTIVE',
      reason: `${outcomesCount} outcomes for pattern analysis`,
      dataPoints: outcomesCount
    });
  } else {
    statuses.push({
      layer: 'Layer 10: Meta-Learning',
      status: 'WAITING',
      reason: `Need 20+ outcomes for meta-patterns (current: ${outcomesCount || 0})`,
      dataPoints: outcomesCount || 0
    });
  }

  // Layer 11: Real-Time Adaptive
  if (recentPostsCount && recentPostsCount >= 2) {
    statuses.push({
      layer: 'Layer 11: Real-Time Adaptive',
      status: 'ACTIVE',
      reason: `${recentPostsCount} recent posts for immediate adaptation`,
      dataPoints: recentPostsCount
    });
  } else {
    statuses.push({
      layer: 'Layer 11: Real-Time Adaptive',
      status: 'WAITING',
      reason: `Need recent posts (current: ${recentPostsCount || 0} in last 2h)`,
      dataPoints: recentPostsCount || 0
    });
  }

  // Layer 12: Outcome Learning
  if (postsLast24h && postsLast24h >= 30) {
    statuses.push({
      layer: 'Layer 12: Outcome Learning',
      status: 'ACTIVE',
      reason: `${postsLast24h} posts for decision-outcome mapping`,
      dataPoints: postsLast24h
    });
  } else {
    statuses.push({
      layer: 'Layer 12: Outcome Learning',
      status: 'WAITING',
      reason: `Need 7 days of data (current: ${postsLast24h || 0} in last 24h)`,
      dataPoints: postsLast24h || 0
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DISPLAY RESULTS
  // ═══════════════════════════════════════════════════════════

  console.log('📊 DATA AVAILABILITY:\n');
  console.log(`  Posts (last 2h):     ${recentPostsCount || 0} with tweet_id`);
  console.log(`  Posts (last 6h):     ${postsLast6h || 0} with tweet_id`);
  console.log(`  Posts (last 24h):    ${postsLast24h || 0} with tweet_id`);
  console.log(`  Metrics collected:   ${metricsCount || 0} posts`);
  console.log(`  Outcomes:            ${outcomesCount || 0} in last 6h`);
  console.log(`  VI tweets:           ${viCount || 0} in last 24h`);
  console.log(`  Replies:             ${repliesCount || 0} in last 2h`);
  console.log('');

  console.log('🧠 LEARNING LAYERS STATUS:\n');

  const activeCount = statuses.filter(s => s.status === 'ACTIVE').length;
  const readyCount = statuses.filter(s => s.status === 'READY').length;
  const waitingCount = statuses.filter(s => s.status === 'WAITING').length;

  statuses.forEach(layer => {
    const icon = layer.status === 'ACTIVE' ? '✅' : 
                 layer.status === 'READY' ? '🟡' : 
                 layer.status === 'BLOCKED' ? '🚨' : '⏳';
    console.log(`  ${icon} ${layer.layer}`);
    console.log(`     ${layer.reason}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📈 SUMMARY:\n');
  console.log(`  ✅ ACTIVE:   ${activeCount}/12 layers`);
  console.log(`  🟡 READY:    ${readyCount}/12 layers`);
  console.log(`  ⏳ WAITING:  ${waitingCount}/12 layers`);
  console.log('');

  if (activeCount >= 8) {
    console.log('🎯 STATUS: EXCELLENT - Most learning systems operational');
  } else if (activeCount >= 4) {
    console.log('🎯 STATUS: GOOD - Core learning systems active, more coming online');
  } else if (activeCount >= 1) {
    console.log('🎯 STATUS: STARTING - Initial learning layers activating');
  } else {
    console.log('🚨 STATUS: COLD START - Waiting for first data collection');
    console.log('   Run this again in 2 hours after first tweets save & metrics collect');
  }

  console.log('');

  // Critical warnings
  if (recentPostsCount === 0) {
    console.log('⚠️  WARNING: No posts with tweet_id in last 2 hours!');
    console.log('   → Check if tweets are posting and tweet_id is saving');
    console.log('   → Verify markDecisionPosted() is working correctly');
    console.log('');
  }

  if (metricsCount === 0 && recentPostsCount && recentPostsCount > 0) {
    console.log('⚠️  WARNING: Posts exist but no metrics collected!');
    console.log('   → Check if metricsScraperJob is running');
    console.log('   → Verify DISABLE_METRICS_JOB is not set to true');
    console.log('');
  }

  if (viCount === 0) {
    console.log('ℹ️  INFO: VI system has no recent data');
    console.log('   → Peer scraper runs every 2 hours');
    console.log('   → This is normal on fresh start');
    console.log('');
  }

  console.log('🔍 Next check: Run this command again in 2 hours');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(activeCount >= 1 ? 0 : 1);
}

verifyLearningStatus().catch(error => {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
});

