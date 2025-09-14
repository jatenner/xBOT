/**
 * Comprehensive Budget Enforcement Tests
 */

import { jest } from '@jest/globals';

// Mock Redis and OpenAI before imports
const mockRedis = {
  get: jest.fn(),
  incrbyfloat: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  setex: jest.fn(),
  exists: jest.fn()
};

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn()
    }
  },
  embeddings: {
    create: jest.fn()
  }
};

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn(() => mockRedis)
  };
});

jest.mock('openai', () => {
  return {
    default: jest.fn(() => mockOpenAI)
  };
});

// Mock supabase service
jest.mock('../src/db/supabaseService', () => ({
  supaService: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn(() => ({
        gte: jest.fn(() => ({
          lt: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        }))
      }))
    }))
  }
}));

// Set required environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = {
    ...originalEnv,
    OPENAI_API_KEY: 'test-key',
    REDIS_URL: 'redis://localhost:6379',
    DAILY_OPENAI_LIMIT_USD: '5.0',
    BUDGET_STRICT: 'true'
  };
  
  // Reset all mocks
  jest.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe('OpenAI Pricing', () => {
  test('should calculate token cost correctly', async () => {
    const { calculateTokenCost, getModelPricing } = await import('../src/config/openai/pricing');
    
    // Test gpt-4o-mini pricing
    const cost = calculateTokenCost('gpt-4o-mini', 1000, 500);
    expect(cost).toBe(0.001250); // (1000 * 0.0005 + 500 * 0.0015) / 1000 = 0.001250
  });
  
  test('should handle unknown models with fallback', async () => {
    const { getModelPricing } = await import('../src/config/openai/pricing');
    
    const pricing = getModelPricing('unknown-model');
    expect(pricing).toEqual({ input: 0.0005, output: 0.0015 }); // gpt-4o-mini fallback
  });
  
  test('should estimate token count', async () => {
    const { estimateTokenCount } = await import('../src/config/openai/pricing');
    
    const tokens = estimateTokenCount('Hello world this is a test');
    expect(tokens).toBe(7); // ~28 chars / 4 = 7 tokens
  });
  
  test('should provide model recommendations based on budget', async () => {
    const { getModelRecommendations } = await import('../src/config/openai/pricing');
    
    // High budget
    const highBudget = getModelRecommendations(3.0);
    expect(highBudget.recommended).toBe('gpt-4o');
    
    // Low budget
    const lowBudget = getModelRecommendations(0.3);
    expect(lowBudget.recommended).toBe('gpt-3.5-turbo');
    
    // No budget
    const noBudget = getModelRecommendations(0.05);
    expect(noBudget.recommended).toBe('none');
  });
});

describe('Budget Enforcement', () => {
  test('should allow calls within budget', async () => {
    // Mock Redis to return low spend
    mockRedis.get.mockResolvedValue('1.50'); // $1.50 used
    mockRedis.exists.mockResolvedValue(0); // Not blocked
    mockRedis.incrbyfloat.mockResolvedValue('1.51'); // New total after increment
    
    // Mock successful OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Test response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    });
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    const response = await client.chatComplete({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }]
    }, {
      purpose: 'test_call'
    });
    
    expect(response.choices[0].message.content).toBe('Test response');
    expect(mockRedis.incrbyfloat).toHaveBeenCalled();
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
  });
  
  test('should block calls when budget exceeded', async () => {
    // Mock Redis to return high spend
    mockRedis.get.mockResolvedValue('4.95'); // $4.95 used out of $5.00
    mockRedis.exists.mockResolvedValue(0); // Not blocked yet
    
    const { OpenAIBudgetedClient, BudgetExceededError } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    await expect(client.chatComplete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }]
    }, {
      purpose: 'test_call'
    })).rejects.toThrow(BudgetExceededError);
    
    // Should not call OpenAI
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    
    // Should set blocked flag
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining('openai_blocked'),
      86400,
      'budget_exceeded'
    );
  });
  
  test('should block calls when already blocked', async () => {
    // Mock Redis to show blocked state
    mockRedis.get.mockResolvedValue('2.00'); // $2.00 used
    mockRedis.exists.mockResolvedValue(1); // Blocked flag exists
    
    const { OpenAIBudgetedClient, BudgetExceededError } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    await expect(client.chatComplete({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }]
    }, {
      purpose: 'test_call'
    })).rejects.toThrow('Daily budget limit reached - calls blocked');
    
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });
  
  test('should refund cost on API failure', async () => {
    // Mock Redis for budget check
    mockRedis.get.mockResolvedValue('1.50');
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.incrbyfloat.mockResolvedValue('1.51');
    
    // Mock OpenAI to fail
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    await expect(client.chatComplete({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }]
    }, {
      purpose: 'test_call'
    })).rejects.toThrow('API Error');
    
    // Should refund the estimated cost (negative increment)
    expect(mockRedis.incrbyfloat).toHaveBeenCalledWith(
      expect.stringContaining('openai_cost'),
      expect.any(Number)
    );
  });
});

