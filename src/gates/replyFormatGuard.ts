/**
 * 🔒 REPLY FORMAT GUARD - Enforce single-tweet reply format
 */

export interface FormatCheckResult {
  pass: boolean;
  reason: string;
  action: 'post' | 'regen' | 'skip';
  stats: {
    length: number;
    lineBreaks: number;
    hasThreadMarkers: boolean;
  };
}

/**
 * Check if reply meets format requirements for SINGLE tweet
 */
export function checkReplyFormat(content: string): FormatCheckResult {
  const trimmed = content.trim();
  const length = trimmed.length;
  
  // Count line breaks (normalize \r\n to \n)
  const normalized = trimmed.replace(/\r\n/g, '\n');
  const lineBreaks = (normalized.match(/\n/g) || []).length;
  
  // Check for thread markers
  const threadMarkers = [
    /\b\d+\/\d+\b/,           // "1/5", "2/3" etc
    /\(\d+\)/,                 // "(1)", "(2)" etc
    /🧵/,                      // Thread emoji
    /\bthread\b/i,             // Word "thread"
    /^\d+\./,                  // "1.", "2." at start
    /\.\.\./,                  // Ellipsis (often indicates continuation)
  ];
  
  const hasThreadMarkers = threadMarkers.some(pattern => pattern.test(trimmed));
  
  // Check for generic health PSA phrasing
  const genericPhrases = [
    /^Studies show/i,
    /^Research shows/i,
    /^Research suggests/i,
    /^Interestingly,/i,
    /^Did you know/i,
    /^Fun fact:/i,
  ];
  
  const hasGenericOpening = genericPhrases.some(pattern => pattern.test(trimmed));
  
  const stats = {
    length,
    lineBreaks,
    hasThreadMarkers,
  };
  
  // RULE 1: Max 260 chars (buffer for safety)
  if (length > 260) {
    console.log(`[REPLY_FORMAT] pass=false len=${length} reason=too_long action=regen`);
    return {
      pass: false,
      reason: 'too_long',
      action: 'regen',
      stats,
    };
  }
  
  // RULE 2: No thread markers
  if (hasThreadMarkers) {
    console.log(`[REPLY_FORMAT] pass=false reason=thread_markers action=regen`);
    return {
      pass: false,
      reason: 'thread_markers',
      action: 'regen',
      stats,
    };
  }
  
  // RULE 3: Max 2 line breaks (prefer 0-1)
  if (lineBreaks > 2) {
    console.log(`[REPLY_FORMAT] pass=false lines=${lineBreaks} reason=too_many_breaks action=regen`);
    return {
      pass: false,
      reason: 'too_many_line_breaks',
      action: 'regen',
      stats,
    };
  }
  
  // RULE 4: Warn if generic opening (but allow)
  if (hasGenericOpening) {
    console.log(`[REPLY_FORMAT] pass=true len=${length} lines=${lineBreaks} reason=ok_but_generic action=post`);
  } else {
    console.log(`[REPLY_FORMAT] pass=true len=${length} lines=${lineBreaks} reason=ok action=post`);
  }
  
  return {
    pass: true,
    reason: 'ok',
    action: 'post',
    stats,
  };
}

/**
 * Collapse excessive line breaks to make reply more compact
 */
export function collapseLineBreaks(content: string): string {
  // Normalize line endings
  let normalized = content.replace(/\r\n/g, '\n');
  
  // Replace 3+ consecutive newlines with 2
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  
  // Replace 2+ consecutive newlines with 1 if total > 2 line breaks
  const lineBreaks = (normalized.match(/\n/g) || []).length;
  if (lineBreaks > 2) {
    normalized = normalized.replace(/\n{2,}/g, '\n');
  }
  
  return normalized.trim();
}

