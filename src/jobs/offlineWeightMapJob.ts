/**
 * 🧮 OFFLINE WEIGHT MAP JOB
 * 
 * Computes weight maps from vw_learning for content generation guidance
 * Runs periodically to update weights based on recent performance (30-60 days)
 * 
 * Phase 1.4: Data & Learning Foundation
 */

import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';
import { calculateWeightedAverage, applyTimeDecay } from '../utils/timeDecayLearning';

interface WeightMap {
  generator_name: Record<string, number>;
  topic?: Record<string, number>;
  tone?: Record<string, number>;
  decision_type: Record<string, number>;
  content_slot?: Record<string, number>;
}

interface LearningDataPoint {
  generator_name: string | null;
  topic: string | null;
  tone: string | null;
  decision_type: string | null;
  content_slot: string | null;
  primary_objective_score: number | null;
  followers_gained_weighted: number | null;
  posted_at: string;
  age_days: number | null;
}

export async function offlineWeightMapJob(): Promise<void> {
  log({ op: 'offline_weight_map_start' });
  console.log('[OFFLINE_WEIGHT_MAP] 🧮 Starting offline weight map computation...');

  try {
    const supabase = getSupabaseClient();

    // Get last 30-60 days of data from vw_learning
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: learningData, error: dataError } = await supabase
      .from('vw_learning')
      .select(`
        generator_name,
        topic,
        tone,
        decision_type,
        content_slot,
        primary_objective_score,
        followers_gained_weighted,
        posted_at,
        age_days,
        has_v2_metrics
      `)
      .gte('posted_at', sixtyDaysAgo.toISOString())
      .eq('has_v2_metrics', true) // Only use posts with v2 metrics
      .not('primary_objective_score', 'is', null)
      .order('posted_at', { ascending: false });

    if (dataError) {
      throw new Error(`Failed to fetch learning data: ${dataError.message}`);
    }

    if (!learningData || learningData.length < 10) {
      console.log(`[OFFLINE_WEIGHT_MAP] ⚠️ Insufficient data: ${learningData?.length || 0} posts (need ≥10)`);
      log({ op: 'offline_weight_map_skipped', reason: 'insufficient_data', count: learningData?.length || 0 });
      return;
    }

    console.log(`[OFFLINE_WEIGHT_MAP] 📊 Analyzing ${learningData.length} posts from last 60 days...`);

    // Filter to last 30-60 days for primary analysis (prefer more recent)
    const recentData = learningData.filter((row: any) => {
      const postedAt = new Date(row.posted_at);
      return postedAt >= thirtyDaysAgo;
    });

    const analysisData = recentData.length >= 20 ? recentData : learningData;
    console.log(`[OFFLINE_WEIGHT_MAP] 📊 Using ${analysisData.length} posts for weight computation`);

    // Compute weights for each feature category
    const weights: WeightMap = {
      generator_name: await computeFeatureWeights(analysisData, 'generator_name'),
      decision_type: await computeFeatureWeights(analysisData, 'decision_type'),
    };

    // Optional features (may not have enough data)
    const topicWeights = await computeFeatureWeights(analysisData, 'topic', false);
    if (Object.keys(topicWeights).length > 0) {
      weights.topic = topicWeights;
    }

    const toneWeights = await computeFeatureWeights(analysisData, 'tone', false);
    if (Object.keys(toneWeights).length > 0) {
      weights.tone = toneWeights;
    }

    const slotWeights = await computeFeatureWeights(analysisData, 'content_slot', false);
    if (Object.keys(slotWeights).length > 0) {
      weights.content_slot = slotWeights;
    }

    // Calculate dataset statistics
    const scores = analysisData
      .map((row: any) => row.primary_objective_score)
      .filter((s: any): s is number => s !== null && typeof s === 'number');
    
    const followersWeighted = analysisData
      .map((row: any) => row.followers_gained_weighted)
      .filter((f: any): f is number => f !== null && typeof f === 'number');

    const avgPrimaryScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : null;

    const avgFollowersWeighted = followersWeighted.length > 0
      ? followersWeighted.reduce((sum, f) => sum + f, 0) / followersWeighted.length
      : null;

    // Deactivate old weight maps
    await supabase
      .from('learning_model_weights')
      .update({ is_active: false })
      .eq('is_active', true);

    // Insert new weight map
    const version = `1.${Date.now()}`; // Simple versioning
    const { error: insertError } = await supabase
      .from('learning_model_weights')
      .insert({
        weights: weights,
        date_range_start: sixtyDaysAgo.toISOString(),
        date_range_end: new Date().toISOString(),
        sample_size: analysisData.length,
        version: version,
        avg_primary_objective_score: avgPrimaryScore,
        avg_followers_gained_weighted: avgFollowersWeighted,
        total_posts_analyzed: analysisData.length,
        is_active: true
      });

    if (insertError) {
      throw new Error(`Failed to insert weight map: ${insertError.message}`);
    }

    console.log(`[OFFLINE_WEIGHT_MAP] ✅ Weight map computed and stored (version ${version})`);
    console.log(`[OFFLINE_WEIGHT_MAP] 📊 Stats: ${analysisData.length} posts, avg_score=${avgPrimaryScore?.toFixed(4) || 'N/A'}, avg_followers=${avgFollowersWeighted?.toFixed(2) || 'N/A'}`);
    console.log(`[OFFLINE_WEIGHT_MAP] 🎯 Generators: ${Object.keys(weights.generator_name).length} weights`);
    console.log(`[OFFLINE_WEIGHT_MAP] 📝 Decision types: ${Object.keys(weights.decision_type).length} weights`);

    log({
      op: 'offline_weight_map_complete',
      version,
      sample_size: analysisData.length,
      generators: Object.keys(weights.generator_name).length,
      avg_score: avgPrimaryScore
    });

  } catch (error: any) {
    console.error(`[OFFLINE_WEIGHT_MAP] ❌ Failed: ${error.message}`);
    log({ op: 'offline_weight_map_error', error: error.message });
    throw error;
  }
}

