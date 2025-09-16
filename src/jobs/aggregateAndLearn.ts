/**
 * Aggregate and Learn Job
 * Hourly job to aggregate metrics and update bandit arms and predictors
 */

import { supabase } from '../lib/supabaseClients';
import { shouldRunLearning } from '../ai/learningScheduler';
import { updateArm } from '../learning/bandits';
import { trainPredictors } from '../learning/predictor';
import { extractFeatures, featuresToArray } from '../learning/featureExtractor';
import { processPostEmbedding } from '../learning/embeddings';
import { RewardReducer } from '../learning/rewardReducer';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface AggregationResult {
  postsProcessed: number;
  armsUpdated: number;
  modelsRetrained: boolean;
  embeddingsProcessed: number;
  errors: string[];
}

export interface PostOutcome {
  postId: string;
  engagementRate: number;
  followThrough: number;
  viralScore: number;
  impressions: number;
  banditArm?: string;
  timingArm?: string;
  experimentId?: string;
}

const ENGAGEMENT_THRESHOLDS = {
  low: 0.01,    // 1% ER
  medium: 0.03, // 3% ER  
  high: 0.06    // 6% ER
};

const VIRAL_THRESHOLD = 0.10; // 10% ER for viral content
const MIN_IMPRESSIONS = 100; // Minimum impressions to consider reliable

/**
 * Calculate engagement rate from metrics
 */
function calculateEngagementRate(likes: number, retweets: number, replies: number, impressions: number): number {
  if (impressions < MIN_IMPRESSIONS) return 0;
  const totalEngagement = likes + retweets + replies;
  return totalEngagement / impressions;
}

/**
 * Calculate follow-through rate (followers / impressions)
 */
function calculateFollowThrough(followersAttributed: number, impressions: number): number {
  if (impressions < MIN_IMPRESSIONS) return 0;
  return followersAttributed / impressions;
}

/**
 * Calculate viral score (combination of ER and velocity)
 */
function calculateViralScore(engagementRate: number, impressions: number, hoursOld: number): number {
  // Viral content typically has high ER and rapid early engagement
  const erFactor = Math.min(engagementRate / VIRAL_THRESHOLD, 1.0);
  const impressionFactor = Math.log10(Math.max(impressions, 1)) / 6; // Log scale, max at 1M impressions
  const timeFactor = Math.max(0, 1 - hoursOld / 24); // Decay over 24 hours
  
  return erFactor * 0.5 + impressionFactor * 0.3 + timeFactor * 0.2;
}

/**
 * Convert engagement rate to bandit reward
 */
function engagementToReward(engagementRate: number): number {
  if (engagementRate >= ENGAGEMENT_THRESHOLDS.high) return 1.0;
  if (engagementRate >= ENGAGEMENT_THRESHOLDS.medium) return 0.7;
  if (engagementRate >= ENGAGEMENT_THRESHOLDS.low) return 0.4;
  return 0.0;
}

/**
 * Convert follow-through to bandit reward
 */
function followThroughToReward(followThrough: number): number {
  if (followThrough >= 0.005) return 1.0; // 0.5% is excellent
  if (followThrough >= 0.002) return 0.7; // 0.2% is good
  if (followThrough >= 0.001) return 0.4; // 0.1% is okay
  return 0.0;
}

/**
 * Aggregate metrics from 8-phase tracking
 */
