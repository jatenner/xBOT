/**
 * 🧾 POSTING PREPROCESSOR - CLAUDE'S COMPREHENSIVE CONTENT OPTIMIZATION
 * 
 * Single source of truth for all content preprocessing before posting:
 * - Intelligent thread detection and enforcement
 * - Hashtag removal for human-like posting 
 * - Content humanization (remove corporate speak)
 * - Clear Claude-style narration for transparency
 * 
 * Environment Variables:
 * - THREADS_ENFORCE: true/false (default: true) - Always post numbered content as real threads
 * - MAX_HASHTAGS: number (default: 0) - Maximum hashtags to keep (0 = remove all)
 */

import { parseNumberedThread } from './threadUtils';

// Environment configuration with sensible defaults
const ENV = {
  THREADS_ENFORCE: (process.env.THREADS_ENFORCE ?? 'true').toLowerCase() !== 'false',
  MAX_HASHTAGS: Number(process.env.MAX_HASHTAGS ?? '0'),
  ENABLE_NARRATION: (process.env.ENABLE_CLAUDE_NARRATION ?? 'true').toLowerCase() !== 'false'
};

// Claude's narration system for transparency
const narrator: string[] = [];
const say = (msg: string) => { 
  narrator.push(msg); 
  if (ENV.ENABLE_NARRATION) {
    console.log(`🧾 Claude: ${msg}`); 
  }
};

/**
 * 🏷️ SMART HASHTAG REMOVAL
 * Removes hashtags while preserving content flow and readability
 */
