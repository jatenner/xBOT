/**
 * Grounding Phrase Extractor for PLAN_ONLY decisions
 * 
 * Deterministically extracts 2-4 exact phrases (2-6 words each) from target tweet snapshot
 * for enforcement in reply generation.
 */

/**
 * Extract anchor tokens (2-3 clean words) from target tweet content
 * Improved: filters out garbage tokens, possessives, broken handles
 * Returns clean, human-readable anchor tokens for explicit prompt inclusion
 */
export function extractAnchorTokens(snapshot: string): string[] {
  if (!snapshot || snapshot.length < 20) {
    return [];
  }
  
  // Normalize: lowercase, remove extra whitespace
  const normalized = snapshot
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split into words and clean them
  const words = normalized
    .split(/\s+/)
    .map(w => {
      // Remove leading/trailing punctuation
      w = w.replace(/^[^\w]+|[^\w]+$/g, '');
      // Remove possessives ('s, s')
      w = w.replace(/'s$|s'$/g, '');
      // Remove trailing apostrophes
      w = w.replace(/'+$/g, '');
      return w;
    })
    .filter(w => {
      // Filter criteria:
      // - Length >= 4 chars (meaningful tokens)
      if (w.length < 4) return false;
      // - Not a URL or handle
      if (w.startsWith('http') || w.startsWith('@') || w.includes('://')) return false;
      // - Not mostly symbols
      const symbolCount = (w.match(/[^\w]/g) || []).length;
      if (symbolCount > w.length / 2) return false;
      // - Not a broken handle (ends with partial handle)
      if (w.match(/[a-z]+'s$/i) && w.length < 8) return false;
      // - Not a stopword
      const stopwords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should']);
      if (stopwords.has(w)) return false;
      return true;
    });
  
  if (words.length < 2) {
    // Fallback: return compact quote snippet if too short
    const snippet = snapshot.substring(0, Math.min(60, snapshot.length)).trim();
    return snippet.length >= 10 ? [snippet] : [];
  }
  
  // Score tokens (prefer nouns/verbs, longer words, avoid common words)
  const scoredTokens: Array<{ token: string; score: number }> = [];
  const commonWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'what', 'when', 'where', 'which', 'there', 'their', 'they', 'them', 'these', 'those']);
  
  for (const token of words) {
    let score = token.length; // Longer = better
    if (token.length >= 6) score += 2; // Prefer longer words
    if (token.length >= 8) score += 1; // Even longer
    if (!commonWords.has(token)) score += 1; // Avoid common words
    // Prefer words that look like nouns/verbs (simple heuristic: length >= 5)
    if (token.length >= 5 && !token.match(/^(ing|ed|er|ly)$/)) score += 1;
    
    scoredTokens.push({ token, score });
  }
  
  // Sort by score (descending)
  scoredTokens.sort((a, b) => b.score - a.score);
  
  // Select top 2-3 anchor tokens
  const anchors = scoredTokens.slice(0, 3).map(t => t.token);
  
  return anchors.length >= 2 ? anchors : (anchors.length === 1 ? [anchors[0], words.find(w => w !== anchors[0] && w.length >= 4) || anchors[0]] : []);
}

/**
 * Extract 2-4 exact phrases (2-6 words each) from target tweet content
 * Deterministic: same input always produces same phrases
 * Robust: strips leading/trailing punctuation, avoids emoji-only, prefers nouns/keywords
 * 
 * @deprecated Use extractAnchorTokens for better anchor selection
 */
export function extractGroundingPhrases(snapshot: string): string[] {
  if (!snapshot || snapshot.length < 20) {
    return [];
  }
  
  // Normalize: lowercase, remove extra whitespace
  const normalized = snapshot
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split into words (preserve original for phrase extraction)
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length < 2) {
    // Fallback: return compact quote snippet if too short
    const snippet = snapshot.substring(0, Math.min(60, snapshot.length)).trim();
    return snippet.length >= 10 ? [snippet] : [];
  }
  
  // Extract phrases of 2-6 words
  const phrases: Array<{ phrase: string; score: number; start: number; length: number }> = [];
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'what', 'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'whose'
  ]);
  
  // Extract phrases starting from each word position
  for (let start = 0; start < words.length - 1; start++) {
    // Try phrases of length 2-6 words
    for (let len = 2; len <= 6 && start + len <= words.length; len++) {
      const phraseWords = words.slice(start, start + len);
      
      // Skip if phrase is mostly stopwords
      const nonStopwordCount = phraseWords.filter(w => !stopwords.has(w)).length;
      if (nonStopwordCount < 1) {
        continue;
      }
      
      // Get original phrase from snapshot (preserve capitalization/punctuation for verbatim matching)
      const originalStart = snapshot.toLowerCase().indexOf(phraseWords[0]);
      const originalEnd = originalStart + phraseWords.join(' ').length;
      let originalPhrase = snapshot.substring(
        Math.max(0, originalStart),
        Math.min(snapshot.length, originalEnd)
      ).trim();
      
      // Strip leading/trailing punctuation (but keep internal punctuation)
      originalPhrase = originalPhrase.replace(/^[^\w]+|[^\w]+$/g, '').trim();
      
      // Skip emoji-only tokens (check if phrase is mostly emoji)
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
      const emojiCount = (originalPhrase.match(emojiRegex) || []).length;
      if (emojiCount > phraseWords.length / 2) {
        continue;
      }
      
      const phrase = phraseWords.join(' ');
      
      // Prefer phrases with numbers, proper nouns, or specific terms
      const hasNumber = /\d/.test(phrase);
      const hasProperNoun = /\b[A-Z][a-z]+\b/.test(originalPhrase);
      const hasSpecificTerm = phraseWords.some(w => w.length >= 5 && !stopwords.has(w));
      const hasNoun = phraseWords.some(w => w.length >= 4 && !stopwords.has(w));
      
      // Score phrase (higher = better)
      let score = nonStopwordCount;
      if (hasNumber) score += 2;
      if (hasProperNoun) score += 2;
      if (hasSpecificTerm) score += 1;
      if (hasNoun) score += 1;
      
      phrases.push({
        phrase: originalPhrase || phrase, // Use original if available, fallback to normalized
        score,
        start,
        length: len
      });
    }
  }
  
  // Sort by score (descending), then by position (ascending) for determinism
  phrases.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.start - b.start;
  });
  
  // Remove overlapping phrases (keep higher-scoring ones)
  const selected: string[] = [];
  const usedPositions = new Set<number>();
  
  for (const item of phrases) {
    const { phrase, start, length } = item;
    
    // Check if this phrase overlaps with already selected phrases
    let overlaps = false;
    for (let i = start; i < start + length; i++) {
      if (usedPositions.has(i)) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps && selected.length < 4) {
      selected.push(phrase);
      for (let i = start; i < start + length; i++) {
        usedPositions.add(i);
      }
    }
  }
  
  // Return 2-4 phrases (prefer 3-4 if available), or 1 if only 1 good phrase found
  if (selected.length === 0) {
    // Fallback: return compact quote snippet
    const snippet = snapshot.substring(0, Math.min(60, snapshot.length)).trim();
    return snippet.length >= 10 ? [snippet] : [];
  }
  
  return selected.slice(0, Math.max(1, Math.min(4, selected.length)));
}

