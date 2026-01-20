/**
 * 🎯 REPLY TARGET QUALITY FILTER
 * 
 * Strict prefilter before generation to reject low-quality targets:
 * - Low signal (length < 40 AND no meaningful context)
 * - Emoji spam (emoji_ratio > 0.35)
 * - Parody/bot signals
 * - Off-limits topics (scams, hate, explicit sexual content, extremist propaganda)
 * 
 * NOTE: Allowed topics include non-health content - reply generation must be health-anchored.
 */

export interface TargetQualityFilterResult {
  pass: boolean;
  code: string; // Deny reason code
  deny_reason_code?: 'LOW_SIGNAL_TARGET' | 'OFF_LIMITS_TOPIC' | 'EMOJI_SPAM_TARGET' | 'PARODY_OR_BOT_SIGNAL' | 'TARGET_QUALITY_BLOCK';
  reason: string;
  detail: Record<string, any>; // Structured detail object
  details?: Record<string, any>; // Alias for compatibility
  score?: number; // Quality score 0-100
}

/**
 * Calculate emoji ratio in text
 */
function calculateEmojiRatio(text: string): number {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiMatchResult = text.match(emojiRegex);
  const emojiMatches: string[] = emojiMatchResult ? Array.from(emojiMatchResult) : [];
  const totalChars = text.length;
  
  if (totalChars === 0) return 0;
  
  // Count emoji characters (some emojis are multi-character)
  const emojiCharCount = emojiMatches.reduce((sum: number, emoji: string) => sum + emoji.length, 0);
  return emojiCharCount / totalChars;
}

/**
 * Extract meaningful context from text (non-emoji, non-stopword tokens)
 */
function extractMeaningfulContext(text: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);
  
  // Remove emojis and extract words
  const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, ' ');
  const words = cleanText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w))
    .filter(w => /^[a-z0-9]+$/.test(w)); // Only alphanumeric
  
  return words;
}

/**
 * Check for engagement bait patterns
 */
function hasEngagementBait(text: string): boolean {
  const baitPatterns = [
    /\bfollow\s+(me|us|for)\b/i,
    /\bdm\s+(me|us)\b/i,
    /\bretweet\s+(if|this)\b/i,
    /\blike\s+if\b/i,
    /\bshare\s+(if|this)\b/i,
    /\bcomment\s+(below|if)\b/i,
    /\bclick\s+(link|here)\b/i,
  ];
  
  return baitPatterns.some(pattern => pattern.test(text));
}

/**
 * Check if text contains a claim or question
 */
function hasClaimOrQuestion(text: string): boolean {
  const claimIndicators = [
    /\b(claim|says|states|argues|suggests|proves|shows|demonstrates|finds|discovered|study|research|data|evidence)\b/i,
    /\b(should|must|need|require|important|critical|essential|vital)\b/i,
    /\b(better|worse|best|worst|more|less|most|least)\b/i,
    /\d+%/, // Percentages
    /\d+\s*(mg|g|kg|ml|l|calories?|grams?|pounds?|lbs?)/i, // Quantities
  ];
  
  const questionIndicators = [
    /\?/, // Question mark
    /\b(what|when|where|why|how|which|who|whom|whose|can|could|should|would|will|do|does|did|is|are|was|were)\s+\w+/i,
  ];
  
  return claimIndicators.some(pattern => pattern.test(text)) ||
         questionIndicators.some(pattern => pattern.test(text));
}

/**
 * Check if text is health-relevant (broadened to include medical/research/public health)
 */
