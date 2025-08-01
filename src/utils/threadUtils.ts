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
    // 🎯 REMOVE ALL THREAD/TWEET HEADERS - Make tweets look professional
    .replace(/^\s*\*{0,2}Tweet\s*:?\*{0,2}\s*/im, '') // Remove "**Tweet:**" or "Tweet:"
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
    .replace(/\*{2,}/g, '') // Remove multiple asterisks **bold**
    .replace(/^\s*[-•·]\s*/, '') // Remove bullet points at start
    .replace(/^["""''`]\s*/, '') // Remove leading quotes
    .replace(/["""''`]\s*$/, '') // Remove trailing quotes
    .replace(/\.\.\.$/, '') // Remove trailing ellipsis
    
    // 🔥 TRANSFORM INLINE LISTS into clean format  
    .replace(/(\d+\))\s*/g, '\n\n$1 ') // "1) content 2) content" -> line breaks
    .replace(/\s+/g, ' ') // Multiple spaces to single (after list transform)
    .replace(/\n\s+/g, '\n') // Clean up line spacing
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
    // Remove **Tweet:** (single tweet markers that leak through)
    .replace(/^\s*\*{0,2}Tweet\s*:?\*{0,2}\s*\n?/im, '')
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
        .replace(/^\*{1,2}/, '') // Remove leading * or **
        .replace(/\*{1,2}$/, '') // Remove trailing * or **
        .replace(/\*{2,}/g, '') // Remove any remaining ** bold markers
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
  
  // 🧹 REMOVE CORPORATE THREAD HEADERS FIRST
  enhanced = enhanced
    .replace(/^🚨\s*THREAD:\s*/i, '') // Remove "🚨 THREAD: "
    .replace(/^🧵\s*THREAD:\s*/i, '') // Remove "🧵 THREAD: "
    .replace(/^THREAD:\s*/i, '') // Remove "THREAD: "
    .replace(/^🚨\s*/i, '') // Remove leading 🚨
    .trim();
  
  // 🔥 VIRAL HOOK PATTERNS - Start with impact (removed THREAD from check)
  if (!/^(Most people|New study|Research shows|Breaking:|Scientists|Want to|The)/i.test(enhanced)) {
    // Transform common patterns into viral hooks
    if (/boost.*mental.*performance.*40%/i.test(enhanced)) {
      enhanced = enhanced.replace(/^.*boost your mental performance by 40%.*?with/i, 'Want to boost your mental performance by 40%? Here are');
    } else if (/(\d+).*ways?.*to/i.test(enhanced)) {
      const match = enhanced.match(/(\d+).*ways?.*to\s*(.*)/i);
      if (match) {
        enhanced = `The ${match[1]} science-backed ways to ${match[2]}`;
      }
    } else if (/immune.*system/i.test(enhanced)) {
      enhanced = enhanced.replace(/^.*70%.*of.*immune/i, 'Did you know 70% of your immune');
    }
  }
  
  // 🎨 Add SUBTLE category-specific emojis for engagement (only if missing)
  if (!enhanced.match(/^[🧠🔬💪🥗⚡]/)) {
    if (/mental|brain|cognitive|performance|focus/i.test(enhanced)) {
      enhanced = `🧠 ${enhanced}`;
    } else if (/study|research|science|discover/i.test(enhanced)) {
      enhanced = `🔬 ${enhanced}`;
    } else if (/exercise|workout|fitness|muscle/i.test(enhanced)) {
      enhanced = `💪 ${enhanced}`;
    } else if (/nutrition|diet|food|gut|immune/i.test(enhanced)) {
      enhanced = `🥗 ${enhanced}`;
    }
    // Removed 🚨 - too aggressive and corporate looking
  }
  
  // 🔥 Make language more compelling and conversational
  enhanced = enhanced
    .replace(/^Boost your/, 'Want to boost your')
    .replace(/^Here are \d+/, 'The')
    .replace(/^(\d+)\s+evidence-based\s+ways/, 'The $1 science-backed ways')
    .replace(/^(\d+)\s+ways/, 'The $1 ways')
    .replace(/science-backed/, 'science-backed')
    .replace(/\!+$/, '') // Remove trailing exclamations
    
  // ⬇️ Add thread indicator if not a question
  if (!enhanced.includes('?') && !enhanced.includes('👇') && !enhanced.includes('🧵')) {
    enhanced += ' 👇';
  }
  
  // 📱 Add breathing space after hook for mobile readability
  if (!enhanced.includes('\n') && enhanced.length > 80) {
    const firstSentence = enhanced.match(/^[^.!?]*[.!?]/);
    if (firstSentence) {
      enhanced = enhanced.replace(firstSentence[0], firstSentence[0] + '\n');
    }
  }
  
  return enhanced;
}

/**
 * 📝 ENHANCE FOLLOWUP TWEET - Make actionable and clear
 */
function enhanceFollowupTweet(tweet: string, index: number): string {
  let enhanced = tweet;
  
  // 🔢 Ensure professional thread numbering (1/ format) - only if not already numbered
  const hasNumbering = /^(\d+[\.\/]|\d+\)|[A-Z]\))/g.test(enhanced.trim());
  
  if (!hasNumbering) {
    enhanced = `${index}/ ${enhanced}`;
  } else {
    // Replace existing numbering with consistent format (avoid double numbering)
    enhanced = enhanced.replace(/^(\d+[\.\)]|\d+\/)\s*/, `${index}/ `);
  }
  
  // 🎨 Transform corporate **bold** formatting into Twitter-native format
  enhanced = enhanced
    .replace(/\*\*([^*]+)\*\*/g, '$1:') // Convert **Hydration** to Hydration:
    .replace(/^(\d+[\.\/]|\d+\))\s*([^:]+):\s*/, '$1 $2: ') // Clean up "1/ Term: content"
    
  // 🔥 Make bullet-style lists more readable
  enhanced = enhanced
    .replace(/^\d+\)\s*/, `${index}/ `) // Convert "1) content" to "1/ content"
    .replace(/^\d+\.\s*/, `${index}/ `) // Convert "1. content" to "1/ content"
    
  // 💡 Add visual breaks for long content (improve mobile readability)
  if (enhanced.length > 120 && !enhanced.includes('\n')) {
    // Add line break after first complete thought
    const breakPoint = enhanced.search(/[.!]\s+[A-Z]/);
    if (breakPoint > 40 && breakPoint < 100) {
      enhanced = enhanced.slice(0, breakPoint + 1) + '\n\n' + enhanced.slice(breakPoint + 1);
    }
  }
  
  // 🚀 Ensure actionable language for tips
  enhanced = enhanced
    .replace(/^(\d+\/)?\s*Consider\s+/i, '$1Try ')
    .replace(/^(\d+\/)?\s*You\s+should\s+/i, '$1')
    .replace(/^(\d+\/)?\s*It\s+is\s+recommended\s+to\s+/i, '$1')
    .replace(/per day/g, 'daily')
    .replace(/\s+—\s+aim\s+for/, ' (aim for')
    .replace(/\s+—\s+/, ' - ')
    
  // 📱 Clean up excessive spacing and formatting
  enhanced = enhanced
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 line breaks
    .trim();
    
  return enhanced;
}