async function aggregatePostMetrics(cutoffDate: Date): Promise<PostOutcome[]> {
  try {
    log(`AGGREGATE_METRICS: Processing posts since ${cutoffDate.toISOString()}`);
    
    // Get posts with their latest metrics from each phase
    const { data: posts, error } = await supabase
      .from('unified_posts')
      .select(`
        post_id,
        content,
        posted_at,
        bandit_arm,
        timing_arm,
        experiment_id,
        followers_before,
        followers_attributed,
        content_metadata (
          style,
          fact_source,
          topic,
          hook_type,
          cta_type,
          quality_score
        )
      `)
      .gte('posted_at', cutoffDate.toISOString())
      .order('posted_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!posts || posts.length === 0) {
      log(`AGGREGATE_METRICS: No posts found since cutoff`);
      return [];
    }
    
    const outcomes: PostOutcome[] = [];
    
    for (const post of posts) {
      try {
        // Get latest metrics from all phases
        const { data: phases, error: phaseError } = await supabase
          .from('metrics_by_phase')
          .select('phase, likes, retweets, replies, impressions, collected_at')
          .eq('tweet_id', post.post_id)
          .order('collected_at', { ascending: false });
        
        if (phaseError || !phases || phases.length === 0) {
          warn(`AGGREGATE_METRICS_SKIP: No metrics for ${post.post_id}`);
          continue;
        }
        
        // Use the most recent complete metric set
        const latestPhase = phases[0];
        const impressions = latestPhase.impressions || 0;
        const likes = latestPhase.likes || 0;
        const retweets = latestPhase.retweets || 0;
        const replies = latestPhase.replies || 0;
        
        if (impressions < MIN_IMPRESSIONS) {
          continue; // Skip posts without sufficient impressions
        }
        
        // Calculate outcomes
        const engagementRate = calculateEngagementRate(likes, retweets, replies, impressions);
        const followThrough = calculateFollowThrough(post.followers_attributed || 0, impressions);
        
        const hoursOld = (new Date().getTime() - new Date(post.posted_at).getTime()) / (1000 * 60 * 60);
        const viralScore = calculateViralScore(engagementRate, impressions, hoursOld);
        
        outcomes.push({
          postId: post.post_id,
          engagementRate,
          followThrough,
          viralScore,
          impressions,
          banditArm: post.bandit_arm,
          timingArm: post.timing_arm,
          experimentId: post.experiment_id
        });
        
        log(`AGGREGATE_POST: ${post.post_id} ER=${engagementRate.toFixed(4)} FT=${followThrough.toFixed(6)} viral=${viralScore.toFixed(3)} impressions=${impressions}`);
        
      } catch (err) {
        warn(`AGGREGATE_POST_ERROR: ${post.post_id}: ${err}`);
      }
    }
    
    log(`AGGREGATE_METRICS_COMPLETE: ${outcomes.length} posts processed`);
    return outcomes;
    
  } catch (err: any) {
    error(`AGGREGATE_METRICS_ERROR: ${err.message}`);
    throw err;
  }
}

/**
 * Update bandit arms with aggregated outcomes
 */
async function updateBanditArms(outcomes: PostOutcome[]): Promise<number> {
  let armsUpdated = 0;
  
  for (const outcome of outcomes) {
    try {
      // Update content arm if available
      if (outcome.banditArm) {
        const contentReward = engagementToReward(outcome.engagementRate);
        await updateArm('content', outcome.banditArm, contentReward);
        armsUpdated++;
        
        log(`BANDIT_UPDATE_CONTENT: arm=${outcome.banditArm} reward=${contentReward} ER=${outcome.engagementRate.toFixed(4)}`);
      }
      
      // Update timing arm if available
      if (outcome.timingArm) {
        // For timing, use combination of ER and follow-through
        const timingReward = (engagementToReward(outcome.engagementRate) + followThroughToReward(outcome.followThrough)) / 2;
        await updateArm('timing', outcome.timingArm, timingReward);
        armsUpdated++;
        
        log(`BANDIT_UPDATE_TIMING: arm=${outcome.timingArm} reward=${timingReward.toFixed(3)} ER=${outcome.engagementRate.toFixed(4)} FT=${outcome.followThrough.toFixed(6)}`);
      }
      
    } catch (err) {
      warn(`BANDIT_UPDATE_ERROR: postId=${outcome.postId}: ${err}`);
    }
  }
  
  log(`BANDIT_ARMS_UPDATED: ${armsUpdated} arms updated`);
  return armsUpdated;
}

/**
 * Process missing embeddings and features
 */
