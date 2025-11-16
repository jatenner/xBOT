/**
 * Jest test setup
 * Global configuration for all tests
 */

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeEach(() => {
  // Mock console methods but allow them to be spied on
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?sslmode=require';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DAILY_OPENAI_LIMIT_USD = '5.00';
process.env.POSTING_DISABLED = 'true';
process.env.REAL_METRICS_ENABLED = 'false';
// Provide a non-secret dummy OpenAI key for tests that instantiate the client
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-openai-key';
}