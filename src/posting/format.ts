/**
 * Format Decisioner: Single vs Thread Selection with Diversity Guard
 * Intelligent format selection based on topic complexity, engagement data, and diversity rules
 */

export type FormatDecision = { 
  format: 'single' | 'thread'; 
  reason: string; 
  confidence: number 
};

export interface FormatContext {
  topic: string;
  lastPostAt?: Date;
  lastThreadAt?: Date;
  totalPosts: number;
  lastNFormats: ('single' | 'thread')[];
  avg24h: { 
    singleEng: number; 
    threadEng: number 
  };
}

/**
 * Main format decision function
 * Uses topic complexity, engagement data, diversity rules, and cooldowns
 */
export function decidePostFormat(ctx: FormatContext): FormatDecision {
  const { topic, lastThreadAt, totalPosts, lastNFormats, avg24h } = ctx;

  // Topic complexity analysis
  const complexTopic = /guide|how to|deep dive|framework|protocol|stack|science|study|mechanism|deficiency|absorption|protocol|breakdown|analysis|comprehensive|step.by.step|tutorial|explained/i.test(topic);
  
  // Engagement performance comparison (thread needs 15% better performance)
  const threadBeatsSingle = (avg24h.threadEng || 0) >= (avg24h.singleEng || 0) * 1.15;
  
  // Diversity guard: threads ≤ 1/3 of last 9 posts
  const last9 = lastNFormats.slice(-9);
  const threadsInLast9 = last9.filter(f => f === 'thread').length;
  const diversityOk = threadsInLast9 < 3;
  
  // Cooldown: no thread if last thread was < 6 hours ago
  const threadCooldownOk = !lastThreadAt || (Date.now() - lastThreadAt.getTime()) / 3600000 >= 6;
  
  // Decision logic
  if (diversityOk && threadCooldownOk && (complexTopic || threadBeatsSingle)) {
    const reasons = [
      complexTopic ? 'complex topic' : null,
      threadBeatsSingle ? 'thread 24h avg > single' : null,
      diversityOk ? 'diversity ok' : null,
      threadCooldownOk ? 'cooldown ok' : null
    ].filter(Boolean);
    
    const confidence = calculateConfidence({
      complexTopic,
      threadBeatsSingle,
      diversityOk,
      threadCooldownOk,
      engagementRatio: (avg24h.threadEng || 0) / Math.max(avg24h.singleEng || 1, 1)
    });
    
    return { 
      format: 'thread', 
      reason: reasons.join(' + '), 
      confidence 
    };
  }
  
  // Default to single with reasons
  const blockingReasons = [
    !diversityOk ? 'diversity limit' : null,
    !threadCooldownOk ? 'cooldown active' : null,
    !complexTopic && !threadBeatsSingle ? 'simple topic' : null
  ].filter(Boolean);
  
  const reason = blockingReasons.length > 0 
    ? blockingReasons.join(' + ')
    : 'default preference';
    
  return { 
    format: 'single', 
    reason, 
    confidence: 0.6 
  };
}

/**
 * Calculate confidence score based on decision factors
 */
function calculateConfidence(factors: {
  complexTopic: boolean;
  threadBeatsSingle: boolean;
  diversityOk: boolean;
  threadCooldownOk: boolean;
  engagementRatio: number;
}): number {
  let confidence = 0.5; // base confidence
  
  if (factors.complexTopic) confidence += 0.15;
  if (factors.threadBeatsSingle) confidence += Math.min(0.25, factors.engagementRatio * 0.1);
  if (factors.diversityOk) confidence += 0.05;
  if (factors.threadCooldownOk) confidence += 0.05;
  
  return Math.min(0.95, Math.max(0.3, confidence));
}

/**
 * Get engagement statistics for format decision making
 */
export async function getEngagementStats(): Promise<{ singleEng: number; threadEng: number }> {
  try {
    // Import here to avoid circular dependencies
    const { getRecentPosts } = await import('../learning/metricsWriter').catch(() => ({ getRecentPosts: null }));
    
    if (!getRecentPosts) {
      return { singleEng: 0, threadEng: 0 };
    }
    
    const recent = await getRecentPosts(50);
    
    // Calculate 24h average engagement by format
    const now = Date.now();
    const last24h = recent.filter(post => {
      const postTime = new Date(post.createdAt).getTime();
      return now - postTime <= 24 * 60 * 60 * 1000;
    });
    
    const singles = last24h.filter(p => p.format === 'single');
    const threads = last24h.filter(p => p.format === 'thread');
    
    const singleEng = singles.length > 0 
      ? singles.reduce((sum, p) => sum + (p.engagement || 0), 0) / singles.length
      : 0;
      
    const threadEng = threads.length > 0
      ? threads.reduce((sum, p) => sum + (p.engagement || 0), 0) / threads.length
      : 0;
    
    return { singleEng, threadEng };
  } catch (error) {
    console.warn('⚠️ Failed to get engagement stats:', error);
    return { singleEng: 0, threadEng: 0 };
  }
}

/**
 * Get recent format history for diversity analysis
 */
export async function getRecentFormats(limit: number = 15): Promise<('single' | 'thread')[]> {
  try {
    const { getRecentPosts } = await import('../learning/metricsWriter').catch(() => ({ getRecentPosts: null }));
    
    if (!getRecentPosts) {
      return [];
    }
    
    const recent = await getRecentPosts(limit);
    return recent.map(post => post.format);
  } catch (error) {
    console.warn('⚠️ Failed to get recent formats:', error);
    return [];
  }
}

/**
 * Enhanced format decision with automatic data fetching
 */
export async function makeFormatDecision(topic: string): Promise<FormatDecision> {
  try {
    const [avgStats, recentFormats] = await Promise.all([
      getEngagementStats(),
      getRecentFormats(15)
    ]);
    
    // Get timing data from recent formats
    const lastThreadIndex = recentFormats.findIndex(f => f === 'thread');
    const lastThreadAt = lastThreadIndex >= 0 
      ? new Date(Date.now() - (lastThreadIndex * 2 * 60 * 60 * 1000)) // Estimate 2h between posts
      : undefined;
      
    const lastPostAt = recentFormats.length > 0 
      ? new Date(Date.now() - (2 * 60 * 60 * 1000)) // Estimate last post 2h ago
      : undefined;
    
    const decision = decidePostFormat({
      topic,
      lastPostAt,
      lastThreadAt,
      totalPosts: recentFormats.length,
      lastNFormats: recentFormats,
      avg24h: avgStats
    });
    
    // Log the decision
    console.log(`FORMAT_DECISION ${JSON.stringify({
      format: decision.format,
      confidence: decision.confidence,
      reason: decision.reason,
      topic_preview: topic.substring(0, 30),
      diversity_check: `${recentFormats.slice(-9).filter(f => f === 'thread').length}/3 threads in last 9`
    })}`);
    
    return decision;
  } catch (error) {
    console.warn('⚠️ Format decision failed, defaulting to single:', error);
    return {
      format: 'single',
      reason: 'fallback due to error',
      confidence: 0.5
    };
  }
}
