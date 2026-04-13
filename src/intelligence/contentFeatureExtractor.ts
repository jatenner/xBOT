/**
 * 📊 CONTENT FEATURE EXTRACTOR
 *
 * Extracts machine-readable features from tweet text for learning.
 * Runs on every post/reply AND every peer tweet.
 * Enables: "tweets starting with numbers get 2x views"
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
  has_exclamation: boolean;
  opening_pattern: string;       // first 5 words
  opening_word: string;          // first word
  emoji_count: number;
  has_emoji: boolean;
  has_url: boolean;
  has_mention: boolean;
  mention_count: number;
  has_hashtag: boolean;
  hashtag_count: number;
  has_colon_list: boolean;       // contains ":" formatted lists
  has_bullet_points: boolean;    // contains •, -, or numbered lists
  has_parenthetical: boolean;    // contains (text)
  avg_word_length: number;
  starts_with_number: boolean;
  starts_with_question: boolean;
  starts_with_bold_claim: boolean; // starts with "The real", "Most people", "Nobody talks", etc.
  contains_mechanism: boolean;   // contains "because", "which causes", "leading to", "triggers"
  contains_specific_data: boolean; // contains %, mg, ml, hours, studies, research
  readability: 'simple' | 'moderate' | 'technical';

  // CTA detection — "follow for more", "RT if you agree", "save this"
  has_cta: boolean;
  cta_type: string | null; // 'follow', 'retweet', 'save', 'link', 'reply', 'share', null

  // Line break formatting — visual structure
  line_break_count: number;
  char_utilization_pct: number;  // % of 280 char limit used

  // Closing pattern (last 5 words — "link in bio", "follow for more")
  closing_pattern: string;

  // Mention targets extracted
  mentioned_usernames: string[];

  // Thread/list signals
  has_numbered_list: boolean;  // "1. ... 2. ... 3. ..."
  has_thread_hook: boolean;    // contains "thread", "🧵", "a thread"
}

const MECHANISM_WORDS = ['because', 'which causes', 'leading to', 'triggers', 'results in', 'due to', 'mechanism', 'pathway', 'receptor', 'enzyme', 'hormone'];
const SPECIFIC_DATA_PATTERNS = /\d+\s*(%|mg|ml|mcg|iu|hours?|minutes?|days?|weeks?|studies|trials|participants|subjects|x\s+more|fold)/i;
const BOLD_CLAIM_STARTS = ['the real', 'most people', 'nobody talks', 'what nobody', 'the truth', 'the #1', 'the biggest', 'unpopular opinion', 'hot take', 'controversial'];
const URL_PATTERN = /https?:\/\/\S+/g;
const MENTION_PATTERN = /@\w+/g;
const HASHTAG_PATTERN = /#\w+/g;
const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{231A}-\u{23F3}]/gu;

export function extractContentFeatures(text: string): ContentFeatures {
  if (!text || text.length === 0) {
    return {
      char_count: 0, word_count: 0, sentence_count: 0, line_count: 0,
      has_numbers: false, number_count: 0, has_question: false, question_count: 0,
      has_exclamation: false, opening_pattern: '', opening_word: '',
      emoji_count: 0, has_emoji: false, has_url: false, has_mention: false,
      mention_count: 0, has_hashtag: false, hashtag_count: 0,
      has_colon_list: false, has_bullet_points: false, has_parenthetical: false,
      avg_word_length: 0, starts_with_number: false, starts_with_question: false,
      starts_with_bold_claim: false, contains_mechanism: false,
      contains_specific_data: false, readability: 'simple',
      has_cta: false, cta_type: null, line_break_count: 0,
      char_utilization_pct: 0, closing_pattern: '', mentioned_usernames: [],
      has_numbered_list: false, has_thread_hook: false,
    };
  }

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lines = text.split(/\n/).filter(l => l.trim().length > 0);
  const numbers = text.match(/\d+/g) || [];
  const questions = text.match(/\?/g) || [];
  const emojis = text.match(EMOJI_PATTERN) || [];
  const mentions = text.match(MENTION_PATTERN) || [];
  const hashtags = text.match(HASHTAG_PATTERN) || [];
  const urls = text.match(URL_PATTERN) || [];

  const firstWord = words[0]?.toLowerCase() || '';
  const openingPattern = words.slice(0, 5).join(' ').toLowerCase();
  const textLower = text.toLowerCase();

  const avgWordLen = words.length > 0
    ? words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0) / words.length
    : 0;

  // Readability: simple (<5 avg word len), technical (>7), moderate (between)
  const readability = avgWordLen < 5 ? 'simple' : avgWordLen > 7 ? 'technical' : 'moderate';

  // CTA detection
  const CTA_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /follow\s+(me|for|if|us)/i, type: 'follow' },
    { pattern: /rt\s+(if|this)|retweet\s+(if|this)/i, type: 'retweet' },
    { pattern: /save\s+this|bookmark\s+this/i, type: 'save' },
    { pattern: /link\s+in\s+bio|check.*link|click.*link/i, type: 'link' },
    { pattern: /reply\s+(with|below|if)|drop\s+(a|your)/i, type: 'reply' },
    { pattern: /share\s+this|send\s+this/i, type: 'share' },
    { pattern: /like\s+if\s+you|like\s+this\s+if/i, type: 'like' },
  ];

  let hasCta = false;
  let ctaType: string | null = null;
  for (const cta of CTA_PATTERNS) {
    if (cta.pattern.test(text)) {
      hasCta = true;
      ctaType = cta.type;
      break;
    }
  }

  // Closing pattern (last 5 words)
  const closingPattern = words.slice(-5).join(' ').toLowerCase();

  // Mentioned usernames
  const mentionedUsernames = mentions.map((m: string) => m.replace('@', '').toLowerCase());

  // Thread hook detection
  const hasThreadHook = /\bthread\b|🧵|a thread/i.test(text);

  // Numbered list
  const hasNumberedList = /^\d+[.)]\s/m.test(text);

  // Line breaks
  const lineBreakCount = (text.match(/\n/g) || []).length;

  return {
    char_count: text.length,
    word_count: words.length,
    sentence_count: sentences.length,
    line_count: lines.length,
    has_numbers: numbers.length > 0,
    number_count: numbers.length,
    has_question: questions.length > 0,
    question_count: questions.length,
    has_exclamation: text.includes('!'),
    opening_pattern: openingPattern,
    opening_word: firstWord,
    emoji_count: emojis.length,
    has_emoji: emojis.length > 0,
    has_url: urls.length > 0,
    has_mention: mentions.length > 0,
    mention_count: mentions.length,
    has_hashtag: hashtags.length > 0,
    hashtag_count: hashtags.length,
    has_colon_list: /:\s*\n/.test(text) || /:\s+[•\-\d]/.test(text),
    has_bullet_points: /[•\-]\s/.test(text) || /^\d+[.)]\s/m.test(text),
    has_parenthetical: /\([^)]+\)/.test(text),
    avg_word_length: Math.round(avgWordLen * 10) / 10,
    starts_with_number: /^\d/.test(text),
    starts_with_question: firstWord === 'why' || firstWord === 'what' || firstWord === 'how' || firstWord === 'when' || firstWord === 'do' || firstWord === 'does' || firstWord === 'is' || firstWord === 'are' || firstWord === 'can',
    starts_with_bold_claim: BOLD_CLAIM_STARTS.some(s => openingPattern.startsWith(s)),
    contains_mechanism: MECHANISM_WORDS.some(w => textLower.includes(w)),
    contains_specific_data: SPECIFIC_DATA_PATTERNS.test(text),
    readability,
    has_cta: hasCta,
    cta_type: ctaType,
    line_break_count: lineBreakCount,
    char_utilization_pct: Math.round((text.length / 280) * 100),
    closing_pattern: closingPattern,
    mentioned_usernames: mentionedUsernames.slice(0, 10),
    has_numbered_list: hasNumberedList,
    has_thread_hook: hasThreadHook,
  };
}
