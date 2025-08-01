/**
 * 🎨 ADVANCED TWEET FORMATTING UTILITIES
 * Professional tweet formatting with spacing, hashtags, and readability
 */

/**
 * 📱 FORMAT TWEET FOR READABILITY - Break long content into scannable chunks
 */
export function formatTweetForReadability(content: string): string {
  let formatted = content;
  
  // 🔍 If content is too long or dense, add strategic line breaks
  if (formatted.length > 120 && !formatted.includes('\n')) {
    // Break after questions for emphasis
    formatted = formatted.replace(/(\?)\s+([A-Z])/g, '$1\n\n$2');
    
    // Break after colons that introduce lists or explanations
    formatted = formatted.replace(/(:)\s+([A-Z])/g, '$1\n\n$2');
    
    // Break before numbered lists
    formatted = formatted.replace(/\s+(1\.|\d+\)|①|1️⃣)/g, '\n\n$1');
    
    // Break after periods if the next sentence is long
    formatted = formatted.replace(/(\.\s+)([A-Z][^.]{30,})/g, '$1\n\n$2');
  }
  
  // 📊 Format numbered lists with proper spacing
  formatted = formatted.replace(/(\d+[\.\)])\s*/g, '$1 ');
  
  // 🎯 Add emphasis breaks around key statistics
  formatted = formatted.replace(/(\d+%|\d+x|±\d+)/g, ' **$1** ');
  formatted = formatted.replace(/\*\*\s+/g, '**').replace(/\s+\*\*/g, '**'); // Clean up spacing
  
  return formatted.trim();
}

/**
 * 🎨 PROFESSIONAL EMOJI ENHANCEMENT - Thoughtful, strategic emoji usage
 */
export function addProfessionalEmojis(content: string): string {
  // Only add emojis if they genuinely enhance the message
  let enhanced = content;
  
  // 🧠 Brain/cognitive content - only if discussing mental performance
  if (/mental clarity|cognitive|brain function|focus/i.test(content) && !content.includes('🧠')) {
    enhanced = enhanced.replace(/^/, '🧠 ');
  }
  
  // 🔬 Scientific studies - only for research-backed claims
  else if (/study shows|research reveals|scientists found/i.test(content) && !content.includes('🔬')) {
    enhanced = enhanced.replace(/^/, '🔬 ');
  }
  
  // 💡 Insights/discoveries - for breakthrough information
  else if (/did you know|breakthrough|discovery/i.test(content) && !content.includes('💡')) {
    enhanced = enhanced.replace(/^/, '💡 ');
  }
  
  // ⚡ Energy/performance - for energy-related content
  else if (/energy|performance|boost.*by.*%/i.test(content) && !content.includes('⚡')) {
    enhanced = enhanced.replace(/^/, '⚡ ');
  }
  
  return enhanced;
}

/**
 * 🧵 SMART THREAD DETECTION - Determine if content should be a thread
 */
export function shouldBeThread(content: string): boolean {
  // Check for explicit thread indicators
  if (/here\s+are\s+\d+|here\s+are\s+the\s+\d+|\d+\s+ways?\s+to|\d+\s+tips?\s+for|\d+\s+reasons?\s+why/i.test(content)) {
    return true;
  }
  
  // Check for numbered lists
  if (content.match(/\d+[\.\)]\s+.*?\d+[\.\)]/s)) {
    return true;
  }
  
  // Check length (>280 chars should probably be a thread)
  if (content.length > 280) {
    return true;
  }
  
  // Check for multiple sentences with detailed explanations
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length >= 4) {
    return true;
  }
  
  return false;
}

/**
 * ✂️ SPLIT CONTENT INTO THREAD - Break long content into tweet-sized chunks
 */
export function splitIntoThread(content: string): string[] {
  const tweets: string[] = [];
  
  // 🔍 Try to split on numbered lists first
  const numberedParts = content.split(/(?=\d+[\.\)]\s+)/);
  if (numberedParts.length > 1) {
    tweets.push(numberedParts[0].trim());
    for (let i = 1; i < numberedParts.length; i++) {
      tweets.push(numberedParts[i].trim());
    }
    return tweets.filter(tweet => tweet.length > 0);
  }
  
  // 🔍 Split on sentences if no numbered lists
  const sentences = content.split(/(?<=[.!?])\s+/);
  let currentTweet = '';
  
  for (const sentence of sentences) {
    if ((currentTweet + ' ' + sentence).length <= 260) { // Leave room for numbering
      currentTweet += (currentTweet ? ' ' : '') + sentence;
    } else {
      if (currentTweet) {
        tweets.push(currentTweet.trim());
      }
      currentTweet = sentence;
    }
  }
  
  if (currentTweet) {
    tweets.push(currentTweet.trim());
  }
  
  return tweets.filter(tweet => tweet.length > 0);
}

/**
 * 🎨 FORMAT FINAL TWEET - Apply all formatting enhancements
 */
export function formatFinalTweet(content: string, isFirstInThread: boolean = false): string {
  let formatted = content;
  
  // 📱 Apply readability formatting
  formatted = formatTweetForReadability(formatted);
  
  // Note: No hashtags - they look amateurish for professional health content
  
  return formatted;
}