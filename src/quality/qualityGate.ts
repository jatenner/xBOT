import Ajv from 'ajv';
import { MIN_QUALITY_SCORE, TWEET_MAX_CHARS } from '../config/env';
import { ContentResult } from '../ai/prompts';

const ajv = new Ajv();

/**
 * JSON Schema for content validation
 */
const contentSchema = {
  type: 'object',
  required: ['format', 'topic', 'tweets'],
  properties: {
    format: {
      type: 'string',
      enum: ['thread', 'single']
    },
    topic: {
      type: 'string',
      minLength: 5,
      maxLength: 100
    },
    tweets: {
      type: 'array',
      minItems: 1,
      maxItems: 9,
      items: {
        type: 'string',
        minLength: 40,
        maxLength: TWEET_MAX_CHARS
      }
    },
    sources: {
      type: 'array',
      items: { type: 'string' }
    },
    metadata: {
      type: 'object',
      properties: {
        wordCount: { type: 'number' },
        hasEvidence: { type: 'boolean' },
        hasActionableAdvice: { type: 'boolean' },
        concreteExamples: { type: 'number' }
      }
    }
  }
};

const validateContent = ajv.compile(contentSchema);

/**
 * Banned phrases that indicate low-quality content
 */
const BANNED_PHRASES = [
  // Generic intros
  /let'?s dive in/i,
  /let'?s explore/i,
  /dive deep/i,
  
  // Thread teasers
  /thread below/i,
  /more in thread/i,
  /see thread/i,
  /👇/,
  
  // Vague promises
  /stay tuned/i,
  /more soon/i,
  /coming up/i,
  /this will change/i,
  /you won't believe/i,
  
  // Incomplete endings
  /\.{2,}$/,  // Multiple dots at end
  /\.\.\.\s*$/,  // Ellipsis at end
  
  // Generic hooks
  /here'?s why(?!\s+[a-z])/i,  // "Here's why" without specifics
  /you need to know this/i,
  /this is important/i,
  
  // Academic/clinical jargon starters
  /furthermore/i,
  /moreover/i,
  /in conclusion/i,
  /studies show/i,  // Unless followed by specific study
];

/**
 * Quality scoring weights
 */
const QUALITY_WEIGHTS = {
  completeness: 0.40,
  value: 0.25,
  clarity: 0.15,
  actionability: 0.10,
  engagement: 0.05,
  evidence: 0.05
};

export interface QualityResult {
  passed: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  improvements: string[];
  criteria: {
    completeness: number;
    value: number;
    clarity: number;
    actionability: number;
    engagement: number;
    evidence: number;
  };
}

/**
 * Comprehensive quality gate for Twitter content
 */
export class QualityGate {
  
  /**
   * Main quality validation function
   */
  static validate(content: ContentResult): QualityResult {
    console.log('🔍 QUALITY_GATE: Starting comprehensive validation');
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const improvements: string[] = [];
    
    // 1. JSON Schema validation
    if (!validateContent(content)) {
      const schemaErrors = validateContent.errors?.map(err => 
        `${err.instancePath} ${err.message}`
      ) || ['Schema validation failed'];
      errors.push(...schemaErrors);
    }
    
    // 2. Format-specific validation
    const formatValidation = this.validateFormat(content);
    errors.push(...formatValidation.errors);
    warnings.push(...formatValidation.warnings);
    
    // 3. Content quality checks
    const contentValidation = this.validateContentQuality(content);
    errors.push(...contentValidation.errors);
    warnings.push(...contentValidation.warnings);
    improvements.push(...contentValidation.improvements);
    
    // 4. Calculate quality scores
    const criteria = this.calculateQualityScores(content);
    const weightedScore = this.calculateWeightedScore(criteria);
    
    // 5. Determine pass/fail
    const passed = errors.length === 0 && weightedScore >= MIN_QUALITY_SCORE;
    
    if (!passed && errors.length === 0) {
      errors.push(`Quality score too low: ${weightedScore}/${MIN_QUALITY_SCORE} required`);
    }
    
    console.log(`📊 Quality score: ${weightedScore}/100, Passed: ${passed}`);
    
    return {
      passed,
      score: weightedScore,
      errors,
      warnings,
      improvements,
      criteria
    };
  }
  
