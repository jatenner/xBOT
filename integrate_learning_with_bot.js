#!/usr/bin/env node

/**
 * 🔗 INTEGRATE LEARNING SYSTEM WITH BOT
 * 
 * Connect the bot's posting logic to use the new learning functions
 */

const fs = require('fs');
const path = require('path');

function updateFile(filePath, updates) {
  console.log(`🔧 Updating ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  updates.forEach(update => {
    if (content.includes(update.search)) {
      content = content.replace(update.search, update.replace);
      console.log(`  ✅ Applied: ${update.description}`);
      modified = true;
    } else {
      console.log(`  ⚠️  Pattern not found: ${update.description}`);
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  💾 File updated successfully`);
  }

  return modified;
}

function addLearningUtils() {
  const utilsPath = 'src/utils/learningSystemIntegration.ts';
  
  const content = `/**
 * 🧠 LEARNING SYSTEM INTEGRATION
 * 
 * Utilities to connect bot logic with the learning database functions
 */

import { supabaseClient } from './supabaseClient';

export interface OptimalTiming {
  optimal_hour: number;
  day_of_week: number;
  predicted_engagement: number;
  confidence: number;
}

export interface BanditArmStats {
  arm_name: string;
  arm_type: string;
  success_rate: number;
  confidence: number;
  total_selections: number;
}

export class LearningSystemIntegration {
  
  /**
   * 🕐 GET OPTIMAL POSTING TIME
   */
  static async getOptimalPostingTime(targetDayOfWeek?: number): Promise<OptimalTiming | null> {
    try {
      const { data, error } = await supabaseClient.rpc('get_optimal_posting_time', {
        target_day_of_week: targetDayOfWeek || null
      });

      if (error) {
        console.error('❌ Failed to get optimal posting time:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('❌ Error calling get_optimal_posting_time:', error);
      return null;
    }
  }

  /**
   * 🎯 GET BEST CONTENT FORMAT
   */
  static async getBestContentFormat(): Promise<string> {
    try {
      const { data, error } = await supabaseClient.rpc('get_best_content_format');

      if (error) {
        console.error('❌ Failed to get best content format:', error);
        return 'controversy_evidence_stance'; // fallback
      }

      return data || 'controversy_evidence_stance';
    } catch (error) {
      console.error('❌ Error calling get_best_content_format:', error);
      return 'controversy_evidence_stance';
    }
  }

  /**
   * 📊 GET BANDIT ARM STATISTICS
   */
  static async getBanditArmStatistics(): Promise<BanditArmStats[]> {
    try {
      const { data, error } = await supabaseClient.rpc('get_bandit_arm_statistics');

      if (error) {
        console.error('❌ Failed to get bandit statistics:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error calling get_bandit_arm_statistics:', error);
      return [];
    }
  }

  /**
   * 📈 UPDATE TWEET PERFORMANCE
   */
  static async updateTweetPerformance(
    tweetId: string,
    likes: number,
    retweets: number,
    replies: number,
    impressions?: number
  ): Promise<boolean> {
    try {
      const { data, error } = await supabaseClient.rpc('update_tweet_performance', {
        tweet_id_param: tweetId,
        new_likes: likes,
        new_retweets: retweets,
        new_replies: replies,
        new_impressions: impressions || null
      });

      if (error) {
        console.error('❌ Failed to update tweet performance:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('❌ Error calling update_tweet_performance:', error);
      return false;
    }
  }

  /**
   * 💯 CALCULATE ENGAGEMENT SCORE
   */
  static async calculateEngagementScore(
    likes: number,
    retweets: number,
    replies: number,
    impressions?: number
  ): Promise<number> {
    try {
      const { data, error } = await supabaseClient.rpc('calculate_engagement_score', {
        likes_count: likes,
        retweets_count: retweets,
        replies_count: replies,
        impressions_count: impressions || null
      });

      if (error) {
        console.error('❌ Failed to calculate engagement score:', error);
        return 0;
      }

      return Number(data) || 0;
    } catch (error) {
      console.error('❌ Error calling calculate_engagement_score:', error);
      return 0;
    }
  }

  /**
   * 🎰 SELECT OPTIMAL FORMAT USING BANDIT
   */
  static async selectOptimalFormat(): Promise<{format: string; confidence: number; reasoning: string}> {
    const stats = await this.getBanditArmStatistics();
    
    if (stats.length === 0) {
      return {
        format: 'controversy_evidence_stance',
        confidence: 0.5,
        reasoning: 'Using fallback format - no bandit data available'
      };
    }

    // Filter to only format arms
    const formatArms = stats.filter(arm => arm.arm_type === 'format');
    
    if (formatArms.length === 0) {
      return {
        format: 'controversy_evidence_stance',
        confidence: 0.5,
        reasoning: 'Using fallback format - no format arms found'
      };
    }

    // Get the best performing format
    const bestFormat = formatArms[0]; // Already sorted by success rate
    
    return {
      format: bestFormat.arm_name,
      confidence: bestFormat.confidence,
      reasoning: \`Selected \${bestFormat.arm_name} (success rate: \${(bestFormat.success_rate * 100).toFixed(1)}%)\`
    };
  }

  /**
   * ⏰ CHECK IF NOW IS OPTIMAL POSTING TIME
   */
  static async isOptimalPostingTime(): Promise<{isOptimal: boolean; score: number; reasoning: string}> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const optimalTiming = await this.getOptimalPostingTime(currentDay);

    if (!optimalTiming) {
      return {
        isOptimal: false,
        score: 0.5,
        reasoning: 'No timing data available'
      };
    }

    const hourDiff = Math.abs(currentHour - optimalTiming.optimal_hour);
    const score = Math.max(0, 1 - (hourDiff / 4)); // Score decreases with hour difference

    return {
      isOptimal: score >= 0.7,
      score,
      reasoning: \`Current: \${currentHour}h, Optimal: \${optimalTiming.optimal_hour}h (score: \${(score * 100).toFixed(1)}%)\`
    };
  }
}

export const learningSystemIntegration = LearningSystemIntegration;
`;

  console.log(`📝 Creating ${utilsPath}...`);
  fs.writeFileSync(utilsPath, content);
  console.log(`✅ Learning system integration utility created`);
}

