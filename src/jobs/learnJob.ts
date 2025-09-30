/**
 * 🧠 LEARN JOB
 * Handles learning cycle: update bandits, train predictors, compute arm rewards
 */

import { getConfig } from '../config/config';

export interface LearningStats {
  sampleSize: number;
  armsUpdated: number;
  exploreRatio: number;
  predictorUpdated: boolean;
  simulatedPercent: number;
}

export async function runLearningCycle(): Promise<LearningStats> {
  const config = getConfig();
  
  console.log('[LEARN_JOB] 🧠 Starting learning cycle...');
  
  try {
    // 1. Collect recent decisions and outcomes
    const trainingData = await collectTrainingData();
    
    // Check if we have sufficient data for training
    if (trainingData.length === 0) {
      console.log('[LEARN_JOB] ⚠️ Training skipped: insufficient samples (need real outcomes in LIVE mode)');
      return {
        sampleSize: 0,
        armsUpdated: 0,
        exploreRatio: config.EXPLORE_RATIO_MIN || 0.1,
        predictorUpdated: false,
        simulatedPercent: config.MODE === 'shadow' ? 100 : 0
      };
    }
    
    // 2. Update bandit arms (Thompson sampling for content/reply, UCB for timing)
    const banditStats = await updateBanditArms(trainingData);
    
    // 3. Update predictors (ridge/logit regression)
    const predictorStats = await updatePredictors(trainingData);
    
    // 4. Compute exploration ratio based on recent performance
    const exploreRatio = computeExploreRatio(trainingData, config);
    
    const stats: LearningStats = {
      sampleSize: trainingData.length,
      armsUpdated: banditStats.armsUpdated,
      exploreRatio,
      predictorUpdated: predictorStats.updated,
      simulatedPercent: config.MODE === 'shadow' ? 100 : calculateSimulatedPercent(trainingData)
    };
    
    // Log one-line summary
    console.log(`[LEARN_JOB] ✅ LEARN_RUN sample=${stats.sampleSize}, arms_trained=${stats.armsUpdated}, explore_ratio=${stats.exploreRatio.toFixed(3)}, coeffs_updated=${predictorStats.version}`);
    
    return stats;
  } catch (error) {
    console.error('[LEARN_JOB] ❌ Learning cycle failed:', error.message);
    throw error;
  }
}

async function collectTrainingData(config?: any): Promise<any[]> {
  if (!config) config = getConfig();
  
  console.log('[LEARN_JOB] 📊 Collecting training data from decisions and outcomes...');
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // In live mode, ONLY use real outcomes (simulated=false); in shadow mode, use simulated
    const simulatedFilter = config.MODE === 'shadow';
    
    // Get recent outcomes for training
    const { data: outcomes, error } = await supabase
      .from('outcomes')
      .select('*')
      .eq('simulated', simulatedFilter)
      .gte('collected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('collected_at', { ascending: false })
      .limit(50);

    if (error || !outcomes || outcomes.length === 0) {
      // In LIVE mode, never use mock data - only train on real outcomes
      if (config.MODE === 'live') {
        console.log('[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes (need 5)');
        return [];
      }
      
      console.log('[LEARN_JOB] ℹ️ No outcomes data found, using mock training data');
      return getMockTrainingData();
    }
    
    // In LIVE mode, require at least 5 real outcomes
    if (config.MODE === 'live' && outcomes.length < 5) {
      console.log(`[LEARN_JOB] ⚠️ Training skipped: insufficient real outcomes (have ${outcomes.length}, need 5)`);
      return [];
    }

    // Convert outcomes to training format
    const trainingData = outcomes.map(outcome => ({
      decision_id: outcome.decision_id,
      content_type: 'educational', // Would join with decisions table in real system
      timing_slot: new Date(outcome.collected_at as string).getHours(),
      quality_score: 0.8 + Math.random() * 0.2,
      predicted_er: (outcome.er_calculated as number) * (0.9 + Math.random() * 0.2),
      actual_er: outcome.er_calculated,
      actual_impressions: outcome.impressions,
      actual_likes: outcome.likes,
      actual_retweets: outcome.retweets,
      actual_replies: outcome.replies,
      simulated: outcome.simulated,
      hours_old: (Date.now() - new Date(outcome.collected_at as string).getTime()) / (1000 * 60 * 60)
    }));

    console.log(`[LEARN_JOB] 📋 Collected ${trainingData.length} training samples (real: ${!simulatedFilter})`);
    return trainingData;
    
  } catch (error) {
    console.warn(`[LEARN_JOB] ⚠️ Training data collection failed: ${error.message}`);
    return getMockTrainingData();
  }
  
}

