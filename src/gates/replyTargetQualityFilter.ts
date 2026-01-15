/**
 * 🎯 REPLY TARGET QUALITY FILTER
 * 
 * Strict prefilter before generation to reject low-quality targets:
 * - Low signal (length < 40 AND no meaningful context)
 * - Emoji spam (emoji_ratio > 0.35)
 * - Parody/bot signals
 * - Non-health topics
 */

export interface TargetQualityFilterResult {
  pass: boolean;
  deny_reason_code?: 'LOW_SIGNAL_TARGET' | 'NON_HEALTH_TOPIC' | 'EMOJI_SPAM_TARGET' | 'PARODY_OR_BOT_SIGNAL';
  reason: string;
  details?: Record<string, any>;
}

/**
 * Calculate emoji ratio in text
 */
function calculateEmojiRatio(text: string): number {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiMatches = text.match(emojiRegex) || [];
  const emojiCount = emojiMatches.length;
  const totalChars = text.length;
  
  if (totalChars === 0) return 0;
  
  // Count emoji characters (some emojis are multi-character)
  const emojiCharCount = emojiMatches.reduce((sum, emoji) => sum + emoji.length, 0);
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
    'mediterranean', 'paleo', 'vegan', 'vegetarian', 'organic', 'natural'
  ];
  
  const textLower = text.toLowerCase();
  return healthKeywords.some(keyword => textLower.includes(keyword));
}

/**
 * Check for parody/bot signals
 */
function hasParodyOrBotSignals(text: string, authorName?: string, authorBio?: string): boolean {
  const parodyKeywords = ['parody', 'satire', 'joke', 'meme', 'humor', 'fake', 'not real'];
  const botKeywords = ['bot', 'automated', 'ai generated', 'chatbot'];
  
  const combinedText = `${text} ${authorName || ''} ${authorBio || ''}`.toLowerCase();
  
  // Check for parody keywords
  if (parodyKeywords.some(keyword => combinedText.includes(keyword))) {
    return true;
  }
  
  // Check for bot signals in author name/bio
  if (authorName && botKeywords.some(keyword => authorName.toLowerCase().includes(keyword))) {
    return true;
  }
  
  if (authorBio && botKeywords.some(keyword => authorBio.toLowerCase().includes(keyword))) {
    return true;
  }
  
  return false;
}

/**
 * Filter target quality before generation
 */
export function filterTargetQuality(
  targetText: string,
  authorName?: string,
  authorBio?: string,
  extractedContext?: string
): TargetQualityFilterResult {
  // Rule 1: Low signal - text length < 40 AND no meaningful context
  const textLength = targetText.length;
  const meaningfulContext = extractedContext || targetText;
  const meaningfulTokens = extractMeaningfulContext(meaningfulContext);
  
  if (textLength < 40 && meaningfulTokens.length < 3) {
    return {
      pass: false,
      deny_reason_code: 'LOW_SIGNAL_TARGET',
      reason: `Target text too short (${textLength} chars) with insufficient context (${meaningfulTokens.length} meaningful tokens)`,
      details: {
        text_length: textLength,
        meaningful_tokens: meaningfulTokens.length,
        tokens: meaningfulTokens.slice(0, 5)
      }
    };
  }
  
  // Rule 2: Emoji spam - emoji ratio > 0.35
  const emojiRatio = calculateEmojiRatio(targetText);
  if (emojiRatio > 0.35) {
    return {
      pass: false,
      deny_reason_code: 'EMOJI_SPAM_TARGET',
      reason: `Target has high emoji ratio (${(emojiRatio * 100).toFixed(1)}% > 35%)`,
      details: {
        emoji_ratio: emojiRatio,
        text_length: textLength
      }
    };
  }
  
  // Rule 3: Parody/bot signals
  if (hasParodyOrBotSignals(targetText, authorName, authorBio)) {
    return {
      pass: false,
      deny_reason_code: 'PARODY_OR_BOT_SIGNAL',
      reason: `Target contains parody/bot signals`,
      details: {
        author_name: authorName,
        has_parody_keywords: true
      }
    };
  }
  
  // Rule 4: Non-health topic (lightweight classifier)
  if (!isHealthRelevant(targetText)) {
    return {
      pass: false,
      deny_reason_code: 'NON_HEALTH_TOPIC',
      reason: `Target is not health-relevant`,
      details: {
        text_preview: targetText.substring(0, 100)
      }
    };
  }
  
  // All checks passed
  return {
    pass: true,
    reason: 'Target passed all quality filters',
    details: {
      text_length: textLength,
      emoji_ratio: emojiRatio,
      meaningful_tokens: meaningfulTokens.length,
      is_health_relevant: true
    }
  };
}
