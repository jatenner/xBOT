/**
 * PRE-QUALITY VALIDATOR
 * Catches quality issues BEFORE content reaches quality gates
 * Auto-fixes common problems or flags for retry
 */

export interface ValidationResult {
  passes: boolean;
  score: number;
  issues: string[];
  fixes: string[];
  autoFixable: boolean;
}

/**
 * Validate content against quality requirements
 * Returns issues and suggested fixes
 */
export function validateContent(content: string | string[]): ValidationResult {
  const fullText = Array.isArray(content) ? content.join(' ') : content;
  const issues: string[] = [];
  const fixes: string[] = [];
  let score = 100;
  let autoFixable = true;

  // ❌ Check 1: Personal pronouns (AUTO-FAIL)
  const personalPronouns = /\b(I|me|my|we|us|our|myself|ourselves|I'm|I've|we're|we've)\b/gi;
  const pronounMatches = fullText.match(personalPronouns);
  if (pronounMatches && pronounMatches.length > 0) {
    issues.push(`Contains personal pronouns: ${[...new Set(pronounMatches)].join(', ')}`);
    fixes.push('Rewrite in third-person expert voice');
    score -= 30;
    autoFixable = false; // Requires full rewrite
  }

  // ❌ Check 2: Anecdotal phrases (AUTO-FAIL)
  const anecdotalPhrases = /\b(worked for me|my friend|I found|I tried|I discovered|in my experience|personally|from my perspective)\b/gi;
  const anecdotalMatches = fullText.match(anecdotalPhrases);
  if (anecdotalMatches && anecdotalMatches.length > 0) {
    issues.push(`Contains anecdotal phrases: ${[...new Set(anecdotalMatches)].join(', ')}`);
    fixes.push('Remove personal anecdotes, use research instead');
    score -= 30;
    autoFixable = false;
  }

  // ⚠️ Check 3: Specificity - needs numbers
  const hasPercentage = /\d+(\.\d+)?%/.test(fullText);
  const hasSampleSize = /n\s*=\s*\d+|sample.*\d+|participants.*\d+/i.test(fullText);
  const hasNumber = /\b\d+(\.\d+)?\b/.test(fullText);
  const numberCount = (fullText.match(/\b\d+(\.\d+)?\b/g) || []).length;

  if (numberCount < 2) {
    issues.push('Missing specific data points (need 2+ numbers/percentages)');
    fixes.push('Add specific numbers, percentages, or sample sizes');
    score -= 15;
  }

  // ⚠️ Check 4: Citation/Authority
  const institutions = /\b(harvard|stanford|yale|mit|mayo clinic|johns hopkins|nih|cdc|fda|oxford|cambridge)\b/gi;
  const yearPattern = /\b(19|20)\d{2}\b/;
  const hasCitation = institutions.test(fullText) || yearPattern.test(fullText);
  
  if (!hasCitation) {
    issues.push('Missing research citation or institution reference');
    fixes.push('Add institution name + year (e.g., "Stanford 2022")');
    score -= 15;
  }

  // ⚠️ Check 5: Mechanism explanation
  const mechanismWords = /\b(because|through|via|by|mechanism|works by|due to|caused by|enables|triggers)\b/i;
  if (!mechanismWords.test(fullText)) {
    issues.push('Missing mechanism explanation (HOW/WHY it works)');
    fixes.push('Explain the mechanism or causation');
    score -= 10;
  }

  // ⚠️ Check 6: Vague claims
  const vaguePhrases = /\b(studies show|research suggests|experts say|many believe|some people|it is known)\b/gi;
  const vagueMatches = fullText.match(vaguePhrases);
  if (vagueMatches && vagueMatches.length > 0) {
    issues.push(`Contains vague claims: ${[...new Set(vagueMatches)].join(', ')}`);
    fixes.push('Replace with specific studies or institutions');
    score -= 15;
  }

  // ⚠️ Check 7: Casual language
  const casualWords = /\b(crazy|insane|mind-blown|mind-blowing|amazing|incredible|unbelievable|shocking|wild)\b/gi;
  const casualMatches = fullText.match(casualWords);
  if (casualMatches && casualMatches.length > 0) {
    issues.push(`Contains casual language: ${[...new Set(casualMatches)].join(', ')}`);
    fixes.push('Use authoritative tone instead');
    score -= 10;
  }

  // ⚠️ Check 8: Character limits
  if (Array.isArray(content)) {
    // Thread - check each tweet
    const longTweets = content.filter(tweet => tweet.length > 270);
    if (longTweets.length > 0) {
      issues.push(`${longTweets.length} tweet(s) exceed 270 characters`);
      fixes.push('Shorten tweets by removing filler words or splitting content');
      score -= 20;
      autoFixable = true; // Can be auto-shortened
    }
  } else {
    // Single tweet
    if (content.length > 270) {
      issues.push(`Tweet too long: ${content.length} chars (max 270)`);
      fixes.push('Shorten by removing filler words: that, very, really, just');
      score -= 20;
      autoFixable = true;
    }
  }

  // ⚠️ Check 9: Hook quality (first tweet/sentence)
  const firstPart = Array.isArray(content) ? content[0] : content.split('.')[0];
  const hasHook = /\d+%|surprising|counterintuitive|contrary|challenge|myth|\?/i.test(firstPart);
  if (!hasHook) {
    issues.push('Weak hook - needs curiosity gap or surprising element');
    fixes.push('Start with surprising statistic or counterintuitive claim');
    score -= 10;
  }

  const passes = score >= 78; // Minimum quality threshold

  return {
    passes,
    score,
    issues,
    fixes,
    autoFixable: autoFixable && !passes
  };
}

