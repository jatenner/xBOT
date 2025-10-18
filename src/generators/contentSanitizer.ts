/**
 * CONTENT SANITIZER
 * Post-generation filter that catches first-person and banned phrases
 * Acts as safety net even if generator produces bad content
 * 
 * This runs AFTER generation but BEFORE quality validation
 * Ensures no first-person or banned content makes it through
 */

import { BANNED_PHRASES, REQUIRED_PATTERNS, hasBannedPhrase, hasSpecificity } from './sharedPatterns';
import { supabaseClient } from '../db/supabaseClient';

export interface SanitizationResult {
  content: string;
  passed: boolean;
  violations: Violation[];
  specificity_score: number;
  specificity_matches: string[];
  auto_reject: boolean;
}

export interface Violation {
  type: 'first_person' | 'banned_phrase' | 'low_specificity' | 'incomplete_sentence';
  severity: 'critical' | 'high' | 'medium' | 'low';
  detected: string;
  location?: string;
}

/**
 * Main sanitization function
 * Returns detailed analysis of content quality and violations
 */
export function sanitizeContent(content: string | string[]): SanitizationResult {
  // Handle both single tweets and threads
  const fullContent = Array.isArray(content) ? content.join(' ') : content;
  const violations: Violation[] = [];
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 1: FIRST-PERSON LANGUAGE (CRITICAL)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const firstPersonViolations = detectFirstPerson(fullContent);
  violations.push(...firstPersonViolations);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 2: BANNED PHRASES (HIGH PRIORITY)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const bannedPhraseCheck = hasBannedPhrase(fullContent);
  if (bannedPhraseCheck.violated && bannedPhraseCheck.phrase) {
    violations.push({
      type: 'banned_phrase',
      severity: 'high',
      detected: bannedPhraseCheck.phrase
    });
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 3: INCOMPLETE SENTENCES (MEDIUM)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (fullContent.includes('...')) {
    violations.push({
      type: 'incomplete_sentence',
      severity: 'medium',
      detected: 'Ellipsis (...) detected - incomplete thought'
    });
  }
  
  // Check for cut-off words
  if (/\b\w{4,}\s*$/.test(fullContent) && !fullContent.match(/[.!?]$/)) {
    violations.push({
      type: 'incomplete_sentence',
      severity: 'medium',
      detected: 'Sentence appears to be cut off mid-thought'
    });
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECK 4: SPECIFICITY SCORE (MEDIUM)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const specificityCheck = hasSpecificity(fullContent);
  
  if (specificityCheck.score === 0) {
    violations.push({
      type: 'low_specificity',
      severity: 'medium',
      detected: 'No specific numbers, studies, or mechanisms found'
    });
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DETERMINE IF CONTENT SHOULD AUTO-REJECT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const autoReject = criticalViolations.length > 0;
  
  const passed = violations.length === 0;
  
  return {
    content: fullContent,
    passed,
    violations,
    specificity_score: specificityCheck.score,
    specificity_matches: specificityCheck.matches,
    auto_reject: autoReject
  };
}

/**
 * Detect first-person language (most critical violation)
 */
function detectFirstPerson(content: string): Violation[] {
  const violations: Violation[] = [];
  
  const firstPersonPatterns = [
    { 
      pattern: /\b(I|me|my|mine)\b/gi, 
      name: 'Personal pronouns (I, me, my, mine)',
      examples: ['I', 'me', 'my', 'mine']
    },
    { 
      pattern: /\bI've\b/gi, 
      name: "Contractions with 'I'",
      examples: ["I've"]
    },
    { 
      pattern: /\bI'm\b/gi, 
      name: "Contractions with 'I'",
      examples: ["I'm"]
    },
    { 
      pattern: /\bI'll\b/gi, 
      name: "Contractions with 'I'",
      examples: ["I'll"]
    },
    { 
      pattern: /worked for me\b/gi, 
      name: 'Anecdotal framing',
      examples: ['worked for me']
    },
    { 
      pattern: /\bmy (experience|gut|journey|results|friend)\b/gi, 
      name: 'Personal possession phrases',
      examples: ['my experience', 'my gut', 'my journey']
    },
    { 
      pattern: /\bI (tried|found|discovered|realized)\b/gi, 
      name: 'First-person action verbs',
      examples: ['I tried', 'I found', 'I discovered']
    },
    {
      pattern: /\bbeen diving deep\b/gi,
      name: 'First-person activity phrases',
      examples: ['been diving deep']
    }
  ];
  
  for (const { pattern, name, examples } of firstPersonPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      violations.push({
        type: 'first_person',
        severity: 'critical',
        detected: `${name}: "${matches[0]}"`,
        location: extractContext(content, matches[0])
      });
    }
  }
  
  return violations;
}

/**
 * Extract context around a detected phrase for logging
 */
function extractContext(content: string, phrase: string, contextLength: number = 50): string {
  const index = content.toLowerCase().indexOf(phrase.toLowerCase());
  if (index === -1) return phrase;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + phrase.length + contextLength);
  
  return '...' + content.substring(start, end) + '...';
}

/**
 * Format violation report for logging
 */
export function formatViolationReport(result: SanitizationResult): string {
  if (result.passed) {
    return `✅ SANITIZATION_PASSED (specificity: ${result.specificity_score})`;
  }
  
  const lines: string[] = [];
  lines.push(`❌ SANITIZATION_FAILED (${result.violations.length} violations)`);
  
  for (const violation of result.violations) {
    const emoji = violation.severity === 'critical' ? '🚨' : 
                  violation.severity === 'high' ? '⚠️' : 
                  violation.severity === 'medium' ? '⚡' : 'ℹ️';
    
    lines.push(`   ${emoji} ${violation.type}: ${violation.detected}`);
    if (violation.location) {
      lines.push(`      Context: ${violation.location}`);
    }
  }
  
  if (result.specificity_score > 0) {
    lines.push(`   ✓ Specificity: ${result.specificity_score} (${result.specificity_matches.join(', ')})`);
  }
  
  return lines.join('\n');
}

/**
 * Check if sanitization result should trigger retry
 */
export function shouldRetry(result: SanitizationResult): boolean {
  // Retry if there are critical violations (first-person)
  // or multiple high-severity violations
  
  const criticalCount = result.violations.filter(v => v.severity === 'critical').length;
  const highCount = result.violations.filter(v => v.severity === 'high').length;
  
  return criticalCount > 0 || highCount >= 2;
}

/**
 * Track violation in database for monitoring and improvement
 */
export async function trackViolation(params: {
  generatorName: string;
  topic?: string;
  format: 'single' | 'thread';
  violation: Violation;
  content: string;
  specificityScore: number;
  specificityMatches: string[];
  actionTaken: 'rejected' | 'retried' | 'posted_anyway';
  retrySucceeded?: boolean;
}): Promise<void> {
  try {
    const result = await supabaseClient.safeInsert('content_violations', {
      generator_name: params.generatorName,
      topic: params.topic || 'unknown',
      format: params.format,
      violation_type: params.violation.type,
      severity: params.violation.severity,
      detected_phrase: params.violation.detected,
      context_snippet: params.violation.location,
      content_preview: params.content.substring(0, 200),
      full_content: params.content,
      specificity_score: params.specificityScore,
      specificity_matches: params.specificityMatches,
      action_taken: params.actionTaken,
      retry_succeeded: params.retrySucceeded,
      metadata: {
        timestamp: new Date().toISOString(),
        content_length: params.content.length
      }
    });

    if (!result.success) {
      console.error('❌ VIOLATION_TRACKING_ERROR:', result.error);
    } else {
      console.log(`  ✓ Logged ${params.violation.severity} violation to database`);
    }
  } catch (error) {
    console.error('❌ VIOLATION_TRACKING_EXCEPTION:', error);
  }
}

/**
 * Get generator name from violation for tracking
 * Used to identify which generators need prompt fixes
 */
export function categorizeViolation(violation: Violation): {
  category: string;
  actionable: boolean;
  suggestion: string;
} {
  switch (violation.type) {
    case 'first_person':
      return {
        category: 'voice_violation',
        actionable: true,
        suggestion: 'Update generator prompt to enforce third-person perspective'
      };
    
    case 'banned_phrase':
      return {
        category: 'template_language',
        actionable: true,
        suggestion: 'Add banned phrase to generator system prompt'
      };
    
    case 'low_specificity':
      return {
        category: 'quality_issue',
        actionable: true,
        suggestion: 'Enhance prompt to require specific numbers/studies/mechanisms'
      };
    
    case 'incomplete_sentence':
      return {
        category: 'formatting_issue',
        actionable: false,
        suggestion: 'Check character limit validation'
      };
    
    default:
      return {
        category: 'unknown',
        actionable: false,
        suggestion: 'Review violation manually'
      };
  }
}

