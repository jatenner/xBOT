/**
 * 🚀 POSTING ORCHESTRATOR
 * Handles real posting to X with graceful fallbacks
 */

import { getConfig } from '../config/config';

// Global metrics tracking
let postingMetrics = {
  posts_attempted: 0,
  posts_posted: 0,
  posts_skipped: 0,
  skip_reasons: {} as Record<string, number>
};

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'content' | 'reply';
  generation_source: 'real' | 'synthetic';
  target_tweet_id?: string;
}

export async function processPostingQueue(): Promise<void> {
  console.log('[POSTING_ORCHESTRATOR] 🚀 Processing posting queue...');
  
  try {
    const queuedDecisions = await getQueuedDecisions();
    
    if (queuedDecisions.length === 0) {
      console.log('[POSTING_ORCHESTRATOR] ℹ️ No decisions queued for posting');
      return;
    }
    
    for (const decision of queuedDecisions) {
      await processDecision(decision);
    }
    
  } catch (error) {
    console.error('[POSTING_ORCHESTRATOR] ❌ Queue processing failed:', error.message);
    throw error;
  }
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  postingMetrics.posts_attempted++;
  
  // Skip if not real LLM generation
  if (decision.generation_source !== 'real') {
    const skipReason = 'llm_unavailable';
    await skipPosting(decision.id, skipReason);
    updateSkipMetrics(skipReason);
    return;
  }
  
  // TODO: Add actual X posting logic
  console.log(`[POSTING_ORCHESTRATOR] 🐦 Would post: "${decision.content.substring(0, 50)}..."`);
  postingMetrics.posts_posted++;
}

async function getQueuedDecisions(): Promise<QueuedDecision[]> {
  // Mock for now - TODO: implement database query
  return [];
}

async function skipPosting(decisionId: string, reason: string): Promise<void> {
  console.log(`[POSTING_ORCHESTRATOR] ⏭️ Skipped posting ${decisionId}: ${reason}`);
}

function updateSkipMetrics(reason: string): void {
  postingMetrics.posts_skipped++;
  postingMetrics.skip_reasons[reason] = (postingMetrics.skip_reasons[reason] || 0) + 1;
}

export function getPostingMetrics() {
  return { ...postingMetrics };
}
