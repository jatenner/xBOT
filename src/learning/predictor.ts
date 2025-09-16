/**
 * Lightweight Predictor
 * Ridge/Logistic regression for engagement rate and follow-through prediction
 */

import { admin as supabase } from '../lib/supabaseClients';
import { kvGet, kvSet } from '../utils/kv';
import { extractFeatures, featuresToArray, getFeatureNames, ContentFeatures } from './featureExtractor';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface PredictorModel {
  coefficients: number[];
  intercept: number;
  featureNames: string[];
  modelType: 'ridge' | 'logistic';
  trainedAt: Date;
  trainingSamples: number;
  crossValidationScore?: number;
  version: string;
}

export interface PredictionResult {
  engagementRate: number;
  followThrough: number;
  confidence: number;
  features: ContentFeatures;
}

export interface TrainingData {
  features: number[][];
  targets: number[];
  weights?: number[];
}

const LEARNING_LOOKBACK_DAYS = parseInt(process.env.LEARNING_LOOKBACK_DAYS || '30', 10);
const MODEL_VERSION = 'v1';
const MIN_TRAINING_SAMPLES = parseInt(process.env.PREDICTOR_MIN_SAMPLES || '50', 10);

// Ridge regression regularization parameter
const RIDGE_ALPHA = parseFloat(process.env.RIDGE_ALPHA || '1.0');

// Logistic regression parameters
const LOGISTIC_LEARNING_RATE = parseFloat(process.env.LOGISTIC_LR || '0.01');
const LOGISTIC_MAX_ITER = parseInt(process.env.LOGISTIC_MAX_ITER || '1000', 10);

/**
 * Calculate engagement rate from metrics
 */
function calculateEngagementRate(likes: number, retweets: number, replies: number, impressions: number): number {
  if (impressions === 0) return 0;
  const totalEngagement = likes + retweets + replies;
  return totalEngagement / impressions;
}

/**
 * Calculate follow-through rate (followers gained / impressions)
 */
function calculateFollowThrough(followersAttributed: number, impressions: number): number {
  if (impressions === 0) return 0;
  return followersAttributed / impressions;
}

/**
 * Matrix operations for linear algebra
 */
class Matrix {
  constructor(public data: number[][], public rows: number, public cols: number) {}
  
  static fromArray(data: number[][]): Matrix {
    return new Matrix(data, data.length, data[0]?.length || 0);
  }
  
  static zeros(rows: number, cols: number): Matrix {
    const data = Array(rows).fill(null).map(() => Array(cols).fill(0));
    return new Matrix(data, rows, cols);
  }
  
  static identity(size: number): Matrix {
    const data = Array(size).fill(null).map((_, i) => 
      Array(size).fill(null).map((_, j) => i === j ? 1 : 0)
    );
    return new Matrix(data, size, size);
  }
  
  transpose(): Matrix {
    const data = Array(this.cols).fill(null).map((_, i) =>
      Array(this.rows).fill(null).map((_, j) => this.data[j][i])
    );
    return new Matrix(data, this.cols, this.rows);
  }
  
  multiply(other: Matrix): Matrix {
    if (this.cols !== other.rows) {
      throw new Error(`Matrix dimensions don't match: ${this.cols} vs ${other.rows}`);
    }
    
    const result = Matrix.zeros(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i][k] * other.data[k][j];
        }
        result.data[i][j] = sum;
      }
    }
    return result;
  }
  
  add(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error('Matrix dimensions must match for addition');
    }
    
    const result = Matrix.zeros(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] + other.data[i][j];
      }
    }
    return result;
  }
  
  scale(scalar: number): Matrix {
    const result = Matrix.zeros(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] * scalar;
      }
    }
    return result;
  }
  
  // Simple inverse for small matrices (using Gauss-Jordan elimination)
  inverse(): Matrix {
    if (this.rows !== this.cols) {
      throw new Error('Matrix must be square for inversion');
    }
    
    const n = this.rows;
    const augmented = Matrix.zeros(n, 2 * n);
    
    // Create augmented matrix [A | I]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        augmented.data[i][j] = this.data[i][j];
        augmented.data[i][j + n] = i === j ? 1 : 0;
      }
    }
    
    // Gauss-Jordan elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented.data[k][i]) > Math.abs(augmented.data[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      [augmented.data[i], augmented.data[maxRow]] = [augmented.data[maxRow], augmented.data[i]];
      
      // Make diagonal element 1
      const pivot = augmented.data[i][i];
      if (Math.abs(pivot) < 1e-10) {
        throw new Error('Matrix is singular and cannot be inverted');
      }
      
      for (let j = 0; j < 2 * n; j++) {
        augmented.data[i][j] /= pivot;
      }
      
      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented.data[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented.data[k][j] -= factor * augmented.data[i][j];
          }
        }
      }
    }
    
    // Extract inverse matrix
    const inverse = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        inverse.data[i][j] = augmented.data[i][j + n];
      }
    }
    
    return inverse;
  }
}

