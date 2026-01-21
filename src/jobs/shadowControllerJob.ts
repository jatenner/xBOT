/**
 * 🎯 GROWTH CONTROLLER JOB
 * 
 * Produces hourly plans for posting/reply cadence and strategy.
 * When GROWTH_CONTROLLER_ENABLED=true, plans are enforced.
 * Otherwise, operates in shadow mode (recommendations only).
 */

import 'dotenv/config';
import { getSupabaseClient } from '../db/index';
import * as fs from 'fs';
import * as path from 'path';

interface GrowthPlan {
  plan_id?: string;
  window_start: string;
  window_end: string;
  target_posts: number;
  target_replies: number;
  feed_weights: {
    curated_accounts: number;
    keyword_search: number;
    viral_watcher: number;
    discovered_accounts: number;
  };
  strategy_weights: {
    topics: Array<{ topic: string; weight: number }>;
    formats: Array<{ format: string; weight: number }>;
    generators: Array<{ generator: string; weight: number }>;
    reply_styles?: Array<{ style: string; weight: number }>;
  };
  exploration_rate: number;
  reason_summary: string;
  resistance_backoff_applied?: boolean;
  backoff_reason?: string;
}

interface ShadowPlan {
  posts_per_hour_recommendation: number;
  replies_per_hour_recommendation: number;
  exploration_rate: number;
  strategy_weights: {
    top_topics: Array<{ topic: string; weight: number }>;
    top_formats: Array<{ format: string; weight: number }>;
    top_generators: Array<{ generator: string; weight: number }>;
  };
  explanation: string;
  computed_at: string;
}

/**
 * Generate shadow plan (hourly recommendation)
 */
