/**
 * 🎯 TWITTER-NATIVE TARGET SCORER
 * 
 * Pre-generation scoring system that returns:
 * - target_score (0-100)
 * - reasons[] (deny reason codes if score < 60)
 * 
 * Signals evaluated:
 * - Text length / emoji ratio / repeated emoji lines
 * - Presence of claim/question vs generic fluff
 * - Account flags: "parody account", spam keywords in name/bio
 * - Topic classifier (health relevance)
 */

export interface TargetScoreResult {
  target_score: number; // 0-100
  reasons: string[]; // Deny reason codes if score < 60
  details: {
    text_length: number;
    emoji_ratio: number;
    meaningful_tokens: number;
    has_claim_or_question: boolean;
    has_parody_signals: boolean;
    has_bot_signals: boolean;
    is_health_relevant: boolean;
    score_breakdown: {
      length_score: number;
      emoji_score: number;
      content_quality_score: number;
      account_quality_score: number;
      topic_relevance_score: number;
    };
  };
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
  
  const emojiCharCount = emojiMatches.reduce((sum: number, emoji: string) => sum + emoji.length, 0);
  return emojiCharCount / totalChars;
}

/**
 * Check for repeated emoji lines (spam pattern)
 */
function hasRepeatedEmojiLines(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  
  const emojiOnlyLines = lines.filter(line => {
    const clean = line.trim();
    if (clean.length === 0) return false;
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojiCount = (clean.match(emojiRegex) || []).length;
    const nonEmojiChars = clean.replace(emojiRegex, '').trim().length;
    return emojiCount > 0 && nonEmojiChars < 3; // Mostly emoji
  });
  
  return emojiOnlyLines.length >= 2; // 2+ emoji-only lines = spam pattern
}

/**
 * Extract meaningful tokens (non-stopwords, length > 3)
 */
function extractMeaningfulTokens(text: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'what', 'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'whose'
  ]);
  
  const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, ' ');
  const words = cleanText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w))
    .filter(w => /^[a-z0-9]+$/.test(w));
  
  return words;
}

/**
 * Check if text contains a claim or question (vs generic fluff)
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
  
  const hasClaim = claimIndicators.some(pattern => pattern.test(text));
  const hasQuestion = questionIndicators.some(pattern => pattern.test(text));
  
  return hasClaim || hasQuestion;
}

/**
 * Check for parody/bot signals
 */
function hasParodyOrBotSignals(text: string, authorName?: string, authorBio?: string): {
  hasParody: boolean;
  hasBot: boolean;
} {
  const parodyKeywords = ['parody', 'satire', 'joke', 'meme', 'humor', 'fake', 'not real', 'satirical'];
  const botKeywords = ['bot', 'automated', 'ai generated', 'chatbot', 'auto reply'];
  
  const combinedText = `${text} ${authorName || ''} ${authorBio || ''}`.toLowerCase();
  
  const hasParody = parodyKeywords.some(keyword => combinedText.includes(keyword));
  const hasBot = botKeywords.some(keyword => combinedText.includes(keyword)) ||
                 (authorName && botKeywords.some(keyword => authorName.toLowerCase().includes(keyword))) ||
                 (authorBio && botKeywords.some(keyword => authorBio.toLowerCase().includes(keyword)));
  
  return { hasParody, hasBot };
}

/**
 * Check if text is health-relevant
 */
function isHealthRelevant(text: string): boolean {
  const healthKeywords = [
    'health', 'fitness', 'nutrition', 'wellness', 'exercise', 'diet', 'workout',
    'supplement', 'vitamin', 'protein', 'cardio', 'strength', 'metabolism',
    'cholesterol', 'blood', 'pressure', 'heart', 'muscle', 'weight', 'fat',
    'calorie', 'nutrient', 'immune', 'sleep', 'recovery', 'injury', 'pain',
    'medical', 'doctor', 'patient', 'treatment', 'therapy', 'medication',
    'disease', 'condition', 'symptom', 'diagnosis', 'prevention', 'cure',
    'ozempic', 'creatine', 'zone 2', 'vo2 max', 'glucose', 'insulin', 'keto',
    'mediterranean', 'paleo', 'vegan', 'vegetarian', 'organic', 'natural',
    'mental health', 'anxiety', 'depression', 'stress', 'mindfulness',
    'cancer', 'diabetes', 'obesity', 'hypertension', 'cardiovascular'
  ];
  
  const textLower = text.toLowerCase();
  return healthKeywords.some(keyword => textLower.includes(keyword));
}

/**
 * Score target tweet quality (0-100)
 * Hard deny if score < 60 with deny_reason_code=TARGET_QUALITY_BLOCK
 */
