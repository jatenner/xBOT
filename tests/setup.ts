// Jest setup file for test environment configuration
import { jest } from '@jest/globals';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.TWITTER_API_KEY = 'test-twitter-key';
process.env.TWITTER_API_SECRET = 'test-twitter-secret';
process.env.TWITTER_ACCESS_TOKEN = 'test-access-token';
process.env.TWITTER_ACCESS_TOKEN_SECRET = 'test-access-secret';

// Set longer timeout for async operations
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 