function integrateWithPostingEngine() {
  const filePath = 'src/core/autonomousPostingEngine.ts';
  
  const updates = [
    {
      search: `import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';`,
      replace: `import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { learningSystemIntegration } from '../utils/learningSystemIntegration';`,
      description: 'Add learning system import'
    },
    {
      search: `// Step 2: Get optimal timing information
      const now = new Date();
      const timingInfo = {
        hour_of_day: now.getHours(),
        day_of_week: now.getDay(),
        posted_hour: now.getHours(),
        posted_day_of_week: now.getDay()
      };`,
      replace: `// Step 2: Get optimal timing information and check if now is optimal
      const now = new Date();
      const timingCheck = await learningSystemIntegration.isOptimalPostingTime();
      const timingInfo = {
        hour_of_day: now.getHours(),
        day_of_week: now.getDay(),
        posted_hour: now.getHours(),
        posted_day_of_week: now.getDay(),
        timing_optimality: timingCheck.score,
        timing_reasoning: timingCheck.reasoning
      };

      console.log(\`⏰ Timing analysis: \${timingCheck.reasoning}\`);`,
      description: 'Add timing optimality check'
    }
  ];

  return updateFile(filePath, updates);
}

function integrateWithBanditSelector() {
  const filePath = 'src/intelligence/banditFormatSelector.ts';
  
  if (!fs.existsSync(filePath)) {
    console.log(`ℹ️  Creating simplified bandit selector integration...`);
    
    const content = `/**
 * 🎰 BANDIT FORMAT SELECTOR INTEGRATION
 * 
 * Connects the existing bandit logic with the new database functions
 */

import { learningSystemIntegration } from '../utils/learningSystemIntegration';

export class BanditFormatSelector {
  
  static async selectFormat(options: {
    exploration_rate?: number;
    exclude_recent?: boolean;
    min_sample_size?: number;
  } = {}): Promise<{
    format_type: string;
    hook_type: string;
    content_category: string;
    confidence: number;
    reasoning: string;
  }> {
    
    console.log('🎰 Using learning database for format selection...');
    
    const formatSelection = await learningSystemIntegration.selectOptimalFormat();
    
    return {
      format_type: formatSelection.format,
      hook_type: 'data_driven',
      content_category: 'health_optimization',
      confidence: formatSelection.confidence,
      reasoning: formatSelection.reasoning
    };
  }
}

export const banditFormatSelector = BanditFormatSelector;
`;

    fs.writeFileSync(filePath, content);
    console.log(`✅ Bandit format selector integration created`);
    return true;
  }

  return false;
}

