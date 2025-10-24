/**
 * Reply Cycle Job
 * Discovers reply opportunities and generates strategic responses
 */

import { selectReplyArm, generateReplyArmId } from '../learning/bandits';
import { predictPerformance } from '../learning/predictor';
import { isDuplicate } from '../learning/embeddings';
import { kvGet, kvSet } from '../utils/kv';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { log_compat as log, log_compat as warn, log_compat as error } from '../utils/logger';

export interface ReplyTarget {
  tweetId: string;
  authorHandle: string;
  content: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    views?: number;
  };
  topic: string;
  cluster: string;
  opportunityScore: number;
  discoveredAt: Date;
}

export interface ReplyPlan {
  target: ReplyTarget;
  replyArm: string;
  openingStyle: string;
  targetCluster: string;
  predictedER: number;
  predictedFollowThrough: number;
  confidence: number;
  reasoning: string[];
}

export interface ReplyRequest {
  plan: ReplyPlan;
  content?: string;
  metadata: {
    banditArm: string;
    target_tweet_id: string;
    target_author: string;
    predicted_er?: number;
    predicted_follow_through?: number;
  };
}

const REPLY_MAX_PER_DAY = parseInt(process.env.REPLY_MAX_PER_DAY || '72', 10); // 3 per hour * 24 hours
const REPLY_MINUTES_BETWEEN = parseInt(process.env.REPLY_MINUTES_BETWEEN || '20', 10); // 20 minutes = 3 per hour
const TARGET_DISCOVERY_INTERVAL_MIN = parseInt(process.env.TARGET_DISCOVERY_INTERVAL_MIN || '30', 10);

const HEALTH_KEYWORDS = [
  'health', 'fitness', 'nutrition', 'diet', 'exercise', 'sleep', 'stress',
  'wellness', 'medical', 'doctor', 'supplement', 'vitamin', 'protein',
  'mental health', 'anxiety', 'depression', 'therapy', 'meditation',
  'weight loss', 'muscle', 'cardio', 'yoga', 'running', 'training'
];

const TARGET_CLUSTERS = [
  'health_questions',
  'fitness_advice',
  'nutrition_tips',
  'mental_wellness',
  'sleep_optimization',
  'supplement_discussion',
  'workout_motivation',
  'wellness_journey'
];

const OPENING_STYLES = [
  'supportive',
  'informative',
  'empathetic',
  'expert_insight',
  'personal_experience',
  'resource_sharing'
];

/**
 * Check reply quota for today
 */
async function checkReplyQuota(): Promise<{
  canReply: boolean;
  repliesUsed: number;
  timeUntilNext?: number;
}> {
  const today = new Date().toISOString().split('T')[0];
  const quotaKey = `prod:reply:quota:${today}`;
  const lastReplyKey = `prod:reply:last_reply`;
  
  try {
    const repliesUsed = parseInt(await kvGet(quotaKey) || '0', 10);
    const lastReplyTime = await kvGet(lastReplyKey);
    
    // Check daily quota
    if (repliesUsed >= REPLY_MAX_PER_DAY) {
      return {
        canReply: false,
        repliesUsed,
        timeUntilNext: undefined // Wait until tomorrow
      };
    }
    
    // Check time between replies
    if (lastReplyTime) {
      const lastTime = new Date(lastReplyTime);
      const now = new Date();
      const minutesSinceLastReply = (now.getTime() - lastTime.getTime()) / (1000 * 60);
      
      if (minutesSinceLastReply < REPLY_MINUTES_BETWEEN) {
        const timeUntilNext = (REPLY_MINUTES_BETWEEN - minutesSinceLastReply) * 60 * 1000; // ms
        return {
          canReply: false,
          repliesUsed,
          timeUntilNext
        };
      }
    }
    
    return {
      canReply: true,
      repliesUsed
    };
    
  } catch (err: any) {
    error(`REPLY_QUOTA_CHECK_ERROR: ${err.message}`);
    return {
      canReply: false,
      repliesUsed: REPLY_MAX_PER_DAY // Assume quota exhausted on error
    };
  }
}

/**
 * Update reply quota after posting
 */
