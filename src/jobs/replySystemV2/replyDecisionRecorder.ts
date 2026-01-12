/**
 * 🔍 FORENSIC PIPELINE: Reply Decision Recorder
 * Records every reply decision (ALLOW/DENY) with ancestry depth and root tweet tracking
 */

import { getSupabaseClient } from '../../db';

export interface ReplyAncestry {
  targetTweetId: string;
  targetInReplyToTweetId: string | null; // What the target tweet is replying to (if any)
  rootTweetId: string | null; // null = cannot determine root (fail-closed)
  ancestryDepth: number | null; // null = uncertain, 0 = root tweet, 1+ = reply depth
  isRoot: boolean; // true if targetTweetId == rootTweetId AND status=OK
  // 🔒 FAIL-CLOSED: Status and confidence tracking
  status: 'OK' | 'UNCERTAIN' | 'ERROR';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  method: string;
  signals?: {
    replying_to_text: boolean;
    social_context: boolean;
    main_article_reply_indicator: boolean;
    multiple_articles: boolean;
    verification_passed: boolean;
  };
  error?: string;
}

export interface ReplyDecisionRecord {
  decision_id?: string; // Optional link to content_metadata
  target_tweet_id: string;
  target_in_reply_to_tweet_id?: string | null;
  root_tweet_id: string;
  ancestry_depth: number;
  is_root: boolean;
  decision: 'ALLOW' | 'DENY';
  reason?: string;
  trace_id?: string; // feed_run_id, scheduler_run_id, etc.
  job_run_id?: string;
  pipeline_source?: string;
  playwright_post_attempted?: boolean;
  posted_reply_tweet_id?: string;
  error?: string;
}

/**
 * Resolve tweet ancestry: compute root tweet ID and depth
 * Cap depth at 10 to prevent infinite loops
 * 🔒 FAIL-CLOSED: Returns UNCERTAIN/ERROR status when resolution fails
 */
export async function resolveTweetAncestry(targetTweetId: string): Promise<ReplyAncestry> {
  const { resolveRootTweetId } = await import('../../utils/resolveRootTweet');
  const pool = (await import('../../browser/UnifiedBrowserPool')).UnifiedBrowserPool.getInstance();
  
  let currentTweetId = targetTweetId;
  let depth = 0;
  const MAX_DEPTH = 10;
  const visited = new Set<string>();
  let targetInReplyToTweetId: string | null = null;
  let lastResolution: any = null;
  
  while (depth < MAX_DEPTH) {
    if (visited.has(currentTweetId)) {
      console.warn(`[ANCESTRY] ⚠️ Circular reference detected at ${currentTweetId}, stopping`);
      return {
        targetTweetId,
        targetInReplyToTweetId,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'ERROR',
        confidence: 'LOW',
        method: 'circular_reference',
        error: `Circular reference detected at ${currentTweetId}`,
      };
    }
    visited.add(currentTweetId);
    
    try {
      const resolution = await resolveRootTweetId(currentTweetId);
      lastResolution = resolution;
      
      // 🔒 FAIL-CLOSED: If resolution is UNCERTAIN or ERROR, propagate it
      if (resolution.status === 'UNCERTAIN' || resolution.status === 'ERROR') {
        console.warn(`[ANCESTRY] ⚠️ Resolution ${resolution.status} for ${currentTweetId} - FAIL-CLOSED`);
        return {
          targetTweetId,
          targetInReplyToTweetId: depth === 0 ? null : currentTweetId,
          rootTweetId: null,
          ancestryDepth: null,
          isRoot: false,
          status: resolution.status,
          confidence: resolution.confidence,
          method: resolution.method,
          signals: resolution.signals,
          error: resolution.error,
        };
      }
      
      if (resolution.isRootTweet && resolution.status === 'OK') {
        // Found root with OK status
        return {
          targetTweetId,
          targetInReplyToTweetId: depth === 0 ? null : currentTweetId,
          rootTweetId: resolution.rootTweetId || currentTweetId,
          ancestryDepth: depth,
          isRoot: depth === 0,
          status: 'OK',
          confidence: resolution.confidence,
          method: resolution.method,
          signals: resolution.signals,
        };
      }
      
      // This is a reply, get the parent
      if (resolution.rootTweetId && resolution.rootTweetId !== currentTweetId && resolution.status === 'OK') {
        if (depth === 0) {
          targetInReplyToTweetId = currentTweetId;
        }
        depth++;
        currentTweetId = resolution.rootTweetId;
        continue;
      }
      
      // Could not resolve further - UNCERTAIN
      console.warn(`[ANCESTRY] ⚠️ Could not resolve parent for ${currentTweetId}`);
      return {
        targetTweetId,
        targetInReplyToTweetId,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'UNCERTAIN',
        confidence: 'LOW',
        method: 'incomplete_resolution',
        error: `Could not resolve parent for ${currentTweetId}`,
      };
    } catch (error: any) {
      console.error(`[ANCESTRY] ❌ Error resolving ancestry for ${currentTweetId}:`, error.message);
      return {
        targetTweetId,
        targetInReplyToTweetId,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'ERROR',
        confidence: 'LOW',
        method: 'exception',
        error: error.message,
      };
    }
  }
  
  // Hit MAX_DEPTH - UNCERTAIN
  console.warn(`[ANCESTRY] ⚠️ Hit MAX_DEPTH (${MAX_DEPTH}) - UNCERTAIN`);
  return {
    targetTweetId,
    targetInReplyToTweetId,
    rootTweetId: null,
    ancestryDepth: null,
    isRoot: false,
    status: 'UNCERTAIN',
    confidence: 'LOW',
    method: 'max_depth_reached',
    error: `Hit MAX_DEPTH (${MAX_DEPTH}) without finding root`,
  };
}

