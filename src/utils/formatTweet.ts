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
 */
export function truncateTweet(content: string, maxLength: number = 280): string {
  if (getTwitterCharacterCount(content) <= maxLength) {
    return content;
  }

  // Truncate and add ellipsis
  let truncated = content;
  while (getTwitterCharacterCount(truncated + '...') > maxLength && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + '...';
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