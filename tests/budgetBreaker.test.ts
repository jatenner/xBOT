/**
 * 🧪 BUDGET BREAKER TESTS
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CostTracker, DailyBudgetExceededError } from '../src/services/costTracker';

describe('Budget Breaker', () => {
  let costTracker: CostTracker;
  let mockRedis: any;

  beforeEach(() => {
    // Reset environment
    process.env.COST_TRACKER_ENABLED = 'true';
    process.env.DAILY_COST_LIMIT_USD = '5.00';
    process.env.COST_SOFT_BUDGET_USD = '3.50';
    process.env.REDIS_BREAKER_ENABLED = 'true';
    
    // Mock Redis client
    mockRedis = {
      get: vi.fn(),
      incrByFloat: vi.fn(),
      expire: vi.fn(),
      set: vi.fn(),
      incr: vi.fn()
    };
    
    costTracker = CostTracker.getInstance();
    (costTracker as any).redis = mockRedis;
    
    vi.clearAllMocks();
  });

  test('allows requests under hard budget limit', async () => {
    mockRedis.incrByFloat.mockResolvedValue(2.50); // Under $5 limit
    
    const result = await costTracker.checkBudgetOrThrow();
    
    expect(result).toBe(true);
    expect(mockRedis.incrByFloat).toHaveBeenCalled();
  });

  test('blocks requests over hard budget limit', async () => {
    mockRedis.incrByFloat.mockResolvedValue(6.00); // Over $5 limit
    
    await expect(costTracker.checkBudgetOrThrow()).rejects.toThrow(DailyBudgetExceededError);
  });

  test('sets Redis block flag when budget exceeded', async () => {
    mockRedis.incrByFloat.mockResolvedValue(6.00);
    
    try {
      await costTracker.checkBudgetOrThrow();
    } catch (error) {
      // Expected to throw
    }
    
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining('openai_blocked:'),
      'true',
      'EX',
      expect.any(Number)
    );
  });

  test('respects Redis TTL for daily rollover', async () => {
    mockRedis.incrByFloat.mockResolvedValue(1.00);
    
    await costTracker.checkBudgetOrThrow();
    
    expect(mockRedis.expire).toHaveBeenCalledWith(
      expect.stringContaining('openai_cost:'),
      expect.any(Number)
    );
  });

  test('uses correct Redis key format', async () => {
    mockRedis.incrByFloat.mockResolvedValue(1.00);
    
    await costTracker.checkBudgetOrThrow();
    
    const expectedKeyPattern = /^openai_cost:\d{4}-\d{2}-\d{2}$/;
    const actualKey = mockRedis.incrByFloat.mock.calls[0][0];
    expect(actualKey).toMatch(expectedKeyPattern);
  });

  test('budget status includes soft budget fields', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('blocked')) return null;
      if (key.includes('openai_cost')) return '4.00'; // Over soft limit
      return null;
    });
    
    const status = await costTracker.getBudgetStatus();
    
    expect(status).toHaveProperty('soft_limit', 3.50);
    expect(status).toHaveProperty('soft_budget_exceeded', true);
    expect(status).toHaveProperty('throttle_active', true);
    expect(status.blocked).toBe(false); // Under hard limit
  });

  test('wrapOpenAI skips when budget exceeded', async () => {
    mockRedis.incrByFloat.mockResolvedValue(6.00); // Over limit
    
    const mockApiCall = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'test' } }] });
    
    const result = await costTracker.wrapOpenAI('test', mockApiCall);
    
    expect(result).toHaveProperty('skipped', true);
    expect(mockApiCall).not.toHaveBeenCalled();
  });

  test('wrapOpenAI executes when budget allows', async () => {
    mockRedis.incrByFloat.mockResolvedValue(1.00); // Under limit
    
    const mockApiCall = vi.fn().mockResolvedValue({ 
      choices: [{ message: { content: 'test' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    });
    
    const result = await costTracker.wrapOpenAI('test', mockApiCall, { model: 'gpt-4o-mini' });
    
    expect(mockApiCall).toHaveBeenCalled();
    expect(result).toHaveProperty('choices');
  });

  test('handles Redis failures gracefully', async () => {
    mockRedis.incrByFloat.mockRejectedValue(new Error('Redis connection failed'));
    
    // Should not throw, should allow request when Redis fails
    const result = await costTracker.checkBudgetOrThrow();
    expect(result).toBe(true);
  });

  test('soft budget controls return correct fallback model', () => {
    const controls = costTracker.getSoftBudgetControls('content_generation', 4.00); // Over soft budget
    
    expect(controls.model_fallback).toBe('gpt-4o-mini'); // Cheapest model
    expect(controls.token_cap).toBe(400); // Restricted tokens
    expect(controls.skip_low_priority).toBe(false); // Not low priority intent
  });

  test('soft budget skips low priority intents', () => {
    const controls = costTracker.getSoftBudgetControls('analytics', 4.00); // Over soft budget
    
    expect(controls.skip_low_priority).toBe(true);
  });

  test('intent throttling works correctly', async () => {
    mockRedis.get.mockResolvedValue('2'); // 2 requests this hour
    mockRedis.incr.mockResolvedValue(3);
    
    const result = await costTracker.checkIntentThrottle('analytics'); // Max 2/hour
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('intent throttling allows under limit', async () => {
    mockRedis.get.mockResolvedValue('1'); // 1 request this hour
    mockRedis.incr.mockResolvedValue(2);
    
    const result = await costTracker.checkIntentThrottle('analytics'); // Max 2/hour
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // 2 - 1 - 1 = 0
    expect(mockRedis.incr).toHaveBeenCalled();
  });
});