async function updateReplyQuota(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const quotaKey = `prod:reply:quota:${today}`;
  const lastReplyKey = `prod:reply:last_reply`;
  
  try {
    const currentCount = parseInt(await kvGet(quotaKey) || '0', 10);
    await kvSet(quotaKey, (currentCount + 1).toString(), 24 * 60 * 60); // 24 hour TTL
    await kvSet(lastReplyKey, new Date().toISOString(), 2 * 60 * 60); // 2 hour TTL
    
    log(`REPLY_QUOTA_UPDATE: Used ${currentCount + 1}/${REPLY_MAX_PER_DAY} replies today`);
    
  } catch (err: any) {
    error(`REPLY_QUOTA_UPDATE_ERROR: ${err.message}`);
  }
}

/**
 * Classify topic cluster for content
 */
function classifyTopicCluster(content: string): string {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('sleep') || lowerContent.includes('tired') || lowerContent.includes('insomnia')) {
    return 'sleep_optimization';
  }
  
  if (lowerContent.includes('anxiety') || lowerContent.includes('stress') || lowerContent.includes('mental')) {
    return 'mental_wellness';
  }
  
  if (lowerContent.includes('diet') || lowerContent.includes('nutrition') || lowerContent.includes('food')) {
    return 'nutrition_tips';
  }
  
  if (lowerContent.includes('workout') || lowerContent.includes('exercise') || lowerContent.includes('gym')) {
    return 'fitness_advice';
  }
  
  if (lowerContent.includes('supplement') || lowerContent.includes('vitamin') || lowerContent.includes('protein')) {
    return 'supplement_discussion';
  }
  
  if (lowerContent.includes('motivation') || lowerContent.includes('journey') || lowerContent.includes('goal')) {
    return 'wellness_journey';
  }
  
  if (lowerContent.includes('?')) {
    return 'health_questions';
  }
  
  return 'health_questions'; // Default
}

/**
 * Calculate opportunity score for a potential reply target
 */
function calculateOpportunityScore(
  metrics: ReplyTarget['metrics'],
  content: string,
  authorHandle: string
): number {
  // Base score from engagement
  const engagementScore = Math.log10(
    (metrics.likes || 0) + 
    (metrics.retweets || 0) * 2 + 
    (metrics.replies || 0) * 3 + 1
  ) / 5; // Normalize to ~0-1
  
  // Content relevance score
  const relevanceScore = HEALTH_KEYWORDS.reduce((score, keyword) => {
    return content.toLowerCase().includes(keyword) ? score + 0.1 : score;
  }, 0);
  
  // Question bonus (questions get more engagement)
  const questionBonus = content.includes('?') ? 0.2 : 0;
  
  // Author authority penalty (avoid replying to major accounts)
  const followerPenalty = authorHandle.length < 15 ? 0 : -0.1; // Rough heuristic
  
  const score = Math.min(1.0, engagementScore + relevanceScore + questionBonus + followerPenalty);
  
  return Math.max(0, score);
}

/**
 * Mock target discovery (in real implementation, this would use Twitter API or scraping)
 */
async function discoverReplyTargets(): Promise<ReplyTarget[]> {
  // This is a mock implementation
  // In production, this would:
  // 1. Monitor health-related hashtags and keywords
  // 2. Find tweets with engagement but not too many replies
  // 3. Filter for accounts that aren't too large
  // 4. Prioritize questions and discussions
  
  log(`REPLY_DISCOVERY: Mock discovery running (${TARGET_DISCOVERY_INTERVAL_MIN}min interval)`);
  
  // Return empty for now - would be populated by real discovery
  return [];
}

/**
 * Select optimal reply target from candidates
 */
function selectReplyTarget(targets: ReplyTarget[]): ReplyTarget | null {
  if (targets.length === 0) {
    return null;
  }
  
  // Sort by opportunity score and select top candidate
  const sorted = targets.sort((a, b) => b.opportunityScore - a.opportunityScore);
  
  // Filter out targets with very low scores
  const viableTargets = sorted.filter(t => t.opportunityScore >= 0.3);
  
  if (viableTargets.length === 0) {
    return null;
  }
  
  return viableTargets[0];
}

/**
 * Plan reply using bandit selection
 */