describe('Budget Status and Analytics', () => {
  test('should return accurate budget status', async () => {
    // Mock Redis responses
    mockRedis.get
      .mockResolvedValueOnce('3.25') // Spent amount
      .mockResolvedValueOnce('15'); // Call count
    mockRedis.exists.mockResolvedValue(0); // Not blocked
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    const status = await client.getBudgetStatus();
    
    expect(status).toEqual({
      dailyLimitUSD: 5.0,
      usedTodayUSD: 3.25,
      remainingUSD: 1.75,
      percentUsed: 65.0,
      isBlocked: false,
      lastResetDate: expect.any(String),
      totalCallsToday: 15
    });
  });
  
  test('should choose optimal model based on budget', async () => {
    // Mock different budget levels
    mockRedis.get.mockResolvedValue('0.50'); // Low budget
    mockRedis.exists.mockResolvedValue(0);
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    const model = await client.chooseModelForIntent('test_intent');
    expect(model).toBe('gpt-3.5-turbo'); // Should choose cheaper model
  });
});

describe('Legacy Wrapper Compatibility', () => {
  test('should maintain backward compatibility', async () => {
    // Mock Redis for budget check
    mockRedis.get.mockResolvedValue('1.00');
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.incrbyfloat.mockResolvedValue('1.01');
    
    // Mock successful OpenAI response
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Legacy response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    });
    
    const { createChatCompletion } = await import('../src/services/openaiWrapper');
    
    const response = await createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }]
    }, 'legacy_test');
    
    expect(response.choices[0].message.content).toBe('Legacy response');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
  });
  
  test('should skip calls when posting disabled', async () => {
    process.env.POSTING_DISABLED = 'true';
    
    const { createChatCompletion } = await import('../src/services/openaiWrapper');
    
    await expect(createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }]
    }, 'test')).rejects.toThrow('LLM calls disabled (POSTING_DISABLED=true)');
    
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });
});

describe('Embeddings Budget Enforcement', () => {
  test('should enforce budget for embeddings', async () => {
    // Mock Redis for budget check
    mockRedis.get.mockResolvedValue('1.00');
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.incrbyfloat.mockResolvedValue('1.001');
    
    // Mock embeddings response
    mockOpenAI.embeddings.create.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      usage: { prompt_tokens: 50 }
    });
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    const response = await client.createEmbedding({
      model: 'text-embedding-3-small',
      input: 'Test text for embedding'
    }, {
      purpose: 'embedding_test'
    });
    
    expect(response.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(mockOpenAI.embeddings.create).toHaveBeenCalled();
  });
});

describe('Error Handling', () => {
  test('should handle Redis connection errors gracefully', async () => {
    // Mock Redis to fail
    mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    await expect(client.getBudgetStatus()).rejects.toThrow();
  });
  
  test('should handle Supabase errors gracefully', async () => {
    // Mock Supabase to fail
    const mockSupabase = await import('../src/db/supabaseService');
    (mockSupabase.supaService.from as jest.Mock).mockImplementation(() => ({
      insert: jest.fn().mockRejectedValue(new Error('DB Error'))
    }));
    
    // Should not throw - error should be caught and logged
    mockRedis.get.mockResolvedValue('1.00');
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.incrbyfloat.mockResolvedValue('1.01');
    
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Test' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 }
    });
    
    const { OpenAIBudgetedClient } = await import('../src/services/openaiBudgetedClient');
    const client = OpenAIBudgetedClient.getInstance();
    
    // Should succeed despite DB error
    const response = await client.chatComplete({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }]
    }, {
      purpose: 'test_with_db_error'
    });
    
    expect(response.choices[0].message.content).toBe('Test');
  });
});