/**
 * Train ridge regression model
 */
function trainRidge(features: number[][], targets: number[], alpha: number = RIDGE_ALPHA): PredictorModel {
  const n = features.length;
  const p = features[0]?.length || 0;
  
  if (n < MIN_TRAINING_SAMPLES) {
    throw new Error(`Insufficient training samples: ${n} < ${MIN_TRAINING_SAMPLES}`);
  }
  
  // Add intercept column
  const X = Matrix.fromArray(features.map(row => [1, ...row]));
  const y = Matrix.fromArray(targets.map(t => [t]));
  
  // Ridge regression: θ = (X^T X + αI)^(-1) X^T y
  const XtX = X.transpose().multiply(X);
  const regularization = Matrix.identity(p + 1).scale(alpha);
  regularization.data[0][0] = 0; // Don't regularize intercept
  
  const covariance = XtX.add(regularization);
  const inverse = covariance.inverse();
  const Xty = X.transpose().multiply(y);
  const coefficients = inverse.multiply(Xty);
  
  return {
    coefficients: coefficients.data.slice(1).map(row => row[0]), // Exclude intercept
    intercept: coefficients.data[0][0],
    featureNames: getFeatureNames(),
    modelType: 'ridge',
    trainedAt: new Date(),
    trainingSamples: n,
    version: MODEL_VERSION
  };
}

/**
 * Sigmoid function for logistic regression
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); // Clip to prevent overflow
}

/**
 * Train logistic regression model
 */
function trainLogistic(features: number[][], targets: number[]): PredictorModel {
  const n = features.length;
  const p = features[0]?.length || 0;
  
  if (n < MIN_TRAINING_SAMPLES) {
    throw new Error(`Insufficient training samples: ${n} < ${MIN_TRAINING_SAMPLES}`);
  }
  
  // Initialize coefficients
  let coefficients = Array(p).fill(0);
  let intercept = 0;
  
  // Gradient descent
  for (let iter = 0; iter < LOGISTIC_MAX_ITER; iter++) {
    let gradCoeff = Array(p).fill(0);
    let gradIntercept = 0;
    let logLikelihood = 0;
    
    for (let i = 0; i < n; i++) {
      const x = features[i];
      const y = targets[i];
      
      const linearComb = intercept + x.reduce((sum, xi, j) => sum + xi * coefficients[j], 0);
      const predicted = sigmoid(linearComb);
      const error = predicted - y;
      
      // Update gradients
      gradIntercept += error;
      for (let j = 0; j < p; j++) {
        gradCoeff[j] += error * x[j];
      }
      
      // Log likelihood
      logLikelihood += y * Math.log(predicted + 1e-15) + (1 - y) * Math.log(1 - predicted + 1e-15);
    }
    
    // Update parameters
    intercept -= LOGISTIC_LEARNING_RATE * gradIntercept / n;
    for (let j = 0; j < p; j++) {
      coefficients[j] -= LOGISTIC_LEARNING_RATE * gradCoeff[j] / n;
    }
    
    // Check convergence
    const gradNorm = Math.sqrt(gradIntercept ** 2 + gradCoeff.reduce((sum, g) => sum + g ** 2, 0));
    if (gradNorm < 1e-6) {
      log(`LOGISTIC_CONVERGED: iter=${iter} gradNorm=${gradNorm.toExponential(2)}`);
      break;
    }
  }
  
  return {
    coefficients,
    intercept,
    featureNames: getFeatureNames(),
    modelType: 'logistic',
    trainedAt: new Date(),
    trainingSamples: n,
    version: MODEL_VERSION
  };
}

/**
 * Predict using a trained model
 */
