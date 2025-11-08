/**
 * 🛡️ QUERY HELPERS - Standardized Database Queries
 * 
 * PURPOSE: Prevent timestamp bugs by enforcing correct column usage
 * 
 * RULES:
 * - Rate limiting queries → ALWAYS use `posted_at` (actual post time)
 * - Analytics queries → ALWAYS use `created_at` (generation time)
 * - Never query timestamps directly, always use these helpers
 * 
 * Created: Nov 8, 2025
 * Author: AI Agent
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ═══════════════════════════════════════════════════════════
// 📊 RATE LIMITING QUERIES (Use posted_at)
// ═══════════════════════════════════════════════════════════

/**
 * Get count of posts in last N hours (for rate limiting)
 * CRITICAL: Uses `posted_at` column (actual post time)
 */
export async function getPostsInLastNHours(hours: number = 1): Promise<number> {
  const now = new Date();
  const nHoursAgo = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .in('status', ['posted', 'failed'])
    .gte('posted_at', nHoursAgo); // ✅ CORRECT: posted_at for rate limiting

  if (error) {
    console.error(`[QUERY_HELPER] ❌ getPostsInLastNHours error:`, error);
    throw new Error(`Failed to query posts in last ${hours} hours: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get count of replies in last N hours (for rate limiting)
 */
export async function getRepliesInLastNHours(hours: number = 1): Promise<number> {
  const now = new Date();
  const nHoursAgo = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('status', ['posted', 'failed'])
    .gte('posted_at', nHoursAgo); // ✅ CORRECT: posted_at for rate limiting

  if (error) {
    console.error(`[QUERY_HELPER] ❌ getRepliesInLastNHours error:`, error);
    throw new Error(`Failed to query replies in last ${hours} hours: ${error.message}`);
  }

  return count || 0;
}

/**
 * Check if we can post now (respects rate limits)
 */
export async function canPostNow(
  maxPostsPerHour: number = 2,
  maxRepliesPerHour: number = 4
): Promise<{ 
  canPost: boolean; 
  canReply: boolean; 
  postsThisHour: number; 
  repliesThisHour: number;
  reason?: string;
}> {
  try {
    const [postsThisHour, repliesThisHour] = await Promise.all([
      getPostsInLastNHours(1),
      getRepliesInLastNHours(1)
    ]);

    return {
      canPost: postsThisHour < maxPostsPerHour,
      canReply: repliesThisHour < maxRepliesPerHour,
      postsThisHour,
      repliesThisHour,
      reason: postsThisHour >= maxPostsPerHour ? 
        `Rate limit: ${postsThisHour}/${maxPostsPerHour} posts this hour` :
        repliesThisHour >= maxRepliesPerHour ?
        `Rate limit: ${repliesThisHour}/${maxRepliesPerHour} replies this hour` :
        undefined
    };
  } catch (error: any) {
    console.error(`[QUERY_HELPER] ❌ canPostNow error:`, error);
    // Fail open: allow posting if query fails
    return {
      canPost: true,
      canReply: true,
      postsThisHour: 0,
      repliesThisHour: 0,
      reason: `Query failed, allowing post: ${error.message}`
    };
  }
}

// ═══════════════════════════════════════════════════════════
// 📈 ANALYTICS QUERIES (Use created_at)
// ═══════════════════════════════════════════════════════════

/**
 * Get posts generated in last N hours (for analytics)
 * Uses `created_at` column (generation time)
 */
export async function getPostsGeneratedInLastNHours(hours: number = 24): Promise<any[]> {
  const now = new Date();
  const nHoursAgo = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('content_metadata')
    .select('*')
    .in('decision_type', ['single', 'thread'])
    .gte('created_at', nHoursAgo) // ✅ CORRECT: created_at for analytics
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[QUERY_HELPER] ❌ getPostsGeneratedInLastNHours error:`, error);
    throw new Error(`Failed to query generated posts: ${error.message}`);
  }

  return data || [];
}

/**
 * Get content generation rate (posts/hour over last N hours)
 */
export async function getContentGenerationRate(hours: number = 24): Promise<number> {
  const posts = await getPostsGeneratedInLastNHours(hours);
  return posts.length / hours;
}

/**
 * Get thread success rate (last N threads)
 */
