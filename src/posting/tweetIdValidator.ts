/**
 * 🔒 TWEET ID VALIDATOR
 * 
 * Validates tweet IDs to ensure they are real Twitter tweet IDs (18-20 digits).
 * Prevents false POST_SUCCESS events with invalid IDs.
 */

/**
 * Validates a tweet ID string
 * 
 * @param tweetId - The tweet ID to validate (must be string)
 * @returns Object with valid flag and error message if invalid
 */
export function assertValidTweetId(tweetId: string): { valid: boolean; error?: string } {
  if (!tweetId || typeof tweetId !== 'string') {
    return {
      valid: false,
      error: `Tweet ID must be a non-empty string, got: ${typeof tweetId}`
    };
  }

  // Twitter tweet IDs are 18-20 digits (no leading zeros, pure numeric string)
  const tweetIdRegex = /^\d{18,20}$/;
  
  if (!tweetIdRegex.test(tweetId)) {
    return {
      valid: false,
      error: `Tweet ID must be 18-20 digits, got: "${tweetId}" (length: ${tweetId.length})`
    };
  }

  return { valid: true };
}

/**
 * Extract and validate tweet ID from CreateTweet GraphQL response
 * 
 * @param responseBody - The JSON response body from CreateTweet GraphQL endpoint
 * @returns Validated tweet ID string or null if not found/invalid
 */
export function extractTweetIdFromCreateTweetResponse(responseBody: any): string | null {
  try {
    // Twitter's CreateTweet GraphQL response structure:
    // data.create_tweet.tweet_results.result.rest_id (string)
    // OR
    // data.create_tweet.tweet_results.result.legacy.id_str (string)
    
    const paths = [
      'data.create_tweet.tweet_results.result.rest_id',
      'data.create_tweet.tweet_results.result.legacy.id_str',
      'data.create_tweet.tweet_results.result.id',
    ];

    for (const path of paths) {
      const value = getNestedValue(responseBody, path);
      if (value != null) {
        // Ensure it's a string (no Number coercion)
        const tweetId = String(value);
        const validation = assertValidTweetId(tweetId);
        if (validation.valid) {
          return tweetId;
        }
      }
    }

    // Fallback: Deep search for rest_id in the response
    const bodyStr = JSON.stringify(responseBody);
    const restIdMatch = bodyStr.match(/"rest_id"\s*:\s*"(\d{18,20})"/);
    if (restIdMatch) {
      const tweetId = restIdMatch[1];
      const validation = assertValidTweetId(tweetId);
      if (validation.valid) {
        return tweetId;
      }
    }

    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Helper: Get nested value from object by dot-separated path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