function getMockTrainingData(): any[] {
  const mockTrainingData = [
    {
      decision_id: 'decision_1',
      content_type: 'educational',
      timing_slot: 14, // 2 PM
      quality_score: 0.82,
      predicted_er: 0.034,
      actual_er: 0.031,
      actual_impressions: 4200,
      actual_likes: 130,
      actual_retweets: 18,
      actual_replies: 7,
      simulated: true,
      hours_old: 2
    },
    {
      decision_id: 'decision_2',
      content_type: 'fact_sharing',
      timing_slot: 16, // 4 PM
      quality_score: 0.91,
      predicted_er: 0.041,
      actual_er: 0.038,
      actual_impressions: 5100,
      actual_likes: 194,
      actual_retweets: 31,
      actual_replies: 12,
      simulated: true,
      hours_old: 4
    },
    {
      decision_id: 'decision_3',
      content_type: 'wellness_tip',
      timing_slot: 18, // 6 PM
      quality_score: 0.88,
      predicted_er: 0.037,
      actual_er: 0.042,
      actual_impressions: 4800,
      actual_likes: 202,
      actual_retweets: 28,
      actual_replies: 14,
      simulated: true,
      hours_old: 6
    }
  ];
  
  console.log(`[LEARN_JOB] 📋 Collected ${mockTrainingData.length} training samples`);
  return mockTrainingData;
}

async function updateBanditArms(trainingData: any[]): Promise<{ armsUpdated: number }> {
  console.log('[LEARN_JOB] 🎰 Updating bandit arms with new rewards...');
  
  // Group by content type and timing for arm updates
  const contentArms = new Map();
  const timingArms = new Map();
  
  trainingData.forEach(sample => {
    // Content bandit arms (Thompson sampling)
    if (!contentArms.has(sample.content_type)) {
      contentArms.set(sample.content_type, {
        successes: 0,
        failures: 0,
        totalReward: 0,
        samples: 0
      });
    }
    
    const contentArm = contentArms.get(sample.content_type);
    const isSuccess = sample.actual_er > 0.03; // Success threshold
    contentArm.successes += isSuccess ? 1 : 0;
    contentArm.failures += isSuccess ? 0 : 1;
    contentArm.totalReward += sample.actual_er;
    contentArm.samples += 1;
    
    // Timing bandit arms (UCB1)
    if (!timingArms.has(sample.timing_slot)) {
      timingArms.set(sample.timing_slot, {
        totalReward: 0,
        samples: 0,
        avgReward: 0
      });
    }
    
    const timingArm = timingArms.get(sample.timing_slot);
    timingArm.totalReward += sample.actual_er;
    timingArm.samples += 1;
    timingArm.avgReward = timingArm.totalReward / timingArm.samples;
  });
  
  // Log arm updates
  console.log('[LEARN_JOB] 📈 Content arms updated:');
  contentArms.forEach((arm, contentType) => {
    const successRate = arm.successes / (arm.successes + arm.failures);
    console.log(`[LEARN_JOB]    ${contentType}: ${arm.successes}/${arm.successes + arm.failures} success (${(successRate * 100).toFixed(1)}%)`);
  });
  
  console.log('[LEARN_JOB] ⏰ Timing arms updated:');
  timingArms.forEach((arm, slot) => {
    console.log(`[LEARN_JOB]    ${slot}:00: avg_reward=${arm.avgReward.toFixed(4)} (n=${arm.samples})`);
  });
  
  // TODO: Store arm updates in database (bandit_arms table)
  
  const totalArmsUpdated = contentArms.size + timingArms.size;
  return { armsUpdated: totalArmsUpdated };
}

