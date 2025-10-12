/**
 * Feature Extractor for Content Analysis
 * Derives features from text content and metadata for ML prediction
 */

export interface ContentFeatures {
  // Text structure features
  length: number;
  word_count: number;
  sentence_count: number;
  avg_sentence_length: number;
  
  // Readability features
  flesch_kincaid_grade: number;
  syllable_density: number;
  complex_word_ratio: number;
  
  // Engagement signals
  emoji_count: number;
  emoji_ratio: number;
  question_count: number;
  exclamation_count: number;
  has_question_in_first_120: boolean;
  has_numbers: boolean;
  has_you_address: boolean;
  
  // Content type indicators
  has_list_markers: boolean;
  has_time_reference: boolean;
  has_action_words: boolean;
  has_controversy_signals: boolean;
  has_urgency_words: boolean;
  
  // Authority signals
  has_fact_source: boolean;
  has_citations: boolean;
  has_data_points: boolean;
  has_expert_language: boolean;
  
  // Enhanced features v2
  claim_density: number; // Claims per 280 characters
  second_person_flag: boolean; // "you", "your" usage
  numbers_present: boolean; // Any numeric content
  has_source_flag: boolean; // Has credible source reference
  
  // Format features
  thread_length?: number;
  hook_type?: string;
  cta_type?: string;
  format_type?: string;
  
  // Timing features
  hour_posted?: number;
  day_of_week?: number;
  is_weekend?: boolean;
  is_prime_time?: boolean; // 6-9pm EST
  
  // Compliance features
  exceeds_emoji_max: boolean;
  has_hashtags: boolean;
  has_political_content: boolean;
  quality_score?: number;
}

export interface ContentMetadata {
  style?: string;
  fact_source?: string;
  topic?: string;
  thread_length?: number;
  hook_type?: string;
  cta_type?: string;
  quality_score?: number;
  [key: string]: any;
}

// Action words that drive engagement
const ACTION_WORDS = [
  'try', 'start', 'stop', 'avoid', 'add', 'remove', 'increase', 'decrease',
  'improve', 'boost', 'reduce', 'eliminate', 'optimize', 'maximize', 'minimize',
  'follow', 'track', 'measure', 'test', 'experiment', 'change', 'switch'
];

// Controversy signals for health content
const CONTROVERSY_SIGNALS = [
  'myth', 'wrong', 'lie', 'scam', 'fake', 'debunk', 'truth', 'exposed',
  'dangerous', 'harmful', 'shocking', 'surprising', 'contrary', 'opposite'
];

// Urgency words
const URGENCY_WORDS = [
  'now', 'today', 'urgent', 'critical', 'important', 'must', 'need',
  'immediately', 'asap', 'breaking', 'latest', 'new', 'updated'
];

// Expert language patterns
const EXPERT_LANGUAGE = [
  'study', 'research', 'data', 'evidence', 'analysis', 'findings',
  'clinical', 'trial', 'peer-reviewed', 'published', 'journal', 'meta-analysis'
];

// Political keywords to detect
const POLITICAL_KEYWORDS = [
  'trump', 'biden', 'democrat', 'republican', 'liberal', 'conservative',
  'election', 'vote', 'political', 'politics', 'government', 'congress'
];

/**
 * Calculate Flesch-Kincaid Grade Level
 */
function calculateFleschKincaid(text: string, sentences: number, words: number): number {
  if (sentences === 0 || words === 0) return 0;
  
  const syllables = countSyllables(text);
  const avgSentenceLength = words / sentences;
  const avgSyllablesPerWord = syllables / words;
  
  return 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
}

/**
 * Count syllables in text (simplified)
 */
function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let syllableCount = 0;
  
  for (const word of words) {
    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    syllableCount += Math.max(1, vowelGroups.length);
    
    // Adjust for silent 'e'
    if (word.endsWith('e') && vowelGroups.length > 1) {
      syllableCount--;
    }
  }
  
  return syllableCount;
}

/**
 * Count complex words (3+ syllables)
 */
function countComplexWords(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let complexCount = 0;
  
  for (const word of words) {
    const vowelGroups = word.match(/[aeiouy]+/g) || [];
    let syllables = Math.max(1, vowelGroups.length);
    
    if (word.endsWith('e') && vowelGroups.length > 1) {
      syllables--;
    }
    
    if (syllables >= 3) {
      complexCount++;
    }
  }
  
  return complexCount;
}

