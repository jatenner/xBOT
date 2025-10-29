/**
 * PATTERN EXTRACTOR
 * Extracts patterns from content to enable creativity analysis
 */

export interface ContentPatterns {
  opening_word: string;
  opening_type: 'question' | 'statement' | 'data' | 'story' | 'other';
  sentence_count: number;
  avg_sentence_length: number;
  structure_type: 'comparison' | 'question-answer' | 'explanation' | 'list' | 'other';
  ending_type: 'question' | 'advice' | 'exclamation' | 'statement';
  emoji_count: number;
  has_numbers: boolean;
  has_comparison: boolean;
  tone_marker: 'enthusiastic' | 'curious' | 'scientific' | 'conversational' | 'neutral';
}

/**
 * Extract all patterns from content
 */
export function extractPatterns(content: string): ContentPatterns {
  return {
    opening_word: extractOpeningWord(content),
    opening_type: extractOpeningType(content),
    sentence_count: countSentences(content),
    avg_sentence_length: avgSentenceLength(content),
    structure_type: detectStructure(content),
    ending_type: detectEndingType(content),
    emoji_count: countEmojis(content),
    has_numbers: hasNumbers(content),
    has_comparison: hasComparison(content),
    tone_marker: detectTone(content)
  };
}

/**
 * Extract the first word of the content
 */
function extractOpeningWord(content: string): string {
  const firstWord = content.trim().split(' ')[0];
  return firstWord.toLowerCase().replace(/[^\w]/g, '');
}

/**
 * Determine the type of opening (question, statement, data, story, other)
 */
function extractOpeningType(content: string): 'question' | 'statement' | 'data' | 'story' | 'other' {
  const trimmed = content.trim();
  
  if (trimmed.match(/^(Why|What|How|When|Where|Who|Are|Do|Can|Should|Would|Could|Is|Does|Will|Have|Has|Had)/i)) {
    return 'question';
  }
  
  if (trimmed.match(/^(The|Most|Here|This|That|A|An|Your|People|Everyone|Many|Some|All|No|Not|Never|Always|Often|Sometimes|Usually|Rarely)/i)) {
    return 'statement';
  }
  
  if (trimmed.match(/^\d+/) || trimmed.includes('%') || trimmed.includes('mg') || trimmed.includes('mcg')) {
    return 'data';
  }
  
  if (trimmed.match(/^(Picture|Imagine|Let|Think|Consider|Suppose|Assume|Pretend|Visualize|Envision)/i)) {
    return 'story';
  }
  
  return 'other';
}

/**
 * Count the number of sentences
 */
function countSentences(content: string): number {
  return content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}

/**
 * Calculate average sentence length
 */
function avgSentenceLength(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  
  const totalWords = sentences.reduce((sum, s) => sum + s.split(' ').length, 0);
  return Math.round(totalWords / sentences.length);
}

/**
 * Detect the structure type of the content
 */
function detectStructure(content: string): 'comparison' | 'question-answer' | 'explanation' | 'list' | 'other' {
  const lower = content.toLowerCase();
  
  if (lower.includes(' vs ') || lower.includes(' vs. ') || lower.includes(' versus ') || 
      lower.includes(' compared to ') || lower.includes(' better than ') || 
      lower.includes(' worse than ') || lower.includes(' more than ') || 
      lower.includes(' less than ')) {
    return 'comparison';
  }
  
  if (lower.includes('?') && lower.includes('.') && 
      (lower.includes(' because ') || lower.includes(' answer ') || lower.includes(' reason '))) {
    return 'question-answer';
  }
  
  if (lower.includes(' why ') || lower.includes(' because ') || lower.includes(' reason ') || 
      lower.includes(' explains ') || lower.includes(' mechanism ') || lower.includes(' process ')) {
    return 'explanation';
  }
  
  if (lower.includes(' step ') || lower.includes(' 1.') || lower.includes(' 2.') || 
      lower.includes(' first ') || lower.includes(' second ') || lower.includes(' third ') ||
      lower.includes(' finally ') || lower.includes(' lastly ')) {
    return 'list';
  }
  
  return 'other';
}

/**
 * Detect how the content ends
 */
function detectEndingType(content: string): 'question' | 'advice' | 'exclamation' | 'statement' {
  const trimmed = content.trim();
  
  if (trimmed.endsWith('?')) {
    return 'question';
  }
  
  if (trimmed.includes('!')) {
    return 'exclamation';
  }
  
  if (trimmed.includes(' try ') || trimmed.includes(' do ') || trimmed.includes(' start ') || 
      trimmed.includes(' begin ') || trimmed.includes(' use ') || trimmed.includes(' add ') ||
      trimmed.includes(' take ') || trimmed.includes(' avoid ') || trimmed.includes(' stop ')) {
    return 'advice';
  }
  
  return 'statement';
}

/**
 * Count emojis in the content
 */
function countEmojis(content: string): number {
  // Unicode ranges for emojis
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  return (content.match(emojiRegex) || []).length;
}

/**
 * Check if content contains numbers
 */
function hasNumbers(content: string): boolean {
  return /\d+/.test(content);
}

/**
 * Check if content contains comparisons
 */
function hasComparison(content: string): boolean {
  const lower = content.toLowerCase();
  return /(vs|versus|compared to|better than|worse than|more than|less than|instead of|rather than)/i.test(lower);
}

/**
 * Detect the tone of the content
 */
function detectTone(content: string): 'enthusiastic' | 'curious' | 'scientific' | 'conversational' | 'neutral' {
  const lower = content.toLowerCase();
  
  if (lower.includes('!') || lower.includes('amazing') || lower.includes('incredible') || 
      lower.includes('fantastic') || lower.includes('awesome') || lower.includes('wow') ||
      lower.includes('unbelievable') || lower.includes('stunning')) {
    return 'enthusiastic';
  }
  
  if (lower.includes('?') || lower.includes('wonder') || lower.includes('curious') || 
      lower.includes('interesting') || lower.includes('fascinating') || lower.includes('intriguing') ||
      lower.includes('mystery') || lower.includes('puzzle')) {
    return 'curious';
  }
  
  if (lower.includes('study') || lower.includes('research') || lower.includes('data') || 
      lower.includes('evidence') || lower.includes('findings') || lower.includes('analysis') ||
      lower.includes('statistics') || lower.includes('results') || lower.includes('clinical')) {
    return 'scientific';
  }
  
  if (lower.includes('you') || lower.includes('your') || lower.includes('we') || 
      lower.includes('us') || lower.includes('our') || lower.includes('let\'s') ||
      lower.includes('let us') || lower.includes('together')) {
    return 'conversational';
  }
  
  return 'neutral';
}
