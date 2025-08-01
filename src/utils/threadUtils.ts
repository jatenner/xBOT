/**
 * 🧵 TWITTER THREAD UTILITIES
 * Converts numbered thread drafts into proper Twitter thread arrays
 */

import { formatTweetForReadability, addSmartHashtags } from './tweetFormatting';

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
 * 🧵 ENHANCED THREAD PARSING - Better content splitting and formatting
 */
export async function parseContentIntoThread(content: string): Promise<ThreadParseResult> {
  // First try the existing numbered parsing
  const existingResult = parseNumberedThread(content);
  if (existingResult.isThread && existingResult.tweets.length > 1) {
    return existingResult;
  }
  
  // If not a numbered thread, check if we should make it one
  try {
    const { shouldBeThread, splitIntoThread } = await import('./tweetFormatting');
    if (shouldBeThread(content)) {
      const threadTweets = splitIntoThread(content);
      
      if (threadTweets.length > 1) {
        return {
          isThread: true,
          tweets: threadTweets,
          originalContent: content
        };
      }
    }
  } catch (error) {
    console.warn('Error in enhanced thread parsing, using fallback:', error);
  }
  
  // Default to single tweet
  return {
    isThread: false,
    tweets: [content],
    originalContent: content
  };
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
    .split(/(?:\n|^)\s*(?:["""''`]|[-•])?\s*(?:Tweet\s*\d+\s*[:\/]|\d+\s*[:\/])\s*/im)
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
        .replace(/^["""''`]\s*/, '') // Remove leading quotes (smart quotes + backticks)
        .replace(/\s*["""''`]$/, '') // Remove trailing quotes (smart quotes + backticks)
        .replace(/^["""''`].*?Tweet\s*\d+\s*[:\/]/i, '') // Remove quote-wrapped "Tweet X:" entirely
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
 * 🔢 Convert number to emoji format for stylish threading
 */
function getEmojiNumber(num: number): string {
  const emojiMap: { [key: number]: string } = {
    1: '1️⃣',
    2: '2️⃣', 
    3: '3️⃣',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣',
    10: '🔟'
  };
  
  return emojiMap[num] || `${num}.`; // Fallback to number with dot for 11+
}

/**
 * 🚀 ENHANCE TWEET CONTENT FOR VIRAL POTENTIAL
 * Transform tweets to match popular health/tech account styles with adaptive styling
 */
export async function enhanceTwitterContent(content: string | string[], isThread?: boolean): Promise<string | string[]> {
  if (Array.isArray(content)) {
    // Handle threads with adaptive styling
    try {
      const { AdaptiveThreadStyler } = await import('./adaptiveThreadStyler');
      const styler = AdaptiveThreadStyler.getInstance();
      const optimalStyle = await styler.selectOptimalStyle();
      
      console.log(`🎨 Applying thread style: ${optimalStyle.name}`);
      
      // Apply the selected style to the thread
      const styledTweets = styler.applyStyleToThread(content, optimalStyle);
      
      return styledTweets.map((tweet, index) => {
        if (index === 0) {
          // First tweet should be a compelling hook (already styled) - this IS part of a thread
          return enhanceHookTweet(tweet, true);
        } else {
          // Subsequent tweets are already styled with numbering
          return enhanceFollowupTweetContent(tweet);
        }
      });
    } catch (error) {
      console.error('❌ Adaptive styling failed, using fallback:', error);
      // Fallback to original enhancement
      return content.map((tweet, index) => {
        if (index === 0) {
          return enhanceHookTweet(tweet, true);
        } else {
          return enhanceFollowupTweet(tweet, index);
        }
      });
    }
  } else {
    // Single tweet enhancement - pass whether this is part of a thread
    return enhanceHookTweet(content, isThread || false);
  }
}

/**
 * 🎯 ENHANCE HOOK TWEET - Make it compelling and viral with proper formatting
 */
function enhanceHookTweet(tweet: string, isPartOfThread: boolean = false): string {
  let enhanced = tweet;
  
  // 🧹 REMOVE CORPORATE THREAD HEADERS FIRST
  enhanced = enhanced
    .replace(/^🚨\s*THREAD:\s*/i, '') // Remove "🚨 THREAD: "
    .replace(/^🧵\s*THREAD:\s*/i, '') // Remove "🧵 THREAD: "
    .replace(/^THREAD:\s*/i, '') // Remove "THREAD: "
    .replace(/^🚨\s*/i, '') // Remove leading 🚨
    .trim();
  
  // 🔥 VIRAL HOOK PATTERNS - Start with impact
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
  }
  
  // 🔥 Make language more compelling and conversational
  enhanced = enhanced
    .replace(/^Boost your/, 'Want to boost your')
    .replace(/^Here are \d+/, 'The')
    .replace(/^(\d+)\s+evidence-based\s+ways/, 'The $1 science-backed ways')
    .replace(/^(\d+)\s+ways/, 'The $1 ways')
    .replace(/science-backed/, 'science-backed')
    .replace(/\!+$/, '') // Remove trailing exclamations
  
  // 📱 SMART FORMATTING: Break long content into readable chunks
  enhanced = formatTweetForReadability(enhanced);
  
  // ⬇️ Add thread indicator ONLY if this is actually part of a thread
  if (isPartOfThread && !enhanced.includes('?') && !enhanced.includes('👇') && !enhanced.includes('🧵')) {
    enhanced += '\n\n👇';
  }
  
  // 🏷️ Add strategic hashtags
  enhanced = addSmartHashtags(enhanced);
  
  return enhanced.trim();
}

/**
 * 📝 ENHANCE FOLLOWUP TWEET - Make actionable and clear
 */
function enhanceFollowupTweet(tweet: string, index: number): string {
  let enhanced = tweet;
  
  // 🔢 SMART NUMBERING SYSTEM - Try different styles and learn which works best
  const numberingStyles = [
    `${index}/`, // Current style: "1/"
    `${getEmojiNumber(index)}`, // Emoji style: "1️⃣"
    `${index}.`, // Dot style: "1."
    `${index})` // Parenthesis style: "1)"
  ];
  
  // For now, use emoji numbering (we'll add A/B testing later)
  const emojiNumbering = getEmojiNumber(index);
  
  const hasNumbering = /^(\d+[\.\/]|\d+\)|[A-Z]\)|[\u0030-\u0039]\uFE0F?\u20E3)/g.test(enhanced.trim());
  
  if (!hasNumbering) {
    enhanced = `${emojiNumbering} ${enhanced}`;
  } else {
    // Replace existing numbering with emoji format (avoid double numbering)
    enhanced = enhanced.replace(/^(\d+[\.\)]|\d+\/|\d\uFE0F?\u20E3)\s*/, `${emojiNumbering} `);
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

/**
 * 📝 ENHANCE FOLLOWUP TWEET CONTENT (without numbering, since it's handled by styler)
 */
function enhanceFollowupTweetContent(tweet: string): string {
  let enhanced = tweet;
  
  // 📱 Apply smart formatting for readability first
  enhanced = formatTweetForReadability(enhanced);
  
  // 🎨 Transform corporate **bold** formatting into Twitter-native format with emojis
  enhanced = enhanced
    .replace(/\*\*([^*]+)\*\*/g, '$1:') // Convert **Hydration** to Hydration:
    .replace(/Morning Sunlight:/i, '☀️ **Morning Sunlight:**')
    .replace(/Breathwork:/i, '🫁 **Breathwork:**')
    .replace(/Intermittent Fasting:/i, '⏱️ **Intermittent Fasting:**')
    .replace(/Sleep:/i, '😴 **Sleep:**')
    .replace(/Exercise:/i, '💪 **Exercise:**')
    .replace(/Nutrition:/i, '🥗 **Nutrition:**')
    .replace(/Hydration:/i, '💧 **Hydration:**')
    
  // 🎯 Improve specific health content formatting
  enhanced = enhanced
    .replace(/(\d+)\s*mins?\s*of\s*/gi, '$1 minutes of ')
    .replace(/30\s*mins?\s*of\s*waking/gi, '30 minutes of waking')
    .replace(/within 30 minutes/gi, 'within **30 minutes**')
    .replace(/(\d+)%/g, '**$1%**') // Emphasize percentages
    
  // 🚀 Ensure actionable language for tips
  enhanced = enhanced
    .replace(/^(\d+[\.\/]|\d+\)|[\u0030-\u0039]\uFE0F?\u20E3|→)?\s*Consider\s+/i, '$1Try ')
    .replace(/^(\d+[\.\/]|\d+\)|[\u0030-\u0039]\uFE0F?\u20E3|→)?\s*You\s+should\s+/i, '$1')
    .replace(/^(\d+[\.\/]|\d+\)|[\u0030-\u0039]\uFE0F?\u20E3|→)?\s*It\s+is\s+recommended\s+to\s+/i, '$1')
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