/**
 * Check if text contains pattern (case-insensitive)
 */
function containsAny(text: string, patterns: string[]): boolean {
  const lowerText = text.toLowerCase();
  return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
}

/**
 * Calculate claim density (claims per 280 characters)
 */
function calculateClaimDensity(text: string): number {
  // Patterns that indicate claims/assertions
  const claimPatterns = [
    /\b(causes?|prevents?|reduces?|increases?|improves?|shows?|proves?|demonstrates?)\b/gi,
    /\b(according to|research shows|studies show|evidence suggests)\b/gi,
    /\b\d+%\b/g, // Percentage claims
    /\b(always|never|all|every|most|majority|significantly)\b/gi, // Absolutist language
    /\b(should|must|need to|have to|essential|crucial|important)\b/gi // Prescriptive language
  ];
  
  let claimCount = 0;
  for (const pattern of claimPatterns) {
    const matches = text.match(pattern) || [];
    claimCount += matches.length;
  }
  
  // Normalize to per 280 characters (typical tweet length)
  const normalizedLength = Math.max(1, text.length / 280);
  return claimCount / normalizedLength;
}

/**
 * Extract features from content text and metadata
 */
export function extractFeatures(text: string, metadata: ContentMetadata = {}): ContentFeatures {
  const cleanText = text.replace(/[^\w\s.!?]/g, ' ').trim();
  const words = cleanText.match(/\b\w+\b/g) || [];
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Basic text metrics
  const length = text.length;
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  
  // Readability
  const fleschKincaidGrade = calculateFleschKincaid(cleanText, sentenceCount, wordCount);
  const syllableCount = countSyllables(cleanText);
  const syllableDensity = wordCount > 0 ? syllableCount / wordCount : 0;
  const complexWords = countComplexWords(cleanText);
  const complexWordRatio = wordCount > 0 ? complexWords / wordCount : 0;
  
  // Emoji analysis
  const emojiMatches = text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
  const emojiCount = emojiMatches.length;
  const emojiRatio = length > 0 ? emojiCount / length : 0;
  
  // Engagement signals
  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;
  const hasQuestionInFirst120 = text.substring(0, 120).includes('?');
  const hasNumbers = /\d/.test(text);
  const hasYouAddress = /\b(you|your|you're|you'll|you've)\b/i.test(text);
  
  // Content type indicators
  const hasListMarkers = /^\s*[-•·]\s/m.test(text) || /\d+\.\s/.test(text);
  const hasTimeReference = /\b(today|tomorrow|yesterday|week|month|year|daily|hourly)\b/i.test(text);
  const hasActionWords = containsAny(text, ACTION_WORDS);
  const hasControversySignals = containsAny(text, CONTROVERSY_SIGNALS);
  const hasUrgencyWords = containsAny(text, URGENCY_WORDS);
  
  // Authority signals
  const hasFactSource = !!metadata.fact_source;
  const hasCitations = /\b(study|research|according to|source:|via @)\b/i.test(text);
  const hasDataPoints = /\b\d+%|\b\d+\s*(percent|times|fold|mg|ml|kg|lbs)\b/i.test(text);
  const hasExpertLanguage = containsAny(text, EXPERT_LANGUAGE);
  
  // Enhanced features v2
  const claimDensity = calculateClaimDensity(text);
  const secondPersonFlag = /\b(you|your|you're|you'll|you've|yourself)\b/i.test(text);
  const numbersPresent = /\b\d+\b/.test(text);
  const hasSourceFlag = /\b(study|research|according to|NIH|CDC|WHO|journal|published|peer.?reviewed)\b/i.test(text) || !!metadata.fact_source;
  
  // Timing features
  const now = new Date();
  const hourPosted = metadata.hour_posted || now.getHours();
  const dayOfWeek = metadata.day_of_week || now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isPrimeTime = hourPosted >= 18 && hourPosted <= 21; // 6-9pm
  
  // Compliance features
  const EMOJI_MAX = parseInt(process.env.EMOJI_MAX || '3', 10);
  const exceedsEmojiMax = emojiCount > EMOJI_MAX;
  const hasHashtags = /#\w+/.test(text);
  const hasPoliticalContent = containsAny(text, POLITICAL_KEYWORDS);
  
  return {
    // Text structure
    length,
    word_count: wordCount,
    sentence_count: sentenceCount,
    avg_sentence_length: avgSentenceLength,
    
    // Readability
    flesch_kincaid_grade: fleschKincaidGrade,
    syllable_density: syllableDensity,
    complex_word_ratio: complexWordRatio,
    
    // Engagement signals
    emoji_count: emojiCount,
    emoji_ratio: emojiRatio,
    question_count: questionCount,
    exclamation_count: exclamationCount,
    has_question_in_first_120: hasQuestionInFirst120,
    has_numbers: hasNumbers,
    has_you_address: hasYouAddress,
    
    // Content type indicators
    has_list_markers: hasListMarkers,
    has_time_reference: hasTimeReference,
    has_action_words: hasActionWords,
    has_controversy_signals: hasControversySignals,
    has_urgency_words: hasUrgencyWords,
    
    // Authority signals
    has_fact_source: hasFactSource,
    has_citations: hasCitations,
    has_data_points: hasDataPoints,
    has_expert_language: hasExpertLanguage,
    
    // Enhanced features v2
    claim_density: claimDensity,
    second_person_flag: secondPersonFlag,
    numbers_present: numbersPresent,
    has_source_flag: hasSourceFlag,
    
    // Format features (from metadata)
    thread_length: metadata.thread_length,
    hook_type: metadata.hook_type,
    cta_type: metadata.cta_type,
    format_type: metadata.style,
    
    // Timing features
    hour_posted: hourPosted,
    day_of_week: dayOfWeek,
    is_weekend: isWeekend,
    is_prime_time: isPrimeTime,
    
    // Compliance features
    exceeds_emoji_max: exceedsEmojiMax,
    has_hashtags: hasHashtags,
    has_political_content: hasPoliticalContent,
    quality_score: metadata.quality_score
  };
}

/**
 * Convert features to numerical array for ML models
 */
export function featuresToArray(features: ContentFeatures): number[] {
  return [
    features.length,
    features.word_count,
    features.sentence_count,
    features.avg_sentence_length,
    features.flesch_kincaid_grade,
    features.syllable_density,
    features.complex_word_ratio,
    features.emoji_count,
    features.emoji_ratio,
    features.question_count,
    features.exclamation_count,
    features.has_question_in_first_120 ? 1 : 0,
    features.has_numbers ? 1 : 0,
    features.has_you_address ? 1 : 0,
    features.has_list_markers ? 1 : 0,
    features.has_time_reference ? 1 : 0,
    features.has_action_words ? 1 : 0,
    features.has_controversy_signals ? 1 : 0,
    features.has_urgency_words ? 1 : 0,
    features.has_fact_source ? 1 : 0,
    features.has_citations ? 1 : 0,
    features.has_data_points ? 1 : 0,
    features.has_expert_language ? 1 : 0,
    features.thread_length || 1,
    features.hour_posted || 12,
    features.day_of_week || 1,
    features.is_weekend ? 1 : 0,
    features.is_prime_time ? 1 : 0,
    features.exceeds_emoji_max ? 1 : 0,
    features.has_hashtags ? 1 : 0,
    features.has_political_content ? 1 : 0,
    features.quality_score || 50
  ];
}

/**
 * Get feature names for model interpretation
 */
export function getFeatureNames(): string[] {
  return [
    'length', 'word_count', 'sentence_count', 'avg_sentence_length',
    'flesch_kincaid_grade', 'syllable_density', 'complex_word_ratio',
    'emoji_count', 'emoji_ratio', 'question_count', 'exclamation_count',
    'has_question_in_first_120', 'has_numbers', 'has_you_address',
    'has_list_markers', 'has_time_reference', 'has_action_words',
    'has_controversy_signals', 'has_urgency_words', 'has_fact_source',
    'has_citations', 'has_data_points', 'has_expert_language',
    'thread_length', 'hour_posted', 'day_of_week', 'is_weekend',
    'is_prime_time', 'exceeds_emoji_max', 'has_hashtags',
    'has_political_content', 'quality_score'
  ];
}
