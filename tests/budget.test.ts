/**
 * Budget Hard-Guard Tests
 * Ensures budget enforcement works correctly
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  incrbyfloat: jest.fn(),
  expire: jest.fn()
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('Budget Hard-Guard', () => {
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.DAILY_OPENAI_LIMIT_USD = '5.00';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.POSTING_DISABLED = 'false';
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });
  
  it('should block LLM calls when budget limit reached', async () => {
    // Mock Redis to return spent amount at limit
    mockRedis.get.mockResolvedValue('5.00');
    
    const { checkBudgetAllowed } = await import('../src/budget/hardGuard');
    const result = await checkBudgetAllowed();
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily budget limit reached');
    expect(result.status?.hardStopActive).toBe(true);
  });
  
  it('should allow LLM calls when under budget', async () => {
    // Mock Redis to return spent amount under limit
    mockRedis.get.mockResolvedValue('2.50');
    
    const { checkBudgetAllowed } = await import('../src/budget/hardGuard');
    const result = await checkBudgetAllowed();
    
    expect(result.allowed).toBe(true);
    expect(result.status?.hardStopActive).toBe(false);
    expect(result.status?.remaining).toBe(2.50);
  });
  
  it('should respect POSTING_DISABLED flag', async () => {
    process.env.POSTING_DISABLED = 'true';
    mockRedis.get.mockResolvedValue('0.00');
    
    const { checkBudgetAllowed } = await import('../src/budget/hardGuard');
    const result = await checkBudgetAllowed();
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('POSTING_DISABLED=true');
  });
  
  it('should record usage correctly', async () => {
    mockRedis.incrbyfloat.mockResolvedValue(3.25);
    
    const { recordBudgetUsage } = await import('../src/budget/hardGuard');
    await recordBudgetUsage(0.25, 'test-context');
    
    const dateKey = new Date().toISOString().split('T')[0];
    expect(mockRedis.incrbyfloat).toHaveBeenCalledWith(
      `prod:openai_cost:${dateKey}`,
      0.25
    );
  });
  
  it('should throw BudgetHardStopError when enforcing', async () => {
    mockRedis.get.mockResolvedValue('5.00');
    
    const { enforceBudgetHardStop, BudgetHardStopError } = await import('../src/budget/hardGuard');
    
    await expect(enforceBudgetHardStop()).rejects.toThrow(BudgetHardStopError);
  });
  
  it('should log hard-stop only once per day', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('openai_cost')) return '5.00';
      if (key.includes('budget_hard_stop_logged')) return null; // Not logged yet
      return null;
    });
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    const { checkBudgetAllowed } = await import('../src/budget/hardGuard');
    await checkBudgetAllowed();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🛡️ BUDGET_HARD_STOP: limit reached, halting LLM calls')
    );
    
    consoleSpy.mockRestore();
  });
});
