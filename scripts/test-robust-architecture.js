#!/usr/bin/env node

/**
 * 🧪 ROBUST ARCHITECTURE INTEGRATION TEST
 * 
 * Tests all new systems working together:
 * - Unified Budget Manager
 * - Twitter Rate Limits
 * - Engagement Tracker
 * - Quality Engine
 * - Streamlined Post Agent
 * - Smart Content Engine
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class RobustArchitectureTest {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runAllTests() {
    console.log('🧪 === ROBUST ARCHITECTURE INTEGRATION TEST ===');
    console.log('Testing all new systems integration...\n');

    try {
      // Build and verify TypeScript compilation first
      await this.testTypeScriptCompilation();
      
      // Test database migration
      await this.testDatabaseMigration();
      
      // Test individual systems
      await this.testUnifiedBudgetManager();
      await this.testTwitterRateLimits();
      await this.testEngagementTracker();
      await this.testQualityEngine();
      await this.testSmartContentEngine();
      await this.testStreamlinedPostAgent();
      
      // Test system integration
      await this.testSystemIntegration();
      
      // Generate final report
      this.generateFinalReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testTypeScriptCompilation() {
    this.logTest('TypeScript Compilation');
    
    try {
      const { execSync } = require('child_process');
      
      console.log('🔨 Building TypeScript...');
      execSync('npm run build', { stdio: 'pipe' });
      
      this.passTest('TypeScript compilation successful');
    } catch (error) {
      this.failTest('TypeScript compilation failed', error.stdout?.toString() || error.message);
    }
  }

  async testDatabaseMigration() {
    this.logTest('Database Migration');
    
    try {
      // Check if all required tables exist
      const requiredTables = [
        'twitter_rate_limits',
        'tweet_performance',
        'daily_growth',
        'quality_improvements',
        'cached_insights',
        'content_templates',
        'system_logs',
        'budget_transactions',
        'daily_budget_status'
      ];

      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', requiredTables);

      const existingTables = tables?.map(t => t.table_name) || [];
      const missingTables = requiredTables.filter(t => !existingTables.includes(t));

      if (missingTables.length === 0) {
        this.passTest('All required tables exist');
      } else {
        this.failTest('Missing tables', `Missing: ${missingTables.join(', ')}`);
      }

      // Check if content templates are seeded
      const { data: templates } = await supabase
        .from('content_templates')
        .select('count');

      if (templates && templates.length > 0) {
        this.passTest('Content templates seeded');
      } else {
        this.failTest('Content templates not seeded');
      }

    } catch (error) {
      this.failTest('Database migration check failed', error.message);
    }
  }

  async testUnifiedBudgetManager() {
    this.logTest('Unified Budget Manager');
    
    try {
      // Test budget status
      const { unifiedBudget } = require('../dist/utils/unifiedBudgetManager');
      
      const status = await unifiedBudget.getBudgetStatus();
      
      if (status && typeof status.dailySpent === 'number' && typeof status.remainingBudget === 'number') {
        this.passTest('Budget status retrieval works');
      } else {
        this.failTest('Budget status format invalid', JSON.stringify(status));
      }

      // Test budget allocation
      const testOperation = {
        type: 'content_generation',
        estimatedCost: 0.01,
        priority: 'important',
        fallbackAvailable: true
      };

      const canAfford = await unifiedBudget.canAfford(testOperation);
      
      if (canAfford && typeof canAfford.approved === 'boolean') {
        this.passTest('Budget allocation check works');
      } else {
        this.failTest('Budget allocation check failed', JSON.stringify(canAfford));
      }

    } catch (error) {
      this.failTest('Unified Budget Manager test failed', error.message);
    }
  }

  async testTwitterRateLimits() {
    this.logTest('Twitter Rate Limits');
    
    try {
      const { twitterRateLimits } = require('../dist/utils/twitterRateLimits');
      
      // Test rate limit status
      const status = await twitterRateLimits.canPost();
      
      if (status && typeof status.canPost === 'boolean') {
        this.passTest('Rate limit status check works');
      } else {
        this.failTest('Rate limit status invalid', JSON.stringify(status));
      }

      // Test remaining posts calculation
      const remaining = twitterRateLimits.getRemainingPosts();
      
      if (remaining && typeof remaining.next3Hours === 'number') {
        this.passTest('Remaining posts calculation works');
      } else {
        this.failTest('Remaining posts calculation failed', JSON.stringify(remaining));
      }

    } catch (error) {
      this.failTest('Twitter Rate Limits test failed', error.message);
    }
  }

  async testEngagementTracker() {
    this.logTest('Engagement Tracker');
    
    try {
      const { engagementTracker } = require('../dist/utils/engagementGrowthTracker');
      
      // Test performance dashboard
      const dashboard = await engagementTracker.getPerformanceDashboard();
      
      if (dashboard && typeof dashboard.todayStats === 'object') {
        this.passTest('Performance dashboard retrieval works');
      } else {
        this.failTest('Performance dashboard failed', JSON.stringify(dashboard));
      }

      // Test content optimization recommendations
      const recommendations = await engagementTracker.getContentOptimizationRecommendations();
      
      if (recommendations && Array.isArray(recommendations.bestPerformingTypes)) {
        this.passTest('Content optimization recommendations work');
      } else {
        this.failTest('Content optimization failed', JSON.stringify(recommendations));
      }

    } catch (error) {
      this.failTest('Engagement Tracker test failed', error.message);
    }
  }

  async testQualityEngine() {
    this.logTest('Quality Engine');
    
    try {
      const { qualityEngine } = require('../dist/utils/contentQualityEngine');
      
      const testContent = "New study reveals AI diagnostics improve accuracy by 15%. Analysis of 10,000 patients shows significant improvement in early detection.";
      
      // Test content analysis
      const analysis = await qualityEngine.analyzeContent(testContent, 'research_insight');
      
      if (analysis && typeof analysis.overall.score === 'number') {
        this.passTest('Content quality analysis works');
      } else {
        this.failTest('Content quality analysis failed', JSON.stringify(analysis));
      }

      // Test quality metrics
      const metrics = await qualityEngine.getQualityMetrics(testContent);
      
      if (metrics && typeof metrics.overall_score === 'number') {
        this.passTest('Quality metrics calculation works');
      } else {
        this.failTest('Quality metrics failed', JSON.stringify(metrics));
      }

    } catch (error) {
      this.failTest('Quality Engine test failed', error.message);
    }
  }

  async testSmartContentEngine() {
    this.logTest('Smart Content Engine');
    
    try {
      const { smartContentEngine } = require('../dist/utils/smartContentEngine');
      
      const testRequest = {
        type: 'research_insight',
        topic: 'healthcare AI',
        useAI: false // Force rule-based to avoid budget usage
      };

      // Test content generation
      const response = await smartContentEngine.generateContent(testRequest);
      
      if (response && response.success && response.content) {
        this.passTest('Smart content generation works');
      } else {
        this.failTest('Smart content generation failed', JSON.stringify(response));
      }

      // Test performance analytics
      const analytics = await smartContentEngine.getContentPerformanceAnalytics();
      
      if (analytics && typeof analytics.aiVsTemplate === 'object') {
        this.passTest('Content performance analytics work');
      } else {
        this.failTest('Content performance analytics failed', JSON.stringify(analytics));
      }

    } catch (error) {
      this.failTest('Smart Content Engine test failed', error.message);
    }
  }

  async testStreamlinedPostAgent() {
    this.logTest('Streamlined Post Agent');
    
    try {
      const { streamlinedPostAgent } = require('../dist/agents/streamlinedPostAgent');
      
      // Test system status
      const status = await streamlinedPostAgent.getSystemStatus();
      
      if (status && typeof status.canPost === 'boolean') {
        this.passTest('System status check works');
      } else {
        this.failTest('System status check failed', JSON.stringify(status));
      }

      // Test performance metrics
      const metrics = await streamlinedPostAgent.getPerformanceMetrics();
      
      if (metrics && typeof metrics === 'object') {
        this.passTest('Performance metrics retrieval works');
      } else {
        this.failTest('Performance metrics failed', JSON.stringify(metrics));
      }

      // Note: We don't test actual posting to avoid hitting Twitter API

    } catch (error) {
      this.failTest('Streamlined Post Agent test failed', error.message);
    }
  }

  async testSystemIntegration() {
    this.logTest('System Integration');
    
    try {
      // Test that all systems can communicate
      console.log('🔗 Testing system integration...');
      
      // Test budget → content → quality → posting flow (without actual posting)
      const { unifiedBudget } = require('../dist/utils/unifiedBudgetManager');
      const { smartContentEngine } = require('../dist/utils/smartContentEngine');
      const { qualityEngine } = require('../dist/utils/contentQualityEngine');
      
      // 1. Check budget
      const budgetStatus = await unifiedBudget.getBudgetStatus();
      
      // 2. Generate content
      const contentResponse = await smartContentEngine.generateContent({
        type: 'research_insight',
        useAI: false
      });
      
      if (!contentResponse.success) {
        this.failTest('Content generation in integration test failed', contentResponse.error);
        return;
      }
      
      // 3. Check quality
      const qualityAnalysis = await qualityEngine.analyzeContent(contentResponse.content);
      
      if (budgetStatus && contentResponse.content && qualityAnalysis.overall.score > 0) {
        this.passTest('End-to-end system integration works');
      } else {
        this.failTest('System integration incomplete', 'One or more components failed');
      }

    } catch (error) {
      this.failTest('System integration test failed', error.message);
    }
  }

  // Test utility methods
  logTest(testName) {
    this.totalTests++;
    console.log(`\n🧪 Testing: ${testName}`);
  }

  passTest(message, details = '') {
    this.passedTests++;
    console.log(`  ✅ ${message}`);
    if (details) console.log(`     ${details}`);
    this.testResults.push({ test: message, status: 'PASS', details });
  }

  failTest(message, details = '') {
    console.log(`  ❌ ${message}`);
    if (details) console.log(`     ${details}`);
    this.testResults.push({ test: message, status: 'FAIL', details });
  }

  generateFinalReport() {
    console.log('\n🏁 === FINAL TEST REPORT ===');
    console.log(`📊 Tests Run: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.totalTests - this.passedTests}`);
    console.log(`📈 Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Your robust architecture is working perfectly!');
      console.log('🚀 Ready for production deployment.');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the errors above.');
      
      const failedTests = this.testResults.filter(r => r.status === 'FAIL');
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`   - ${test.test}: ${test.details}`);
      });
    }

    console.log('\n📋 Detailed Results:');
    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`   ${icon} ${result.test}`);
    });

    console.log('\n🔧 Next Steps:');
    if (this.passedTests === this.totalTests) {
      console.log('   1. Run the database migration: supabase db push');
      console.log('   2. Deploy to production');
      console.log('   3. Monitor performance with new tracking systems');
      console.log('   4. Enjoy your optimized, robust xBOT! 🎉');
    } else {
      console.log('   1. Fix failing tests');
      console.log('   2. Re-run test suite');
      console.log('   3. Proceed with deployment when all tests pass');
    }
  }
}

// Run the test suite
async function main() {
  const tester = new RobustArchitectureTest();
  await tester.runAllTests();
}

main().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
}); 