function isHealthRelevant(text: string, authorHandle?: string): { 
  isRelevant: boolean; 
  matchedKeywords: string[];
  healthScore: number;
} {
  const healthKeywords = [
    // Core health terms
    'health', 'fitness', 'nutrition', 'wellness', 'exercise', 'diet', 'workout',
    'supplement', 'vitamin', 'protein', 'cardio', 'strength', 'metabolism',
    'cholesterol', 'blood', 'pressure', 'heart', 'muscle', 'weight', 'fat',
    'calorie', 'nutrient', 'immune', 'sleep', 'recovery', 'injury', 'pain',
    'medical', 'doctor', 'patient', 'treatment', 'therapy', 'medication',
    'disease', 'condition', 'symptom', 'diagnosis', 'prevention', 'cure',
    'ozempic', 'creatine', 'zone 2', 'vo2 max', 'glucose', 'insulin', 'keto',
    'mediterranean', 'paleo', 'vegan', 'vegetarian', 'organic', 'natural',
    // Medical/disease terms (added)
    'syndrome', 'cancer', 'diabetes', 'lupus', 'autoimmune', 'clinical', 'trial',
    'symptoms', 'medication', 'vaccine', 'infection', 'mental health', 'depression',
    'anxiety', 'therapy', 'public health', 'epidemiology', 'research', 'study',
    'patient', 'treatment', 'diagnosis', 'disease', 'disorder', 'syndrome',
    'chronic', 'acute', 'pathology', 'physiology', 'biomarker', 'genetic',
    'molecular', 'pharmaceutical', 'drug', 'medicine', 'surgery', 'procedure',
    'diagnostic', 'prognosis', 'mortality', 'morbidity', 'prevalence', 'incidence',
    'outbreak', 'pandemic', 'epidemic', 'virus', 'bacteria', 'pathogen',
    'immune system', 'inflammation', 'allergy', 'asthma', 'arthritis', 'osteoporosis',
    'cardiovascular', 'neurological', 'psychiatric', 'oncology', 'hematology',
    'endocrinology', 'gastroenterology', 'dermatology', 'ophthalmology', 'urology',
    'gynecology', 'pediatrics', 'geriatrics', 'radiology', 'pathology',
    // Research/public health terms
    'biospecimen', 'data', 'collaboration', 'biobank', 'registry', 'cohort',
    'longitudinal', 'observational', 'intervention', 'randomized', 'placebo',
    'efficacy', 'safety', 'adverse', 'side effect', 'contraindication',
    'dosage', 'administration', 'pharmacokinetics', 'pharmacodynamics',
    'biomarker', 'surrogate', 'endpoint', 'outcome', 'quality of life',
    'healthcare', 'hospital', 'clinic', 'emergency', 'icu', 'icu', 'ward',
    'nurse', 'physician', 'surgeon', 'specialist', 'practitioner',
  ];
  
  const textLower = text.toLowerCase();
  const matchedKeywords: string[] = [];
  
  // Check for keyword matches
  for (const keyword of healthKeywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }
  
  // Calculate health score (0-100)
  let healthScore = matchedKeywords.length * 5; // Base score from matches
  if (matchedKeywords.length > 0) {
    healthScore = Math.min(100, healthScore + 20); // Bonus for any match
  }
  
  // Strong health signals boost score
  const strongSignals = ['disease', 'treatment', 'patient', 'clinical', 'research', 'medical', 'health'];
  const hasStrongSignal = strongSignals.some(signal => matchedKeywords.some(k => k.toLowerCase().includes(signal)));
  if (hasStrongSignal) {
    healthScore = Math.min(100, healthScore + 30);
  }
  
  // Check if author is in curated handles (strong prior)
  if (authorHandle) {
    const curatedHandles = (process.env.REPLY_CURATED_HANDLES || '').split(',').map(h => h.trim().toLowerCase());
    const normalizedHandle = authorHandle.toLowerCase().replace('@', '');
    if (curatedHandles.includes(normalizedHandle)) {
      // Curated handles get lower threshold - if they have ANY health signal, pass
      healthScore = Math.min(100, healthScore + 40);
      if (matchedKeywords.length > 0 || textLower.length > 50) {
        // Curated handle + any health keyword or substantial text = pass
        return { isRelevant: true, matchedKeywords, healthScore: Math.min(100, healthScore) };
      }
    }
  }
  
  // Threshold: need at least 1 match OR substantial text length with medical context
  const isRelevant = matchedKeywords.length > 0 || 
                     (textLower.length > 100 && (textLower.includes('research') || textLower.includes('study') || textLower.includes('clinical')));
  
  return { isRelevant, matchedKeywords, healthScore };
}

/**
 * Check for parody/bot signals
 */
