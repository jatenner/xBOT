/**
 * A/B Experimentation with Sequential Probability Ratio Test (SPRT)
 * Implements early stopping for statistical significance
 */

import { admin as supabase } from '../lib/supabaseClients';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface Experiment {
  id: string;
  name: string;
  factor: string; // 'hook', 'cta', 'format', 'topic_angle'
  variantA: string;
  variantB: string;
  startedAt: Date;
  stoppedAt?: Date;
  status: 'running' | 'stopped';
  stopReason?: string;
  
  // SPRT parameters
  logLikelihoodRatio: number;
  nA: number; // samples for variant A
  nB: number; // samples for variant B
  successA: number;
  successB: number;
  alpha: number; // Type I error rate
  beta: number;  // Type II error rate
  minEffectSize: number; // Minimum detectable effect
}

export interface ExperimentResult {
  experimentId: string;
  variant: 'A' | 'B';
  success: boolean;
  metadata?: any;
}

export interface ExperimentDecision {
  shouldStop: boolean;
  decision?: 'A_wins' | 'B_wins' | 'no_difference';
  confidence: number;
  pValue?: number;
  effectSize?: number;
  reason: string;
}

const EXPERIMENT_MIN_SAMPLE = parseInt(process.env.EXPERIMENT_MIN_SAMPLE || '20', 10);
const DEFAULT_ALPHA = 0.05; // 5% Type I error rate
const DEFAULT_BETA = 0.10;  // 10% Type II error rate (90% power)
const DEFAULT_MIN_EFFECT = 0.02; // 2% minimum effect size

/**
 * Create a new A/B experiment
 */
export async function createExperiment(
  name: string,
  factor: string,
  variantA: string,
  variantB: string,
  options: {
    alpha?: number;
    beta?: number;
    minEffectSize?: number;
  } = {}
): Promise<string> {
  const alpha = options.alpha || DEFAULT_ALPHA;
  const beta = options.beta || DEFAULT_BETA;
  const minEffectSize = options.minEffectSize || DEFAULT_MIN_EFFECT;
  
  try {
    const { data, error } = await supabase
      .from('experiments')
      .insert({
        name,
        factor,
        variant_a: variantA,
        variant_b: variantB,
        alpha,
        beta,
        min_effect_size: minEffectSize,
        log_likelihood_ratio: 0.0,
        n_a: 0,
        n_b: 0,
        success_a: 0,
        success_b: 0,
        status: 'running'
      })
      .select('id')
      .single();
    
    if (error) {
      throw error;
    }
    
    const experimentId = data.id;
    log(`EXPERIMENT_CREATED: id=${experimentId} name=${name} factor=${factor} A=${variantA} B=${variantB}`);
    
    return experimentId;
    
  } catch (err: any) {
    error(`EXPERIMENT_CREATE_ERROR: name=${name}: ${err.message}`);
    throw err;
  }
}

/**
 * Load experiment from database
 */
export async function loadExperiment(experimentId: string): Promise<Experiment | null> {
  try {
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      id: data.id,
      name: data.name,
      factor: data.factor,
      variantA: data.variant_a,
      variantB: data.variant_b,
      startedAt: new Date(data.started_at),
      stoppedAt: data.stopped_at ? new Date(data.stopped_at) : undefined,
      status: data.status,
      stopReason: data.stop_reason,
      logLikelihoodRatio: data.log_likelihood_ratio,
      nA: data.n_a,
      nB: data.n_b,
      successA: data.success_a,
      successB: data.success_b,
      alpha: data.alpha,
      beta: data.beta,
      minEffectSize: data.min_effect_size
    };
    
  } catch (err: any) {
    error(`EXPERIMENT_LOAD_ERROR: id=${experimentId}: ${err.message}`);
    return null;
  }
}

/**
 * Update experiment in database
 */
async function updateExperiment(experiment: Experiment): Promise<void> {
  try {
    const { error } = await supabase
      .from('experiments')
      .update({
        log_likelihood_ratio: experiment.logLikelihoodRatio,
        n_a: experiment.nA,
        n_b: experiment.nB,
        success_a: experiment.successA,
        success_b: experiment.successB,
        status: experiment.status,
        stopped_at: experiment.stoppedAt?.toISOString(),
        stop_reason: experiment.stopReason
      })
      .eq('id', experiment.id);
    
    if (error) {
      throw error;
    }
    
  } catch (err: any) {
    error(`EXPERIMENT_UPDATE_ERROR: id=${experiment.id}: ${err.message}`);
    throw err;
  }
}

/**
 * Calculate log-likelihood ratio for SPRT
 */
