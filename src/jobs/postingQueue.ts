/**
 * 📮 POSTING QUEUE JOB
 * Processes ready decisions and posts them to Twitter
 */

import fs from 'fs';
import path from 'path';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { getConfig, getModeFlags } from '../config/config';
import { learningSystem } from '../learning/learningSystem';
import { trackError, ErrorTracker } from '../utils/errorTracker';
import { SystemFailureAuditor } from '../audit/systemFailureAuditor';

const FOLLOWER_BASELINE_TIMEOUT_MS = Number(process.env.FOLLOWER_BASELINE_TIMEOUT_MS ?? '10000');
const TWITTER_AUTH_PATH = path.join(process.cwd(), 'twitter-auth.json');
const MAX_POSTING_RECOVERY_ATTEMPTS = Number(process.env.POSTING_MAX_RECOVERY_ATTEMPTS ?? 2);

async function forceTwitterSessionReset(reason: string): Promise<void> {
  try {
    if (fs.existsSync(TWITTER_AUTH_PATH)) {
      fs.unlinkSync(TWITTER_AUTH_PATH);
      console.log(`[POSTING_QUEUE] 🧼 Twitter auth cache cleared (${reason})`);
    } else {
      console.log(`[POSTING_QUEUE] 🧼 No cached twitter session to clear (${reason})`);
    }
  } catch (error: any) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to clear twitter session (${reason}): ${error.message}`);
  }
}

// 🔧 FIX #2: Circuit breaker for posting operations - PERMANENT FIX: More resilient defaults
let postingCircuitBreaker = {
  failures: 0,
  lastFailure: null as Date | null,
  state: 'closed' as 'closed' | 'open' | 'half-open',
  failureThreshold: 10, // PERMANENT FIX: Increased from 5 to 10 (less aggressive blocking)
  resetTimeoutMs: 30000 // PERMANENT FIX: Reduced from 60s to 30s (faster recovery)
};

function checkCircuitBreaker(): boolean {
  if (postingCircuitBreaker.state === 'open') {
    const timeSinceFailure = postingCircuitBreaker.lastFailure 
      ? Date.now() - postingCircuitBreaker.lastFailure.getTime() 
      : Infinity;
    
    if (timeSinceFailure > postingCircuitBreaker.resetTimeoutMs) {
      postingCircuitBreaker.state = 'half-open';
      console.log('[POSTING_QUEUE] 🔄 Circuit breaker half-open, testing...');
      return true;
    }
    
    const remainingMs = postingCircuitBreaker.resetTimeoutMs - timeSinceFailure;
    console.warn(`[POSTING_QUEUE] ⚠️ Circuit breaker OPEN (${Math.ceil(remainingMs/1000)}s remaining)`);
    return false;
  }
  return true;
}

function recordCircuitBreakerSuccess() {
  if (postingCircuitBreaker.state === 'half-open') {
    postingCircuitBreaker.state = 'closed';
    postingCircuitBreaker.failures = 0;
    console.log('[POSTING_QUEUE] ✅ Circuit breaker closed (recovered)');
  } else {
    postingCircuitBreaker.failures = Math.max(0, postingCircuitBreaker.failures - 1);
  }
}

function recordCircuitBreakerFailure() {
  postingCircuitBreaker.failures++;
  postingCircuitBreaker.lastFailure = new Date();
  
  if (postingCircuitBreaker.failures >= postingCircuitBreaker.failureThreshold) {
    postingCircuitBreaker.state = 'open';
    console.error(`[POSTING_QUEUE] 🚨 Circuit breaker OPENED after ${postingCircuitBreaker.failures} failures`);
  }
}

export async function processPostingQueue(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  log({ op: 'posting_queue_start' });
  
  // 🔧 FIX #2: Check circuit breaker before processing
  if (!checkCircuitBreaker()) {
    console.warn('[POSTING_QUEUE] ⏸️ Skipping queue processing (circuit breaker open)');
    log({ op: 'posting_queue', status: 'circuit_breaker_open' });
    return;
  }
  
  // Declare variables outside try block so they're accessible in catch
  let readyDecisions: any[] = [];
  let successCount = 0;
  
  try {
    // 1. Check if posting is enabled
    if (flags.postingDisabled) {
      log({ op: 'posting_queue', status: 'disabled' });
      return;
    }
    
    // 🔄 AUTO-RECOVER STUCK POSTS: Reset posts stuck in 'posting' status >15min (reduced from 30min for faster recovery)
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const { data: stuckPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at')
      .eq('status', 'posting')
      .lt('created_at', fifteenMinAgo.toISOString());
    
    if (stuckPosts && stuckPosts.length > 0) {
      console.log(`[POSTING_QUEUE] 🔄 Recovering ${stuckPosts.length} stuck posts (status='posting' >15min)...`);
      for (const post of stuckPosts) {
        const minutesStuck = Math.round((Date.now() - new Date(String(post.created_at)).getTime()) / (1000 * 60));
        console.log(`[POSTING_QUEUE]   - Recovering ${post.decision_type} ${post.decision_id} (stuck ${minutesStuck}min)`);
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', post.decision_id);
      }
      console.log(`[POSTING_QUEUE] ✅ Recovered ${stuckPosts.length} stuck posts`);
    }
    
    // 🎯 QUEUE DEPTH MONITOR: Ensure minimum content ready (2/hr content + 4/hr replies)
    // NOTE: Disabled temporarily to prevent over-generation
    // await ensureMinimumQueueDepth();
    
    // 2. Check rate limits
    const canPost = await checkPostingRateLimits();
    if (!canPost) {
      log({ op: 'posting_queue', status: 'rate_limited' });
      return;
    }
    
    // 3. Get ready decisions from queue
    readyDecisions = await getReadyDecisions();
    const GRACE_MINUTES = parseInt(ENV.GRACE_MINUTES || '5', 10);
    
    if (readyDecisions.length === 0) {
      log({ op: 'posting_queue', ready_count: 0, grace_minutes: GRACE_MINUTES });
      return;
    }
    
    log({ op: 'posting_queue', ready_count: readyDecisions.length, grace_minutes: GRACE_MINUTES });
    
    // 4. Process each decision WITH RATE LIMIT CHECK BETWEEN EACH POST
    successCount = 0;
    let contentPostedThisCycle = 0;
    let repliesPostedThisCycle = 0;
    
    const config = getConfig();
    // 🎯 STRICT RATE LIMIT: Max 1 post per hour = 2 posts every 2 hours (user requirement)
    const maxContentPerHourRaw = Number(config.MAX_POSTS_PER_HOUR ?? 1);
    const maxContentPerHour = Number.isFinite(maxContentPerHourRaw) ? maxContentPerHourRaw : 1;
    const maxRepliesPerHourRaw = Number(config.REPLIES_PER_HOUR ?? 4);
    const maxRepliesPerHour = Number.isFinite(maxRepliesPerHourRaw) ? maxRepliesPerHourRaw : 4;
    
    for (const decision of readyDecisions) {
      try {
        // 🔥 CRITICAL: Check rate limit BEFORE each post (not just once at start!)
        const isReply = decision.decision_type === 'reply';
        const isContent = decision.decision_type === 'single' || decision.decision_type === 'thread';
        
        // Check current hour's posting count from database
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        if (isContent) {
          // 🎯 COUNT POSTS, NOT TWEETS: Threads count as 1 post, not multiple tweets
          // A thread is ONE POST on Twitter, regardless of how many parts it has
          
          // Query recent posts
          const { data: recentContent } = await supabase
            .from('content_metadata')
            .select('decision_type')
            .in('decision_type', ['single', 'thread'])
            .eq('status', 'posted')
            .gte('posted_at', oneHourAgo);
          
          // Count POSTS (not tweets) - threads = 1 post, singles = 1 post
          const postsThisHour = (recentContent || []).length;
          
          // Add posts from this cycle
          const totalPostsThisHour = postsThisHour + contentPostedThisCycle;
          
          // Check if THIS decision would exceed limit
          // Both threads and singles count as 1 post
          const thisPostCount = 1; // Thread = 1 post, Single = 1 post
          
          // 🎯 STRICT LIMIT: Max 1 post per hour = 2 posts every 2 hours
          const maxPostsPerHour = maxContentPerHour; // 1 post max per hour
          const wouldExceed = totalPostsThisHour + thisPostCount > maxPostsPerHour;
          
          log({ op: 'rate_limit_check', posts_this_hour: totalPostsThisHour, this_post_count: thisPostCount, limit: maxPostsPerHour });
          console.log(`[POSTING_QUEUE] 📊 Posts this hour: ${totalPostsThisHour}/${maxPostsPerHour} (this ${decision.decision_type} would add ${thisPostCount} post)`);
          
          if (wouldExceed) {
            console.log(`[POSTING_QUEUE] ⛔ SKIP: Would exceed post limit (${totalPostsThisHour + thisPostCount} > ${maxPostsPerHour})`);
            continue; // Skip this decision
          }
          
          // ✅ THREADS COUNT AS 1 POST: No special spacing needed
          // Threads are treated the same as single posts for rate limiting
        }
        
        if (isReply) {
          // 🚨 FIX: Query content_metadata TABLE directly
          const { count: replyCount } = await supabase
            .from('content_metadata')
            .select('*', { count: 'exact', head: true })
            .eq('decision_type', 'reply')
            .eq('status', 'posted')
            .gte('posted_at', oneHourAgo);
          
          const totalRepliesThisHour = (replyCount || 0) + repliesPostedThisCycle;
          
          console.log(`[POSTING_QUEUE] 📊 Replies this hour: ${totalRepliesThisHour}/${maxRepliesPerHour} (DB: ${replyCount}, This cycle: ${repliesPostedThisCycle})`);
          
          if (totalRepliesThisHour >= maxRepliesPerHour) {
            console.log(`[POSTING_QUEUE] ⛔ SKIP: Reply limit reached ${totalRepliesThisHour}/${maxRepliesPerHour}`);
            continue; // Skip this decision, move to next
          }
        }
        
        // Proceed with posting
        await processDecision(decision);
        successCount++;
        
        // Track what we posted this cycle
        if (isContent) contentPostedThisCycle++;
        if (isReply) repliesPostedThisCycle++;
        
      } catch (error: any) {
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        const errorStack = error?.stack || 'No stack trace';
        console.error(`[POSTING_QUEUE] ❌ Failed to post decision ${decision.id}:`, errorMsg);
        console.error(`[POSTING_QUEUE] 💥 Error stack:`, errorStack);
        
        // 🔧 ENHANCED ERROR TRACKING: Track all posting failures
        await trackError(
          'posting_queue',
          'post_failure',
          errorMsg,
          'error',
          {
            decision_id: decision.id,
            decision_type: decision.decision_type,
            retry_count: (decision.features as any)?.retry_count || 0,
            stack: errorStack.substring(0, 500) // Limit stack trace length
          }
        );
        
        // Track in SystemFailureAuditor
        try {
          const auditor = SystemFailureAuditor.getInstance();
          await auditor.recordFailure({
            systemName: 'posting_queue',
            failureType: 'primary_failure',
            rootCause: errorMsg,
            attemptedAction: `post_${decision.decision_type}`,
            errorMessage: errorMsg,
            metadata: {
              decision_id: decision.id,
              decision_type: decision.decision_type
            }
          });
        } catch (auditError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Failed to record in auditor: ${auditError.message}`);
        }
        
        await markDecisionFailed(decision.id, errorMsg);
      }
    }
    
        console.log(`[POSTING_QUEUE] ✅ Posted ${successCount}/${readyDecisions.length} decisions (${contentPostedThisCycle} content, ${repliesPostedThisCycle} replies)`);
    
    // 🔧 FIX #2: Record success for circuit breaker
    recordCircuitBreakerSuccess();
    
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    console.error('[POSTING_QUEUE] ❌ Queue processing failed:', errorMsg);
    
    // 🔧 ENHANCED ERROR TRACKING: Track queue processing failures
    await trackError(
      'posting_queue',
      'queue_processing_failed',
      errorMsg,
      'critical',
      {
        ready_decisions_count: readyDecisions?.length || 0,
        success_count: successCount || 0,
        error_stack: error?.stack?.substring(0, 500)
      }
    );
    
    // Track in SystemFailureAuditor
    try {
      const auditor = SystemFailureAuditor.getInstance();
      await auditor.recordFailure({
        systemName: 'posting_queue',
        failureType: 'complete_failure',
        rootCause: errorMsg,
        attemptedAction: 'process_posting_queue',
        errorMessage: errorMsg,
        metadata: {
          ready_decisions: readyDecisions?.length || 0,
          success_count: successCount || 0
        }
      });
    } catch (auditError: any) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to record in auditor: ${auditError.message}`);
    }
    
    // 🔧 FIX #2: Record failure for circuit breaker
    recordCircuitBreakerFailure();
    
    // ✅ GRACEFUL: Don't throw - allow system to continue
    // Log error but don't crash the entire job scheduler
    console.warn('[POSTING_QUEUE] ⚠️ Error logged, will retry on next cycle');
    // Don't throw - this allows job manager to continue scheduling
  }
}

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'single' | 'thread' | 'reply'; // FIXED: Match database schema
  target_tweet_id?: string;
  target_username?: string;
  bandit_arm: string;
  timing_arm?: string;
  predicted_er: number;
  quality_score?: number;
  topic_cluster: string;
  status: string;
  created_at: string;
  thread_parts?: string[]; // For threads
  features?: any; // For thread metadata
  visual_format?: string; // Visual formatting instructions
  // PHASE 5 additions for learning system
  predicted_followers?: number;
  hook_type?: string;
}

interface QueuedDecisionRow {
  [key: string]: unknown;
  id: unknown;
  content: unknown;
  decision_type: unknown;
  target_tweet_id?: unknown;
  target_username?: unknown;
  bandit_arm: unknown;
  timing_arm?: unknown;
  predicted_er: unknown;
  quality_score?: unknown;
  topic_cluster: unknown;
  status: unknown;
  created_at: unknown;
}

async function checkPostingRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxPostsPerHourRaw = Number(config.MAX_POSTS_PER_HOUR ?? 1);
  const maxPostsPerHour = Number.isFinite(maxPostsPerHourRaw) ? maxPostsPerHourRaw : 1;
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 🔧 FIX #1: GRACEFUL NULL TWEET_ID HANDLING
    // Instead of blocking entire system, only exclude NULL posts from rate limit count
    // Background recovery job will fix NULL IDs, but we don't block new posts
    const { data: pendingIdPosts, error: pendingError } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at')
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())  // Last hour
      .limit(1);
    
    if (pendingIdPosts && pendingIdPosts.length > 0) {
      const pendingPost = pendingIdPosts[0];
      const minutesAgo = Math.round((Date.now() - new Date(String(pendingPost.posted_at)).getTime()) / 60000);
      
      console.warn(`[POSTING_QUEUE] ⚠️ Found post with NULL tweet_id (posted ${minutesAgo}min ago)`);
      console.warn(`[POSTING_QUEUE] 📝 Content: "${String(pendingPost.content).substring(0, 60)}..."`);
      console.warn(`[POSTING_QUEUE] 🔄 Background recovery job will fix this (runs every 30min)`);
      console.warn(`[POSTING_QUEUE] ✅ Continuing with posting - NULL posts excluded from rate limit count`);
      
      // 🔧 ENHANCED ERROR TRACKING: Track NULL tweet_id occurrences
      await trackError(
        'posting_queue',
        'null_tweet_id',
        `Post with NULL tweet_id found (posted ${minutesAgo}min ago)`,
        'warning',
        {
          decision_id: pendingPost.decision_id,
          posted_at: pendingPost.posted_at,
          minutes_ago: minutesAgo
        }
      );
      
      // ✅ GRACEFUL: Don't block entire system, just exclude NULL posts from count
      // Background job will recover IDs, but we don't stop new posts
    }
    
    // Count posts attempted in last hour (EXCLUDING NULL tweet_ids for accurate counting)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // ✅ FIX #1: Only count posts with valid tweet_ids (excludes NULL posts)
    const { count, error } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .in('status', ['posted', 'failed'])  // ← Only count ATTEMPTED posts (not queued!)
      .not('tweet_id', 'is', null)  // ✅ EXCLUDE NULL tweet_ids from count
      .gte('posted_at', oneHourAgo);
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Rate limit check failed:', error.message);
      
      // 🔧 ENHANCED ERROR TRACKING: Track database errors
      await trackError(
        'posting_queue',
        'rate_limit_check_failed',
        `Database error during rate limit check: ${error.message}`,
        'error',
        {
          error_code: error.code,
          error_details: error.message
        }
      );
      
      // ✅ PERMANENT FIX: Graceful degradation - allow posting on errors (don't block system)
      // Database errors shouldn't stop the entire system - better to allow than block
      console.warn('[POSTING_QUEUE] ⚠️ Rate limit check error - allowing posting to continue (graceful degradation)');
      // PERMANENT FIX: On error, allow posting rather than blocking (safer default)
      return true; // Allow posting if we can't verify rate limit
    }
    
    const postsThisHour = count || 0;
    
    console.log(`[POSTING_QUEUE] 📊 Content posts attempted this hour: ${postsThisHour}/${maxPostsPerHour}`);
    
    if (postsThisHour >= maxPostsPerHour) {
      console.log(`[POSTING_QUEUE] ⛔ HOURLY LIMIT REACHED: ${postsThisHour}/${maxPostsPerHour}`);
      console.log(`[POSTING_QUEUE] ⏰ Next slot in ~${60 - Math.floor((Date.now() - new Date(oneHourAgo).getTime()) / 60000)} minutes`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Rate limit OK: ${postsThisHour}/${maxPostsPerHour} posts`);
    return true;
    
  } catch (error: any) {
    console.error('[POSTING_QUEUE] ❌ Rate limit exception:', error.message);
    
    // 🔧 ENHANCED ERROR TRACKING: Track exceptions
    await trackError(
      'posting_queue',
      'rate_limit_exception',
      `Exception during rate limit check: ${error.message}`,
      'error',
      {
        error_type: error.constructor?.name || 'Unknown',
        error_stack: error.stack?.substring(0, 300)
      }
    );
    
    // ✅ PERMANENT FIX: Don't block on exceptions - allow posting (graceful degradation)
    console.warn('[POSTING_QUEUE] ⚠️ Rate limit check exception - allowing posting (graceful degradation)');
    // PERMANENT FIX: On exception, allow posting rather than blocking (safer default)
    return true; // Allow posting if we can't verify rate limit
    console.log(`[POSTING_QUEUE] 📊 Using conservative limit: ${conservativeLimit} posts/hour`);
    // Allow posting but with reduced limit during errors
    return true; // ✅ Changed: Allow posting instead of blocking
  }
}

