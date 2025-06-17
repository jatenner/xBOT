import { preserveUrlsInTweet } from './urlPreservation.js';

export interface FormattedTweet {
  content: string;
  isValid: boolean;
  characterCount: number;
  warnings: string[];
}

export interface TweetValidationOptions {
  maxLength?: number;
  allowEmojis?: boolean;
  allowHashtags?: boolean;
  allowMentions?: boolean;
}

/**
 * Formats and validates tweet content according to Twitter's requirements
 */
export function formatTweet(
  content: string,
  options: TweetValidationOptions = {}
): FormattedTweet {
  const {
    maxLength = 280,
    allowEmojis = true,
    allowHashtags = true,
    allowMentions = true,
  } = options;

  let formattedContent = content.trim();
  const warnings: string[] = [];

  // Remove extra whitespace
  formattedContent = formattedContent.replace(/\s+/g, ' ');

  // Character count (accounting for Twitter's character counting rules)
  const characterCount = getTwitterCharacterCount(formattedContent);

  // Validation checks
  const isValid = characterCount <= maxLength && characterCount > 0;

  if (characterCount > maxLength) {
    warnings.push(`Tweet exceeds ${maxLength} characters (${characterCount})`);
  }

  if (characterCount === 0) {
    warnings.push('Tweet is empty');
  }

  if (!allowEmojis && containsEmojis(formattedContent)) {
    warnings.push('Emojis not allowed');
  }

  if (!allowHashtags && containsHashtags(formattedContent)) {
    warnings.push('Hashtags not allowed');
  }

  if (!allowMentions && containsMentions(formattedContent)) {
    warnings.push('Mentions not allowed');
  }

  return {
    content: formattedContent,
    isValid,
    characterCount,
    warnings,
  };
}

/**
 * Adds Snap2Health CTA to tweet content
 */
export function addSnap2HealthCTA(content: string): string {
  const ctas = [
    '\n\nMore AI health insights → snap2health.com 🧠',
    '\n\nDive deeper → snap2health.com 💡',
    '\n\nPersonalized health AI → snap2health.com 🩺',
    '\n\nYour health journey → snap2health.com ⏳',
  ];

  const randomCTA = ctas[Math.floor(Math.random() * ctas.length)];
  
  // Check if adding CTA would exceed character limit
  const totalLength = getTwitterCharacterCount(content + randomCTA);
  
  if (totalLength <= 280) {
    return content + randomCTA;
  }
  
  // Try shorter CTA
  const shortCTA = '\n\nsnap2health.com 🧠';
  const shortTotalLength = getTwitterCharacterCount(content + shortCTA);
  
  if (shortTotalLength <= 280) {
    return content + shortCTA;
  }
  
  // Return original if no CTA fits
  return content;
}

/**
 * Truncates tweet content to fit within character limit
 * ENHANCED: Never cuts off mid-sentence, always ends at natural completion points
 * CRITICAL: URLs are ALWAYS preserved and never truncated
 */
export function truncateTweet(content: string, maxLength: number = 280): string {
  // USE THE PROPER URL PRESERVATION SYSTEM - NO MORE TRUNCATED URLS!
  return preserveUrlsInTweet(content, maxLength);
}

/**
 * Finds the best natural truncation point in content
 */
function findBestTruncationPoint(content: string, maxLength: number): string {
  // Priority 1: End at sentence boundary (. ! ?)
  const sentenceEnders = ['. ', '! ', '? '];
  for (const ender of sentenceEnders) {
    const lastSentence = content.lastIndexOf(ender);
    if (lastSentence > maxLength * 0.6) { // Must be at least 60% of desired length
      const truncated = content.substring(0, lastSentence + 1);
      console.log(`📝 Truncated at sentence boundary: "${truncated.slice(-20)}"`);
      return truncated;
    }
  }
  
  // Priority 2: End at clause boundary (, ; :)
  const clauseEnders = [', ', '; ', ': '];
  for (const ender of clauseEnders) {
    const lastClause = content.lastIndexOf(ender);
    if (lastClause > maxLength * 0.7) { // Must be at least 70% of desired length
      const truncated = content.substring(0, lastClause);
      console.log(`📝 Truncated at clause boundary: "${truncated.slice(-20)}"`);
      return truncated;
    }
  }
  
  // Priority 3: End at word boundary
  const words = content.split(' ');
  let truncated = '';
  for (const word of words) {
    if ((truncated + ' ' + word).length > maxLength) {
      break;
    }
    truncated += (truncated ? ' ' : '') + word;
  }
  
  // Ensure we don't end with incomplete phrases
  truncated = cleanupTruncatedEnding(truncated);
  
  console.log(`📝 Truncated at word boundary: "${truncated.slice(-20)}"`);
  return truncated;
}

/**
 * Cleans up truncated endings to avoid awkward cutoffs
 */
