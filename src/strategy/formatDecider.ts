/**
 * Format Decision Engine with Mix Policy & Cadence Limits
 * Drives intelligent single vs thread selection based on data
 */

export type Format = 'single' | 'thread';

// Configurable mix targets and limits
const MIX_TARGET = { single: 0.7, thread: 0.3 }; // 70% single, 30% thread
const LIMITS = {
  minGapMinutes: { single: 10, thread: 120 }, // Min gap between same format
  maxThreadsPerDay: 3, // Daily thread limit
  maxConsecutiveSingle: 5 // Prevent too many singles in a row
};

export interface FormatDecisionContext {
  now?: Date;
  recentPosts?: Array<{ 
    format: Format; 
    createdAt: string;
    engagement?: number;
  }>;
  performance?: { 
    singleCTR?: number; 
    threadCTR?: number;
    singleAvgEngagement?: number;
    threadAvgEngagement?: number;
  };
  topic?: string;
  urgency?: 'low' | 'medium' | 'high';
}

/**
 * Main format decision function
 */
export function decidePostFormat(ctx: FormatDecisionContext = {}): Format {
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const recent = ctx.recentPosts ?? [];
  
  // Get last posts by format
  const lastSingle = recent.find(p => p.format === 'single');
  const lastThread = recent.find(p => p.format === 'thread');
  
  // Calculate time gaps
  const minsSince = (d?: string) => d ? (now.getTime() - new Date(d).getTime()) / 60000 : Infinity;
  const minsSinceLastSingle = minsSince(lastSingle?.createdAt);
  const minsSinceLastThread = minsSince(lastThread?.createdAt);
  
  // Check cadence limits
  const canSingle = minsSinceLastSingle >= LIMITS.minGapMinutes.single;
  const canThread = minsSinceLastThread >= LIMITS.minGapMinutes.thread 
    && getThreadsToday(recent, now) < LIMITS.maxThreadsPerDay;
  
  // Check consecutive single limit
  const consecutiveSingles = getConsecutiveSingles(recent);
  const tooManySingles = consecutiveSingles >= LIMITS.maxConsecutiveSingle;
  
  // Calculate current mix ratios
  const N = Math.max(1, Math.min(30, recent.length));
  const ratioThread = recent.filter(p => p.format === 'thread').length / N;
  const ratioSingle = recent.filter(p => p.format === 'single').length / N;
  
  // Performance bias (if we have data)
  let performanceBias: Format | null = null;
  if (ctx.performance?.threadAvgEngagement && ctx.performance?.singleAvgEngagement) {
    performanceBias = ctx.performance.threadAvgEngagement > ctx.performance.singleAvgEngagement * 1.5 
      ? 'thread' : 'single';
  }
  
  // Topic-based hints
  const topicHintsThread = ctx.topic && (
    ctx.topic.includes('story') || 
    ctx.topic.includes('guide') || 
    ctx.topic.includes('breakdown') ||
    ctx.topic.includes('thread') ||
    (ctx.topic.length > 50)
  );
  
  // Decision logic
  let decision: Format;
  let reason: string;
  
  if (tooManySingles && canThread) {
    decision = 'thread';
    reason = `consecutive_singles_limit (${consecutiveSingles}/${LIMITS.maxConsecutiveSingle})`;
  } else if (canThread && ratioThread < MIX_TARGET.thread * 0.8) {
    decision = 'thread';
    reason = `under_threaded (${(ratioThread * 100).toFixed(1)}% vs ${(MIX_TARGET.thread * 100).toFixed(1)}% target)`;
  } else if (topicHintsThread && canThread) {
    decision = 'thread';
    reason = `topic_hints_thread ("${ctx.topic}")`;
  } else if (performanceBias === 'thread' && canThread) {
    decision = 'thread';
    reason = `performance_bias (thread_engagement > single_engagement)`;
  } else if (canSingle) {
    decision = 'single';
    reason = `default_single (reliable, quick)`;
  } else if (canThread) {
    decision = 'thread';
    reason = `fallback_thread (single blocked by cadence)`;
  } else {
    // Emergency fallback - ignore cadence limits
    decision = 'single';
    reason = `emergency_single (all cadence limits hit)`;
  }
  
  // Log the decision with context
  const ratios = {
    thread: Math.round(ratioThread * 100),
    single: Math.round(ratioSingle * 100)
  };
  
  console.log(`FORMAT_DECISION result=${decision} reason="${reason}" ratios=${JSON.stringify(ratios)} gaps_mins={single:${Math.round(minsSinceLastSingle)},thread:${Math.round(minsSinceLastThread)}} consecutive_singles=${consecutiveSingles}`);
  
  return decision;
}

/**
 * Get number of threads posted today (UTC)
 */
function getThreadsToday(recent: Array<{ format: Format; createdAt: string }>, now: Date): number {
  const todayUTC = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return recent.filter(p => 
    p.format === 'thread' && 
    p.createdAt.startsWith(todayUTC)
  ).length;
}

/**
 * Get consecutive singles from most recent posts
 */
function getConsecutiveSingles(recent: Array<{ format: Format; createdAt: string }>): number {
  let count = 0;
  for (const post of recent) {
    if (post.format === 'single') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Check if two dates are on the same UTC date
 */
function isSameUTCDate(a: string, b: Date): boolean {
  const da = new Date(a);
  return da.getUTCFullYear() === b.getUTCFullYear()
    && da.getUTCMonth() === b.getUTCMonth()
    && da.getUTCDate() === b.getUTCDate();
}

/**
 * Get performance statistics for format decision bias
 */
export async function getFormatPerformanceStats(): Promise<{
  singleAvgEngagement: number;
  threadAvgEngagement: number;
  singleCTR: number;
  threadCTR: number;
}> {
  try {
    const { getRecentPosts } = await import('../learning/metricsWriter');
    const recent = await getRecentPosts(50);
    
    const singles = recent.filter(p => p.format === 'single');
    const threads = recent.filter(p => p.format === 'thread');
    
    const avgEngagement = (posts: typeof recent) => 
      posts.length > 0 ? posts.reduce((sum, p) => sum + (p.engagement || 0), 0) / posts.length : 0;
    
    return {
      singleAvgEngagement: avgEngagement(singles),
      threadAvgEngagement: avgEngagement(threads),
      singleCTR: singles.length > 0 ? singles.filter(p => (p.engagement || 0) > 5).length / singles.length : 0,
      threadCTR: threads.length > 0 ? threads.filter(p => (p.engagement || 0) > 10).length / threads.length : 0
    };
  } catch (error) {
    console.warn(`⚠️ Failed to get format performance stats: ${error}`);
    return {
      singleAvgEngagement: 0,
      threadAvgEngagement: 0,
      singleCTR: 0,
      threadCTR: 0
    };
  }
}

/**
 * Update mix targets dynamically based on performance
 */
export function updateMixTargets(performance: {
  singleAvgEngagement: number;
  threadAvgEngagement: number;
}): void {
  // If threads significantly outperform singles, increase thread target
  if (performance.threadAvgEngagement > performance.singleAvgEngagement * 2) {
    Object.assign(MIX_TARGET, { single: 0.6, thread: 0.4 });
    console.log('📊 FORMAT_MIX_UPDATED thread_target increased to 40% due to superior performance');
  } else if (performance.singleAvgEngagement > performance.threadAvgEngagement * 1.5) {
    Object.assign(MIX_TARGET, { single: 0.8, thread: 0.2 });
    console.log('📊 FORMAT_MIX_UPDATED single_target increased to 80% due to superior performance');
  }
}
