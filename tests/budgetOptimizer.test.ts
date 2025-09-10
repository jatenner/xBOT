/**
 * 🧪 BUDGET OPTIMIZER TESTS
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BudgetOptimizer } from '../src/services/budgetOptimizer';

describe('Budget Optimizer', () => {
  let optimizer: BudgetOptimizer;

  beforeEach(() => {
    // Set up environment
    process.env.BUDGET_OPTIMIZER_ENABLED = 'true';
    process.env.BUDGET_STRATEGY = 'adaptive';
    process.env.DAILY_COST_LIMIT_USD = '5.00';
    process.env.BUDGET_PEAK_HOURS = '17-23';
    process.env.BUDGET_MIN_RESERVE_USD = '0.50';
    
    optimizer = BudgetOptimizer.getInstance();
    
    // Clear any existing mocks
    vi.clearAllMocks();
  });

  test('conservative strategy when low budget remaining', async () => {
    // Mock cost tracker to return low remaining budget
    const mockBudgetStatus = {
      today_spend: 4.50,
      remaining: 0.50,
      date_utc: '2024-01-01',
      limit: 5.00,
      blocked: false
    };
    
    // Mock the costTracker import
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: {
        getBudgetStatus: vi.fn().mockResolvedValue(mockBudgetStatus)
      }
    }));

    const decision = await optimizer.optimize('test_intent');
    
    expect(decision.allowExpensive).toBe(false);
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
    expect(decision.maxCostPerCall).toBeLessThan(0.10);
    expect(decision.reasoning).toContain('Emergency conservation');
  });

  test('aggressive strategy during peak hours with budget', async () => {
    const mockBudgetStatus = {
      today_spend: 1.00,
      remaining: 4.00,
      date_utc: '2024-01-01',
      limit: 5.00,
      blocked: false
    };
    
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: {
        getBudgetStatus: vi.fn().mockResolvedValue(mockBudgetStatus)
      }
    }));

    // Mock peak hour (20:00 UTC)
    vi.spyOn(require('luxon').DateTime, 'now').mockReturnValue({
      setZone: vi.fn().mockReturnValue({ hour: 20 })
    });

    const decision = await optimizer.optimize('viral_content');
    
    expect(decision.maxCostPerCall).toBeGreaterThan(0.05);
    expect(decision.reasoning).toContain('peak');
  });

  test('model recommendation adapts to budget', async () => {
    const mockBudgetStatus = {
      today_spend: 2.00,
      remaining: 3.00,
      date_utc: '2024-01-01',
      limit: 5.00,
      blocked: false
    };
    
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: {
        getBudgetStatus: vi.fn().mockResolvedValue(mockBudgetStatus)
      }
    }));

    const decision = await optimizer.optimize('content_generation');
    
    expect(['gpt-4o-mini', 'gpt-4o']).toContain(decision.recommendedModel);
    expect(decision.reasoning).toContain('Adaptive');
  });

  test('intent-specific adjustments work correctly', async () => {
    const mockBudgetStatus = {
      today_spend: 1.00,
      remaining: 4.00,
      date_utc: '2024-01-01',
      limit: 5.00,
      blocked: false
    };
    
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: {
        getBudgetStatus: vi.fn().mockResolvedValue(mockBudgetStatus)
      }
    }));

    // Test high-value intent
    const highValueDecision = await optimizer.optimize('viral_content');
    
    // Test low-value intent
    const lowValueDecision = await optimizer.optimize('analytics');
    
    expect(lowValueDecision.maxCostPerCall).toBeLessThan(highValueDecision.maxCostPerCall);
    expect(lowValueDecision.allowExpensive).toBe(false);
  });

  test('peak hour detection works correctly', () => {
    const isPeakHour = (optimizer as any).isPeakHour;
    
    expect(isPeakHour(18)).toBe(true);  // Peak hour
    expect(isPeakHour(10)).toBe(false); // Off-peak hour
    expect(isPeakHour(23)).toBe(true);  // Peak hour
    expect(isPeakHour(2)).toBe(false);  // Off-peak hour
  });

  test('default decision when optimizer disabled', async () => {
    process.env.BUDGET_OPTIMIZER_ENABLED = 'false';
    
    const decision = await optimizer.optimize('test_intent');
    
    expect(decision.allowExpensive).toBe(false);
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
    expect(decision.reasoning).toContain('Default: Optimizer disabled');
  });
});