function predict(model: PredictorModel, features: number[]): number {
  if (features.length !== model.coefficients.length) {
    throw new Error(`Feature dimension mismatch: ${features.length} vs ${model.coefficients.length}`);
  }
  
  const linearComb = model.intercept + features.reduce((sum, f, i) => sum + f * model.coefficients[i], 0);
  
  if (model.modelType === 'logistic') {
    return sigmoid(linearComb);
  } else {
    return Math.max(0, Math.min(1, linearComb)); // Clip to [0, 1] for rates
  }
}

/**
 * Load training data from database
 */
async function loadTrainingData(): Promise<{
  erData: TrainingData;
  ftData: TrainingData;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LEARNING_LOOKBACK_DAYS);
  
  log(`PREDICTOR_LOAD_DATA: lookback=${LEARNING_LOOKBACK_DAYS}d cutoff=${cutoffDate.toISOString()}`);
  
  try {
    // Load posts with metrics and metadata
    const { data: posts, error } = await supabase
      .from('unified_posts')
      .select(`
        post_id,
        content,
        likes,
        retweets,
        replies,
        impressions,
        followers_attributed,
        posted_at,
        content_metadata (
          style,
          fact_source,
          topic,
          thread_length,
          hook_type,
          cta_type,
          quality_score,
          features
        )
      `)
      .gte('posted_at', cutoffDate.toISOString())
      .not('impressions', 'is', null)
      .gt('impressions', 0)
      .order('posted_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    if (!posts || posts.length === 0) {
      throw new Error('No training data available');
    }
    
    log(`PREDICTOR_DATA_LOADED: ${posts.length} posts found`);
    
    const erFeatures: number[][] = [];
    const erTargets: number[] = [];
    const ftFeatures: number[][] = [];
    const ftTargets: number[] = [];
    
    for (const post of posts) {
      try {
        // Extract or compute features
        let features: number[];
        
        if (post.content_metadata && (post.content_metadata as any).features) {
          // Use pre-computed features if available
          const featureObj = extractFeatures(post.content, post.content_metadata);
          features = featuresToArray(featureObj);
        } else {
          // Compute features on the fly
          const metadata = post.content_metadata || {};
          const featureObj = extractFeatures(post.content, metadata);
          features = featuresToArray(featureObj);
        }
        
        // Calculate targets
        const engagementRate = calculateEngagementRate(
          post.likes || 0,
          post.retweets || 0,
          post.replies || 0,
          post.impressions || 1
        );
        
        const followThrough = calculateFollowThrough(
          post.followers_attributed || 0,
          post.impressions || 1
        );
        
        // Add to training sets (only if targets are reasonable)
        if (engagementRate >= 0 && engagementRate <= 1) {
          erFeatures.push(features);
          erTargets.push(engagementRate);
        }
        
        if (followThrough >= 0 && followThrough <= 0.1) { // Max 10% follow-through is reasonable
          ftFeatures.push(features);
          ftTargets.push(followThrough);
        }
        
      } catch (err) {
        warn(`PREDICTOR_DATA_SKIP: postId=${post.post_id}: ${err}`);
      }
    }
    
    log(`PREDICTOR_TRAINING_DATA: ER=${erFeatures.length} samples, FT=${ftFeatures.length} samples`);
    
    return {
      erData: { features: erFeatures, targets: erTargets },
      ftData: { features: ftFeatures, targets: ftTargets }
    };
    
  } catch (err: any) {
    error(`PREDICTOR_LOAD_DATA_ERROR: ${err.message}`);
    throw err;
  }
}

/**
 * Save model to KV store
 */
async function saveModel(key: string, model: PredictorModel): Promise<void> {
  try {
    await kvSet(key, JSON.stringify(model));
    log(`PREDICTOR_MODEL_SAVED: key=${key} samples=${model.trainingSamples} type=${model.modelType}`);
  } catch (err: any) {
    error(`PREDICTOR_SAVE_ERROR: key=${key}: ${err.message}`);
    throw err;
  }
}

/**
 * Load model from KV store
 */
async function loadModel(key: string): Promise<PredictorModel | null> {
  try {
    const modelJson = await kvGet(key);
    if (!modelJson) {
      return null;
    }
    
    const model = JSON.parse(modelJson) as PredictorModel;
    log(`PREDICTOR_MODEL_LOADED: key=${key} trained=${model.trainedAt} samples=${model.trainingSamples}`);
    return model;
    
  } catch (err: any) {
    warn(`PREDICTOR_LOAD_ERROR: key=${key}: ${err.message}`);
    return null;
  }
}