/**
 * Compute weights for a specific feature category
 */
async function computeFeatureWeights(
  data: LearningDataPoint[],
  featureName: keyof LearningDataPoint,
  required: boolean = true
): Promise<Record<string, number>> {
  // Group data by feature value
  const featureGroups = new Map<string, LearningDataPoint[]>();

  for (const row of data) {
    const featureValue = row[featureName];
    if (!featureValue || featureValue === 'null' || featureValue === '') {
      continue;
    }

    const featureValueStr = String(featureValue);
    if (!featureGroups.has(featureValueStr)) {
      featureGroups.set(featureValueStr, []);
    }
    featureGroups.get(featureValueStr)!.push(row);
  }

  if (featureGroups.size === 0) {
    if (required) {
      console.warn(`[OFFLINE_WEIGHT_MAP] ⚠️ No data for feature ${featureName}`);
    }
    return {};
  }

  // Calculate weighted average score for each feature value (with time decay)
  const featureScores = new Map<string, number>();

  for (const [featureValue, groupData] of featureGroups.entries()) {
    // Apply time decay and calculate weighted average
    const decayedData = applyTimeDecay(groupData, 'primary_objective_score', {
      lambda: 0.1,
      minDecayFactor: 0.1,
      maxAgeDays: 60
    });

    if (decayedData.length === 0) {
      continue;
    }

    const weightedAvg = calculateWeightedAverage(decayedData, 'primary_objective_score');
    featureScores.set(featureValue, weightedAvg);
  }

  if (featureScores.size === 0) {
    return {};
  }

  // Normalize scores to probabilities (weights sum to 1.0)
  const totalScore = Array.from(featureScores.values()).reduce((sum, score) => sum + score, 0);
  
  if (totalScore === 0) {
    // Equal weights if all scores are zero
    const equalWeight = 1.0 / featureScores.size;
    const weights: Record<string, number> = {};
    for (const featureValue of featureScores.keys()) {
      weights[featureValue] = equalWeight;
    }
    return weights;
  }

  // Normalize to probabilities
  const weights: Record<string, number> = {};
  for (const [featureValue, score] of featureScores.entries()) {
    weights[featureValue] = score / totalScore;
  }

  // Ensure weights sum to 1.0 (handle floating point errors)
  const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(weightSum - 1.0) > 0.01) {
    // Renormalize
    for (const key of Object.keys(weights)) {
      weights[key] = weights[key] / weightSum;
    }
  }

  return weights;
}