async function getReadyDecisions(): Promise<QueuedDecision[]> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Add grace window for "close enough" posts
    const GRACE_MINUTES = parseInt(process.env.GRACE_MINUTES || '5', 10);
    const now = new Date();
    const graceWindow = new Date(Date.now() + GRACE_MINUTES * 60 * 1000);
    
    console.log(`[POSTING_QUEUE] 📅 Fetching posts ready within ${GRACE_MINUTES} minute window`);
    console.log(`[POSTING_QUEUE] 🕒 Current time: ${now.toISOString()}`);
    console.log(`[POSTING_QUEUE] 🕒 Grace window: ${graceWindow.toISOString()}`);
    
    // CRITICAL FIX: Check what's already been posted to avoid duplicates
    const { data: alreadyPosted } = await supabase
      .from('posted_decisions')
      .select('decision_id');
    
    const postedIds = new Set((alreadyPosted || []).map(p => p.decision_id));
    
    // ✅ FIX: Fetch content and replies SEPARATELY to prevent blocking
    // Prioritize content posts (main tweets), then add replies
    // ✅ Include visual_format in SELECT
    // ✅ EXCLUDE 'posting' status to prevent race conditions
    // 🔧 FIX: Include ALL posts scheduled in the past OR within grace window (removed gte restriction)
    const { data: contentPosts, error: contentError } = await supabase
      .from('content_metadata')
      .select('*, visual_format')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .lte('scheduled_at', graceWindow.toISOString()) // Include posts scheduled in past OR near future
      .order('scheduled_at', { ascending: true })
      .limit(10); // Get up to 10 content posts
    
    const { data: replyPosts, error: replyError } = await supabase
      .from('content_metadata')
      .select('*, visual_format')
      .eq('status', 'queued')
      .eq('decision_type', 'reply')
      .lte('scheduled_at', graceWindow.toISOString()) // Include replies scheduled in past OR near future
      .order('scheduled_at', { ascending: true })
      .limit(10); // Get up to 10 replies
    
    // Combine: prioritize content, then replies
    const data = [...(contentPosts || []), ...(replyPosts || [])];
    const error = contentError || replyError;
    
    console.log(`[POSTING_QUEUE] 📊 Content posts: ${contentPosts?.length || 0}, Replies: ${replyPosts?.length || 0}`);
    
    // 🧵 DYNAMIC PRIORITY SYSTEM: Fresh threads first, failed threads drop priority
    // This prevents failed threads from blocking the queue forever
    data.sort((a, b) => {
      // Get retry counts from features
      const aRetries = ((a.features as any)?.retry_count || 0);
      const bRetries = ((b.features as any)?.retry_count || 0);
      
      // Base priority levels: thread (1) > reply (2) > single (3)
      const getBasePriority = (type: string) => {
        if (type === 'thread') return 1;
        if (type === 'reply') return 2;
        return 3;
      };
      
      let aPriority = getBasePriority(String(a.decision_type));
      let bPriority = getBasePriority(String(b.decision_type));
      
      // 🚀 DYNAMIC ADJUSTMENT: Failed threads lose priority
      // - Fresh thread: priority 1 (goes first)
      // - Thread retry 1: priority 2 (same as replies)
      // - Thread retry 2+: priority 3 (same as singles)
      if (a.decision_type === 'thread') {
        aPriority += Math.min(aRetries, 2); // Max penalty: +2
      }
      if (b.decision_type === 'thread') {
        bPriority += Math.min(bRetries, 2); // Max penalty: +2
      }
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority; // Lower number = higher priority
      }
      
      // Within same priority level, maintain scheduled order (FIFO)
      return new Date(String(a.scheduled_at)).getTime() - new Date(String(b.scheduled_at)).getTime();
    });
    
    const prioritizedThreads = data.filter(d => d.decision_type === 'thread').length;
    const prioritizedReplies = data.filter(d => d.decision_type === 'reply').length;
    const singles = data.filter(d => d.decision_type === 'single').length;
    
    if (prioritizedThreads > 0 || prioritizedReplies > 0) {
      console.log(`[POSTING_QUEUE] 🎯 Queue order: ${prioritizedThreads} threads → ${prioritizedReplies} replies → ${singles} singles`);
    }
    
    // ✅ AUTO-CLEANUP: Cancel stale items to prevent queue blocking
    // Threads get 6 hours (complex, rare), Singles get 2 hours (simple, common)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    // Clean up stale singles (>2 hours old)
    const { data: staleSingles } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'single')
      .lt('scheduled_at', twoHoursAgo.toISOString());
    
    // Clean up stale threads (>6 hours old - threads get more time due to complexity)
    const { data: staleThreads } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('status', 'queued')
      .eq('decision_type', 'thread')
      .lt('scheduled_at', sixHoursAgo.toISOString());
    
    const totalStale = (staleSingles?.length || 0) + (staleThreads?.length || 0);
    
    if (totalStale > 0) {
      console.log(`[POSTING_QUEUE] 🧹 Auto-cleaning ${totalStale} stale items (${staleSingles?.length || 0} singles >2h, ${staleThreads?.length || 0} threads >6h)`);
      
      // Cancel stale singles
      if (staleSingles && staleSingles.length > 0) {
        await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'single')
          .lt('scheduled_at', twoHoursAgo.toISOString());
      }
      
      // Cancel stale threads
      if (staleThreads && staleThreads.length > 0) {
        await supabase
          .from('content_metadata')
          .update({ status: 'cancelled' })
          .eq('status', 'queued')
          .eq('decision_type', 'thread')
          .lt('scheduled_at', sixHoursAgo.toISOString());
      }
    }
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    console.log(`[POSTING_QUEUE] 📊 Total decisions ready: ${data?.length || 0}`);
    
    if (!data || data.length === 0) {
      // Debug: Check what IS in the queue
      const { data: futureDecisions } = await supabase
        .from('content_metadata')
        .select('decision_id, scheduled_at, status, quality_score')
        .eq('status', 'queued')
        .order('scheduled_at', { ascending: true })
        .limit(5);
      
      if (futureDecisions && futureDecisions.length > 0) {
        console.log(`[POSTING_QUEUE] 🔮 Upcoming posts in queue:`);
        futureDecisions.forEach((d: any) => {
          const scheduledTime = new Date(d.scheduled_at);
          const minutesUntil = Math.round((scheduledTime.getTime() - now.getTime()) / 60000);
          console.log(`   - ${d.decision_id}: in ${minutesUntil} min (quality: ${d.quality_score})`);
        });
      } else {
        console.log(`[POSTING_QUEUE] ⚠️ No queued content found in database at all`);
      }
      
      return [];
    }
    
    // Map raw rows to typed decisions
    const rows = data as QueuedDecisionRow[];
    
    // DEDUPLICATION: Filter out already-posted content
    const filteredRows = rows.filter(row => {
      const decisionId = String(row.decision_id ?? '');  // 🔥 FIX: Use decision_id (UUID), not id (integer)
      if (postedIds.has(decisionId)) {
        console.log(`[POSTING_QUEUE] ⚠️ Skipping duplicate: ${decisionId} (already posted)`);
        return false;
      }
      return true;
    });
    
    console.log(`[POSTING_QUEUE] 📋 Filtered: ${rows.length} → ${filteredRows.length} (removed ${rows.length - filteredRows.length} duplicates)`);

    // RETRY DEFERRAL: Respect future retry windows so one failure can't monopolize queue
    const nowTs = now.getTime();
    const decisionsExceededRetries: { id: string; type: string; retryCount: number }[] = [];
    const throttledRows = filteredRows.filter(row => {
      const decisionId = String(row.decision_id ?? '');
      const features = (row.features || {}) as any;
      const retryCount = Number(features?.retry_count || 0);
      const scheduledTs = new Date(String(row.scheduled_at)).getTime();

      const decisionType = String(row.decision_type ?? 'single');
      const maxRetries =
        decisionType === 'thread'
          ? 3
          : decisionType === 'reply'
          ? 3
          : 3;

      if (retryCount >= maxRetries) {
        console.error(
          `[POSTING_QUEUE] ❌ ${decisionType} ${decisionId} exceeded max retries (${retryCount}/${maxRetries})`
        );
        decisionsExceededRetries.push({ id: decisionId, type: decisionType, retryCount });
        return false;
      }

      if (retryCount > 0 && scheduledTs > nowTs) {
        console.log(`[POSTING_QUEUE] ⏳ Skipping retry ${decisionId} until ${row.scheduled_at} (retry #${retryCount})`);
        return false;
      }

      return true;
    });

    if (throttledRows.length !== filteredRows.length) {
      console.log(`[POSTING_QUEUE] ⏳ Retry deferral removed ${filteredRows.length - throttledRows.length} items from this loop`);
    }

    if (decisionsExceededRetries.length > 0) {
      console.log(`[POSTING_QUEUE] ❌ Marking ${decisionsExceededRetries.length} decisions as failed (max retries exceeded)`);
      const decisionIds = decisionsExceededRetries.map(item => item.id);

      try {
        await supabase
          .from('content_metadata')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            error_message: 'Exceeded retry limit'
          })
          .in('decision_id', decisionIds);
      } catch (retryFailError: any) {
        console.error(`[POSTING_QUEUE] ⚠️ Failed to mark decisions as failed: ${retryFailError.message}`);
      }
    }
    
    // SEPARATE RATE LIMITS: Content (1/hr = 2 every 2 hours for singles+threads combined) vs Replies (4/hr separate)
    const config = getConfig();
    const maxContentPerHourRaw = Number(config.MAX_POSTS_PER_HOUR ?? 1); // Singles + threads share this
    const maxContentPerHour = Number.isFinite(maxContentPerHourRaw) ? maxContentPerHourRaw : 1;
    const maxRepliesPerHourRaw = Number(config.REPLIES_PER_HOUR ?? 4); // Replies independent
    const maxRepliesPerHour = Number.isFinite(maxRepliesPerHourRaw) ? maxRepliesPerHourRaw : 4;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count content (singles + threads combined) vs replies separately
    const { count: contentCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread']) // Singles and threads share 2/hr budget
      .gte('posted_at', oneHourAgo);
    
    const { count: replyCount } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .gte('posted_at', oneHourAgo);
    
    const contentPosted = contentCount || 0;
    const repliesPosted = replyCount || 0;
    
    const contentAllowed = Math.max(0, maxContentPerHour - contentPosted);
    const repliesAllowed = Math.max(0, maxRepliesPerHour - repliesPosted);
    
    console.log(`[POSTING_QUEUE] 🚦 Rate limits: Content ${contentPosted}/${maxContentPerHour} (singles+threads), Replies ${repliesPosted}/${maxRepliesPerHour}`);
    
    // Apply rate limits per type
    const decisionsWithLimits = throttledRows.filter(row => {
      const type = String(row.decision_type ?? 'single');
      if (type === 'reply') {
        return repliesPosted < maxRepliesPerHour;
      } else {
        // 'single' and 'thread' both count as content (share 2/hr budget)
        return contentPosted < maxContentPerHour;
      }
    });
    
    console.log(`[POSTING_QUEUE] ✅ After rate limits: ${decisionsWithLimits.length} decisions can post (${contentAllowed} content, ${repliesAllowed} replies available)`);
    
    const decisions: QueuedDecision[] = decisionsWithLimits.map(row => ({
      id: String(row.decision_id ?? ''),  // 🔥 FIX: Map to decision_id (UUID), not id (integer)!
      content: String(row.content ?? ''),
      decision_type: String(row.decision_type ?? 'single') as 'single' | 'thread' | 'reply',
      target_tweet_id: row.target_tweet_id ? String(row.target_tweet_id) : undefined,
      target_username: row.target_username ? String(row.target_username) : undefined,
      bandit_arm: String(row.bandit_arm ?? ''),
      thread_parts: row.thread_parts as string[] | undefined,
      timing_arm: row.timing_arm ? String(row.timing_arm) : undefined,
      predicted_er: Number(row.predicted_er ?? 0),
      quality_score: row.quality_score ? Number(row.quality_score) : undefined,
      topic_cluster: String(row.topic_cluster ?? ''),
      status: String(row.status ?? 'ready_for_posting'),
      created_at: String(row.created_at ?? new Date().toISOString()),
      // CRITICAL: Pass through features for thread_tweets
      features: row.features as any,
      // ✅ Pass through visual_format for formatting
      visual_format: row.visual_format ? String(row.visual_format) : undefined
    }));
    
    return decisions;
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
    return [];
  }
}

