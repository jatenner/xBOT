/**
 * CONTENT FORMATTER
 * Post-processes AI-generated content to improve readability and Twitter-native feel
 */

// Banned phrases that sound robotic/corporate
const BANNED_PHRASES = [
  'optimize your health',
  'boost energy and focus',
  'cultivate meaningful relationships',
  'informed choices',
  'empower yourself',
  'holistic approach',
  'journey to wellness',
  'unlock your potential',
  'game-changing insights',
  'enhance your wellbeing',
  'comprehensive solution'
];

// Generic openers to avoid
const GENERIC_OPENERS = [
  'Did you know that',
  'It\'s important to',
  'Many people don\'t realize',
  'Research has shown',
  'Studies indicate that',
  'It has been proven',
  'Scientists have discovered'
];

/**
 * Improve content formatting for Twitter readability
 */
export function formatForTwitter(content: string | string[]): string | string[] {
  if (Array.isArray(content)) {
    // Format each tweet in thread
    return content.map(tweet => formatSingleTweet(tweet));
  } else {
    return formatSingleTweet(content);
  }
}

function formatSingleTweet(tweet: string): string {
  let formatted = tweet;
  
  // 1. Remove generic corporate phrases (flag for regeneration if found)
  for (const phrase of BANNED_PHRASES) {
    if (formatted.toLowerCase().includes(phrase.toLowerCase())) {
      console.warn(`[FORMATTER] ⚠️ Generic phrase detected: "${phrase}"`);
    }
  }
  
  // 2. Improve line breaks for readability
  // Add breaks after periods for dramatic effect (if tweet is long enough)
  if (formatted.length > 150) {
    formatted = formatted.replace(/\. ([A-Z])/g, '.\n\n$1');
  }
  
  // 3. Remove markdown bold that AI sometimes adds
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // 4. Clean up extra whitespace
  formatted = formatted.replace(/\n{3,}/g, '\n\n'); // Max 2 line breaks
  formatted = formatted.trim();
  
  return formatted;
}

/**
 * Quality check for content
 */
export function validateContentQuality(content: string): {
  passed: boolean;
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;
  
  // Check for banned phrases
  const lowerContent = content.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      issues.push(`Generic phrase: "${phrase}"`);
      score -= 20;
    }
  }
  
  // Check for generic openers
  for (const opener of GENERIC_OPENERS) {
    if (content.startsWith(opener)) {
      issues.push(`Generic opener: "${opener}"`);
      score -= 15;
    }
  }
  
  // Check for numbered lists (1. 2. 3. format)
  if (/\d+\.\s+/.test(content)) {
    issues.push('Contains numbered list format');
    score -= 10;
  }
  
  // Check for markdown bold
  if (/\*\*[^*]+\*\*/.test(content)) {
    issues.push('Contains markdown bold formatting');
    score -= 5;
  }
  
  // Check for specificity (should have numbers/data)
  const hasNumbers = /\d+/.test(content);
  if (!hasNumbers && content.length > 100) {
    issues.push('No specific numbers or data');
    score -= 10;
  }
  
  const passed = score >= 70; // 70% threshold
  
  return { passed, issues, score };
}

/**
 * Detect if content is too generic (should be regenerated)
 */
export function isTooGeneric(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Check for multiple banned phrases
  const bannedCount = BANNED_PHRASES.filter(phrase => 
    lowerContent.includes(phrase.toLowerCase())
  ).length;
  
  if (bannedCount >= 2) {
    return true;
  }
  
  // Check for generic opener + no specific data
  const hasGenericOpener = GENERIC_OPENERS.some(opener => 
    content.startsWith(opener)
  );
  const hasSpecificData = /\d+%|\d+ (people|participants|patients|studies)/.test(content);
  
  if (hasGenericOpener && !hasSpecificData) {
    return true;
  }
  
  return false;
}

