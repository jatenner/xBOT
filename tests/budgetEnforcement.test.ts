/**
 * Budget Enforcement Tests
 * Verifies authoritative budget blocking before OpenAI API calls
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Redis
const mockRedis = {
  get: jest.fn() as jest.MockedFunction<any>,
  incrbyfloat: jest.fn() as jest.MockedFunction<any>,
  expire: jest.fn() as jest.MockedFunction<any>,
  del: jest.fn() as jest.MockedFunction<any>,
  on: jest.fn() as jest.MockedFunction<any>
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn() as jest.MockedFunction<any>
    }
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

describe('Budget Enforcement', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.DAILY_OPENAI_LIMIT_USD = '5.00';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.POSTING_DISABLED = 'false';
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('Budget Gate', () => {
    it('should calculate costs correctly for different models', async () => {
      const { calculateCost } = await import('../src/budget/budgetGate');
      
      // GPT-4o-mini: $0.00015 input, $0.0006 output per 1K tokens
      const gpt4oMiniCost = calculateCost('gpt-4o-mini', 1000, 1000);
      expect(gpt4oMiniCost).toBeCloseTo(0.00075, 5); // 0.00015 + 0.0006
      
      // GPT-4o: $0.0025 input, $0.01 output per 1K tokens  
      const gpt4oCost = calculateCost('gpt-4o', 1000, 1000);
      expect(gpt4oCost).toBeCloseTo(0.0125, 4); // 0.0025 + 0.01
      
      // Unknown model should use GPT-4 pricing (safe overestimation)
      const unknownCost = calculateCost('unknown-model', 1000, 1000);
      expect(unknownCost).toBeCloseTo(0.09, 2); // GPT-4: 0.03 + 0.06
    });

    it('should allow requests under budget limit', async () => {
      mockRedis.get.mockResolvedValue('2.50'); // Current spent: $2.50
      mockRedis.incrbyfloat.mockResolvedValue(2.75); // After adding $0.25
      
      const { enforceBudget } = await import('../src/budget/budgetGate');
      
      // Should allow request that keeps total under $5.00
      const cost = await enforceBudget('gpt-4o-mini', 1000, 1000);
      expect(cost).toBeCloseTo(0.00075, 5);
      
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.incrbyfloat).toHaveBeenCalled();
    });

    it('should block requests that exceed budget limit', async () => {
      mockRedis.get.mockResolvedValue('4.99'); // Current spent: $4.99
      
      const { enforceBudget, BudgetExceededError } = await import('../src/budget/budgetGate');
      
      // Should block request that would exceed $5.00 limit
      await expect(enforceBudget('gpt-4o', 1000, 1000)).rejects.toThrow(BudgetExceededError);
      
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.incrbyfloat).not.toHaveBeenCalled(); // Should not reserve cost
    });

    it('should get accurate budget status', async () => {
      mockRedis.get.mockResolvedValue('3.27');
      
      const { getBudgetStatus } = await import('../src/budget/budgetGate');
      const status = await getBudgetStatus();
      
      expect(status.spent).toBe(3.27);
      expect(status.limit).toBe(5.00);
      expect(status.remaining).toBe(1.73);
      expect(status.date).toBe(new Date().toISOString().split('T')[0]);
    });
  });

  describe('OpenAI Wrapper', () => {
    it('should enforce budget before OpenAI API calls', async () => {
      // Mock budget enforcement to throw error
      mockRedis.get.mockResolvedValue('5.00'); // At limit
      
      const { createChatCompletion } = await import('../src/services/openaiWrapper');
      
      const params = {
        model: 'gpt-4o-mini' as const,
        messages: [{ role: 'user' as const, content: 'Hello' }]
      };
      
      // Should throw BudgetExceededError before calling OpenAI
      await expect(createChatCompletion(params, 'test')).rejects.toThrow('Budget exceeded');
      
      // OpenAI should never be called
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should call OpenAI when budget allows', async () => {
      // Mock budget enforcement to allow request
      mockRedis.get.mockResolvedValue('1.00'); // Under limit
      mockRedis.incrbyfloat.mockResolvedValue(1.25); // After reservation
      
      // Mock successful OpenAI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });
      
      const { createChatCompletion } = await import('../src/services/openaiWrapper');
      
      const params = {
        model: 'gpt-4o-mini' as const,
        messages: [{ role: 'user' as const, content: 'Hello' }]
      };
      
      const response = await createChatCompletion(params, 'test');
      
      expect(response.choices[0].message.content).toBe('Hello!');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(params);
    });

    it('should respect POSTING_DISABLED flag', async () => {
      process.env.POSTING_DISABLED = 'true';
      
      const { createChatCompletion } = await import('../src/services/openaiWrapper');
      
      const params = {
        model: 'gpt-4o-mini' as const,
        messages: [{ role: 'user' as const, content: 'Hello' }]
      };
      
      await expect(createChatCompletion(params, 'test')).rejects.toThrow('LLM calls disabled');
      
      // Should not check budget or call OpenAI
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });
  });

  describe('Budget Enforcement Simulation', () => {
    it('should block the 6th call when daily limit is $5 and each call costs $1', async () => {
      const { enforceBudget, BudgetExceededError } = await import('../src/budget/budgetGate');
      
      // Simulate 5 successful $1 calls
      for (let i = 1; i <= 5; i++) {
        mockRedis.get.mockResolvedValueOnce((i - 1).toString()); // Previous total
        mockRedis.incrbyfloat.mockResolvedValueOnce(i); // New total after this call
        
        // Each call should succeed
        await expect(enforceBudget('gpt-4', 1000, 1000)).resolves.toBeCloseTo(0.09, 2);
      }
      
      // 6th call should be blocked
      mockRedis.get.mockResolvedValueOnce('5.00'); // At limit
      
      await expect(enforceBudget('gpt-4', 1000, 1000)).rejects.toThrow(BudgetExceededError);
    });

    it('should show correct budget status after 5 calls at $1 each', async () => {
      mockRedis.get.mockResolvedValue('5.00');
      
      const { getBudgetStatus } = await import('../src/budget/budgetGate');
      const status = await getBudgetStatus();
      
      expect(status.spent).toBe(5.00);
      expect(status.remaining).toBe(0.00);
      expect(status.limit).toBe(5.00);
    });
  });

  describe('Cost Tracking Accuracy', () => {
    it('should record actual usage with correct costs', async () => {
      mockRedis.incrbyfloat.mockResolvedValue(1.25);
      mockRedis.get.mockResolvedValue('1.25');
      
      const { recordActualUsage } = await import('../src/budget/budgetGate');
      
      // Record usage for GPT-4o-mini
      await recordActualUsage('gpt-4o-mini', 1000, 500, 0.001, 'test_context');
      
      // Should calculate actual cost: (1000/1000 * 0.00015) + (500/1000 * 0.0006) = 0.00045
      expect(mockRedis.incrbyfloat).toHaveBeenCalledWith(
        expect.stringContaining('openai_cost'),
        expect.closeTo(-0.00055, 5) // Adjustment: 0.00045 - 0.001 = -0.00055
      );
    });

    it('should log non-zero costs for real API usage', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      mockRedis.get.mockResolvedValue('0.50');
      
      const { recordActualUsage } = await import('../src/budget/budgetGate');
      
      await recordActualUsage('gpt-4o', 500, 200, 0.005, 'content_generation');
      
      // Should log actual cost, not $0
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('BUDGET_STATUS: $0.50')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Redis Key Consistency', () => {
    it('should use consistent Redis keys for budget tracking', async () => {
      const today = new Date().toISOString().split('T')[0];
      const expectedKey = `prod:openai_cost:${today}`;
      
      mockRedis.get.mockResolvedValue('2.50');
      
      const { getBudgetStatus } = await import('../src/budget/budgetGate');
      await getBudgetStatus();
      
      expect(mockRedis.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const { getBudgetStatus } = await import('../src/budget/budgetGate');
      
      await expect(getBudgetStatus()).rejects.toThrow('Failed to get budget status');
    });
  });
});
