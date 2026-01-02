/**
 * 🎯 CONTEXT ANCHOR GUARD - Ensure replies reference the original tweet
 */

export interface AnchorCheckResult {
  pass: boolean;
  matched: string[];
  reason: string;
  action: 'post' | 'regen' | 'skip';
}

const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
  'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
  'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
  'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day',
  'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did',
  'having', 'may', 'such'
]);

/**
 * Extract meaningful keywords from tweet (4+ chars, not stopwords)
 */
export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length >= 4 && !STOPWORDS.has(word));
  
  // Deduplicate and return top 7
  const unique = [...new Set(words)];
  return unique.slice(0, 7);
}

/**
 * Check if reply references the original tweet content
 */
export function checkContextAnchor(
  replyContent: string,
  rootTweetContent: string
): AnchorCheckResult {
  const replyLower = replyContent.toLowerCase();
  const keywords = extractKeywords(rootTweetContent);
  
  if (keywords.length === 0) {
    // Root tweet too short or generic - pass anyway
    console.log(`[REPLY_ANCHOR] pass=true reason=no_keywords_in_root action=post`);
    return {
      pass: true,
      matched: [],
      reason: 'no_keywords_in_root',
      action: 'post',
    };
  }
  
  // Check for direct keyword matches
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (replyLower.includes(keyword)) {
      matched.push(keyword);
    }
  }
  
  // Pass if at least 1 keyword matched
  if (matched.length > 0) {
    console.log(`[REPLY_ANCHOR] pass=true matched=${JSON.stringify(matched)} action=post`);
    return {
      pass: true,
      matched,
      reason: 'ok',
      action: 'post',
    };
  }
  
  // Check for paraphrases/related terms (simple heuristic)
  // If reply is very short and root tweet is long, be more lenient
  if (replyContent.length < 100 && rootTweetContent.length > 150) {
    console.log(`[REPLY_ANCHOR] pass=true matched=[] reason=short_reply_lenient action=post`);
    return {
      pass: true,
      matched: [],
      reason: 'short_reply_lenient',
      action: 'post',
    };
  }
  
  // No match found
  console.log(`[REPLY_ANCHOR] pass=false matched=[] keywords=${JSON.stringify(keywords)} action=regen`);
  return {
    pass: false,
    matched: [],
    reason: 'no_keyword_match',
    action: 'regen',
  };
}

/**
 * Build regeneration instruction referencing specific root tweet content
 */
export function buildAnchorRegenerationInstruction(
  rootTweetContent: string,
  keywords: string[]
): string {
  const primaryKeyword = keywords[0] || 'the topic';
  
  return `Your first line must directly reference the original tweet's point about ${primaryKeyword}. Quote or paraphrase their specific claim, then add your insight.`;
}