/**
 * Auto-fix common issues
 * Returns fixed content or null if can't auto-fix
 */
export function autoFixContent(content: string | string[]): string | string[] | null {
  if (Array.isArray(content)) {
    // Fix each tweet in thread
    const fixed = content.map(tweet => autoFixSingleTweet(tweet));
    return fixed;
  } else {
    // Fix single tweet
    return autoFixSingleTweet(content);
  }
}

function autoFixSingleTweet(tweet: string): string {
  let fixed = tweet;

  // Remove filler words
  fixed = fixed.replace(/\b(that|very|really|just|actually|basically)\b\s*/gi, '');
  
  // Remove casual exclamations
  fixed = fixed.replace(/\b(crazy|insane|mind-blown|mind-blowing|amazing|incredible|unbelievable|shocking|wild)\b/gi, '');
  
  // Clean up extra spaces
  fixed = fixed.replace(/\s+/g, ' ').trim();
  
  // If still too long, try harder truncation
  if (fixed.length > 270) {
    // Try to truncate at sentence boundary
    const sentences = fixed.split(/[.!?]\s+/);
    let truncated = '';
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= 270) {
        truncated += (truncated ? '. ' : '') + sentence;
      } else {
        break;
      }
    }
    if (truncated) {
      fixed = truncated + (truncated.endsWith('.') ? '' : '.');
    }
  }

  return fixed;
}

/**
 * Check if content needs improvement (borderline passing)
 */
export function needsImprovement(validationResult: ValidationResult): boolean {
  // Score between 70-85: could be better
  return validationResult.score >= 70 && validationResult.score < 85;
}

/**
 * Generate improvement prompt based on validation issues
 */
export function generateImprovementPrompt(
  originalContent: string | string[],
  validation: ValidationResult
): string {
  const contentStr = Array.isArray(originalContent) 
    ? originalContent.join('\n') 
    : originalContent;

  let prompt = `The following content scored ${validation.score}/100 and has these issues:\n\n`;
  
  validation.issues.forEach((issue, i) => {
    prompt += `${i + 1}. ${issue}\n   Fix: ${validation.fixes[i]}\n`;
  });

  prompt += `\nOriginal content:\n"${contentStr}"\n\n`;
  prompt += `Generate improved version that:\n`;
  validation.fixes.forEach(fix => {
    prompt += `• ${fix}\n`;
  });
  prompt += `\nIMPORTANT: Maintain the core insight but fix the quality issues.`;
  prompt += `\nMax 270 characters per tweet.`;

  return prompt;
}

/**
 * Quick validation for common auto-fail issues
 */
export function hasAutoFailIssues(content: string | string[]): {
  hasFails: boolean;
  reasons: string[];
} {
  const fullText = Array.isArray(content) ? content.join(' ') : content;
  const reasons: string[] = [];

  // Personal pronouns
  if (/\b(I|me|my|we|us|our)\b/gi.test(fullText)) {
    reasons.push('Contains personal pronouns');
  }

  // Anecdotal phrases
  if (/\b(worked for me|my friend|I found|I tried)\b/gi.test(fullText)) {
    reasons.push('Contains anecdotal phrases');
  }

  // Medical advice
  if (/\b(take this|use this|you should take|recommended dose|treatment|cure|diagnose)\b/gi.test(fullText)) {
    reasons.push('Contains medical advice');
  }

  return {
    hasFails: reasons.length > 0,
    reasons
  };
}

