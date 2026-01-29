/**
 * Grounding Phrase Extractor for PLAN_ONLY decisions
 * 
 * Deterministically extracts 2-4 exact phrases (2-6 words each) from target tweet snapshot
 * for enforcement in reply generation.
 */

/**
 * Extract 2-4 exact phrases (2-6 words each) from target tweet content
 * Deterministic: same input always produces same phrases
 * Robust: strips leading/trailing punctuation, avoids emoji-only, prefers nouns/keywords
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
 * Check if reply contains at least 2 of the required grounding phrases
 * Uses normalized comparison to handle smart quotes, apostrophes, whitespace
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
  const matchedPhrases: string[] = [];
  const missingPhrases: string[] = [];
  
  for (const phrase of requiredPhrases) {
    const phraseNormalized = normalizeForGrounding(phrase);
    if (replyNormalized.includes(phraseNormalized)) {
      matchedPhrases.push(phrase);
    } else {
      missingPhrases.push(phrase);
    }
  }
  
  // Require at least 2 phrases to match (or 1 if only 1 phrase available)
  const minRequired = requiredPhrases.length === 1 ? 1 : 2;
  const passed = matchedPhrases.length >= minRequired;
  
  return { passed, matchedPhrases, missingPhrases };
}
