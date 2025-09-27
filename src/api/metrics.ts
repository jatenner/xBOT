/**
 * 📊 METRICS ENDPOINT
 * Provides operational metrics for monitoring and observability
 */

import { Request, Response } from 'express';
import { JobManager } from '../jobs/jobManager';
import { getConfig } from '../config/config';

// Metrics imports
async function getLLMMetrics() {
  try {
    const { getLLMMetrics } = await import('../jobs/planJob');
    return getLLMMetrics();
  } catch {
    return { calls_total: 0, calls_failed: 0, failure_reasons: {} };
  }
}

async function getPostingMetrics() {
  try {
    const { getPostingMetrics } = await import('../posting/orchestrator');
    return getPostingMetrics();
  } catch {
    return { posts_attempted: 0, posts_posted: 0, posts_skipped: 0, skip_reasons: {} };
  }
}

export interface SystemMetrics {
  // Time window (last 60 minutes)
  timeWindow: string;
  
  // Job counts
  plans: number;
  replies: number;
  postings: number;
  learnRuns: number;
  
  // AI usage
  openaiCostUsd: number;
  openaiCalls_total: number;
  openaiCalls_failed: number;
  openaiFailureReasons: Record<string, number>;
  
  // Learning stats
  banditArmsUpdated: number;
  predictorStatus: 'none' | 'v1' | 'v2';
  exploreRatio: number;
  
  // LLM metrics
  llmBlocked: number;
  mockCompletions: number;
  mockEmbeddings: number;
  uniqueBlocksCount: number;
  outcomesWritten: number;
  openaiCalls: number;
  qualityBlocksCount: number;
  rotationBlocksCount: number;
  
  // Posting metrics
  postsQueued: number;
  postsPosted: number;
  postingErrors: number;
  post_skipped_reason_counts: Record<string, number>;
  
  // Growth metrics
  followsPer1kImpressions: number; // F/1k
  nonFollowerER: number;
  
  // System health
  errors: number;
  uptime: string;
}

// In-memory metrics store (would be Redis in production)
const metricsStore = {
  plans: 0,
  replies: 0,
  learnRuns: 0,
  openaiCostUsd: 0,
  banditArmsUpdated: 0,
  predictorStatus: 'none' as 'none' | 'v1' | 'v2',
  exploreRatio: 0.2,
  llmBlocked: 0,
  mockCompletions: 0,
  mockEmbeddings: 0,
  uniqueBlocksCount: 0,
  outcomesWritten: 0,
  openaiCalls: 0,
  qualityBlocksCount: 0,
  rotationBlocksCount: 0,
  postsQueued: 0,
  postsPosted: 0,
  postingErrors: 0,
  followsPer1kImpressions: 0,
  nonFollowerER: 0,
  errors: 0,
  startTime: Date.now()
};

