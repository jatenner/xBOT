/**
 * 🧪 REPLY A/B TESTING FRAMEWORK
 * 
 * Systematically test different reply strategies to find what works best.
 * Uses statistical analysis to determine winners.
 */

import { getSupabaseClient } from '../db';
import type { GeneratorType } from '../scheduling/personalityScheduler';

export interface ABTest {
  id: string;
  name: string;
  description: string;
  
  // What we're testing
  test_type: 'generator' | 'timing' | 'tone' | 'length';
  
  // Variants
  variant_a: string; // e.g., 'data_nerd'
  variant_b: string; // e.g., 'myth_buster'
  variant_a_label?: string;
  variant_b_label?: string;
  
  // Traffic allocation
  traffic_split: number; // 0.5 = 50/50 split
  
  // Status
  status: 'draft' | 'running' | 'paused' | 'completed';
  
  // Results
  variant_a_replies: number;
  variant_b_replies: number;
  variant_a_avg_followers: number;
  variant_b_avg_followers: number;
  winner?: 'a' | 'b' | 'no_difference';
  confidence_level?: number; // 0-1
  
  // Timing
  started_at?: string;
  completed_at?: string;
  min_sample_size: number; // Minimum replies per variant before declaring winner
}

export class ReplyABTest {
  private static instance: ReplyABTest;
  private supabase = getSupabaseClient();
  
  // Active tests cache
  private activeTests = new Map<string, ABTest>();
  private lastCacheUpdate = 0;
  private cacheExpiry = 60 * 1000; // 1 minute

  private constructor() {
    this.loadActiveTests().catch(err =>
      console.error('[AB_TEST] Failed to load active tests:', err)
    );
  }

  public static getInstance(): ReplyABTest {
    if (!ReplyABTest.instance) {
      ReplyABTest.instance = new ReplyABTest();
    }
    return ReplyABTest.instance;
  }

