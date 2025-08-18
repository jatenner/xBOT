/**
 * Test setup and environment guards
 * Provides mocks and guards for tests that require external services
 */

// Mock Redis for lock tests
export const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  setex: jest.fn().mockResolvedValue('OK'),
  eval: jest.fn().mockResolvedValue(1)
};

// Mock Supabase for client tests
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    update: jest.fn().mockResolvedValue({ data: {}, error: null }),
    delete: jest.fn().mockResolvedValue({ data: {}, error: null })
  })),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null })
};

// Environment guards
export function requireEnv(vars: string[]): boolean {
  return vars.every(v => process.env[v]);
}

export function skipIfMissingEnv(vars: string[], testName: string = 'test') {
  if (!requireEnv(vars)) {
    console.log(`⏭️  Skipping ${testName} - missing env vars: ${vars.filter(v => !process.env[v]).join(', ')}`);
    return true;
  }
  return false;
}

// Test data generators
export function generateMockPost() {
  return {
    id: 'mock_post_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    type: 'single' as const,
    hook: 'I fixed my test problem in 2 weeks',
    content: 'Mock content for testing purposes. This should be actionable and specific.',
    metrics: {
      likes: Math.floor(Math.random() * 200) + 50,
      replies: Math.floor(Math.random() * 50) + 10,
      reposts: Math.floor(Math.random() * 30) + 5,
      bookmarks: Math.floor(Math.random() * 100) + 20,
      views: Math.floor(Math.random() * 5000) + 1000
    }
  };
}

export function generateMockTargetPost() {
  return {
    author: 'TestUser',
    handle: '@testuser',
    url: 'https://twitter.com/testuser/status/123',
    content: 'Looking for advice on improving my daily routine. Any suggestions?',
    quotedDetail: 'daily routine',
    stance: 'add_nuance' as const,
    goal: 'Provide helpful, actionable advice'
  };
}

export function generateMockMention() {
  return {
    author: 'EngagedUser',
    handle: '@engageduser',
    postUrl: 'https://twitter.com/ourhandle/status/456',
    text: 'This is really helpful! How long did it take to see results?',
    sentiment: 'positive' as const,
    responseStyle: 'thank + mini-tip'
  };
}

// Jest setup
beforeAll(() => {
  // Suppress console logs during tests unless explicitly testing them
  if (!process.env.VERBOSE_TESTS) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }
});

afterAll(() => {
  jest.restoreAllMocks();
});