/**
 * Record a reply decision in the forensic pipeline
 */
export async function recordReplyDecision(record: ReplyDecisionRecord): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.from('reply_decisions').insert({
      decision_id: record.decision_id || null,
      target_tweet_id: record.target_tweet_id,
      target_in_reply_to_tweet_id: record.target_in_reply_to_tweet_id || null,
      root_tweet_id: record.root_tweet_id || 'null', // Store 'null' string if null
      ancestry_depth: record.ancestry_depth ?? -1, // Use -1 for null depth (DB constraint requires int)
      is_root: record.is_root,
      decision: record.decision,
      reason: record.reason || null,
      trace_id: record.trace_id || null,
      job_run_id: record.job_run_id || null,
      pipeline_source: record.pipeline_source || null,
      playwright_post_attempted: record.playwright_post_attempted || false,
      posted_reply_tweet_id: record.posted_reply_tweet_id || null,
      error: record.error || null,
      build_sha: process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    });
    
    if (error) {
      console.error(`[REPLY_DECISION] ❌ Failed to record decision: ${error.message}`);
    } else {
      console.log(`[REPLY_DECISION] ✅ Recorded: ${record.decision} for ${record.target_tweet_id} (depth=${record.ancestry_depth}, root=${record.is_root})`);
    }
  } catch (error: any) {
    console.error(`[REPLY_DECISION] ❌ Error recording decision: ${error.message}`);
  }
}

/**
 * Check if reply should be allowed based on ancestry
 * 🔒 FAIL-CLOSED: Only allow when status=OK AND depth===0
 * All other cases (UNCERTAIN, ERROR, depth>=1) result in DENY
 */
export function shouldAllowReply(ancestry: ReplyAncestry): { allow: boolean; reason: string } {
  // 🔒 FAIL-CLOSED: Must have OK status
  if (ancestry.status !== 'OK') {
    const statusReason = ancestry.status === 'UNCERTAIN' 
      ? 'ANCESTRY_UNCERTAIN_FAIL_CLOSED'
      : 'ANCESTRY_ERROR_FAIL_CLOSED';
    return {
      allow: false,
      reason: `${statusReason}: status=${ancestry.status}, target=${ancestry.targetTweetId}, method=${ancestry.method}${ancestry.error ? `, error=${ancestry.error}` : ''}`,
    };
  }
  
  // 🔒 FAIL-CLOSED: Depth must be exactly 0 (root tweet)
  if (ancestry.ancestryDepth === null || ancestry.ancestryDepth !== 0) {
    return {
      allow: false,
      reason: `Non-root reply blocked: depth=${ancestry.ancestryDepth ?? 'null'}, target=${ancestry.targetTweetId}, root=${ancestry.rootTweetId || 'null'}`,
    };
  }
  
  // 🔒 FAIL-CLOSED: Must be confirmed root
  if (!ancestry.isRoot) {
    return {
      allow: false,
      reason: `Target tweet is not root: target=${ancestry.targetTweetId}, root=${ancestry.rootTweetId || 'null'}`,
    };
  }
  
  // ✅ ALLOW: status=OK, depth=0, isRoot=true
  return {
    allow: true,
    reason: `Root tweet allowed: target=${ancestry.targetTweetId}, status=${ancestry.status}, confidence=${ancestry.confidence}`,
  };
}