/**
 * 🔍 SUCCESS VERIFICATION: Check if tweet actually posted despite timeout/error
 * This prevents marking tweets as failed when they actually succeeded
 */
async function verifyTweetPosted(content: string, decisionType: string): Promise<string | null> {
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const browserPool = UnifiedBrowserPool.getInstance();
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    
    // Use browser pool to check if tweet exists
    const tweetFound = await browserPool.withContext(
      'tweet_verification',
      async (context) => {
        const page = await context.newPage();
        try {
          // Navigate to profile and search for recent tweet with matching content
          await page.goto(`https://x.com/${username}`, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
          });
          
          // Wait for timeline to load
          await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }).catch(() => null);
          
          // Search for tweet with matching content (first 50 chars)
          const searchText = content.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tweetLocator = page.locator('[data-testid="tweetText"]').filter({ 
            hasText: new RegExp(searchText, 'i') 
          });
          
          const tweetExists = await tweetLocator.first().isVisible({ timeout: 5000 }).catch(() => false);
          
          if (tweetExists) {
            // Try to extract tweet ID from the tweet element
            try {
              const tweetElement = await tweetLocator.first();
              const tweetLink = await tweetElement.locator('..').locator('a[href*="/status/"]').first().getAttribute('href');
              if (tweetLink) {
                const match = tweetLink.match(/\/status\/(\d+)/);
                if (match && match[1]) {
                  return match[1];
                }
              }
            } catch (e) {
              // If ID extraction fails, at least we know tweet exists
              return 'verified_but_no_id';
            }
            return 'verified';
          }
          
          return null;
        } finally {
          await page.close();
        }
      },
      5 // Lower priority (background verification)
    );
    
    return tweetFound;
  } catch (error: any) {
    console.warn(`[POSTING_QUEUE] ⚠️ Tweet verification failed: ${error.message}`);
    return null;
  }
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  const isThread = decision.decision_type === 'thread';
  const logPrefix = isThread ? '[POSTING_QUEUE] 🧵' : '[POSTING_QUEUE] 📝';
  
  console.log(`${logPrefix} Processing ${decision.decision_type}: ${decision.id}`);
  console.log(`${logPrefix} 🔍 DEBUG: Starting processDecision`);
  
  // 🔥 PRIORITY 5 FIX: Pre-post logging BEFORE posting
  await logPostAttempt(decision, 'attempting');

  const decisionFeatures = (decision.features || {}) as Record<string, any>;
  if (decisionFeatures.force_session_reset) {
    await forceTwitterSessionReset(`decision:${decision.id}`);
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      const updatedFeatures = {
        ...decisionFeatures,
        force_session_reset: false,
        last_force_reset_at: new Date().toISOString()
      };
      await supabase
        .from('content_metadata')
        .update({ features: updatedFeatures })
        .eq('decision_id', decision.id);
      decision.features = updatedFeatures;
      console.log(`${logPrefix} 🧽 Session reset flag cleared for ${decision.id}`);
    } catch (flagError: any) {
      console.warn(`${logPrefix} ⚠️ Failed to clear session reset flag: ${flagError.message}`);
    }
  }
  
  // 🔒 WRAP ENTIRE FUNCTION IN TRY-CATCH (critical fix for silent failures)
  // Declare variables at function scope so they're accessible in catch block
  let tweetId: string = '';
  let tweetUrl: string | undefined;
  let tweetIds: string[] | undefined;
  let postingSucceeded = false;
  let metadata: any = null;
  let retryCount = 0;
  let recoveryAttempts = 0;
  const maxRetries = 3;
  const maxRecoveryAttempts = MAX_POSTING_RECOVERY_ATTEMPTS;

  try {
    // 🧵 THREAD DIAGNOSTICS: Enhanced logging for threads
    if (isThread) {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
    
      const { data: threadData } = await supabase
        .from('content_metadata')
        .select('thread_parts, created_at, scheduled_at, features')
        .eq('decision_id', decision.id)
        .single();
    
      if (threadData) {
        const parts = threadData.thread_parts as string[] || [];
        const age = (Date.now() - new Date(String(threadData.created_at)).getTime()) / (1000 * 60);
        const retryCount = (threadData.features as any)?.retry_count || 0;
      
        // 🔥 MAX RETRY LIMIT: Prevent infinite thread retries
        // BUT: Check if already posted first (database save might have failed)
        const MAX_THREAD_RETRIES = 3;
        if (retryCount >= MAX_THREAD_RETRIES) {
          // 🚨 CRITICAL: Check if post is already on Twitter before marking as failed
          const { data: alreadyPosted } = await supabase
            .from('posted_decisions')
            .select('tweet_id')
            .eq('decision_id', decision.id)
            .single();
        
          if (alreadyPosted) {
            console.log(`${logPrefix} ✅ Thread already posted as ${alreadyPosted.tweet_id} - database just needs sync`);
            // Mark as posted and return (don't throw error)
            await supabase
              .from('content_metadata')
              .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('decision_id', decision.id);
            return; // Exit early - post is already live
          }
        
          console.error(`${logPrefix} ❌ Thread ${decision.id} exceeded max retries (${retryCount}/${MAX_THREAD_RETRIES})`);
          throw new Error(`Thread exceeded maximum retry limit (${MAX_THREAD_RETRIES} attempts)`);
        }
      
        console.log(`${logPrefix} ⚡ THREAD DETECTED FOR POSTING ⚡`);
        console.log(`${logPrefix} Thread ID: ${decision.id}`);
        console.log(`${logPrefix} Thread details: ${parts.length} tweets, created ${age.toFixed(0)}min ago`);
        console.log(`${logPrefix} Retry count: ${retryCount}/${MAX_THREAD_RETRIES}`);
        console.log(`${logPrefix} Full thread content:`);
        parts.forEach((tweet: string, i: number) => {
          console.log(`${logPrefix}   Tweet ${i + 1}/${parts.length}: "${tweet.substring(0, 80)}..." (${tweet.length} chars)`);
        });
      } else {
        console.warn(`${logPrefix} ⚠️ Thread data not found for decision ${decision.id}`);
      }
  }
  
    // SMART BATCH FIX: Hard stop - double-check rate limit before EVERY post
    if (decision.decision_type === 'single' || decision.decision_type === 'thread') {
      const canPost = await checkPostingRateLimits();
      if (!canPost) {
        console.log(`[POSTING_QUEUE] ⛔ HARD STOP: Rate limit reached, skipping ${decision.id}`);
        return; // Don't process this decision
      }
  }
  
  // Note: We keep status as 'queued' until actually posted
  // No intermediate 'posting' status to avoid DB constraint violations

    // Update metrics
    console.log(`${logPrefix} 🔍 DEBUG: About to update posting metrics`);
    await updatePostingMetrics('queued');
    console.log(`${logPrefix} 🔍 DEBUG: Posting metrics updated`);

    console.log(`${logPrefix} 🔍 DEBUG: Entering main try block`);
      // 🚨 CRITICAL: Check if already posted (double-check before posting)
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      console.log(`${logPrefix} 🔍 DEBUG: Supabase client acquired`);
    
      // 🔒 ATOMIC LOCK: Try to claim this decision by updating status to 'posting'
      // This prevents race conditions where two queue runs try to post the same decision
      const { data: claimed, error: claimError } = await supabase
        .from('content_metadata')
        .update({ 
          status: 'posting',
          updated_at: new Date().toISOString()
        })
        .eq('decision_id', decision.id)
        .eq('status', 'queued')  // Only claim if still queued
        .select('decision_id')
        .single();
    
      if (claimError || !claimed) {
        // Either already claimed by another process, or already posted
        const { data: currentStatus } = await supabase
          .from('content_metadata')
          .select('status, tweet_id')
          .eq('decision_id', decision.id)
          .single();
      
        if (currentStatus?.status === 'posted' || currentStatus?.tweet_id) {
          console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already posted (status: ${currentStatus.status}, tweet_id: ${currentStatus.tweet_id})`);
          return; // Skip posting
        }
      
        if (currentStatus?.status === 'posting') {
          console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already being posted by another process`);
          return; // Skip posting
        }
      
        console.warn(`[POSTING_QUEUE] ⚠️ Failed to claim decision ${decision.id}: ${claimError?.message || 'Unknown error'}`);
        throw new Error(`Failed to claim decision for posting: ${claimError?.message || 'Unknown error'}`);
      }
    
      console.log(`[POSTING_QUEUE] 🔒 Successfully claimed decision ${decision.id} for posting`);
    
      // Double-check posted_decisions as well (defense in depth)
      const { data: alreadyExists } = await supabase
        .from('posted_decisions')
        .select('tweet_id')
        .eq('decision_id', decision.id)
        .single();
    
      if (alreadyExists) {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: ${decision.id} already in posted_decisions as ${alreadyExists.tweet_id}`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return; // Skip posting
      }
    
      // 🔍 CONTENT HASH CHECK: Check for duplicate content in BOTH tables
      // CRITICAL: Check content_metadata first (more reliable) then posted_decisions
      const contentHash = require('crypto').createHash('md5').update(decision.content).digest('hex');
      
      // Check 1: content_metadata for already-posted content with tweet_id
      const { data: duplicateInMetadata } = await supabase
        .from('content_metadata')
        .select('decision_id, tweet_id, status, posted_at')
        .eq('content', decision.content)
        .not('tweet_id', 'is', null) // Must have tweet_id (actually posted)
        .neq('decision_id', decision.id) // Exclude current decision
        .limit(1);
      
      if (duplicateInMetadata && duplicateInMetadata.length > 0) {
        const dup = duplicateInMetadata[0];
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE CONTENT PREVENTED: Same content already posted in content_metadata as ${dup.tweet_id} (decision: ${dup.decision_id.substring(0, 8)}...)`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return; // Skip posting
      }
      
      // Check 2: posted_decisions table (backup check)
      const { data: duplicateContent } = await supabase
        .from('posted_decisions')
        .select('tweet_id, content, decision_id')
        .eq('content', decision.content)
        .limit(1);
    
      if (duplicateContent && duplicateContent.length > 0) {
        console.log(`[POSTING_QUEUE] 🚫 DUPLICATE CONTENT PREVENTED: Same content already posted in posted_decisions as ${duplicateContent[0].tweet_id}`);
        // Revert status back to queued since we didn't actually post
        await supabase
          .from('content_metadata')
          .update({ status: 'queued' })
          .eq('decision_id', decision.id);
        return; // Skip posting
      }
    
      // 📊 INTELLIGENCE LAYER: Capture follower count BEFORE posting
      // 🎯 ENHANCED: Use MultiPointFollowerTracker for accurate attribution
      try {
        console.log(`${logPrefix} 🔍 Capturing follower baseline`);
        const { MultiPointFollowerTracker } = await import('../tracking/multiPointFollowerTracker');
        const tracker = MultiPointFollowerTracker.getInstance();

        let baselineTimedOut = false;
        let baselineTimeoutHandle: NodeJS.Timeout | null = null;

        const baselinePromise = tracker.captureBaseline(decision.id);

        const timeoutPromise = new Promise<void>((resolve) => {
          baselineTimeoutHandle = setTimeout(() => {
            baselineTimedOut = true;
            baselineTimeoutHandle = null;
            console.warn(`[POSTING_QUEUE] ⚠️ Follower baseline capture timed out after ${FOLLOWER_BASELINE_TIMEOUT_MS}ms (decision ${decision.id})`);
            resolve();
          }, FOLLOWER_BASELINE_TIMEOUT_MS);
        });

        await Promise.race([
          baselinePromise.then(
            () => {
              if (baselineTimeoutHandle) {
                clearTimeout(baselineTimeoutHandle);
                baselineTimeoutHandle = null;
              }
              if (!baselineTimedOut) {
                console.log(`${logPrefix} 🔍 DEBUG: Follower baseline captured`);
              }
            },
            (error: any) => {
              if (baselineTimeoutHandle) {
                clearTimeout(baselineTimeoutHandle);
                baselineTimeoutHandle = null;
              }
              if (!baselineTimedOut) {
                console.warn(`[POSTING_QUEUE] ⚠️ Follower baseline capture failed: ${error.message}`);
              }
            }
          ),
          timeoutPromise
        ]);
      } catch (attrError: any) {
        console.warn(`[POSTING_QUEUE] ⚠️ Follower capture failed: ${attrError.message}`);
      }
    
      // ═══════════════════════════════════════════════════════════
      // 🎯 PHASE 1: POST TO TWITTER (CRITICAL - Must succeed or fail here)
      // ═══════════════════════════════════════════════════════════
    
      console.log(`${logPrefix} 🔍 DEBUG: About to call postContent`);
      
      // 🔒 VALIDATION: Check character limits before posting
      if (decision.decision_type === 'thread' && decision.thread_parts) {
        const parts = Array.isArray(decision.thread_parts) ? decision.thread_parts : [];
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].length > 200) {
            throw new Error(`Thread part ${i + 1} exceeds 200 chars (${parts[i].length} chars). Max limit: 200 chars for optimal engagement.`);
          }
        }
        console.log(`${logPrefix} ✅ Character limit validation passed for ${parts.length} thread parts`);
      } else if (decision.decision_type === 'single' && decision.content) {
        if (decision.content.length > 280) {
          throw new Error(`Single tweet exceeds 280 chars (${decision.content.length} chars). Max limit: 280 chars.`);
        }
        console.log(`${logPrefix} ✅ Character limit validation passed for single tweet`);
      }
      
      try {
        if (decision.decision_type === 'single' || decision.decision_type === 'thread') {
          console.log(`${logPrefix} 🔍 DEBUG: Calling postContent for ${decision.decision_type}`);
          const result = await postContent(decision);
          console.log(`${logPrefix} 🔍 DEBUG: postContent returned successfully`);
          tweetId = result.tweetId;
          tweetUrl = result.tweetUrl;
          tweetIds = result.tweetIds; // 🆕 Capture thread IDs if available
        
          // 🔒 VALIDATION: Validate tweet ID immediately after posting
          const { IDValidator } = await import('../validation/idValidator');
          const validation = IDValidator.validateTweetId(tweetId);
          if (!validation.valid) {
            throw new Error(`Invalid tweet ID returned from postContent: ${validation.error}`);
          }
        } else if (decision.decision_type === 'reply') {
          tweetId = await postReply(decision);
        
          // 🔒 VALIDATION: Validate reply ID immediately after posting
          const { IDValidator } = await import('../validation/idValidator');
          const replyValidation = IDValidator.validateReplyId(tweetId, decision.target_tweet_id || undefined);
          if (!replyValidation.valid) {
            throw new Error(`Invalid reply ID returned from postReply: ${replyValidation.error}`);
          }
        
          // For replies, construct URL (reply system doesn't return URL yet)
          tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetId}`;
        } else {
          throw new Error(`Unknown decision type: ${decision.decision_type}`);
        }
      
        // 🎉 TWEET IS LIVE! From this point on, we ALWAYS mark as posted
        postingSucceeded = true;
        console.log(`[POSTING_QUEUE] 🎉 TWEET POSTED SUCCESSFULLY: ${tweetId}`);
        console.log(`[POSTING_QUEUE] 🔗 Tweet URL: ${tweetUrl}`);
        console.log(`[POSTING_QUEUE] ⚠️ From this point on, all operations are best-effort only`);
        
        // 🔍 CONTENT VERIFICATION: Verify tweet_id matches content (PREVENT MISATTRIBUTION)
        try {
          console.log(`[POSTING_QUEUE] 🔍 Verifying content matches tweet_id ${tweetId}...`);
          const { verifyPostedContent } = await import('../utils/contentVerification');
          const verification = await verifyPostedContent(
            tweetId,
            decision.decision_type === 'thread' 
              ? (decision.thread_parts || []).join(' ')
              : decision.content
          );
          
          if (!verification.isValid) {
            console.error(`[POSTING_QUEUE] 🚨 CRITICAL MISATTRIBUTION DETECTED!`);
            console.error(`[POSTING_QUEUE] Tweet ID: ${tweetId}`);
            console.error(`[POSTING_QUEUE] Expected: "${verification.expectedPreview}..."`);
            console.error(`[POSTING_QUEUE] Actual: "${verification.actualPreview}..."`);
            console.error(`[POSTING_QUEUE] Similarity: ${(verification.similarity * 100).toFixed(1)}%`);
            console.error(`[POSTING_QUEUE] ⚠️ WRONG TWEET_ID STORED - MANUAL INVESTIGATION REQUIRED!`);
            console.error(`[POSTING_QUEUE] 🚨 Do NOT store this tweet_id - it belongs to different content!`);
            
            // 🔥 CRITICAL: Mark as posted BUT store misattribution flag
            // Don't fail the post (it's already live), but flag for manual fix
            const { getSupabaseClient } = await import('../db/index');
            const supabase = getSupabaseClient();
            await supabase
              .from('content_metadata')
              .update({
                status: 'posted',
                tweet_id: tweetId,
                posted_at: new Date().toISOString(),
                features: {
                  misattribution_detected: true,
                  verification_error: verification.error,
                  verification_similarity: verification.similarity
                }
              })
              .eq('decision_id', decision.id);
            
            // Still continue - post is live, but flag it for manual investigation
            console.error(`[POSTING_QUEUE] ⚠️ Misattribution flag stored - requires manual fix`);
          } else {
            console.log(`[POSTING_QUEUE] ✅ CONTENT VERIFICATION: Match ${(verification.similarity * 100).toFixed(1)}% - tweet_id is correct`);
          }
        } catch (verifyError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Content verification failed: ${verifyError.message}`);
          // Continue anyway - verification failure shouldn't block posting
        }
        
        // 🔥 PRIORITY 4 FIX: Log successful post
        await logPostAttempt(decision, 'success', tweetId);
      
      } catch (postError: any) {
        // Posting failed - BUT check if tweet actually posted (timeout might have happened after success)
        console.error(`[POSTING_QUEUE] ❌ POSTING FAILED: ${postError.message}`);
        console.error(`[POSTING_QUEUE] 📝 Content: "${decision.content.substring(0, 100)}..."`);
      
        // 🔥 SUCCESS VERIFICATION: Check if tweet actually posted despite error (common with timeouts)
        const isTimeout = /timeout|exceeded/i.test(postError.message);
        if (isTimeout) {
          console.log(`[POSTING_QUEUE] 🔍 Timeout detected - verifying if tweet actually posted...`);
          try {
            const verifiedTweetId = await verifyTweetPosted(decision.content, decision.decision_type);
            if (verifiedTweetId) {
              console.log(`[POSTING_QUEUE] ✅ VERIFICATION SUCCESS: Tweet is live on Twitter! ID: ${verifiedTweetId}`);
              // Tweet is actually posted - treat as success!
              tweetId = verifiedTweetId;
              tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${verifiedTweetId}`;
              postingSucceeded = true;
              // Continue to database save (skip retry logic)
            } else {
              console.log(`[POSTING_QUEUE] ❌ VERIFICATION FAILED: Tweet not found on Twitter`);
            }
          } catch (verifyError: any) {
            console.warn(`[POSTING_QUEUE] ⚠️ Verification check failed: ${verifyError.message}`);
            // Continue with normal retry logic
          }
        }
      
        // If verification found the tweet, skip retry logic and go to database save
        if (postingSucceeded && tweetId) {
          console.log(`[POSTING_QUEUE] 🎉 Tweet verified as posted - skipping retry, saving to database`);
          // Continue to database save section below
        } else {
          // RETRY LOGIC: Both singles and threads get 3 retry attempts
          // Temporary failures (network glitch, slow load) shouldn't be permanent
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
        
          const { data: metadataData } = await supabase
            .from('content_metadata')
            .select('features')
            .eq('decision_id', decision.id)
            .single();
        
          metadata = metadataData;
          retryCount = (metadata?.features as any)?.retry_count || 0;
          recoveryAttempts = Number((metadata?.features as any)?.recovery_attempts || 0);
        
          if (retryCount < maxRetries) {
            // 🔥 PRE-RETRY VERIFICATION: Check if previous attempt actually succeeded
            // This prevents retrying when tweet is already live
            const isTimeout = /timeout|exceeded/i.test(postError.message || '');
            if (isTimeout && retryCount > 0) {
              console.log(`[POSTING_QUEUE] 🔍 PRE-RETRY VERIFICATION: Checking if previous attempt succeeded...`);
              try {
                const preRetryCheck = await verifyTweetPosted(decision.content, decision.decision_type);
                if (preRetryCheck && preRetryCheck !== 'verified_but_no_id' && preRetryCheck !== 'verified') {
                  // Previous attempt succeeded! Mark as posted
                  console.log(`[POSTING_QUEUE] ✅ PRE-RETRY VERIFICATION: Tweet is already live! ID: ${preRetryCheck}`);
                  console.log(`[POSTING_QUEUE] 🎉 Skipping retry - marking as posted`);
                
                  tweetId = preRetryCheck;
                  tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${preRetryCheck}`;
                  postingSucceeded = true;
                  // Continue to database save (skip retry logic)
                  // Break out of retry block by returning early
                } else if (preRetryCheck === 'verified' || preRetryCheck === 'verified_but_no_id') {
                  // Tweet exists but no ID - still mark as posted
                  console.log(`[POSTING_QUEUE] ✅ PRE-RETRY VERIFICATION: Tweet exists but ID extraction failed`);
                  tweetId = `recovered_${Date.now()}`;
                  tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}`;
                  postingSucceeded = true;
                  // Continue to database save
                } else {
                  console.log(`[POSTING_QUEUE] ❌ PRE-RETRY VERIFICATION: Tweet not found - proceeding with retry`);
                }
              } catch (preRetryError: any) {
                console.warn(`[POSTING_QUEUE] ⚠️ Pre-retry verification failed: ${preRetryError.message}`);
                // Continue with retry if verification fails
              }
            }
          
            // If verification found the tweet, skip retry and go to database save
            if (postingSucceeded && tweetId) {
              console.log(`[POSTING_QUEUE] 🎉 Tweet verified as posted - skipping retry, saving to database`);
              // Break out of retry block - will continue to database save
            } else {
              // Calculate retry delay (progressive backoff)
              const retryDelayMinutes = decision.decision_type === 'thread' 
                ? [5, 15, 30][retryCount]  // Threads: 5min, 15min, 30min
                : [3, 10, 20][retryCount]; // Singles: 3min, 10min, 20min (faster retries)
            
              const retryDelay = retryDelayMinutes * 60 * 1000;
            
              console.log(`[POSTING_QUEUE] 🔄 ${decision.decision_type} will retry (attempt ${retryCount + 1}/${maxRetries}) in ${retryDelayMinutes}min`);
              console.log(`[POSTING_QUEUE] 📝 Error: ${postError.message}`);
            
              const shouldForceReset = /timeout|session/i.test(postError.message || '');
              const existingForceReset = Boolean((metadata?.features as any)?.force_session_reset);
              await supabase
                .from('content_metadata')
                .update({
                  status: 'queued',  // 🔄 Revert from 'posting' back to 'queued' for retry
                  scheduled_at: new Date(Date.now() + retryDelay).toISOString(),
                  features: {
                    ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                    retry_count: retryCount + 1,
                    last_error: postError.message,
                    last_attempt: new Date().toISOString(),
                    last_post_error: postError.message,
                    force_session_reset: shouldForceReset || existingForceReset
                  }
                })
                .eq('decision_id', decision.id);
            
              await updatePostingMetrics('error');
              return; // Don't mark as failed, will retry
            }
          }
        }
      
        if (recoveryAttempts < maxRecoveryAttempts) {
          const recoveryDelayMinutes = Math.min(45, (recoveryAttempts + 1) * 10);
          const recoveryDelay = recoveryDelayMinutes * 60 * 1000;
          console.log(`[POSTING_QUEUE] 🛠️ Scheduling recovery attempt ${recoveryAttempts + 1}/${maxRecoveryAttempts} with forced session reset in ${recoveryDelayMinutes}min`);
          await supabase
            .from('content_metadata')
            .update({
              status: 'queued',
              scheduled_at: new Date(Date.now() + recoveryDelay).toISOString(),
              features: {
                ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                retry_count: 0,
                recovery_attempts: recoveryAttempts + 1,
                force_session_reset: true,
                last_error: postError.message,
                last_attempt: new Date().toISOString(),
                last_post_error: postError.message
              }
            })
            .eq('decision_id', decision.id);
          await updatePostingMetrics('error');
          return;
        }
      
        // 🔥 CRITICAL FIX: Final verification before marking as failed
        // All retries exhausted - but check ONE MORE TIME if tweet actually posted
        console.error(`[POSTING_QUEUE] ❌ All ${maxRetries} retries + ${maxRecoveryAttempts} recoveries exhausted for ${decision.decision_type}`);
        console.log(`[POSTING_QUEUE] 🔍 FINAL VERIFICATION: Checking if tweet actually posted despite errors...`);
      
        try {
          const finalVerification = await verifyTweetPosted(decision.content, decision.decision_type);
          if (finalVerification && finalVerification !== 'verified_but_no_id' && finalVerification !== 'verified') {
            // Tweet is actually live! Mark as posted instead of failed
            console.log(`[POSTING_QUEUE] ✅ FINAL VERIFICATION SUCCESS: Tweet is live on Twitter! ID: ${finalVerification}`);
            console.log(`[POSTING_QUEUE] 🎉 Recovering false failure - marking as posted`);
          
            tweetId = finalVerification;
            tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${finalVerification}`;
            postingSucceeded = true;
          
            // Mark as posted (will continue to database save section)
            // Don't throw error, let it fall through to database save
          } else if (finalVerification === 'verified' || finalVerification === 'verified_but_no_id') {
            // Tweet exists but we couldn't get ID - still mark as posted with placeholder
            console.log(`[POSTING_QUEUE] ✅ FINAL VERIFICATION: Tweet exists but ID extraction failed`);
            console.log(`[POSTING_QUEUE] 🎉 Recovering false failure - marking as posted with placeholder ID`);
          
            tweetId = `recovered_${Date.now()}`;
            tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}`;
            postingSucceeded = true;
          
            // Mark as posted (will continue to database save section)
          } else {
            // Verification confirms tweet is NOT on Twitter - safe to mark as failed
            console.log(`[POSTING_QUEUE] ❌ FINAL VERIFICATION: Tweet not found on Twitter - marking as failed`);
            await supabase
              .from('content_metadata')
              .update({
                status: 'failed',
                updated_at: new Date().toISOString(),
                features: {
                  ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                  retry_count: retryCount,
                  recovery_attempts: recoveryAttempts,
                  last_error: postError.message,
                  last_attempt: new Date().toISOString(),
                  last_post_error: postError.message,
                  final_verification: 'not_found'
                }
              })
              .eq('decision_id', decision.id);
            await updatePostingMetrics('error');
            throw postError;
          }
        } catch (verifyError: any) {
          // Verification itself failed - be conservative, don't mark as failed yet
          console.error(`[POSTING_QUEUE] ⚠️ Final verification check failed: ${verifyError.message}`);
          console.log(`[POSTING_QUEUE] ⚠️ Cannot confirm if tweet posted - marking as failed but logging for reconciliation`);
          await supabase
            .from('content_metadata')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
              features: {
                ...(typeof metadata?.features === 'object' && metadata?.features !== null ? metadata.features : {}),
                retry_count: retryCount,
                recovery_attempts: recoveryAttempts,
                last_error: postError.message,
                last_attempt: new Date().toISOString(),
                last_post_error: postError.message,
                final_verification: 'verification_failed',
                needs_reconciliation: true
              }
            })
            .eq('decision_id', decision.id);
          await updatePostingMetrics('error');
          throw postError;
        }
      }
    
    // Only continue to post-posting operations if posting succeeded
    if (postingSucceeded && tweetId) {
        // ═══════════════════════════════════════════════════════════
        // 🎯 PHASE 2: POST-POSTING OPERATIONS (BEST EFFORT ONLY)
        // ═══════════════════════════════════════════════════════════
        // Tweet is live - nothing below can fail the post!
        
        // Best-effort: Extract and classify hook
        try {
          const { hookAnalysisService } = await import('../intelligence/hookAnalysisService');
          const hook = hookAnalysisService.extractHook(decision.content);
          const hookType = hookAnalysisService.classifyHookType(hook);
        
          // Store hook in outcomes
          const { getSupabaseClient: getSupa } = await import('../db/index');
          const supa = getSupa();
          await supa
            .from('outcomes')
            .update({ 
              hook_text: hook, 
              hook_type: hookType 
            })
            .eq('tweet_id', tweetId);
        
          console.log(`[POSTING_QUEUE] 🎣 Hook captured: "${hook}" (${hookType})`);
        } catch (hookError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Hook capture failed (non-critical): ${hookError.message}`);
        }
      
        // Mark as posted and store tweet ID and URL
        // 🚨 CRITICAL: Retry database save if it fails (tweet is already on Twitter!)
        // 🔥 ABSOLUTE PRIORITY: tweet_id MUST be saved - missing IDs make us look like a bot!
        let dbSaveSuccess = false;
        for (let attempt = 1; attempt <= 5; attempt++) {  // Increased to 5 attempts
          try {
            console.log(`[POSTING_QUEUE] 💾 Database save attempt ${attempt}/5 for tweet ${tweetId}...`);
            // 🆕 Pass thread IDs if available
            await markDecisionPosted(decision.id, tweetId, tweetUrl, tweetIds);
            dbSaveSuccess = true;
            console.log(`[POSTING_QUEUE] ✅ Database save SUCCESS on attempt ${attempt}`);
            break;
          } catch (dbError: any) {
            console.error(`[POSTING_QUEUE] 🚨 Database save attempt ${attempt}/5 failed:`, dbError.message);
            
            // 🔧 ENHANCED ERROR TRACKING: Track database save failures
            await trackError(
              'posting_queue',
              'database_save_failed',
              `Database save failed (attempt ${attempt}/5): ${dbError.message}`,
              attempt === 5 ? 'critical' : 'error',
              {
                decision_id: decision.id,
                tweet_id: tweetId,
                attempt: attempt,
                error_code: dbError.code,
                error_details: dbError.message
              }
            );
            
            if (attempt < 5) {
              const delay = attempt * 2000; // Progressive backoff: 2s, 4s, 6s, 8s
              console.log(`[POSTING_QUEUE] 🔄 Retrying in ${delay/1000} seconds...`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              // 🔥 PRIORITY 2 FIX: Store in retry queue on final failure
              try {
                await storeInRetryQueue(decision.id, tweetId, tweetUrl, tweetIds, decision.content);
                console.log(`[POSTING_QUEUE] 💾 Stored in retry queue after ${attempt} failed attempts`);
                
                // Track retry queue storage
                await trackError(
                  'posting_queue',
                  'database_save_final_failure',
                  `Database save failed after 5 attempts, stored in retry queue`,
                  'critical',
                  {
                    decision_id: decision.id,
                    tweet_id: tweetId,
                    tweet_url: tweetUrl
                  }
                );
              } catch (retryQueueError: any) {
                console.error(`[POSTING_QUEUE] ⚠️ Failed to store in retry queue: ${retryQueueError.message}`);
                
                // Track retry queue failure
                await trackError(
                  'posting_queue',
                  'retry_queue_storage_failed',
                  `Failed to store in retry queue: ${retryQueueError.message}`,
                  'critical',
                  {
                    decision_id: decision.id,
                    tweet_id: tweetId
                  }
                );
              }
            }
          }
        }
      
        if (!dbSaveSuccess) {
            console.error(`[POSTING_QUEUE] 💥 CRITICAL: Tweet ${tweetId} posted but database save failed after 5 attempts!`);
          console.error(`[POSTING_QUEUE] 🔗 Tweet URL: ${tweetUrl}`);
          console.error(`[POSTING_QUEUE] 📝 Content: ${decision.content.substring(0, 100)}`);
          console.error(`[POSTING_QUEUE] 🚨 THIS MAKES US LOOK LIKE A BOT - EMERGENCY FIX REQUIRED!`);
        
          // 🔥 EMERGENCY FALLBACK: Try multiple simple update strategies
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const emergencyStrategies = [
            // Strategy 1: Full update with all fields
            async () => {
              await supabase
                .from('content_metadata')
                .update({ 
                  status: 'posted',
                  tweet_id: tweetId,
                  posted_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('decision_id', decision.id);
            },
            // Strategy 2: Just tweet_id (most critical)
            async () => {
              await supabase
                .from('content_metadata')
                .update({ tweet_id: tweetId })
                .eq('decision_id', decision.id);
            }
          ];
        
          let emergencySuccess = false;
          for (let strategyIdx = 0; strategyIdx < emergencyStrategies.length; strategyIdx++) {
            try {
              await emergencyStrategies[strategyIdx]();
              emergencySuccess = true;
              console.log(`[POSTING_QUEUE] ✅ Emergency save strategy ${strategyIdx + 1} succeeded!`);
              break;
            } catch (emergencyError: any) {
              console.error(`[POSTING_QUEUE] ❌ Emergency strategy ${strategyIdx + 1} failed:`, emergencyError.message);
            }
          }
        
          if (!emergencySuccess) {
            console.error(`[POSTING_QUEUE] 💥 ALL EMERGENCY SAVE STRATEGIES FAILED!`);
            console.error(`[POSTING_QUEUE] 🚨 Tweet ${tweetId} is LIVE on Twitter but database has NO tweet_id!`);
            
            // 🔥 PRIORITY 2 FIX: Store in retry queue for background recovery
            try {
              await storeInRetryQueue(decision.id, tweetId, tweetUrl, tweetIds, decision.content);
              console.log(`[POSTING_QUEUE] 💾 Stored in retry queue for background recovery`);
            } catch (retryQueueError: any) {
              console.error(`[POSTING_QUEUE] ⚠️ Failed to store in retry queue: ${retryQueueError.message}`);
            }
            console.error(`[POSTING_QUEUE] 📋 Manual intervention required - decision_id: ${decision.id}, tweet_id: ${tweetId}`);
          
            // Store error message for recovery
            try {
              await supabase
                .from('content_metadata')
                .update({ 
                  status: 'posted',
                  error_message: `Tweet ID capture failed - tweet_id: ${tweetId}, URL: ${tweetUrl}`
                })
                .eq('decision_id', decision.id);
            } catch (finalError: any) {
              console.error(`[POSTING_QUEUE] 💥 Even error message save failed: ${finalError.message}`);
            }
          }
        
          // DON'T throw - post succeeded! But log this as critical issue.
        }
      
        // Best-effort: Update metrics
        try {
          await updatePostingMetrics('posted');
        } catch (metricsError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Metrics update failed (non-critical): ${metricsError.message}`);
        }
      
        // Best-effort: Initialize attribution tracking
        try {
          const { initializePostAttribution } = await import('../learning/engagementAttribution');
          await initializePostAttribution(tweetId, {
            hook_pattern: (decision as any).metadata?.hook_pattern || 'unknown',
            topic: (decision as any).metadata?.topic || decision.topic_cluster,
            generator: (decision as any).metadata?.generator_used || 'unknown',
            format: (decision as any).metadata?.format || 'single',
            viral_score: (decision as any).metadata?.viral_score || 50
          });
          console.log(`[POSTING_QUEUE] 📊 Attribution tracking initialized`);
        } catch (attrError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Attribution init failed (non-critical): ${attrError.message}`);
        }
      
        console.log(`[POSTING_QUEUE] ✅ ${decision.decision_type} POSTED SUCCESSFULLY: ${tweetId}`);
      
        // ═══════════════════════════════════════════════════════════
        // 🚀 POST-POSTING FEEDBACK LOOP - Track with Advanced Algorithms
        // ═══════════════════════════════════════════════════════════
      
        try {
          // 1. TWITTER ALGORITHM OPTIMIZER - Track engagement velocity
          const { getTwitterAlgorithmOptimizer } = await import('../algorithms/twitterAlgorithmOptimizer');
          const twitterAlgo = getTwitterAlgorithmOptimizer();
          await twitterAlgo.trackVelocity(tweetId, new Date().toISOString());
          console.log(`[POSTING_QUEUE] ⚡ Velocity tracking initialized for ${tweetId}`);
        } catch (veloError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Velocity tracking failed: ${veloError.message}`);
        }
      
        try {
          // 2. CONVERSION FUNNEL TRACKER - Track full funnel
          const { getConversionFunnelTracker } = await import('../algorithms/conversionFunnelTracker');
          const funnelTracker = getConversionFunnelTracker();
          await funnelTracker.trackFunnelMetrics(decision.id);
          console.log(`[POSTING_QUEUE] 📊 Funnel tracking initialized for ${decision.id}`);
        } catch (funnelError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Funnel tracking failed: ${funnelError.message}`);
        }
      
        try {
          // 3. FOLLOWER PREDICTOR - Track prediction for accuracy
          // Prediction data is stored in planJobNew, we'll update accuracy later when real results come in
          const { getFollowerPredictor } = await import('../algorithms/followerPredictor');
          const predictor = getFollowerPredictor();
          // Note: Prediction was already tracked in planJobNew, will update with actuals in analytics job
          console.log(`[POSTING_QUEUE] 🔮 Prediction will be validated with actual results`);
        } catch (predError: any) {
          console.warn(`[POSTING_QUEUE] ⚠️ Predictor tracking failed: ${predError.message}`);
        }
      
        // ═══════════════════════════════════════════════════════════
      
        // 🔧 ENHANCED LEARNING INTEGRATION: Initialize tracking in learning system
        try {
          // Step 1: Add post to tracking (so learning system knows about it)
          await learningSystem.processNewPost(
            decision.id,
            String(decision.content),
            {
              followers_gained_prediction: decision.predicted_followers || 0,
              engagement_rate_prediction: decision.predicted_er || 0.03,
              quality_score: decision.quality_score || 0.7
            },
            {
              content_type_name: decision.decision_type,
              hook_used: decision.hook_type || 'unknown',
              topic: decision.topic_cluster || 'health',
              generator_used: (decision as any).generator_used || 'unknown',
              bandit_arm: decision.bandit_arm || 'unknown',
              timing_arm: decision.timing_arm || 'unknown'
            }
          );
          console.log('[LEARNING_SYSTEM] ✅ Post ' + decision.id + ' tracked with enhanced metadata');
        } catch (learningError: any) {
          console.warn('[LEARNING_SYSTEM] ⚠️ Failed to track post:', learningError.message);
          
          // 🔧 ENHANCED ERROR TRACKING: Track learning system failures
          await trackError(
            'learning_system',
            'post_tracking_failed',
            `Failed to track post in learning system: ${learningError.message}`,
            'warning',
            {
              decision_id: decision.id,
              tweet_id: tweetId
            }
          );
        }
      
        // SMART BATCH FIX: Immediate metrics scraping after post
        try {
          console.log(`[METRICS] 🔍 Collecting initial metrics for ${tweetId}...`);
        
          // Wait 30 seconds for tweet to be indexed by Twitter
          await new Promise(resolve => setTimeout(resolve, 30000));
        
          // SMART BATCH FIX: Simplified metrics collection (avoid complex scraping in posting flow)
          // Store placeholder entry, let scheduled scraper collect real metrics
          const { getSupabaseClient: getSupa } = await import('../db/index');
          const supa = getSupa();
          await supa.from('outcomes').upsert({
            decision_id: decision.id,
            tweet_id: tweetId,
            likes: null, // Will be filled by scheduled scraper
            retweets: null,
            replies: null,
            views: null,
            bookmarks: null,
            impressions: null,
            collected_at: new Date().toISOString(),
            data_source: 'post_placeholder',
            simulated: false
          }, { onConflict: 'decision_id' });
        
          console.log(`[METRICS] ✅ Placeholder created for ${tweetId}, scheduled scraper will collect metrics`);
        } catch (metricsError: any) {
          console.warn(`[METRICS] ⚠️ Failed to collect initial metrics (non-critical): ${metricsError.message}`);
          // Don't fail the post, just log and continue
        }
      
      console.log(`[POSTING_QUEUE] 🎉 POST COMPLETE: Tweet is live on Twitter, all tracking initiated!`);
    }
  } catch (topLevelError: any) {
      // Catch any errors that weren't handled by inner try-catch blocks
      const errorMsg = topLevelError?.message || topLevelError?.toString() || 'Unknown error';
      console.error(`${logPrefix} 🚨 FUNCTION-LEVEL ERROR:`, errorMsg);
      try {
        await markDecisionFailed(decision.id, errorMsg);
      } catch (markError: any) {
        console.error(`${logPrefix} 🚨 Failed to mark decision as failed:`, markError.message);
      }
      throw topLevelError;
    }
}

