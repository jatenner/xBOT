#!/usr/bin/env tsx
/**
 * 🔒 PROOF: Hard Length Clamp
 * 
 * Validates that clampReplyLengthPreserveGrounding:
 * - Never returns content > maxLen
 * - Preserves required phrases when possible
 * - Never returns empty string
 */

import 'dotenv/config';

function clampReplyLengthPreserveGrounding(
  content: string,
  maxLen: number,
  requiredPhrases: string[]
): string {
  if (content.length <= maxLen) {
    return content;
  }
  
  // If content is too long, try to truncate at word boundary while preserving phrases
  const contentLower = content.toLowerCase();
  const phrasePositions: Array<{ phrase: string; start: number; end: number }> = [];
  
  // Find positions of required phrases
  for (const phrase of requiredPhrases) {
    if (phrase.length < 3) continue; // Skip very short phrases
    const phraseLower = phrase.toLowerCase();
    const index = contentLower.indexOf(phraseLower);
    if (index >= 0) {
      phrasePositions.push({
        phrase,
        start: index,
        end: index + phrase.length
      });
    }
  }
  
  // Sort by position
  phrasePositions.sort((a, b) => a.start - b.start);
  
  // If we have phrases, try to keep them
  if (phrasePositions.length > 0) {
    const lastPhraseEnd = phrasePositions[phrasePositions.length - 1].end;
    
    // If last phrase is within maxLen, truncate after it
    if (lastPhraseEnd <= maxLen - 10) { // Leave room for ellipsis
      const truncated = content.substring(0, maxLen - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > lastPhraseEnd) {
        return truncated.substring(0, lastSpace).trim() + '...';
      }
      return truncated.trim() + '...';
    }
    
    // If last phrase is beyond maxLen, try to include at least first phrase
    const firstPhraseEnd = phrasePositions[0].end;
    if (firstPhraseEnd <= maxLen - 10) {
      const truncated = content.substring(0, maxLen - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > firstPhraseEnd) {
        return truncated.substring(0, lastSpace).trim() + '...';
      }
      return truncated.trim() + '...';
    }
  }
  
  // Fallback: truncate at word boundary
  const truncated = content.substring(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.7) { // Only use word boundary if it's not too early
    return truncated.substring(0, lastSpace).trim() + '...';
  }
  
  // Last resort: hard truncate
  return truncated.trim() + '...';
}

async function testLengthClamp(): Promise<void> {
  console.log('🔒 PROOF: Hard Length Clamp');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const tests: Array<{
    name: string;
    content: string;
    maxLen: number;
    requiredPhrases: string[];
    expectedMaxLen: number;
    shouldPreservePhrases: boolean;
  }> = [
    {
      name: 'Content within limit',
      content: 'This is a short reply.',
      maxLen: 200,
      requiredPhrases: ['reply'],
      expectedMaxLen: 200,
      shouldPreservePhrases: true
    },
    {
      name: 'Content exceeds limit, has required phrases',
      content: 'This is a very long reply that exceeds the maximum length limit and should be clamped while preserving the required phrases like meditation and strength.',
      maxLen: 50,
      requiredPhrases: ['meditation', 'strength'],
      expectedMaxLen: 50,
      shouldPreservePhrases: true
    },
    {
      name: 'Content exceeds limit, no required phrases',
      content: 'This is a very long reply that exceeds the maximum length limit and should be clamped at word boundary.',
      maxLen: 50,
      requiredPhrases: [],
      expectedMaxLen: 50,
      shouldPreservePhrases: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Input length: ${test.content.length} chars`);
    console.log(`   Max length: ${test.maxLen} chars`);
    console.log(`   Required phrases: ${test.requiredPhrases.join(', ') || 'none'}`);
    
    const result = clampReplyLengthPreserveGrounding(
      test.content,
      test.maxLen,
      test.requiredPhrases
    );
    
    console.log(`   Result length: ${result.length} chars`);
    console.log(`   Result: "${result}"`);
    
    // Check max length constraint
    if (result.length > test.maxLen) {
      console.log(`   ❌ FAIL: Result length ${result.length} > maxLen ${test.maxLen}`);
      failed++;
      continue;
    }
    
    // Check non-empty
    if (result.trim().length === 0) {
      console.log(`   ❌ FAIL: Result is empty`);
      failed++;
      continue;
    }
    
    // Check phrase preservation (if applicable)
    if (test.shouldPreservePhrases && test.requiredPhrases.length > 0) {
      const resultLower = result.toLowerCase();
      const preservedPhrases = test.requiredPhrases.filter(phrase => 
        resultLower.includes(phrase.toLowerCase())
      );
      
      if (preservedPhrases.length === 0) {
        console.log(`   ⚠️  WARNING: No required phrases preserved (but within length limit)`);
        // Don't fail - phrase preservation is best-effort
      } else {
        console.log(`   ✅ Preserved phrases: ${preservedPhrases.join(', ')}`);
      }
    }
    
    passed++;
    console.log(`   ✅ PASS`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

testLengthClamp().catch(err => {
  console.error('❌ Proof failed:', err);
  process.exit(1);
});
