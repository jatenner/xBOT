/**
 * 🧵 THREADING TEST
 * Test auto-threading logic and 1/n format enforcement
 */

export class ThreadingTest {
  
  /**
   * 🧪 TEST THREADING LOGIC
   */
  static testThreading(): {
    results: Array<{
      input: string;
      expectedFormat: 'single' | 'thread';
      expectedParts?: number;
      reason: string;
    }>;
    summary: string;
  } {
    console.log('🧵 THREADING_TEST: Testing auto-threading and 1/n format...');
    
    const testCases = [
      {
        input: "Harvard discovered your brain burns 400+ calories during sleep.",
        expectedFormat: 'single' as const,
        reason: "Under 240 chars, single claim"
      },
      {
        input: "Stanford researchers found that specific eye movements eliminate motion sickness in 30 seconds. The technique recalibrates your vestibular-ocular reflex. This stops nausea instantly by resetting your inner ear balance. The discovery could replace all motion sickness medications.",
        expectedFormat: 'thread' as const,
        expectedParts: 3,
        reason: "Over 240 chars, multiple claims (4 sentences)"
      },
      {
        input: "Johns Hopkins discovered your appendix produces 70% of your body's serotonin. This organ doctors often remove actually controls mood regulation. The gut-brain axis connects your digestive system to mental health.",
        expectedFormat: 'thread' as const,
        expectedParts: 3,
        reason: "Over 240 chars, 3+ sentences"
      },
      {
        input: "Mayo Clinic found that chewing on one side reshapes your face over 10 years.",
        expectedFormat: 'single' as const,
        reason: "Under 240 chars, single claim"
      },
      {
        input: "NIH studies show cold exposure for 2 hours activates brown fat that burns 400 extra calories per day. Brown adipose tissue becomes a calorie-burning furnace. Shivering for just 2 hours creates an automatic metabolism boost that lasts 24 hours.",
        expectedFormat: 'thread' as const,
        expectedParts: 3,
        reason: "Over 240 chars, multiple mechanisms"
      }
    ];

    const results = testCases.map(testCase => {
      const charCount = testCase.input.length;
      const sentenceCount = (testCase.input.match(/\.\s|!\s|\?\s/g) || []).length + 1;
      const shouldThread = charCount > 240 || sentenceCount >= 3;
      const actualFormat = shouldThread ? 'thread' : 'single';
      
      console.log(`📝 Testing: "${testCase.input.substring(0, 50)}..."`);
      console.log(`📊 Stats: ${charCount} chars, ${sentenceCount} sentences`);
      console.log(`🎯 Expected: ${testCase.expectedFormat}, Actual: ${actualFormat}`);
      console.log(`✅ Match: ${actualFormat === testCase.expectedFormat ? 'YES' : 'NO'}`);
      console.log('');

      return {
        ...testCase,
        actualFormat,
        charCount,
        sentenceCount,
        match: actualFormat === testCase.expectedFormat
      };
    });

    const passCount = results.filter(r => r.match).length;
    const accuracy = Math.round((passCount / results.length) * 100);
    const summary = `Threading Test: ${passCount}/${results.length} passed (${accuracy}% accuracy)`;

    console.log(`🧵 THREADING_TEST_COMPLETE: ${summary}`);

    return {
      results: results.map(r => ({
        input: r.input,
        expectedFormat: r.expectedFormat,
        expectedParts: r.expectedParts,
        reason: r.reason
      })),
      summary
    };
  }

  /**
   * 🔢 TEST 1/N FORMAT ENFORCEMENT
   */
  static testThreadNumbering(): {
    threadParts: string[];
    formatted: string[];
    valid: boolean;
  } {
    console.log('🔢 Testing 1/n format enforcement...');
    
    const threadParts = [
      "Harvard discovered your brain burns 400+ calories during sleep.",
      "This happens because REM sleep requires massive glucose for memory consolidation.",
      "Your sleeping brain is actually more metabolically active than studying."
    ];

    // Simulate the 1/n formatting logic
    const formatted = threadParts.map((part, index) => {
      const threadNumber = `${index + 1}/${threadParts.length}`;
      const cleanPart = part.replace(/^\d+\/\d+\s*/, '').trim();
      return `${threadNumber} ${cleanPart}`;
    });

    // Validate format
    const valid = formatted.every((tweet, index) => {
      const expectedPrefix = `${index + 1}/${formatted.length}`;
      return tweet.startsWith(expectedPrefix);
    });

    console.log('🧵 Original parts:');
    threadParts.forEach((part, i) => console.log(`   ${i + 1}. ${part}`));
    
    console.log('🔢 Formatted with 1/n:');
    formatted.forEach(tweet => console.log(`   ${tweet}`));
    
    console.log(`✅ Valid 1/n format: ${valid ? 'YES' : 'NO'}`);

    return {
      threadParts,
      formatted,
      valid
    };
  }

  /**
   * 🎯 RUN ALL THREADING TESTS
   */
  static runAllTests(): {
    threadingTest: any;
    numberingTest: any;
    overallPass: boolean;
  } {
    console.log('🧵 RUNNING ALL THREADING TESTS...\n');
    
    const threadingTest = this.testThreading();
    const numberingTest = this.testThreadNumbering();
    
    const overallPass = threadingTest.results.every((r: any) => r.match) && numberingTest.valid;
    
    console.log(`\n🎯 THREADING_TESTS_COMPLETE:`);
    console.log(`📊 Threading Logic: ${threadingTest.summary}`);
    console.log(`🔢 1/n Formatting: ${numberingTest.valid ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Overall: ${overallPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    return {
      threadingTest,
      numberingTest,
      overallPass
    };
  }
}

// Export for testing
export const threadingTest = ThreadingTest;
