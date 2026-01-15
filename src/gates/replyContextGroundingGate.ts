/**
 * 🔒 REPLY CONTEXT GROUNDING GATE
 * 
 * Enforces that replies must explicitly reference at least 1 keyphrase
 * from the target tweet (or extracted caption/alt text).
 * 
 * If not grounded, blocks with UNGROUNDED_REPLY.
 */

export interface ContextGroundingResult {
  pass: boolean;
  deny_reason_code?: 'UNGROUNDED_REPLY';
  reason: string;
  grounding_evidence?: {
    matched_keyphrases: string[];
    matched_method: 'direct' | 'paraphrase' | 'quote';
  };
}

/**
 * Extract keyphrases from target text (non-stopwords, length > 4)
 */
function extractKeyphrases(text: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'what', 'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'whose'
  ]);
  
  // Extract words and phrases
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w));
  
  // Also extract 2-word phrases
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (phrase.length > 8) { // Minimum phrase length
      phrases.push(phrase);
    }
  }
  
  // Combine words and phrases, prioritize longer phrases
  const keyphrases = [...phrases, ...words].slice(0, 15); // Top 15 keyphrases
  
  return keyphrases;
}

/**
 * Check if reply contains direct reference to keyphrase
 */
function hasDirectReference(replyText: string, keyphrases: string[]): { matched: string[]; method: 'direct' } | null {
  const replyLower = replyText.toLowerCase();
  const matched: string[] = [];
  
  for (const phrase of keyphrases) {
    if (replyLower.includes(phrase)) {
      matched.push(phrase);
    }
  }
  
  if (matched.length > 0) {
    return { matched, method: 'direct' as const };
  }
  
  return null;
}

/**
 * Check if reply contains a quoted snippet (6-12 words) from target
 */
function hasQuotedSnippet(replyText: string, targetText: string): { matched: string[]; method: 'quote' } | null {
  const replyLower = replyText.toLowerCase();
  const targetLower = targetText.toLowerCase();
  
  // Extract 6-12 word sequences from target
  const targetWords = targetLower.split(/\s+/).filter(w => w.length > 0);
  const matchedSequences: string[] = [];
  
  for (let len = 6; len <= 12 && len <= targetWords.length; len++) {
    for (let i = 0; i <= targetWords.length - len; i++) {
      const sequence = targetWords.slice(i, i + len).join(' ');
      if (replyLower.includes(sequence)) {
        matchedSequences.push(sequence);
      }
    }
  }
  
  if (matchedSequences.length > 0) {
    return { matched: matchedSequences.slice(0, 3), method: 'quote' as const };
  }
  
  return null;
}

/**
 * Check if reply contains author handle + paraphrase marker
 */
function hasAuthorParaphrase(replyText: string, targetText: string, authorUsername?: string): { matched: string[]; method: 'paraphrase' } | null {
  if (!authorUsername) return null;
  
  const replyLower = replyText.toLowerCase();
  const authorLower = authorUsername.toLowerCase().replace('@', '');
  
  // Check for patterns like "your point about X", "you mentioned X", "as you said about X"
  const paraphrasePatterns = [
    new RegExp(`(your|you|@${authorLower})\\s+(point|mention|said|noted|discussed|asked|wrote|shared)\\s+(about|regarding|on|that|how|why|what)\\s+([\\w\\s]+)`, 'i'),
    new RegExp(`(your|you|@${authorLower})\\s+([\\w\\s]+)\\s+(point|claim|question|statement|observation)`, 'i'),
  ];
  
  const matched: string[] = [];
  for (const pattern of paraphrasePatterns) {
    const match = replyText.match(pattern);
    if (match) {
      matched.push(match[0]);
    }
  }
  
  if (matched.length > 0) {
    return { matched, method: 'paraphrase' as const };
  }
  
  return null;
}

/**
 * Check if reply contains >=2 target keywords (excluding stopwords)
 */
function hasTargetKeywords(replyText: string, targetText: string): { matched: string[]; method: 'direct' } | null {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  ]);
  
  const targetWords = targetText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w));
  
  const replyLower = replyText.toLowerCase();
  const matched: string[] = [];
  
  for (const word of targetWords) {
    if (replyLower.includes(word)) {
      matched.push(word);
    }
  }
  
  if (matched.length >= 2) {
    return { matched: [...new Set(matched)].slice(0, 5), method: 'direct' as const };
  }
  
  return null;
}

