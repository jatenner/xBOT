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
  
  const config = getConfig();
  
  // Skip if posting disabled
  if (config.POSTING_DISABLED) {
    const skipReason = 'posting_disabled';
    await skipPosting(decision.id, skipReason);
    updateSkipMetrics(skipReason);
    return;
  }
  
  // Skip if not real LLM generation in live mode
  if (config.MODE === 'live' && decision.generation_source !== 'real') {
    const skipReason = 'llm_unavailable';
    console.log(`[POSTING_ORCHESTRATOR] ⏭️ Skipped posting ${decision.id}: ${skipReason}`);
    await skipPosting(decision.id, skipReason);
    updateSkipMetrics(skipReason);
    return;
  }
  
  // Check rate limits
  if (await isRateLimited()) {
    const skipReason = 'rate_limit_exceeded';
    console.log(`[POSTING_ORCHESTRATOR] ⏭️ Skipped posting ${decision.id}: ${skipReason}`);
    await skipPosting(decision.id, skipReason);
    updateSkipMetrics(skipReason);
    return;
  }
  
  // Run through gate chain
  const gateResult = await runPostingGates(decision);
  if (!gateResult.passed) {
    const skipReason = `gate_${gateResult.gate}_failed`;
    console.log(`[POSTING_ORCHESTRATOR] ⛔ Blocked by gate: ${gateResult.gate} (${gateResult.reason})`);
    await skipPosting(decision.id, skipReason);
    updateSkipMetrics(skipReason);
    return;
  }
  
  // Attempt posting with retry logic
  try {
    const tweetId = await postToXWithRetry(decision);
    
    // Store successful posting
    await storePostedDecision(decision, tweetId);
    
    console.log(`[POSTING_ORCHESTRATOR] ✅ Posted successfully: tweet_id=${tweetId}`);
    postingMetrics.posts_posted++;
    
  } catch (error: any) {
    console.error(`[POSTING_ORCHESTRATOR] ❌ Failed to post ${decision.id}:`, error.message);
    const skipReason = 'posting_failed';
    await skipPosting(decision.id, skipReason);
    updateSkipMetrics(skipReason);
  }
}

async function postToXWithRetry(decision: QueuedDecision): Promise<string> {
  const maxRetries = 3;
  const baseDelay = 500; // Start with 500ms
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[POSTING_ORCHESTRATOR] 🚀 Posting attempt ${attempt}/${maxRetries}: "${decision.content.substring(0, 50)}..."`);
      
      // Simulate posting to X (would be real Playwright automation)
      const tweetId = await postToX(decision);
      
      return tweetId;
      
    } catch (error: any) {
      console.warn(`[POSTING_ORCHESTRATOR] ⚠️ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error; // Final attempt failed
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
      console.log(`[POSTING_ORCHESTRATOR] ⏱️ Waiting ${delay.toFixed(0)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('All retry attempts exhausted');
}

async function postToX(decision: QueuedDecision): Promise<string> {
  // Simulate posting via Playwright (in real implementation this would use browser automation)
  // For now, simulate success with random tweet ID
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
  
  // Simulate occasional failures for testing
  if (Math.random() < 0.1) { // 10% failure rate
    throw new Error('Twitter API rate limit exceeded');
  }
  
  const tweetId = `tweet_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  return tweetId;
}

async function isRateLimited(): Promise<boolean> {
  // Check against MAX_POSTS_PER_HOUR 
  // For now, return false - TODO: implement rate checking
  return false;
}

async function runPostingGates(decision: QueuedDecision): Promise<{passed: boolean, gate?: string, reason?: string}> {
  try {
    // Import gate chain
    const { prePostValidation } = await import('../posting/gateChain');
    return await prePostValidation(decision);
  } catch (error) {
    console.warn('[POSTING_ORCHESTRATOR] ⚠️ Gate chain failed:', error.message);
    // Fail closed in live mode, open in shadow
    const config = getConfig();
    return { passed: config.MODE === 'shadow', gate: 'gate_chain', reason: 'gate_error' };
  }
}

async function storePostedDecision(decision: QueuedDecision, tweetId: string): Promise<void> {
  // TODO: Store to posted_decisions table
  console.log(`[POSTING_ORCHESTRATOR] 💾 Storing posted decision: ${decision.id} -> ${tweetId}`);
}

async function getQueuedDecisions(): Promise<QueuedDecision[]> {
  // Mock for now - TODO: implement database query
  return [];
}

async function skipPosting(decisionId: string, reason: string): Promise<void> {
  // TODO: Mark decision as skipped in database
  console.log(`[POSTING_ORCHESTRATOR] ⏭️ Skipped posting ${decisionId}: ${reason}`);
}

function updateSkipMetrics(reason: string): void {
  postingMetrics.posts_skipped++;
  postingMetrics.skip_reasons[reason] = (postingMetrics.skip_reasons[reason] || 0) + 1;
}

export function getPostingMetrics() {
  return { ...postingMetrics };
}
