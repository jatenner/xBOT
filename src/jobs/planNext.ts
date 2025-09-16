/**
 * Plan Next Job
 * Plans optimal content using bandits and predictor
 */

import { selectTimingArm, selectContentArm, generateContentArmId } from '../learning/bandits';
import { predictPerformance } from '../learning/predictor';
import { isDuplicate } from '../learning/embeddings';
import { extractFeatures } from '../learning/featureExtractor';
import { getActiveExperiments, assignVariant } from '../learning/experiment';
// import { enforceRotation } from '../learning/rotationPolicy'; // Will be implemented
import { kvGet, kvSet } from '../utils/kv';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface ContentPlan {
  timingArm: string;
  contentArm: string;
  format: 'single' | 'thread';
  hookType: string;
  topic: string;
  contentStyle: string;
  experimentId?: string;
  experimentVariant?: 'A' | 'B';
  predictedER: number;
  predictedFollowThrough: number;
  confidence: number;
  reasoning: string[];
  explore: boolean; // Mark as exploration vs exploitation
}

export interface ExploreExploitConfig {
  EXPLORE_RATIO_MIN: number;
  EXPLORE_RATIO_MAX: number;
  PERFORMANCE_WINDOW_HOURS: number;
  TARGET_ER_THRESHOLD: number;
}

export interface GenerationRequest {
  plan: ContentPlan;
  content?: string;
  threadParts?: string[];
  metadata: {
    banditArm: string;
    timingArm: string;
    experimentId?: string;
    quality_score?: number;
    predicted_er?: number;
    predicted_follow_through?: number;
  };
}

const CONTENT_FORMATS = ['single', 'thread'] as const;
const HOOK_TYPES = [
  'educational',
  'myth_busting',
  'controversy_starter',
  'story_opener',
  'data_driven',
  'question_hook',
  'shocking_fact'
] as const;

const HEALTH_TOPICS = [
  'sleep_optimization',
  'stress_management', 
  'nutrition_science',
  'exercise_physiology',
  'mental_health',
  'longevity_research',
  'supplement_analysis',
  'biohacking',
  'disease_prevention',
  'cognitive_enhancement'
] as const;

const CONTENT_STYLES = [
  'expert_authority',
  'conversational',
  'scientific_breakdown',
  'myth_debunking',
  'practical_tips',
  'research_summary'
] as const;

// Explore/Exploit Configuration
const EXPLORE_CONFIG: ExploreExploitConfig = {
  EXPLORE_RATIO_MIN: parseFloat(process.env.EXPLORE_RATIO_MIN || '0.1'),
  EXPLORE_RATIO_MAX: parseFloat(process.env.EXPLORE_RATIO_MAX || '0.4'),
  PERFORMANCE_WINDOW_HOURS: parseInt(process.env.PERFORMANCE_WINDOW_HOURS || '24', 10),
  TARGET_ER_THRESHOLD: parseFloat(process.env.TARGET_ER_THRESHOLD || '0.025')
};

/**
 * 🧭 EXPLORE/EXPLOIT CONTROLLER
 * Dynamically adjusts exploration ratio based on recent performance
 */

/**
 * Get current explore ratio based on recent performance
 */
async function getCurrentExploreRatio(): Promise<number> {
  try {
    // Check cache first
    const cacheKey = 'explore_ratio:current';
    const cached = await kvGet(cacheKey);
    
    if (cached) {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      
      // Cache for 1 hour
      if (age < 60 * 60 * 1000) {
        return data.ratio;
      }
    }
    
    // Compute based on recent performance
    const ratio = await computeExploreRatio();
    
    // Cache the result
    await kvSet(cacheKey, JSON.stringify({
      ratio,
      timestamp: Date.now()
    }), 60 * 60); // 1 hour cache
    
    return ratio;
    
  } catch (err: any) {
    warn(`EXPLORE_RATIO_ERROR: ${err.message}`);
    return 0.2; // Safe default
  }
}

/**
 * Compute explore ratio based on recent median ER
 */