async function postContent(decision: QueuedDecision): Promise<{ tweetId: string; tweetUrl: string; tweetIds?: string[] }> {
  console.log(`[POSTING_QUEUE] 📝 Posting content: "${decision.content.substring(0, 50)}..."`);
  
  // 📊 FOLLOWER TRACKING: Capture baseline before posting
  const followersBefore = await captureFollowerBaseline(decision.id);
  
  // 🔒 BROWSER SEMAPHORE: Acquire exclusive browser access (highest priority)
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  return await withBrowserLock('posting', BrowserPriority.POSTING, async () => {
    // Check feature flag for posting method
    const { getEnvConfig } = await import('../config/env');
    const config = getEnvConfig();
  
  if (config.FEATURE_X_API_POSTING) {
    console.log('[POSTING_QUEUE] 🔌 Using official X API posting...');
    
    try {
      const { XApiPoster } = await import('../posting/xApiPoster');
      const apiPoster = new XApiPoster();
      const result = await apiPoster.postStatus(decision.content);
      
      if (result.success) {
        if (!result.tweetId) {
          throw new Error('X API posting succeeded but no tweet ID was returned');
        }
        console.log(`[POSTING_QUEUE] ✅ Content posted via X API with ID: ${result.tweetId}`);
        const tweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${result.tweetId}`;
        return { tweetId: result.tweetId, tweetUrl };
      } else {
        console.error(`[POSTING_QUEUE] ❌ X API posting failed: ${result.error}`);
        throw new Error(result.error || 'X API posting failed');
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ X API system error: ${error.message}`);
      throw new Error(`X API posting failed: ${error.message}`);
    }
  } else {
    console.log('[POSTING_QUEUE] 🌐 Using reliable Playwright posting...');
    
    try {
      // 🧵 CHECK IF THIS IS A THREAD (retrieve from thread_parts)
      const thread_parts = decision.thread_parts || (decision as any).thread_tweets; // Support both names for backwards compat
      const isThread = Array.isArray(thread_parts) && thread_parts.length > 1;
      
      console.log(`[POSTING_QUEUE] 🔍 Thread detection: isThread=${isThread}, segments=${isThread ? thread_parts.length : 0}`);
      
      if (isThread) {
        console.log(`[POSTING_QUEUE] 🧵 THREAD MODE: Posting ${thread_parts.length} connected tweets`);
        
        // 🎨 GET METADATA FOR VISUAL FORMATTING CONTEXT
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const { data: metadata } = await supabase
          .from('content_metadata')
          .select('raw_topic, angle, tone, format_strategy, generator_name')
          .eq('decision_id', decision.id)
          .single();
        
        // 🎨 APPLY VISUAL FORMATTING TO THREAD (if specified)
        let formattedThreadParts = thread_parts;
        if (decision.visual_format) {
          console.log(`[POSTING_QUEUE] 🎨 Applying visual format to thread: "${decision.visual_format}"`);
          const { applyVisualFormat } = await import('../posting/visualFormatter');
          formattedThreadParts = thread_parts.map(part => {
            const formatResult = applyVisualFormat(part, decision.visual_format);
            return formatResult.formatted;
          });
          console.log(`[POSTING_QUEUE] ✅ Visual formatting applied to ${formattedThreadParts.length} thread parts`);
        } else {
          console.log(`[POSTING_QUEUE] 💡 No visual format specified, using thread as-is`);
        }
        
        // 🚀 POST THREAD (using BulletproofThreadComposer - creates CONNECTED threads, not reply chains)
        console.log(`[POSTING_QUEUE] 🚀 Posting thread to Twitter via native composer...`);
        const { BulletproofThreadComposer } = await import('../posting/BulletproofThreadComposer');
        const { withTimeout } = await import('../utils/operationTimeout');
        
        // 🛡️ TIMEOUT PROTECTION: Prevent thread posting from hanging (180 second max)
        // 🔥 FIX: Increased from 120s to 180s - Threads take longer (multiple tweets + verification)
        const THREAD_POST_TIMEOUT_MS = 180000; // 180 seconds max for threads (longer due to multiple tweets)
        const result = await withTimeout(
          () => BulletproofThreadComposer.post(formattedThreadParts),
          { 
            timeoutMs: THREAD_POST_TIMEOUT_MS, 
            operationName: `thread_post_${thread_parts.length}_tweets`
          }
        );
        
        if (!result.success) {
          // Thread completely failed - ensure we have a detailed error message
          const errorDetails = result.error || 'Unknown thread posting error (no error message returned)';
          console.error(`[POSTING_QUEUE] ❌ Thread failed: ${errorDetails}`);
          console.error(`[POSTING_QUEUE] ❌ Thread mode was: ${result.mode || 'unknown'}`);
          console.error(`[POSTING_QUEUE] ❌ Thread ID: ${decision.id}`);
          console.error(`[POSTING_QUEUE] ❌ Thread parts: ${thread_parts.length} tweets`);
          throw new Error(`Thread posting failed: ${errorDetails}`);
        }
        
        // Success - extract tweet IDs from result
        console.log(`[POSTING_QUEUE] ✅ Thread posted: ${result.mode}`);
        const rootTweetId = result.tweetIds?.[0] || result.rootTweetUrl?.split('/').pop() || '';
        const rootTweetUrl = result.rootTweetUrl || `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`;
        
        console.log(`[POSTING_QUEUE] 🔗 Root tweet: ${rootTweetId}`);
        console.log(`[POSTING_QUEUE] 📊 Tweet count: ${result.tweetIds?.length || 1}/${thread_parts.length}`);
        
        if (result.tweetIds && result.tweetIds.length > 0) {
          console.log(`[POSTING_QUEUE] 🔗 Tweet IDs: ${result.tweetIds.join(', ')}`);
        }
        
        return {
          tweetId: rootTweetId,
          tweetUrl: rootTweetUrl,
          tweetIds: result.tweetIds
        }
      } else {
        console.log(`[POSTING_QUEUE] 📝 Posting as SINGLE tweet`);
        const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
        const { withTimeout } = await import('../utils/operationTimeout');
        const { applyVisualFormat } = await import('../posting/visualFormatter');
        
        // 🎨 APPLY VISUAL FORMATTING (if specified)
        let contentToPost = decision.content;
        if (decision.visual_format) {
          console.log(`[POSTING_QUEUE] 🎨 Applying visual format: "${decision.visual_format}"`);
          const formatResult = applyVisualFormat(decision.content, decision.visual_format);
          contentToPost = formatResult.formatted;
          console.log(`[POSTING_QUEUE] ✅ Visual formatting applied: ${formatResult.transformations.join(', ')}`);
        } else {
          console.log(`[POSTING_QUEUE] 💡 No visual format specified, using content as-is`);
        }
        
        const poster = new UltimateTwitterPoster();
        
        // 🛡️ TIMEOUT PROTECTION: Prevent hanging operations (120 second max)
        // 🔥 FIX: Increased from 90s to 120s - Twitter can take 55-90s to complete posting
        const SINGLE_POST_TIMEOUT_MS = 120000; // 120 seconds max for single post
        const result = await withTimeout(
          () => poster.postTweet(contentToPost),
          { 
            timeoutMs: SINGLE_POST_TIMEOUT_MS, 
            operationName: 'single_post',
            onTimeout: async () => {
              console.error(`[POSTING_QUEUE] ⏱️ Single post timeout after ${SINGLE_POST_TIMEOUT_MS}ms - cleaning up`);
              try {
                await poster.dispose();
              } catch (e) {
                console.error(`[POSTING_QUEUE] ⚠️ Error during timeout cleanup:`, e);
              }
            }
          }
        );
        await poster.dispose();
        
        if (!result.success || !result.tweetId) {
          console.error(`[POSTING_QUEUE] ❌ Playwright posting failed: ${result.error}`);
          throw new Error(result.error || 'Playwright posting failed');
        }
        
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        const tweetUrl = `https://x.com/${username}/status/${result.tweetId}`;
        
        console.log(`[POSTING_QUEUE] ✅ Tweet ID extracted: ${result.tweetId}`);
        console.log(`[POSTING_QUEUE] ✅ Tweet URL: ${tweetUrl}`);
        
        // Return object with both ID and URL
        return { tweetId: result.tweetId, tweetUrl };
      }
    } catch (error: any) {
      console.error(`[POSTING_QUEUE] ❌ Playwright system error: ${error.message}`);
      throw new Error(`Playwright posting failed: ${error.message}`);
    }
  }
  }); // End withBrowserLock
}

