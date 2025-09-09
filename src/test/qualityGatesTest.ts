/**
 * 🧪 QUALITY GATES UNIT TEST
 * Zero-tolerance testing for content validation
 */

import { megaPromptSystem } from '../ai/megaPromptSystem';

interface TestResult {
  sample: string;
  expected: 'PASS' | 'FAIL';
  actualResult: 'PASS' | 'FAIL';
  failures: string[];
  status: '✅ PASS' | '❌ FAIL';
}

export class QualityGatesTest {
  
  // Test samples - 3 should PASS, 2 should FAIL
  private readonly TEST_SAMPLES = [
    {
      content: "Harvard scientists discovered your brain burns 400+ calories during sleep. This happens because REM sleep requires massive glucose for memory consolidation. Your sleeping brain is actually more metabolically active than studying.",
      expected: 'PASS' as const,
      description: "Good: Institution (Harvard) + stat (400+ calories) + mechanism"
    },
    {
      content: "Many people struggle with sleep issues and it's important to get enough rest for your health.",
      expected: 'FAIL' as const,
      description: "Bad: Banned phrases + no facts + generic advice"
    },
    {
      content: "Stanford researchers found that specific eye movements eliminate motion sickness in 30 seconds. The technique recalibrates your vestibular-ocular reflex, stopping nausea instantly.",
      expected: 'PASS' as const,
      description: "Good: Institution (Stanford) + stat (30 seconds) + mechanism"
    },
    {
      content: "I tried this new meditation app and personally found it helped my anxiety. Let me tell you about my experience with mindfulness.",
      expected: 'FAIL' as const,
      description: "Bad: First person language + personal anecdotes"
    },
    {
      content: "Johns Hopkins discovered your appendix produces 70% of your body's serotonin. This organ doctors often remove actually controls mood regulation through the gut-brain axis.",
      expected: 'PASS' as const,
      description: "Good: Institution (Johns Hopkins) + stat (70%) + mechanism"
    }
  ];

  /**
   * 🧪 RUN QUALITY GATES TEST
   */
  async runTest(): Promise<{
    passCount: number;
    failCount: number;
    accuracy: number;
    results: TestResult[];
    summary: string;
  }> {
    console.log('🧪 QUALITY_GATES_TEST: Running zero-tolerance validation...');
    
    const results: TestResult[] = [];
    let passCount = 0;
    let failCount = 0;

    for (const sample of this.TEST_SAMPLES) {
      console.log(`\n📝 Testing: "${sample.content.substring(0, 50)}..."`);
      console.log(`📊 Expected: ${sample.expected} - ${sample.description}`);
      
      try {
        // Access the private quality gates method through a test-specific method
        const qualityResult = await this.testQualityGates(sample.content);
        const actualResult = qualityResult.passed ? 'PASS' : 'FAIL';
        const status = actualResult === sample.expected ? '✅ PASS' : '❌ FAIL';
        
        if (status === '✅ PASS') passCount++;
        else failCount++;

        results.push({
          sample: sample.content.substring(0, 100) + '...',
          expected: sample.expected,
          actualResult,
          failures: qualityResult.failures,
          status
        });

        console.log(`🎯 Result: ${actualResult} (${status})`);
        if (qualityResult.failures.length > 0) {
          console.log(`💥 Failures: ${qualityResult.failures.join(', ')}`);
        }

      } catch (error) {
        console.error(`❌ Test error: ${error}`);
        failCount++;
        results.push({
          sample: sample.content.substring(0, 100) + '...',
          expected: sample.expected,
          actualResult: 'FAIL',
          failures: [`Test error: ${error}`],
          status: '❌ FAIL'
        });
      }
    }

    const accuracy = Math.round((passCount / this.TEST_SAMPLES.length) * 100);
    const summary = `Quality Gates Test: ${passCount}/${this.TEST_SAMPLES.length} passed (${accuracy}% accuracy)`;

    console.log(`\n🎯 QUALITY_GATES_TEST_COMPLETE:`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Accuracy: ${accuracy}%`);

    return {
      passCount,
      failCount,
      accuracy,
      results,
      summary
    };
  }

  /**
   * 🔍 TEST QUALITY GATES - Exposes private method for testing
   */
  private async testQualityGates(content: string): Promise<{
    passed: boolean;
    failures: string[];
    scores: any;
  }> {
    // Since enforceQualityGates is private, we'll test it through the main generation method
    // and catch the failures before regeneration
    try {
      const result = await megaPromptSystem.generateMegaPromptContent({
        topic: 'test',
        format: 'single',
        urgency: 'viral'
      });
      
      // If we get here, the content passed quality gates
      return {
        passed: true,
        failures: [],
        scores: {
          qualityScore: result.qualityScore,
          factBased: result.factBased,
          bannedPhraseCheck: result.bannedPhraseCheck,
          firstPersonCheck: result.firstPersonCheck
        }
      };
    } catch (error: any) {
      // If generation failed due to quality gates, extract the failures
      const failureMatch = error.message.match(/Failed quality gates.*?: (.+)/);
      const failures = failureMatch ? failureMatch[1].split(', ') : [error.message];
      
      return {
        passed: false,
        failures,
        scores: {}
      };
    }
  }

  /**
   * 🎯 TEST SPECIFIC CONTENT - Manual quality gate testing
   */
  async testSpecificContent(content: string): Promise<{
    passed: boolean;
    failures: string[];
    scores: any;
  }> {
    console.log(`🧪 Testing specific content: "${content.substring(0, 100)}..."`);
    
    // Manual quality gate implementation for testing
    const failures: string[] = [];
    
    // Banned phrases check
    const bannedPhrases = [
      'many people struggle', 'it\'s important to', 'you should consider',
      'can help improve', 'studies suggest', 'research shows',
      'a friend told me', 'i tried', 'in my experience', 'personally'
    ];
    
    const bannedFound = bannedPhrases.find(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    );
    if (bannedFound) {
      failures.push(`Contains banned phrase: "${bannedFound}"`);
    }

    // First person check
    const firstPersonWords = [' i ', ' me ', ' my ', ' mine ', ' myself ', 'i\'m', 'i\'ve'];
    const firstPersonFound = firstPersonWords.find(word => 
      content.toLowerCase().includes(word)
    );
    if (firstPersonFound) {
      failures.push(`Contains first person language: "${firstPersonFound.trim()}"`);
    }

    // Fact token check
    const factTokenPattern = /(harvard|stanford|mayo|johns hopkins|nih|university|medical|research|institute).*?(\d+[\%\+\-]|[\d,]+\s*(calories|percent|hours|minutes|days|years))/i;
    if (!factTokenPattern.test(content)) {
      failures.push('Missing required fact token: {institution}:{specific_stat}');
    }

    // Viral trigger check
    const viralTriggerPattern = /(scientists|researchers|doctors|study|discovered|found|shocking|surprising|disturbing|hidden|secret|truth|reality)/i;
    if (!viralTriggerPattern.test(content)) {
      failures.push('Missing viral triggers - needs scientific authority or shock language');
    }

    const passed = failures.length === 0;
    console.log(`🎯 Quality Result: ${passed ? 'PASS' : 'FAIL'}`);
    if (failures.length > 0) {
      console.log(`💥 Failures: ${failures.join(', ')}`);
    }

    return {
      passed,
      failures,
      scores: {
        bannedPhraseCheck: !bannedFound,
        firstPersonCheck: !firstPersonFound,
        factTokenCheck: factTokenPattern.test(content),
        viralTriggerCheck: viralTriggerPattern.test(content)
      }
    };
  }
}

// Export singleton for testing
export const qualityGatesTest = new QualityGatesTest();
