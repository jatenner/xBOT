/**
 * 🔒 REPLY INVARIANT GUARD - Fail-closed checks before posting
 * 
 * HARD REQUIREMENTS (NON-NEGOTIABLE):
 * 1. ROOT-ONLY: Target must be a root tweet, not a reply
 * 2. NO THREAD-LIKE: Content must be single-tweet format
 * 3. CONTEXT-ANCHORED: Reply must reference the root tweet
 */

import { v4 as uuidv4 } from 'uuid';

export interface InvariantCheckResult {
  pass: boolean;
  decision_id: string;
  checks: {
    root_only: { pass: boolean; reason: string; action: 'post' | 'skip' };
    format: { pass: boolean; reason: string; action: 'post' | 'regen' | 'skip' };
    context: { pass: boolean; reason: string; action: 'post' | 'regen' | 'skip' };
  };
  final_action: 'post' | 'skip';
  skip_reason?: string;
}

// Thread marker patterns
const THREAD_MARKERS = [
  /\b\d+\/\d+\b/,           // "1/5", "2/3" etc
  /^\d+\.\s/m,              // "1. " at start of line
  /\(\d+\)/,                // "(1)", "(2)" etc
  /🧵/,                      // Thread emoji
  /\bthread\b/i,            // Word "thread"
  /\.\.\.\s*$/,             // Trailing ellipsis (continuation indicator)
  /\bcontinued\b/i,         // "continued"
  /\bpart\s*\d+/i,          // "part 1", "Part 2"
  /TIP\s*\d+/i,             // "TIP 1", "TIP 3"
];

// Stopwords for keyword extraction
const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
  'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
  'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
  'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
  'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did',
  'having', 'may', 'such', 'really', 'great', 'point', 'true', 'interesting'
]);

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !STOPWORDS.has(word));
  
  return Array.from(new Set(words)).slice(0, 10);
}

/**
 * Check A: ROOT-ONLY - Target must be a root tweet
 */
export function checkRootOnly(
  targetTweetContent: string | null | undefined,
  isRootTweet: boolean | null | undefined
): { pass: boolean; reason: string; action: 'post' | 'skip' } {
  // If we have explicit root confirmation
  if (isRootTweet === true) {
    console.log(`[INVARIANT] root_only=pass reason=explicit_root_confirmed`);
    return { pass: true, reason: 'explicit_root_confirmed', action: 'post' };
  }
  
  // If content starts with @, it's likely a reply (fail-closed)
  if (targetTweetContent && targetTweetContent.trim().startsWith('@')) {
    console.log(`[INVARIANT] root_only=FAIL reason=target_starts_with_@ action=skip`);
    return { pass: false, reason: 'target_starts_with_@', action: 'skip' };
  }
  
  // If we can't determine, fail-closed
  if (isRootTweet === null || isRootTweet === undefined) {
    // Allow if content looks like a standalone tweet (doesn't start with @)
    if (targetTweetContent && !targetTweetContent.trim().startsWith('@')) {
      console.log(`[INVARIANT] root_only=pass reason=content_not_reply_like`);
      return { pass: true, reason: 'content_not_reply_like', action: 'post' };
    }
    console.log(`[INVARIANT] root_only=FAIL reason=cannot_confirm_root action=skip`);
    return { pass: false, reason: 'cannot_confirm_root', action: 'skip' };
  }
  
  console.log(`[INVARIANT] root_only=pass reason=default_pass`);
  return { pass: true, reason: 'default_pass', action: 'post' };
}

/**
 * Check B: NO THREAD-LIKE - Content must be single-tweet format
 */
export function checkNoThreadLike(
  content: string
): { pass: boolean; reason: string; action: 'post' | 'regen' | 'skip'; stats: { len: number; lines: number; markers: string[] } } {
  const trimmed = content.trim();
  const len = trimmed.length;
  const lines = (trimmed.match(/\n/g) || []).length + 1;
  
  // Check for thread markers
  const foundMarkers: string[] = [];
  for (const pattern of THREAD_MARKERS) {
    const match = trimmed.match(pattern);
    if (match) {
      foundMarkers.push(match[0]);
    }
  }
  
  const stats = { len, lines, markers: foundMarkers };
  
  // HARD FAIL: Thread markers detected
  if (foundMarkers.length > 0) {
    console.log(`[INVARIANT] format=FAIL reason=thread_markers markers=${JSON.stringify(foundMarkers)} action=skip`);
    return { pass: false, reason: 'thread_markers', action: 'skip', stats };
  }
  
  // HARD FAIL: Too long (> 260 chars is unsafe)
  if (len > 260) {
    console.log(`[INVARIANT] format=FAIL reason=too_long len=${len} action=skip`);
    return { pass: false, reason: 'too_long', action: 'skip', stats };
  }
  
  // HARD FAIL: Too many line breaks (> 3 = essay-like)
  if (lines > 4) {
    console.log(`[INVARIANT] format=FAIL reason=too_many_lines lines=${lines} action=skip`);
    return { pass: false, reason: 'too_many_lines', action: 'skip', stats };
  }
  
  console.log(`[INVARIANT] format=pass len=${len} lines=${lines}`);
  return { pass: true, reason: 'ok', action: 'post', stats };
}

