/**
 * 🔒 ID VALIDATION SYSTEM
 * 
 * Comprehensive validation for all IDs in the system:
 * - Tweet IDs (must be numeric)
 * - Reply IDs (must be numeric, different from parent)
 * - Decision IDs (must be UUIDs)
 * 
 * Prevents invalid IDs from causing database issues.
 */

export class IDValidator {
  /**
   * Validate Twitter tweet ID
   * Twitter IDs are numeric strings (can be very large)
   */
  static validateTweetId(tweetId: string | null | undefined): {
    valid: boolean;
    error?: string;
  } {
    if (!tweetId) {
      return { valid: false, error: 'Tweet ID is null or undefined' };
    }
    
    if (typeof tweetId !== 'string') {
      return { valid: false, error: `Tweet ID must be string, got ${typeof tweetId}` };
    }
    
    // Twitter IDs are numeric (can be very large, so use regex)
    if (!/^\d+$/.test(tweetId)) {
      return { valid: false, error: `Invalid tweet ID format: ${tweetId} (must be numeric)` };
    }
    
    // Check for placeholder IDs
    const invalidPrefixes = ['reply_posted_', 'posted_', 'unknown', 'error', 'null', 'undefined'];
    if (invalidPrefixes.some(prefix => tweetId.toLowerCase().startsWith(prefix))) {
      return { valid: false, error: `Tweet ID appears to be placeholder: ${tweetId}` };
    }
    
    // Check minimum length (Twitter IDs are at least 10 digits)
    if (tweetId.length < 10) {
      return { valid: false, error: `Tweet ID too short: ${tweetId} (minimum 10 digits)` };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate reply ID (must be different from parent)
   */
  static validateReplyId(
    replyId: string | null | undefined,
    parentTweetId: string | null | undefined
  ): {
    valid: boolean;
    error?: string;
  } {
    const tweetValidation = this.validateTweetId(replyId);
    if (!tweetValidation.valid) {
      return tweetValidation;
    }
    
    if (parentTweetId && replyId === parentTweetId) {
      return {
        valid: false,
        error: `Reply ID cannot be same as parent: ${replyId}`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate decision ID (must be UUID)
   */
  static validateDecisionId(decisionId: string | null | undefined): {
    valid: boolean;
    error?: string;
  } {
    if (!decisionId) {
      return { valid: false, error: 'Decision ID is null or undefined' };
    }
    
    if (typeof decisionId !== 'string') {
      return { valid: false, error: `Decision ID must be string, got ${typeof decisionId}` };
    }
    
    // UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(decisionId)) {
      return { valid: false, error: `Invalid decision ID format: ${decisionId} (must be UUID)` };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate thread tweet IDs array
   */
  static validateThreadIds(tweetIds: string[] | null | undefined): {
    valid: boolean;
    error?: string;
    invalidIds?: string[];
  } {
    if (!tweetIds || tweetIds.length === 0) {
      return { valid: false, error: 'Thread IDs array is empty' };
    }
    
    const invalidIds: string[] = [];
    for (const id of tweetIds) {
      const validation = this.validateTweetId(id);
      if (!validation.valid) {
        invalidIds.push(id);
      }
    }
    
    if (invalidIds.length > 0) {
      return {
        valid: false,
        error: `Invalid thread IDs: ${invalidIds.join(', ')}`,
        invalidIds
      };
    }
    
    // Check for duplicates
    const uniqueIds = new Set(tweetIds);
    if (uniqueIds.size !== tweetIds.length) {
      return { valid: false, error: 'Duplicate IDs in thread array' };
    }
    
    return { valid: true };
  }
  
  /**
   * Sanitize and validate tweet ID (removes whitespace, validates)
   */
  static sanitizeTweetId(tweetId: string | null | undefined): string | null {
    if (!tweetId) return null;
    
    const trimmed = String(tweetId).trim();
    const validation = this.validateTweetId(trimmed);
    
    if (!validation.valid) {
      console.warn(`[ID_VALIDATOR] ⚠️ Invalid tweet ID sanitized: ${tweetId} -> null (${validation.error})`);
      return null;
    }
    
    return trimmed;
  }
}

