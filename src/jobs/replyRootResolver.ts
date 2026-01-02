/**
 * 🎯 REPLY ROOT RESOLVER - Integration Layer
 * Wires root resolution into reply pipeline
 */

import { resolveRootTweetId, looksLikeReply } from '../utils/resolveRootTweet';
import { getSupabaseClient } from '../db';

export interface ResolvedReplyTarget {
  originalCandidateId: string;
  rootTweetId: string;
  rootTweetUrl: string;
  rootTweetAuthor: string | null;
  rootTweetContent: string | null;
  isRootTweet: boolean;
  shouldSkip: boolean;
  skipReason?: string;
}

/**
 * Resolve a reply candidate to its root tweet
 * Returns null if candidate should be skipped
 */
export async function resolveReplyCandidate(
  candidateTweetId: string,
  candidateContent?: string
): Promise<ResolvedReplyTarget | null> {
  console.log(`[REPLY_SELECT] 🔍 Resolving candidate ${candidateTweetId}...`);
  
  // Quick filter: if content starts with @, it's likely a reply
  if (candidateContent && looksLikeReply(candidateContent)) {
    console.log(`[REPLY_SELECT] 🚫 SKIP: Candidate ${candidateTweetId} looks like a reply (starts with @)`);
    return null;
  }
  
  try {
    const resolution = await resolveRootTweetId(candidateTweetId);
    
    if (!resolution.rootTweetId) {
      console.log(`[REPLY_SELECT] ❌ SKIP: Could not resolve root for ${candidateTweetId}`);
      return null;
    }
    
    const resolved: ResolvedReplyTarget = {
      originalCandidateId: candidateTweetId,
      rootTweetId: resolution.rootTweetId,
      rootTweetUrl: resolution.rootTweetUrl,
      rootTweetAuthor: resolution.rootTweetAuthor,
      rootTweetContent: resolution.rootTweetContent,
      isRootTweet: resolution.isRootTweet,
      shouldSkip: false,
    };
    
    if (resolution.isRootTweet) {
      console.log(`[REPLY_SELECT] ✅ Candidate ${candidateTweetId} is already ROOT`);
    } else {
      console.log(`[REPLY_SELECT] ✅ Resolved ${candidateTweetId} → ROOT ${resolution.rootTweetId}`);
    }
    
    return resolved;
  } catch (error: any) {
    console.error(`[REPLY_SELECT] ❌ Error resolving ${candidateTweetId}:`, error.message);
    return null;
  }
}

/**
 * Store root resolution data in reply decision
 */
export async function storeRootResolution(
  decisionId: string,
  resolved: ResolvedReplyTarget
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
      .update({
        root_tweet_id: resolved.rootTweetId,
        original_candidate_tweet_id: resolved.originalCandidateId,
        resolved_via_root: !resolved.isRootTweet,
      })
      .eq('decision_id', decisionId);
    
    if (error) {
      console.error(`[REPLY_SELECT] ⚠️ Failed to store root resolution for ${decisionId}:`, error.message);
    } else {
      console.log(`[REPLY_SELECT] 💾 Stored root resolution: ${decisionId} → ${resolved.rootTweetId}`);
    }
  } catch (error: any) {
    console.error(`[REPLY_SELECT] ⚠️ Error storing root resolution:`, error.message);
  }
}

/**
 * Build reply context using ROOT tweet data
 */
export function buildRootContext(resolved: ResolvedReplyTarget): {
  contextText: string;
  author: string;
  tweetAge: string;
} {
  const author = resolved.rootTweetAuthor || 'unknown';
  const content = resolved.rootTweetContent || '[content unavailable]';
  const contentPreview = content.substring(0, 200);
  
  console.log(`[REPLY_CONTEXT] root_text_len=${content.length} author=@${author}`);
  
  return {
    contextText: contentPreview,
    author,
    tweetAge: 'recent', // Could calculate from timestamp if available
  };
}