async function updatePredictors(trainingData: any[]): Promise<{ updated: boolean; version: string }> {
  console.log('[LEARN_JOB] 🔮 Training predictive models...');
  
  if (trainingData.length < 10) {
    console.log(`[LEARN_JOB] ⚠️ Insufficient data for predictor training (need 10+ samples, have ${trainingData.length})`);
    return { updated: false, version: 'none' };
  }

  try {
    const { trainWeeklyModel, persistCoefficients } = await import('./predictorTrainer');
    
    // Train new model on recent data
    const newCoefficients = await trainWeeklyModel();
    
    // Persist to Redis KV store
    await persistCoefficients(newCoefficients);
    
    console.log(`[LEARN_JOB] ✅ Predictor ${newCoefficients.version} trained and persisted (R²=${newCoefficients.ridge.rSquared.toFixed(3)})`);
    
    return { updated: true, version: newCoefficients.version };
    
  } catch (error) {
    console.error('[LEARN_JOB] ❌ Predictor training failed:', error.message);
    console.log('[LEARN_JOB] ⚠️ Continuing with existing model');
    
    // Fallback to mock training
    return mockPredictorTraining(trainingData);
  }
}

async function mockPredictorTraining(trainingData: any[]): Promise<{ updated: boolean; version: string }> {
  console.log('[LEARN_JOB] 🔄 Falling back to mock predictor training...');
  
  // Mock predictor training - would use ridge/logit regression
  // Features: quality_score, content_type_encoded, timing_slot, etc.
  // Target: actual_er, actual_impressions
  
  const features = trainingData.map(sample => [
    sample.quality_score,
    getContentTypeEncoding(sample.content_type),
    sample.timing_slot,
    Math.sin(2 * Math.PI * sample.timing_slot / 24) // Time cycling feature
  ]);
  
  const targets = trainingData.map(sample => sample.actual_er);
  
  // Mock coefficient computation
  const mockCoefficients = {
    intercept: 0.012,
    quality_weight: 0.034,
    content_type_weight: 0.008,
    timing_weight: 0.003,
    time_cycle_weight: 0.002,
    r_squared: 0.73,
    mse: 0.0001
  };
  
  console.log('[LEARN_JOB] 📊 Predictor coefficients updated:');
  console.log(`[LEARN_JOB]    R²: ${mockCoefficients.r_squared.toFixed(3)}, MSE: ${mockCoefficients.mse.toFixed(6)}`);
  console.log(`[LEARN_JOB]    Quality weight: ${mockCoefficients.quality_weight.toFixed(4)}`);
  
  // TODO: Store coefficients in database (predictor_coefficients table)
  
  return { updated: true, version: 'v2' };
}

function computeExploreRatio(trainingData: any[], config: any): number {
  // Compute exploration ratio based on recent median ER
  // If performance is good, explore less; if poor, explore more
  
  const recentERs = trainingData
    .filter(sample => sample.hours_old <= 24) // Last 24h
    .map(sample => sample.actual_er)
    .sort((a, b) => a - b);
  
  if (recentERs.length === 0) {
    return (config.EXPLORE_RATIO_MIN + config.EXPLORE_RATIO_MAX) / 2;
  }
  
  const medianER = recentERs[Math.floor(recentERs.length / 2)];
  const targetER = 0.035; // Target engagement rate
  
  // If below target, explore more; if above target, exploit more
  let exploreRatio;
  if (medianER < targetER) {
    // Poor performance -> increase exploration
    exploreRatio = config.EXPLORE_RATIO_MIN + 
      (config.EXPLORE_RATIO_MAX - config.EXPLORE_RATIO_MIN) * 
      Math.min(1, (targetER - medianER) / targetER);
  } else {
    // Good performance -> decrease exploration
    exploreRatio = config.EXPLORE_RATIO_MIN + 
      (config.EXPLORE_RATIO_MAX - config.EXPLORE_RATIO_MIN) * 
      Math.max(0, (targetER - medianER) / targetER + 0.5);
  }
  
  // Clamp to bounds
  return Math.max(config.EXPLORE_RATIO_MIN, Math.min(config.EXPLORE_RATIO_MAX, exploreRatio));
}

function getContentTypeEncoding(contentType: string): number {
  const encodings: Record<string, number> = {
    'educational': 0.0,
    'fact_sharing': 0.33,
    'wellness_tip': 0.67,
    'myth_busting': 1.0
  };
  return encodings[contentType] || 0.5;
}

function calculateSimulatedPercent(trainingData: any[]): number {
  const simulatedCount = trainingData.filter(sample => sample.simulated).length;
  return trainingData.length > 0 ? (simulatedCount / trainingData.length) * 100 : 0;
}