/**
 * Train and save predictor models
 */
export async function trainPredictors(): Promise<{
  erModel: PredictorModel;
  ftModel: PredictorModel;
}> {
  log(`PREDICTOR_TRAINING: Starting model training`);
  
  const { erData, ftData } = await loadTrainingData();
  
  // Train engagement rate model (ridge regression)
  const erModel = trainRidge(erData.features, erData.targets);
  await saveModel(`predictor:engagement_rate:${MODEL_VERSION}`, erModel);
  
  // Train follow-through model (logistic regression for binary outcome)
  const ftTargetsBinary = ftData.targets.map(ft => ft > 0.001 ? 1 : 0); // Binary threshold
  const ftModel = trainLogistic(ftData.features, ftTargetsBinary);
  await saveModel(`predictor:follow_through:${MODEL_VERSION}`, ftModel);
  
  log(`PREDICTOR_TRAINING_COMPLETE: ER_model=${erModel.trainingSamples} samples, FT_model=${ftModel.trainingSamples} samples`);
  
  return { erModel, ftModel };
}

/**
 * Predict engagement rate and follow-through for content
 */
export async function predictPerformance(text: string, metadata: any = {}): Promise<PredictionResult> {
  try {
    // Extract features
    const featureObj = extractFeatures(text, metadata);
    const features = featuresToArray(featureObj);
    
    // Load models
    const erModel = await loadModel(`predictor:engagement_rate:${MODEL_VERSION}`);
    const ftModel = await loadModel(`predictor:follow_through:${MODEL_VERSION}`);
    
    if (!erModel || !ftModel) {
      // Return default predictions if models not available
      warn(`PREDICTOR_MODELS_MISSING: ER=${!!erModel} FT=${!!ftModel}`);
      return {
        engagementRate: 0.02, // Default 2% ER
        followThrough: 0.001, // Default 0.1% follow-through
        confidence: 0.1, // Low confidence
        features: featureObj
      };
    }
    
    // Make predictions
    const engagementRate = predict(erModel, features);
    const followThroughProb = predict(ftModel, features);
    
    // Convert binary probability to rate estimate (rough approximation)
    const followThrough = followThroughProb * 0.005; // Scale to reasonable follow-through rate
    
    // Calculate confidence based on model training samples
    const minSamples = Math.min(erModel.trainingSamples, ftModel.trainingSamples);
    const confidence = Math.min(1.0, minSamples / (MIN_TRAINING_SAMPLES * 2));
    
    log(`PREDICTOR_PREDICTION: ER=${engagementRate.toFixed(4)} FT=${followThrough.toFixed(6)} conf=${confidence.toFixed(2)}`);
    
    return {
      engagementRate: Math.max(0, Math.min(1, engagementRate)),
      followThrough: Math.max(0, Math.min(0.01, followThrough)),
      confidence,
      features: featureObj
    };
    
  } catch (err: any) {
    error(`PREDICTOR_PREDICTION_ERROR: ${err.message}`);
    
    // Return safe defaults on error
    return {
      engagementRate: 0.02,
      followThrough: 0.001,
      confidence: 0.0,
      features: extractFeatures(text, metadata)
    };
  }
}

/**
 * Get predictor status and model information
 */
export async function getPredictorStatus(): Promise<{
  erModel: {
    available: boolean;
    trainedAt?: Date;
    samples?: number;
    version?: string;
  };
  ftModel: {
    available: boolean;
    trainedAt?: Date;
    samples?: number;
    version?: string;
  };
  lastTraining?: Date;
}> {
  const erModel = await loadModel(`predictor:engagement_rate:${MODEL_VERSION}`);
  const ftModel = await loadModel(`predictor:follow_through:${MODEL_VERSION}`);
  
  return {
    erModel: {
      available: !!erModel,
      trainedAt: erModel?.trainedAt,
      samples: erModel?.trainingSamples,
      version: erModel?.version
    },
    ftModel: {
      available: !!ftModel,
      trainedAt: ftModel?.trainedAt,
      samples: ftModel?.trainingSamples,
      version: ftModel?.version
    },
    lastTraining: erModel?.trainedAt || ftModel?.trainedAt
  };
}