export function scoreTarget(
  targetText: string,
  authorName?: string,
  authorBio?: string,
  extractedContext?: string
): TargetScoreResult {
  const textLength = targetText.length;
  const meaningfulContext = extractedContext || targetText;
  const meaningfulTokens = extractMeaningfulTokens(meaningfulContext);
  const emojiRatio = calculateEmojiRatio(targetText);
  const hasRepeatedEmojis = hasRepeatedEmojiLines(targetText);
  const hasClaim = hasClaimOrQuestion(targetText);
  const { hasParody, hasBot } = hasParodyOrBotSignals(targetText, authorName, authorBio);
  const isHealth = isHealthRelevant(targetText);
  
  // Score breakdown (each component 0-20 points, total 0-100)
  
  // 1. Length score (0-20)
  // Ideal: 40-280 chars (full score)
  // Too short: < 40 chars (penalty)
  // Too long: > 280 chars (slight penalty)
  let lengthScore = 20;
  if (textLength < 40) {
    lengthScore = Math.max(0, (textLength / 40) * 15); // 0-15 for < 40
  } else if (textLength > 280) {
    lengthScore = Math.max(10, 20 - ((textLength - 280) / 100)); // Penalty for very long
  }
  
  // 2. Emoji score (0-20)
  // Ideal: < 0.15 ratio (full score)
  // Penalty: > 0.35 ratio (fail)
  // Repeated emoji lines = instant fail
  let emojiScore = 20;
  if (hasRepeatedEmojis) {
    emojiScore = 0; // Instant fail
  } else if (emojiRatio > 0.35) {
    emojiScore = 0; // Fail threshold
  } else if (emojiRatio > 0.25) {
    emojiScore = 5; // Heavy penalty
  } else if (emojiRatio > 0.15) {
    emojiScore = 10; // Moderate penalty
  }
  
  // 3. Content quality score (0-20)
  // Based on meaningful tokens and claim/question presence
  let contentQualityScore = 10; // Base score
  if (meaningfulTokens.length >= 5) {
    contentQualityScore += 5; // Good token count
  } else if (meaningfulTokens.length < 3) {
    contentQualityScore -= 5; // Too few tokens
  }
  if (hasClaim) {
    contentQualityScore += 5; // Has claim/question
  }
  contentQualityScore = Math.max(0, Math.min(20, contentQualityScore));
  
  // 4. Account quality score (0-20)
  // Penalty for parody/bot signals
  let accountQualityScore = 20; // Full score by default
  if (hasParody) {
    accountQualityScore = 0; // Instant fail
  }
  if (hasBot) {
    accountQualityScore = Math.min(accountQualityScore, 5); // Heavy penalty
  }
  
  // 5. Topic relevance score (0-20)
  // Health relevance check
  let topicRelevanceScore = isHealth ? 20 : 5; // Health = full score, non-health = low score
  
  // Calculate total score
  const totalScore = Math.round(
    lengthScore +
    emojiScore +
    contentQualityScore +
    accountQualityScore +
    topicRelevanceScore
  );
  
  // Collect deny reasons if score < 60
  const reasons: string[] = [];
  if (totalScore < 60) {
    if (textLength < 40 && meaningfulTokens.length < 3) {
      reasons.push('LOW_SIGNAL_TARGET');
    }
    if (emojiRatio > 0.35 || hasRepeatedEmojis) {
      reasons.push('EMOJI_SPAM_TARGET');
    }
    if (hasParody) {
      reasons.push('PARODY_OR_BOT_SIGNAL');
    }
    if (hasBot && !hasParody) {
      reasons.push('PARODY_OR_BOT_SIGNAL');
    }
    if (!isHealth) {
      reasons.push('NON_HEALTH_TOPIC');
    }
    // If no specific reason, use generic
    if (reasons.length === 0) {
      reasons.push('TARGET_QUALITY_BLOCK');
    }
  }
  
  return {
    target_score: totalScore,
    reasons,
    details: {
      text_length: textLength,
      emoji_ratio: emojiRatio,
      meaningful_tokens: meaningfulTokens.length,
      has_claim_or_question: hasClaim,
      has_parody_signals: hasParody,
      has_bot_signals: hasBot,
      is_health_relevant: isHealth,
      score_breakdown: {
        length_score: Math.round(lengthScore),
        emoji_score: Math.round(emojiScore),
        content_quality_score: Math.round(contentQualityScore),
        account_quality_score: Math.round(accountQualityScore),
        topic_relevance_score: Math.round(topicRelevanceScore),
      },
    },
  };
}
