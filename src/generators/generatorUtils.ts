/**
 * GENERATOR UTILITIES
 * Shared validation and error handling for all generators
 */

export interface GeneratorResponse {
  content: string | string[];
  format: 'single' | 'thread';
  topic?: string;
  angle?: string;
}

/**
 * Smart content trimming that preserves word boundaries
 * Tries to trim at: 1) sentence boundary, 2) word boundary, 3) hard cut
 */
function smartTrim(text: string, maxLength: number = 280): string {
  if (text.length <= maxLength) return text;
  
  console.log(`[SMART_TRIM] Input: ${text.length} chars, max: ${maxLength}`);
  
  // Strategy 1: Find last complete sentence within limit
  const lastPeriod = text.lastIndexOf('.', maxLength - 3);
  const lastExclamation = text.lastIndexOf('!', maxLength - 3);
  const lastQuestion = text.lastIndexOf('?', maxLength - 3);
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.7) { // At least 70% of content preserved
    const result = text.substring(0, lastSentenceEnd + 1);
    console.log(`[SMART_TRIM] ✅ Trimmed at sentence boundary: ${result.length} chars`);
    return result;
  }
  
  // Strategy 2: Find last complete word within limit
  const lastSpace = text.lastIndexOf(' ', maxLength - 3);
  if (lastSpace > 0) {
    const result = text.substring(0, lastSpace) + '...';
    console.log(`[SMART_TRIM] ✅ Trimmed at word boundary: ${result.length} chars`);
    return result;
  }
  
  // Strategy 3: Hard trim (should rarely happen)
  const result = text.substring(0, maxLength - 3) + '...';
  console.log(`[SMART_TRIM] ⚠️ Hard trim fallback: ${result.length} chars`);
  return result;
}

export function validateAndExtractContent(
  parsed: any,
  format: 'single' | 'thread',
  generatorName: string
): string | string[] {
  // Try multiple fields that GPT might use
  let content = parsed.content || parsed.tweet || parsed.tweets || parsed.thread;
  
  // SAFETY: Ensure content exists
  if (!content || (Array.isArray(content) && content.length === 0)) {
    console.error(`[${generatorName}] ❌ GPT returned empty content:`, parsed);
    throw new Error(`${generatorName} generator returned empty content`);
  }
  
  // Validate thread format
  if (format === 'thread') {
    if (!Array.isArray(content)) {
      console.warn(`[${generatorName}] ⚠️ Thread format but content is not array, converting...`);
      // If it's a string with line breaks, split it
      if (typeof content === 'string' && content.includes('\n\n')) {
        content = content.split('\n\n').map(t => t.trim()).filter(t => t.length > 0);
      } else {
        content = [content];
      }
    }
    
    // Validate each tweet in thread
    if (content.length === 0) {
      throw new Error(`${generatorName} generator returned empty thread array`);
    }
    
    // SMART TRIM: Preserve word boundaries for thread tweets
    const MAX_THREAD_TWEET_LENGTH = 260; // Increased buffer - matches generator instructions
    content = content.map((tweet: string, i: number) => {
      if (tweet.length > MAX_THREAD_TWEET_LENGTH) {
        console.warn(`[${generatorName}] ⚠️ Thread tweet ${i+1} too long (${tweet.length} chars), using smart trim...`);
        const trimmed = smartTrim(tweet, MAX_THREAD_TWEET_LENGTH);
        console.log(`[${generatorName}] ✅ Smart-trimmed tweet ${i+1} to ${trimmed.length} chars`);
        return trimmed;
      }
      return tweet;
    });
    
    console.log(`[${generatorName}] ✅ Thread validated: ${content.length} tweets, all under ${MAX_THREAD_TWEET_LENGTH} chars`);
  }
  
  // Validate single format
  if (format === 'single') {
    if (Array.isArray(content)) {
      console.warn(`[${generatorName}] ⚠️ Single format but content is array, using first item...`);
      content = content[0] || '';
    }
    
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error(`${generatorName} generator returned invalid single tweet`);
    }
    
    // SMART TRIM: Preserve word boundaries if content exceeds limit
    const MAX_SINGLE_TWEET_LENGTH = 280; // Twitter absolute limit
    if (content.length > MAX_SINGLE_TWEET_LENGTH) {
      console.warn(`[${generatorName}] ⚠️ Tweet too long (${content.length} chars), using smart trim...`);
      content = smartTrim(content, MAX_SINGLE_TWEET_LENGTH);
      console.log(`[${generatorName}] ✅ Smart-trimmed to ${content.length} chars`);
    }
    
    console.log(`[${generatorName}] ✅ Single tweet validated: ${content.length} chars`);
  }
  
  return content;
}

export function createFallbackContent(
  format: 'single' | 'thread',
  topic: string,
  generatorName: string
): string | string[] {
  if (format === 'thread') {
    return [
      `New research on ${topic} reveals surprising findings.`,
      `The data shows mechanisms we didn't expect.`,
      `This changes how we think about optimization.`,
      `Practical implications: specific protocols to implement.`
    ];
  } else {
    return `Recent ${topic} research reveals unexpected mechanisms that change optimization strategies.`;
  }
}
