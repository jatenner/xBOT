/**
 * Grounding Phrase Extractor for PLAN_ONLY decisions
 * 
 * Deterministically extracts 2-4 exact phrases (2-6 words each) from target tweet snapshot
 * for enforcement in reply generation.
 */

/**
 * Extract 2-4 exact phrases (2-6 words each) from target tweet content
 * Deterministic: same input always produces same phrases
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
  
  // Split into words
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length < 2) {
    return [];
  }
  
  // Extract phrases of 2-6 words
  const phrases: string[] = [];
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
      
      const phrase = phraseWords.join(' ');
      
      // Prefer phrases with numbers, proper nouns, or specific terms
      const hasNumber = /\d/.test(phrase);
      const hasProperNoun = /\b[a-z]*[A-Z][a-z]*\b/.test(snapshot.substring(
        normalized.indexOf(phraseWords[0]),
        normalized.indexOf(phraseWords[len - 1]) + phraseWords[len - 1].length
      ));
      const hasSpecificTerm = phraseWords.some(w => w.length >= 5 && !stopwords.has(w));
      
      // Score phrase (higher = better)
      let score = nonStopwordCount;
      if (hasNumber) score += 2;
      if (hasProperNoun) score += 2;
      if (hasSpecificTerm) score += 1;
      
      phrases.push({
        phrase,
        score,
        start,
        length: len
      } as any);
    }
  }
  
  // Sort by score (descending), then by position (ascending) for determinism
  phrases.sort((a: any, b: any) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.start - b.start;
  });
  
  // Remove overlapping phrases (keep higher-scoring ones)
  const selected: string[] = [];
  const usedPositions = new Set<number>();
  
  for (const item of phrases) {
    const { phrase, start, length } = item as any;
    
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
  
  // Return 2-4 phrases (prefer 3-4 if available)
  return selected.slice(0, Math.max(2, Math.min(4, selected.length)));
}

/**
 * Check if reply contains at least 2 of the required grounding phrases
 */
export function verifyGroundingPhrases(replyText: string, requiredPhrases: string[]): {
  passed: boolean;
  matchedPhrases: string[];
  missingPhrases: string[];
} {
  if (requiredPhrases.length === 0) {
    return { passed: true, matchedPhrases: [], missingPhrases: [] };
  }
  
  const replyLower = replyText.toLowerCase();
  const matchedPhrases: string[] = [];
  const missingPhrases: string[] = [];
  
  for (const phrase of requiredPhrases) {
    const phraseLower = phrase.toLowerCase();
    if (replyLower.includes(phraseLower)) {
      matchedPhrases.push(phrase);
    } else {
      missingPhrases.push(phrase);
    }
  }
  
  // Require at least 2 phrases to match
  const passed = matchedPhrases.length >= 2;
  
  return { passed, matchedPhrases, missingPhrases };
}
