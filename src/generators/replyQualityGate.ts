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
}

/**
 * Validate reply quality
 * @param replyText Reply text
 * @param targetTweetText Target tweet text
 * @returns Quality result
 */
export function validateReplyQuality(replyText: string, targetTweetText: string): ReplyQualityResult {
  const chars = replyText.length;
  const sentences = replyText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const overlapScore = calculateOverlapScore(replyText, targetTweetText);
  
  // Check length
  if (chars > 280) {
    return {
      passed: false,
      reason: `Too long: ${chars} chars (max 280)`,
      chars,
      sentences,
      overlapScore
    };
  }
  
  // Check sentence count
  if (sentences > 3) {
    return {
      passed: false,
      reason: `Too many sentences: ${sentences} (max 3)`,
      chars,
      sentences,
      overlapScore
    };
  }
  
  // Check overlap score (at least 10% keyword overlap)
  if (overlapScore < 0.1) {
    return {
      passed: false,
      reason: `Low context relevance: ${(overlapScore * 100).toFixed(1)}% overlap (min 10%)`,
      chars,
      sentences,
      overlapScore
    };
  }
  
  return {
    passed: true,
    chars,
    sentences,
    overlapScore
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

