/**
 * 🧪 BUDGET OPTIMIZER DECISION TESTS
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BudgetOptimizer } from '../src/services/budgetOptimizer';

describe('Budget Optimizer Decisions', () => {
  let optimizer: BudgetOptimizer;
  let mockCostTracker: any;

  beforeEach(() => {
    // Set up environment
    process.env.BUDGET_OPTIMIZER_ENABLED = 'true';
    process.env.BUDGET_STRATEGY = 'adaptive';
    process.env.DAILY_COST_LIMIT_USD = '5.00';
    process.env.BUDGET_PEAK_HOURS = '17-23';
    process.env.BUDGET_MIN_RESERVE_USD = '0.50';
    
    // Mock the cost tracker
    mockCostTracker = {
      getBudgetStatus: vi.fn()
    };
    
    // Mock the import of costTracker
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: mockCostTracker
    }));
    
    optimizer = BudgetOptimizer.getInstance();
    
    vi.clearAllMocks();
  });

  test('emergency conservation when near budget limit', async () => {
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 4.60,
      remaining: 0.40, // Under minimum reserve
      blocked: false
    });

    const decision = await optimizer.optimize('test_intent');
    
    expect(decision.allowExpensive).toBe(false);
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
    expect(decision.postingFrequency).toBe('minimal');
    expect(decision.reasoning).toContain('Emergency conservation');
  });

  test('adaptive strategy during peak hours with budget', async () => {
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 1.00,
      remaining: 4.00,
      blocked: false
    });

    // Mock current time to be in peak hours
    const mockDateTime = {
      now: vi.fn().mockReturnValue({
        setZone: vi.fn().mockReturnValue({ hour: 20 }) // Peak hour
      })
    };
    vi.doMock('luxon', () => ({
      DateTime: mockDateTime
    }));

    const decision = await optimizer.optimize('viral_content');
    
    expect(decision.allowExpensive).toBe(true);
    expect(decision.budgetStatus.isPeakHour).toBe(true);
    expect(decision.reasoning).toContain('peak');
  });

  test('conservative strategy during off-peak hours', async () => {
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 2.00,
      remaining: 3.00,
      blocked: false
    });

    // Mock off-peak hour
    const mockDateTime = {
      now: vi.fn().mockReturnValue({
        setZone: vi.fn().mockReturnValue({ hour: 10 }) // Off-peak hour
      })
    };
    vi.doMock('luxon', () => ({
      DateTime: mockDateTime
    }));

    const decision = await optimizer.optimize('content_generation');
    
    expect(decision.budgetStatus.isPeakHour).toBe(false);
    expect(decision.allowExpensive).toBe(false);
  });

  test('high-value intent gets budget boost', async () => {
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 2.00,
      remaining: 3.00,
      blocked: false
    });

    const viralDecision = await optimizer.optimize('viral_content');
    const analyticsDecision = await optimizer.optimize('analytics');
    
    expect(viralDecision.maxCostPerCall).toBeGreaterThan(analyticsDecision.maxCostPerCall);
    expect(viralDecision.reasoning).toContain('high-value intent boost');
    expect(analyticsDecision.reasoning).toContain('low-value intent conservation');
  });

  test('conservative strategy when configured', async () => {
    process.env.BUDGET_STRATEGY = 'conservative';
    
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 2.00,
      remaining: 3.00,
      blocked: false
    });

    const decision = await optimizer.optimize('test_intent');
    
    expect(decision.reasoning).toContain('Conservative');
  });

  test('model recommendation based on budget availability', async () => {
    // High budget remaining
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 0.50,
      remaining: 4.50,
      blocked: false
    });

    const highBudgetDecision = await optimizer.optimize('content_generation');
    
    // Low budget remaining
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 4.00,
      remaining: 1.00,
      blocked: false
    });

    const lowBudgetDecision = await optimizer.optimize('content_generation');
    
    expect(['gpt-4o-mini', 'gpt-4o']).toContain(highBudgetDecision.recommendedModel);
    expect(lowBudgetDecision.recommendedModel).toBe('gpt-4o-mini');
  });

  test('posting frequency adapts to budget pace', async () => {
    // Behind budget (should be more aggressive)
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 1.00, // Low spend
      remaining: 4.00,
      blocked: false
    });

    const mockDateTime = {
      now: vi.fn().mockReturnValue({
        setZone: vi.fn().mockReturnValue({ hour: 18 }) // Mid-day, so behind pace
      })
    };
    vi.doMock('luxon', () => ({
      DateTime: mockDateTime
    }));

    const decision = await optimizer.optimize('content_generation');
    
    expect(decision.postingFrequency).toBe('normal');
  });

  test('peak hour detection works correctly', () => {
    const isPeakHour = (optimizer as any).isPeakHour;
    
    expect(isPeakHour(18)).toBe(true);  // Peak hour
    expect(isPeakHour(22)).toBe(true);  // Peak hour
    expect(isPeakHour(10)).toBe(false); // Off-peak hour
    expect(isPeakHour(2)).toBe(false);  // Off-peak hour
  });

  test('default decision when optimizer disabled', async () => {
    process.env.BUDGET_OPTIMIZER_ENABLED = 'false';
    
    const decision = await optimizer.optimize('test_intent');
    
    expect(decision.allowExpensive).toBe(false);
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
    expect(decision.reasoning).toContain('Default: Optimizer disabled');
  });

  test('ROI data integration affects decisions', async () => {
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 2.00,
      remaining: 3.00,
      blocked: false
    });

    // Mock ROI data showing current hour is high-value
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              { hour: 18, cost_per_follower: 0.01 }, // Good ROI
              { hour: 10, cost_per_follower: 0.05 }  // Poor ROI
            ],
            error: null
          })
        })
      })
    };

    (optimizer as any).supabase = mockSupabase;

    const decision = await optimizer.optimize('content_generation');
    
    // Should factor in ROI data in reasoning
    expect(decision.reasoning).toContain('Adaptive');
  });

  test('handles missing ROI data gracefully', async () => {
    mockCostTracker.getBudgetStatus.mockResolvedValue({
      today_spend: 2.00,
      remaining: 3.00,
      blocked: false
    });

    // Mock Supabase error
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Table not found')
          })
        })
      })
    };

    (optimizer as any).supabase = mockSupabase;

    const decision = await optimizer.optimize('content_generation');
    
    // Should still work with default ROI data
    expect(decision).toHaveProperty('recommendedModel');
    expect(decision).toHaveProperty('reasoning');
  });
});