  /**
   * Create a new A/B test
   */
  public async createTest(params: {
    name: string;
    description: string;
    test_type: 'generator' | 'timing' | 'tone' | 'length';
    variant_a: string;
    variant_b: string;
    variant_a_label?: string;
    variant_b_label?: string;
    traffic_split?: number;
    min_sample_size?: number;
  }): Promise<ABTest> {
    console.log(`[AB_TEST] 🧪 Creating test: ${params.name}`);

    const test: ABTest = {
      id: `test_${Date.now()}`,
      name: params.name,
      description: params.description,
      test_type: params.test_type,
      variant_a: params.variant_a,
      variant_b: params.variant_b,
      variant_a_label: params.variant_a_label,
      variant_b_label: params.variant_b_label,
      traffic_split: params.traffic_split || 0.5,
      status: 'draft',
      variant_a_replies: 0,
      variant_b_replies: 0,
      variant_a_avg_followers: 0,
      variant_b_avg_followers: 0,
      min_sample_size: params.min_sample_size || 30 // At least 30 samples per variant
    };

    // Store in database
    const { error } = await this.supabase
      .from('ab_tests')
      .insert({
        id: test.id,
        name: test.name,
        description: test.description,
        test_type: test.test_type,
        variant_a: test.variant_a,
        variant_b: test.variant_b,
        variant_a_label: test.variant_a_label,
        variant_b_label: test.variant_b_label,
        traffic_split: test.traffic_split,
        status: test.status,
        min_sample_size: test.min_sample_size,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to create test: ${error.message}`);
    }

    console.log(`[AB_TEST] ✅ Test created: ${test.id}`);
    return test;
  }

  /**
   * Start running a test
   */
  public async startTest(testId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ab_tests')
      .update({
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', testId);

    if (error) {
      throw new Error(`Failed to start test: ${error.message}`);
    }

    console.log(`[AB_TEST] ▶️ Test started: ${testId}`);
    this.lastCacheUpdate = 0; // Force cache refresh
  }

  /**
   * Assign a variant for a new reply (for active tests)
   */
  public async getVariantForReply(context: {
    account: string;
    category?: string;
  }): Promise<{
    test_id?: string;
    variant: 'a' | 'b';
    value: string;
  } | null> {
    await this.ensureCacheValid();

    // Find active test that applies to this context
    for (const test of this.activeTests.values()) {
      if (test.test_type === 'generator') {
        // For generator tests, randomly assign based on traffic split
        const random = Math.random();
        const useVariantA = random < test.traffic_split;

        return {
          test_id: test.id,
          variant: useVariantA ? 'a' : 'b',
          value: useVariantA ? test.variant_a : test.variant_b
        };
      }
      
      // Add other test types here (timing, tone, etc.)
    }

    return null; // No active tests
  }

  /**
   * Record test result for a reply
   */
  public async recordResult(params: {
    test_id: string;
    variant: 'a' | 'b';
    decision_id: string;
    followers_gained: number;
    engagement: number;
  }): Promise<void> {
    console.log(`[AB_TEST] 📊 Recording result for test ${params.test_id} (variant ${params.variant})`);

    // Store individual result
    await this.supabase
      .from('ab_test_results')
      .insert({
        test_id: params.test_id,
        variant: params.variant,
        decision_id: params.decision_id,
        followers_gained: params.followers_gained,
        engagement: params.engagement,
        recorded_at: new Date().toISOString()
      });

    // Update test aggregates
    await this.updateTestAggregates(params.test_id);

    // Check if we have enough data to declare a winner
    await this.checkForWinner(params.test_id);
  }

  /**
   * Update test aggregate statistics
   */
  private async updateTestAggregates(testId: string): Promise<void> {
    // Get all results for this test
    const { data: results } = await this.supabase
      .from('ab_test_results')
      .select('variant, followers_gained, engagement')
      .eq('test_id', testId);

    if (!results || results.length === 0) return;

    // Calculate aggregates
    const variantA = results.filter(r => r.variant === 'a');
    const variantB = results.filter(r => r.variant === 'b');

    const aAvgFollowers = variantA.length > 0
      ? variantA.reduce((sum, r) => sum + (r.followers_gained || 0), 0) / variantA.length
      : 0;

    const bAvgFollowers = variantB.length > 0
      ? variantB.reduce((sum, r) => sum + (r.followers_gained || 0), 0) / variantB.length
      : 0;

    // Update test record
    await this.supabase
      .from('ab_tests')
      .update({
        variant_a_replies: variantA.length,
        variant_b_replies: variantB.length,
        variant_a_avg_followers: aAvgFollowers,
        variant_b_avg_followers: bAvgFollowers,
        updated_at: new Date().toISOString()
      })
      .eq('id', testId);
  }

  /**
   * Check if we have enough data to declare a statistical winner
   */
  private async checkForWinner(testId: string): Promise<void> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (!test || test.status !== 'running') return;

    // Need minimum sample size for both variants
    if (test.variant_a_replies < test.min_sample_size || test.variant_b_replies < test.min_sample_size) {
      console.log(`[AB_TEST] Test ${testId} needs more data (A: ${test.variant_a_replies}, B: ${test.variant_b_replies}, min: ${test.min_sample_size})`);
      return;
    }

    // Get all results for statistical analysis
    const { data: results } = await this.supabase
      .from('ab_test_results')
      .select('variant, followers_gained')
      .eq('test_id', testId);

    if (!results) return;

    const variantAResults = results.filter(r => r.variant === 'a').map(r => r.followers_gained || 0);
    const variantBResults = results.filter(r => r.variant === 'b').map(r => r.followers_gained || 0);

    // Perform statistical test (simplified t-test)
    const { StatisticalAnalysis } = await import('./statisticalAnalysis');
    const analysis = new StatisticalAnalysis();
    
    const testResult = analysis.tTest(variantAResults, variantBResults);

    console.log(`[AB_TEST] Test ${testId} analysis:`);
    console.log(`[AB_TEST]   Variant A: ${test.variant_a_avg_followers.toFixed(2)} followers/reply (n=${variantAResults.length})`);
    console.log(`[AB_TEST]   Variant B: ${test.variant_b_avg_followers.toFixed(2)} followers/reply (n=${variantBResults.length})`);
    console.log(`[AB_TEST]   P-value: ${testResult.pValue.toFixed(4)}`);
    console.log(`[AB_TEST]   Confidence: ${(testResult.confidence * 100).toFixed(1)}%`);

    // Declare winner if statistically significant (p < 0.05)
    if (testResult.pValue < 0.05) {
      const winner = test.variant_a_avg_followers > test.variant_b_avg_followers ? 'a' : 'b';
      
      console.log(`[AB_TEST] 🎉 Winner declared: Variant ${winner.toUpperCase()}!`);

      await this.supabase
        .from('ab_tests')
        .update({
          status: 'completed',
          winner: winner,
          confidence_level: testResult.confidence,
          completed_at: new Date().toISOString()
        })
        .eq('id', testId);

      this.lastCacheUpdate = 0; // Force cache refresh
    }
  }

  /**
   * Get test results
   */
  public async getTestResults(testId: string): Promise<{
    test: ABTest;
    variant_a_stats: { mean: number; stddev: number; count: number };
    variant_b_stats: { mean: number; stddev: number; count: number };
    statistical_significance: { pValue: number; isSignificant: boolean };
  } | null> {
    const { data: test } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (!test) return null;

    const { data: results } = await this.supabase
      .from('ab_test_results')
      .select('variant, followers_gained')
      .eq('test_id', testId);

    if (!results || results.length === 0) {
      return {
        test: test as ABTest,
        variant_a_stats: { mean: 0, stddev: 0, count: 0 },
        variant_b_stats: { mean: 0, stddev: 0, count: 0 },
        statistical_significance: { pValue: 1, isSignificant: false }
      };
    }

    const variantAResults = results.filter(r => r.variant === 'a').map(r => r.followers_gained || 0);
    const variantBResults = results.filter(r => r.variant === 'b').map(r => r.followers_gained || 0);

    const { StatisticalAnalysis } = await import('./statisticalAnalysis');
    const analysis = new StatisticalAnalysis();

    const aStats = analysis.calculateStats(variantAResults);
    const bStats = analysis.calculateStats(variantBResults);
    const tTest = analysis.tTest(variantAResults, variantBResults);

    return {
      test: test as ABTest,
      variant_a_stats: aStats,
      variant_b_stats: bStats,
      statistical_significance: {
        pValue: tTest.pValue,
        isSignificant: tTest.pValue < 0.05
      }
    };
  }

  /**
   * Load active tests into cache
   */
  private async loadActiveTests(): Promise<void> {
    const { data: tests } = await this.supabase
      .from('ab_tests')
      .select('*')
      .eq('status', 'running');

    this.activeTests.clear();
    tests?.forEach(test => {
      this.activeTests.set(test.id, test as ABTest);
    });

    this.lastCacheUpdate = Date.now();
    console.log(`[AB_TEST] Loaded ${this.activeTests.size} active tests`);
  }

  /**
   * Ensure cache is valid
   */
  private async ensureCacheValid(): Promise<void> {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      await this.loadActiveTests();
    }
  }
}

// Export singleton
export const replyABTest = ReplyABTest.getInstance();