  /**
   * Validate format-specific requirements
   */
  private static validateFormat(content: ContentResult): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (content.format === 'thread') {
      if (content.tweets.length < 5) {
        errors.push('Thread must have at least 5 tweets');
      }
      if (content.tweets.length > 9) {
        errors.push('Thread must have at most 9 tweets');
      }
    } else if (content.format === 'single') {
      if (content.tweets.length !== 1) {
        errors.push('Single format must have exactly 1 tweet');
      }
    }
    
    // Validate individual tweet lengths
    content.tweets.forEach((tweet, index) => {
      if (tweet.length < 40) {
        errors.push(`Tweet ${index + 1} too short: ${tweet.length} chars (min 40)`);
      }
      if (tweet.length > TWEET_MAX_CHARS) {
        errors.push(`Tweet ${index + 1} too long: ${tweet.length} chars (max ${TWEET_MAX_CHARS})`);
      }
    });
    
    return { errors, warnings };
  }
  
  /**
   * Validate content quality and detect issues
   */
  private static validateContentQuality(content: ContentResult): {
    errors: string[];
    warnings: string[];
    improvements: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const improvements: string[] = [];
    
    const allText = content.tweets.join(' ').toLowerCase();
    
    // Check for banned phrases
    const bannedFound = BANNED_PHRASES.filter(pattern => pattern.test(allText));
    if (bannedFound.length > 0) {
      errors.push(`Contains banned phrases: ${bannedFound.length} found`);
      improvements.push('Remove generic phrases like "Let\'s dive in", "thread below", ellipsis endings');
    }
    
    // Check for completeness
    const incompletePattern = /\.\.\.|more:|continued:|part \d/i;
    if (incompletePattern.test(allText)) {
      warnings.push('Content appears incomplete or has continuation markers');
      improvements.push('Make each tweet complete and self-contained');
    }
    
    // Check for actionability
    const actionWords = /\b(do|try|start|stop|avoid|use|add|remove|replace|follow|practice)\b/gi;
    const actionMatches = allText.match(actionWords) || [];
    if (actionMatches.length < 2) {
      warnings.push('Limited actionable advice detected');
      improvements.push('Add more specific, actionable instructions');
    }
    
    // Check for specificity
    const specificityIndicators = /\b(\d+|specific|exactly|precisely|\w+%|minutes?|hours?|days?|mg|ml|grams?)\b/gi;
    const specificMatches = allText.match(specificityIndicators) || [];
    if (specificMatches.length < 1) {
      warnings.push('Lacks specific numbers, timeframes, or quantities');
      improvements.push('Include specific numbers, timeframes, or measurements');
    }
    
    // Check for evidence/mechanisms
    const evidenceIndicators = /\b(because|since|due to|research|study|shows|proves|mechanism|reason|why)\b/gi;
    const evidenceMatches = allText.match(evidenceIndicators) || [];
    if (evidenceMatches.length < 1) {
      warnings.push('Limited evidence or explanations provided');
      improvements.push('Include brief explanations of why advice works');
    }
    
    // Check for engagement elements
    const engagementIndicators = /\b(you|your|yourself|personally|imagine|picture|think about)\b/gi;
    const engagementMatches = allText.match(engagementIndicators) || [];
    if (engagementMatches.length < 2) {
      warnings.push('Limited personal engagement language');
      improvements.push('Use more "you" language to engage readers directly');
    }
    
    return { errors, warnings, improvements };
  }
  
  /**
   * Calculate individual quality criteria scores
   */
  private static calculateQualityScores(content: ContentResult): {
    completeness: number;
    value: number;
    clarity: number;
    actionability: number;
    engagement: number;
    evidence: number;
  } {
    const allText = content.tweets.join(' ');
    
    // Completeness (40%): No incomplete markers, each tweet self-contained
    let completeness = 85;
    if (/\.\.\.|more:|continued:/i.test(allText)) completeness -= 20;
    if (BANNED_PHRASES.some(pattern => pattern.test(allText))) completeness -= 30;
    
    // Value (25%): Actionable advice, specific tips
    let value = 70;
    const actionWords = allText.match(/\b(do|try|start|stop|avoid|use|add|remove)\b/gi) || [];
    value += Math.min(actionWords.length * 5, 25);
    
    // Clarity (15%): Easy to understand, concise
    let clarity = 80;
    const avgWordsPerTweet = allText.split(' ').length / content.tweets.length;
    if (avgWordsPerTweet > 35) clarity -= 10; // Too wordy
    if (avgWordsPerTweet < 10) clarity -= 15; // Too sparse
    
    // Actionability (10%): Specific instructions
    let actionability = 60;
    const specificWords = allText.match(/\b(\d+|specific|exactly|\w+%|minutes?|hours?)\b/gi) || [];
    actionability += Math.min(specificWords.length * 8, 30);
    
    // Engagement (5%): Personal language, hooks
    let engagement = 70;
    const personalWords = allText.match(/\b(you|your|yourself)\b/gi) || [];
    engagement += Math.min(personalWords.length * 3, 20);
    
    // Evidence (5%): Mechanisms, sources
    let evidence = 60;
    const evidenceWords = allText.match(/\b(because|research|study|shows|mechanism)\b/gi) || [];
    evidence += Math.min(evidenceWords.length * 10, 30);
    
    return {
      completeness: Math.max(0, Math.min(100, completeness)),
      value: Math.max(0, Math.min(100, value)),
      clarity: Math.max(0, Math.min(100, clarity)),
      actionability: Math.max(0, Math.min(100, actionability)),
      engagement: Math.max(0, Math.min(100, engagement)),
      evidence: Math.max(0, Math.min(100, evidence))
    };
  }
  
  /**
   * Calculate weighted total score
   */
  private static calculateWeightedScore(criteria: any): number {
    const weighted = 
      criteria.completeness * QUALITY_WEIGHTS.completeness +
      criteria.value * QUALITY_WEIGHTS.value +
      criteria.clarity * QUALITY_WEIGHTS.clarity +
      criteria.actionability * QUALITY_WEIGHTS.actionability +
      criteria.engagement * QUALITY_WEIGHTS.engagement +
      criteria.evidence * QUALITY_WEIGHTS.evidence;
    
    return Math.round(weighted);
  }
  
  /**
   * Quick validation for regeneration decisions
   */
  static quickCheck(content: ContentResult): boolean {
    const bannedFound = BANNED_PHRASES.some(pattern => 
      pattern.test(content.tweets.join(' '))
    );
    
    const tooShort = content.tweets.some(tweet => tweet.length < 40);
    const tooLong = content.tweets.some(tweet => tweet.length > TWEET_MAX_CHARS);
    
    return !bannedFound && !tooShort && !tooLong;
  }
}

/**
 * Convenience function for standard validation
 */
export function validateContent(content: ContentResult): QualityResult {
  return QualityGate.validate(content);
}

/**
 * Text sanitization and final cleanup
 */
export function sanitizeForPosting(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')      // Italic
    .replace(/__(.*?)__/g, '$1')      // Underline
    .replace(/`(.*?)`/g, '$1')        // Code
    .replace(/#{1,6}\s+/g, '')        // Headers
    
    // Remove hashtags (as requested)
    .replace(/#\w+/g, '')
    
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Final length validation before posting
 */
export function validateFinalLength(text: string): {
  valid: boolean;
  length: number;
  error?: string;
} {
  const cleaned = sanitizeForPosting(text);
  const length = cleaned.length;
  
  if (length < 40) {
    return { 
      valid: false, 
      length, 
      error: `Tweet too short after cleanup: ${length} chars (min 40)` 
    };
  }
  
  if (length > TWEET_MAX_CHARS) {
    return { 
      valid: false, 
      length, 
      error: `Tweet too long after cleanup: ${length} chars (max ${TWEET_MAX_CHARS})` 
    };
  }
  
  return { valid: true, length };
}