export async function getThreadSuccessRate(limit: number = 50): Promise<{
  successRate: number;
  successCount: number;
  totalCount: number;
}> {
  const { data, error } = await supabase
    .from('content_metadata')
    .select('status')
    .eq('decision_type', 'thread')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[QUERY_HELPER] ❌ getThreadSuccessRate error:`, error);
    throw new Error(`Failed to query thread success rate: ${error.message}`);
  }

  const threads = data || [];
  const successCount = threads.filter(t => t.status === 'posted').length;
  const totalCount = threads.length;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

  return {
    successRate: parseFloat(successRate.toFixed(1)),
    successCount,
    totalCount
  };
}

// ═══════════════════════════════════════════════════════════
// 🔍 STATUS QUERIES
// ═══════════════════════════════════════════════════════════

/**
 * Get overdue posts (scheduled but not posted)
 */
export async function getOverduePosts(): Promise<any[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('status', 'scheduled')
    .lt('scheduled_at', now);

  if (error) {
    console.error(`[QUERY_HELPER] ❌ getOverduePosts error:`, error);
    throw new Error(`Failed to query overdue posts: ${error.message}`);
  }

  return data || [];
}

/**
 * Get failed posts in last N hours
 */
export async function getFailedPostsInLastNHours(hours: number = 24): Promise<any[]> {
  const now = new Date();
  const nHoursAgo = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('status', 'failed')
    .gte('created_at', nHoursAgo);

  if (error) {
    console.error(`[QUERY_HELPER] ❌ getFailedPostsInLastNHours error:`, error);
    throw new Error(`Failed to query failed posts: ${error.message}`);
  }

  return data || [];
}

// ═══════════════════════════════════════════════════════════
// 📊 COMPREHENSIVE HEALTH CHECK
// ═══════════════════════════════════════════════════════════

/**
 * Get comprehensive posting system health
 */
export async function getPostingSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    postsLastHour: number;
    postsToday: number;
    avgPostsPerHour: number;
    threadSuccessRate: number;
    overdueCount: number;
    failedToday: number;
  };
  checks: {
    rateLimitOk: boolean;
    generationRateOk: boolean;
    threadSuccessOk: boolean;
    noOverdue: boolean;
  };
}> {
  try {
    const [
      postsLastHour,
      postsToday,
      threadStats,
      overduePosts,
      failedToday
    ] = await Promise.all([
      getPostsInLastNHours(1),
      getPostsGeneratedInLastNHours(24),
      getThreadSuccessRate(50),
      getOverduePosts(),
      getFailedPostsInLastNHours(24)
    ]);

    const avgPostsPerHour = postsToday.length / 24;

    const checks = {
      rateLimitOk: postsLastHour <= 2,
      generationRateOk: avgPostsPerHour >= 1.5,
      threadSuccessOk: threadStats.successRate >= 90,
      noOverdue: overduePosts.length === 0
    };

    const status = 
      Object.values(checks).every(v => v) ? 'healthy' :
      (avgPostsPerHour >= 1.0 && threadStats.successRate >= 70) ? 'degraded' :
      'unhealthy';

    return {
      status,
      metrics: {
        postsLastHour,
        postsToday: postsToday.length,
        avgPostsPerHour: parseFloat(avgPostsPerHour.toFixed(1)),
        threadSuccessRate: threadStats.successRate,
        overdueCount: overduePosts.length,
        failedToday: failedToday.length
      },
      checks
    };
  } catch (error: any) {
    console.error(`[QUERY_HELPER] ❌ getPostingSystemHealth error:`, error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// 📝 USAGE EXAMPLES
// ═══════════════════════════════════════════════════════════

/*
// ✅ CORRECT: Rate limiting check
const postsThisHour = await getPostsInLastNHours(1);
if (postsThisHour >= 2) {
  console.log('Rate limit reached, cannot post');
}

// ✅ CORRECT: Analytics check
const generationRate = await getContentGenerationRate(24);
console.log(`Generating ${generationRate.toFixed(1)} posts/hour`);

// ✅ CORRECT: Comprehensive health check
const health = await getPostingSystemHealth();
if (health.status !== 'healthy') {
  console.warn('System degraded:', health.metrics);
}

// ❌ WRONG: Direct timestamp queries (DON'T DO THIS!)
// const { count } = await supabase
//   .from('content_metadata')
//   .select('*', { count: 'exact', head: true })
//   .gte('created_at', oneHourAgo); // ← Which timestamp? Wrong context!
*/

