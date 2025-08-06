/**
 * 🧪 SYSTEMATIC A/B TESTING FRAMEWORK
 * ===================================
 * Continuously tests different content strategies, timing, and formats
 * to find what drives the most follower growth
 */

import { supabaseClientClient } from '../utils/supabaseClientClient';
import { openaiService } from '../services/openaiService';

interface ABTestConfig {
  testId: string;
  testType: 'content_format' | 'timing' | 'tone' | 'length' | 'engagement_hooks';
  hypothesis: string;
  variants: {
    control: any;
    variant: any;
  };
  metrics: string[];
  minSampleSize: number;
  confidenceLevel: number;
  duration: number; // days
}

interface ABTestResult {
  testId: string;
  winner: 'control' | 'variant' | 'inconclusive';
  confidence: number;
  improvement: number;
  recommendation: string;
  results: {
    control: { [metric: string]: number };
    variant: { [metric: string]: number };
  };
}

export class SystematicABTesting {

  /**
   * 🧪 CREATE NEW A/B TEST
   * Sets up a new systematic test based on hypotheses
   */
  async createABTest(config: ABTestConfig): Promise<string> {
    console.log(`🧪 Creating A/B test: ${config.testType} - ${config.hypothesis}`);
    
    try {
      // Store test configuration
      const { data: test } = await supabaseClient
        .from('ab_tests')
        .insert({
          test_id: config.testId,
          test_type: config.testType,
          hypothesis: config.hypothesis,
          control_variant: config.variants.control,
          test_variant: config.variants.variant,
          target_metrics: config.metrics,
          min_sample_size: config.minSampleSize,
          confidence_level: config.confidenceLevel,
          planned_duration_days: config.duration,
          status: 'active',
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (test) {
        // Initialize test tracking
        await this.initializeTestTracking(config.testId);
        console.log(`✅ A/B test created: ${config.testId}`);
        return config.testId;
      }
      
      throw new Error('Failed to create test');
      
    } catch (error) {
      console.error('❌ A/B test creation error:', error);
      throw error;
    }
  }

  /**
   * 🎯 ASSIGN CONTENT TO TEST VARIANT
   * Determines which variant to use for upcoming content
   */
  async assignTestVariant(contentHash: string): Promise<{
    testId: string | null;
    variant: 'control' | 'variant' | null;
    modifications: any;
  }> {
    try {
      // Get active tests
      const { data: activeTests } = await supabaseClient
        .from('ab_tests')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!activeTests?.length) {
        return { testId: null, variant: null, modifications: null };
      }

      // Find test that needs more samples
      for (const test of activeTests) {
        const assignments = await this.getTestAssignments(test.test_id);
        
        // Check if test needs more samples
        if (assignments.total < test.min_sample_size) {
          // Use round-robin assignment for balance
          const variant = assignments.control <= assignments.variant ? 'control' : 'variant';
          
          // Record assignment
          await supabaseClient.from('algorithm_ab_tests').insert({
            test_id: test.test_id,
            content_hash: contentHash,
            assigned_variant: variant,
            assigned_at: new Date().toISOString()
          });

          // Get modifications for this variant
          const modifications = variant === 'control' 
            ? test.control_variant 
            : test.test_variant;

          return {
            testId: test.test_id,
            variant,
            modifications
          };
        }
      }

      return { testId: null, variant: null, modifications: null };
      
    } catch (error) {
      console.error('Test assignment error:', error);
      return { testId: null, variant: null, modifications: null };
    }
  }

  /**
   * 📊 RECORD TEST PERFORMANCE
   * Records performance metrics for A/B test analysis
   */
  async recordTestPerformance(
    testId: string, 
    contentHash: string, 
    metrics: { [key: string]: number }
  ) {
    try {
      // Get test assignment
      const { data: assignment } = await supabaseClient
        .from('algorithm_ab_tests')
        .select('*')
        .eq('test_id', testId)
        .eq('content_hash', contentHash)
        .single();

      if (!assignment) {
        console.log('⚠️ No test assignment found for content');
        return;
      }

      // Store performance data
      await supabaseClient.from('ab_test_results').insert({
        test_id: testId,
        content_hash: contentHash,
        variant: assignment.assigned_variant,
        performance_metrics: metrics,
        recorded_at: new Date().toISOString()
      });

      // Check if test should be analyzed
      await this.checkTestCompletion(testId);
      
    } catch (error) {
      console.error('Performance recording error:', error);
    }
  }

  /**
   * 📈 ANALYZE A/B TEST RESULTS
   * Determines winner and statistical significance
   */
  async analyzeABTest(testId: string): Promise<ABTestResult | null> {
    try {
      console.log(`📈 Analyzing A/B test: ${testId}`);
      
      // Get test configuration
      const { data: test } = await supabaseClient
        .from('ab_tests')
        .select('*')
        .eq('test_id', testId)
        .single();

      if (!test) return null;

      // Get all results
      const { data: results } = await supabaseClient
        .from('ab_test_results')
        .select('*')
        .eq('test_id', testId);

      if (!results?.length) return null;

      // Separate control and variant results
      const controlResults = results.filter(r => r.variant === 'control');
      const variantResults = results.filter(r => r.variant === 'variant');

      if (controlResults.length < 5 || variantResults.length < 5) {
        console.log('⚠️ Insufficient sample size for analysis');
        return null;
      }

      // Calculate metrics for each group
      const controlMetrics = this.calculateGroupMetrics(controlResults, test.target_metrics);
      const variantMetrics = this.calculateGroupMetrics(variantResults, test.target_metrics);

      // Perform statistical significance test
      const significanceResults = await this.calculateSignificance(
        controlMetrics, 
        variantMetrics, 
        test.target_metrics[0] // Primary metric
      );

      // Determine winner
      const primaryMetric = test.target_metrics[0];
      const controlValue = controlMetrics[primaryMetric];
      const variantValue = variantMetrics[primaryMetric];
      
      let winner: 'control' | 'variant' | 'inconclusive';
      let improvement = 0;

      if (significanceResults.isSignificant) {
        winner = variantValue > controlValue ? 'variant' : 'control';
        improvement = Math.abs((variantValue - controlValue) / controlValue) * 100;
      } else {
        winner = 'inconclusive';
      }

      // Generate recommendation
      const recommendation = await this.generateTestRecommendation(
        test, 
        winner, 
        improvement, 
        controlMetrics, 
        variantMetrics
      );

      const result: ABTestResult = {
        testId,
        winner,
        confidence: significanceResults.confidence,
        improvement,
        recommendation,
        results: {
          control: controlMetrics,
          variant: variantMetrics
        }
      };

      // Store analysis results
      await this.storeTestAnalysis(testId, result);

      return result;
      
    } catch (error) {
      console.error('Test analysis error:', error);
      return null;
    }
  }

  /**
   * 🤖 GENERATE AUTOMATIC TEST IDEAS
   * Creates new test hypotheses based on current performance
   */
  async generateAutomaticTestIdeas(): Promise<ABTestConfig[]> {
    try {
      console.log('🤖 Generating automatic A/B test ideas...');
      
      // Get recent performance data
      const [recentTweets, currentStrategy] = await Promise.all([
        supabaseClient
          .from('tweets')
          .select('*')
          .order('posted_at', { ascending: false })
          .limit(50),
        supabaseClient
          .from('content_strategies')
          .select('*')
          .eq('is_active', true)
          .single()
      ]);

      // Analyze performance gaps
      const performanceGaps = this.identifyPerformanceGaps(recentTweets.data || []);
      
      // Generate test ideas using AI
      const testIdeas = await this.generateAITestIdeas(performanceGaps);
      
      return testIdeas.slice(0, 3); // Limit to 3 tests at a time
      
    } catch (error) {
      console.error('Test idea generation error:', error);
      return [];
    }
  }

  /**
   * 🎮 RUN CONTINUOUS TESTING CYCLE
   * Main function to manage ongoing A/B testing
   */
  async runTestingCycle(): Promise<void> {
    console.log('🎮 === CONTINUOUS A/B TESTING CYCLE ===');
    
    try {
      // 1. Analyze completed tests
      const completedTests = await this.analyzeCompletedTests();
      
      // 2. Generate new test ideas if needed
      const activeTestCount = await this.getActiveTestCount();
      
      if (activeTestCount < 2) { // Keep 2 tests running
        const newTestIdeas = await this.generateAutomaticTestIdeas();
        
        for (const testIdea of newTestIdeas.slice(0, 2 - activeTestCount)) {
          await this.createABTest(testIdea);
        }
      }
      
      // 3. Store cycle results
      await supabaseClient.from('testing_cycle_log').insert({
        cycle_date: new Date().toISOString(),
        completed_tests: completedTests.length,
        active_tests: activeTestCount,
        new_tests_created: Math.min(newTestIdeas?.length || 0, 2 - activeTestCount),
        insights_generated: completedTests.map(t => t.recommendation)
      });
      
      console.log(`✅ Testing cycle completed: ${completedTests.length} analyzed, ${activeTestCount} active`);
      
    } catch (error) {
      console.error('❌ Testing cycle error:', error);
    }
  }

  // Helper methods
  private async initializeTestTracking(testId: string) {
    await supabaseClient.from('algorithm_signals').insert({
      signal_type: 'ab_test_started',
      signal_data: { testId },
      confidence: 1.0,
      created_at: new Date().toISOString()
    });
  }

  private async getTestAssignments(testId: string) {
    const { data: assignments } = await supabaseClient
      .from('algorithm_ab_tests')
      .select('assigned_variant')
      .eq('test_id', testId);

    const control = assignments?.filter(a => a.assigned_variant === 'control').length || 0;
    const variant = assignments?.filter(a => a.assigned_variant === 'variant').length || 0;

    return { control, variant, total: control + variant };
  }

  private async checkTestCompletion(testId: string) {
    const assignments = await this.getTestAssignments(testId);
    
    const { data: test } = await supabaseClient
      .from('ab_tests')
      .select('min_sample_size, status')
      .eq('test_id', testId)
      .single();

    if (test && assignments.total >= test.min_sample_size && test.status === 'active') {
      await supabaseClient
        .from('ab_tests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('test_id', testId);
    }
  }

  private calculateGroupMetrics(results: any[], targetMetrics: string[]) {
    const metrics: { [key: string]: number } = {};
    
    for (const metric of targetMetrics) {
      const values = results.map(r => r.performance_metrics[metric] || 0);
      metrics[metric] = values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    
    return metrics;
  }

  private async calculateSignificance(
    controlMetrics: any, 
    variantMetrics: any, 
    primaryMetric: string
  ) {
    // Simple significance test (in production, use proper statistical tests)
    const controlValue = controlMetrics[primaryMetric];
    const variantValue = variantMetrics[primaryMetric];
    
    const difference = Math.abs(variantValue - controlValue);
    const average = (controlValue + variantValue) / 2;
    const relativeChange = difference / average;
    
    return {
      isSignificant: relativeChange > 0.1, // 10% improvement threshold
      confidence: Math.min(95, relativeChange * 100 * 5) // Simplified confidence
    };
  }

  private async generateTestRecommendation(
    test: any, 
    winner: string, 
    improvement: number, 
    controlMetrics: any, 
    variantMetrics: any
  ): Promise<string> {
    if (winner === 'inconclusive') {
      return 'Test inconclusive - continue with current approach or extend test duration';
    }
    
    const winnerMetrics = winner === 'control' ? controlMetrics : variantMetrics;
    const primaryMetric = test.target_metrics[0];
    
    return `${winner === 'variant' ? 'Implement' : 'Keep'} ${winner} approach. ${improvement.toFixed(1)}% improvement in ${primaryMetric} (${winnerMetrics[primaryMetric].toFixed(2)})`;
  }

  private async storeTestAnalysis(testId: string, result: ABTestResult) {
    await supabaseClient.from('ab_test_analysis').insert({
      test_id: testId,
      winner_variant: result.winner,
      confidence_level: result.confidence,
      improvement_percentage: result.improvement,
      recommendation: result.recommendation,
      control_metrics: result.results.control,
      variant_metrics: result.results.variant,
      analyzed_at: new Date().toISOString()
    });

    // Update test status
    await supabaseClient
      .from('ab_tests')
      .update({ status: 'analyzed' })
      .eq('test_id', testId);
  }

  private identifyPerformanceGaps(tweets: any[]) {
    const avgFollowers = tweets.reduce((sum, t) => sum + (t.new_followers || 0), 0) / tweets.length;
    const avgLikes = tweets.reduce((sum, t) => sum + (t.likes || 0), 0) / tweets.length;
    
    return {
      lowFollowerGrowth: avgFollowers < 1,
      lowEngagement: avgLikes < 20,
      inconsistentPerformance: this.calculateVariance(tweets.map(t => t.likes || 0)) > 100
    };
  }

  private async generateAITestIdeas(gaps: any): Promise<ABTestConfig[]> {
    // Generate test ideas based on performance gaps
    const testIdeas: ABTestConfig[] = [];
    
    if (gaps.lowFollowerGrowth) {
      testIdeas.push({
        testId: `follower_growth_${Date.now()}`,
        testType: 'engagement_hooks',
        hypothesis: 'Questions in tweets drive more follower growth than statements',
        variants: {
          control: { includeQuestion: false },
          variant: { includeQuestion: true, questionType: 'thought_provoking' }
        },
        metrics: ['new_followers', 'replies', 'engagement_rate'],
        minSampleSize: 20,
        confidenceLevel: 95,
        duration: 7
      });
    }
    
    if (gaps.lowEngagement) {
      testIdeas.push({
        testId: `engagement_boost_${Date.now()}`,
        testType: 'content_format',
        hypothesis: 'Numbered lists perform better than paragraph format',
        variants: {
          control: { format: 'paragraph' },
          variant: { format: 'numbered_list' }
        },
        metrics: ['likes', 'retweets', 'engagement_rate'],
        minSampleSize: 15,
        confidenceLevel: 90,
        duration: 5
      });
    }
    
    return testIdeas;
  }

  private async analyzeCompletedTests(): Promise<ABTestResult[]> {
    const { data: completedTests } = await supabaseClient
      .from('ab_tests')
      .select('test_id')
      .eq('status', 'completed');

    const results: ABTestResult[] = [];
    
    for (const test of completedTests || []) {
      const result = await this.analyzeABTest(test.test_id);
      if (result) results.push(result);
    }
    
    return results;
  }

  private async getActiveTestCount(): Promise<number> {
    const { data: activeTests } = await supabaseClient
      .from('ab_tests')
      .select('test_id')
      .eq('status', 'active');

    return activeTests?.length || 0;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }
}

export const systematicABTesting = new SystematicABTesting();