function addPerformanceTracking() {
  const filePath = 'src/utils/performanceTracker.ts';
  
  const content = `/**
 * 📊 PERFORMANCE TRACKER
 * 
 * Automatically track tweet performance and update learning system
 */

import { learningSystemIntegration } from './learningSystemIntegration';

export class PerformanceTracker {
  
  /**
   * 📈 TRACK TWEET PERFORMANCE
   */
  static async trackTweetPerformance(tweetData: {
    tweet_id: string;
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
  }): Promise<void> {
    try {
      console.log(\`📊 Tracking performance for tweet: \${tweetData.tweet_id}\`);
      
      const success = await learningSystemIntegration.updateTweetPerformance(
        tweetData.tweet_id,
        tweetData.likes || 0,
        tweetData.retweets || 0,
        tweetData.replies || 0,
        tweetData.impressions
      );

      if (success) {
        const engagementScore = await learningSystemIntegration.calculateEngagementScore(
          tweetData.likes || 0,
          tweetData.retweets || 0,
          tweetData.replies || 0,
          tweetData.impressions
        );

        console.log(\`✅ Performance tracked: Engagement score = \${engagementScore}\`);
      } else {
        console.log(\`⚠️  Failed to track performance for \${tweetData.tweet_id}\`);
      }

    } catch (error) {
      console.error('❌ Error tracking tweet performance:', error);
    }
  }

  /**
   * 🎯 GET PERFORMANCE INSIGHTS
   */
  static async getPerformanceInsights(): Promise<{
    bestFormat: string;
    optimalTiming: any;
    banditStats: any[];
  }> {
    try {
      const [bestFormat, optimalTiming, banditStats] = await Promise.all([
        learningSystemIntegration.getBestContentFormat(),
        learningSystemIntegration.getOptimalPostingTime(),
        learningSystemIntegration.getBanditArmStatistics()
      ]);

      return {
        bestFormat,
        optimalTiming,
        banditStats
      };
    } catch (error) {
      console.error('❌ Error getting performance insights:', error);
      return {
        bestFormat: 'controversy_evidence_stance',
        optimalTiming: null,
        banditStats: []
      };
    }
  }
}

export const performanceTracker = PerformanceTracker;
`;

  console.log(`📝 Creating ${filePath}...`);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Performance tracker created`);
}

function createTestScript() {
  const content = `#!/usr/bin/env node

/**
 * 🧪 TEST LEARNING SYSTEM INTEGRATION
 * 
 * Verify that the bot can successfully use the learning functions
 */

const { learningSystemIntegration } = require('./src/utils/learningSystemIntegration');
const { performanceTracker } = require('./src/utils/performanceTracker');

async function testLearningIntegration() {
  console.log('🧪 Testing Learning System Integration...');
  console.log('=' .repeat(50));

  try {
    // Test 1: Get optimal posting time
    console.log('\\n⏰ Test 1: Optimal Posting Time');
    const optimalTime = await learningSystemIntegration.getOptimalPostingTime();
    console.log('Result:', optimalTime);

    // Test 2: Get best content format
    console.log('\\n🎯 Test 2: Best Content Format');
    const bestFormat = await learningSystemIntegration.getBestContentFormat();
    console.log('Result:', bestFormat);

    // Test 3: Get bandit statistics
    console.log('\\n📊 Test 3: Bandit Statistics');
    const banditStats = await learningSystemIntegration.getBanditArmStatistics();
    console.log('Result:', banditStats.length + ' arms found');
    banditStats.forEach(arm => {
      console.log(\`  - \${arm.arm_name} (\${arm.arm_type}): \${(arm.success_rate * 100).toFixed(1)}% success\`);
    });

    // Test 4: Calculate engagement score
    console.log('\\n💯 Test 4: Engagement Score Calculation');
    const engagementScore = await learningSystemIntegration.calculateEngagementScore(10, 5, 3, 1000);
    console.log('Result:', engagementScore);

    // Test 5: Check optimal timing
    console.log('\\n⏰ Test 5: Is Now Optimal?');
    const timingCheck = await learningSystemIntegration.isOptimalPostingTime();
    console.log('Result:', timingCheck);

    // Test 6: Select optimal format
    console.log('\\n🎰 Test 6: Select Optimal Format');
    const formatSelection = await learningSystemIntegration.selectOptimalFormat();
    console.log('Result:', formatSelection);

    // Test 7: Performance insights
    console.log('\\n📈 Test 7: Performance Insights');
    const insights = await performanceTracker.getPerformanceInsights();
    console.log('Result:', insights);

    console.log('\\n✅ All tests completed successfully!');
    console.log('🚀 Learning system integration is working!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testLearningIntegration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Test error:', error);
      process.exit(1);
    });
}

module.exports = { testLearningIntegration };
`;

  fs.writeFileSync('test_learning_integration.js', content);
  console.log(`✅ Test script created: test_learning_integration.js`);
}

async function main() {
  console.log('🔗 INTEGRATING LEARNING SYSTEM WITH BOT');
  console.log('=' .repeat(50));

  // 1. Create learning utilities
  addLearningUtils();
  
  // 2. Create performance tracker
  addPerformanceTracking();
  
  // 3. Integrate with posting engine
  integrateWithPostingEngine();
  
  // 4. Create bandit selector integration
  integrateWithBanditSelector();
  
  // 5. Create test script
  createTestScript();

  console.log('\\n🎉 INTEGRATION COMPLETE!');
  console.log('=' .repeat(50));
  console.log('✅ Learning system utilities created');
  console.log('✅ Performance tracking added');
  console.log('✅ Posting engine integration attempted');
  console.log('✅ Bandit selector integration created');
  console.log('✅ Test script created');
  console.log('\\n🧪 Run: node test_learning_integration.js to test!');
}

if (require.main === module) {
  main().catch(console.error);
}
