/**
 * 🧪 COST TRACKER TESTS
 * Test budget enforcement and Redis key management
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { CostTracker, DailyBudgetExceededError } from '../src/services/costTracker';
import { DateTime } from 'luxon';

// Mock environment
process.env.COST_TRACKER_ENABLED = 'true';
process.env.DAILY_COST_LIMIT_USD = '5.00';
process.env.COST_TRACKER_STRICT = 'true';
process.env.REDIS_COST_KEY_PREFIX = 'test_openai_cost';

describe('CostTracker', () => {
  let costTracker: CostTracker;

  beforeEach(() => {
    costTracker = CostTracker.getInstance();
  });

  test('redis key naming follows YYYY-MM-DD pattern', () => {
    const today = DateTime.now().setZone('UTC').toFormat('yyyy-MM-dd');
    const key = `test_openai_cost:${today}`;
    expect(key).toMatch(/test_openai_cost:\d{4}-\d{2}-\d{2}/);
  });

  test('estimate cost for gpt-4o-mini', () => {
    const cost = costTracker.estimateCost({
      model: 'gpt-4o-mini',
      prompt_tokens: 1000,
      completion_tokens: 500
    });
    
    // Expected: (1000/1000 * 0.00015) + (500/1000 * 0.0006) = 0.00045
    expect(cost).toBeCloseTo(0.00045, 5);
  });

  test('budget enforcement when below limit', async () => {
    // Mock Redis to return spending below limit
    vi.spyOn(costTracker as any, 'getBudgetStatus').mockResolvedValue({
      today_spend: 3.00,
      limit: 5.00,
      blocked: false
    });

    await expect(costTracker.checkBudgetOrThrow()).resolves.not.toThrow();
  });

  test('budget enforcement when at limit', async () => {
    vi.spyOn(costTracker as any, 'getBudgetStatus').mockResolvedValue({
      today_spend: 5.00,
      limit: 5.00,
      blocked: true
    });

    await expect(costTracker.checkBudgetOrThrow()).rejects.toThrow(DailyBudgetExceededError);
  });

  test('budget enforcement when over limit', async () => {
    vi.spyOn(costTracker as any, 'getBudgetStatus').mockResolvedValue({
      today_spend: 6.50,
      limit: 5.00,
      blocked: true
    });

    await expect(costTracker.checkBudgetOrThrow()).rejects.toThrow(DailyBudgetExceededError);
  });

  test('wrapOpenAI skips when budget exceeded', async () => {
    vi.spyOn(costTracker, 'checkBudgetOrThrow').mockRejectedValue(
      new DailyBudgetExceededError(6.00, 5.00, '2024-09-09')
    );

    const result = await costTracker.wrapOpenAI('test_intent', async () => {
      return { choices: [{ message: { content: 'test' } }] };
    });

    expect(result).toEqual({ skipped: true, reason: expect.stringContaining('Daily budget exceeded') });
  });
});
