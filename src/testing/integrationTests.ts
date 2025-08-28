/**
 * 🔧 INTEGRATION TESTS
 * Automated tests that run before deployment
 */

export interface IntegrationTestResult {
  testName: string;
  passed: boolean;
  error?: string;
  executionTime: number;
}

export class IntegrationTests {
  /**
   * 🧪 Run critical integration tests
   */
  public static async runCriticalTests(): Promise<IntegrationTestResult[]> {
    const results: IntegrationTestResult[] = [];

    // Test 1: Thread Generation
    results.push(await this.testThreadGeneration());

    // Test 2: Content Validation
    results.push(await this.testContentValidation());

    // Test 3: Browser Manager
    results.push(await this.testBrowserManager());

    // Test 4: Database Storage
    results.push(await this.testDatabaseStorage());

    // Test 5: Environment Variables
    results.push(await this.testEnvironmentVariables());

    return results;
  }

  private static async testThreadGeneration(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const testName = 'Thread Content Generation';

    try {
      // Test if SocialContentOperator can generate threads
      const { getSocialContentOperator } = await import('../ai/socialContentOperator');
      const operator = getSocialContentOperator();

      const contentPack = await operator.generateContentPack('', ['test topic'], []);
      
      const hasThreads = contentPack.threads && contentPack.threads.length > 0;
      const hasValidThreads = hasThreads && contentPack.threads.every(t => 
        t.tweets && Array.isArray(t.tweets) && t.tweets.length > 1
      );

      if (!hasValidThreads) {
        throw new Error(`Invalid threads: ${contentPack.threads?.length || 0} threads generated`);
      }

      return {
        testName,
        passed: true,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName,
        passed: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  private static async testContentValidation(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const testName = 'Content Quality Validation';

    try {
      // Test content validation system
      const { ContentQualityGate } = await import('../lib/contentQualityGate');
      const qualityGate = ContentQualityGate.getInstance();

      const testContent = 'Test health content about nutrition and exercise benefits';
      const validation = await qualityGate.validateContent(testContent);

      if (!validation.passed) {
        throw new Error('Content validation failed for test content');
      }

      return {
        testName,
        passed: true,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName,
        passed: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  private static async testBrowserManager(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const testName = 'Browser Manager';

    try {
      // Test browser manager initialization
      const { browserManager } = await import('../posting/BrowserManager');
      
      // Test context creation (without actually posting)
      const testResult = await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        await page.goto('https://x.com');
        return { success: true };
      });

      if (!testResult.success) {
        throw new Error('Browser context test failed');
      }

      return {
        testName,
        passed: true,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName,
        passed: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  private static async testDatabaseStorage(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const testName = 'Database Storage';

    try {
      // Test database connection and storage
      const { storeActualPostedContent } = await import('../lib/contentStorageFix');
      
      const testData = {
        tweet_id: `test_${Date.now()}`,
        actual_content: 'Test content for integration testing',
        content_type: 'single' as const,
        character_count: 35,
        posted_at: new Date().toISOString(),
        quality_score: 75
      };

      await storeActualPostedContent(testData);

      return {
        testName,
        passed: true,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName,
        passed: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  private static async testEnvironmentVariables(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const testName = 'Environment Variables';

    try {
      const requiredVars = [
        'OPENAI_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
      ];

      const missingVars = requiredVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      return {
        testName,
        passed: true,
        executionTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        testName,
        passed: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 📊 Generate test report
   */
  public static generateReport(results: IntegrationTestResult[]): {
    passed: boolean;
    summary: string;
    details: string;
  } {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed);

    const passed = failedTests.length === 0;
    const successRate = Math.round((passedTests / totalTests) * 100);

    const summary = passed 
      ? `✅ All ${totalTests} integration tests passed (${successRate}%)`
      : `❌ ${failedTests.length}/${totalTests} tests failed (${successRate}% success)`;

    let details = `Integration Test Results:\n`;
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      details += `${status} ${result.testName} (${result.executionTime}ms)`;
      if (!result.passed) {
        details += ` - ${result.error}`;
      }
      details += '\n';
    });

    if (!passed) {
      details += '\n🚨 CRITICAL: Fix failing tests before deployment!\n';
    }

    return { passed, summary, details };
  }
}
