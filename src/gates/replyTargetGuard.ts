/**
 * 🎯 REPLY TARGET GUARD - Final step enforcement before queueing
 * 
 * Rules:
 * 1. Target must be root tweet (not a reply)
 * 2. Target must be fresh (<= 180 minutes old)
 * 3. Root tweet text must have sufficient context (>= 40 chars)
 * 
 * Fail closed if any rule fails
 */

export interface TargetGuardResult {
  pass: boolean;
  reason: string;
  targetAge?: number;
  contextLength?: number;
}

const MAX_TARGET_AGE_MINUTES = 180; // 3 hours
const MIN_CONTEXT_LENGTH = 30; // Lowered from 40 to allow shorter tweets

/**
 * Check if tweet content suggests it's a reply
 */
export function isReplyTweetContent(content: string): boolean {
  const trimmed = content.trim();
  
  // Starts with @ mention (likely a reply)
  if (trimmed.startsWith('@')) {
    return true;
  }
  
  // Contains "Replying to @" or "replying to @"
  if (/replying to @/i.test(content)) {
    return true;
  }
  
  return false;
}

/**
 * Check target tweet is root + fresh + has context
 */
export function checkReplyTargetGuard(
  targetTweetId: string,
  targetContent: string,
  targetPostedAt: string | null,
  isReplyTweet: boolean | null
): TargetGuardResult {
  // Rule 1: Target must be root (not a reply)
  if (isReplyTweet === true) {
    console.log(`[REPLY_TARGET_GUARD] pass=false reason=target_is_reply tweet_id=${targetTweetId} root_id=N/A`);
    return {
      pass: false,
      reason: 'target_is_reply'
    };
  }
  
  // Also check content for reply markers
  if (isReplyTweetContent(targetContent)) {
    console.log(`[REPLY_TARGET_GUARD] pass=false reason=target_content_is_reply tweet_id=${targetTweetId} content_starts_with_at=true`);
    return {
      pass: false,
      reason: 'target_content_is_reply'
    };
  }
  
  // Rule 2: Target must be fresh
  if (targetPostedAt) {
    const targetTime = new Date(targetPostedAt).getTime();
    const now = Date.now();
    const ageMinutes = (now - targetTime) / (60 * 1000);
    
    if (ageMinutes > MAX_TARGET_AGE_MINUTES) {
      console.log(`[REPLY_TARGET_GUARD] pass=false reason=too_old age_min=${Math.round(ageMinutes)} max=${MAX_TARGET_AGE_MINUTES}`);
      return {
        pass: false,
        reason: 'too_old',
        targetAge: Math.round(ageMinutes)
      };
    }
  }
  
  // Rule 3: Target must have sufficient context
  const contextLength = (targetContent || '').length;
  if (contextLength < MIN_CONTEXT_LENGTH) {
    console.log(`[REPLY_CONTEXT_FETCH] root_len=${contextLength} source=api pass=false reason=insufficient_context min=${MIN_CONTEXT_LENGTH}`);
    return {
      pass: false,
      reason: 'insufficient_context',
      contextLength
    };
  }
  
  // All checks passed
  const targetAge = targetPostedAt 
    ? Math.round((Date.now() - new Date(targetPostedAt).getTime()) / (60 * 1000))
    : undefined;
  
  console.log(`[REPLY_TARGET_GUARD] pass=true tweet_id=${targetTweetId} age_min=${targetAge || 'N/A'} context_len=${contextLength}`);
  return {
    pass: true,
    reason: 'ok',
    targetAge,
    contextLength
  };
}

