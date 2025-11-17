/**
 * 🔒 METRICS SCRAPER VALIDATION
 * 
 * Ensures metrics scraping only processes posts with valid tweet IDs.
 * Prevents errors and ensures data integrity.
 */

import { getSupabaseClient } from '../db/index';
import { IDValidator } from '../validation/idValidator';
import { log } from '../lib/logger';

/**
 * Validate all posts before metrics scraping
 * Returns only posts with valid tweet IDs
 */
export async function validatePostsForScraping(limit: number = 20): Promise<Array<{
  decision_id: string;
  tweet_id: string;
  content: string;
  posted_at: string;
}>> {
  const supabase = getSupabaseClient();
  
  // Get posts that need metrics scraping
  const { data: posts, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, content, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(limit * 2); // Get extra to filter invalid ones
  
  if (error) {
    console.error('[METRICS_VALIDATION] ❌ Failed to fetch posts:', error.message);
    log({ op: 'metrics_validation_error', error: error.message });
    return [];
  }
  
  if (!posts || posts.length === 0) {
    return [];
  }
  
  // Validate each post
  const validPosts: Array<{
    decision_id: string;
    tweet_id: string;
    content: string;
    posted_at: string;
  }> = [];
  
  const invalidPosts: Array<{ decision_id: string; reason: string }> = [];
  
  for (const post of posts) {
    // Validate decision ID
    const decisionValidation = IDValidator.validateDecisionId(post.decision_id);
    if (!decisionValidation.valid) {
      invalidPosts.push({ decision_id: post.decision_id, reason: decisionValidation.error || 'Invalid decision ID' });
      continue;
    }
    
    // Validate tweet ID
    const tweetValidation = IDValidator.validateTweetId(post.tweet_id);
    if (!tweetValidation.valid) {
      invalidPosts.push({ decision_id: post.decision_id, reason: tweetValidation.error || 'Invalid tweet ID' });
      
      // 🔥 CRITICAL: If tweet ID is invalid, mark post for recovery
      await supabase
        .from('content_metadata')
        .update({ 
          error_message: `Invalid tweet_id detected: ${post.tweet_id} - ${tweetValidation.error}`
        })
        .eq('decision_id', post.decision_id);
      
      continue;
    }
    
    validPosts.push({
      decision_id: post.decision_id,
      tweet_id: post.tweet_id!,
      content: post.content || '',
      posted_at: post.posted_at || new Date().toISOString()
    });
  }
  
  if (invalidPosts.length > 0) {
    console.warn(`[METRICS_VALIDATION] ⚠️ Found ${invalidPosts.length} invalid posts:`);
    invalidPosts.forEach(invalid => {
      console.warn(`[METRICS_VALIDATION]   - ${invalid.decision_id}: ${invalid.reason}`);
    });
    log({ 
      op: 'metrics_validation_invalid', 
      count: invalidPosts.length,
      invalid: invalidPosts 
    });
  }
  
  // Return only valid posts, limited to requested amount
  return validPosts.slice(0, limit);
}

/**
 * Validate a single tweet ID before scraping
 */
export function validateTweetIdForScraping(tweetId: string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  return IDValidator.validateTweetId(tweetId);
}