async function computeExploreRatio(): Promise<number> {
  try {
    // Get recent posts performance - simplified for now
    // In production, would query actual metrics from database
    
    // Mock recent median ER - replace with actual query
    const recentMedianER = 0.025; // Default assumption
    
    let ratio: number;
    
    if (recentMedianER < EXPLORE_CONFIG.TARGET_ER_THRESHOLD * 0.8) {
      // Performance is low - increase exploration
      ratio = EXPLORE_CONFIG.EXPLORE_RATIO_MAX;
      log(`EXPLORE_CONTROLLER: Low performance (${(recentMedianER * 100).toFixed(2)}%) - increasing exploration to ${(ratio * 100).toFixed(1)}%`);
    } else if (recentMedianER > EXPLORE_CONFIG.TARGET_ER_THRESHOLD * 1.2) {
      // Performance is high - decrease exploration
      ratio = EXPLORE_CONFIG.EXPLORE_RATIO_MIN;
      log(`EXPLORE_CONTROLLER: High performance (${(recentMedianER * 100).toFixed(2)}%) - decreasing exploration to ${(ratio * 100).toFixed(1)}%`);
    } else {
      // Performance is on target - balanced exploration
      ratio = (EXPLORE_CONFIG.EXPLORE_RATIO_MIN + EXPLORE_CONFIG.EXPLORE_RATIO_MAX) / 2;
      log(`EXPLORE_CONTROLLER: Target performance (${(recentMedianER * 100).toFixed(2)}%) - balanced exploration ${(ratio * 100).toFixed(1)}%`);
    }
    
    return Math.max(EXPLORE_CONFIG.EXPLORE_RATIO_MIN, Math.min(EXPLORE_CONFIG.EXPLORE_RATIO_MAX, ratio));
    
  } catch (err: any) {
    error(`EXPLORE_RATIO_COMPUTATION_ERROR: ${err.message}`);
    return 0.2;
  }
}

/**
 * Decide if next content should be exploration or exploitation
 */
async function shouldExplore(): Promise<boolean> {
  const exploreRatio = await getCurrentExploreRatio();
  const isExplore = Math.random() < exploreRatio;
  
  log(`EXPLORE_DECISION: ratio=${(exploreRatio * 100).toFixed(1)}% decision=${isExplore ? 'EXPLORE' : 'EXPLOIT'}`);
  return isExplore;
}

/**
 * Generate candidate content arms for current context
 */
function generateContentCandidates(): string[] {
  const candidates: string[] = [];
  
  // Generate combinations of format, hook, and topic
  for (const format of CONTENT_FORMATS) {
    for (const hookType of HOOK_TYPES.slice(0, 4)) { // Limit to top hook types
      for (const topic of HEALTH_TOPICS.slice(0, 5)) { // Limit to top topics
        candidates.push(generateContentArmId(format, hookType, topic));
      }
    }
  }
  
  return candidates;
}

/**
 * Parse content arm ID back to components
 */
function parseContentArm(armId: string): {
  format: string;
  hookType: string;
  topic: string;
} {
  const parts = armId.split('|');
  return {
    format: parts[0] || 'single',
    hookType: parts[1] || 'educational',
    topic: parts[2] || 'health_general'
  };
}

/**
 * Select content style based on experiment or defaults
 */
async function selectContentStyle(hookType: string): Promise<{
  style: string;
  experimentId?: string;
  variant?: 'A' | 'B';
}> {
  // Check for active style experiments
  const experiments = await getActiveExperiments('style');
  
  if (experiments.length > 0) {
    const experiment = experiments[0]; // Use first active experiment
    const variant = await assignVariant(experiment.id);
    
    const style = variant === 'A' ? experiment.variantA : experiment.variantB;
    
    log(`CONTENT_STYLE_EXPERIMENT: experiment=${experiment.id} variant=${variant} style=${style}`);
    
    return {
      style,
      experimentId: experiment.id,
      variant
    };
  }
  
  // Default style selection based on hook type
  const styleMap: Record<string, string> = {
    'educational': 'expert_authority',
    'myth_busting': 'myth_debunking',
    'controversy_starter': 'conversational',
    'story_opener': 'conversational',
    'data_driven': 'scientific_breakdown',
    'question_hook': 'practical_tips',
    'shocking_fact': 'research_summary'
  };
  
  return {
    style: styleMap[hookType] || 'expert_authority'
  };
}