async function planReply(target: ReplyTarget): Promise<ReplyPlan | null> {
  try {
    // Select reply arm using Thompson Sampling
    const replySelection = await selectReplyArm(
      [target.cluster],
      OPENING_STYLES
    );
    
    // Parse arm to get components
    const armParts = replySelection.armId.split('|');
    const targetCluster = armParts[0] || target.cluster;
    const openingStyle = armParts[1] || 'supportive';
    
    // Predict performance for this reply context
    const mockReplyContent = `[${openingStyle}] Reply to ${target.topic} discussion`;
    const prediction = await predictPerformance(mockReplyContent, {
      hook_type: 'reply',
      style: openingStyle,
      topic: target.topic
    });
    
    const plan: ReplyPlan = {
      target,
      replyArm: replySelection.armId,
      openingStyle,
      targetCluster,
      predictedER: prediction.engagementRate,
      predictedFollowThrough: prediction.followThrough,
      confidence: prediction.confidence,
      reasoning: [
        `Reply arm: ${replySelection.reason}`,
        `Target score: ${target.opportunityScore.toFixed(3)}`,
        `Predicted ER: ${(prediction.engagementRate * 100).toFixed(2)}%`
      ]
    };
    
    log(`REPLY_PLAN: target=${target.tweetId} arm=${plan.replyArm} style=${plan.openingStyle} predER=${plan.predictedER.toFixed(4)}`);
    
    return plan;
    
  } catch (err: any) {
    error(`REPLY_PLAN_ERROR: target=${target.tweetId}: ${err.message}`);
    return null;
  }
}

/**
 * Validate reply content
 */
async function validateReplyContent(
  content: string,
  plan: ReplyPlan
): Promise<{
  isValid: boolean;
  issues: string[];
  predictedER: number;
  predictedFollowThrough: number;
  isDuplicate: boolean;
}> {
  const issues: string[] = [];
  let isValid = true;
  
  try {
    // Length check
    if (content.length > 280) {
      issues.push(`Reply too long: ${content.length} chars`);
      isValid = false;
    }
    
    // Minimum length check
    if (content.length < 20) {
      issues.push(`Reply too short: ${content.length} chars`);
      isValid = false;
    }
    
    // No hashtags in replies (generally)
    if (content.includes('#')) {
      issues.push('Hashtags not recommended in replies');
      // Don't mark invalid, just warn
    }
    
    // No @mentions except the target (to avoid spam)
    const mentions = content.match(/@\w+/g) || [];
    if (mentions.length > 1) {
      issues.push(`Too many mentions: ${mentions.length}`);
      isValid = false;
    }
    
    // Duplicate check (against recent replies)
    const duplicateCheck = await isDuplicate(content, 3); // 3-day window for replies
    if (duplicateCheck.isDuplicate) {
      issues.push(`Duplicate reply detected: ${(duplicateCheck.maxSimilarity * 100).toFixed(1)}% similar`);
      isValid = false;
    }
    
    // Predict performance
    const prediction = await predictPerformance(content, {
      hook_type: 'reply',
      style: plan.openingStyle,
      topic: plan.target.topic
    });
    
    log(`REPLY_VALIDATION: valid=${isValid} duplicate=${duplicateCheck.isDuplicate} issues=${issues.length}`);
    
    return {
      isValid,
      issues,
      predictedER: prediction.engagementRate,
      predictedFollowThrough: prediction.followThrough,
      isDuplicate: duplicateCheck.isDuplicate
    };
    
  } catch (err: any) {
    error(`REPLY_VALIDATION_ERROR: ${err.message}`);
    
    return {
      isValid: false,
      issues: [`Validation error: ${err.message}`],
      predictedER: 0,
      predictedFollowThrough: 0,
      isDuplicate: false
    };
  }
}

/**
 * Main reply cycle job
 */