async function processMissingData(cutoffDate: Date): Promise<number> {
  let processed = 0;
  
  try {
    // Find posts without embeddings or features
    const { data: posts, error } = await supabase
      .from('unified_posts')
      .select(`
        post_id,
        content,
        content_metadata (
          content_hash,
          embedding,
          features
        )
      `)
      .gte('posted_at', cutoffDate.toISOString())
      .order('posted_at', { ascending: false })
      .limit(50); // Process in batches
    
    if (error || !posts) {
      return 0;
    }
    
    for (const post of posts) {
      try {
        let needsUpdate = false;
        const updates: any = {};
        
        // Check if embedding is missing
        if (!(post.content_metadata as any)?.embedding && !(post.content_metadata as any)?.content_hash) {
          const hash = await processPostEmbedding(post.post_id, post.content);
          updates.content_hash = hash;
          needsUpdate = true;
          processed++;
        }
        
        // Check if features are missing
        if (!(post.content_metadata as any)?.features) {
          const features = extractFeatures(post.content, post.content_metadata || {});
          updates.features = features;
          needsUpdate = true;
        }
        
        // Update metadata if needed
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('content_metadata')
            .update(updates)
            .eq('content_id', post.post_id);
          
          if (updateError) {
            warn(`PROCESS_DATA_UPDATE_ERROR: ${post.post_id}: ${updateError.message}`);
          }
        }
        
      } catch (err) {
        warn(`PROCESS_DATA_POST_ERROR: ${post.post_id}: ${err}`);
      }
    }
    
    log(`PROCESS_MISSING_DATA: ${processed} posts processed`);
    return processed;
    
  } catch (err: any) {
    error(`PROCESS_MISSING_DATA_ERROR: ${err.message}`);
    return 0;
  }
}

/**
 * Main aggregation and learning job
 */
export async function runAggregateAndLearn(): Promise<AggregationResult> {
  log(`AGGREGATE_LEARN_JOB: Starting aggregation and learning job`);
  
  // Check if learning should run (debounced)
  if (!(await shouldRunLearning())) {
    log(`AGGREGATE_LEARN_JOB: Skipped due to learning debounce`);
    return {
      postsProcessed: 0,
      armsUpdated: 0,
      modelsRetrained: false,
      embeddingsProcessed: 0,
      errors: ['Skipped due to learning debounce']
    };
  }
  
  const errors: string[] = [];
  let postsProcessed = 0;
  let armsUpdated = 0;
  let modelsRetrained = false;
  let embeddingsProcessed = 0;
  
  try {
    // Process posts from the last 24 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);
    
    // Step 1: Aggregate post metrics
    const outcomes = await aggregatePostMetrics(cutoffDate);
    postsProcessed = outcomes.length;
    
    // Step 2: Update bandit arms
    if (outcomes.length > 0) {
      armsUpdated = await updateBanditArms(outcomes);
    }
    
    // Step 3: Process missing embeddings and features
    embeddingsProcessed = await processMissingData(cutoffDate);
    
    // Step 4: Retrain predictors if we have enough new data
    if (postsProcessed >= 10) {
      try {
        await trainPredictors();
        modelsRetrained = true;
        log(`AGGREGATE_LEARN_JOB: Predictors retrained with ${postsProcessed} recent posts`);
      } catch (err: any) {
        errors.push(`Predictor training failed: ${err.message}`);
        warn(`PREDICTOR_TRAINING_ERROR: ${err.message}`);
      }
    }
    
    log(`AGGREGATE_LEARN_JOB_COMPLETE: posts=${postsProcessed} arms=${armsUpdated} retrained=${modelsRetrained} embeddings=${embeddingsProcessed}`);
    
  } catch (err: any) {
    error(`AGGREGATE_LEARN_JOB_ERROR: ${err.message}`);
    errors.push(`Job error: ${err.message}`);
  }
  
  return {
    postsProcessed,
    armsUpdated,
    modelsRetrained,
    embeddingsProcessed,
    errors
  };
}

/**
 * Get learning job status
 */
export async function getLearningJobStatus(): Promise<{
  lastRun?: Date;
  nextRun?: Date;
  recentOutcomes: {
    date: string;
    postsProcessed: number;
    armsUpdated: number;
    modelsRetrained: boolean;
  }[];
}> {
  try {
    // This would typically be stored in a job status table
    // For now, we'll estimate based on recent activity
    
    const { data: recentPosts, error } = await supabase
      .from('unified_posts')
      .select('posted_at')
      .order('posted_at', { ascending: false })
      .limit(1);
    
    const lastPostTime = recentPosts?.[0]?.posted_at ? new Date(recentPosts[0].posted_at) : undefined;
    
    // Estimate next run (hourly)
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1);
    nextRun.setMinutes(0);
    nextRun.setSeconds(0);
    
    return {
      lastRun: lastPostTime,
      nextRun,
      recentOutcomes: [] // Would be populated from job history table
    };
    
  } catch (err: any) {
    error(`LEARNING_JOB_STATUS_ERROR: ${err.message}`);
    return {
      recentOutcomes: []
    };
  }
}
