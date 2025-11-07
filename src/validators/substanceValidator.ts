/**
 * 🚫 SUBSTANCE VALIDATOR
 * 
 * Rejects hollow, incomplete, or valueless content before it gets posted
 * NO MORE QUESTIONS WITHOUT ANSWERS
 */

export interface SubstanceValidation {
  isValid: boolean;
  reason?: string;
  score: number; // 0-100
}

/**
 * Validates that content has actual substance and value
 */
export function validateSubstance(content: string | string[]): SubstanceValidation {
  const textToCheck = Array.isArray(content) ? content.join(' ') : content;
  const text = textToCheck.toLowerCase();
  
  // RED FLAGS: Content that's just questions/titles with no substance
  
  // 1. Just a question with no answer
  if (/^(what if|why|how|when|where)\s.+\?$/.test(text.trim()) && textToCheck.length < 100) {
    return {
      isValid: false,
      reason: 'Just a question with no answer or details',
      score: 0
    };
  }
  
  // 2. Starts with "The Surprising Role of" or similar title-like patterns
  if (/^the (surprising|hidden|secret|unexpected|unknown) (role|impact|power|effect) of/i.test(text)) {
    return {
      isValid: false,
      reason: 'Title-like format with no substance',
      score: 10
    };
  }
  
  // 2.5. "What if everything we think about..." pattern
  if (/^what if everything we think about/i.test(text)) {
    return {
      isValid: false,
      reason: 'Hollow "what if everything" pattern with no substance',
      score: 5
    };
  }
  
  // 3. Just "Myth: X" or "Truth: Y" without elaboration
  if (/^myth:/i.test(text) && text.length < 80) {
    return {
      isValid: false,
      reason: 'Incomplete myth-busting format',
      score: 15
    };
  }
  
  // 4. Generic "New research shows" without details
  if (/^new research shows/i.test(text) && !/\d+%|\d+x|n=\d+/i.test(text)) {
    return {
      isValid: false,
      reason: 'Generic research claim without specific data',
      score: 20
    };
  }
  
  // 5. Too short to have any substance (single tweets should be 180+ chars)
  if (!Array.isArray(content) && textToCheck.length < 120) {
    return {
      isValid: false,
      reason: `Too short (${textToCheck.length} chars) - needs substance`,
      score: 25
    };
  }
  
  // 6. Thread tweets where each is too short (should be 150+ chars each)
  if (Array.isArray(content)) {
    const shortTweets = content.filter(t => t.length < 100);
    if (shortTweets.length > content.length / 2) {
      return {
        isValid: false,
        reason: `Thread has ${shortTweets.length} tweets under 100 chars - too hollow`,
        score: 30
      };
    }
  }
  
  // 7. Just meta-commentary without actual content
  const metaPhrases = ['consider', 'think about', 'what if we', 'imagine if', 'question whether'];
  const metaCount = metaPhrases.filter(phrase => text.includes(phrase)).length;
  const hasNumbers = /\d+/.test(text);
  const hasSpecifics = /study|research|data|evidence|found|shows|discovered/i.test(text);
  
  if (metaCount >= 2 && !hasNumbers && !hasSpecifics) {
    return {
      isValid: false,
      reason: 'Just philosophical musing without facts or data',
      score: 35
    };
  }
  
  // 8. No actionable information, specific details, or insights
  const hasValue = 
    hasNumbers ||
    hasSpecifics ||
    /try|protocol|action|instead|actually|here's how|works via/i.test(text) ||
    /because|due to|leads to|causes|affects/i.test(text);
  
  if (!hasValue) {
    return {
      isValid: false,
      reason: 'No specific information, data, or actionable insights',
      score: 40
    };
  }
  
  // CALCULATE SUBSTANCE SCORE
  let score = 50; // Base score if we got here
  
  // +10 for specific numbers/percentages
  if (/\d+%/.test(text)) score += 10;
  if (/\d+x/.test(text)) score += 10;
  if (/n=\d+/.test(text)) score += 10;
  
  // +10 for specific citations
  if (/(harvard|stanford|mit|yale|oxford|johns hopkins) \d{4}/i.test(text)) score += 10;
  
  // +10 for mechanisms
  if (/(works via|happens because|due to|leads to|via|through)/i.test(text)) score += 10;
  
  // +10 for actionable advice
  if (/(try|protocol|instead|action|here's how)/i.test(text)) score += 10;
  
  // +10 for good length
  if (!Array.isArray(content) && textToCheck.length >= 200) score += 10;
  if (Array.isArray(content) && content.every(t => t.length >= 150)) score += 10;
  
  // THRESHOLD: Need at least 55/100 to pass (was 70 - too strict)
  // ✅ FIX: Reduced from 70 to 55 to allow quality content without rigid citation requirements
  const isValid = score >= 55;
  
  return {
    isValid,
    reason: isValid ? undefined : `Substance score too low: ${score}/100`,
    score
  };
}

/**
 * Validates that content answers any question it poses
 */
export function validateCompleteness(content: string | string[]): boolean {
  const text = Array.isArray(content) ? content.join(' ') : content;
  
  // Check if starts with question
  const startsWithQuestion = /^(what if|why|how|when|where|who)/i.test(text.trim());
  
  if (!startsWithQuestion) {
    return true; // Not a question, so completeness doesn't apply
  }
  
  // If it's a question, make sure there's an answer
  // Questions should have at least 200 chars to include the answer
  if (text.length < 200) {
    console.warn('[SUBSTANCE] Question without answer:', text.substring(0, 100));
    return false;
  }
  
  // Make sure there's substance after the question
  const hasAnswer = 
    /study|research|data|evidence|because|actually|turns out|here's|works via/i.test(text) &&
    /\d+/.test(text); // Has numbers
  
  if (!hasAnswer) {
    console.warn('[SUBSTANCE] Question without substantive answer');
    return false;
  }
  
  return true;
}

/**
 * Master validation: Combines all checks
 */
export function validateContentSubstance(content: string | string[]): {
  isValid: boolean;
  reason: string;
  score: number;
} {
  console.log('[SUBSTANCE] Validating content substance...');
  
  // Check substance
  const substanceCheck = validateSubstance(content);
  if (!substanceCheck.isValid) {
    console.error(`[SUBSTANCE] ❌ Failed: ${substanceCheck.reason} (${substanceCheck.score}/100)`);
    return {
      isValid: false,
      reason: substanceCheck.reason || 'Substance check failed',
      score: substanceCheck.score
    };
  }
  
  // Check completeness
  const completeCheck = validateCompleteness(content);
  if (!completeCheck) {
    return {
      isValid: false,
      reason: 'Content poses question but doesn\'t answer it',
      score: 45
    };
  }
  
  console.log(`[SUBSTANCE] ✅ Valid content (score: ${substanceCheck.score}/100)`);
  
  return {
    isValid: true,
    reason: 'Content has substance and value',
    score: substanceCheck.score
  };
}