function calculateLogLikelihoodRatio(
  successA: number,
  nA: number,
  successB: number,
  nB: number,
  minEffectSize: number
): number {
  if (nA === 0 || nB === 0) return 0;
  
  const pA = successA / nA;
  const pB = successB / nB;
  
  // Null hypothesis: pA = pB (no difference)
  const pooledP = (successA + successB) / (nA + nB);
  
  // Alternative hypothesis: |pA - pB| >= minEffectSize
  const pAlt = Math.max(pooledP + minEffectSize, Math.min(1, pooledP + minEffectSize));
  const pNull = pooledP;
  
  // Log-likelihood under alternative hypothesis
  const logLikelihoodAlt = 
    successA * Math.log(pAlt + 1e-10) + (nA - successA) * Math.log(1 - pAlt + 1e-10) +
    successB * Math.log(pB + 1e-10) + (nB - successB) * Math.log(1 - pB + 1e-10);
  
  // Log-likelihood under null hypothesis
  const logLikelihoodNull = 
    successA * Math.log(pNull + 1e-10) + (nA - successA) * Math.log(1 - pNull + 1e-10) +
    successB * Math.log(pNull + 1e-10) + (nB - successB) * Math.log(1 - pNull + 1e-10);
  
  return logLikelihoodAlt - logLikelihoodNull;
}

/**
 * Make SPRT decision
 */
function makeSprtDecision(experiment: Experiment): ExperimentDecision {
  const { nA, nB, successA, successB, alpha, beta, minEffectSize } = experiment;
  
  // Minimum sample size check
  if (nA < EXPERIMENT_MIN_SAMPLE || nB < EXPERIMENT_MIN_SAMPLE) {
    return {
      shouldStop: false,
      confidence: 0,
      reason: `Need more samples: A=${nA}/${EXPERIMENT_MIN_SAMPLE}, B=${nB}/${EXPERIMENT_MIN_SAMPLE}`
    };
  }
  
  const logLikelihoodRatio = calculateLogLikelihoodRatio(successA, nA, successB, nB, minEffectSize);
  
  // SPRT thresholds
  const upperThreshold = Math.log((1 - beta) / alpha);
  const lowerThreshold = Math.log(beta / (1 - alpha));
  
  const pA = successA / nA;
  const pB = successB / nB;
  const effectSize = Math.abs(pA - pB);
  
  // Fisher's exact test p-value (approximate for large samples)
  const pooledP = (successA + successB) / (nA + nB);
  const sePooled = Math.sqrt(pooledP * (1 - pooledP) * (1/nA + 1/nB));
  const zScore = Math.abs(pA - pB) / (sePooled + 1e-10);
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore))); // Two-tailed
  
  // Decision logic
  if (logLikelihoodRatio >= upperThreshold && effectSize >= minEffectSize) {
    const winner = pA > pB ? 'A' : 'B';
    return {
      shouldStop: true,
      decision: winner === 'A' ? 'A_wins' : 'B_wins',
      confidence: 1 - alpha,
      pValue,
      effectSize,
      reason: `SPRT: Variant ${winner} wins (LLR=${logLikelihoodRatio.toFixed(3)}, effect=${effectSize.toFixed(3)})`
    };
  }
  
  if (logLikelihoodRatio <= lowerThreshold) {
    return {
      shouldStop: true,
      decision: 'no_difference',
      confidence: 1 - beta,
      pValue,
      effectSize,
      reason: `SPRT: No significant difference (LLR=${logLikelihoodRatio.toFixed(3)}, effect=${effectSize.toFixed(3)})`
    };
  }
  
  // Continue experiment
  const progressA = nA / (EXPERIMENT_MIN_SAMPLE * 2); // Target 2x minimum for good power
  const progressB = nB / (EXPERIMENT_MIN_SAMPLE * 2);
  const overallProgress = Math.min(progressA, progressB);
  
  return {
    shouldStop: false,
    confidence: overallProgress,
    pValue,
    effectSize,
    reason: `SPRT: Continue (LLR=${logLikelihoodRatio.toFixed(3)}, progress=${(overallProgress * 100).toFixed(1)}%)`
  };
}

/**
 * Standard normal CDF approximation
 */
