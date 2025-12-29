/**
 * Reply Quality Gate (Fail-Closed)
 * 
 * Enforces reply-specific quality rules:
 * - No JSON artifacts ({ } [ ])
 * - Keyword overlap with parent tweet
 * - Not a standalone post
 * - Length ≤ 220 chars
 */

export interface ReplyQualityResult {
  passed: boolean;
  reason: string;
  issues: string[];
  overlapScore?: number;
}

/**
 * Check if reply meets quality standards
 * @param replyText Generated reply text
 * @param parentText Parent tweet text
 * @param attempt Attempt number (for logging)
 * @returns Quality check result
 */
export function checkReplyQuality(
  replyText: string,
  parentText: string,
  attempt: number = 1
): ReplyQualityResult {
  const issues: string[] = [];
  
  // Check 1: No JSON artifacts
  if (replyText.includes('{') || replyText.includes('}') || 
      replyText.includes('[') || replyText.includes(']')) {
    issues.push('Contains JSON artifacts ({ } [ ])');
  }
  
  // Check 2: Length ≤ 220 chars (stricter than Twitter's 280 for replies)
  if (replyText.length > 220) {
    issues.push(`Too long (${replyText.length} chars, max 220)`);
  }
  
  // Check 3: Keyword overlap with parent
  const overlapScore = calculateKeywordOverlap(replyText, parentText);
  if (overlapScore < 0.1) {
    issues.push(`Low keyword overlap (${(overlapScore * 100).toFixed(1)}%, min 10%)`);
  }
  
  // Check 4: NO THREAD MARKERS (CRITICAL - replies should never look like threads)
  const threadMarkers = [
    /^\d+\/\d+/,        // "1/5", "2/5", etc. at start
    /🧵/,                // Thread emoji
    /^\d+\.\s/,         // "1. ", "2. ", etc. at start
    /^Part \d+/i,       // "Part 1", "Part 2"
    /^Thread:/i         // "Thread:"
  ];
  
  for (const pattern of threadMarkers) {
    if (pattern.test(replyText)) {
      issues.push('Contains thread markers (replies must be single tweets)');
      break;
    }
  }
  
  // Check 5: Not a standalone post (generic openers)
  const standalonePatterns = [
    /^Emerging (trend|research|study)/i,
    /^New (research|study) shows/i,
    /^According to (research|studies)/i,
    /^Scientists (found|discovered)/i,
    /^A (recent )?study (shows|reveals)/i,
    /^Research suggests/i,
    /^Did you know that/i,
    /^Here are \d+ (tips|ways)/i,
    /^Let's explore/i,
    /^\d+\)/,  // Numbered list
    /^["\[]/ // Starts with quote or bracket
  ];
  
  // Check 6: No generic reply templates
  const genericPhrases = [
    /want to add value/i,
    /try this: after i/i,
    /struggling to stick/i,
    /great point/i,
    /interesting perspective/i,
    /here's how to/i,
    /check out these/i,
    /let me share/i,
    /dive deeper/i,
    /unlock your/i,
    /boost your/i,
    /transform your/i
  ];
  
  for (const pattern of standalonePatterns) {
    if (pattern.test(replyText)) {
      issues.push('Looks like standalone post, not a contextual reply');
      break;
    }
  }
  
  for (const pattern of genericPhrases) {
    if (pattern.test(replyText)) {
      issues.push('Generic template detected');
      break;
    }
  }
  
  // Determine pass/fail
  const passed = issues.length === 0;
  const reason = passed ? 'OK' : issues[0]; // First issue is primary reason
  
  // Log result
  if (passed) {
    console.log(`[REPLY_GATE] accepted=true reason=${reason} attempt=${attempt} overlap=${(overlapScore * 100).toFixed(1)}% chars=${replyText.length}`);
  } else {
    console.log(`[REPLY_GATE] accepted=false reason=${reason} attempt=${attempt} issues=${issues.length}`);
  }
  
  return {
    passed,
    reason,
    issues,
    overlapScore
  };
}

/**
 * Calculate keyword overlap between reply and parent tweet
 * @param replyText Reply text
 * @param parentText Parent tweet text
 * @returns Overlap score (0-1)
 */
function calculateKeywordOverlap(replyText: string, parentText: string): number {
  // Extract words (length > 3 to avoid common words)
  const replyWords = replyText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w));
  
  const parentWords = parentText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w));
  
  if (parentWords.length === 0) return 0;
  
  // Count overlapping words
  const overlaps = replyWords.filter(word => 
    parentWords.some(pw => pw.includes(word) || word.includes(pw))
  );
  
  return overlaps.length / Math.max(parentWords.length, 1);
}

/**
 * Check if word is a common stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = ['that', 'this', 'with', 'from', 'have', 'been', 'were', 'what', 'when', 'where', 'which', 'their', 'there', 'these', 'those'];
  return stopWords.includes(word.toLowerCase());
}

/**
 * Extract keywords from parent tweet for logging
 * @param parentText Parent tweet text
 * @returns Array of keywords
 */
export function extractKeywords(parentText: string): string[] {
  const words = parentText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4 && !isStopWord(w))
    .slice(0, 5); // Top 5 keywords
  
  return words;
}