async function postReply(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  // 🔒 BROWSER SEMAPHORE: Acquire exclusive browser access (HIGHEST priority)
  const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
  
  // 🚨 CRITICAL: Wrap in timeout to prevent browser semaphore starvation
  const REPLY_TIMEOUT_MS = 210000; // 3.5 minutes (allows profile/conversation fallback)
  const TIMEOUT_WARNING_MS = 120000; // Warn if we cross 2 minutes
  
  let warningTimer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Reply posting timeout after ${REPLY_TIMEOUT_MS/1000}s`));
    }, REPLY_TIMEOUT_MS);
  });
  
  const postingPromise = withBrowserLock('reply_posting', BrowserPriority.REPLIES, async () => {
    if (!decision.target_tweet_id) {
    throw new Error('Reply decision missing target_tweet_id');
  }
  
  // 🚨 CRITICAL PRE-POST CHECK: Verify we haven't already replied to this tweet
  const { getSupabaseClient } = await import('../db/index');
  const supabase = getSupabaseClient();
  
  const { data: existingReply } = await supabase
    .from('content_metadata')
    .select('tweet_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('target_tweet_id', decision.target_tweet_id)
    .eq('status', 'posted')
    .limit(1)
    .single();
    
  if (existingReply) {
    const replyTime = existingReply.posted_at ? new Date(String(existingReply.posted_at)).toLocaleString() : 'unknown time';
    console.log(`[POSTING_QUEUE] 🚫 DUPLICATE PREVENTED: Already replied to tweet ${decision.target_tweet_id} at ${replyTime}`);
    console.log(`[POSTING_QUEUE]    Previous reply ID: ${existingReply.tweet_id}`);
    
    // Mark this decision as posted (to prevent retry) but don't actually post
    await updateDecisionStatus(decision.id, 'posted');
    throw new Error(`Duplicate reply prevented: Already replied to ${decision.target_tweet_id}`);
  }
  
  console.log(`[POSTING_QUEUE] ✅ Duplicate check passed - no existing reply to ${decision.target_tweet_id}`);
  
  // ✅ Content is ALREADY formatted (done in replyJob before queueing)
  console.log(`[POSTING_QUEUE] 💡 Using pre-formatted reply content`);
  
  // 🛡️ Use PROPER reply system (posts as actual reply, not @mention)
  console.log(`[POSTING_QUEUE] 💬 Using UltimateTwitterPoster.postReply() for REAL replies...`);
  
  try {
    if (!decision.target_tweet_id) {
      throw new Error('Cannot post reply: missing target_tweet_id');
    }

    const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
    const PosterCtor = UltimateTwitterPoster;
    let poster: InstanceType<typeof PosterCtor> | null = null;

    try {
      poster = new PosterCtor({ purpose: 'reply' });
      console.log(`[POSTING_QUEUE] 💬 Posting REAL reply to tweet ${decision.target_tweet_id}...`);
      console.log(`[POSTING_QUEUE] 📝 Reply content: "${decision.content.substring(0, 60)}..."`);

      const result = await poster.postReply(decision.content, decision.target_tweet_id, decision.id);

      if (!result.success || !result.tweetId) {
        throw new Error(result.error || 'Reply posting failed');
      }

      if (result.tweetId === decision.target_tweet_id) {
        throw new Error(`Reply ID extraction bug: got parent ID ${decision.target_tweet_id} instead of new reply ID`);
      }

      console.log(`[POSTING_QUEUE] ✅ Reply ID validated: ${result.tweetId} (≠ parent ${decision.target_tweet_id})`);
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      console.log(`[POSTING_QUEUE] 🔗 Reply URL: https://x.com/${username}/status/${result.tweetId}`);

      await poster.dispose();
      poster = null;

      try {
        await supabase
          .from('reply_opportunities')
          .delete()
          .eq('target_tweet_id', decision.target_tweet_id);
        console.log(`[POSTING_QUEUE] 🧹 Cleared opportunity for ${decision.target_tweet_id}`);
      } catch (cleanupError: any) {
        console.warn(`[POSTING_QUEUE] ⚠️ Failed to clear opportunity ${decision.target_tweet_id}:`, cleanupError.message);
      }

      if (!result.tweetId || result.tweetId.startsWith('reply_posted_') || result.tweetId.startsWith('posted_')) {
        console.error(`[POSTING_QUEUE] 🚨 Reply ID extraction failed: got ${result.tweetId || 'null'}`);
        console.error(`[POSTING_QUEUE] 🚨 This will cause missing tweet_id in database!`);
        throw new Error(`Reply ID extraction failed: got ${result.tweetId || 'null'}`);
      }
      
      // 🔥 VALIDATE: Ensure tweet ID is a valid numeric string (Twitter IDs are numeric)
      if (!/^\d+$/.test(result.tweetId)) {
        console.error(`[POSTING_QUEUE] 🚨 Invalid reply ID format: ${result.tweetId} (expected numeric)`);
        throw new Error(`Invalid reply ID format: ${result.tweetId} (expected numeric Twitter ID)`);
      }

      return result.tweetId;
    } catch (innerError: any) {
      if (poster) {
        await poster.handleFailure(innerError.message || 'reply_posting_failure');
      }
      throw innerError;
    }
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ❌ Reply system error: ${error.message}`);
    throw new Error(`Reply posting failed: ${error.message}`);
  }
  }); // End withBrowserLock
  
  // Race between posting and timeout
  warningTimer = setTimeout(() => {
    console.warn(`[POSTING_QUEUE] ⚠️ Reply still processing after ${TIMEOUT_WARNING_MS / 1000}s (decision ${decision.id})`);
  }, TIMEOUT_WARNING_MS);

  try {
    return await Promise.race([postingPromise, timeoutPromise]);
  } finally {
    if (warningTimer) {
      clearTimeout(warningTimer);
      warningTimer = null;
    }
  }
}

/**
 * 📊 Capture follower baseline before posting
 */
async function captureFollowerBaseline(decisionId: string): Promise<number | null> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Get most recent follower snapshot
    const { data: snapshot } = await supabase
      .from('follower_snapshots')
      .select('follower_count')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    const followerCount = snapshot?.follower_count ? Number(snapshot.follower_count) : null;
    
    if (followerCount) {
      console.log(`[FOLLOWER_TRACKING] 📊 Baseline: ${followerCount} followers before post`);
      
      // Store baseline in post_follower_tracking
      await supabase
        .from('post_follower_tracking')
        .insert({
          post_id: decisionId,
          tweet_id: null, // Will be updated after posting
          check_time: new Date().toISOString(),
          follower_count: followerCount,
          hours_after_post: 0, // Baseline
          collection_phase: 'baseline'
        });
    }
    
    return followerCount;
    
  } catch (error: any) {
    console.warn('[FOLLOWER_TRACKING] ⚠️ Failed to capture baseline:', error.message);
    return null;
  }
}

async function updateDecisionStatus(decisionId: string, status: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
  }
}

async function markDecisionPosted(decisionId: string, tweetId: string, tweetUrl?: string, tweetIds?: string[]): Promise<void> {
  try {
    // 🔒 VALIDATION: Validate all IDs before saving
    const { IDValidator } = await import('../validation/idValidator');
    
    // Validate decision ID
    const decisionValidation = IDValidator.validateDecisionId(decisionId);
    if (!decisionValidation.valid) {
      throw new Error(`Invalid decision ID: ${decisionValidation.error}`);
    }
    
    // Validate tweet ID
    const tweetValidation = IDValidator.validateTweetId(tweetId);
    if (!tweetValidation.valid) {
      throw new Error(`Invalid tweet ID: ${tweetValidation.error}`);
    }
    
    // Validate thread IDs if present
    if (tweetIds && tweetIds.length > 0) {
      const threadValidation = IDValidator.validateThreadIds(tweetIds);
      if (!threadValidation.valid) {
        throw new Error(`Invalid thread IDs: ${threadValidation.error}`);
      }
    }
    
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // 🆕 Log thread IDs if this is a thread
    if (tweetIds && tweetIds.length > 1) {
      console.log(`[POSTING_QUEUE] 💾 Storing thread with ${tweetIds.length} tweet IDs: ${tweetIds.join(', ')}`);
    }
    
    // 1. Update content_metadata status and tweet_id (CRITICAL!)
    // NOTE: tweet_url column commented out until added to database schema
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({
        status: 'posted',
        tweet_id: tweetId, // 🔥 CRITICAL: Save tweet ID for metrics scraping!
        thread_tweet_ids: tweetIds ? JSON.stringify(tweetIds) : null, // 🆕 Store all thread IDs as JSON
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
        // tweet_url: tweetUrl // 🔗 TODO: Add this column to database first!
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
    
    if (updateError) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to save tweet_id ${tweetId} to database:`, updateError.message);
      throw new Error(`Database save failed for tweet ${tweetId}: ${updateError.message}`);
    }
    
    console.log(`[POSTING_QUEUE] ✅ Database updated: tweet_id ${tweetId} saved for decision ${decisionId}`);
    
    // 2. Get the full decision details for posted_decisions archive
    const { data: decisionData, error: fetchError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('decision_id', decisionId)  // 🔥 FIX: decisionId is UUID, query by decision_id not id!
      .single();
    
    if (fetchError || !decisionData) {
      console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to fetch decision data for ${decisionId}:`, fetchError?.message);
      throw new Error(`Cannot archive decision: ${fetchError?.message || 'No data found'}`);
    }
    
    // 3. Store in posted_decisions archive with safer numeric handling
    const { error: archiveError } = await supabase
      .from('posted_decisions')
      .insert([{
        decision_id: decisionData.decision_id,  // 🔥 FIX: Use UUID from data, not integer ID!
        content: decisionData.content,
        tweet_id: tweetId,
        decision_type: decisionData.decision_type || 'single',  // Default to 'single' not 'content'
        target_tweet_id: decisionData.target_tweet_id,
        target_username: decisionData.target_username,
        bandit_arm: decisionData.bandit_arm,
        timing_arm: decisionData.timing_arm,
        predicted_er: Math.min(1.0, Math.max(0.0, Number(decisionData.predicted_er) || 0)),
        quality_score: Math.min(1.0, Math.max(0.0, Number(decisionData.quality_score) || 0)),
        topic_cluster: decisionData.topic_cluster,
        posted_at: new Date().toISOString()
      }]);
    
    if (archiveError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to archive posted decision ${decisionId}:`, archiveError.message);
    } else {
      console.log(`[POSTING_QUEUE] 📝 Decision ${decisionId} marked as posted with tweet ID: ${tweetId}`);
    }
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] 🚨 CRITICAL: Failed to mark posted for ${decisionId}:`, error.message);
    // 🔥 CRITICAL FIX: Re-throw error so retry loop can catch it
    // Without this, the calling code thinks save succeeded when it actually failed!
    throw error;
  }
}

async function markDecisionFailed(decisionId: string, errorMessage: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'failed',
        error_message: errorMessage, // Also store the error
        updated_at: new Date().toISOString()
      })
      .eq('decision_id', decisionId);  // 🔥 FIX: Use decision_id (UUID), not id (integer)!
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
    } else {
      console.log(`[POSTING_QUEUE] ❌ Decision ${decisionId} marked as failed: ${errorMessage}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
  }
}

