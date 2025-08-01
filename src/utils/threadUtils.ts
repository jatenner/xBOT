/**
 * 🧵 TWITTER THREAD UTILITIES
 * Converts numbered thread drafts into proper Twitter thread arrays
 */

export interface ThreadParseResult {
  isThread: boolean;
  tweets: string[];
  originalContent: string;
}

/**
 * 🧹 Clean corporate/template formatting from single tweets
 */
export function cleanSingleTweet(content: string): string {
  return content
    .replace(/^\*\*[^*]+\*\*\s*/, '') // Remove **bold headers**
    .replace(/^Research_Bomb\s+Thread[^:\n]*:?\s*/i, '') // Remove "Research_Bomb Thread:"
    .replace(/^Thread[^:\n]*:?\s*/i, '') // Remove "Thread:"
    .replace(/^\*\*Thread[^:\n]*\*\*:?\s*/i, '') // Remove "**Thread:**"
    .replace(/^Tweet\s*Thread[^:\n]*:?\s*/i, '') // Remove "Tweet Thread:"
    .replace(/^\*\*Tweet\s*Thread[^:\n]*\*\*:?\s*/i, '') // Remove "**Tweet Thread:**"
    .replace(/^Here's\s+the\s+breakdown[^:\n]*:?\s*/i, '') // Remove "Here's the breakdown:"
    .replace(/^Tweet\s*\d+\s*[:\/]\s*/i, '') // Remove "Tweet 1:"
    .replace(/^\d+\s*[:\/]\s*/, '') // Remove "1:"
    .replace(/\*{2,}/g, '') // Remove multiple asterisks
    .replace(/^\s*[-•]\s*/, '') // Remove bullet points at start
    .replace(/^["""'']\s*/, '') // Remove leading quotes (smart quotes)
    .replace(/["""'']\s*$/, '') // Remove trailing quotes (smart quotes)
    .replace(/\.\.\.$/, '') // Remove trailing ...
    .trim();
}

/**
 * Parse numbered thread content like:
 * "**Thread: Title**
 * Tweet 1: First tweet content
 * Tweet 2: Second tweet content..."
 * 
 * Into clean array: ["First tweet content", "Second tweet content"]
 */
export function parseNumberedThread(raw: string): ThreadParseResult {
  const originalContent = raw;
  
  // Remove the optional **Thread:** header and clean up more aggressively
  const cleaned = raw
    .replace(/^\*\*?Thread[^:\n]*:?\*\*?/i, '')
    .replace(/^\s*Here are \d+[^:\n]*:?\s*/i, '') // Remove "Here are 4 surprising truths:"
    .replace(/^\s*\d+\s+evidence-based\s+ways[^:\n]*:?\s*/i, '') // Remove "5 evidence-based ways to..."
    .replace(/^\s*\d+\s+ways[^:\n]*:?\s*/i, '') // Remove "3 ways to..."
    .replace(/^Tweet\s*Thread[^:\n]*:?\s*/i, '') // Remove "Tweet Thread:" header
    .replace(/^\*\*Tweet\s*Thread[^:\n]*\*\*:?\s*/i, '') // Remove "**Tweet Thread:**" header
    .replace(/^Thread\s*:\s*/i, '') // Remove simple "Thread:" header
    .replace(/^\*\*Thread\s*:\*\*\s*/i, '') // Remove "**Thread:**" header
    .trim();

  // Split on "Tweet X:" headers (case insensitive, flexible spacing and numbering)
  // Allow optional quotes/bullets before Tweet markers
  const parts = cleaned
    .split(/(?:\n|^)\s*(?:["""'']|[-•])?\s*(?:Tweet\s*\d+\s*[:\/]|\d+\s*[:\/])\s*/i)
    .map(part => part.trim())
    .filter(Boolean);

  // If we successfully split into multiple parts, it's a thread
  const isThread = parts.length > 1;
  
  if (isThread) {
    // Clean up each tweet part more aggressively
    const tweets = parts.map(tweet => {
      return tweet
        .replace(/^\*\*/, '') // Remove leading **
        .replace(/\*\*$/, '') // Remove trailing **
        .replace(/^["""'']/, '') // Remove leading quotes (smart quotes)
        .replace(/["""'']$/, '') // Remove trailing quotes (smart quotes)
        .replace(/^\d+\/\s*/, '') // Remove "1/ " numbering
        .replace(/^\d+\)\s*/, '') // Remove "1) " numbering
        .replace(/^\d+\.\s*/, '') // Remove "1. " numbering
        .replace(/^[-•]\s*/, '') // Remove bullet points
        .replace(/\s*\.\.\.$/, '') // Remove trailing ...
        .trim();
    }).filter(tweet => tweet.length > 0 && tweet.length > 10); // Filter out very short fragments

    console.log(`🧵 Parsed thread: ${tweets.length} tweets from numbered content`);
    return {
      isThread: true,
      tweets,
      originalContent
    };
  }

  // Not a thread - return original content as single tweet
  console.log(`📝 Single tweet detected (no numbered format)`);
  return {
    isThread: false,
    tweets: [cleaned || raw.trim()],
    originalContent
  };
}

/**
 * Validate thread content meets Twitter requirements
 */
export function validateThread(tweets: string[]): {
  valid: boolean;
  issues: string[];
  maxLength: number;
} {
  const issues: string[] = [];
  const maxLength = Math.max(...tweets.map(t => t.length));
  
  // Check thread length
  if (tweets.length > 25) {
    issues.push(`Thread too long: ${tweets.length} tweets (max 25)`);
  }
  
  if (tweets.length < 2) {
    issues.push(`Not a valid thread: ${tweets.length} tweet (minimum 2)`);
  }
  
  // Check individual tweet lengths
  tweets.forEach((tweet, index) => {
    if (tweet.length > 280) {
      issues.push(`Tweet ${index + 1} too long: ${tweet.length} chars (max 280)`);
    }
    if (tweet.length < 10) {
      issues.push(`Tweet ${index + 1} too short: ${tweet.length} chars (min 10)`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues,
    maxLength
  };
}

/**
 * Clean thread content for better readability
 */
export function cleanThreadContent(tweets: string[]): string[] {
  return tweets.map(tweet => {
    return tweet
      // Remove excessive formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/__(.*?)__/g, '$1')     // Remove underline markdown
      .replace(/^\d+\.\s*/, '')        // Remove leading numbers "1. "
      .replace(/^[•·∙]\s*/, '')        // Remove bullet points
      // Clean up spacing
      .replace(/\s+/g, ' ')            // Multiple spaces to single
      .replace(/\n{3,}/g, '\n\n')      // Multiple newlines to double
      .trim();
  });
}