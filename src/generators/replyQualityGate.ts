/**
 * Reply Quality Gate
 * 
 * Validates reply quality before posting:
 * - Length <= 280 chars, 1-2 sentences
 * - Concrete reference to target tweet (keyword overlap)
 * - Regenerate up to 2 times if fails
 */

import { calculateOverlapScore } from '../jobs/replyContextFetcher';

export interface ReplyQualityResult {
  passed: boolean;
  reason?: string;
  chars: number;
  sentences: number;
  overlapScore: number;
  attempt?: number; // For regeneration tracking
}

const GENERIC_TEMPLATES = [
  /here are \d+ (tips|ways|steps)/i,
  /\d+ tips? (for|to)/i,
  /follow these \d+ steps/i,
  /here's what you need to know/i,
  /let me break (this|it) down/i
];

/**
 * Validate reply quality - FAIL CLOSED
 * @param replyText Reply text
 * @param targetTweetText Target tweet text (parent context)
 * @param attempt Regeneration attempt number (for logging)
 * @returns Quality result
 */
export function validateReplyQuality(
  replyText: string, 
  targetTweetText: string,
  attempt: number = 1
): ReplyQualityResult {
  const chars = replyText.length;
  const sentences = replyText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const overlapScore = calculateOverlapScore(replyText, targetTweetText);
  
  // Check for JSON/code artifacts
  if (replyText.includes('{') || replyText.includes('}') || replyText.includes('[') || replyText.includes(']')) {
    return {
      passed: false,
      reason: 'Contains JSON/code artifacts { } [ ]',
      chars,
      sentences,
      overlapScore,
      attempt
    };
  }
  
  // Stricter length check (220 chars, not 280)
  if (chars > 220) {
    return {
      passed: false,
      reason: `Too long: ${chars} chars (max 220)`,
      chars,
      sentences,
      overlapScore,
      attempt
    };
  }
  
  // Minimum length (avoid empty/trivial replies)
  if (chars < 20) {
    return {
      passed: false,
      reason: `Too short: ${chars} chars (min 20)`,
      chars,
      sentences,
      overlapScore,
      attempt
    };
  }
  
  // Check sentence count (1-2 sentences preferred)
  if (sentences > 2) {
    return {
      passed: false,
      reason: `Too many sentences: ${sentences} (max 2)`,
      chars,
      sentences,
      overlapScore,
      attempt
    };
  }
  
  // Check overlap score - must reference parent context
  if (overlapScore < 0.1) {
    return {
      passed: false,
      reason: `Low context relevance: ${(overlapScore * 100).toFixed(1)}% overlap (min 10%)`,
      chars,
      sentences,
      overlapScore,
      attempt
    };
  }
  
  // Check for generic templates (unless parent asks for tips)
  const parentAsksForTips = /tips?|advice|suggestions?|how to|what should/i.test(targetTweetText);
  if (!parentAsksForTips) {
    for (const pattern of GENERIC_TEMPLATES) {
      if (pattern.test(replyText)) {
        return {
          passed: false,
          reason: 'Generic template detected (not requested)',
          chars,
          sentences,
          overlapScore,
          attempt
        };
      }
    }
  }
  
  // Extract keywords from both texts to verify semantic match
  const replyWords = new Set(replyText.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const parentWords = new Set(targetTweetText.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const commonWords = Array.from(replyWords).filter(w => parentWords.has(w));
  
  if (commonWords.length === 0) {
    return {
      passed: false,
      reason: 'No keyword match with parent (semantic mismatch)',
      chars,
      sentences,
      overlapScore,
      attempt
    };
  }
  
  return {
    passed: true,
    chars,
    sentences,
    overlapScore,
    attempt
  };
}

/**
 * Reply style options
 */
export type ReplyStyle = 'witty-smart' | 'crisp-educational' | 'curious-question';

/**
 * Choose reply style based on target tweet characteristics
 * @param targetTweetText Target tweet text
 * @returns Reply style
 */
export function chooseReplyStyle(targetTweetText: string): ReplyStyle {
  const lowerText = targetTweetText.toLowerCase();
  
  // Curious-question for statements or facts
  if (lowerText.includes('study') || lowerText.includes('research') || lowerText.includes('found')) {
    return 'curious-question';
  }
  
  // Witty-smart for opinions or hot takes
  if (lowerText.includes('think') || lowerText.includes('believe') || lowerText.includes('!')) {
    return 'witty-smart';
  }
  
  // Crisp-educational as default
  return 'crisp-educational';
}

