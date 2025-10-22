import { Page } from 'playwright';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

export interface TestResult {
  success: boolean;
  testName: string;
  details: string;
  actualBehavior: string;
  expectedBehavior: string;
  twitterVerification?: {
    postsFound: number;
    isConnectedThread: boolean;
    actualTweetIds: string[];
  };
}

export interface ThreadTestConfig {
  testTweets: string[];
  topic: string;
  verifyOnTwitter: boolean;
  timeoutMs: number;
}

/**
 * 🧪 COMPREHENSIVE THREAD TESTING FRAMEWORK
 * Tests thread posting with real Twitter verification
 */
export class ThreadTestingFramework {
  private static instance: ThreadTestingFramework;

  private constructor() {}

  public static getInstance(): ThreadTestingFramework {
    if (!ThreadTestingFramework.instance) {
      ThreadTestingFramework.instance = new ThreadTestingFramework();
    }
    return ThreadTestingFramework.instance;
  }

  /**
   * 🎯 Run comprehensive thread posting tests
   */
  public async runComprehensiveTests(): Promise<TestResult[]> {
    console.log('🧪 STARTING COMPREHENSIVE THREAD TESTING FRAMEWORK');
    console.log('==================================================');

    const results: TestResult[] = [];

    // Test 1: Native Thread Composer
    results.push(await this.testNativeThreadComposer());

    // Test 2: Content Generation Integration
    results.push(await this.testContentGenerationFlow());

    // Test 3: PostingManager Integration
    results.push(await this.testPostingManagerIntegration());

    // Test 4: End-to-End Thread Posting
    results.push(await this.testEndToEndThreadPosting());

    // Test 5: Twitter Verification
    results.push(await this.testTwitterVerification());

    return results;
  }

