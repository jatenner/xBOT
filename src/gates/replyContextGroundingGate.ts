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
 * Check if reply paraphrases or quotes the target claim
 */
function hasParaphraseOrQuote(replyText: string, targetText: string): { matched: string[]; method: 'paraphrase' | 'quote' } | null {
  const replyLower = replyText.toLowerCase();
  const targetLower = targetText.toLowerCase();
  
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
  
  // Check for quote-like patterns (repeating exact phrases)
  const targetWords = targetLower.split(/\s+/).filter(w => w.length > 5);
  const replyWords = replyLower.split(/\s+/);
  
  // Find 3+ word sequences that appear in both
  for (let i = 0; i <= targetWords.length - 3; i++) {
    const sequence = targetWords.slice(i, i + 3).join(' ');
    if (replyLower.includes(sequence)) {
      return { matched: [sequence], method: 'quote' as const };
    }
  }
  
  return null;
}

/**
 * Verify context grounding - reply must reference target tweet
 */
export function verifyContextGrounding(
  replyText: string,
  targetText: string,
  extractedCaption?: string,
  extractedAltText?: string
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
  
  // Check for paraphrase or quote
  const paraphraseMatch = hasParaphraseOrQuote(replyText, targetText);
  if (paraphraseMatch && paraphraseMatch.matched.length > 0) {
    return {
      pass: true,
      reason: `Reply contains paraphrase/quote reference`,
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
