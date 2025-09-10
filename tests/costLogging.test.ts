/**
 * 🧪 COST LOGGING TESTS
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('Cost Logging', () => {
  let costTracker: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import the module fresh for each test
    const module = await import('../src/services/costTracker');
    costTracker = module.costTracker;
  });

  test('RPC logging with fallback to direct insert', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Function not found')),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null, data: [{ id: 1 }] })
      })
    };

    // Mock the supabase client
    (costTracker as any).supabase = mockSupabase;

    await costTracker.recordUsage({
      model: 'gpt-4o-mini',
      intent: 'test',
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      cost_usd: 0.001,
      raw: {}
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('log_openai_usage', expect.any(Object));
    expect(mockSupabase.from).toHaveBeenCalledWith('openai_usage_log');
  });

  test('cost logging never throws errors', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error('RPC failed')),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Insert failed'))
      })
    };

    (costTracker as any).supabase = mockSupabase;

    // Should not throw
    await expect(costTracker.recordUsage({
      model: 'test',
      intent: 'test',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
      raw: {}
    })).resolves.toBeUndefined();
  });

  test('cost estimation works correctly', () => {
    const gpt4oMiniCost = costTracker.estimateCost('gpt-4o-mini', 1000, 500);
    const gpt4oCost = costTracker.estimateCost('gpt-4o', 1000, 500);
    
    expect(gpt4oMiniCost).toBeGreaterThan(0);
    expect(gpt4oCost).toBeGreaterThan(gpt4oMiniCost); // gpt-4o should be more expensive
  });

  test('budget checking works with Redis', async () => {
    const mockRedis = {
      incrByFloat: vi.fn().mockResolvedValue(2.50),
      expire: vi.fn().mockResolvedValue(1)
    };

    (costTracker as any).redis = mockRedis;

    const budgetOk = await costTracker.checkBudgetOrThrow(1.00, 'test');
    
    expect(mockRedis.incrByFloat).toHaveBeenCalled();
    expect(budgetOk).toBe(true);
  });

  test('budget blocking when limit exceeded', async () => {
    const mockRedis = {
      incrByFloat: vi.fn().mockResolvedValue(6.00), // Over the $5 limit
      expire: vi.fn().mockResolvedValue(1)
    };

    (costTracker as any).redis = mockRedis;
    process.env.DAILY_COST_LIMIT_USD = '5.00';

    await expect(costTracker.checkBudgetOrThrow(1.00, 'test')).rejects.toThrow('Daily budget exceeded');
  });

  test('wrapOpenAI skips when budget exceeded', async () => {
    const mockRedis = {
      incrByFloat: vi.fn().mockResolvedValue(6.00),
      expire: vi.fn().mockResolvedValue(1)
    };

    (costTracker as any).redis = mockRedis;
    process.env.DAILY_COST_LIMIT_USD = '5.00';

    const mockApiCall = vi.fn().mockResolvedValue({ choices: [{ message: { content: 'test' } }] });
    
    const result = await costTracker.wrapOpenAI('test', mockApiCall, { model: 'gpt-4o-mini' });
    
    expect(result).toHaveProperty('skipped', true);
    expect(mockApiCall).not.toHaveBeenCalled();
  });

  test('getBudgetStatus returns correct format', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue('2.50')
    };

    (costTracker as any).redis = mockRedis;
    process.env.DAILY_COST_LIMIT_USD = '5.00';

    const status = await costTracker.getBudgetStatus();
    
    expect(status).toHaveProperty('today_spend');
    expect(status).toHaveProperty('remaining');
    expect(status).toHaveProperty('limit');
    expect(status).toHaveProperty('blocked');
    expect(status.limit).toBe(5.00);
  });
});