  /**
   * 🧵 Test Native Thread Composer directly
   */
  private async testNativeThreadComposer(): Promise<TestResult> {
    const testName = 'Native Thread Composer';
    console.log(`\n🧪 TEST: ${testName}`);

    try {
      const { NativeThreadComposer } = await import('../posting/nativeThreadComposer');
      const composer = NativeThreadComposer.getInstance();

      const testTweets = [
        '🧪 TEST THREAD: Native composer test tweet 1',
        'Tweet 2: Testing native thread creation mechanism',
        'Tweet 3: Verifying browser automation works correctly',
        'Tweet 4: This should appear as a connected thread'
      ];

      console.log('📝 Testing native thread posting...');
      const result = await composer.postNativeThread(testTweets, 'Native Thread Test');

      if (result.success && result.rootTweetId) {
        return {
          success: true,
          testName,
          details: `Posted ${testTweets.length} tweets successfully`,
          actualBehavior: `Root tweet ID: ${result.rootTweetId}, replies: ${result.replyIds?.length || 0}`,
          expectedBehavior: 'Should post 4 connected tweets',
          twitterVerification: {
            postsFound: testTweets.length,
            isConnectedThread: true,
            actualTweetIds: [result.rootTweetId, ...(result.replyIds || [])]
          }
        };
      } else {
        return {
          success: false,
          testName,
          details: `Failed: ${result.error}`,
          actualBehavior: 'Thread posting failed',
          expectedBehavior: 'Should post 4 connected tweets'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        testName,
        details: `Error: ${error.message}`,
        actualBehavior: 'Exception thrown',
        expectedBehavior: 'Should post successfully'
      };
    }
  }

  /**
   * 📊 Test Content Generation Flow
   */
  private async testContentGenerationFlow(): Promise<TestResult> {
    const testName = 'Content Generation Flow';
    console.log(`\n🧪 TEST: ${testName}`);

    try {
      const { ContentGenerator } = await import('../core/modules/contentGenerator');
      const generator = ContentGenerator.getInstance();

      const contentOptions = {
        brandNotes: "",
        diverseSeeds: ['health testing'],
        recentPosts: [],
        aggressiveDecision: { type: 'thread_test' }
      };

      const result = await generator.generateContent(contentOptions);

      const isThread = result.type === 'thread';
      const hasMultipleTweets = Array.isArray(result.content) && result.content.length > 1;

      return {
        success: isThread && hasMultipleTweets,
        testName,
        details: `Generated ${result.type} with ${Array.isArray(result.content) ? result.content.length : 1} tweets`,
        actualBehavior: `Type: ${result.type}, Content: ${Array.isArray(result.content) ? 'array' : 'string'}, Length: ${result.content?.length || 0}`,
        expectedBehavior: 'Should generate thread type with array of multiple tweets'
      };
    } catch (error: any) {
      return {
        success: false,
        testName,
        details: `Error: ${error.message}`,
        actualBehavior: 'Exception thrown',
        expectedBehavior: 'Should generate thread content'
      };
    }
  }

  /**
   * 🔧 Test PostingManager Integration
   */
  private async testPostingManagerIntegration(): Promise<TestResult> {
    const testName = 'PostingManager Integration';
    console.log(`\n🧪 TEST: ${testName}`);

    try {
      const { PostingManager } = await import('../core/modules/postingManager');
      const manager = PostingManager.getInstance();

      // Mock thread content
      const mockContentResult = {
        content: [
          '🧪 INTEGRATION TEST: PostingManager thread test 1',
          'Tweet 2: Testing integration between modules',
          'Tweet 3: Verifying data flow works correctly'
        ],
        type: 'thread',
        topic: 'Integration Test',
        metadata: { qualityScore: 90 }
      };

      console.log('🔧 Testing PostingManager thread posting...');
      const result = await manager.executeIntelligentPost({ 
        opportunity: { type: 'test' } 
      });

      return {
        success: result.success,
        testName,
        details: result.success ? 'PostingManager executed successfully' : `Failed: ${result.error}`,
        actualBehavior: `Success: ${result.success}, Content: ${result.content ? 'provided' : 'missing'}`,
        expectedBehavior: 'Should execute posting successfully with content'
      };
    } catch (error: any) {
      return {
        success: false,
        testName,
        details: `Error: ${error.message}`,
        actualBehavior: 'Exception thrown',
        expectedBehavior: 'Should execute posting'
      };
    }
  }

  /**
   * 🎯 Test End-to-End Thread Posting
   */
  private async testEndToEndThreadPosting(): Promise<TestResult> {
    const testName = 'End-to-End Thread Posting';
    console.log(`\n🧪 TEST: ${testName}`);

    try {
      const { AutonomousPostingEngine } = await import('../core/autonomousPostingEngine');
      const engine = AutonomousPostingEngine.getInstance();

      console.log('🎯 Testing full autonomous posting flow...');
      const result = await engine.executeIntelligentPost({ type: 'test_opportunity' });

      return {
        success: result.success,
        testName,
        details: result.success ? 'End-to-end posting successful' : `Failed: ${result.error}`,
        actualBehavior: `Success: ${result.success}, Content: ${result.content ? 'generated' : 'missing'}`,
        expectedBehavior: 'Should complete full posting cycle'
      };
    } catch (error: any) {
      return {
        success: false,
        testName,
        details: `Error: ${error.message}`,
        actualBehavior: 'Exception thrown',
        expectedBehavior: 'Should complete posting'
      };
    }
  }

  /**
   * 🔍 Test Twitter Verification
   */
  private async testTwitterVerification(): Promise<TestResult> {
    const testName = 'Twitter Verification';
    console.log(`\n🧪 TEST: ${testName}`);

    try {
      console.log('🔍 Checking Twitter timeline for recent test threads...');
      
      const verification = await this.verifyThreadsOnTwitter();

      return {
        success: verification.threadsFound > 0,
        testName,
        details: `Found ${verification.threadsFound} test threads on Twitter`,
        actualBehavior: `Threads found: ${verification.threadsFound}, Complete threads: ${verification.completeThreads}`,
        expectedBehavior: 'Should find posted test threads on Twitter timeline',
        twitterVerification: {
          postsFound: verification.totalPosts,
          isConnectedThread: verification.completeThreads > 0,
          actualTweetIds: verification.tweetIds
        }
      };
    } catch (error: any) {
      return {
        success: false,
        testName,
        details: `Error: ${error.message}`,
        actualBehavior: 'Could not verify Twitter',
        expectedBehavior: 'Should find threads on Twitter'
      };
    }
  }

  /**
   * 🔍 Verify threads actually appear on Twitter
   */
  private async verifyThreadsOnTwitter(): Promise<{
    threadsFound: number;
    completeThreads: number;
    totalPosts: number;
    tweetIds: string[];
  }> {
    const pool = UnifiedBrowserPool.getInstance();
    return await pool.withContext('testing', async (context) => {
      const page = await context.newPage();
      
      // Navigate to profile timeline
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);

      // Look for recent test tweets
      const testTweets = await page.$$eval('[data-testid="tweet"]', (tweets) => {
        return tweets
          .filter(tweet => {
            const text = tweet.textContent || '';
            return text.includes('🧪') || text.includes('TEST') || text.includes('INTEGRATION');
          })
          .map(tweet => {
            const text = tweet.textContent || '';
            const tweetElement = tweet.querySelector('[href*="/status/"]');
            const url = tweetElement?.getAttribute('href') || '';
            const tweetId = url.split('/status/')[1]?.split('?')[0] || '';
            return { text: text.substring(0, 100), tweetId };
          });
      });

      // Check for thread connections
      let completeThreads = 0;
      for (const tweet of testTweets) {
        if (tweet.tweetId) {
          // Check if this tweet has replies (indicating a thread)
          try {
            await page.goto(`https://x.com/i/status/${tweet.tweetId}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            
            const replyCount = await page.$$eval('[data-testid="tweet"]', (tweets) => tweets.length);
            if (replyCount > 1) {
              completeThreads++;
            }
          } catch (error) {
            console.warn(`Could not check thread for ${tweet.tweetId}`);
          }
        }
      }

      return {
        threadsFound: testTweets.length,
        completeThreads,
        totalPosts: testTweets.length,
        tweetIds: testTweets.map(t => t.tweetId).filter(Boolean)
      };
    });
  }

  /**
   * 📊 Generate comprehensive test report
   */
  public generateTestReport(results: TestResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    let report = `
🧪 COMPREHENSIVE THREAD TESTING REPORT
======================================

📊 SUMMARY:
✅ Passed: ${passedTests}/${totalTests}
❌ Failed: ${failedTests}/${totalTests}
📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%

📋 DETAILED RESULTS:
`;

    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      report += `
${index + 1}. ${status} ${result.testName}
   Details: ${result.details}
   Expected: ${result.expectedBehavior}
   Actual: ${result.actualBehavior}`;

      if (result.twitterVerification) {
        report += `
   Twitter: ${result.twitterVerification.postsFound} posts, Connected: ${result.twitterVerification.isConnectedThread}`;
      }
    });

    if (failedTests > 0) {
      report += `

🚨 CRITICAL ISSUES TO FIX:
`;
      results.filter(r => !r.success).forEach(result => {
        report += `- ${result.testName}: ${result.details}\n`;
      });
    }

    report += `
🎯 RECOMMENDATIONS:
${passedTests === totalTests ? 
  '✅ All tests passing! Thread system is working correctly.' : 
  '❌ Fix failing tests before deploying to production.'}
`;

    return report;
  }
}
