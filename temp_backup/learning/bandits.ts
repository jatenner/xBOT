/**
 * Multi-Armed Bandits Implementation
 * Thompson Sampling for content/reply, UCB1 for timing optimization
 */

import { admin as supabase } from '../lib/supabaseClients';
import { kvGet, kvSet } from '../utils/kv';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export type BanditScope = 'content' | 'reply' | 'timing';

export interface BanditArm {
  armId: string;
  scope: BanditScope;
  successes: number;
  trials: number;
  alpha: number;  // Beta distribution parameter (successes + prior)
  beta: number;   // Beta distribution parameter (failures + prior)
  lastUpdated: Date;
  createdAt: Date;
}

export interface ArmSelection {
  armId: string;
  expectedReward: number;
  confidence?: number;
  algorithm: 'thompson' | 'ucb1';
  reason: string;
}

export interface BanditConfig {
  contentPrior: { alpha: number; beta: number };
  replyPrior: { alpha: number; beta: number };
  timingPrior: { alpha: number; beta: number };
  ucbExploration: number; // UCB1 exploration parameter
  minTrials: number; // Minimum trials before meaningful selection
  hierarchicalShrinkage: number; // Shrinkage factor for empirical Bayes
}

export interface GroupPrior {
  groupId: string;
  alpha: number;
  beta: number;
  count: number;
}

export interface TimingContext {
  timeSinceLastPost?: number; // Hours since last post
  lastPostsMedianER?: number; // Median ER of last 3 posts
  hasTrendingTopic?: boolean; // Whether content includes trending topic
}

// Default configuration from environment
const config: BanditConfig = {
  contentPrior: {
    alpha: parseFloat(process.env.BANDIT_SCOPE_CONTENT_PRIOR_ALPHA || '1.0'),
    beta: parseFloat(process.env.BANDIT_SCOPE_CONTENT_PRIOR_BETA || '1.0')
  },
  replyPrior: {
    alpha: parseFloat(process.env.BANDIT_SCOPE_REPLY_PRIOR_ALPHA || '1.0'),
    beta: parseFloat(process.env.BANDIT_SCOPE_REPLY_PRIOR_BETA || '1.0')
  },
  timingPrior: {
    alpha: parseFloat(process.env.BANDIT_SCOPE_TIMING_PRIOR_ALPHA || '1.0'),
    beta: parseFloat(process.env.BANDIT_SCOPE_TIMING_PRIOR_BETA || '1.0')
  },
  ucbExploration: parseFloat(process.env.UCB_EXPLORATION_FACTOR || '2.0'),
  minTrials: parseInt(process.env.BANDIT_MIN_TRIALS || '5', 10),
  hierarchicalShrinkage: parseFloat(process.env.BANDIT_HIERARCHICAL_SHRINKAGE || '0.1')
};

/**
 * Generate content arm ID from parameters
 */
export function generateContentArmId(format: string, hookType: string, topic: string): string {
  // Normalize components for consistent arm IDs
  const normalizedFormat = format.toLowerCase();
  const normalizedHook = hookType.toLowerCase().replace(/\s+/g, '_');
  const normalizedTopic = topic.toLowerCase().replace(/\s+/g, '_').substring(0, 20);
  
  return `${normalizedFormat}|${normalizedHook}|${normalizedTopic}`;
}

/**
 * Generate reply arm ID from parameters
 */
export function generateReplyArmId(targetCluster: string, openingStyle: string): string {
  const normalizedCluster = targetCluster.toLowerCase().replace(/\s+/g, '_');
  const normalizedStyle = openingStyle.toLowerCase().replace(/\s+/g, '_');
  
  return `${normalizedCluster}|${normalizedStyle}`;
}

/**
 * Generate timing arm ID from hour and day of week
 */
export function generateTimingArmId(hour: number, dayOfWeek: number): string {
  return `${hour}-${dayOfWeek}`;
}