function normalCdf(x: number): number {
  // Abramowitz and Stegun approximation
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

/**
 * Add experiment result and check for early stopping
 */
export async function addExperimentResult(
  experimentId: string,
  variant: 'A' | 'B',
  success: boolean,
  metadata?: any
): Promise<ExperimentDecision> {
  const experiment = await loadExperiment(experimentId);
  
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }
  
  if (experiment.status !== 'running') {
    warn(`EXPERIMENT_ALREADY_STOPPED: id=${experimentId} status=${experiment.status}`);
    return {
      shouldStop: true,
      decision: 'no_difference',
      confidence: 0,
      reason: 'Experiment already stopped'
    };
  }
  
  // Update experiment with new result
  if (variant === 'A') {
    experiment.nA++;
    if (success) experiment.successA++;
  } else {
    experiment.nB++;
    if (success) experiment.successB++;
  }
  
  // Recalculate log-likelihood ratio
  experiment.logLikelihoodRatio = calculateLogLikelihoodRatio(
    experiment.successA,
    experiment.nA,
    experiment.successB,
    experiment.nB,
    experiment.minEffectSize
  );
  
  // Make SPRT decision
  const decision = makeSprtDecision(experiment);
  
  // Stop experiment if decision reached
  if (decision.shouldStop && decision.decision) {
    experiment.status = 'stopped';
    experiment.stoppedAt = new Date();
    experiment.stopReason = decision.reason;
    
    log(`EXPERIMENT_STOPPED: id=${experimentId} decision=${decision.decision} reason=${decision.reason}`);
  }
  
  // Update database
  await updateExperiment(experiment);
  
  log(`EXPERIMENT_RESULT: id=${experimentId} variant=${variant} success=${success} A=${experiment.successA}/${experiment.nA} B=${experiment.successB}/${experiment.nB}`);
  
  return decision;
}

/**
 * Assign variant for new experimental unit
 */
export async function assignVariant(experimentId: string): Promise<'A' | 'B'> {
  const experiment = await loadExperiment(experimentId);
  
  if (!experiment || experiment.status !== 'running') {
    // Default to A if experiment not available
    return 'A';
  }
  
  // Simple randomization with balancing
  // Prefer the variant with fewer samples to maintain balance
  if (experiment.nA < experiment.nB) {
    return 'A';
  } else if (experiment.nB < experiment.nA) {
    return 'B';
  } else {
    // Equal samples, randomize
    return Math.random() < 0.5 ? 'A' : 'B';
  }
}

/**
 * Get active experiments for a factor
 */
export async function getActiveExperiments(factor?: string): Promise<Experiment[]> {
  try {
    let query = supabase
      .from('experiments')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false });
    
    if (factor) {
      query = query.eq('factor', factor);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    const experiments: Experiment[] = (data || []).map(exp => ({
      id: exp.id,
      name: exp.name,
      factor: exp.factor,
      variantA: exp.variant_a,
      variantB: exp.variant_b,
      startedAt: new Date(exp.started_at),
      stoppedAt: exp.stopped_at ? new Date(exp.stopped_at) : undefined,
      status: exp.status,
      stopReason: exp.stop_reason,
      logLikelihoodRatio: exp.log_likelihood_ratio,
      nA: exp.n_a,
      nB: exp.n_b,
      successA: exp.success_a,
      successB: exp.success_b,
      alpha: exp.alpha,
      beta: exp.beta,
      minEffectSize: exp.min_effect_size
    }));
    
    return experiments;
    
  } catch (err: any) {
    error(`EXPERIMENT_GET_ACTIVE_ERROR: factor=${factor}: ${err.message}`);
    return [];
  }
}

/**
 * Get experiment summary statistics
 */
export async function getExperimentSummary(experimentId: string): Promise<{
  experiment: Experiment;
  rateA: number;
  rateB: number;
  effectSize: number;
  confidence: number;
  recommendation: string;
  timeRunning: number; // hours
} | null> {
  const experiment = await loadExperiment(experimentId);
  
  if (!experiment) {
    return null;
  }
  
  const rateA = experiment.nA > 0 ? experiment.successA / experiment.nA : 0;
  const rateB = experiment.nB > 0 ? experiment.successB / experiment.nB : 0;
  const effectSize = Math.abs(rateA - rateB);
  
  const decision = makeSprtDecision(experiment);
  
  const timeRunning = (new Date().getTime() - experiment.startedAt.getTime()) / (1000 * 60 * 60);
  
  let recommendation: string;
  if (experiment.status === 'stopped') {
    recommendation = `Experiment concluded: ${experiment.stopReason}`;
  } else if (decision.shouldStop) {
    recommendation = `Ready to stop: ${decision.reason}`;
  } else {
    recommendation = `Continue experiment: ${decision.reason}`;
  }
  
  return {
    experiment,
    rateA,
    rateB,
    effectSize,
    confidence: decision.confidence,
    recommendation,
    timeRunning
  };
}

/**
 * Stop experiment manually
 */
export async function stopExperiment(experimentId: string, reason: string): Promise<void> {
  const experiment = await loadExperiment(experimentId);
  
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`);
  }
  
  if (experiment.status !== 'running') {
    return; // Already stopped
  }
  
  experiment.status = 'stopped';
  experiment.stoppedAt = new Date();
  experiment.stopReason = reason;
  
  await updateExperiment(experiment);
  
  log(`EXPERIMENT_MANUAL_STOP: id=${experimentId} reason=${reason}`);
}
