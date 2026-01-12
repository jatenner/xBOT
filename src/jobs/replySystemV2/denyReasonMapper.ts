/**
 * 🎯 ANALYTICS: Map filter reasons to structured deny_reason_code
 */

export type DenyReasonCode = 
  | 'NON_ROOT'
  | 'ANCESTRY_UNCERTAIN'
  | 'ANCESTRY_ERROR'
  | 'ANCESTRY_TIMEOUT'
  | 'ANCESTRY_SKIPPED_OVERLOAD'
  | 'ANCESTRY_PLAYWRIGHT_DROPPED'
  | 'ANCESTRY_NAV_FAIL'
  | 'ANCESTRY_PARSE_FAIL'
  | 'LOW_RELEVANCE'
  | 'LOW_AUTHOR_SIGNAL'
  | 'LOW_QUALITY_SCORE'
  | 'CONSENT_WALL'
  | 'DUPLICATE_TOPIC'
  | 'RATE_LIMITED'
  | 'NO_CANDIDATES'
  | 'OTHER';

/**
 * Map filter_reason string to structured deny_reason_code
 */
export function mapFilterReasonToDenyCode(filterReason: string): DenyReasonCode {
  const reasonLower = filterReason.toLowerCase();
  
  // Safety invariants (never relaxed)
  if (reasonLower.includes('not_root_tweet') || reasonLower.includes('non_root')) {
    return 'NON_ROOT';
  }
  
  // Ancestry failures - specific buckets
  if (reasonLower.includes('ancestry_uncertain') || reasonLower.includes('uncertain')) {
    return 'ANCESTRY_UNCERTAIN';
  }
  
  // Overload skip (new)
  if (reasonLower.includes('skipped') || reasonLower.includes('overload') || reasonLower.includes('skipped_overload')) {
    return 'ANCESTRY_SKIPPED_OVERLOAD';
  }
  
  // Transient errors (can retry)
  if (reasonLower.includes('timeout') || reasonLower.includes('queue timeout') || reasonLower.includes('pool overloaded')) {
    return 'ANCESTRY_TIMEOUT';
  }
  if (reasonLower.includes('dropped') || reasonLower.includes('disconnected') || reasonLower.includes('browser has been closed')) {
    return 'ANCESTRY_PLAYWRIGHT_DROPPED';
  }
  if (reasonLower.includes('navigation') || reasonLower.includes('nav_fail') || reasonLower.includes('goto failed')) {
    return 'ANCESTRY_NAV_FAIL';
  }
  if (reasonLower.includes('parse') || reasonLower.includes('extraction failed') || reasonLower.includes('dom query failed')) {
    return 'ANCESTRY_PARSE_FAIL';
  }
  
  // Generic ancestry error (fallback)
  if (reasonLower.includes('ancestry_error') || reasonLower.includes('error') || reasonLower.includes('method_unknown')) {
    return 'ANCESTRY_ERROR';
  }
  
  // Quality/relevance thresholds (non-safety, can be relaxed)
  if (reasonLower.includes('low_topic_relevance') || reasonLower.includes('relevance') || reasonLower.includes('judge_reject')) {
    return 'LOW_RELEVANCE';
  }
  if (reasonLower.includes('low_author_signal') || reasonLower.includes('author_signal')) {
    return 'LOW_AUTHOR_SIGNAL';
  }
  if (reasonLower.includes('low_quality') || reasonLower.includes('overall_score') || reasonLower.includes('judge_explore')) {
    return 'LOW_QUALITY_SCORE';
  }
  
  // Consent wall
  if (reasonLower.includes('consent_wall') || reasonLower.includes('consent')) {
    return 'CONSENT_WALL';
  }
  
  // Duplicate topic
  if (reasonLower.includes('duplicate') || reasonLower.includes('already_replied')) {
    return 'DUPLICATE_TOPIC';
  }
  
  // Rate limiting
  if (reasonLower.includes('rate_limit') || reasonLower.includes('rate_limited') || reasonLower.includes('too_many_requests')) {
    return 'RATE_LIMITED';
  }
  
  // No candidates
  if (reasonLower.includes('no_candidates') || reasonLower.includes('empty_feed') || reasonLower.includes('no_tweets')) {
    return 'NO_CANDIDATES';
  }
  
  // Default
  return 'OTHER';
}
