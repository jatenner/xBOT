/**
 * Bulletproof character validation and counting utilities
 * Prevents all Twitter character limit rejections
 */

export interface CharacterValidation {
  isValid: boolean;
  length: number;
  reason?: string;
  suggestion?: string;
}

/**
 * Validate single tweet character count with strict limits
 */
export function validateTweetCharacters(content: string): CharacterValidation {
  // Clean and count actual characters
  const actualLength = content.trim().length;
  
  // STRICT validation - prevent all Twitter rejections
  if (actualLength > 260) {
    const excess = actualLength - 260;
    return {
      isValid: false,
      length: actualLength,
      reason: `Content too long: ${actualLength}/260 chars (${excess} over limit)`,
      suggestion: `Cut ${excess}+ characters. Twitter rejects at 280, we enforce 260 for safety.`
    };
  }
  
  if (actualLength < 50) {
    return {
      isValid: false,
      length: actualLength,
      reason: `Content too short: ${actualLength}/260 chars (minimum 50 for meaningful content)`,
      suggestion: 'Add more specific details, examples, or actionable advice.'
    };
  }
  
  return {
    isValid: true,
    length: actualLength
  };
}

/**
 * Get character count with safety warnings
 */
export function getCharacterAnalysis(content: string) {
  const length = content.trim().length;
  const remaining = 260 - length;
  
  let status: 'safe' | 'warning' | 'danger' | 'exceeded';
  let message: string;
  
  if (length > 260) {
    status = 'exceeded';
    message = `🚨 EXCEEDED: ${length}/260 chars (+${length - 260} over limit)`;
  } else if (length > 240) {
    status = 'danger';
    message = `⚠️ DANGER: ${length}/260 chars (${remaining} left - cut more!)`;
  } else if (length > 200) {
    status = 'warning';
    message = `⚠️ WARNING: ${length}/260 chars (${remaining} left - getting close)`;
  } else {
    status = 'safe';
    message = `✅ SAFE: ${length}/260 chars (${remaining} remaining)`;
  }
  
  return {
    length,
    remaining,
    status,
    message,
    isValid: length <= 260 && length >= 50
  };
}

/**
 * Automatically truncate content to fit character limits
 */
export function truncateToLimit(content: string, maxLength: number = 260): string {
  const trimmed = content.trim();
  
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  
  // Find the last complete sentence within the limit
  const truncated = trimmed.substring(0, maxLength - 3); // Leave room for "..."
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.7) {
    // If we can fit 70%+ of the content with a complete sentence, use that
    return trimmed.substring(0, lastSentenceEnd + 1);
  } else {
    // Otherwise, truncate at word boundary and add ellipsis
    const lastSpace = truncated.lastIndexOf(' ');
    return trimmed.substring(0, lastSpace) + '...';
  }
}

/**
 * Validate array of tweets (for threads)
 */
export function validateThreadCharacters(tweets: string[]): {
  isValid: boolean;
  invalidTweets: Array<{ index: number; validation: CharacterValidation }>;
  totalLength: number;
} {
  const invalidTweets: Array<{ index: number; validation: CharacterValidation }> = [];
  let totalLength = 0;
  
  tweets.forEach((tweet, index) => {
    const validation = validateTweetCharacters(tweet);
    totalLength += validation.length;
    
    if (!validation.isValid) {
      invalidTweets.push({ index, validation });
    }
  });
  
  return {
    isValid: invalidTweets.length === 0,
    invalidTweets,
    totalLength
  };
}
