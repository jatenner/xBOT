/**
 * 🚧 REPLY KIND GUARD - Enforce lane separation between replies and threads
 * 
 * Rules:
 * 1. If target_tweet_id exists => must be kind="reply"
 * 2. If content has thread markers => must NOT be posted as reply
 * 3. Fail closed if kind mismatch
 */

export interface KindGuardResult {
  pass: boolean;
  reason: string;
  kind: string;
  target: string | null;
}

const THREAD_MARKERS = [
  /\b\d+\/\d+\b/,           // "1/5", "2/6"
  /\bPROTOCOL:/i,           // "PROTOCOL:"
  /\bTIP:/i,                // "TIP:"
  /\bTHREAD\b/i,            // "THREAD"
  /🧵/,                      // Thread emoji
  /\(\d+\)/,                // "(1)", "(2)"
];

/**
 * Check if content contains thread markers
 */
export function hasThreadMarkers(content: string): boolean {
  return THREAD_MARKERS.some(pattern => pattern.test(content));
}

/**
 * Enforce kind contract for replies
 */
export function checkReplyKindGuard(
  content: string,
  targetTweetId: string | null,
  kind: string | null
): KindGuardResult {
  // Rule 1: If target exists, kind must be "reply"
  if (targetTweetId && kind !== 'reply') {
    console.log(`[REPLY_KIND_GUARD] pass=false kind=${kind || 'null'} target=${targetTweetId} reason=kind_mismatch_expected_reply`);
    return {
      pass: false,
      reason: 'kind_mismatch_expected_reply',
      kind: kind || 'null',
      target: targetTweetId
    };
  }
  
  // Rule 2: If content has thread markers, must NOT be reply
  if (targetTweetId && hasThreadMarkers(content)) {
    const matchedPatterns = THREAD_MARKERS
      .filter(pattern => pattern.test(content))
      .map(pattern => pattern.source)
      .join(', ');
    
    console.log(`[REPLY_KIND_GUARD] pass=false kind=${kind} target=${targetTweetId} reason=thread_markers_in_reply markers="${matchedPatterns}"`);
    return {
      pass: false,
      reason: 'thread_markers_in_reply',
      kind: kind || 'null',
      target: targetTweetId
    };
  }
  
  // Rule 3: If no target, should NOT be marked as reply
  if (!targetTweetId && kind === 'reply') {
    console.log(`[REPLY_KIND_GUARD] pass=false kind=reply target=null reason=reply_without_target`);
    return {
      pass: false,
      reason: 'reply_without_target',
      kind: kind || 'null',
      target: null
    };
  }
  
  // All checks passed
  console.log(`[REPLY_KIND_GUARD] pass=true kind=${kind} target=${targetTweetId?.substring(0, 15) || 'null'} reason=ok`);
  return {
    pass: true,
    reason: 'ok',
    kind: kind || 'null',
    target: targetTweetId
  };
}

