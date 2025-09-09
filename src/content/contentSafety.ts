/**
 * 🛡️ CONTENT SAFETY & FACT-CHECKING GATE
 * Reduces false claims while keeping content velocity
 */

import { KNOWN_BOGUS_PATTERNS } from './knownBogus';

const FACT_CHECK_MODE = (process.env.FACT_CHECK_MODE ?? 'light') as 'off' | 'light' | 'strict';

export interface ContentSafetyResult {
  ok: boolean;
  sanitized: string;
  reasons: string[];
  originalLength: number;
  sanitizedLength: number;
}

/**
 * 🔍 CHECK AND SANITIZE CONTENT
 */
export function checkAndSanitizeContent(text: string): ContentSafetyResult {
  const originalLength = text.length;
  
  if (FACT_CHECK_MODE === 'off') {
    return {
      ok: true,
      sanitized: text,
      reasons: [],
      originalLength,
      sanitizedLength: originalLength
    };
  }

  // Normalize whitespace and split into sentences
  const normalized = text.replace(/\s+/g, ' ').trim();
  const sentences = splitIntoSentences(normalized);
  
  const reasons: string[] = [];
  const keptSentences: string[] = [];

  for (const sentence of sentences) {
    const sentenceResult = processSentence(sentence.trim());
    
    if (sentenceResult.keep) {
      keptSentences.push(sentenceResult.text);
    } else {
      reasons.push(sentenceResult.reason || 'Content safety filter');
    }
  }

  const sanitized = keptSentences.join(' ').trim();
  const sanitizedLength = sanitized.length;
  
  // If thread becomes empty after sanitization, block it
  const ok = sanitized.length > 20; // Minimum viable content
  
  if (!ok && reasons.length === 0) {
    reasons.push('no_content_after_factcheck');
  }

  console.log(`🛡️ FACT_CHECK: ${FACT_CHECK_MODE} mode, ${originalLength}→${sanitizedLength} chars, ${reasons.length} issues`);
  
  return {
    ok,
    sanitized,
    reasons,
    originalLength,
    sanitizedLength
  };
}

interface SentenceResult {
  keep: boolean;
  text: string;
  reason?: string;
}

/**
 * 🔎 PROCESS INDIVIDUAL SENTENCE
 */
function processSentence(sentence: string): SentenceResult {
  // Check against known bogus patterns
  for (const pattern of KNOWN_BOGUS_PATTERNS) {
    if (pattern.test(sentence)) {
      return {
        keep: false,
        text: '',
        reason: `known_bogus_pattern: ${pattern.source}`
      };
    }
  }

  // Check for strong numeric claims without sources
  const hasStrongNumericClaim = /\b\d{2,}%\b/.test(sentence);
  const hasSourceCue = /(source|study|trial|RCT|meta-?analysis|Harvard|JAMA|NEJM|Cochrane|Nature|Science|PLOS)/i.test(sentence);

  if (hasStrongNumericClaim && !hasSourceCue) {
    if (FACT_CHECK_MODE === 'light') {
      return {
        keep: false,
        text: '',
        reason: 'numeric_claim_without_source'
      };
    } else if (FACT_CHECK_MODE === 'strict') {
      // Replace with softer version
      const softened = sentence
        .replace(/\b\d{2,}%\b/g, 'significant amounts')
        .replace(/^/, 'Studies suggest ');
      
      return {
        keep: true,
        text: softened,
        reason: 'softened_numeric_claim'
      };
    }
  }

  return { keep: true, text: sentence };
}

/**
 * ✂️ SPLIT INTO SENTENCES
 */
function splitIntoSentences(text: string): string[] {
  return text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
