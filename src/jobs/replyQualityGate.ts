/**
 * 🛡️ REPLY QUALITY GATE
 * Ensures replies are short, contextual, and engaging
 */

/**
 * Calculate keyword overlap between reply and root tweet
 */
function calculateOverlap(replyText: string, rootText: string): number {
  const replyWords = replyText
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3); // Only words > 3 chars
  
  const rootWords = new Set(
    rootText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
  
  if (replyWords.length === 0) return 0;
  
  const overlapping = replyWords.filter(w => rootWords.has(w));
  return overlapping.length / replyWords.length;
}

/**
 * Check if reply has a strong ending (question or punchline)
 */
function hasStrongEnding(text: string): boolean {
  const trimmed = text.trim();
  
  // Check for question
  if (trimmed.endsWith('?')) return true;
  
  // Check for short punchline (last sentence is 3-8 words)
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const lastSentence = sentences[sentences.length - 1].trim();
    const wordCount = lastSentence.split(/\s+/).length;
    if (wordCount >= 3 && wordCount <= 8) {
      return true;
    }
  }
  
  return false;
}

export interface QualityCheckResult {
  pass: boolean;
  issues: string[];
  length: number;
  overlap: number;
  hasStrongEnding: boolean;
}

/**
 * Validate reply quality
 */
export function validateReplyQuality(
  replyText: string,
  rootTweetText: string
): QualityCheckResult {
  const issues: string[] = [];
  
  // Check 1: Length (must be <= 200 chars)
  if (replyText.length > 200) {
    issues.push(`too_long (${replyText.length} chars, max 200)`);
  }
  
  // Check 2: No thread markers
  if (replyText.match(/\d+\/\d+/) || replyText.includes('🧵')) {
    issues.push('contains_thread_markers');
  }
  
  // Check 3: No excessive newlines
  if (replyText.split('\n').length > 2) {
    issues.push('too_many_newlines');
  }
  
  // Check 4: Root overlap (must have some connection)
  const overlap = calculateOverlap(replyText, rootTweetText);
  if (overlap < 0.1) {
    issues.push(`low_root_overlap (${(overlap * 100).toFixed(1)}%, min 10%)`);
  }
  
  // Check 5: Strong ending
  const strongEnding = hasStrongEnding(replyText);
  if (!strongEnding) {
    issues.push('weak_ending (no question or punchline)');
  }
  
  const pass = issues.length === 0;
  
  if (!pass) {
    console.log(`[REPLY_QUALITY] ❌ Failed: ${issues.join(', ')}`);
  } else {
    console.log(`[REPLY_QUALITY] ✅ Passed: len=${replyText.length} overlap=${(overlap * 100).toFixed(1)}% strongEnding=${strongEnding}`);
  }
  
  return {
    pass,
    issues,
    length: replyText.length,
    overlap,
    hasStrongEnding: strongEnding,
  };
}