export function metricsHandler(req: Request, res: Response): void {
  try {
    const config = getConfig();
    const jobManager = JobManager.getInstance();
    const jobStats = jobManager.getStats();
    
    // Calculate uptime
    const uptimeMs = Date.now() - metricsStore.startTime;
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    const metrics: SystemMetrics = {
      timeWindow: 'last_60m',
      
      // Job counts from JobManager
      plans: jobStats.planRuns,
      replies: jobStats.replyRuns,
      postings: jobStats.postingRuns || 0,
      outcomesWritten: jobStats.outcomeRuns,
      learnRuns: jobStats.learnRuns,
      
      // AI usage (should be 0 in shadow mode)
      openaiCalls: metricsStore.openaiCalls,
      openaiCostUsd: metricsStore.openaiCostUsd,
      
      // Learning metrics
      banditArmsUpdated: metricsStore.banditArmsUpdated,
      predictorStatus: metricsStore.predictorStatus,
      exploreRatio: metricsStore.exploreRatio,
      
      // LLM metrics
      llmBlocked: metricsStore.llmBlocked,
      mockCompletions: metricsStore.mockCompletions,
      mockEmbeddings: metricsStore.mockEmbeddings,
      uniqueBlocksCount: metricsStore.uniqueBlocksCount,
      qualityBlocksCount: metricsStore.qualityBlocksCount,
      rotationBlocksCount: metricsStore.rotationBlocksCount,
      
      // Posting metrics
      postsQueued: metricsStore.postsQueued,
      postsPosted: metricsStore.postsPosted,
      postingErrors: metricsStore.postingErrors,
      
      // Growth metrics
      followsPer1kImpressions: metricsStore.followsPer1kImpressions,
      nonFollowerER: metricsStore.nonFollowerER,
      
      // System health
      errors: jobStats.errors + metricsStore.errors,
      uptime: `${uptimeHours}h ${uptimeMinutes}m`
    };
    
    res.json({
      success: true,
      metrics,
      mode: config.MODE,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ METRICS_ENDPOINT: Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate metrics',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Increment OpenAI call count (called by budgeted client)
 */
export function incrementOpenAICall(costUsd: number = 0): void {
  metricsStore.openaiCalls++;
  metricsStore.openaiCostUsd += costUsd;
}

/**
 * Update bandit learning stats (called by learn job)
 */
export function updateLearningStats(armsUpdated: number, predictorVersion: 'none' | 'v1' | 'v2'): void {
  metricsStore.banditArmsUpdated += armsUpdated;
  metricsStore.predictorStatus = predictorVersion;
}

/**
 * Increment error count
 */
export function incrementError(): void {
  metricsStore.errors++;
}

/**
 * Update mock LLM metrics
 */
export function updateMockMetrics(mockMetrics: {
  llmBlocked?: number;
  mockCompletions?: number;
  mockEmbeddings?: number;
  uniqueBlocksCount?: number;
  outcomesWritten?: number;
  openaiCalls?: number;
  qualityBlocksCount?: number;
  rotationBlocksCount?: number;
  postsQueued?: number;
  postsPosted?: number;
  postingErrors?: number;
}): void {
  if (mockMetrics.llmBlocked !== undefined) metricsStore.llmBlocked += mockMetrics.llmBlocked;
  if (mockMetrics.mockCompletions !== undefined) metricsStore.mockCompletions += mockMetrics.mockCompletions;
  if (mockMetrics.mockEmbeddings !== undefined) metricsStore.mockEmbeddings += mockMetrics.mockEmbeddings;
  if (mockMetrics.uniqueBlocksCount !== undefined) metricsStore.uniqueBlocksCount += mockMetrics.uniqueBlocksCount;
  if (mockMetrics.outcomesWritten !== undefined) metricsStore.outcomesWritten += mockMetrics.outcomesWritten;
  if (mockMetrics.openaiCalls !== undefined) metricsStore.openaiCalls += mockMetrics.openaiCalls;
  if (mockMetrics.qualityBlocksCount !== undefined) metricsStore.qualityBlocksCount += mockMetrics.qualityBlocksCount;
  if (mockMetrics.rotationBlocksCount !== undefined) metricsStore.rotationBlocksCount += mockMetrics.rotationBlocksCount;
  if (mockMetrics.postsQueued !== undefined) metricsStore.postsQueued += mockMetrics.postsQueued;
  if (mockMetrics.postsPosted !== undefined) metricsStore.postsPosted += mockMetrics.postsPosted;
  if (mockMetrics.postingErrors !== undefined) metricsStore.postingErrors += mockMetrics.postingErrors;
}

/**
 * Get current metrics for internal use
 */
export function getCurrentMetrics(): SystemMetrics {
  const config = getConfig();
  const jobManager = JobManager.getInstance();
  const jobStats = jobManager.getStats();
  
  const uptimeMs = Date.now() - metricsStore.startTime;
  const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
  const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    timeWindow: 'last_60m',
    plans: jobStats.planRuns,
    replies: jobStats.replyRuns,
    postings: 0, // TODO: Add posting job stats
    outcomesWritten: jobStats.outcomeRuns,
    learnRuns: jobStats.learnRuns,
    openaiCalls: metricsStore.openaiCalls,
    openaiCostUsd: metricsStore.openaiCostUsd,
    openaiCalls_total: await getLLMMetrics().calls_total || 0,
    openaiCalls_failed: await getLLMMetrics().calls_failed || 0,
    openaiFailureReasons: await getLLMMetrics().failure_reasons || {},
    banditArmsUpdated: metricsStore.banditArmsUpdated,
    predictorStatus: metricsStore.predictorStatus,
    exploreRatio: metricsStore.exploreRatio,
    llmBlocked: metricsStore.llmBlocked,
    mockCompletions: metricsStore.mockCompletions,
    mockEmbeddings: metricsStore.mockEmbeddings,
    uniqueBlocksCount: metricsStore.uniqueBlocksCount,
    qualityBlocksCount: metricsStore.qualityBlocksCount,
    rotationBlocksCount: metricsStore.rotationBlocksCount,
    postsQueued: await getPostingMetrics().posts_attempted || 0,
    postsPosted: await getPostingMetrics().posts_posted || 0,
    postingErrors: await getPostingMetrics().posts_skipped || 0,
    post_skipped_reason_counts: await getPostingMetrics().skip_reasons || {},
    followsPer1kImpressions: metricsStore.followsPer1kImpressions,
    nonFollowerER: metricsStore.nonFollowerER,
    errors: jobStats.errors + metricsStore.errors,
    uptime: `${uptimeHours}h ${uptimeMinutes}m`
  };
}