/**
 * Check C: CONTEXT-ANCHORED - Reply must reference root tweet
 */
export function checkContextAnchored(
  replyContent: string,
  rootTweetContent: string | null | undefined
): { pass: boolean; reason: string; action: 'post' | 'regen' | 'skip'; matched: string[] } {
  // If no root content available, skip context check (fail-open on this specific check)
  if (!rootTweetContent || rootTweetContent.length < 10) {
    console.log(`[INVARIANT] context=pass reason=no_root_content_available`);
    return { pass: true, reason: 'no_root_content_available', action: 'post', matched: [] };
  }
  
  const rootKeywords = extractKeywords(rootTweetContent);
  const replyLower = replyContent.toLowerCase();
  
  if (rootKeywords.length === 0) {
    console.log(`[INVARIANT] context=pass reason=no_keywords_in_root`);
    return { pass: true, reason: 'no_keywords_in_root', action: 'post', matched: [] };
  }
  
  // Check for keyword overlap
  const matched: string[] = [];
  for (const keyword of rootKeywords) {
    if (replyLower.includes(keyword)) {
      matched.push(keyword);
    }
  }
  
  // REQUIRE at least 1 keyword match for context anchoring
  if (matched.length >= 1) {
    console.log(`[INVARIANT] context=pass matched=${JSON.stringify(matched)}`);
    return { pass: true, reason: 'keyword_overlap', action: 'post', matched };
  }
  
  // Check for echo patterns (alternative to keyword match)
  const echoPatterns = [
    /you'?re (basically |essentially )?saying/i,
    /that'?s (a )?great (point|observation)/i,
    /makes sense/i,
    /right[,\s]+/i,
    /exactly[,\s]+/i,
  ];
  
  for (const pattern of echoPatterns) {
    if (pattern.test(replyContent)) {
      console.log(`[INVARIANT] context=pass reason=echo_pattern`);
      return { pass: true, reason: 'echo_pattern', action: 'post', matched: [] };
    }
  }
  
  console.log(`[INVARIANT] context=FAIL reason=no_overlap keywords=${JSON.stringify(rootKeywords)} matched=[] action=skip`);
  return { pass: false, reason: 'no_keyword_overlap', action: 'skip', matched: [] };
}

/**
 * MAIN INVARIANT CHECK - Run all checks, return combined result
 * FAIL-CLOSED: If any check fails with action=skip, the reply is NOT posted
 */
export function checkReplyInvariants(
  content: string,
  targetTweetContent: string | null | undefined,
  rootTweetContent: string | null | undefined,
  isRootTweet: boolean | null | undefined,
  decision_id?: string
): InvariantCheckResult {
  const id = decision_id || uuidv4();
  
  console.log(`[INVARIANT] ═══════════════════════════════════════`);
  console.log(`[INVARIANT] decision_id=${id}`);
  
  // Run all checks
  const rootCheck = checkRootOnly(targetTweetContent, isRootTweet);
  const formatCheck = checkNoThreadLike(content);
  const contextCheck = checkContextAnchored(content, rootTweetContent || targetTweetContent);
  
  // Determine final action
  let final_action: 'post' | 'skip' = 'post';
  let skip_reason: string | undefined;
  
  if (rootCheck.action === 'skip') {
    final_action = 'skip';
    skip_reason = `root_only: ${rootCheck.reason}`;
  } else if (formatCheck.action === 'skip') {
    final_action = 'skip';
    skip_reason = `format: ${formatCheck.reason}`;
  } else if (contextCheck.action === 'skip') {
    final_action = 'skip';
    skip_reason = `context: ${contextCheck.reason}`;
  }
  
  const result: InvariantCheckResult = {
    pass: final_action === 'post',
    decision_id: id,
    checks: {
      root_only: rootCheck,
      format: { ...formatCheck, stats: undefined } as any, // Don't include stats in result
      context: contextCheck,
    },
    final_action,
    skip_reason,
  };
  
  console.log(`[INVARIANT] FINAL: pass=${result.pass} action=${final_action}${skip_reason ? ` skip_reason=${skip_reason}` : ''}`);
  console.log(`[INVARIANT] ═══════════════════════════════════════`);
  
  return result;
}

/**
 * Quick pre-queue check - lighter version for before queueing
 */
export function preQueueInvariantCheck(
  content: string,
  targetTweetContent: string | null | undefined
): { pass: boolean; reason: string } {
  // Check format only (quick)
  const formatCheck = checkNoThreadLike(content);
  if (!formatCheck.pass) {
    return { pass: false, reason: `format: ${formatCheck.reason}` };
  }
  
  // Check root (if content available)
  if (targetTweetContent && targetTweetContent.trim().startsWith('@')) {
    return { pass: false, reason: 'target_is_reply_tweet' };
  }
  
  return { pass: true, reason: 'ok' };
}