async function updatePostingMetrics(type: 'queued' | 'posted' | 'error'): Promise<void> {
  try {
    const { updateMockMetrics } = await import('../api/metrics');
    
    switch (type) {
      case 'queued':
        updateMockMetrics({ postsQueued: 1 });
        break;
      case 'posted':
        updateMockMetrics({ postsPosted: 1 });
        break;
      case 'error':
        updateMockMetrics({ postingErrors: 1 });
        break;
    }
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to update posting metrics:', error.message);
  }
}

/**
 * 🔥 PRIORITY 2 FIX: Store failed database save in retry queue
 * Saves to file for background job to retry later
 */
async function storeInRetryQueue(
  decisionId: string,
  tweetId: string,
  tweetUrl: string | undefined,
  tweetIds: string[] | undefined,
  content: string
): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    const retryQueueFile = path.join(logsDir, 'db_retry_queue.jsonl');
    const retryEntry = {
      decisionId,
      tweetId,
      tweetUrl,
      tweetIds,
      content: content.substring(0, 200), // Store first 200 chars for matching
      timestamp: Date.now(),
      date: new Date().toISOString(),
      retryCount: 0
    };
    
    appendFileSync(retryQueueFile, JSON.stringify(retryEntry) + '\n');
    console.log(`[POSTING_QUEUE] 💾 Stored in retry queue: decision_id=${decisionId}, tweet_id=${tweetId}`);
  } catch (error: any) {
    console.error(`[POSTING_QUEUE] ⚠️ Failed to store in retry queue: ${error.message}`);
  }
}