export async function generateShadowPlan(): Promise<ShadowPlan> {
  console.log('[SHADOW_CONTROLLER] 🎭 Generating shadow plan...');
  
  const supabase = getSupabaseClient();
  
  // Record job start for heartbeat tracking
  try {
    const { recordJobStart } = await import('./jobHeartbeat');
    await recordJobStart('shadow_controller');
  } catch (err: any) {
    console.warn(`[SHADOW_CONTROLLER] ⚠️ Could not record job start: ${err.message}`);
  }
  
  // Get current configured limits
  const currentPostsPerHour = parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10);
  const currentRepliesPerHour = parseInt(process.env.REPLIES_PER_HOUR || '4', 10);
  
  // Get safe envelope from env
  const minPostsPerHour = parseInt(process.env.SHADOW_MIN_POSTS_PER_HOUR || '1', 10);
  const maxPostsPerHour = parseInt(process.env.SHADOW_MAX_POSTS_PER_HOUR || '4', 10);
  const minRepliesPerHour = parseInt(process.env.SHADOW_MIN_REPLIES_PER_HOUR || '2', 10);
  const maxRepliesPerHour = parseInt(process.env.SHADOW_MAX_REPLIES_PER_HOUR || '8', 10);
  
  // Analyze last 24-72h reward trends
  const analysis = await analyzeRecentRewards();
  
  // Generate recommendations
  const postsRecommendation = computePostsRecommendation(
    currentPostsPerHour,
    analysis,
    minPostsPerHour,
    maxPostsPerHour
  );
  
  const repliesRecommendation = computeRepliesRecommendation(
    currentRepliesPerHour,
    analysis,
    minRepliesPerHour,
    maxRepliesPerHour
  );
  
  const explorationRate = computeExplorationRate(analysis);
  
  const strategyWeights = await computeStrategyWeights();
  
  // Check for platform resistance signals
  const resistance = await checkPlatformResistance();
  let finalPostsRec = postsRecommendation;
  let finalRepliesRec = repliesRecommendation;
  let backoffApplied = false;
  let backoffReason = '';
  
  if (resistance.shouldBackoff) {
    // Apply backoff: reduce targets by 50%
    finalPostsRec = Math.max(1, Math.floor(postsRecommendation * 0.5));
    finalRepliesRec = Math.max(1, Math.floor(repliesRecommendation * 0.5));
    backoffApplied = true;
    backoffReason = resistance.reason;
    console.log(`[GROWTH_CONTROLLER] ⚠️ Platform resistance detected: ${resistance.reason}`);
    console.log(`[GROWTH_CONTROLLER] 📉 Applying backoff: ${postsRecommendation} → ${finalPostsRec} posts, ${repliesRecommendation} → ${finalRepliesRec} replies`);
  }
  
  // Get feed weights (from current config or defaults)
  const feedWeights = await computeFeedWeights();
  
  // Create hourly window
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(windowEnd.getHours() + 1);
  
  const explanation = buildExplanation(analysis, finalPostsRec, finalRepliesRec, backoffApplied, backoffReason);
  
  // Create growth plan
  const growthPlan: GrowthPlan = {
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    target_posts: finalPostsRec,
    target_replies: finalRepliesRec,
    feed_weights: feedWeights,
    strategy_weights: {
      topics: strategyWeights.top_topics.map(t => ({ topic: t.topic, weight: t.weight })),
      formats: strategyWeights.top_formats.map(f => ({ format: f.format, weight: f.weight })),
      generators: strategyWeights.top_generators.map(g => ({ generator: g.generator, weight: g.weight })),
    },
    exploration_rate: explorationRate,
    reason_summary: explanation,
    resistance_backoff_applied: backoffApplied,
    backoff_reason: backoffReason || undefined,
  };
  
  // Store in growth_plans table (upsert to handle duplicate hour)
  const { data: planData, error: planError } = await supabase
    .from('growth_plans')
    .upsert(growthPlan, {
      onConflict: 'window_start',
      ignoreDuplicates: false,
    })
    .select('plan_id')
    .single();
  
  if (planError) {
    console.error(`[GROWTH_CONTROLLER] ❌ Failed to store growth plan: ${planError.message}`);
    console.error(`[GROWTH_CONTROLLER] ❌ Plan data:`, JSON.stringify(growthPlan, null, 2));
    
    // Record job failure for heartbeat tracking
    try {
      const { recordJobFailure } = await import('./jobHeartbeat');
      await recordJobFailure('shadow_controller', `Failed to store growth plan: ${planError.message}`);
    } catch (err: any) {
      console.warn(`[SHADOW_CONTROLLER] ⚠️ Could not record job failure: ${err.message}`);
    }
    
    throw planError;
  }
  
  growthPlan.plan_id = planData.plan_id;
  
  // Also store in system_events (for backward compatibility and explainability)
  const shadowPlan: ShadowPlan = {
    posts_per_hour_recommendation: finalPostsRec,
    replies_per_hour_recommendation: finalRepliesRec,
    exploration_rate: explorationRate,
    strategy_weights: strategyWeights,
    explanation,
    computed_at: new Date().toISOString(),
  };
  
  // Store PLAN_REASON_SUMMARY event for explainability
  await supabase.from('system_events').insert([
    {
      event_type: 'SHADOW_PLAN',
      severity: 'info',
      message: `Growth plan generated: ${finalPostsRec} posts/h, ${finalRepliesRec} replies/h`,
      event_data: { ...shadowPlan, plan_id: planData.plan_id },
      created_at: new Date().toISOString(),
    },
    {
      event_type: 'GROWTH_PLAN_REASON',
      severity: 'info',
      message: `Plan reason summary: ${explanation}`,
      event_data: {
        plan_id: planData.plan_id,
        reason_summary: explanation,
        previous_targets: {
          posts: parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10),
          replies: parseInt(process.env.REPLIES_PER_HOUR || '4', 10),
        },
        new_targets: {
          posts: finalPostsRec,
          replies: finalRepliesRec,
        },
        analysis: {
          trend: analysis.trend,
          avg_reward_24h: analysis.avgReward24h,
          avg_reward_72h: analysis.avgReward72h,
          follower_delta_24h: analysis.followerDelta24h || 0,
          avg_impressions_24h: analysis.avgImpressions24h || 0,
          avg_bookmarks_24h: analysis.avgBookmarks24h || 0,
        },
        backoff_applied: backoffApplied,
        backoff_reason: backoffReason || null,
      },
      created_at: new Date().toISOString(),
    },
  ]);
  
  // Append to report file
  await appendToReport(shadowPlan);
  
  // Record job success for heartbeat tracking
  try {
    const { recordJobSuccess } = await import('./jobHeartbeat');
    await recordJobSuccess('shadow_controller');
  } catch (err: any) {
    console.warn(`[SHADOW_CONTROLLER] ⚠️ Could not record job success: ${err.message}`);
  }
  
  // Log plan generation event with plan_id and window_start for monitoring
  await supabase.from('system_events').insert({
    event_type: 'GROWTH_PLAN_GENERATED',
    severity: 'info',
    message: `Growth plan generated successfully: plan_id=${planData.plan_id}, window_start=${windowStart.toISOString()}, targets=${finalPostsRec} posts/${finalRepliesRec} replies`,
    event_data: {
      plan_id: planData.plan_id,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      target_posts: finalPostsRec,
      target_replies: finalRepliesRec,
      resistance_backoff_applied: backoffApplied,
      backoff_reason: backoffReason || null,
    },
    created_at: new Date().toISOString(),
  });
  
  console.log(`[GROWTH_CONTROLLER] ✅ Plan generated: ${finalPostsRec} posts/h, ${finalRepliesRec} replies/h (plan_id: ${planData.plan_id})`);
  console.log(`[GROWTH_CONTROLLER] 📝 Explanation: ${explanation}`);
  console.log(`[GROWTH_CONTROLLER] 📊 Plan window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);
  
  return shadowPlan;
}

/**
 * Analyze recent reward trends (adaptive, reward-driven)
 * Uses: follower deltas, impressions, bookmarks, reward_features
 */
async function analyzeRecentRewards(): Promise<{
  avgReward24h: number;
  avgReward72h: number;
  trend: 'increasing' | 'decreasing' | 'flat';
  rewardVariance: number;
  followerDelta24h: number;
  avgImpressions24h: number;
  avgBookmarks24h: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day72hAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  
  // Get rewards from reward_features (primary source)
  let rewards24h: any[] = [];
  let rewards72h: any[] = [];
  
  try {
    const { data } = await supabase
      .from('reward_features')
      .select('reward_score, posted_at')
      .gte('posted_at', day72hAgo.toISOString())
      .order('posted_at', { ascending: false });
    
    rewards24h = (data || []).filter(r => new Date(r.posted_at) >= day24hAgo);
    rewards72h = data || [];
  } catch (err: any) {
    // Table might not exist yet, fall back to content_metadata
    console.warn(`[SHADOW_CONTROLLER] ⚠️ reward_features table not available: ${err.message}`);
  }
  
  // If no reward_features, try to compute from performance_snapshots + account_snapshots
  if (rewards24h.length === 0) {
    try {
      // Get follower delta from account_snapshots
      const { data: snapshots } = await supabase
        .from('account_snapshots')
        .select('timestamp, followers_count')
        .gte('timestamp', day24hAgo.toISOString())
        .order('timestamp', { ascending: true });
      
      if (snapshots && snapshots.length >= 2) {
        const oldest = snapshots[0].followers_count;
        const newest = snapshots[snapshots.length - 1].followers_count;
        rewards24h.push({ reward_score: newest - oldest, posted_at: newest } as any);
      }
      
      // Get impressions/bookmarks from performance_snapshots (24h horizon)
      const { data: perfSnapshots } = await supabase
        .from('performance_snapshots')
        .select('impressions, bookmarks')
        .eq('horizon_minutes', 1440)
        .gte('collected_at', day24hAgo.toISOString());
      
      if (perfSnapshots && perfSnapshots.length > 0) {
        const avgImpressions = perfSnapshots.reduce((sum, p) => sum + (p.impressions || 0), 0) / perfSnapshots.length;
        const avgBookmarks = perfSnapshots.reduce((sum, p) => sum + (p.bookmarks || 0), 0) / perfSnapshots.length;
        // Use simple proxy: impressions * 0.01 + bookmarks * 10
        rewards24h.push({ reward_score: avgImpressions * 0.01 + avgBookmarks * 10, posted_at: now.toISOString() } as any);
      }
    } catch (err: any) {
      console.warn(`[SHADOW_CONTROLLER] ⚠️ Could not compute rewards from telemetry: ${err.message}`);
    }
  }
  
  const avgReward24h = rewards24h.length > 0
    ? rewards24h.reduce((sum, r) => sum + (r.reward_score || 0), 0) / rewards24h.length
    : 0;
  
  const avgReward72h = rewards72h.length > 0
    ? rewards72h.reduce((sum, r) => sum + (r.reward_score || 0), 0) / rewards72h.length
    : 0;
  
  // Compute trend (more sensitive threshold)
  let trend: 'increasing' | 'decreasing' | 'flat' = 'flat';
  if (avgReward72h === 0) {
    // No historical data - default to flat
    trend = 'flat';
  } else if (avgReward24h > avgReward72h * 1.05) {
    trend = 'increasing';
  } else if (avgReward24h < avgReward72h * 0.95) {
    trend = 'decreasing';
  }
  
  // Compute variance
  const rewards = rewards24h || [];
  const variance = rewards.length > 1
    ? rewards.reduce((sum, r) => {
        const diff = (r.reward_score || 0) - avgReward24h;
        return sum + diff * diff;
      }, 0) / rewards.length
    : 0;
  
  // Get follower delta from account_snapshots (24h window)
  let followerDelta24h = 0;
  let avgImpressions24h = 0;
  let avgBookmarks24h = 0;
  
  try {
    const { data: snapshots24h } = await supabase
      .from('account_snapshots')
      .select('timestamp, followers_count')
      .gte('timestamp', day24hAgo.toISOString())
      .order('timestamp', { ascending: true });
    
    if (snapshots24h && snapshots24h.length >= 2) {
      const oldest = snapshots24h[0].followers_count;
      const newest = snapshots24h[snapshots24h.length - 1].followers_count;
      followerDelta24h = newest - oldest;
    }
    
    // Get impressions/bookmarks from performance_snapshots
    const { data: perf24h } = await supabase
      .from('performance_snapshots')
      .select('impressions, bookmarks')
      .eq('horizon_minutes', 1440)
      .gte('collected_at', day24hAgo.toISOString());
    
    if (perf24h && perf24h.length > 0) {
      avgImpressions24h = perf24h.reduce((sum, p) => sum + (p.impressions || 0), 0) / perf24h.length;
      avgBookmarks24h = perf24h.reduce((sum, p) => sum + (p.bookmarks || 0), 0) / perf24h.length;
    }
  } catch (err: any) {
    // Tables might not exist, ignore
  }
  
  return {
    avgReward24h,
    avgReward72h,
    trend,
    rewardVariance: variance,
    followerDelta24h,
    avgImpressions24h,
    avgBookmarks24h,
  };
}

/**
 * Compute posts per hour recommendation (adaptive, reward-driven)
 * Rules:
 * - Must respect hard envelopes (min/max)
 * - Max step change: +/-1 per hour
 * - Increase only if reward improving AND resistance low
 * - Decrease if reward falling OR resistance rising
 */
function computePostsRecommendation(
  current: number,
  analysis: any,
  min: number,
  max: number
): number {
  const MAX_STEP_CHANGE = parseInt(process.env.GROWTH_CONTROLLER_MAX_STEP_POSTS || '1', 10);
  
  let recommendation = current;
  
  // Adaptive logic: use multiple signals
  const rewardImproving = analysis.trend === 'increasing' && analysis.avgReward24h > 0;
  const rewardFalling = analysis.trend === 'decreasing' || analysis.avgReward24h < 0;
  const followerGrowth = (analysis.followerDelta24h || 0) > 0;
  const goodEngagement = (analysis.avgBookmarks24h || 0) > 2; // At least 2 bookmarks avg
  
  // Decision: increase, decrease, or stay
  if (rewardImproving && (followerGrowth || goodEngagement)) {
    // Reward improving + positive signals -> increase (gradually)
    recommendation = Math.min(current + MAX_STEP_CHANGE, max);
  } else if (rewardFalling || (analysis.followerDelta24h || 0) < -5) {
    // Reward falling or losing followers -> decrease
    recommendation = Math.max(current - MAX_STEP_CHANGE, min);
  }
  // Otherwise: stay at current (no change)
  
  // Ensure within bounds
  recommendation = Math.max(min, Math.min(max, recommendation));
  
  return recommendation;
}

/**
 * Compute replies per hour recommendation (adaptive, reward-driven)
 * Rules:
 * - Must respect hard envelopes (min/max)
 * - Max step change: +/-2 per hour (more flexible than posts)
 * - Increase only if reward improving AND resistance low
 * - Decrease if reward falling OR resistance rising
 */
function computeRepliesRecommendation(
  current: number,
  analysis: any,
  min: number,
  max: number
): number {
  const MAX_STEP_CHANGE = parseInt(process.env.GROWTH_CONTROLLER_MAX_STEP_REPLIES || '2', 10);
  
  let recommendation = current;
  
  // Adaptive logic: replies can adjust more flexibly than posts
  const rewardImproving = analysis.trend === 'increasing' && analysis.avgReward24h > 0;
  const rewardFalling = analysis.trend === 'decreasing' || analysis.avgReward24h < 0;
  const followerGrowth = (analysis.followerDelta24h || 0) > 0;
  const goodImpressions = (analysis.avgImpressions24h || 0) > 100;
  
  // Decision: increase, decrease, or stay
  if (rewardImproving && (followerGrowth || goodImpressions)) {
    // Reward improving + positive signals -> increase (more flexible for replies)
    recommendation = Math.min(current + MAX_STEP_CHANGE, max);
  } else if (rewardFalling || (analysis.followerDelta24h || 0) < -5) {
    // Reward falling or losing followers -> decrease
    recommendation = Math.max(current - MAX_STEP_CHANGE, min);
  }
  // Otherwise: stay at current
  
  // Ensure within bounds
  recommendation = Math.max(min, Math.min(max, recommendation));
  
  return recommendation;
}

/**
 * Compute exploration rate (0-0.3)
 */
function computeExplorationRate(analysis: any): number {
  // Higher variance = more exploration needed
  if (analysis.rewardVariance > 100) {
    return 0.3; // High variance - explore more
  } else if (analysis.rewardVariance > 50) {
    return 0.2; // Medium variance
  } else {
    return 0.1; // Low variance - exploit more
  }
}

/**
 * Compute strategy weights from daily aggregates
 */
async function computeStrategyWeights(): Promise<{
  top_topics: Array<{ topic: string; weight: number }>;
  top_formats: Array<{ format: string; weight: number }>;
  top_generators: Array<{ generator: string; weight: number }>;
}> {
  const supabase = getSupabaseClient();
  
  // Get recent daily aggregates (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  // Topics
  const { data: topicAggs } = await supabase
    .from('daily_aggregates')
    .select('dimension_value, avg_reward_score, total_decisions')
    .eq('dimension_type', 'topic')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .order('avg_reward_score', { ascending: false })
    .limit(5);
  
  // Formats
  const { data: formatAggs } = await supabase
    .from('daily_aggregates')
    .select('dimension_value, avg_reward_score, total_decisions')
    .eq('dimension_type', 'format')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .order('avg_reward_score', { ascending: false })
    .limit(3);
  
  // Generators
  const { data: generatorAggs } = await supabase
    .from('daily_aggregates')
    .select('dimension_value, avg_reward_score, total_decisions')
    .eq('dimension_type', 'generator')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .order('avg_reward_score', { ascending: false })
    .limit(5);
  
  // Normalize weights (sum to 1.0)
  const normalizeWeights = (items: any[]) => {
    if (!items || items.length === 0) return [];
    const total = items.reduce((sum, item) => sum + (item.avg_reward_score || 0), 0);
    if (total === 0) return items.map(item => ({ topic: item.dimension_value, weight: 1 / items.length }));
    return items.map(item => ({
      topic: item.dimension_value,
      weight: (item.avg_reward_score || 0) / total,
    }));
  };
  
  return {
    top_topics: normalizeWeights(topicAggs || []).map(item => ({ topic: item.topic, weight: item.weight })),
    top_formats: normalizeWeights(formatAggs || []).map(item => ({ format: item.topic, weight: item.weight })),
    top_generators: normalizeWeights(generatorAggs || []).map(item => ({ generator: item.topic, weight: item.weight })),
  };
}

/**
 * Check for platform resistance signals
 */
async function checkPlatformResistance(): Promise<{
  shouldBackoff: boolean;
  reason: string;
}> {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Check CONSENT_WALL rate
  const { data: consentWalls } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'CONSENT_WALL')
    .gte('created_at', oneHourAgo.toISOString());
  
  const consentWallCount = consentWalls?.length || 0;
  const consentWallThreshold = parseInt(process.env.RESISTANCE_CONSENT_WALL_THRESHOLD || '5', 10);
  
  if (consentWallCount >= consentWallThreshold) {
    return {
      shouldBackoff: true,
      reason: `CONSENT_WALL threshold exceeded: ${consentWallCount} in last hour (threshold: ${consentWallThreshold})`,
    };
  }
  
  // Check POST_FAIL bursts
  const { data: postFails } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneHourAgo.toISOString());
  
  const postFailCount = postFails?.length || 0;
  const postFailThreshold = parseInt(process.env.RESISTANCE_POST_FAIL_THRESHOLD || '10', 10);
  
  if (postFailCount >= postFailThreshold) {
    return {
      shouldBackoff: true,
      reason: `POST_FAIL burst detected: ${postFailCount} failures in last hour (threshold: ${postFailThreshold})`,
    };
  }
  
  // Check CHALLENGE signals (if tracked)
  const { data: challenges } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'CHALLENGE')
    .gte('created_at', oneHourAgo.toISOString());
  
  const challengeCount = challenges?.length || 0;
  if (challengeCount > 0) {
    return {
      shouldBackoff: true,
      reason: `Platform challenge detected: ${challengeCount} challenges in last hour`,
    };
  }
  
  return { shouldBackoff: false, reason: '' };
}

/**
 * Compute feed weights (heuristic-based, no LLM)
 */
async function computeFeedWeights(): Promise<{
  curated_accounts: number;
  keyword_search: number;
  viral_watcher: number;
  discovered_accounts: number;
}> {
  const supabase = getSupabaseClient();
  
  // Get recent performance by feed (from reply opportunities or outcomes)
  // For now, use defaults with small adjustments based on recent success
  
  // Default weights
  const defaults = {
    curated_accounts: 0.35,
    keyword_search: 0.30,
    viral_watcher: 0.20,
    discovered_accounts: 0.15,
  };
  
  // TODO: Could analyze recent reply success rates by source
  // For now, return defaults (heuristic-based, no LLM)
  
  return defaults;
}

/**
 * Build explanation text (transparent logging & explainability)
 */
function buildExplanation(
  analysis: any,
  postsRec: number,
  repliesRec: number,
  backoffApplied: boolean,
  backoffReason: string
): string {
  const parts: string[] = [];
  
  // Reward summary
  parts.push(`Recent reward trend: ${analysis.trend}`);
  parts.push(`24h avg reward: ${analysis.avgReward24h.toFixed(2)}`);
  parts.push(`72h avg reward: ${analysis.avgReward72h.toFixed(2)}`);
  
  // Follower attribution
  if (analysis.followerDelta24h !== undefined) {
    parts.push(`24h follower delta: ${analysis.followerDelta24h > 0 ? '+' : ''}${analysis.followerDelta24h}`);
  }
  
  // Engagement metrics
  if (analysis.avgImpressions24h > 0) {
    parts.push(`24h avg impressions: ${analysis.avgImpressions24h.toFixed(0)}`);
  }
  if (analysis.avgBookmarks24h > 0) {
    parts.push(`24h avg bookmarks: ${analysis.avgBookmarks24h.toFixed(1)}`);
  }
  
  // Resistance summary
  if (backoffApplied) {
    parts.push(`⚠️ Platform resistance backoff applied: ${backoffReason}`);
  }
  
  // Change explanation
  const currentPosts = parseInt(process.env.MAX_POSTS_PER_HOUR || '2', 10);
  const currentReplies = parseInt(process.env.REPLIES_PER_HOUR || '4', 10);
  
  if (postsRec > currentPosts) {
    parts.push(`Increasing posts: ${currentPosts} → ${postsRec} (reward improving, engagement positive)`);
  } else if (postsRec < currentPosts) {
    parts.push(`Decreasing posts: ${currentPosts} → ${postsRec} (reward falling or resistance detected)`);
  } else {
    parts.push(`Maintaining posts: ${postsRec} (no significant change warranted)`);
  }
  
  if (repliesRec > currentReplies) {
    parts.push(`Increasing replies: ${currentReplies} → ${repliesRec} (reward improving, engagement positive)`);
  } else if (repliesRec < currentReplies) {
    parts.push(`Decreasing replies: ${currentReplies} → ${repliesRec} (reward falling or resistance detected)`);
  } else {
    parts.push(`Maintaining replies: ${repliesRec} (no significant change warranted)`);
  }
  
  return parts.join('. ');
}

/**
 * Append plan to report file
 */
async function appendToReport(plan: ShadowPlan): Promise<void> {
  const reportPath = path.join(process.cwd(), 'docs', 'GROWTH_SHADOW_CONTROLLER_REPORT.md');
  const reportDir = path.dirname(reportPath);
  
  // Ensure directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Read existing report or create header
  let content = '';
  if (fs.existsSync(reportPath)) {
    content = fs.readFileSync(reportPath, 'utf-8');
  } else {
    content = `# Growth Shadow Controller Report\n\n`;
    content += `**Generated:** ${new Date().toISOString()}\n\n`;
    content += `This report contains hourly shadow plans (recommendations) for posting/reply cadence.\n\n`;
    content += `---\n\n`;
  }
  
  // Append new plan
  const timestamp = new Date(plan.computed_at).toLocaleString();
  content += `## ${timestamp}\n\n`;
  content += `**Posts/Hour:** ${plan.posts_per_hour_recommendation}\n`;
  content += `**Replies/Hour:** ${plan.replies_per_hour_recommendation}\n`;
  content += `**Exploration Rate:** ${(plan.exploration_rate * 100).toFixed(0)}%\n\n`;
  content += `**Explanation:** ${plan.explanation}\n\n`;
  
  if (plan.strategy_weights.top_topics.length > 0) {
    content += `**Top Topics:**\n`;
    plan.strategy_weights.top_topics.forEach(t => {
      content += `- ${t.topic}: ${(t.weight * 100).toFixed(1)}%\n`;
    });
    content += `\n`;
  }
  
  if (plan.strategy_weights.top_formats.length > 0) {
    content += `**Top Formats:**\n`;
    plan.strategy_weights.top_formats.forEach(f => {
      content += `- ${f.format}: ${(f.weight * 100).toFixed(1)}%\n`;
    });
    content += `\n`;
  }
  
  if (plan.strategy_weights.top_generators.length > 0) {
    content += `**Top Generators:**\n`;
    plan.strategy_weights.top_generators.forEach(g => {
      content += `- ${g.generator}: ${(g.weight * 100).toFixed(1)}%\n`;
    });
    content += `\n`;
  }
  
  content += `---\n\n`;
  
  // Write back
  fs.writeFileSync(reportPath, content, 'utf-8');
  console.log(`[SHADOW_CONTROLLER] 📄 Report updated: ${reportPath}`);
}

/**
 * Main entry point
 */
export async function runShadowControllerJob(): Promise<ShadowPlan> {
  try {
    return await generateShadowPlan();
  } catch (error: any) {
    console.error(`[SHADOW_CONTROLLER] ❌ Job failed: ${error.message}`);
    console.error(`[SHADOW_CONTROLLER] ❌ Stack:`, error.stack);
    
    // Record job failure for heartbeat tracking
    try {
      const { recordJobFailure } = await import('./jobHeartbeat');
      await recordJobFailure('shadow_controller', error.message || String(error));
    } catch (err: any) {
      console.warn(`[SHADOW_CONTROLLER] ⚠️ Could not record job failure: ${err.message}`);
    }
    
    throw error;
  }
}
