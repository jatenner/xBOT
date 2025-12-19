/**
 * Post Quality Gate
 * 
 * Hard validation gate for posts to ensure singles don't contain thread markers
 * and threads meet minimum quality standards. FAILS CLOSED.
 */

import type { PostPlan } from '../contracts/PostPlannerContract';

export interface QualityCheckResult {
  passed: boolean;
  reason: string;
  issues: string[];
}

// Disallowed markers/phrases for SINGLE posts
const THREAD_MARKERS = {
  numbering: /\b\d+\/\d+\b|^\d+\/|^\(\d+\//, // "1/5" or "(1/" at start
  emoji: /🧵/,
  keyword: /\bthread\b/i,
  partIndicators: /\bpart\s+(one|1|i)\b/i,
  continuationPhrases: [
    "let's explore",
    "let's break this down",
    "in this thread",
    "more below",
    "next tweet",
    "continued in",
    "see next",
    "keep reading",
    "thread 👇",
    "a thread",
    "mini thread"
  ]
};

/**
 * Check if text contains thread markers (for single posts)
 */
function containsThreadMarkers(text: string): { found: boolean; markers: string[] } {
  const markers: string[] = [];
  
  // Check numbering
  if (THREAD_MARKERS.numbering.test(text)) {
    markers.push('numbering (e.g., "1/5")');
  }
  
  // Check emoji
  if (THREAD_MARKERS.emoji.test(text)) {
    markers.push('thread emoji (🧵)');
  }
  
  // Check keyword
  if (THREAD_MARKERS.keyword.test(text)) {
    markers.push('word "thread"');
  }
  
  // Check part indicators
  if (THREAD_MARKERS.partIndicators.test(text)) {
    markers.push('part indicator ("part 1", "part one")');
  }
  
  // Check continuation phrases
  const lowerText = text.toLowerCase();
  for (const phrase of THREAD_MARKERS.continuationPhrases) {
    if (lowerText.includes(phrase.toLowerCase())) {
      markers.push(`continuation phrase ("${phrase}")`);
      break; // Only report first match
    }
  }
  
  return { found: markers.length > 0, markers };
}

/**
 * Validate a single post
 */
function validateSingle(text: string): QualityCheckResult {
  const issues: string[] = [];
  
  // Check length
  if (text.length === 0) {
    issues.push('Empty text');
  }
  
  if (text.length > 280) {
    issues.push(`Too long: ${text.length} chars (max 280)`);
  }
  
  // Check for thread markers
  const { found, markers } = containsThreadMarkers(text);
  if (found) {
    issues.push(`Contains thread markers: ${markers.join(', ')}`);
  }
  
  if (issues.length > 0) {
    return {
      passed: false,
      reason: 'SINGLE_WITH_THREAD_MARKERS',
      issues
    };
  }
  
  return {
    passed: true,
    reason: 'OK',
    issues: []
  };
}

/**
 * Validate a thread post
 */
function validateThread(tweets: string[], threadGoal: string): QualityCheckResult {
  const issues: string[] = [];
  
  // Check tweet count
  if (tweets.length < 2) {
    issues.push(`Too few tweets: ${tweets.length} (min 2)`);
  }
  
  if (tweets.length > 6) {
    issues.push(`Too many tweets: ${tweets.length} (max 6)`);
  }
  
  // Check each tweet length
  tweets.forEach((tweet, i) => {
    if (tweet.length === 0) {
      issues.push(`Tweet ${i + 1} is empty`);
    }
    if (tweet.length > 280) {
      issues.push(`Tweet ${i + 1} too long: ${tweet.length} chars (max 280)`);
    }
  });
  
  // Check first tweet has a hook (starts with strong claim/question)
  if (tweets.length > 0) {
    const firstTweet = tweets[0].trim();
    if (firstTweet.length < 20) {
      issues.push('First tweet too short to be a hook (min 20 chars)');
    }
  }
  
  // Check last tweet has closure (contains takeaway indicators)
  if (tweets.length > 1) {
    const lastTweet = tweets[tweets.length - 1].toLowerCase();
    const hasClosureMarkers = [
      'takeaway', 'key', 'remember', 'bottom line', 'lesson',
      'so', "that's why", 'in short', 'tldr', 'summary'
    ].some(marker => lastTweet.includes(marker));
    
    // Don't fail on this, just note it
    if (!hasClosureMarkers && lastTweet.length < 50) {
      issues.push('Last tweet might lack clear takeaway/closure');
    }
  }
  
  // Check thread goal
  if (!threadGoal || threadGoal.length === 0) {
    issues.push('Missing thread_goal');
  }
  
  if (issues.length > 0) {
    // Determine severity
    const criticalIssues = issues.filter(i => 
      i.includes('Too few') || 
      i.includes('Too many') || 
      i.includes('too long') ||
      i.includes('empty')
    );
    
    if (criticalIssues.length > 0) {
      return {
        passed: false,
        reason: 'THREAD_STRUCTURE_INVALID',
        issues
      };
    }
    
    // Warnings only, still pass
    return {
      passed: true,
      reason: 'OK_WITH_WARNINGS',
      issues
    };
  }
  
  return {
    passed: true,
    reason: 'OK',
    issues: []
  };
}

/**
 * Main quality gate check
 */
export function checkPostQuality(plan: PostPlan): QualityCheckResult {
  if (plan.post_type === 'single') {
    return validateSingle(plan.text);
  } else if (plan.post_type === 'thread') {
    return validateThread(plan.tweets, plan.thread_goal);
  } else {
    return {
      passed: false,
      reason: 'INVALID_POST_TYPE',
      issues: ['Unknown post_type: must be "single" or "thread"']
    };
  }
}

/**
 * Check if regeneration is recommended
 */
export function shouldRegenerate(result: QualityCheckResult): boolean {
  return !result.passed;
}