export async function runReplyCycle(): Promise<{
  targetsDiscovered: number;
  repliesPlanned: number;
  quotaUsed: number;
  errors: string[];
}> {
  log(`REPLY_CYCLE: Starting reply cycle job`);
  
  const errors: string[] = [];
  let targetsDiscovered = 0;
  let repliesPlanned = 0;
  
  try {
    // Check if replies are enabled
    if (process.env.ENABLE_REPLIES !== 'true') {
      log(`REPLY_CYCLE: Replies disabled via ENABLE_REPLIES environment variable`);
      return {
        targetsDiscovered: 0,
        repliesPlanned: 0,
        quotaUsed: 0,
        errors: ['Replies disabled']
      };
    }
    
    // Check quota
    const quotaCheck = await checkReplyQuota();
    if (!quotaCheck.canReply) {
      const reason = quotaCheck.timeUntilNext 
        ? `Rate limited: ${Math.ceil(quotaCheck.timeUntilNext / 60000)} minutes remaining`
        : `Daily quota reached: ${quotaCheck.repliesUsed}/${REPLY_MAX_PER_DAY}`;
      
      log(`REPLY_CYCLE: ${reason}`);
      return {
        targetsDiscovered: 0,
        repliesPlanned: 0,
        quotaUsed: quotaCheck.repliesUsed,
        errors: [reason]
      };
    }
    
    // Step 1: Discover reply targets
    const targets = await discoverReplyTargets();
    targetsDiscovered = targets.length;
    
    if (targets.length === 0) {
      log(`REPLY_CYCLE: No viable targets discovered`);
      return {
        targetsDiscovered: 0,
        repliesPlanned: 0,
        quotaUsed: quotaCheck.repliesUsed,
        errors: []
      };
    }
    
    // Step 2: Select best target
    const selectedTarget = selectReplyTarget(targets);
    if (!selectedTarget) {
      log(`REPLY_CYCLE: No target met opportunity threshold`);
      return {
        targetsDiscovered,
        repliesPlanned: 0,
        quotaUsed: quotaCheck.repliesUsed,
        errors: []
      };
    }
    
    // Step 3: Plan reply
    const plan = await planReply(selectedTarget);
    if (!plan) {
      errors.push('Failed to create reply plan');
      return {
        targetsDiscovered,
        repliesPlanned: 0,
        quotaUsed: quotaCheck.repliesUsed,
        errors
      };
    }
    
    repliesPlanned = 1;
    
    // Step 4: Generate and validate reply content (would be done by generation system)
    // For now, just log the plan
    log(`REPLY_PLANNED: target=${plan.target.tweetId} author=${plan.target.authorHandle} arm=${plan.replyArm}`);
    
    // In real implementation, this would:
    // 1. Generate reply content using the plan
    // 2. Validate the content
    // 3. Post the reply if valid
    // 4. Update quota
    // 5. Track the reply for learning
    
    log(`REPLY_CYCLE_COMPLETE: discovered=${targetsDiscovered} planned=${repliesPlanned}`);
    
    return {
      targetsDiscovered,
      repliesPlanned,
      quotaUsed: quotaCheck.repliesUsed,
      errors
    };
    
  } catch (err: any) {
    error(`REPLY_CYCLE_ERROR: ${err.message}`);
    errors.push(`Job error: ${err.message}`);
    
    return {
      targetsDiscovered,
      repliesPlanned,
      quotaUsed: 0,
      errors
    };
  }
}

/**
 * Get reply cycle status
 */
export async function getReplyCycleStatus(): Promise<{
  enabled: boolean;
  quotaUsed: number;
  quotaLimit: number;
  timeUntilNextReply?: number;
  lastDiscovery?: Date;
  activeTargets: number;
}> {
  try {
    const quotaCheck = await checkReplyQuota();
    
    return {
      enabled: process.env.ENABLE_REPLIES === 'true',
      quotaUsed: quotaCheck.repliesUsed,
      quotaLimit: REPLY_MAX_PER_DAY,
      timeUntilNextReply: quotaCheck.timeUntilNext,
      lastDiscovery: undefined, // Would be tracked in discovery system
      activeTargets: 0 // Would be counted from target discovery
    };
    
  } catch (err: any) {
    error(`REPLY_STATUS_ERROR: ${err.message}`);
    
    return {
      enabled: false,
      quotaUsed: 0,
      quotaLimit: REPLY_MAX_PER_DAY,
      activeTargets: 0
    };
  }
}

/**
 * Create reply request from plan
 */
export function createReplyRequest(plan: ReplyPlan): ReplyRequest {
  return {
    plan,
    metadata: {
      banditArm: plan.replyArm,
      target_tweet_id: plan.target.tweetId,
      target_author: plan.target.authorHandle,
      predicted_er: plan.predictedER,
      predicted_follow_through: plan.predictedFollowThrough
    }
  };
}
