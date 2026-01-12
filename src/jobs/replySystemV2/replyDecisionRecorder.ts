/**
 * 🔍 FORENSIC PIPELINE: Reply Decision Recorder
 * Records every reply decision (ALLOW/DENY) with ancestry depth and root tweet tracking
 */

import { getSupabaseClient } from '../../db';

export interface ReplyAncestry {
  targetTweetId: string;
  targetInReplyToTweetId: string | null; // What the target tweet is replying to (if any)
  rootTweetId: string;
  ancestryDepth: number; // 0 = root tweet, 1+ = reply depth
  isRoot: boolean; // true if targetTweetId == rootTweetId
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
 */
export async function resolveTweetAncestry(targetTweetId: string): Promise<ReplyAncestry> {
  const { resolveRootTweetId } = await import('../../utils/resolveRootTweet');
  const pool = (await import('../../browser/UnifiedBrowserPool')).UnifiedBrowserPool.getInstance();
  
  let currentTweetId = targetTweetId;
  let depth = 0;
  const MAX_DEPTH = 10;
  const visited = new Set<string>();
  let targetInReplyToTweetId: string | null = null;
  
  while (depth < MAX_DEPTH) {
    if (visited.has(currentTweetId)) {
      console.warn(`[ANCESTRY] ⚠️ Circular reference detected at ${currentTweetId}, stopping`);
      break;
    }
    visited.add(currentTweetId);
    
    try {
      const resolution = await resolveRootTweetId(currentTweetId);
      
      if (resolution.isRootTweet) {
        // Found root
        return {
          targetTweetId,
          targetInReplyToTweetId: depth === 0 ? null : currentTweetId, // Only set if we traversed
          rootTweetId: resolution.rootTweetId || currentTweetId,
          ancestryDepth: depth,
          isRoot: depth === 0,
        };
      }
      
      // This is a reply, get the parent
      if (resolution.rootTweetId && resolution.rootTweetId !== currentTweetId) {
        if (depth === 0) {
          // First level: record what target tweet is replying to
          targetInReplyToTweetId = currentTweetId;
        }
        depth++;
        currentTweetId = resolution.rootTweetId;
        continue;
      }
      
      // Could not resolve further
      console.warn(`[ANCESTRY] ⚠️ Could not resolve parent for ${currentTweetId}`);
      break;
    } catch (error: any) {
      console.error(`[ANCESTRY] ❌ Error resolving ancestry for ${currentTweetId}:`, error.message);
      break;
    }
  }
  
  // Fallback: assume root if we couldn't traverse
  if (depth === 0) {
    return {
      targetTweetId,
      targetInReplyToTweetId: null,
      rootTweetId: targetTweetId,
      ancestryDepth: 0,
      isRoot: true,
    };
  }
  
  // Return what we found (may not be true root if we hit MAX_DEPTH)
  return {
    targetTweetId,
    targetInReplyToTweetId,
    rootTweetId: currentTweetId,
    ancestryDepth: depth,
    isRoot: false,
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
      root_tweet_id: record.root_tweet_id,
      ancestry_depth: record.ancestry_depth,
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
 * Hard invariant: Only allow replies to root tweets (depth === 0)
 */
export function shouldAllowReply(ancestry: ReplyAncestry): { allow: boolean; reason: string } {
  if (ancestry.ancestryDepth !== 0) {
    return {
      allow: false,
      reason: `Non-root reply blocked: depth=${ancestry.ancestryDepth}, target=${ancestry.targetTweetId}, root=${ancestry.rootTweetId}`,
    };
  }
  
  if (!ancestry.isRoot) {
    return {
      allow: false,
      reason: `Target tweet is not root: target=${ancestry.targetTweetId}, root=${ancestry.rootTweetId}`,
    };
  }
  
  return {
    allow: true,
    reason: `Root tweet allowed: target=${ancestry.targetTweetId}`,
  };
}
