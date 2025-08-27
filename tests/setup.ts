/**
 * 🧪 TEST SETUP - Global Test Configuration
 * 
 * Sets up testing environment, mocks, and utilities
 */

import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  console.log('🧪 STARTING TEST SUITE - Performance & Quality Focus');
  
  // Mock environment variables
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.TWITTER_SESSION_B64 = 'test-session';
});

// Performance monitoring for tests
const originalConsoleLog = console.log;
const performanceStartTime = Date.now();

console.log = (...args) => {
  const timestamp = `[${Date.now() - performanceStartTime}ms]`;
  originalConsoleLog(timestamp, ...args);
};

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock external services globally
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null })
    })
  })
}));

// Mock Playwright for browser automation tests
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn(),
          waitForSelector: jest.fn(),
          click: jest.fn(),
          type: jest.fn(),
          keyboard: { press: jest.fn() },
          close: jest.fn()
        }),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }
}));

// Test utilities
export const TestUtils = {
  // Generate mock tweet content
  generateMockTweet: (length = 100) => {
    const words = ['health', 'nutrition', 'fitness', 'wellness', 'energy', 'performance'];
    const randomWords = Array(Math.ceil(length / 8))
      .fill(0)
      .map(() => words[Math.floor(Math.random() * words.length)])
      .join(' ');
    return randomWords.substring(0, length);
  },

  // Generate mock thread
  generateMockThread: (tweetCount = 3) => {
    return Array(tweetCount)
      .fill(0)
      .map((_, i) => `Thread tweet ${i + 1}: ${TestUtils.generateMockTweet(150)}`);
  },

  // Performance measurement
  measurePerformance: async <T>(fn: () => Promise<T>, label: string): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  },

  // Memory usage tracking
  getMemoryUsage: () => {
    if (process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      };
    }
    return null;
  }
};

// Cleanup after all tests
afterAll(() => {
  const finalMemory = TestUtils.getMemoryUsage();
  const totalDuration = Date.now() - performanceStartTime;
  
  console.log(`🧪 TEST SUITE COMPLETE`);
  console.log(`⏱️ Total Duration: ${totalDuration}ms`);
  if (finalMemory) {
    console.log(`💾 Final Memory: ${finalMemory.heapUsed}MB used of ${finalMemory.heapTotal}MB total`);
  }
});