/**
 * Check if reply paraphrases or quotes the target claim
 */
function hasParaphraseOrQuote(replyText: string, targetText: string, authorUsername?: string): { matched: string[]; method: 'paraphrase' | 'quote' } | null {
  const replyLower = replyText.toLowerCase();
  const targetLower = targetText.toLowerCase();
  
  // Check for quoted snippet (6-12 words)
  const quoteMatch = hasQuotedSnippet(replyText, targetText);
  if (quoteMatch) {
    return quoteMatch;
  }
  
  // Check for author handle + paraphrase marker
  const authorMatch = hasAuthorParaphrase(replyText, targetText, authorUsername);
  if (authorMatch) {
    return authorMatch;
  }
  
  // Check for >=2 target keywords
  const keywordMatch = hasTargetKeywords(replyText, targetText);
  if (keywordMatch) {
    return keywordMatch;
  }
  
  // Extract numbers and specific terms from target
  const targetNumbers = targetLower.match(/\d+[%kmg]?/g) || [];
  const targetSpecificTerms = targetLower.match(/\b\d+\s*(percent|mg|g|kg|minutes?|hours?|days?|weeks?|months?|years?)\b/g) || [];
  
  // Check if reply contains any numbers from target
  const matchedNumbers: string[] = [];
  for (const num of [...targetNumbers, ...targetSpecificTerms]) {
    if (replyLower.includes(num)) {
      matchedNumbers.push(num);
    }
  }
  
  if (matchedNumbers.length > 0) {
    return { matched: matchedNumbers, method: 'paraphrase' as const };
  }
  
  return null;
}

/**
 * Verify context grounding - reply must reference target tweet
 * 
 * Pass if one of:
 * - contains a short quoted snippet from target (6-12 words)
 * - contains >=2 target keywords (excluding stopwords)
 * - contains author handle + paraphrase marker (e.g. "your point about <keyword>")
 */
export function verifyContextGrounding(
  replyText: string,
  targetText: string,
  extractedCaption?: string,
  extractedAltText?: string,
  authorUsername?: string
): ContextGroundingResult {
  // Combine all target context sources
  const allTargetContext = [
    targetText,
    extractedCaption || '',
    extractedAltText || ''
  ].filter(t => t.length > 0).join(' ');
  
  if (allTargetContext.length < 10) {
    // If target context is too short, allow (edge case)
    return {
      pass: true,
      reason: 'Target context too short for grounding check',
      grounding_evidence: {
        matched_keyphrases: [],
        matched_method: 'direct'
      }
    };
  }
  
  // Extract keyphrases from target
  const keyphrases = extractKeyphrases(allTargetContext);
  
  if (keyphrases.length === 0) {
    // No keyphrases extracted, allow (edge case)
    return {
      pass: true,
      reason: 'No keyphrases extracted from target',
      grounding_evidence: {
        matched_keyphrases: [],
        matched_method: 'direct'
      }
    };
  }
  
  // Check for direct reference
  const directMatch = hasDirectReference(replyText, keyphrases);
  if (directMatch && directMatch.matched.length > 0) {
    return {
      pass: true,
      reason: `Reply contains direct reference to ${directMatch.matched.length} keyphrase(s)`,
      grounding_evidence: {
        matched_keyphrases: directMatch.matched.slice(0, 5),
        matched_method: directMatch.method
      }
    };
  }
  
  // Check for paraphrase or quote (with author username if available)
  const paraphraseMatch = hasParaphraseOrQuote(replyText, targetText, authorUsername);
  if (paraphraseMatch && paraphraseMatch.matched.length > 0) {
    return {
      pass: true,
      reason: `Reply contains ${paraphraseMatch.method} reference`,
      grounding_evidence: {
        matched_keyphrases: paraphraseMatch.matched.slice(0, 5),
        matched_method: paraphraseMatch.method
      }
    };
  }
  
  // No grounding found - BLOCK
  return {
    pass: false,
    deny_reason_code: 'UNGROUNDED_REPLY',
    reason: `Reply does not reference target tweet (checked ${keyphrases.length} keyphrases)`,
    grounding_evidence: {
      matched_keyphrases: [],
      matched_method: 'direct'
    }
  };
}
