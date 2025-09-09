/**
 * 📊 POSTING TYPES
 * Shared types for posting and learning systems
 */

/**
 * Post attempt status for learning loop filtering
 */
export enum PostAttemptStatus {
  /** Successfully posted to X.com with tweet ID/URL */
  PUBLISHED = 'PUBLISHED',
  
  /** Skipped due to business logic (rate limits, scheduling, etc.) */
  SKIPPED = 'SKIPPED',
  
  /** Failed during transport/posting (Playwright, network, etc.) */
  FAILED_TRANSPORT = 'FAILED_TRANSPORT',
  
  /** Blocked by fact-checking or content safety */
  BLOCKED_FACTCHECK = 'BLOCKED_FACTCHECK'
}
