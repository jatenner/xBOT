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
 * 🏷️ ADD SMART HASHTAGS - Strategic hashtag placement for discoverability
 */
export function addSmartHashtags(content: string): string {
  // Don't add hashtags if already present
  if (content.includes('#')) {
    return content;
  }
  
  const hashtags: string[] = [];
  
  // 🎯 Topic-based hashtags (max 2-3 for health content)
  if (/mental|brain|cognitive|focus|memory/i.test(content)) {
    hashtags.push('#BrainHealth');
  }
  if (/sleep|rest|recovery/i.test(content)) {
    hashtags.push('#SleepOptimization');
  }
  if (/nutrition|diet|food|eating/i.test(content)) {
    hashtags.push('#HealthyEating');
  }
  if (/exercise|workout|fitness|training/i.test(content)) {
    hashtags.push('#FitnessScience');
  }
  if (/longevity|aging|lifespan/i.test(content)) {
    hashtags.push('#Longevity');
  }
  if (/supplement|vitamin|mineral/i.test(content)) {
    hashtags.push('#Supplements');
  }
  if (/stress|anxiety|cortisol/i.test(content)) {
    hashtags.push('#StressManagement');
  }
  if (/immune|health|wellness/i.test(content)) {
    hashtags.push('#WellnessTips');
  }
  if (/study|research|science/i.test(content)) {
    hashtags.push('#HealthScience');
  }
  
  // 🔬 Add general hashtags if no specific ones match
  if (hashtags.length === 0) {
    hashtags.push('#Health');
  }
  
  // 📈 Always add a growth/viral hashtag
  const viralTags = ['#HealthHacks', '#WellnessTips', '#HealthyLiving'];
  const randomViralTag = viralTags[Math.floor(Math.random() * viralTags.length)];
  if (!hashtags.includes(randomViralTag)) {
    hashtags.push(randomViralTag);
  }
  
  // 🎯 Limit to 2-3 hashtags max (Twitter best practice)
  const selectedTags = hashtags.slice(0, 3);
  
  // 📍 Add hashtags at the end with proper spacing
  if (selectedTags.length > 0) {
    return content + '\n\n' + selectedTags.join(' ');
  }
  
  return content;
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
  
  // 🏷️ Add hashtags (only to first tweet in thread to avoid spam)
  if (isFirstInThread || !content.includes('2️⃣')) {
    formatted = addSmartHashtags(formatted);
  }
  
  return formatted;
}