function hasParodyOrBotSignals(text: string, authorName?: string, authorBio?: string): {
  hasParody: boolean;
  hasBot: boolean;
  signals: string[];
} {
  const parodyKeywords = ['parody', 'satire', 'joke', 'meme', 'humor', 'fake', 'not real', 'rp ', 'fan account'];
  const botKeywords = ['bot', 'automated', 'ai generated', 'chatbot', 'auto reply'];
  
  const combinedText = `${text} ${authorName || ''} ${authorBio || ''}`.toLowerCase();
  const signals: string[] = [];
  
  // Check for parody keywords
  const foundParody = parodyKeywords.find(keyword => combinedText.includes(keyword));
  if (foundParody) {
    signals.push(`parody_keyword:${foundParody}`);
  }
  
  // Check for bot signals in author name/bio
  if (authorName) {
    const foundBot = botKeywords.find(keyword => authorName.toLowerCase().includes(keyword));
    if (foundBot) {
      signals.push(`bot_in_name:${foundBot}`);
    }
  }
  
  if (authorBio) {
    const foundBot = botKeywords.find(keyword => authorBio.toLowerCase().includes(keyword));
    if (foundBot) {
      signals.push(`bot_in_bio:${foundBot}`);
    }
  }
  
  return {
    hasParody: !!foundParody,
    hasBot: signals.some(s => s.startsWith('bot_')),
    signals
  };
}

/**
 * Filter target quality before generation
 * Returns structured result with code, detail, and score
 */