export function stripHashtags(text: string, maxHashtags = 0): string {
  if (maxHashtags <= 0) {
    // Remove all hashtags completely
    return text
      .replace(/(^|\s)#[a-z0-9_]+/gi, ' ') // Remove hashtags with spaces
      .replace(/\s{2,}/g, ' ') // Clean up multiple spaces
      .trim();
  }
  
  // Keep only first N hashtags
  let hashtagCount = 0;
  return text
    .replace(/(^|\s)#[a-z0-9_]+/gi, (match) => {
      hashtagCount++;
      return hashtagCount <= maxHashtags ? match : ' ';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 🔧 NORMALIZE THREAD MARKERS
 * Clean up inconsistent thread numbering formats
 */
export function normalizeMarkers(text: string): string {
  return text
    .replace(/\*\*\s*(\d+\/)/g, '$1')   // "**1/**" -> "1/"
    .replace(/\*\*(\d+\/\d+)\*\*/g, '$1') // "**1/7**" -> "1/7"
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * 👨‍💼 HUMANIZE CONTENT
 * Remove corporate speak, clickbait, and artificial elements
 */
export function humanize(text: string): string {
  return text
    // Remove corporate/clickbait intros
    .replace(/\b(Most people don't know:?|The truth( they)? won't tell you:?|Here's the kicker:?)\s*/gi, '')
    .replace(/\b(You won't believe|This will shock you|Mind-blowing|Game-changer)\b/gi, '')
    .replace(/\b(Here's the truth|The real secret|What they don't want you to know)\b/gi, '')
    
    // Remove excessive punctuation and formatting
    .replace(/!{2,}/g, '.') // Multiple exclamations to period
    .replace(/\?{2,}/g, '?') // Multiple questions to single
    .replace(/\.{3,}/g, '...') // Normalize ellipsis
    
    // Remove template-like phrases
    .replace(/\b(Click to learn more|Link in bio|Swipe for more)\b/gi, '')
    .replace(/\b(Follow for more|Like if you agree|Repost if useful)\b/gi, '')
    
    // Clean up spacing
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

/**
 * 🔢 ADD PROPER THREAD NUMBERING
 * Adds clean "1/N 2/N 3/N" format to thread tweets
 */
function numberThread(tweets: string[]): string[] {
  const totalCount = tweets.length;
  return tweets.map((tweet, index) => {
    const tweetNumber = index + 1;
    const cleanedTweet = tweet.trim();
    
    // Don't double-number if already has proper numbering
    if (cleanedTweet.match(/^\d+\/\d+\s/)) {
      return cleanedTweet;
    }
    
    return `${tweetNumber}/${totalCount} ${cleanedTweet}`;
  });
}

/**
 * 🎯 MAIN PREPROCESSING FUNCTION
 * Single entry point for all content preprocessing before posting
 */
export function preprocessForPosting(input: string | string[]): string | string[] {
  say('Starting comprehensive content preprocessing');
  
  // Handle array input (already structured as thread)
  if (Array.isArray(input)) {
    say(`Array content detected (${input.length} parts). Processing each part...`);
    
    const cleanedParts = input.map((part, index) => {
      const processed = humanize(stripHashtags(normalizeMarkers(part), ENV.MAX_HASHTAGS));
      say(`Part ${index + 1}: Cleaned and humanized`);
      return processed;
    });
    
    if (ENV.THREADS_ENFORCE && cleanedParts.length > 1) {
      say(`Thread enforcement enabled: Adding proper numbering to ${cleanedParts.length} tweets`);
      return numberThread(cleanedParts);
    }
    
    return cleanedParts;
  }
  
  // Handle string input - check for thread patterns
  const baseContent = humanize(stripHashtags(normalizeMarkers(input), ENV.MAX_HASHTAGS));
  say('Single string content processed: hashtags removed, humanized');
  
  // Parse for potential thread structure
  const threadAnalysis = parseNumberedThread(baseContent);
  
  if (ENV.THREADS_ENFORCE && threadAnalysis.isThread && threadAnalysis.tweets.length > 1) {
    say(`Thread pattern detected: ${threadAnalysis.tweets.length} parts. Enforcing proper thread structure`);
    
    const cleanedThreadTweets = threadAnalysis.tweets.map(tweet => 
      humanize(stripHashtags(tweet, ENV.MAX_HASHTAGS))
    );
    
    say('All thread parts cleaned and ready for reply-chain posting');
    return numberThread(cleanedThreadTweets);
  }
  
  say('Content will be posted as single tweet (no valid thread structure detected)');
  return baseContent;
}

/**
 * 📊 GENERATE PREPROCESSING SUMMARY
 * Provides clear summary of what preprocessing did
 */
export function getPreprocessingSummary(): string {
  const lines = [
    '📋 PREPROCESSING SUMMARY',
    `   • THREADS_ENFORCE: ${ENV.THREADS_ENFORCE}`,
    `   • MAX_HASHTAGS: ${ENV.MAX_HASHTAGS}`,
    `   • Effects: Normalize markers, ${ENV.MAX_HASHTAGS === 0 ? 'remove all hashtags' : `keep ${ENV.MAX_HASHTAGS} hashtags`}, humanize tone`,
    ENV.THREADS_ENFORCE ? '   • Thread Detection: Enforce reply-chain for numbered content' : '   • Thread Detection: Disabled',
    ''
  ];
  
  return lines.join('\n');
}

/**
 * 🗣️ GET NARRATION LOG
 * Returns all Claude narration for debugging
 */
export function getNarrationLog(): string[] {
  return [...narrator];
}

/**
 * 🧹 CLEAR NARRATION LOG
 * Clears the narration log for next run
 */
export function clearNarrationLog(): void {
  narrator.length = 0;
}

/**
 * 🎨 ENHANCED CONTENT DETECTION
 * Additional checks for content that should be threads
 */
export function detectThreadIntent(content: string): { shouldBeThread: boolean; confidence: number; reasoning: string } {
  let threadScore = 0;
  const reasons: string[] = [];
  
  // Check for numbered patterns
  if (/\d+\/[\d🧠💭🔍🌍😱🚀]*\s*/.test(content)) {
    threadScore += 5;
    reasons.push('numbered patterns detected');
  }
  
  // Check for list indicators
  if (/\b(\d+)\s+(ways|tips|reasons|myths|steps|hacks|methods|strategies)\b/i.test(content)) {
    threadScore += 3;
    reasons.push('list-based content structure');
  }
  
  // Check length
  if (content.length > 400) {
    threadScore += 2;
    reasons.push('content length suggests thread');
  }
  
  // Check for multiple distinct topics
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length > 4) {
    threadScore += 2;
    reasons.push('multiple distinct points');
  }
  
  const shouldBeThread = threadScore >= 3;
  const confidence = Math.min(threadScore / 8, 1.0); // Normalize to 0-1
  
  return {
    shouldBeThread,
    confidence,
    reasoning: reasons.join(', ') || 'no thread indicators found'
  };
}

// Export environment configuration for external inspection
export { ENV as PREPROCESSOR_CONFIG };