/**
 * Plan next content using bandit selection and prediction
 */
export async function planNextContent(): Promise<ContentPlan | null> {
  try {
    log(`PLAN_NEXT: Starting content planning`);
    
    // Check if planning is enabled
    if (FEATURE_FLAGS.POSTING_DISABLED) {
      log(`PLAN_NEXT: Posting disabled, planning dry run only`);
    }
    
    // Step 1: Select timing using UCB1
    const timingSelection = await selectTimingArm();
    
    // Step 2: Generate content candidates
    const contentCandidates = generateContentCandidates();
    
    // Step 3: Select content arm using Thompson Sampling
    const contentSelection = await selectContentArm(
      'single', // We'll determine format from the selected arm
      Array.from(HOOK_TYPES),
      Array.from(HEALTH_TOPICS)
    );
    
    // Step 4: Parse selected arm
    const contentArm = parseContentArm(contentSelection.armId);
    
    // Step 5: Select content style (with potential experiment)
    const styleSelection = await selectContentStyle(contentArm.hookType);
    
    // Step 6: Create initial plan
    const isExplore = await shouldExplore();
    
    const plan: ContentPlan = {
      timingArm: timingSelection.armId,
      contentArm: contentSelection.armId,
      format: contentArm.format as 'single' | 'thread',
      hookType: contentArm.hookType,
      topic: contentArm.topic,
      contentStyle: styleSelection.style,
      experimentId: styleSelection.experimentId,
      experimentVariant: styleSelection.variant,
      predictedER: 0,
      predictedFollowThrough: 0,
      confidence: 0,
      explore: isExplore,
      reasoning: [
        `Timing: ${timingSelection.reason}`,
        `Content: ${contentSelection.reason}`,
        `Style: ${styleSelection.experimentId ? 'A/B experiment' : 'default selection'}`,
        `Mode: ${isExplore ? 'EXPLORE' : 'EXPLOIT'}`
      ]
    };
    
    // Step 7: Predict performance using current plan
    const mockContent = `[${plan.hookType}] ${plan.topic.replace(/_/g, ' ')} content in ${plan.contentStyle} style`;
    const prediction = await predictPerformance(mockContent, {
      hook_type: plan.hookType,
      style: plan.contentStyle,
      topic: plan.topic,
      thread_length: plan.format === 'thread' ? 3 : 1
    });
    
    plan.predictedER = prediction.engagementRate;
    plan.predictedFollowThrough = prediction.followThrough;
    plan.confidence = prediction.confidence;
    plan.reasoning.push(`Predicted ER: ${(prediction.engagementRate * 100).toFixed(2)}%`);
    plan.reasoning.push(`Predicted follow-through: ${(prediction.followThrough * 100).toFixed(3)}%`);
    
    log(`PLAN_NEXT_COMPLETE: timing=${plan.timingArm} content=${plan.contentArm} style=${plan.contentStyle} predER=${plan.predictedER.toFixed(4)}`);
    
    return plan;
    
  } catch (err: any) {
    error(`PLAN_NEXT_ERROR: ${err.message}`);
    return null;
  }
}

/**
 * Validate and score content against plan
 */
