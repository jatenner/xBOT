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
 * Validate content length - NO TRIMMING, only validation
 * If content is too long, we should REGENERATE, not trim
 */
function validateLength(text: string, context: string): string {
  const TWITTER_LIMIT = 280;
  const RECOMMENDED_MAX = 270;
  
  if (text.length > TWITTER_LIMIT) {
    console.error(`[VALIDATION] ❌ ${context}: ${text.length} chars exceeds Twitter's 280 limit`);
    throw new Error(`Content too long (${text.length} chars). Must regenerate under 280.`);
  }
  
  if (text.length > RECOMMENDED_MAX) {
    console.warn(`[VALIDATION] ⚠️ ${context}: ${text.length} chars (recommended max: 270)`);
    // Still valid, just log the warning
  }
  
  if (text.length < 50) {
    console.error(`[VALIDATION] ❌ ${context}: Only ${text.length} chars (too short, likely low quality)`);
    throw new Error(`Content too short (${text.length} chars). Must be at least 50.`);
  }
  
  return text; // Return unchanged - we validate, never trim!
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
    
    // VALIDATE: Check each tweet in thread (no trimming!)
    content.forEach((tweet: string, i: number) => {
      validateLength(tweet, `${generatorName} thread tweet ${i+1}`);
    });
    
    console.log(`[${generatorName}] ✅ Thread validated: ${content.length} tweets, all valid`);
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
    
    // VALIDATE: Check length (no trimming!)
    content = validateLength(content, `${generatorName} single tweet`);
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