/**
 * Sample from Beta distribution (Thompson Sampling)
 */
function betaSample(alpha: number, beta: number): number {
  // Simple Beta sampling using gamma random variables
  // For production, consider using a more robust implementation
  const gamma1 = gammaRandom(alpha);
  const gamma2 = gammaRandom(beta);
  return gamma1 / (gamma1 + gamma2);
}

/**
 * Simple gamma random variable generator (shape parameter only)
 */
function gammaRandom(shape: number): number {
  // Marsaglia and Tsang's Method for shape >= 1
  if (shape < 1) {
    return gammaRandom(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  
  while (true) {
    let x: number;
    let v: number;
    
    do {
      x = gaussianRandom();
      v = 1 + c * x;
    } while (v <= 0);
    
    v = v * v * v;
    const u = Math.random();
    
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Generate Gaussian random variable (Box-Muller transform)
 */
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Load arms for a given scope from database
 */
export async function loadArms(scope: BanditScope): Promise<BanditArm[]> {
  try {
    const { data: arms, error } = await supabase
      .from('bandit_arms')
      .select('*')
      .eq('scope', scope)
      .order('last_updated', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    const banditArms: BanditArm[] = (arms || []).map(arm => ({
      armId: arm.arm_id,
      scope: arm.scope as BanditScope,
      successes: arm.successes,
      trials: arm.trials,
      alpha: arm.alpha,
      beta: arm.beta,
      lastUpdated: new Date(arm.last_updated),
      createdAt: new Date(arm.created_at)
    }));
    
    log(`BANDIT_LOAD: scope=${scope} found=${banditArms.length} arms`);
    return banditArms;
    
  } catch (err: any) {
    error(`BANDIT_LOAD_ERROR: scope=${scope}: ${err.message}`);
    return [];
  }
}

/**
 * Create or update arm in database
 */
async function upsertArm(arm: BanditArm): Promise<void> {
  try {
    const { error } = await supabase
      .from('bandit_arms')
      .upsert({
        arm_id: arm.armId,
        scope: arm.scope,
        successes: arm.successes,
        trials: arm.trials,
        alpha: arm.alpha,
        beta: arm.beta,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'arm_id'
      });
    
    if (error) {
      throw error;
    }
    
    log(`BANDIT_UPSERT: armId=${arm.armId} trials=${arm.trials} successes=${arm.successes}`);
    
  } catch (err: any) {
    error(`BANDIT_UPSERT_ERROR: armId=${arm.armId}: ${err.message}`);
    throw err;
  }
}

/**
 * Update arm with reward (success/failure)
 */
export async function updateArm(
  scope: BanditScope,
  armId: string,
  reward: number
): Promise<void> {
  try {
    // Normalize reward to 0 or 1
    const success = reward > 0.5 ? 1 : 0;
    
    // Get current arm or create new one
    const { data: existingArm, error: fetchError } = await supabase
      .from('bandit_arms')
      .select('*')
      .eq('arm_id', armId)
      .single();
    
    let arm: BanditArm;
    
    if (fetchError || !existingArm) {
      // Create new arm with priors
      const prior = getPriorForScope(scope);
      arm = {
        armId,
        scope,
        successes: success,
        trials: 1,
        alpha: prior.alpha + success,
        beta: prior.beta + (1 - success),
        lastUpdated: new Date(),
        createdAt: new Date()
      };
    } else {
      // Update existing arm
      arm = {
        armId: existingArm.arm_id,
        scope: existingArm.scope as BanditScope,
        successes: existingArm.successes + success,
        trials: existingArm.trials + 1,
        alpha: existingArm.alpha + success,
        beta: existingArm.beta + (1 - success),
        lastUpdated: new Date(),
        createdAt: new Date(existingArm.created_at)
      };
    }
    
    await upsertArm(arm);
    
    log(`BANDIT_UPDATE: armId=${armId} reward=${reward} trials=${arm.trials} successes=${arm.successes} posterior=${arm.alpha}/${arm.beta}`);
    
  } catch (err: any) {
    error(`BANDIT_UPDATE_ERROR: armId=${armId} reward=${reward}: ${err.message}`);
    throw err;
  }
}

/**
 * Get prior parameters for scope
 */
function getPriorForScope(scope: BanditScope): { alpha: number; beta: number } {
  switch (scope) {
    case 'content':
      return config.contentPrior;
    case 'reply':
      return config.replyPrior;
    case 'timing':
      return config.timingPrior;
    default:
      return { alpha: 1.0, beta: 1.0 };
  }
}

/**
 * Select arm using Thompson Sampling (for content/reply)
 */
export async function selectArmThompson(
  scope: BanditScope,
  candidateArmIds: string[]
): Promise<ArmSelection> {
  if (candidateArmIds.length === 0) {
    throw new Error(`No candidate arms provided for scope: ${scope}`);
  }
  
  const arms = await loadArms(scope);
  const prior = getPriorForScope(scope);
  
  let bestArmId = candidateArmIds[0];
  let bestSample = 0;
  const armSamples: { armId: string; sample: number; trials: number }[] = [];
  
  for (const armId of candidateArmIds) {
    const arm = arms.find(a => a.armId === armId);
    
    let alpha: number, beta: number, trials: number;
    
    if (arm) {
      alpha = arm.alpha;
      beta = arm.beta;
      trials = arm.trials;
    } else {
      // New arm, use priors
      alpha = prior.alpha;
      beta = prior.beta;
      trials = 0;
    }
    
    const sample = betaSample(alpha, beta);
    armSamples.push({ armId, sample, trials });
    
    if (sample > bestSample) {
      bestSample = sample;
      bestArmId = armId;
    }
  }
  
  const selectedArm = armSamples.find(a => a.armId === bestArmId)!;
  
  log(`THOMPSON_SELECTION: scope=${scope} selected=${bestArmId} sample=${bestSample.toFixed(3)} candidates=${candidateArmIds.length}`);
  
  return {
    armId: bestArmId,
    expectedReward: bestSample,
    algorithm: 'thompson',
    reason: `Thompson sampling: β(${selectedArm.trials > 0 ? `${selectedArm.trials} trials` : 'prior'})`
  };
}

/**
 * Select arm using UCB1 (for timing)
 */
export async function selectArmUCB1(
  scope: BanditScope,
  candidateArmIds: string[]
): Promise<ArmSelection> {
  if (candidateArmIds.length === 0) {
    throw new Error(`No candidate arms provided for scope: ${scope}`);
  }
  
  const arms = await loadArms(scope);
  const totalTrials = arms.reduce((sum, arm) => {
    return candidateArmIds.includes(arm.armId) ? sum + arm.trials : sum;
  }, 0);
  
  let bestArmId = candidateArmIds[0];
  let bestUcbValue = -Infinity;
  const armValues: { armId: string; ucb: number; meanReward: number; trials: number }[] = [];
  
  for (const armId of candidateArmIds) {
    const arm = arms.find(a => a.armId === armId);
    
    let meanReward: number, trials: number, ucbValue: number;
    
    if (arm && arm.trials > 0) {
      meanReward = arm.successes / arm.trials;
      trials = arm.trials;
      
      if (totalTrials > 0) {
        const exploration = config.ucbExploration * Math.sqrt(Math.log(totalTrials) / trials);
        ucbValue = meanReward + exploration;
      } else {
        ucbValue = meanReward;
      }
    } else {
      // New arm gets maximum exploration bonus
      meanReward = 0.5; // Optimistic initialization
      trials = 0;
      ucbValue = Infinity; // Always select new arms first
    }
    
    armValues.push({ armId, ucb: ucbValue, meanReward, trials });
    
    if (ucbValue > bestUcbValue) {
      bestUcbValue = ucbValue;
      bestArmId = armId;
    }
  }
  
  const selectedArm = armValues.find(a => a.armId === bestArmId)!;
  
  log(`UCB1_SELECTION: scope=${scope} selected=${bestArmId} ucb=${bestUcbValue.toFixed(3)} mean=${selectedArm.meanReward.toFixed(3)} trials=${selectedArm.trials}`);
  
  return {
    armId: bestArmId,
    expectedReward: selectedArm.meanReward,
    confidence: bestUcbValue - selectedArm.meanReward, // Exploration bonus
    algorithm: 'ucb1',
    reason: `UCB1: μ=${selectedArm.meanReward.toFixed(3)} + ${(bestUcbValue - selectedArm.meanReward).toFixed(3)} exploration`
  };
}

/**
 * Get arm statistics for a scope
 */
export async function getArmStats(scope: BanditScope): Promise<{
  arms: Array<{
    armId: string;
    trials: number;
    successes: number;
    meanReward: number;
    posteriorMean: number;
    confidence95: [number, number];
  }>;
  totalTrials: number;
  topPerformers: string[];
}> {
  const arms = await loadArms(scope);
  
  const armStats = arms.map(arm => {
    const meanReward = arm.trials > 0 ? arm.successes / arm.trials : 0;
    const posteriorMean = arm.alpha / (arm.alpha + arm.beta);
    
    // 95% credible interval for Beta distribution (approximate)
    const variance = (arm.alpha * arm.beta) / ((arm.alpha + arm.beta) ** 2 * (arm.alpha + arm.beta + 1));
    const stdDev = Math.sqrt(variance);
    const confidence95: [number, number] = [
      Math.max(0, posteriorMean - 1.96 * stdDev),
      Math.min(1, posteriorMean + 1.96 * stdDev)
    ];
    
    return {
      armId: arm.armId,
      trials: arm.trials,
      successes: arm.successes,
      meanReward,
      posteriorMean,
      confidence95
    };
  });
  
  // Sort by posterior mean descending
  armStats.sort((a, b) => b.posteriorMean - a.posteriorMean);
  
  const totalTrials = arms.reduce((sum, arm) => sum + arm.trials, 0);
  const topPerformers = armStats
    .filter(arm => arm.trials >= config.minTrials)
    .slice(0, 5)
    .map(arm => arm.armId);
  
  return {
    arms: armStats,
    totalTrials,
    topPerformers
  };
}

/**
 * Generate timing arm candidates for current time context
 */
export function generateTimingCandidates(): string[] {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDow = now.getDay();
  
  // Generate candidates for current hour ±2 and current day ±1
  const candidates: string[] = [];
  
  for (let hourOffset = -2; hourOffset <= 2; hourOffset++) {
    for (let dowOffset = -1; dowOffset <= 1; dowOffset++) {
      const hour = (currentHour + hourOffset + 24) % 24;
      const dow = (currentDow + dowOffset + 7) % 7;
      candidates.push(generateTimingArmId(hour, dow));
    }
  }
  
  // Always include current exact time
  candidates.push(generateTimingArmId(currentHour, currentDow));
  
  return [...new Set(candidates)]; // Remove duplicates
}

/**
 * Select timing arm using UCB1
 */
export async function selectTimingArm(): Promise<ArmSelection> {
  const candidates = generateTimingCandidates();
  return selectArmUCB1('timing', candidates);
}

/**
 * Select content arm using Thompson Sampling
 */
export async function selectContentArm(
  format: string,
  hookTypes: string[],
  topics: string[]
): Promise<ArmSelection> {
  const candidates: string[] = [];
  
  for (const hookType of hookTypes) {
    for (const topic of topics) {
      candidates.push(generateContentArmId(format, hookType, topic));
    }
  }
  
  if (candidates.length === 0) {
    // Fallback to default
    candidates.push(generateContentArmId(format, 'educational', 'health_general'));
  }
  
  return selectArmThompson('content', candidates);
}

/**
 * Select reply arm using Thompson Sampling
 */
export async function selectReplyArm(
  targetClusters: string[],
  openingStyles: string[]
): Promise<ArmSelection> {
  const candidates: string[] = [];
  
  for (const cluster of targetClusters) {
    for (const style of openingStyles) {
      candidates.push(generateReplyArmId(cluster, style));
    }
  }
  
  if (candidates.length === 0) {
    // Fallback to default
    candidates.push(generateReplyArmId('health_discussion', 'supportive'));
  }
  
  return selectArmThompson('reply', candidates);
}

/**
 * 🏗️ HIERARCHICAL BANDITS - Group priors for empirical Bayes
 */

/**
 * Get or compute group prior for hierarchical bandits
 */
async function getGroupPrior(groupId: string): Promise<GroupPrior> {
  try {
    // Check KV cache first
    const cacheKey = `group_prior:${groupId}`;
    const cached = await kvGet(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Compute from database
    const { data, error } = await supabase
      .from('bandit_arms')
      .select('successes, trials')
      .like('arm_id', `%${groupId}%`);
    
    if (error) throw error;
    
    let totalSuccesses = 0;
    let totalTrials = 0;
    let count = 0;
    
    for (const arm of data || []) {
      totalSuccesses += arm.successes || 0;
      totalTrials += arm.trials || 0;
      count++;
    }
    
    // Empirical Bayes estimate
    const alpha = Math.max(1, totalSuccesses / Math.max(1, count));
    const beta = Math.max(1, (totalTrials - totalSuccesses) / Math.max(1, count));
    
    const groupPrior: GroupPrior = {
      groupId,
      alpha,
      beta,
      count
    };
    
    // Cache for 1 hour
    await kvSet(cacheKey, JSON.stringify(groupPrior), 60 * 60);
    
    return groupPrior;
    
  } catch (err: any) {
    warn(`GROUP_PRIOR_ERROR: ${groupId}: ${err.message}`);
    return {
      groupId,
      alpha: 1.0,
      beta: 1.0,
      count: 0
    };
  }
}

/**
 * Apply hierarchical shrinkage to arm posterior
 */
function applyHierarchicalShrinkage(
  armAlpha: number,
  armBeta: number,
  groupPrior: GroupPrior,
  shrinkage: number
): { alpha: number; beta: number } {
  
  // Shrink towards group prior
  const shrunkAlpha = (1 - shrinkage) * armAlpha + shrinkage * groupPrior.alpha;
  const shrunkBeta = (1 - shrinkage) * armBeta + shrinkage * groupPrior.beta;
  
  return {
    alpha: Math.max(0.1, shrunkAlpha),
    beta: Math.max(0.1, shrunkBeta)
  };
}

/**
 * Enhanced Thompson Sampling with hierarchical priors
 */
async function selectArmThompsonHierarchical(
  scope: BanditScope,
  candidates: string[]
): Promise<ArmSelection> {
  try {
    const arms = await loadArms(scope);
    const samples: Array<{ armId: string; sample: number; hierarchical: boolean }> = [];
    
    for (const armId of candidates) {
      const arm = arms.find(a => a.armId === armId);
      
      if (arm && arm.trials >= config.minTrials) {
        // Extract group ID (e.g., 'single|educational' from 'single|educational|health_general')
        const parts = armId.split('|');
        const groupId = parts.slice(0, 2).join('|');
        
        // Get group prior
        const groupPrior = await getGroupPrior(groupId);
        
        // Apply hierarchical shrinkage
        const { alpha, beta } = applyHierarchicalShrinkage(
          arm.alpha,
          arm.beta,
          groupPrior,
          config.hierarchicalShrinkage
        );
        
        const sample = betaSample(alpha, beta);
        samples.push({ armId, sample, hierarchical: true });
        
      } else {
        // Use group prior for new arms
        const parts = armId.split('|');
        const groupId = parts.slice(0, 2).join('|');
        const groupPrior = await getGroupPrior(groupId);
        
        const sample = betaSample(groupPrior.alpha, groupPrior.beta);
        samples.push({ armId, sample, hierarchical: false });
      }
    }
    
    if (samples.length === 0) {
      throw new Error('No valid candidates for sampling');
    }
    
    // Select best sample
    samples.sort((a, b) => b.sample - a.sample);
    const selected = samples[0];
    
    log(`THOMPSON_HIERARCHICAL: scope=${scope} selected=${selected.armId} sample=${selected.sample.toFixed(3)} hierarchical=${selected.hierarchical} candidates=${candidates.length}`);
    
    return {
      armId: selected.armId,
      expectedReward: selected.sample,
      algorithm: 'thompson',
      reason: `Hierarchical Thompson sampling: ${selected.hierarchical ? 'empirical Bayes' : 'group prior'}`
    };
    
  } catch (err: any) {
    error(`THOMPSON_HIERARCHICAL_ERROR: scope=${scope}: ${err.message}`);
    // Fallback selection
    return {
      armId: candidates[0] || 'default',
      expectedReward: 0.5,
      algorithm: 'thompson',
      reason: 'Fallback selection due to error'
    };
  }
}

/**
 * Enhanced timing selection with context features
 */
export async function selectTimingArmWithContext(context?: TimingContext): Promise<ArmSelection> {
  try {
    const baseSelection = await selectTimingArm();
    
    if (!context) return baseSelection;
    
    // Adjust selection based on context
    let adjustment = 0;
    let reasons: string[] = [baseSelection.reason];
    
    // Time since last post factor
    if (context.timeSinceLastPost !== undefined) {
      if (context.timeSinceLastPost < 2) {
        adjustment -= 0.1; // Penalty for posting too soon
        reasons.push('recent_post_penalty');
      } else if (context.timeSinceLastPost > 12) {
        adjustment += 0.05; // Slight bonus for gap
        reasons.push('gap_bonus');
      }
    }
    
    // Recent performance factor
    if (context.lastPostsMedianER !== undefined) {
      if (context.lastPostsMedianER < 0.02) {
        adjustment -= 0.05; // Lower confidence if recent posts underperformed
        reasons.push('low_recent_performance');
      } else if (context.lastPostsMedianER > 0.05) {
        adjustment += 0.05; // Higher confidence if recent posts performed well
        reasons.push('high_recent_performance');
      }
    }
    
    // Trending topic boost
    if (context.hasTrendingTopic) {
      adjustment += 0.1;
      reasons.push('trending_topic_boost');
    }
    
    const adjustedReward = Math.max(0, Math.min(1, baseSelection.expectedReward + adjustment));
    
    return {
      ...baseSelection,
      expectedReward: adjustedReward,
      reason: reasons.join(', ')
    };
    
  } catch (err: any) {
    error(`TIMING_CONTEXT_ERROR: ${err.message}`);
    return selectTimingArm(); // Fallback to basic selection
  }
}

/**
 * Test nearby time slots with small epsilon
 */
export async function testNearbySlots(baseHour: number, epsilon: number = 0.1): Promise<{
  originalSlot: string;
  nearbyTests: Array<{ slot: string; shouldTest: boolean; reason: string }>;
}> {
  const nearbyTests: Array<{ slot: string; shouldTest: boolean; reason: string }> = [];
  
  // Test ±1 hour slots
  for (const offset of [-1, 1]) {
    const testHour = (baseHour + offset + 24) % 24;
    const dow = new Date().getDay();
    const testSlot = `${testHour}-${dow}`;
    
    // Decide whether to test with epsilon probability
    const shouldTest = Math.random() < epsilon;
    const reason = shouldTest ? 'epsilon_exploration' : 'exploit_current';
    
    nearbyTests.push({ slot: testSlot, shouldTest, reason });
  }
  
  return {
    originalSlot: `${baseHour}-${new Date().getDay()}`,
    nearbyTests
  };
}
