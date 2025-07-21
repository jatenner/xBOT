/**
 * 🧠 GLOBAL CONTENT INTERCEPTOR
 * 
 * Automatically intercepts ALL content before posting to:
 * - Remove hashtags completely
 * - Make content sound human and natural
 * - Add conversational tone
 */

// Global flag to enable/disable the interceptor
let HUMAN_CONTENT_INTERCEPTOR_ENABLED = true;

/**
 * Remove all hashtags from content
 */
function removeAllHashtags(content: string): string {
  return content
    .replace(/#\w+/g, '') // Remove all hashtags
    .replace(/\s+/g, ' ') // Clean up extra spaces
    .trim();
}

/**
 * Make content sound human and conversational
 */
function humanizeContent(content: string): string {
  let humanContent = content;
  
  // Remove hashtags first (mandatory)
  humanContent = removeAllHashtags(humanContent);
  
  // Add natural contractions
  humanContent = humanContent
    .replace(/\bcannot\b/gi, "can't")
    .replace(/\bdo not\b/gi, "don't") 
    .replace(/\bwill not\b/gi, "won't")
    .replace(/\bit is\b/gi, "it's")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bwhat is\b/gi, "what's")
    .replace(/\bwho is\b/gi, "who's")
    .replace(/\bwhere is\b/gi, "where's")
    .replace(/\bhow is\b/gi, "how's")
    .replace(/\bwe are\b/gi, "we're")
    .replace(/\bthey are\b/gi, "they're")
    .replace(/\byou are\b/gi, "you're")
    .replace(/\bi am\b/gi, "I'm")
    .replace(/\bhe is\b/gi, "he's")
    .replace(/\bshe is\b/gi, "she's")
    .replace(/\bthere is\b/gi, "there's")
    .replace(/\bhere is\b/gi, "here's");
  
  // Replace robotic phrases with human ones
  humanContent = humanContent
    .replace(/\bThoughts\?\s*$/gi, "What's your take?")
    .replace(/\bWhat do you think\?\s*$/gi, "Anyone else notice this?")
    .replace(/\bBreaking:/gi, "Just saw:")
    .replace(/\bKey takeaway:/gi, "What strikes me:")
    .replace(/\bGame changer/gi, "pretty significant")
    .replace(/\bRevolutionary/gi, "remarkable")
    .replace(/\bCutting-edge/gi, "latest")
    .replace(/\bState-of-the-art/gi, "advanced")
    .replace(/\bFollow for more/gi, "")
    .replace(/\bLike and retweet/gi, "")
    .replace(/\bDon't forget to/gi, "")
    .replace(/\bMake sure to/gi, "");
  
  // Add conversational starters if content is too formal
  const conversationalStarters = [
    "Been thinking about this:",
    "Something I've noticed:",
    "Just came across this:",
    "Here's what's interesting:",
    "What caught my attention:",
    "I keep seeing this pattern:",
    "One thing I've learned:",
    "This is fascinating:"
  ];
  
  // If content starts too formally, make it conversational
  if (/^(The|A|An|Most|Many|Some|AI|Machine|Technology|Healthcare|Studies show|Research indicates)/i.test(humanContent)) {
    const starter = conversationalStarters[Math.floor(Math.random() * conversationalStarters.length)];
    humanContent = `${starter} ${humanContent.charAt(0).toLowerCase() + humanContent.slice(1)}`;
  }
  
  // Clean up spacing
  humanContent = humanContent.replace(/\s+/g, ' ').trim();
  
  return humanContent;
}

/**
 * 🚨 GLOBAL CONTENT FILTER
 * This function automatically processes ALL content before posting
 */
export function globalContentFilter(content: string): string {
  if (!HUMAN_CONTENT_INTERCEPTOR_ENABLED) {
    return content;
  }
  
  console.log('🧠 Global content interceptor: Making content human...');
  
  let processedContent = humanizeContent(content);
  
  // Emergency hashtag check
  if (processedContent.includes('#')) {
    console.log('🚫 Emergency hashtag removal activated');
    processedContent = removeAllHashtags(processedContent);
  }
  
  // Final validation
  if (processedContent.includes('#')) {
    console.log('🚨 CRITICAL: Force removing any remaining hashtags');
    processedContent = processedContent.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
  }
  
  console.log('✅ Content humanized and hashtag-free');
  return processedContent;
}

/**
 * Enable/disable the global interceptor
 */
export function setGlobalInterceptor(enabled: boolean): void {
  HUMAN_CONTENT_INTERCEPTOR_ENABLED = enabled;
  console.log(`🧠 Global content interceptor: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Check if interceptor is enabled
 */
export function isInterceptorEnabled(): boolean {
  return HUMAN_CONTENT_INTERCEPTOR_ENABLED;
}

// Ensure interceptor is enabled by default
setGlobalInterceptor(true); 