export function filterTargetQuality(
  targetText: string,
  authorName?: string,
  authorBio?: string,
  extractedContext?: string
): TargetQualityFilterResult {
  const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const gateVersion = '2.0'; // Updated version with broadened health detection
  const textLength = targetText.length;
  const meaningfulContext = extractedContext || targetText;
  const meaningfulTokens = extractMeaningfulContext(meaningfulContext);
  const emojiRatio = calculateEmojiRatio(targetText);
  const hasRepeatedEmojis = (targetText.match(/\n/g) || []).length > 0 && 
                             targetText.split('\n').filter(line => {
                               const clean = line.trim();
                               if (clean.length === 0) return false;
                               const emojiCount = (clean.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
                               const nonEmojiChars = clean.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim().length;
                               return emojiCount > 0 && nonEmojiChars < 3;
                             }).length >= 2;
  
  // Rule 1: Low signal - text length < 40 AND no meaningful context OR no claim/question
  const hasClaim = hasClaimOrQuestion(targetText);
  const hasBait = hasEngagementBait(targetText);
  
  if (textLength < 40 && meaningfulTokens.length < 3) {
    return {
      pass: false,
      code: 'LOW_SIGNAL_TARGET',
      deny_reason_code: 'LOW_SIGNAL_TARGET',
      reason: `Target text too short (${textLength} chars) with insufficient context (${meaningfulTokens.length} meaningful tokens)`,
      detail: {
        text_length: textLength,
        meaningful_tokens: meaningfulTokens.length,
        tokens: meaningfulTokens.slice(0, 5),
        has_claim_or_question: hasClaim,
        has_engagement_bait: hasBait
      },
      details: {
        text_length: textLength,
        meaningful_tokens: meaningfulTokens.length,
        tokens: meaningfulTokens.slice(0, 5)
      },
      score: Math.max(0, Math.min(100, (textLength / 40) * 30 + meaningfulTokens.length * 5))
    };
  }
  
  // Rule 1b: Generic engagement bait without claim/question
  if (hasBait && !hasClaim && textLength < 100) {
    return {
      pass: false,
      code: 'LOW_SIGNAL_TARGET',
      deny_reason_code: 'LOW_SIGNAL_TARGET',
      reason: `Target is generic engagement bait without claim/question`,
      detail: {
        text_length: textLength,
        has_engagement_bait: true,
        has_claim_or_question: false
      },
      details: {
        text_length: textLength,
        has_engagement_bait: true
      },
      score: 20
    };
  }
  
  // Rule 2: Emoji spam - emoji ratio > 0.35 OR repeated emoji lines
  if (emojiRatio > 0.35 || hasRepeatedEmojis) {
    return {
      pass: false,
      code: 'EMOJI_SPAM_TARGET',
      deny_reason_code: 'EMOJI_SPAM_TARGET',
      reason: `Target has high emoji ratio (${(emojiRatio * 100).toFixed(1)}% > 35%)${hasRepeatedEmojis ? ' or repeated emoji lines' : ''}`,
      detail: {
        emoji_ratio: emojiRatio,
        text_length: textLength,
        has_repeated_emoji_lines: hasRepeatedEmojis
      },
      details: {
        emoji_ratio: emojiRatio,
        text_length: textLength
      },
      score: Math.max(0, 100 - (emojiRatio * 200))
    };
  }
  
  // Rule 3: Parody/bot signals
  const parodyBotCheck = hasParodyOrBotSignals(targetText, authorName, authorBio);
  if (parodyBotCheck.hasParody || parodyBotCheck.hasBot) {
    return {
      pass: false,
      code: 'PARODY_OR_BOT_SIGNAL',
      deny_reason_code: 'PARODY_OR_BOT_SIGNAL',
      reason: `Target contains parody/bot signals: ${parodyBotCheck.signals.join(', ')}`,
      detail: {
        author_name: authorName,
        author_bio: authorBio ? authorBio.substring(0, 100) : undefined,
        has_parody: parodyBotCheck.hasParody,
        has_bot: parodyBotCheck.hasBot,
        signals: parodyBotCheck.signals
      },
      details: {
        author_name: authorName,
        has_parody_keywords: true
      },
      score: 0
    };
  }
  
  // Rule 4: Off-limits topics only (allow any topic, reply must be health-anchored)
  // Only DENY if explicit off-limits topics: scams, hate/harassment, explicit porn, extremist propaganda
  const textLower = targetText.toLowerCase();
  const authorHandle = authorName?.replace('@', '') || undefined;
  
  // Off-limits topic patterns (strict blacklist)
  const offLimitsPatterns = [
    // Scams/fraud
    /\b(crypto\s*scam|nft\s*scam|investment\s*scam|ponzi|pyramid\s*scheme|get\s*rich\s*quick)\b/i,
    // Hate/harassment
    /\b(kill\s*all|death\s*to|exterminate|genocide|ethnic\s*cleansing)\b/i,
    // Explicit sexual content
    /\b(hardcore|explicit|porn|xxx|nsfw\s*sexual|explicitly\s*sexual)\b/i,
    // Extremist propaganda
    /\b(terrorist|jihad|extremist\s*propaganda|radical\s*ideology|violent\s*extremism)\b/i,
  ];
  
  const hasOffLimitsTopic = offLimitsPatterns.some(pattern => pattern.test(textLower));
  
  if (hasOffLimitsTopic && textLength >= 20) {
    // Extract target tweet ID from context if available (for URL generation)
    let targetTweetId: string | undefined;
    if (extractedContext && typeof extractedContext === 'string') {
      const idMatch = extractedContext.match(/status[\/](\d+)/);
      if (idMatch) targetTweetId = idMatch[1];
    }
    
    const debugData = {
      extracted_text: targetText.substring(0, 280),
      extracted_text_len: textLength,
      author_handle: authorHandle || 'unknown',
      url: targetTweetId ? `https://x.com/i/status/${targetTweetId}` : undefined,
      gate_version: gateVersion,
      app_version: appVersion,
      text_preview: targetText.substring(0, 100),
      meaningful_tokens: meaningfulTokens.length,
      off_limits_pattern_matched: true,
    };
    
    return {
      pass: false,
      code: 'OFF_LIMITS_TOPIC',
      deny_reason_code: 'OFF_LIMITS_TOPIC',
      reason: `Target contains off-limits topic (scams, hate, explicit sexual content, or extremist propaganda)`,
      detail: debugData,
      details: debugData,
      score: 0
    };
  }
  
  // If text is too short (< 20), don't classify as NON_HEALTH_TOPIC
  if (textLength < 20) {
    return {
      pass: false,
      code: 'LOW_SIGNAL_TARGET',
      deny_reason_code: 'LOW_SIGNAL_TARGET',
      reason: `Target text too short (${textLength} chars) - cannot classify health relevance`,
      detail: {
        text_length: textLength,
        extracted_text: targetText.substring(0, 100),
      },
      details: {
        text_length: textLength,
      },
      score: 10
    };
  }
  
  // Calculate quality score (0-100)
  let score = 100;
  if (textLength < 60) score -= 10;
  if (meaningfulTokens.length < 5) score -= 10;
  if (!hasClaim) score -= 15;
  if (emojiRatio > 0.15) score -= 10;
  score = Math.max(0, Math.min(100, score));
  
  // All checks passed
  return {
    pass: true,
    code: 'PASS',
    reason: 'Target passed all quality filters',
    detail: {
      text_length: textLength,
      emoji_ratio: emojiRatio,
      meaningful_tokens: meaningfulTokens.length,
      has_claim_or_question: hasClaim,
      is_health_relevant: true,
      score: score
    },
    details: {
      text_length: textLength,
      emoji_ratio: emojiRatio,
      meaningful_tokens: meaningfulTokens.length,
      is_health_relevant: true
    },
    score: score
  };
}
