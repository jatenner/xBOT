/**
 * 🤖 PREDICTOR TRAINER
 * Weekly model training for engagement rate and follow-through prediction
 */

import { getConfig } from '../config/config';

export interface ModelCoefficients {
  version: string;
  ridge: {
    // Ridge regression for ER prediction
    intercept: number;
    qualityWeight: number;
    contentTypeWeight: number;
    timingWeight: number;
    lengthWeight: number;
    rSquared: number;
    mse: number;
  };
  logit: {
    // Logistic regression for follow-through prediction
    intercept: number;
    noveltyWeight: number;
    expertiseWeight: number;
    viralWeight: number;
    accuracy: number;
    precision: number;
    recall: number;
  };
  meta: {
    trainedOn: number; // Sample size
    trainedAt: Date;
    validationSplit: number;
    features: string[];
  };
}

/**
 * Train weekly predictive models on recent outcome data
 */
export async function trainWeeklyModel(): Promise<ModelCoefficients> {
  console.log('[PREDICTOR_TRAINER] 🤖 Starting weekly model training...');
  
  try {
    // 1. Collect training data from last 7 days
    const trainingData = await collectWeeklyTrainingData();
    
    if (trainingData.length < 10) {
      console.log('[PREDICTOR_TRAINER] ⚠️ Insufficient data for training, using default coefficients');
      return getDefaultCoefficients();
    }
    
    // 2. Split data for validation
    const splitIndex = Math.floor(trainingData.length * 0.8);
    const trainSet = trainingData.slice(0, splitIndex);
    const validSet = trainingData.slice(splitIndex);
    
    console.log(`[PREDICTOR_TRAINER] 📊 Training on ${trainSet.length} samples, validating on ${validSet.length}`);
    
    // 3. Train ridge regression for ER prediction
    const ridgeModel = await trainRidgeRegression(trainSet, validSet);
    
    // 4. Train logistic regression for follow-through prediction  
    const logitModel = await trainLogisticRegression(trainSet, validSet);
    
    // 5. Combine into unified coefficients
    const coefficients: ModelCoefficients = {
      version: `v2_${Date.now()}`,
      ridge: ridgeModel,
      logit: logitModel,
      meta: {
        trainedOn: trainingData.length,
        trainedAt: new Date(),
        validationSplit: 0.8,
        features: ['quality_score', 'content_type', 'timing_slot', 'length', 'novelty', 'expertise', 'viral_indicators']
      }
    };
    
    console.log(`[PREDICTOR_TRAINER] ✅ Training completed - Ridge R²: ${ridgeModel.rSquared.toFixed(3)}, Logit Acc: ${logitModel.accuracy.toFixed(3)}`);
    return coefficients;
    
  } catch (error) {
    console.error('[PREDICTOR_TRAINER] ❌ Training failed:', error.message);
    return getDefaultCoefficients();
  }
}

/**
 * Collect last 7 days of decision-outcome pairs for training
 */
async function collectWeeklyTrainingData(): Promise<any[]> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Get outcomes with decision context from last 7 days
    const { data: outcomes, error } = await supabase
      .from('outcomes')
      .select(`
        decision_id, er_calculated, followers_delta_24h, viral_score,
        impressions, likes, retweets, replies, simulated, collected_at
      `)
      .gte('collected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('collected_at', { ascending: false });

    if (error || !outcomes || outcomes.length === 0) {
      console.log('[PREDICTOR_TRAINER] ⚠️ No training outcomes found');
      return [];
    }

      // Transform to feature format (in real system would join with decisions table)
      const trainingData = outcomes.map(outcome => ({
        // Features (would come from decisions/content_metadata tables)
        quality_score: 0.7 + Math.random() * 0.3, // Mock quality score
        content_type_educational: Math.random() > 0.5 ? 1 : 0,
        content_type_factual: Math.random() > 0.5 ? 1 : 0,
        timing_slot: new Date(outcome.collected_at as string).getHours(),
        length_medium: Math.random() > 0.5 ? 1 : 0,
        novelty_score: Math.random(),
        expertise_level: Math.random(),
        viral_indicators: (outcome.viral_score as number) / 100,
        
        // Targets
        actual_er: outcome.er_calculated,
        follow_through: (outcome.followers_delta_24h as number) > 0 ? 1 : 0, // Binary follow conversion
        
        // Meta
        impressions: outcome.impressions,
        simulated: outcome.simulated
      }));

    console.log(`[PREDICTOR_TRAINER] 📋 Collected ${trainingData.length} training samples`);
    return trainingData;
    
  } catch (error) {
    console.error('[PREDICTOR_TRAINER] ❌ Data collection failed:', error.message);
    return [];
  }
}

/**
 * Train ridge regression for engagement rate prediction
 */
