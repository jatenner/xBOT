/**
 * 🧠 LEARNING LOOP
 * 
 * Daily job that:
 * 1. Computes outcome_score for recent posts/replies
 * 2. Updates strategy_weights, hour_weights, prompt_version_weights
 * 3. Adjusts target caps based on performance
 */

import { getSupabaseClient } from '../db/index';

/**
 * Compute outcome score for a post/reply
 * Formula: (likes + retweets*2 + replies*3 + bookmarks*0.5) / max(1, impressions)
 */
function computeOutcomeScore(
  likes: number,
  retweets: number,
  replies: number,
  bookmarks: number,
  impressions: number
): number {
  const engagement = likes + retweets * 2 + replies * 3 + bookmarks * 0.5;
  return engagement / Math.max(1, impressions);
}

/**
 * Update outcome_score in content_metadata
 */
export async function updateOutcomeScores(): Promise<void> {
  console.log('[LEARNING_LOOP] 🧠 Updating outcome scores...');

  const supabase = getSupabaseClient();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch recent posts without outcome_score
  const { data: recentPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, actual_likes, actual_retweets, actual_replies, actual_impressions')
    .eq('status', 'posted')
    .gte('posted_at', twentyFourHoursAgo.toISOString())
    .is('outcome_score', null)
    .limit(100);

  if (!recentPosts || recentPosts.length === 0) {
    console.log('[LEARNING_LOOP] ✅ No posts to update');
    return;
  }

  // Update outcome_score for each post
  for (const post of recentPosts) {
    const score = computeOutcomeScore(
      post.actual_likes || 0,
      post.actual_retweets || 0,
      post.actual_replies || 0,
      0, // bookmarks not always available
      post.actual_impressions || 1
    );

    await supabase
      .from('content_metadata')
      .update({ outcome_score: score })
      .eq('decision_id', post.decision_id);
  }

  console.log(`[LEARNING_LOOP] ✅ Updated ${recentPosts.length} outcome scores`);
}

/**
 * Update strategy weights based on performance
 */
export async function updateStrategyWeights(): Promise<void> {
  console.log('[LEARNING_LOOP] 🎯 Updating strategy weights...');

  const supabase = getSupabaseClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch posts with strategy_id and outcome_score
  const { data: strategyPosts } = await supabase
    .from('content_metadata')
    .select('strategy_id, outcome_score')
    .eq('status', 'posted')
    .gte('posted_at', sevenDaysAgo.toISOString())
    .not('strategy_id', 'is', null)
    .not('outcome_score', 'is', null);

  if (!strategyPosts || strategyPosts.length === 0) {
    console.log('[LEARNING_LOOP] ⚠️ No strategy posts found');
    return;
  }

  // Group by strategy_id
  const strategyStats: Record<string, { total: number; sum: number; count: number }> = {};
  for (const post of strategyPosts) {
    if (!post.strategy_id) continue;
    if (!strategyStats[post.strategy_id]) {
      strategyStats[post.strategy_id] = { total: 0, sum: 0, count: 0 };
    }
    strategyStats[post.strategy_id].count++;
    strategyStats[post.strategy_id].sum += post.outcome_score || 0;
  }

  // Update weights (normalize to 0-10 scale, baseline = 1.0)
  for (const [strategyId, stats] of Object.entries(strategyStats)) {
    const avgScore = stats.sum / stats.count;
    // Normalize: avgScore of 0.05 (5% ER) = weight 5.0, 0.01 (1% ER) = weight 1.0
    const weight = Math.max(0.1, Math.min(10, avgScore * 100));

    await supabase
      .from('strategy_weights')
      .upsert({
        strategy_id: strategyId,
        weight,
        total_posts: stats.count,
        total_outcome_score: stats.sum,
        avg_outcome_score: avgScore,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'strategy_id',
      });
  }

  console.log(`[LEARNING_LOOP] ✅ Updated ${Object.keys(strategyStats).length} strategy weights`);
}

/**
 * Update hour weights based on performance
 */
export async function updateHourWeights(): Promise<void> {
  console.log('[LEARNING_LOOP] ⏰ Updating hour weights...');

  const supabase = getSupabaseClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch posts with hour_bucket and outcome_score
  const { data: hourPosts } = await supabase
    .from('content_metadata')
    .select('hour_bucket, outcome_score')
    .eq('status', 'posted')
    .gte('posted_at', sevenDaysAgo.toISOString())
    .not('hour_bucket', 'is', null)
    .not('outcome_score', 'is', null);

  if (!hourPosts || hourPosts.length === 0) {
    console.log('[LEARNING_LOOP] ⚠️ No hour posts found');
    return;
  }

  // Group by hour_bucket
  const hourStats: Record<number, { sum: number; count: number }> = {};
  for (const post of hourPosts) {
    if (post.hour_bucket === null) continue;
    const hour = post.hour_bucket;
    if (!hourStats[hour]) {
      hourStats[hour] = { sum: 0, count: 0 };
    }
    hourStats[hour].count++;
    hourStats[hour].sum += post.outcome_score || 0;
  }

  // Update weights (normalize to 0-2 scale, baseline = 1.0)
  const globalAvg = Object.values(hourStats).reduce((sum, stats) => sum + stats.sum, 0) /
    Math.max(1, Object.values(hourStats).reduce((sum, stats) => sum + stats.count, 0));

  for (const [hourStr, stats] of Object.entries(hourStats)) {
    const hour = parseInt(hourStr);
    const avgScore = stats.sum / stats.count;
    // Weight relative to global average (1.0 = average, 2.0 = 2x average, 0.5 = 0.5x average)
    const weight = Math.max(0.1, Math.min(2, avgScore / Math.max(0.001, globalAvg)));

    await supabase
      .from('hour_weights')
      .upsert({
        hour_bucket: hour,
        weight,
        total_posts: stats.count,
        total_outcome_score: stats.sum,
        avg_outcome_score: avgScore,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'hour_bucket',
      });
  }

  console.log(`[LEARNING_LOOP] ✅ Updated ${Object.keys(hourStats).length} hour weights`);
}

/**
 * Update prompt_version weights
 */
export async function updatePromptVersionWeights(): Promise<void> {
  console.log('[LEARNING_LOOP] 📝 Updating prompt version weights...');

  const supabase = getSupabaseClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch posts with prompt_version and outcome_score
  const { data: versionPosts } = await supabase
    .from('content_metadata')
    .select('prompt_version, outcome_score')
    .eq('status', 'posted')
    .gte('posted_at', sevenDaysAgo.toISOString())
    .not('prompt_version', 'is', null)
    .not('outcome_score', 'is', null);

  if (!versionPosts || versionPosts.length === 0) {
    console.log('[LEARNING_LOOP] ⚠️ No prompt version posts found');
    return;
  }

  // Group by prompt_version
  const versionStats: Record<string, { sum: number; count: number }> = {};
  for (const post of versionPosts) {
    if (!post.prompt_version) continue;
    if (!versionStats[post.prompt_version]) {
      versionStats[post.prompt_version] = { sum: 0, count: 0 };
    }
    versionStats[post.prompt_version].count++;
    versionStats[post.prompt_version].sum += post.outcome_score || 0;
  }

  // Update weights (normalize to 0-10 scale)
  for (const [version, stats] of Object.entries(versionStats)) {
    const avgScore = stats.sum / stats.count;
    const weight = Math.max(0.1, Math.min(10, avgScore * 100));

    await supabase
      .from('prompt_version_weights')
      .upsert({
        prompt_version: version,
        weight,
        total_posts: stats.count,
        total_outcome_score: stats.sum,
        avg_outcome_score: avgScore,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'prompt_version',
      });
  }

  console.log(`[LEARNING_LOOP] ✅ Updated ${Object.keys(versionStats).length} prompt version weights`);
}

/**
 * Run full learning loop
 */
export async function runLearningLoop(): Promise<void> {
  console.log('[LEARNING_LOOP] 🧠 Starting learning loop...');

  await updateOutcomeScores();
  await updateStrategyWeights();
  await updateHourWeights();
  await updatePromptVersionWeights();

  console.log('[LEARNING_LOOP] ✅ Learning loop complete');
}
