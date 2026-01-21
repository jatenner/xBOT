/**
 * 🎯 REWARD COMPUTATION JOB
 * 
 * Computes reward scores and features for learning from performance snapshots.
 * Joins decision metadata with performance data and follower attribution.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../db/index';

interface RewardWeights {
  followers_weight: number;
  impressions_weight: number;
  bookmarks_weight: number;
}

/**
 * Compute reward features for decisions with complete snapshot data
 */
export async function computeRewardFeatures(): Promise<number> {
  console.log('[REWARD_COMPUTATION] 🎯 Computing reward features...');
  
  const supabase = getSupabaseClient();
  
  // Get reward weights from env (defaults)
  const weights: RewardWeights = {
    followers_weight: parseFloat(process.env.REWARD_FOLLOWERS_WEIGHT || '0.5'),
    impressions_weight: parseFloat(process.env.REWARD_IMPRESSIONS_WEIGHT || '0.3'),
    bookmarks_weight: parseFloat(process.env.REWARD_BOOKMARKS_WEIGHT || '0.2'),
  };
  
  // Find decisions with both 1h and 24h snapshots that don't have reward_features yet
  const { data: decisions } = await supabase
    .from('content_metadata')
    .select(`
      decision_id,
      decision_type,
      posted_at,
      generator_name,
      raw_topic,
      format_strategy,
      tweet_id
    `)
    .eq('status', 'posted')
    .not('posted_at', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(100); // Process recent decisions
  
  if (!decisions || decisions.length === 0) {
    console.log('[REWARD_COMPUTATION] ✅ No decisions to process');
    return 0;
  }
  
  let computed = 0;
  
  for (const decision of decisions) {
    try {
      // Check if reward_features already exists
      const { data: existing } = await supabase
        .from('reward_features')
        .select('id')
        .eq('decision_id', decision.decision_id)
        .maybeSingle();
      
      if (existing) {
        continue; // Already computed
      }
      
      // Get performance snapshots
      const { data: snapshots } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('decision_id', decision.decision_id)
        .in('horizon_minutes', [60, 1440]);
      
      if (!snapshots || snapshots.length < 2) {
        // Need both 1h and 24h snapshots
        continue;
      }
      
      const snapshot1h = snapshots.find(s => s.horizon_minutes === 60);
      const snapshot24h = snapshots.find(s => s.horizon_minutes === 1440);
      
      if (!snapshot1h || !snapshot24h) {
        continue;
      }
      
      // Get follower attribution
      const followerDelta = await getFollowerDelta24h(decision.posted_at);
      
      // Compute reward score
      const rewardScore = computeRewardScore(
        followerDelta,
        snapshot24h.impressions || 0,
        snapshot24h.bookmarks || 0,
        weights
      );
      
      // Compute F/1K (followers per 1000 impressions)
      const fPer1k = snapshot24h.impressions > 0
        ? (followerDelta / snapshot24h.impressions) * 1000
        : 0;
      
      // Extract hour of day
      const postedAt = new Date(decision.posted_at);
      const hourOfDay = postedAt.getHours();
      
      // Store reward features
      const { error } = await supabase
        .from('reward_features')
        .insert({
          decision_id: decision.decision_id,
          decision_type: decision.decision_type,
          posted_at: decision.posted_at,
          hour_of_day: hourOfDay,
          generator_name: decision.generator_name,
          raw_topic: decision.raw_topic,
          format_strategy: decision.format_strategy,
          impressions_1h: snapshot1h.impressions || 0,
          impressions_24h: snapshot24h.impressions || 0,
          likes_1h: snapshot1h.likes || 0,
          likes_24h: snapshot24h.likes || 0,
          bookmarks_24h: snapshot24h.bookmarks || 0,
          follower_delta_24h: followerDelta,
          reward_score: rewardScore,
          reward_components: {
            followers_component: followerDelta * weights.followers_weight,
            impressions_component: (snapshot24h.impressions || 0) * weights.impressions_weight,
            bookmarks_component: (snapshot24h.bookmarks || 0) * weights.bookmarks_weight,
          },
          f_per_1k_impressions: fPer1k,
        });
      
      if (error) {
        console.error(`[REWARD_COMPUTATION] ❌ Failed to store reward features: ${error.message}`);
        continue;
      }
      
      console.log(`[REWARD_COMPUTATION] ✅ Computed reward: decision_id=${decision.decision_id} reward_score=${rewardScore.toFixed(2)} f_per_1k=${fPer1k.toFixed(2)}`);
      computed++;
      
    } catch (error: any) {
      console.error(`[REWARD_COMPUTATION] ❌ Error processing decision ${decision.decision_id}: ${error.message}`);
      continue;
    }
  }
  
  return computed;
}

/**
 * Get follower delta over 24h window
 */
async function getFollowerDelta24h(postedAt: string): Promise<number> {
  const supabase = getSupabaseClient();
  const posted = new Date(postedAt);
  const before24h = new Date(posted.getTime() - 24 * 60 * 60 * 1000);
  const after24h = new Date(posted.getTime() + 24 * 60 * 60 * 1000);
  
  // Get snapshot before posting (nearest before)
  const { data: before } = await supabase
    .from('account_snapshots')
    .select('followers_count, timestamp')
    .lte('timestamp', posted.toISOString())
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // Get snapshot after 24h (nearest after)
  const { data: after } = await supabase
    .from('account_snapshots')
    .select('followers_count, timestamp')
    .gte('timestamp', after24h.toISOString())
    .order('timestamp', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (!before || !after) {
    // Try to get any snapshots in the window
    const { data: snapshots } = await supabase
      .from('account_snapshots')
      .select('followers_count, timestamp')
      .gte('timestamp', before24h.toISOString())
      .lte('timestamp', after24h.toISOString())
      .order('timestamp', { ascending: true });
    
    if (!snapshots || snapshots.length < 2) {
      return 0; // Not enough data
    }
    
    const first = Number(snapshots[0].followers_count) || 0;
    const last = Number(snapshots[snapshots.length - 1].followers_count) || 0;
    return last - first;
  }
  
  const beforeCount = Number(before.followers_count) || 0;
  const afterCount = Number(after.followers_count) || 0;
  
  return afterCount - beforeCount;
}

/**
 * Compute reward score from components
 */
function computeRewardScore(
  followerDelta: number,
  impressions24h: number,
  bookmarks24h: number,
  weights: RewardWeights
): number {
  const followersComponent = followerDelta * weights.followers_weight;
  const impressionsComponent = impressions24h * weights.impressions_weight;
  const bookmarksComponent = bookmarks24h * weights.bookmarks_weight;
  
  return followersComponent + impressionsComponent + bookmarksComponent;
}

/**
 * Compute daily aggregates
 */
export async function computeDailyAggregates(): Promise<number> {
  console.log('[REWARD_COMPUTATION] 📊 Computing daily aggregates...');
  
  const supabase = getSupabaseClient();
  
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  // Get all reward features from yesterday
  const { data: rewards } = await supabase
    .from('reward_features')
    .select('*')
    .gte('posted_at', yesterday.toISOString())
    .lt('posted_at', new Date(yesterday.getTime() + 24 * 60 * 60 * 1000).toISOString());
  
  if (!rewards || rewards.length === 0) {
    console.log(`[REWARD_COMPUTATION] ✅ No rewards for ${dateStr}`);
    return 0;
  }
  
  // Aggregate by dimension
  const aggregates: Record<string, any> = {};
  
  // By hour_of_day
  for (let hour = 0; hour < 24; hour++) {
    const hourRewards = rewards.filter(r => r.hour_of_day === hour);
    if (hourRewards.length > 0) {
      aggregates[`hour_${hour}`] = aggregateRewards(hourRewards, 'hour_of_day', hour.toString());
    }
  }
  
  // By decision_type
  const types = [...new Set(rewards.map(r => r.decision_type))];
  for (const type of types) {
    const typeRewards = rewards.filter(r => r.decision_type === type);
    aggregates[`type_${type}`] = aggregateRewards(typeRewards, 'decision_type', type);
  }
  
  // By format_strategy
  const formats = [...new Set(rewards.map(r => r.format_strategy).filter(Boolean))];
  for (const format of formats) {
    const formatRewards = rewards.filter(r => r.format_strategy === format);
    aggregates[`format_${format}`] = aggregateRewards(formatRewards, 'format_strategy', format);
  }
  
  // By generator_name
  const generators = [...new Set(rewards.map(r => r.generator_name).filter(Boolean))];
  for (const generator of generators) {
    const genRewards = rewards.filter(r => r.generator_name === generator);
    aggregates[`generator_${generator}`] = aggregateRewards(genRewards, 'generator_name', generator);
  }
  
  // Store aggregates
  let stored = 0;
  for (const [key, agg] of Object.entries(aggregates)) {
    const [dimType, dimValue] = key.split('_', 2);
    
    const { error } = await supabase
      .from('daily_aggregates')
      .upsert({
        date: dateStr,
        dimension_type: dimType,
        dimension_value: dimValue,
        total_decisions: agg.total_decisions,
        total_impressions_24h: agg.total_impressions_24h,
        total_likes_24h: agg.total_likes_24h,
        total_bookmarks_24h: agg.total_bookmarks_24h,
        total_follower_delta_24h: agg.total_follower_delta_24h,
        avg_reward_score: agg.avg_reward_score,
        avg_f_per_1k: agg.avg_f_per_1k,
      }, {
        onConflict: 'date,dimension_type,dimension_value',
      });
    
    if (!error) {
      stored++;
    }
  }
  
  console.log(`[REWARD_COMPUTATION] ✅ Stored ${stored} daily aggregates for ${dateStr}`);
  return stored;
}

/**
 * Aggregate rewards for a dimension
 */
function aggregateRewards(
  rewards: any[],
  dimensionType: string,
  dimensionValue: string
): any {
  const total = rewards.length;
  const totalImpressions = rewards.reduce((sum, r) => sum + (r.impressions_24h || 0), 0);
  const totalLikes = rewards.reduce((sum, r) => sum + (r.likes_24h || 0), 0);
  const totalBookmarks = rewards.reduce((sum, r) => sum + (r.bookmarks_24h || 0), 0);
  const totalFollowerDelta = rewards.reduce((sum, r) => sum + (r.follower_delta_24h || 0), 0);
  const avgReward = rewards.reduce((sum, r) => sum + (r.reward_score || 0), 0) / total;
  const avgFPer1k = rewards.reduce((sum, r) => sum + (r.f_per_1k_impressions || 0), 0) / total;
  
  return {
    total_decisions: total,
    total_impressions_24h: totalImpressions,
    total_likes_24h: totalLikes,
    total_bookmarks_24h: totalBookmarks,
    total_follower_delta_24h: totalFollowerDelta,
    avg_reward_score: avgReward,
    avg_f_per_1k: avgFPer1k,
  };
}

/**
 * Main entry point
 */
export async function runRewardComputationJob(): Promise<void> {
  try {
    const computed = await computeRewardFeatures();
    console.log(`[REWARD_COMPUTATION] ✅ Computed ${computed} reward features`);
    
    // Compute daily aggregates (runs less frequently, but included here for completeness)
    // await computeDailyAggregates();
  } catch (error: any) {
    console.error(`[REWARD_COMPUTATION] ❌ Job failed: ${error.message}`);
    throw error;
  }
}
