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
    // 🎯 REMOVE ALL THREAD HEADERS - Make tweets look professional
    .replace(/^\s*\*{0,2}Tweet\s*Thread[^:\n]*:?\*{0,2}\s*/im, '') // Remove "**Tweet Thread:**" variants
    .replace(/^\s*\*{0,2}Thread[^:\n]*:?\*{0,2}\s*/im, '') // Remove "**Thread:**" variants
    .replace(/^\s*\*{0,2}Research_Bomb\s+Thread[^:\n]*:?\*{0,2}\s*/i, '') // Remove "Research_Bomb Thread:"
    
    // 🧹 REMOVE NUMBERED HEADERS - Start with actual content
    .replace(/^\s*Tweet\s*\d+\s*[:\/]\s*/i, '') // Remove "Tweet 1:"
    .replace(/^\s*\d+\s*[:\/]\s*/, '') // Remove "1:"
    .replace(/^\s*\d+\.\s*/, '') // Remove "1. "
    .replace(/^\s*\d+\)\s*/, '') // Remove "1) "
    
    // 🎨 REMOVE GENERIC INTROS - Get to the point
    .replace(/^\s*Here's\s+the\s+breakdown[^:\n]*:?\s*/i, '')
    .replace(/^\s*Here\s+(are|is)\s+\d+[^:\n]*:?\s*/i, '')
    
    // ✨ CLEAN FORMATTING - Remove excessive styling
    .replace(/\*{2,}/g, '') // Remove multiple asterisks
    .replace(/^\s*[-•·]\s*/, '') // Remove bullet points at start
    .replace(/^["""''`]\s*/, '') // Remove leading quotes
    .replace(/["""''`]\s*$/, '') // Remove trailing quotes
    .replace(/\.\.\.$/, '') // Remove trailing ellipsis
    .replace(/\s+/g, ' ') // Multiple spaces to single
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
  
  // 🎯 COMPREHENSIVE HEADER REMOVAL - Remove all thread header variants
  let cleaned = raw
    // Remove **Tweet Thread:** and variants
    .replace(/^\s*\*{0,2}Tweet\s*Thread[^:\n]*:?\*{0,2}\s*\n?/im, '')
    .replace(/^\s*\*{0,2}Thread[^:\n]*:?\*{0,2}\s*\n?/im, '')
    // Remove "Here are X ways..." intros
    .replace(/^\s*Here\s+(are|is)\s+\d+[^:\n]*:?\s*\n?/im, '')
    .replace(/^\s*\d+\s+(evidence-based\s+)?ways[^:\n]*:?\s*\n?/im, '')
    // Remove generic intro patterns
    .replace(/^\s*Here's\s+the\s+breakdown[^:\n]*:?\s*\n?/im, '')
    .trim();

  // 🧵 IMPROVED SPLIT - Split on Tweet markers and clean thoroughly
  const parts = cleaned
    .split(/(?:\n|^)\s*(?:["""'']|[-•])?\s*(?:Tweet\s*\d+\s*[:\/]|\d+\s*[:\/])\s*/im)
    .map(part => part.trim())
    .filter(part => {
      // Filter out empty parts and standalone header fragments
      return part && 
             part.length > 5 && 
             !/^(tweet\s*thread|thread)\s*:?\s*$/i.test(part) &&
             !/^\*{0,2}(tweet\s*thread|thread)\*{0,2}\s*:?\s*$/i.test(part);
    });

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

/**
 * 🚀 ENHANCE TWEET CONTENT FOR VIRAL POTENTIAL
 * Transform tweets to match popular health/tech account styles
 */
export function enhanceTwitterContent(content: string | string[]): string | string[] {
  if (Array.isArray(content)) {
    // Handle threads - make first tweet a compelling hook
    return content.map((tweet, index) => {
      if (index === 0) {
        // First tweet should be a compelling hook
        return enhanceHookTweet(tweet);
      } else {
        // Subsequent tweets should be clear and actionable
        return enhanceFollowupTweet(tweet, index);
      }
    });
  } else {
    // Single tweet enhancement
    return enhanceHookTweet(content);
  }
}

/**
 * 🎯 ENHANCE HOOK TWEET - Make it compelling and viral
 */
function enhanceHookTweet(tweet: string): string {
  let enhanced = tweet;
  
  // Ensure it starts with impact, not generic intro
  if (!/^(Most people|New study|🚨|🧵|Research shows|THREAD|Breaking:|Scientists)/i.test(enhanced)) {
    // Add engagement hooks for health content
    if (/mental|brain|cognitive|performance/i.test(enhanced)) {
      enhanced = `🧠 ${enhanced}`;
    } else if (/study|research|science/i.test(enhanced)) {
      enhanced = `🔬 ${enhanced}`;
    } else if (/exercise|workout|fitness/i.test(enhanced)) {
      enhanced = `💪 ${enhanced}`;
    } else if (/nutrition|diet|food/i.test(enhanced)) {
      enhanced = `🥗 ${enhanced}`;
    }
  }
  
  // Ensure compelling language
  enhanced = enhanced
    .replace(/^Boost your/, 'Want to boost your')
    .replace(/^Here are \d+/, 'The')
    .replace(/science-backed/, 'science-backed')
    .replace(/\!$/, '') // Remove trailing exclamation if exists
    .replace(/$/, enhanced.includes('?') ? '' : ' 👇'); // Add thread indicator
  
  return enhanced;
}

/**
 * 📝 ENHANCE FOLLOWUP TWEET - Make actionable and clear
 */
function enhanceFollowupTweet(tweet: string, index: number): string {
  let enhanced = tweet;
  
  // Ensure numbered tweets start with clear indicators
  if (!/^(\d+[\.\/]|\d+\)|[A-Z]\))/g.test(enhanced)) {
    enhanced = `${index}/ ${enhanced}`;
  }
  
  // Clean up bold formatting that doesn't work on Twitter
  enhanced = enhanced
    .replace(/\*\*([^*]+)\*\*/g, '$1:') // Convert **Term** to Term:
    .replace(/^(\d+[\.\/]|\d+\))\s*([^:]+):\s*/, '$1 $2: ') // Clean up spacing
  
  return enhanced;
}