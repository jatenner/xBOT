/**
 * 🔒 REPLY OUTPUT CONTRACT - Hard enforcement before posting
 * Guarantees single-reply format with strict validation
 */

export interface ReplyContractResult {
  pass: boolean;
  sanitized?: string;
  reason?: string;
  stats: {
    length: number;
    lineBreaks: number;
    hasThreadMarkers: boolean;
    hasMultipleParagraphs: boolean;
  };
}

const THREAD_MARKERS = [
  /\b\d+\/\d+\b/,           // "1/5", "2/3"
  /\(\d+\)/,                 // "(1)", "(2)"
  /🧵/,                      // Thread emoji
  /\bthread\b/i,             // Word "thread"
  /👇/,                      // Pointing down
  /\bPart\s+\d+/i,           // "Part 1"
  /\bcontinued\b/i,          // "continued"
  /^\d+\.\s/m,               // "1. ", "2. " at start of line
  /\bPROTOCOL:/i,            // "PROTOCOL:"
  /\bTIP:/i,                 // "TIP:"
];

/**
 * Sanitize reply to meet contract requirements
 */
function sanitizeReply(content: string): string {
  let sanitized = content;
  
  // Remove thread markers
  sanitized = sanitized.replace(/\b\d+\/\d+\b/g, '');
  sanitized = sanitized.replace(/\(\d+\)/g, '');
  sanitized = sanitized.replace(/🧵/g, '');
  sanitized = sanitized.replace(/\bthread\b/gi, '');
  sanitized = sanitized.replace(/👇/g, '');
  sanitized = sanitized.replace(/\bPart\s+\d+/gi, '');
  sanitized = sanitized.replace(/\bcontinued\b/gi, '');
  
  // Collapse excessive whitespace (3+ newlines → 2)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // If still too long, truncate at sentence boundary
  if (sanitized.length > 260) {
    // Find last sentence end before 260 chars
    const truncated = sanitized.substring(0, 260);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');
    const lastEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);
    
    if (lastEnd > 100) {
      sanitized = truncated.substring(0, lastEnd + 1);
    } else {
      sanitized = truncated + '...';
    }
  }
  
  // Collapse multiple paragraphs to single paragraph if > 2 line breaks
  const lineBreaks = (sanitized.match(/\n/g) || []).length;
  if (lineBreaks > 2) {
    // Keep first paragraph only
    const firstParagraph = sanitized.split(/\n\n+/)[0];
    sanitized = firstParagraph;
  }
  
  return sanitized.trim();
}

/**
 * Validate reply against output contract
 */
export function validateReplyContract(content: string): ReplyContractResult {
  const trimmed = content.trim();
  const length = trimmed.length;
  const lineBreaks = (trimmed.match(/\n/g) || []).length;
  
  // Check for thread markers
  const hasThreadMarkers = THREAD_MARKERS.some(pattern => pattern.test(trimmed));
  
  // Check for multiple paragraphs (blank line separators)
  const paragraphs = trimmed.split(/\n\n+/).filter(p => p.trim().length > 0);
  const hasMultipleParagraphs = paragraphs.length > 2;
  
  // Check for bullet lists (more than 2 bullets)
  const bullets = trimmed.match(/^[•\-\*\d+\.]\s/gm) || [];
  const hasBulletList = bullets.length > 2;
  
  const stats = {
    length,
    lineBreaks,
    hasThreadMarkers,
    hasMultipleParagraphs,
  };
  
  // RULE 1: Max 260 chars
  if (length > 260) {
    console.log(`[REPLY_CONTRACT] fail len=${length} reason=too_long max=260`);
    
    // Try sanitize
    const sanitized = sanitizeReply(trimmed);
    const newCheck = validateReplyContract(sanitized);
    if (newCheck.pass) {
      console.log(`[REPLY_CONTRACT] sanitize_success old_len=${length} new_len=${sanitized.length}`);
      return { pass: true, sanitized, stats };
    }
    
    return { pass: false, reason: 'too_long', stats };
  }
  
  // RULE 2: Max 2 line breaks (3 lines max)
  if (lineBreaks > 2) {
    console.log(`[REPLY_CONTRACT] fail lines=${lineBreaks + 1} reason=too_many_lines max=3`);
    
    // Try sanitize
    const sanitized = sanitizeReply(trimmed);
    const newCheck = validateReplyContract(sanitized);
    if (newCheck.pass) {
      console.log(`[REPLY_CONTRACT] sanitize_success old_lines=${lineBreaks + 1} new_lines=${(sanitized.match(/\n/g) || []).length + 1}`);
      return { pass: true, sanitized, stats };
    }
    
    return { pass: false, reason: 'too_many_lines', stats };
  }
  
  // RULE 3: No thread markers
  if (hasThreadMarkers) {
    console.log(`[REPLY_CONTRACT] fail reason=thread_markers`);
    
    // Try sanitize
    const sanitized = sanitizeReply(trimmed);
    const newCheck = validateReplyContract(sanitized);
    if (newCheck.pass) {
      console.log(`[REPLY_CONTRACT] sanitize_success removed_thread_markers`);
      return { pass: true, sanitized, stats };
    }
    
    return { pass: false, reason: 'thread_markers', stats };
  }
  
  // RULE 4: No multiple paragraphs
  if (hasMultipleParagraphs) {
    console.log(`[REPLY_CONTRACT] fail paragraphs=${paragraphs.length} reason=multiple_paragraphs max=2`);
    
    // Try sanitize
    const sanitized = sanitizeReply(trimmed);
    const newCheck = validateReplyContract(sanitized);
    if (newCheck.pass) {
      console.log(`[REPLY_CONTRACT] sanitize_success kept_first_paragraph`);
      return { pass: true, sanitized, stats };
    }
    
    return { pass: false, reason: 'multiple_paragraphs', stats };
  }
  
  // RULE 5: No long bullet lists
  if (hasBulletList) {
    console.log(`[REPLY_CONTRACT] fail bullets=${bullets.length} reason=bullet_list max=2`);
    return { pass: false, reason: 'bullet_list', stats };
  }
  
  // All checks passed
  console.log(`[REPLY_CONTRACT] pass=true len=${length} lines=${lineBreaks + 1}`);
  return { pass: true, stats };
}

/**
 * Hash content for logging (first 8 chars of hex)
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

