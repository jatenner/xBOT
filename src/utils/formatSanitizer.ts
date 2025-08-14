/**
 * FORMAT-AWARE SANITIZER
 * 
 * Removes thread language, numbering tokens, and format-specific content
 * to ensure clean single posts and proper thread formatting.
 */

export type FinalFormat = "single" | "thread" | "longform_single";

// Thread language patterns to remove from singles
const THREAD_PATTERNS = [
  // Thread indicators
  /🧵/gi,
  /\bthread\b/gi,
  /follow this thread/gi,
  /more in the thread/gi,
  /see next tweet/gi,
  /\bcontinued\b/gi,
  /next in thread/gi,
  /in the next tweet/gi,
  
  // Numbering patterns
  /\bpart\s+\d+\b/gi,
  /\b\d+\/\d+\b/g,                // 1/7, 2/5, etc.
  /\(\d+\/\d+\)/g,                // (1/7), (2/5), etc.
  /\b\d+\/\b/g,                   // 1/, 2/, etc.
  /\b\d+\.\)\b/g,                 // 1.), 2.), etc.
  /\b\d+\)\b/g,                   // 1), 2), etc.
  /^\s*\d+\.\s*/gm,               // 1., 2., etc. at start of line
  /^\s*\d+\.\)\s*/gm,             // 2.), 3.), etc. at start of line
  
  // Direction indicators when used as "read below"
  /👇(?:\s*(?:read|see|check|more)\s*(?:below|down)?)?/gi,
  
  // Dangling thread phrases
  /,?\s*in the next tweet,?/gi,
  /,?\s*next in thread,?/gi,
  /,?\s*continued below,?/gi,
  /,?\s*see thread,?/gi,
];

/**
 * Main sanitizer function that removes format-inappropriate content
 */
export function sanitizeForFormat(input: string, finalFormat: FinalFormat): string {
  let text = input.trim();
  
  if (finalFormat === "single" || finalFormat === "longform_single") {
    // Remove all thread language and numbering for singles
    text = stripThreadPhrases(text);
    text = stripLeadingNumbering(text);
    text = fixSpacingAndCase(text);
  } else if (finalFormat === "thread") {
    // For threads, only strip forced numbering but keep natural content
    text = stripLeadingNumbering(text);
  }
  
  return text.trim();
}

/**
 * Remove thread-specific phrases and indicators
 */
export function stripThreadPhrases(text: string): string {
  let cleaned = text;
  
  for (const pattern of THREAD_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned;
}

/**
 * Remove leading numbering tokens from sentences
 */
export function stripLeadingNumbering(text: string): string {
  let cleaned = text;
  
  // Remove leading numbering patterns at start of sentences
  const leadingPatterns = [
    /^\s*\d+\.\)\s*/,               // "2.) Something" - check this first
    /^\s*\d+\.\s*/,                 // "1. Something"
    /^\s*\d+\)\s*/,                 // "1) Something"
    /^\s*\d+\/\d+\s*/,              // "1/7 Something"
    /^\s*\(\d+\/\d+\)\s*/,          // "(1/7) Something"
    /^\s*\d+\/\s*/,                 // "1/ Something"
  ];
  
  for (const pattern of leadingPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove numbering at start of new sentences within the text
  cleaned = cleaned.replace(/\.\s+\d+\.\s+/g, '. ');
  cleaned = cleaned.replace(/\.\s+\d+\)\s+/g, '. ');
  cleaned = cleaned.replace(/\.\s+\d+\/\d+\s+/g, '. ');
  
  return cleaned;
}

/**
 * Fix spacing and capitalization after token removal
 */
function fixSpacingAndCase(text: string): string {
  let fixed = text;
  
  // Fix multiple spaces
  fixed = fixed.replace(/\s+/g, ' ');
  
  // Clean up orphaned parentheses and brackets first
  fixed = fixed.replace(/^\s*[\(\)]+\s*/g, '');
  fixed = fixed.replace(/\s*[\(\)]+\s*$/g, '');
  
  // Clean up orphaned punctuation marks from removed patterns
  fixed = fixed.replace(/^\s*[.,;:)\]}\-]+\s*/g, '');
  fixed = fixed.replace(/\s*[.,;:(\[{\-]+\s*$/g, '');
  
  // Fix spacing around punctuation
  fixed = fixed.replace(/\s+([.,!?;:])/g, '$1');
  fixed = fixed.replace(/([.,!?;:])\s*([A-Za-z])/g, '$1 $2');
  
  // Fix capitalization after sentence breaks
  fixed = fixed.replace(/([.!?])\s+([a-z])/g, (match, punct, letter) => {
    return punct + ' ' + letter.toUpperCase();
  });
  
  // Capitalize first letter if needed
  if (fixed.length > 0 && /[a-z]/.test(fixed[0])) {
    fixed = fixed[0].toUpperCase() + fixed.slice(1);
  }
  
  // Ensure proper sentence ending
  if (fixed.length > 0 && !/[.!?]$/.test(fixed.trim()) && fixed.trim().length > 0) {
    // Only add period if it doesn't end with other punctuation or emoji
    if (!/[.!?:;,)]$/.test(fixed.trim()) && !/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]$/u.test(fixed.trim())) {
      fixed = fixed.trim() + '.';
    }
  }
  
  return fixed;
}

/**
 * Check if text still contains thread language (for final validation)
 */
export function containsThreadLanguage(text: string): boolean {
  const checkPatterns = [
    /🧵/gi,
    /follow this thread/gi,
    /next tweet/gi,
    /\d+\/\d+/g,
    /\(\d+\/\d+\)/g,
    /thread\b/gi,
    /continued/gi,
  ];
  
  return checkPatterns.some(pattern => pattern.test(text));
}

/**
 * Get a summary of what was sanitized for logging
 */
export function getSanitizationSummary(original: string, sanitized: string): string[] {
  const actions: string[] = [];
  
  if (original.includes('🧵') && !sanitized.includes('🧵')) {
    actions.push('thread_emoji');
  }
  
  if (/\d+\/\d+/.test(original) && !/\d+\/\d+/.test(sanitized)) {
    actions.push('numbering');
  }
  
  if (/follow this thread/gi.test(original) && !/follow this thread/gi.test(sanitized)) {
    actions.push('thread_cta');
  }
  
  if (/\bthread\b/gi.test(original) && !/\bthread\b/gi.test(sanitized)) {
    actions.push('thread_language');
  }
  
  if (original.length !== sanitized.length) {
    actions.push('content_trimmed');
  }
  
  return actions.length > 0 ? actions : ['none'];
}