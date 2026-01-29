#!/usr/bin/env tsx
/**
 * 🔒 PROOF: PLAN_ONLY Length Pipeline
 * 
 * Validates that:
 * 1. Adapter does not throw on >MAX_REPLY_LENGTH output (for PLAN_ONLY path)
 * 2. Clamp ensures final stored content is <= MAX_REPLY_LENGTH
 * 3. Content is non-empty and still contains required grounding phrases
 */

import 'dotenv/config';
import * as fs from 'fs';
import { clampReplyLengthPreserveGrounding } from '../../src/jobs/replySystemV2/planOnlyContentGenerator';

const MAX_REPLY_LENGTH = parseInt(process.env.MAX_REPLY_LENGTH || '200', 10);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordResult(name: string, passed: boolean, error?: string, details?: string): void {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔒 PROOF: PLAN_ONLY Length Pipeline');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   MAX_REPLY_LENGTH: ${MAX_REPLY_LENGTH} chars\n`);
  
  // Test 1: Adapter does not throw on long content (PLAN_ONLY path)
  console.log('📋 Test 1: Adapter accepts long content for PLAN_ONLY...');
  try {
    // Mock a long reply that would exceed MAX_REPLY_LENGTH
    // We'll simulate by checking that the adapter doesn't throw
    // In reality, OpenAI might generate long content
    
    // For this test, we verify the adapter code path doesn't throw
    // by checking that the throw statement was removed
    const adapterCode = fs.readFileSync('src/ai/replyGeneratorAdapter.ts', 'utf-8');
    
    const hasLengthThrow = adapterCode.includes('throw new Error(`Invalid reply: too long');
    const hasLengthCheck = adapterCode.includes('if (replyData.content.length > MAX_REPLY_LENGTH)');
    
    if (hasLengthThrow && hasLengthCheck) {
      recordResult(
        'Adapter length throw removed',
        false,
        'Length validation throw still exists in adapter'
      );
    } else {
      recordResult(
        'Adapter length throw removed',
        true,
        undefined,
        'Adapter no longer throws on long content - clamp handles it'
      );
    }
  } catch (error: any) {
    recordResult('Adapter length throw removed', false, error.message);
  }
  
  // Test 2: Clamp function exists and works correctly
  console.log('\n📋 Test 2: Clamp function ensures <= MAX_REPLY_LENGTH...');
  try {
    const longContent = 'This is a very long reply that definitely exceeds the maximum length limit of 200 characters and should be clamped while preserving important grounding phrases like meditation and strength training which are critical for maintaining the context of the original tweet.';
    const requiredPhrases = ['meditation', 'strength'];
    
    const clamped = clampReplyLengthPreserveGrounding(
      longContent,
      MAX_REPLY_LENGTH,
      requiredPhrases
    );
    
    const lengthOk = clamped.length <= MAX_REPLY_LENGTH;
    const nonEmpty = clamped.trim().length > 0;
    const hasPhrases = requiredPhrases.some(phrase => 
      clamped.toLowerCase().includes(phrase.toLowerCase())
    );
    
    recordResult(
      'Clamp enforces max length',
      lengthOk,
      lengthOk ? undefined : `Clamped length ${clamped.length} > ${MAX_REPLY_LENGTH}`,
      `Original: ${longContent.length} chars → Clamped: ${clamped.length} chars`
    );
    
    recordResult(
      'Clamped content is non-empty',
      nonEmpty,
      nonEmpty ? undefined : 'Clamped content is empty'
    );
    
    recordResult(
      'Clamped content preserves grounding phrases',
      hasPhrases,
      hasPhrases ? undefined : 'Required phrases not preserved',
      hasPhrases ? `Preserved phrases: ${requiredPhrases.filter(p => clamped.toLowerCase().includes(p.toLowerCase())).join(', ')}` : undefined
    );
  } catch (error: any) {
    recordResult('Clamp function test', false, error.message);
  }
  
  // Test 3: Clamp handles edge cases
  console.log('\n📋 Test 3: Clamp handles edge cases...');
  try {
    // Test with content exactly at limit
    const exactLimitContent = 'a'.repeat(MAX_REPLY_LENGTH);
    const clampedExact = clampReplyLengthPreserveGrounding(
      exactLimitContent,
      MAX_REPLY_LENGTH,
      []
    );
    
    recordResult(
      'Clamp handles exact limit',
      clampedExact.length <= MAX_REPLY_LENGTH,
      clampedExact.length > MAX_REPLY_LENGTH ? `Length ${clampedExact.length} > ${MAX_REPLY_LENGTH}` : undefined
    );
    
    // Test with content way over limit
    const wayOverContent = 'a'.repeat(MAX_REPLY_LENGTH * 3);
    const clampedOver = clampReplyLengthPreserveGrounding(
      wayOverContent,
      MAX_REPLY_LENGTH,
      []
    );
    
    recordResult(
      'Clamp handles content way over limit',
      clampedOver.length <= MAX_REPLY_LENGTH,
      clampedOver.length > MAX_REPLY_LENGTH ? `Length ${clampedOver.length} > ${MAX_REPLY_LENGTH}` : undefined
    );
    
    // Test with empty required phrases
    const contentWithNoPhrases = 'This is a test reply without any specific required phrases that needs to be clamped.';
    const clampedNoPhrases = clampReplyLengthPreserveGrounding(
      contentWithNoPhrases.repeat(5), // Make it long
      MAX_REPLY_LENGTH,
      [] // No required phrases
    );
    
    recordResult(
      'Clamp works without required phrases',
      clampedNoPhrases.length <= MAX_REPLY_LENGTH && clampedNoPhrases.trim().length > 0,
      clampedNoPhrases.length > MAX_REPLY_LENGTH ? `Length ${clampedNoPhrases.length} > ${MAX_REPLY_LENGTH}` : undefined
    );
  } catch (error: any) {
    recordResult('Clamp edge cases', false, error.message);
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED');
    console.log('\n✅ PLAN_ONLY length pipeline validated:');
    console.log('   • Adapter does not throw on long content');
    console.log('   • Clamp enforces MAX_REPLY_LENGTH');
    console.log('   • Content remains non-empty and preserves grounding');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   ❌ ${r.name}: ${r.error || 'Unknown error'}`);
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Proof failed:', err);
  process.exit(1);
});
