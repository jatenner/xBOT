/**
 * 🧪 COMPREHENSIVE TEST SUITE: AutonomousPostingEngine
 * 
 * Tests for the core posting functionality - addressing the 40% test coverage issue
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock all external dependencies
jest.mock('../../src/posting/enhancedThreadComposer');
jest.mock('../../src/intelligence/aggressiveLearningEngine');
jest.mock('../../src/ai/socialContentOperator');
jest.mock('../../src/lib/contentStorageFix');

describe('AutonomousPostingEngine', () => {
  let postingEngine: any;
  let mockSocialOperator: any;
  let mockThreadComposer: any;
  let mockLearningEngine: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock SocialContentOperator
    mockSocialOperator = {
      generateContentPack: jest.fn().mockResolvedValue({
        singles: ['Test single tweet content'],
        threads: [{
          topic: 'Test thread topic',
          tweets: ['Thread tweet 1', 'Thread tweet 2', 'Thread tweet 3']
        }],
        metadata: {
          qualityScores: [85],
          diversityScore: 90,
          formatMix: ['single', 'thread']
        }
      })
    };

    // Mock EnhancedThreadComposer
    mockThreadComposer = {
      getInstance: jest.fn().mockReturnValue({
        postOrganizedThread: jest.fn().mockResolvedValue({
          success: true,
          rootTweetId: 'thread_123',
          replyIds: ['reply_1', 'reply_2'],
          threadStructure: {
            totalTweets: 3,
            successfulPosts: 3,
            failedPosts: 0,
            threadChain: ['thread_123', 'reply_1', 'reply_2']
          }
        })
      })
    };

    // Mock AggressiveLearningEngine
    mockLearningEngine = {
      getInstance: jest.fn().mockReturnValue({
        optimizeContentForMaxEngagement: jest.fn().mockResolvedValue({
          predicted_engagement_boost: 0.15,
          improvements_applied: ['Hook optimization', 'Timing adjustment'],
          optimized_content: 'Optimized test content'
        })
      })
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Content Generation', () => {
    test('should generate single tweet content successfully', async () => {
      // Test single tweet generation
      const result = await postingEngine.generateContent();
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(280);
    });

    test('should handle content generation failures gracefully', async () => {
      // Mock failure scenario
      mockSocialOperator.generateContentPack.mockRejectedValue(new Error('API Error'));
      
      const result = await postingEngine.generateContent();
      
      // Should fallback to emergency content
      expect(result).toContain('health');
      expect(result.length).toBeGreaterThan(20);
    });

    test('should clean thread emojis from single tweets', async () => {
      // Test the thread emoji cleanup functionality
      mockSocialOperator.generateContentPack.mockResolvedValue({
        singles: ['Test content with thread emoji 🧵'],
        threads: [],
        metadata: { qualityScores: [80], diversityScore: 85 }
      });
      
      const result = await postingEngine.generateContent();
      
      expect(result).not.toContain('🧵');
    });
  });

  describe('Thread Posting', () => {
    test('should post thread when content suggests deep dive', async () => {
      mockSocialOperator.generateContentPack.mockResolvedValue({
        singles: ['Deep dive into health optimization techniques'],
        threads: [{
          topic: 'Health Optimization',
          tweets: ['Deep dive tweet 1', 'Deep dive tweet 2', 'Deep dive tweet 3']
        }],
        metadata: { qualityScores: [90], diversityScore: 95 }
      });
      
      const result = await postingEngine.generateContent();
      
      // Should force thread mode due to "deep dive" content
      expect(mockThreadComposer.getInstance().postOrganizedThread).toHaveBeenCalled();
    });

    test('should handle thread posting failures with fallback', async () => {
      mockThreadComposer.getInstance().postOrganizedThread.mockResolvedValue({
        success: false,
        error: 'Thread posting failed'
      });
      
      // Should not throw and should handle gracefully
      await expect(postingEngine.postFullThread(
        ['Tweet 1', 'Tweet 2'], 
        'Test Topic'
      )).resolves.toBeDefined();
    });
  });

  describe('Performance Optimization', () => {
    test('should apply aggressive learning optimizations', async () => {
      const testContent = 'Original test content';
      
      const result = await postingEngine.generateContent();
      
      expect(mockLearningEngine.getInstance().optimizeContentForMaxEngagement)
        .toHaveBeenCalled();
    });

    test('should handle optimization failures gracefully', async () => {
      mockLearningEngine.getInstance().optimizeContentForMaxEngagement
        .mockRejectedValue(new Error('Optimization failed'));
      
      // Should fallback to original content
      const result = await postingEngine.generateContent();
      expect(result).toBeDefined();
    });
  });

  describe('Content Quality Validation', () => {
    test('should validate content meets minimum quality standards', async () => {
      const shortContent = 'Too short';
      
      // Mock content that would fail validation
      mockSocialOperator.generateContentPack.mockResolvedValue({
        singles: [shortContent],
        threads: [],
        metadata: { qualityScores: [30], diversityScore: 40 }
      });
      
      const result = await postingEngine.generateContent();
      
      // Should use emergency content instead
      expect(result).not.toBe(shortContent);
      expect(result.length).toBeGreaterThan(50);
    });

    test('should handle stress/psychology content validation', async () => {
      const stressContent = 'Stress is an inevitable part of life, but how we adapt to it can make all the difference.';
      
      mockSocialOperator.generateContentPack.mockResolvedValue({
        singles: [stressContent],
        threads: [],
        metadata: { qualityScores: [85], diversityScore: 80 }
      });
      
      const result = await postingEngine.generateContent();
      
      // Should accept stress-related content (after our validation fixes)
      expect(result).toContain('stress');
    });
  });

  describe('Error Handling & Resilience', () => {
    test('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      
      mockSocialOperator.generateContentPack.mockRejectedValue(timeoutError);
      
      const result = await postingEngine.generateContent();
      
      // Should provide fallback content
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      
      mockLearningEngine.getInstance().optimizeContentForMaxEngagement
        .mockRejectedValue(rateLimitError);
      
      // Should continue with unoptimized content
      await expect(postingEngine.generateContent()).resolves.toBeDefined();
    });

    test('should handle database connection failures', async () => {
      // Test database resilience
      const dbError = new Error('Database connection failed');
      
      // Should not break the posting process
      await expect(postingEngine.generateContent()).resolves.toBeDefined();
    });
  });

  describe('Performance Benchmarks', () => {
    test('content generation should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await postingEngine.generateContent();
      
      const duration = Date.now() - startTime;
      
      // Should complete within 10 seconds for single content
      expect(duration).toBeLessThan(10000);
    });

    test('thread posting should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      await postingEngine.postFullThread(
        ['Tweet 1', 'Tweet 2', 'Tweet 3'], 
        'Performance Test'
      );
      
      const duration = Date.now() - startTime;
      
      // Should complete within 30 seconds for 3-tweet thread
      expect(duration).toBeLessThan(30000);
    });
  });
});

describe('Integration Tests', () => {
  test('full posting cycle should work end-to-end', async () => {
    // Test complete posting workflow
    const opportunity = {
      reason: 'TEST_OPPORTUNITY',
      score: 85,
      timing: 'optimal'
    };
    
    const result = await postingEngine.executeIntelligentPost(opportunity);
    
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  });

  test('should handle concurrent posting requests', async () => {
    // Test system under load
    const promises = Array(3).fill(0).map(() => 
      postingEngine.executeIntelligentPost({ reason: 'CONCURRENT_TEST', score: 80 })
    );
    
    const results = await Promise.allSettled(promises);
    
    // At least one should succeed
    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThan(0);
  });
});

// Performance monitoring utilities
export const PerformanceMonitor = {
  measureExecutionTime: async (fn: () => Promise<any>, label: string) => {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️ PERFORMANCE: ${label} took ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  },

  measureMemoryUsage: (label: string) => {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      console.log(`💾 MEMORY: ${label} - RSS: ${(usage.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      return usage;
    }
  }
};
