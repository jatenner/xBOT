/**
 * Post Distribution Policy
 * 
 * Enforces probability weights for single vs thread distribution.
 * Default: 85% single, 15% thread
 * Only allows thread if there's a strong reason signal.
 */

export interface DistributionConfig {
  singleProbability: number; // 0.0 to 1.0
  threadProbability: number; // 0.0 to 1.0
}

export const DEFAULT_DISTRIBUTION: DistributionConfig = {
  singleProbability: 0.85,
  threadProbability: 0.15
};

export interface ContentSignals {
  hasMultiplePoints?: boolean; // Content has 3+ distinct takeaways
  requiresExplanation?: boolean; // Content needs detailed breakdown
  isListBased?: boolean; // Content is a list (steps, tips, etc.)
  sourcePointsCount?: number; // Number of points in source data
}

/**
 * Determine if content should be a thread based on signals
 */
export function shouldBeThread(
  signals: ContentSignals,
  config: DistributionConfig = DEFAULT_DISTRIBUTION
): { decision: 'single' | 'thread'; reason: string; probability: number } {
  // Calculate thread score based on signals
  let threadScore = 0;
  const reasons: string[] = [];
  
  // Strong signals for thread
  if (signals.hasMultiplePoints) {
    threadScore += 0.4;
    reasons.push('multiple points');
  }
  
  if (signals.sourcePointsCount && signals.sourcePointsCount >= 3) {
    threadScore += 0.3;
    reasons.push(`${signals.sourcePointsCount} source points`);
  }
  
  if (signals.requiresExplanation) {
    threadScore += 0.2;
    reasons.push('requires explanation');
  }
  
  if (signals.isListBased) {
    threadScore += 0.2;
    reasons.push('list-based content');
  }
  
  // If thread score is high, strongly prefer thread
  if (threadScore >= 0.5) {
    return {
      decision: 'thread',
      reason: `Strong signals: ${reasons.join(', ')}`,
      probability: Math.min(threadScore, 0.95)
    };
  }
  
  // Otherwise, use distribution weights
  const roll = Math.random();
  
  if (roll < config.threadProbability) {
    // Random thread selection
    return {
      decision: 'thread',
      reason: `Random selection (${(config.threadProbability * 100).toFixed(0)}% probability)`,
      probability: config.threadProbability
    };
  } else {
    // Default to single
    return {
      decision: 'single',
      reason: threadScore > 0 
        ? `Weak signals: ${reasons.join(', ')} (score: ${threadScore.toFixed(2)})` 
        : 'Default single (no thread signals)',
      probability: config.singleProbability
    };
  }
}

/**
 * Extract content signals from topic/content data
 */
export function extractContentSignals(data: {
  topic?: string;
  angle?: string;
  content?: string;
  metadata?: any;
}): ContentSignals {
  const signals: ContentSignals = {};
  
  // Check for list indicators in topic/angle
  const combined = `${data.topic || ''} ${data.angle || ''}`.toLowerCase();
  
  if (combined.match(/\b(\d+)\s+(ways|steps|tips|reasons|benefits|signs|mistakes)\b/)) {
    const match = combined.match(/\b(\d+)\s+(ways|steps|tips|reasons|benefits|signs|mistakes)\b/);
    if (match) {
      const count = parseInt(match[1], 10);
      signals.sourcePointsCount = count;
      signals.isListBased = true;
      signals.hasMultiplePoints = count >= 3;
    }
  }
  
  // Check for explanation indicators
  if (combined.match(/\b(how|why|explained|breakdown|science|works|process)\b/)) {
    signals.requiresExplanation = true;
  }
  
  // Check content length/complexity
  if (data.content && data.content.length > 500) {
    signals.hasMultiplePoints = true;
  }
  
  return signals;
}

/**
 * Log distribution decision
 */
export function logDistributionDecision(
  decision: 'single' | 'thread',
  reason: string,
  probability: number
): void {
  console.log(`[POST_DISTRIBUTION] Selected: ${decision.toUpperCase()}`);
  console.log(`[POST_DISTRIBUTION] Reason: ${reason}`);
  console.log(`[POST_DISTRIBUTION] Probability: ${(probability * 100).toFixed(1)}%`);
}