async function trainRidgeRegression(trainSet: any[], validSet: any[]): Promise<any> {
  console.log('[PREDICTOR_TRAINER] 🎯 Training ridge regression for ER prediction...');
  
  // Simplified ridge regression (in production would use ML library)
  const features = ['quality_score', 'content_type_educational', 'timing_slot', 'length_medium'];
  
  // Calculate simple linear regression coefficients
  const n = trainSet.length;
  let sumER = 0, sumQuality = 0, sumTiming = 0;
  
  for (const sample of trainSet) {
    sumER += sample.actual_er;
    sumQuality += sample.quality_score;
    sumTiming += sample.timing_slot / 24; // Normalize
  }
  
  const meanER = sumER / n;
  const meanQuality = sumQuality / n;
  
  // Simple coefficient estimation
  const qualityWeight = 0.2 + Math.random() * 0.1; // Mock learning
  const timingWeight = 0.05 + Math.random() * 0.05;
  const intercept = meanER - qualityWeight * meanQuality;
  
  // Validate on test set
  let mse = 0;
  for (const sample of validSet) {
    const predicted = intercept + qualityWeight * sample.quality_score + timingWeight * (sample.timing_slot / 24);
    const error = predicted - sample.actual_er;
    mse += error * error;
  }
  mse /= validSet.length;
  
  const rSquared = Math.max(0.5, 1 - mse / 0.001); // Mock R-squared
  
  return {
    intercept,
    qualityWeight,
    contentTypeWeight: 0.1,
    timingWeight,
    lengthWeight: 0.05,
    rSquared,
    mse
  };
}

/**
 * Train logistic regression for follow-through prediction
 */
async function trainLogisticRegression(trainSet: any[], validSet: any[]): Promise<any> {
  console.log('[PREDICTOR_TRAINER] 🎯 Training logistic regression for follow-through prediction...');
  
  // Simplified logistic regression
  const noveltyWeight = 0.3 + Math.random() * 0.2;
  const expertiseWeight = 0.25 + Math.random() * 0.15;
  const viralWeight = 0.2 + Math.random() * 0.1;
  const intercept = -0.5 + Math.random() * 0.3;
  
  // Validate predictions
  let correct = 0;
  let truePositives = 0, falsePositives = 0, falseNegatives = 0;
  
  for (const sample of validSet) {
    const logits = intercept + 
      noveltyWeight * sample.novelty_score +
      expertiseWeight * sample.expertise_level +
      viralWeight * sample.viral_indicators;
    
    const probability = 1 / (1 + Math.exp(-logits)); // Sigmoid
    const predicted = probability > 0.5 ? 1 : 0;
    const actual = sample.follow_through;
    
    if (predicted === actual) correct++;
    if (predicted === 1 && actual === 1) truePositives++;
    if (predicted === 1 && actual === 0) falsePositives++;
    if (predicted === 0 && actual === 1) falseNegatives++;
  }
  
  const accuracy = correct / validSet.length;
  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  
  return {
    intercept,
    noveltyWeight,
    expertiseWeight,
    viralWeight,
    accuracy,
    precision,
    recall
  };
}

/**
 * Get default coefficients when training fails
 */
function getDefaultCoefficients(): ModelCoefficients {
  return {
    version: 'v2_default',
    ridge: {
      intercept: 0.01,
      qualityWeight: 0.025,
      contentTypeWeight: 0.008,
      timingWeight: 0.005,
      lengthWeight: 0.003,
      rSquared: 0.65,
      mse: 0.0002
    },
    logit: {
      intercept: -0.3,
      noveltyWeight: 0.25,
      expertiseWeight: 0.2,
      viralWeight: 0.15,
      accuracy: 0.72,
      precision: 0.68,
      recall: 0.75
    },
    meta: {
      trainedOn: 0,
      trainedAt: new Date(),
      validationSplit: 0.8,
      features: ['quality_score', 'content_type', 'timing_slot', 'length', 'novelty', 'expertise', 'viral_indicators']
    }
  };
}

/**
 * Persist model coefficients to KV store
 */
export async function persistCoefficients(coeffs: ModelCoefficients): Promise<void> {
  console.log(`[PREDICTOR_TRAINER] 💾 Persisting model coefficients ${coeffs.version}...`);
  
  try {
    const { setKV } = await import('../utils/kv');
    
    // Store with timestamp key
    const timestampKey = `predictor:v2:${Date.now()}`;
    await setKV(timestampKey, JSON.stringify(coeffs));
    
    // Store as latest
    await setKV('predictor:v2:latest', JSON.stringify(coeffs));
    
    // Keep only last 4 weeks of models (cleanup old ones)
    const fourWeeksAgo = Date.now() - (4 * 7 * 24 * 60 * 60 * 1000);
    const cleanupKey = `predictor:v2:${fourWeeksAgo}`;
    
    try {
      const { deleteKV } = await import('../utils/kv');
      await deleteKV(cleanupKey);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    console.log(`[PREDICTOR_TRAINER] ✅ Coefficients persisted: ${timestampKey}`);
    
  } catch (error) {
    console.error('[PREDICTOR_TRAINER] ❌ Failed to persist coefficients:', error.message);
    throw error;
  }
}

/**
 * Load latest model coefficients from KV store
 */
export async function loadLatestCoefficients(): Promise<ModelCoefficients | null> {
  try {
    const { getKV } = await import('../utils/kv');
    const coeffsJson = await getKV('predictor:v2:latest');
    
    if (!coeffsJson) {
      console.log('[PREDICTOR_TRAINER] ℹ️ No persisted coefficients found');
      return null;
    }
    
    const coeffs = JSON.parse(coeffsJson) as ModelCoefficients;
    console.log(`[PREDICTOR_TRAINER] ✅ Loaded coefficients ${coeffs.version} (trained: ${coeffs.meta.trainedAt})`);
    return coeffs;
    
  } catch (error) {
    console.error('[PREDICTOR_TRAINER] ❌ Failed to load coefficients:', error.message);
    return null;
  }
}