/**
 * Normalize text for grounding phrase comparison
 * Handles smart quotes, apostrophes, whitespace, and case
 */
export function normalizeForGrounding(text: string): string {
  return text
    .toLowerCase()
    // Normalize smart quotes to regular quotes
    .replace(/[''""]/g, "'")
    .replace(/[""]/g, '"')
    // Normalize apostrophes
    .replace(/[''`]/g, "'")
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract tokens (words >= 4 chars) from text for overlap matching
 */
function extractTokens(text: string): Set<string> {
  const normalized = normalizeForGrounding(text);
  const tokens = normalized
    .split(/\s+/)
    .map(t => t.replace(/[^\w]/g, '')) // Remove punctuation
    .filter(t => t.length >= 4); // Only tokens >= 4 chars
  return new Set(tokens);
}

/**
 * Check if reply contains required anchor tokens
 * Strict but realistic: requires both anchors verbatim OR 1 anchor + 3 token overlaps
 * 
 * Rules (for anchor-based grounding):
 * - 2+ anchor tokens appear verbatim (case-insensitive, punctuation-normalized) OR
 * - 1 anchor token verbatim + 3+ token overlaps (tokens >= 4 chars)
 * 
 * This is stricter than phrase matching but more reliable when anchors are clean tokens.
 */
export function verifyAnchorTokens(replyText: string, anchorTokens: string[]): {
  passed: boolean;
  matchedAnchors: string[];
  missingAnchors: string[];
  tokenOverlaps: string[];
  tokenOverlapCount: number;
} {
  if (anchorTokens.length === 0) {
    return { passed: true, matchedAnchors: [], missingAnchors: [], tokenOverlaps: [], tokenOverlapCount: 0 };
  }
  
  const replyNormalized = normalizeForGrounding(replyText);
  const replyTokens = extractTokens(replyText);
  const matchedAnchors: string[] = [];
  const missingAnchors: string[] = [];
  
  // Check exact anchor token matches (verbatim)
  for (const anchor of anchorTokens) {
    const anchorNormalized = normalizeForGrounding(anchor);
    // Check if anchor appears as a word boundary match (not substring)
    const anchorRegex = new RegExp(`\\b${anchorNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (anchorRegex.test(replyNormalized)) {
      matchedAnchors.push(anchor);
    } else {
      missingAnchors.push(anchor);
    }
  }
  
  // Extract tokens from anchor tokens for overlap check
  const anchorTokenSet = new Set<string>();
  for (const anchor of anchorTokens) {
    const anchorTokensExtracted = extractTokens(anchor);
    anchorTokensExtracted.forEach(t => anchorTokenSet.add(t));
  }
  
  // Count token overlaps
  const tokenOverlaps = Array.from(replyTokens).filter(t => anchorTokenSet.has(t));
  const tokenOverlapCount = tokenOverlaps.length;
  
  // Determine if grounding passes
  // Rule 1: Both anchors appear verbatim
  if (matchedAnchors.length >= 2) {
    return { passed: true, matchedAnchors, missingAnchors, tokenOverlaps: Array.from(tokenOverlaps), tokenOverlapCount };
  }
  
  // Rule 2: 1 anchor verbatim + 3+ token overlaps
  if (matchedAnchors.length >= 1 && tokenOverlapCount >= 3) {
    return { passed: true, matchedAnchors, missingAnchors, tokenOverlaps: Array.from(tokenOverlaps), tokenOverlapCount };
  }
  
  // Failed: insufficient grounding
  return { passed: false, matchedAnchors, missingAnchors, tokenOverlaps: Array.from(tokenOverlaps), tokenOverlapCount };
}

/**
 * Check if reply contains at least 2 of the required grounding phrases OR sufficient token overlap
 * Uses normalized comparison + token overlap for robustness
 * 
 * Rules:
 * - 2+ exact phrase matches (case-insensitive, punctuation-normalized) OR
 * - 1 exact phrase + 2+ token overlaps (tokens >= 4 chars) OR
 * - 4+ token overlaps (if no exact phrases)
 */
export function verifyGroundingPhrases(replyText: string, requiredPhrases: string[]): {
  passed: boolean;
  matchedPhrases: string[];
  missingPhrases: string[];
} {
  if (requiredPhrases.length === 0) {
    return { passed: true, matchedPhrases: [], missingPhrases: [] };
  }
  
  const replyNormalized = normalizeForGrounding(replyText);
  const replyTokens = extractTokens(replyText);
  const matchedPhrases: string[] = [];
  const missingPhrases: string[] = [];
  
  // Check exact phrase matches
  for (const phrase of requiredPhrases) {
    const phraseNormalized = normalizeForGrounding(phrase);
    if (replyNormalized.includes(phraseNormalized)) {
      matchedPhrases.push(phrase);
    } else {
      missingPhrases.push(phrase);
    }
  }
  
  // Extract tokens from all required phrases for overlap check
  const allRequiredTokens = new Set<string>();
  for (const phrase of requiredPhrases) {
    const phraseTokens = extractTokens(phrase);
    phraseTokens.forEach(t => allRequiredTokens.add(t));
  }
  
  // Count token overlaps (tokens that appear in both reply and required phrases)
  const tokenOverlaps = Array.from(replyTokens).filter(t => allRequiredTokens.has(t));
  const tokenOverlapCount = tokenOverlaps.length;
  
  // Determine if grounding passes
  // Rule 1: 2+ exact phrase matches (or 1 if only 1 phrase available)
  const minRequiredPhrases = requiredPhrases.length === 1 ? 1 : 2;
  if (matchedPhrases.length >= minRequiredPhrases) {
    return { passed: true, matchedPhrases, missingPhrases };
  }
  
  // Rule 2: 1 exact phrase + 2+ token overlaps
  if (matchedPhrases.length >= 1 && tokenOverlapCount >= 2) {
    return { passed: true, matchedPhrases, missingPhrases };
  }
  
  // Rule 3: 4+ token overlaps (if no exact phrases, require more tokens)
  if (matchedPhrases.length === 0 && tokenOverlapCount >= 4) {
    return { passed: true, matchedPhrases, missingPhrases };
  }
  
  // Rule 4: 3+ token overlaps if we have 1 phrase match (relaxed for edge cases)
  if (matchedPhrases.length >= 1 && tokenOverlapCount >= 3) {
    return { passed: true, matchedPhrases, missingPhrases };
  }
  
  // Failed: insufficient grounding
  return { passed: false, matchedPhrases, missingPhrases };
}