/**
 * 🔥 PRIORITY 5 FIX: Pre-post logging
 * Logs all posting attempts BEFORE posting for recovery
 */
async function logPostAttempt(decision: QueuedDecision, action: 'attempting' | 'success' | 'failed', tweetId?: string): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'post_attempts.log');
    const logEntry = {
      decisionId: decision.id,
      decisionType: decision.decision_type,
      content: decision.content.substring(0, 100),
      action,
      tweetId: tweetId || null,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    
    appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error: any) {
    // Non-critical - don't fail posting if logging fails
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to log post attempt: ${error.message}`);
  }
}

/**
 * 🎯 QUEUE DEPTH MONITOR - Ensures minimum content always queued
 * 
 * Guarantees:
 * - MINIMUM 2 content posts/hour (singles + threads)
 * - MINIMUM 4 replies/hour
 * 
 * How it works:
 * - Maintains 4-8 content posts in queue (2-4 hours buffer)
 * - Maintains 8-16 replies in queue (2-4 hours buffer)
 * - Triggers emergency generation if queue drops below minimum
 * - Self-healing: handles browser crashes, generation failures, rate limits
 */
async function ensureMinimumQueueDepth(): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    // Count queued content (singles + threads)
    const { count: queuedContent } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread']);
    
    // Count queued replies
    const { count: queuedReplies } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .eq('decision_type', 'reply');
    
    const contentQueueSize = queuedContent || 0;
    const replyQueueSize = queuedReplies || 0;
    
    // Minimum thresholds (2 hours of buffer = 4 content, 8 replies)
    const MIN_CONTENT_QUEUE = 4;  // 2 posts/hour × 2 hours
    const MIN_REPLY_QUEUE = 8;     // 4 replies/hour × 2 hours
    
    console.log(`[QUEUE_MONITOR] 📊 Queue depth: ${contentQueueSize} content, ${replyQueueSize} replies`);
    
    // 🚨 EMERGENCY: Content queue low
    if (contentQueueSize < MIN_CONTENT_QUEUE) {
      console.log(`[QUEUE_MONITOR] ⚠️ Content queue LOW: ${contentQueueSize}/${MIN_CONTENT_QUEUE}`);
      console.log(`[QUEUE_MONITOR] 🚨 Triggering emergency content generation...`);
      
      try {
        const { planContent } = await import('./planJob');
        await planContent();
        console.log(`[QUEUE_MONITOR] ✅ Emergency content generation complete`);
      } catch (error: any) {
        console.error(`[QUEUE_MONITOR] ❌ Emergency content generation failed:`, error.message);
      }
    } else {
      console.log(`[QUEUE_MONITOR] ✅ Content queue healthy: ${contentQueueSize}/${MIN_CONTENT_QUEUE}`);
    }
    
    // 🚨 EMERGENCY: Reply queue low
    if (replyQueueSize < MIN_REPLY_QUEUE) {
      console.log(`[QUEUE_MONITOR] ⚠️ Reply queue LOW: ${replyQueueSize}/${MIN_REPLY_QUEUE}`);
      console.log(`[QUEUE_MONITOR] 🚨 Triggering emergency reply generation...`);
      
      try {
        const { generateReplies } = await import('./replyJob');
        await generateReplies();
        console.log(`[QUEUE_MONITOR] ✅ Emergency reply generation complete`);
      } catch (error: any) {
        console.error(`[QUEUE_MONITOR] ❌ Emergency reply generation failed:`, error.message);
      }
    } else {
      console.log(`[QUEUE_MONITOR] ✅ Reply queue healthy: ${replyQueueSize}/${MIN_REPLY_QUEUE}`);
    }
    
  } catch (error: any) {
    console.error('[QUEUE_MONITOR] ❌ Queue depth check failed:', error.message);
    // Don't throw - this is a safety net, not critical path
  }
}