function cleanupTruncatedEnding(text: string): string {
  // Remove incomplete phrases that would be confusing
  const awkwardEndings = [
    ' with', ' and', ' or', ' but', ' the', ' a', ' an', ' of', ' in', ' on', ' at',
    ' for', ' to', ' from', ' by', ' as', ' is', ' are', ' was', ' were', ' has', ' have',
    ' can', ' will', ' would', ' could', ' should', ' may', ' might', ' this', ' that'
  ];
  
  for (const ending of awkwardEndings) {
    if (text.endsWith(ending)) {
      text = text.slice(0, -ending.length);
    }
  }
  
  // Ensure proper punctuation if we ended mid-sentence
  if (text && !text.match(/[.!?]$/)) {
    // If it looks like a complete thought, add period
    if (text.split(' ').length >= 3 && !text.includes(',')) {
      text += '.';
    }
  }
  
  return text.trim();
}

/**
 * Selects the most important hashtags to keep
 */
function selectImportantHashtags(hashtags: string[], content: string): string[] {
  // Prioritize hashtags that appear in the content or are health-tech related
  const healthTechTags = hashtags.filter(tag => 
    tag.toLowerCase().includes('health') || 
    tag.toLowerCase().includes('ai') || 
    tag.toLowerCase().includes('tech') ||
    tag.toLowerCase().includes('medical')
  );
  
  if (healthTechTags.length > 0) {
    return healthTechTags.slice(0, 2);
  }
  
  return hashtags.slice(0, 2);
}

/**
 * Emergency truncation when smart truncation isn't possible
 */
function emergencyTruncation(content: string, maxLength: number): string {
  console.log(`⚠️ Using emergency truncation for: "${content.substring(0, 50)}..."`);
  
  let truncated = content;
  while (getTwitterCharacterCount(truncated) > maxLength && truncated.length > 0) {
    // Remove from the end, but try to preserve URLs
    const urlMatch = truncated.match(/https?:\/\/[^\s]+$/);
    if (urlMatch) {
      // Remove content before URL instead
      const urlStart = truncated.lastIndexOf(urlMatch[0]);
      if (urlStart > 50) { // Keep some content
        truncated = truncated.substring(0, urlStart - 1) + ' ' + urlMatch[0];
      } else {
        truncated = truncated.slice(0, -1);
      }
    } else {
      truncated = truncated.slice(0, -1);
    }
  }
  
  return truncated.trim();
}

/**
 * Counts characters according to Twitter's counting rules
 * URLs count as 23 characters regardless of actual length
 */
function getTwitterCharacterCount(text: string): number {
  // Replace URLs with 23-character placeholder
  const urlRegex = /https?:\/\/[^\s]+/g;
  const textWithUrlsReplaced = text.replace(urlRegex, 'x'.repeat(23));
  
  return textWithUrlsReplaced.length;
}

/**
 * Checks if text contains emojis
 */
function containsEmojis(text: string): boolean {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(text);
}

/**
 * Checks if text contains hashtags
 */
function containsHashtags(text: string): boolean {
  return /#\w+/.test(text);
}

/**
 * Checks if text contains mentions
 */
function containsMentions(text: string): boolean {
  return /@\w+/.test(text);
}

/**
 * Extracts hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;
  
  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1]);
  }
  
  return hashtags;
}

/**
 * Extracts mentions from text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

/**
 * Cleans up tweet content for better readability
 */
export function cleanTweetContent(content: string): string {
  return content
    .trim()
    .replace(/\s+/g, ' ') // Remove extra whitespace
    .replace(/\.{3,}/g, '...') // Normalize ellipsis
    .replace(/!{2,}/g, '!') // Normalize exclamation marks
    .replace(/\?{2,}/g, '?'); // Normalize question marks
}

/**
 * Properly formats quotes in tweet content
 * Ensures quotes only wrap around actual quoted text, not hashtags or URLs
 */
export function formatQuotes(content: string): string {
  // Replace smart quotes with straight quotes first
  content = content.replace(/[""]/g, '"');
  content = content.replace(/['']/g, "'");
  
  // Handle the main case: quotes that wrap around content including hashtags
  // Pattern: "content with hashtags #tag1 #tag2"
  const quoteWithHashtagsAtEnd = /"([^"]*?)\s*(#\w+(?:\s+#\w+)*)\s*"/g;
  
  content = content.replace(quoteWithHashtagsAtEnd, (match, quotedContent, hashtags) => {
    // Clean up the quoted content
    const cleanQuote = quotedContent.trim();
    const cleanHashtags = hashtags.trim();
    
    // Return: "clean quote" hashtags
    return `"${cleanQuote}" ${cleanHashtags}`;
  });
  
  // Handle quotes that have hashtags mixed within
  const quoteWithMixedHashtags = /"([^"]*#[^"]*?)"/g;
  
  content = content.replace(quoteWithMixedHashtags, (match, quotedText) => {
    // Find where hashtags start
    const hashtagMatch = quotedText.match(/^(.*?)\s*(#\w+(?:\s+#\w+)*)(.*)$/);
    
    if (hashtagMatch) {
      const [, beforeHashtags, hashtags, afterHashtags] = hashtagMatch;
      
      if (afterHashtags.trim() === '') {
        // Hashtags are at the end - move them outside
        return `"${beforeHashtags.trim()}" ${hashtags}`;
      } else {
        // Hashtags are in the middle - this is more complex, keep as is for now
        return match;
      }
    }
    
    return match;
  });
  
  return content.trim();
} 