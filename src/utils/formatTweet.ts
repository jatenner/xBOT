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
  allowHashtags?: boolean; // DEPRECATED - hashtags always removed for human voice
  allowMentions?: boolean;
}

/**
 * Advanced tweet formatting with improved truncation, emoji handling, and hashtag removal
 */

/**
 * Formats tweet content with human voice transformation
 */
export function formatTweet(
  content: string,
  options: TweetValidationOptions = {}
): FormattedTweet {
  const {
    maxLength = 280,
    allowEmojis = true,
    allowMentions = true
  } = options;

  console.log(`📝 Formatting tweet with human voice (${content.length} chars)`);

  // STEP 1: Remove ALL hashtags (critical for human voice)
  content = removeAllHashtags(content);
  console.log('🚫 Removed all hashtags for human voice');

  // STEP 2: Apply human voice transformation
  content = applyHumanVoiceTransformation(content);
  console.log('🗣️ Applied human voice transformation');

  // STEP 3: Clean and format content
  content = cleanTweetContent(content);

  // STEP 4: Truncate if necessary
  if (getTwitterCharacterCount(content) > maxLength) {
    content = truncateTweet(content, maxLength);
  }

  // STEP 5: Final validation
  const characterCount = getTwitterCharacterCount(content);
  const warnings: string[] = [];
  let isValid = true;

  if (characterCount > maxLength) {
    warnings.push(`Tweet too long: ${characterCount}/${maxLength} characters`);
    isValid = false;
  }

  if (!allowEmojis && containsEmojis(content)) {
    warnings.push('Emojis detected but not allowed');
    isValid = false;
  }

  if (!allowMentions && containsMentions(content)) {
    warnings.push('Mentions detected but not allowed');
    isValid = false;
  }

  // Check for any remaining hashtags (should be none)
  if (containsHashtags(content)) {
    warnings.push('CRITICAL: Hashtags still present after removal - human voice violation');
    isValid = false;
  }

  const result: FormattedTweet = {
    content: content.trim(),
    isValid,
    characterCount,
    warnings
  };

  console.log(`✅ Tweet formatted: ${characterCount}/${maxLength} chars, valid: ${isValid}`);
  if (warnings.length > 0) {
    console.log(`⚠️ Warnings: ${warnings.join(', ')}`);
  }

  return result;
}

/**
 * CRITICAL: Remove ALL hashtags from content
 */
function removeAllHashtags(content: string): string {
  // Remove hashtags completely - no exceptions for human voice
  let cleaned = content.replace(/#\w+\b/g, '');
  
  // Clean up extra spaces left by hashtag removal
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove any remaining hashtag-like patterns
  cleaned = cleaned.replace(/#[^\s]*/g, '');
  
  return cleaned;
}

/**
 * Transform content to human conversational voice
 */
function applyHumanVoiceTransformation(content: string): string {
  let humanized = content;

  // Convert academic language to conversational
  humanized = humanized.replace(/\bThis study shows\b/gi, 'We just learned');
  humanized = humanized.replace(/\bResearch demonstrates\b/gi, 'Researchers found');
  humanized = humanized.replace(/\bData indicates\b/gi, 'The data shows');
  humanized = humanized.replace(/\bResults suggest\b/gi, 'Turns out');
  humanized = humanized.replace(/\bStudies reveal\b/gi, 'Studies are showing');
  humanized = humanized.replace(/\bFindings show\b/gi, 'Here\'s what we discovered');

  // Add conversational starters for intrigue
  if (humanized.startsWith('Stanford') || humanized.startsWith('Harvard') || humanized.startsWith('MIT')) {
    humanized = 'Ever wonder why ' + humanized.toLowerCase() + '?';
  }
  
  if (humanized.toLowerCase().includes('breakthrough')) {
    humanized = humanized.replace(/breakthrough/gi, 'game-changing discovery');
  }

  // Use inclusive language
  humanized = humanized.replace(/\bpatients\b/gi, 'people');
  humanized = humanized.replace(/\bsubjects\b/gi, 'participants');
  humanized = humanized.replace(/\bOne can\b/gi, 'You can');
  humanized = humanized.replace(/\bIndividuals may\b/gi, 'You might');

  // Simplify academic terms
  humanized = humanized.replace(/\butilize\b/gi, 'use');
  humanized = humanized.replace(/\bdemonstrate\b/gi, 'show');
  humanized = humanized.replace(/\bfacilitate\b/gi, 'help');
  humanized = humanized.replace(/\bsignificantly\b/gi, 'dramatically');
  humanized = humanized.replace(/\bsubstantially\b/gi, 'massively');

  return humanized;
}

/**
 * Add SNAP2HEALTH CTA without hashtags
 */
export function addSnap2HealthCTA(content: string): string {
  const ctas = [
    '🏥 Follow for more health tech insights',
    '🔬 More breakthroughs coming daily',
    '🚀 Follow for cutting-edge health tech',
    '💡 Health tech insights you need',
    '🧬 Stay ahead of health innovation'
  ];
  
  const selectedCTA = ctas[Math.floor(Math.random() * ctas.length)];
  
  // Check if we have room for CTA
  const totalLength = getTwitterCharacterCount(content + '\n\n' + selectedCTA);
  
  if (totalLength <= 280) {
    return content + '\n\n' + selectedCTA;
  }
  
  return content;
}

/**
 * Intelligent tweet truncation that preserves meaning
 */
export function truncateTweet(content: string, maxLength: number = 280): string {
  if (getTwitterCharacterCount(content) <= maxLength) {
    return content;
  }

  console.log(`📏 Truncating tweet from ${getTwitterCharacterCount(content)} to ${maxLength} chars`);

  // Try smart truncation first
  let truncated = findBestTruncationPoint(content, maxLength);
  
  // If smart truncation didn't work, use emergency truncation
  if (getTwitterCharacterCount(truncated) > maxLength) {
    truncated = emergencyTruncation(truncated, maxLength);
  }

  return cleanupTruncatedEnding(truncated);
}

function findBestTruncationPoint(content: string, maxLength: number): string {
  // Remove URLs for length calculation, but preserve them
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = content.match(urlRegex) || [];
  let contentWithoutUrls = content.replace(urlRegex, 'URL_PLACEHOLDER');
  
  // Calculate available space (URLs count as 23 chars each)
  const urlCharCount = urls.length * 23;
  const availableSpace = maxLength - urlCharCount;
  
  if (contentWithoutUrls.length <= availableSpace) {
    return content; // No truncation needed
  }

  // Try to truncate at sentence boundaries
  const sentences = content.split(/[.!?]+/);
  let truncated = '';
  
  for (const sentence of sentences) {
    const testContent = truncated + sentence + '.';
    if (getTwitterCharacterCount(testContent) <= maxLength) {
      truncated = testContent;
    } else {
      break;
    }
  }
  
  if (truncated.length > 0) {
    console.log(`📝 Truncated at sentence boundary: "${truncated.slice(-30)}"`);
    return truncated;
  }

  // Fall back to word boundaries
  const words = content.split(' ');
  truncated = '';
  
  for (const word of words) {
    const testContent = truncated + (truncated ? ' ' : '') + word;
    if (getTwitterCharacterCount(testContent) <= maxLength - 3) { // Leave space for "..."
      truncated = testContent;
    } else {
      break;
    }
  }
  
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