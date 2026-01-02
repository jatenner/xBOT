/**
 * 🎯 CONTEXT ANCHOR GUARD - Ensure replies reference the original tweet with echo
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
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !STOPWORDS.has(word));
  
  const unique = [...new Set(words)];
  return unique.slice(0, 7);
}

/**
 * Extract key phrases (2-3 word meaningful sequences)
 */
function extractKeyPhrases(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
  
  const phrases: string[] = [];
  
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(`${words[i]} ${words[i+1]}`);
  }
  
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
  }
  
  return phrases;
}

/**
 * Check if reply includes an "echo clause" that paraphrases the root tweet
 */
export function hasEchoClause(replyContent: string, rootTweetContent: string): boolean {
  const echoPatterns = [
    /you'?re (basically |essentially )?saying/i,
    /if (the |your )?point is/i,
    /(right|exactly)[,\s]+(the|your) (key|point|claim)/i,
    /that'?s (a )?great (point|observation)/i,
    /makes sense[,\s]+/i,
    /^(so|that|this) (means|suggests|shows)/i,
  ];
  
  const hasEchoPattern = echoPatterns.some(pattern => pattern.test(replyContent));
  
  const rootPhrases = extractKeyPhrases(rootTweetContent);
  const replyPhrases = extractKeyPhrases(replyContent);
  
  const sharedPhrases = rootPhrases.filter(phrase => 
    replyPhrases.some(rp => rp.includes(phrase) || phrase.includes(rp))
  );
  
  return hasEchoPattern || sharedPhrases.length > 0;
}

/**
 * Extract the echo text from reply (first sentence or clause)
 */
function extractEchoText(replyContent: string): string {
  const firstSentence = replyContent.split(/[.!?]/)[0];
  return firstSentence.substring(0, 50) + (firstSentence.length > 50 ? '...' : '');
}

/**
 * Check if reply references the original tweet with echo + context
 */
export function checkContextAnchor(
  replyContent: string,
  rootTweetContent: string
): AnchorCheckResult {
  const replyLower = replyContent.toLowerCase();
  const keywords = extractKeywords(rootTweetContent);
  
  if (keywords.length === 0) {
    console.log(`[REPLY_CONTEXT] pass=true reason=no_keywords_in_root echo=N/A`);
    return {
      pass: true,
      matched: [],
      reason: 'no_keywords_in_root',
      action: 'post',
    };
  }
  
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (replyLower.includes(keyword)) {
      matched.push(keyword);
    }
  }
  
  const hasEcho = hasEchoClause(replyContent, rootTweetContent);
  
  if (hasEcho || matched.length > 0) {
    const echoText = hasEcho ? extractEchoText(replyContent) : 'N/A';
    console.log(`[REPLY_CONTEXT] pass=true echo="${echoText}" matched=${JSON.stringify(matched)} action=post`);
    return {
      pass: true,
      matched,
      reason: 'ok',
      action: 'post',
    };
  }
  
  console.log(`[REPLY_CONTEXT] pass=false echo=false matched=[] keywords=${JSON.stringify(keywords)} action=regen`);
  return {
    pass: false,
    matched: [],
    reason: 'no_echo_or_keywords',
    action: 'regen',
  };
}

/**
 * Build regeneration instruction requiring echo
 */
export function buildAnchorRegenerationInstruction(
  rootTweetContent: string,
  keywords: string[]
): string {
  const excerpt = rootTweetContent.substring(0, 80) + (rootTweetContent.length > 80 ? '...' : '');
  
  return `Your first sentence must echo their claim: "${excerpt}". Use a pattern like "You're saying X..." or "That point about X...". Then add your insight in 1-2 more lines.`;
}