export async function validateAndScoreContent(
  content: string,
  plan: ContentPlan,
  threadParts?: string[]
): Promise<{
  isValid: boolean;
  qualityScore: number;
  predictedER: number;
  predictedFollowThrough: number;
  isDuplicate: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  let isValid = true;
  
  try {
    // Extract features for validation
    const features = extractFeatures(content, {
      hook_type: plan.hookType,
      style: plan.contentStyle,
      topic: plan.topic,
      thread_length: threadParts?.length || 1
    });
    
    // Quality checks
    const MIN_QUALITY_SCORE = parseInt(process.env.MIN_QUALITY_SCORE || '70', 10);
    if (features.quality_score && features.quality_score < MIN_QUALITY_SCORE) {
      issues.push(`Quality score ${features.quality_score} below minimum ${MIN_QUALITY_SCORE}`);
      isValid = false;
    }
    
    // Length checks
    if (features.length > 280) {
      issues.push(`Content too long: ${features.length} chars`);
      isValid = false;
    }
    
    // Compliance checks
    if (process.env.BLOCK_POLITICS === 'true' && features.has_political_content) {
      issues.push('Political content detected');
      isValid = false;
    }
    
    if (process.env.FORCE_NO_HASHTAGS === 'true' && features.has_hashtags) {
      issues.push('Hashtags not allowed');
      isValid = false;
    }
    
    const EMOJI_MAX = parseInt(process.env.EMOJI_MAX || '3', 10);
    if (features.emoji_count > EMOJI_MAX) {
      issues.push(`Too many emojis: ${features.emoji_count} > ${EMOJI_MAX}`);
      isValid = false;
    }
    
    // Duplicate check
    const DUP_WINDOW_DAYS = parseInt(process.env.DUP_WINDOW_DAYS || '7', 10);
    const duplicateCheck = await isDuplicate(content, DUP_WINDOW_DAYS);
    
    if (duplicateCheck.isDuplicate) {
      issues.push(`Duplicate content detected: ${(duplicateCheck.maxSimilarity * 100).toFixed(1)}% similar`);
      isValid = false;
    }
    
    // Predict performance
    const prediction = await predictPerformance(content, {
      hook_type: plan.hookType,
      style: plan.contentStyle,
      topic: plan.topic,
      thread_length: threadParts?.length || 1
    });
    
    const qualityScore = Math.round(
      (prediction.engagementRate * 40) + // ER contributes 40 points max
      (prediction.followThrough * 1000 * 30) + // Follow-through contributes 30 points max  
      (prediction.confidence * 30) // Confidence contributes 30 points max
    );
    
    log(`CONTENT_VALIDATION: valid=${isValid} quality=${qualityScore} duplicate=${duplicateCheck.isDuplicate} issues=${issues.length}`);
    
    return {
      isValid,
      qualityScore,
      predictedER: prediction.engagementRate,
      predictedFollowThrough: prediction.followThrough,
      isDuplicate: duplicateCheck.isDuplicate,
      issues
    };
    
  } catch (err: any) {
    error(`CONTENT_VALIDATION_ERROR: ${err.message}`);
    
    return {
      isValid: false,
      qualityScore: 0,
      predictedER: 0,
      predictedFollowThrough: 0,
      isDuplicate: false,
      issues: [`Validation error: ${err.message}`]
    };
  }
}

/**
 * Create generation request from plan
 */
export function createGenerationRequest(plan: ContentPlan): GenerationRequest {
  return {
    plan,
    metadata: {
      banditArm: plan.contentArm,
      timingArm: plan.timingArm,
      experimentId: plan.experimentId,
      predicted_er: plan.predictedER,
      predicted_follow_through: plan.predictedFollowThrough
    }
  };
}

/**
 * Plan multiple content pieces for batch generation
 */
export async function planBatchContent(count: number = 5): Promise<ContentPlan[]> {
  const plans: ContentPlan[] = [];
  
  try {
    log(`PLAN_BATCH: Planning ${count} content pieces`);
    
    for (let i = 0; i < count; i++) {
      const plan = await planNextContent();
      if (plan) {
        plans.push(plan);
      }
      
      // Small delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    log(`PLAN_BATCH_COMPLETE: ${plans.length} plans created`);
    return plans;
    
  } catch (err: any) {
    error(`PLAN_BATCH_ERROR: ${err.message}`);
    return plans;
  }
}

/**
 * Get planning statistics
 */
export async function getPlanningStats(): Promise<{
  totalPlans: number;
  avgPredictedER: number;
  avgPredictedFT: number;
  topPerformingArms: string[];
  activeExperiments: number;
}> {
  try {
    // This would typically query a plans table
    // For now, return mock stats
    
    const experiments = await getActiveExperiments();
    
    return {
      totalPlans: 0, // Would be counted from plans table
      avgPredictedER: 0.025, // 2.5% average
      avgPredictedFT: 0.002, // 0.2% average
      topPerformingArms: [], // Would be from bandit stats
      activeExperiments: experiments.length
    };
    
  } catch (err: any) {
    error(`PLANNING_STATS_ERROR: ${err.message}`);
    return {
      totalPlans: 0,
      avgPredictedER: 0,
      avgPredictedFT: 0,
      topPerformingArms: [],
      activeExperiments: 0
    };
  }
}
