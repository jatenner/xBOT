/**
 * Content Feature Extractor
 *
 * Extracts learnable features from tweet text so the system can discover
 * patterns like "tweets with numbers get 2x views" or "questions drive replies".
 *
 * Run on every post, reply, AND peer tweet for cross-referencing.
 */

export interface ContentFeatures {
  char_count: number;
  word_count: number;
  sentence_count: number;
  line_count: number;
  has_numbers: boolean;
  number_count: number;
  has_question: boolean;
  question_count: number;
  has_stats: boolean;           // contains percentage, ratio, or "X out of Y"
  has_mechanism: boolean;       // explains how/why something works
  opening_pattern: string;      // first 5 words (normalized)
  emoji_count: number;
  has_emoji: boolean;
  has_url: boolean;
  has_hashtag: boolean;
  hashtag_count: number;
  has_mention: boolean;
  mention_count: number;
  avg_word_length: number;
  longest_word_length: number;
  uppercase_ratio: number;      // fraction of uppercase chars (shouting detection)
  punctuation_density: number;  // punctuation chars per word
  readability: 'simple' | 'moderate' | 'technical';
  content_type: 'statement' | 'question' | 'list' | 'story' | 'call_to_action';
}

const URL_REGEX = /https?:\/\/\S+/g;
const HASHTAG_REGEX = /#\w+/g;
const MENTION_REGEX = /@\w+/g;
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu;
const STAT_REGEX = /\d+%|\d+\/\d+|\d+ out of \d+|\d+x\b/i;
const MECHANISM_REGEX = /\bbecause\b|\bdue to\b|\bcauses?\b|\bleads? to\b|\btriggers?\b|\bresults? in\b|\bby \w+ing\b|\bthrough\b|\bmechanism\b|\bpathway\b/i;

export function extractContentFeatures(text: string): ContentFeatures {
  if (!text || text.trim().length === 0) {
    return getEmptyFeatures();
  }

  const cleaned = text.trim();

  // Basic counts
  const chars = cleaned.length;
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lines = cleaned.split(/\n/).filter(l => l.trim().length > 0);

  // Numbers and stats
  const numberMatches = cleaned.match(/\d+/g) || [];
  const hasStats = STAT_REGEX.test(cleaned);
  const hasMechanism = MECHANISM_REGEX.test(cleaned);

  // Questions
  const questionMarks = (cleaned.match(/\?/g) || []).length;

  // Opening pattern (first 5 words, lowercased, no punctuation)
  const openingWords = words.slice(0, 5).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(w => w.length > 0);
  const openingPattern = openingWords.join(' ');

  // Emoji
  const emojis = cleaned.match(EMOJI_REGEX) || [];

  // URLs, hashtags, mentions
  const urls = cleaned.match(URL_REGEX) || [];
  const hashtags = cleaned.match(HASHTAG_REGEX) || [];
  const mentions = cleaned.match(MENTION_REGEX) || [];

  // Word complexity
  const wordLengths = words.map(w => w.replace(/[^a-zA-Z]/g, '').length).filter(l => l > 0);
  const avgWordLen = wordLengths.length > 0 ? wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length : 0;
  const longestWord = wordLengths.length > 0 ? Math.max(...wordLengths) : 0;

  // Uppercase ratio (excluding URLs and mentions)
  const textOnly = cleaned.replace(URL_REGEX, '').replace(MENTION_REGEX, '');
  const alphaChars = textOnly.replace(/[^a-zA-Z]/g, '');
  const upperChars = alphaChars.replace(/[^A-Z]/g, '');
  const uppercaseRatio = alphaChars.length > 0 ? upperChars.length / alphaChars.length : 0;

  // Punctuation density
  const punctuation = cleaned.replace(/[a-zA-Z0-9\s]/g, '').length;
  const punctDensity = wordCount > 0 ? punctuation / wordCount : 0;

  // Readability (simple heuristic based on avg word length + sentence length)
  const avgSentenceLen = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  let readability: 'simple' | 'moderate' | 'technical' = 'simple';
  if (avgWordLen > 6 || avgSentenceLen > 20) readability = 'technical';
  else if (avgWordLen > 4.5 || avgSentenceLen > 12) readability = 'moderate';

  // Content type classification
  let contentType: ContentFeatures['content_type'] = 'statement';
  if (questionMarks > 0 && questionMarks >= sentences.length / 2) contentType = 'question';
  else if (/^\d+[\.\)]\s/m.test(cleaned) || /^[-•]\s/m.test(cleaned)) contentType = 'list';
  else if (/\b(click|subscribe|follow|check out|link in|sign up|join)\b/i.test(cleaned)) contentType = 'call_to_action';
  else if (sentences.length >= 3 && /\b(then|after|when|finally|suddenly)\b/i.test(cleaned)) contentType = 'story';

  return {
    char_count: chars,
    word_count: wordCount,
    sentence_count: sentences.length,
    line_count: lines.length,
    has_numbers: numberMatches.length > 0,
    number_count: numberMatches.length,
    has_question: questionMarks > 0,
    question_count: questionMarks,
    has_stats: hasStats,
    has_mechanism: hasMechanism,
    opening_pattern: openingPattern,
    emoji_count: emojis.length,
    has_emoji: emojis.length > 0,
    has_url: urls.length > 0,
    has_hashtag: hashtags.length > 0,
    hashtag_count: hashtags.length,
    has_mention: mentions.length > 0,
    mention_count: mentions.length,
    avg_word_length: Math.round(avgWordLen * 10) / 10,
    longest_word_length: longestWord,
    uppercase_ratio: Math.round(uppercaseRatio * 100) / 100,
    punctuation_density: Math.round(punctDensity * 100) / 100,
    readability,
    content_type: contentType,
  };
}

function getEmptyFeatures(): ContentFeatures {
  return {
    char_count: 0, word_count: 0, sentence_count: 0, line_count: 0,
    has_numbers: false, number_count: 0, has_question: false, question_count: 0,
    has_stats: false, has_mechanism: false, opening_pattern: '',
    emoji_count: 0, has_emoji: false, has_url: false,
    has_hashtag: false, hashtag_count: 0, has_mention: false, mention_count: 0,
    avg_word_length: 0, longest_word_length: 0, uppercase_ratio: 0,
    punctuation_density: 0, readability: 'simple', content_type: 'statement',
  };
}
