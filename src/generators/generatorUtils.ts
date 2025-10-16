/**
 * GENERATOR UTILITIES
 * Shared validation and error handling for all generators
 */

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

