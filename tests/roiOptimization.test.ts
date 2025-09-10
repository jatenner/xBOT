/**
 * 🧪 ROI OPTIMIZATION TESTS
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { BudgetOptimizer } from '../src/services/budgetOptimizer';

describe('ROI Optimization', () => {
  let optimizer: BudgetOptimizer;
  let mockRedis: any;
  let mockSupabase: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    process.env.BUDGET_OPTIMIZER_ENABLED = 'true';
    process.env.BUDGET_STRATEGY = 'adaptive';
    process.env.DAILY_COST_LIMIT_USD = '5.00';
    process.env.REDIS_PREFIX = 'test:';

    // Mock Redis
    mockRedis = {
      zadd: vi.fn(),
      expire: vi.fn(),
      zremrangebyrank: vi.fn(),
      zrange: vi.fn().mockResolvedValue(['1.5', '2.0', '1.8'])
    };

    // Mock Supabase
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      })
    };

    optimizer = BudgetOptimizer.getInstance();
    (optimizer as any).redis = mockRedis;
    (optimizer as any).supabase = mockSupabase;

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('records ROI data correctly', async () => {
    await optimizer.recordROI('viral_content', 25, 3, 0.15);

    expect(mockSupabase.from).toHaveBeenCalledWith('budget_roi_tracking');
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'test:budget:roi:viral_content',
      expect.any(Number),
      expect.any(Number)
    );
  });

  test('calculates ROI score correctly', async () => {
    const roiScore = await optimizer.getIntentROI('viral_content');
    
    // Should return weighted average of recent scores
    expect(roiScore).toBeGreaterThan(1.0);
    expect(mockRedis.zrange).toHaveBeenCalledWith('test:budget:roi:viral_content', -10, -1);
  });

  test('optimizes model based on ROI', () => {
    // High ROI with good budget
    const highROISettings = optimizer.getROIOptimizedSettings('viral_content', 2.0, 3.0);
    expect(highROISettings.model).toBe('gpt-4o');
    expect(highROISettings.allowExpensive).toBe(true);

    // Low ROI or tight budget
    const lowROISettings = optimizer.getROIOptimizedSettings('analytics', 0.5, 1.0);
    expect(lowROISettings.model).toBe('gpt-4o-mini');
    expect(lowROISettings.allowExpensive).toBe(false);
  });

  test('handles missing ROI data gracefully', async () => {
    mockRedis.zrange.mockResolvedValue([]);
    
    const roiScore = await optimizer.getIntentROI('new_intent');
    expect(roiScore).toBe(1.0); // Baseline for new intents
  });

  test('Redis failure defaults to baseline ROI', async () => {
    (optimizer as any).redis = null;
    
    const roiScore = await optimizer.getIntentROI('test_intent');
    expect(roiScore).toBe(1.0);
  });

  test('ROI-based optimization decisions', async () => {
    // Mock cost tracker
    const mockCostTracker = {
      getBudgetStatus: vi.fn().mockResolvedValue({
        today_spend: 2.0,
        remaining: 3.0,
        blocked: false,
        limit: 5.0
      })
    };

    // Mock getIntentROI to return high ROI
    vi.spyOn(optimizer, 'getIntentROI').mockResolvedValue(1.8);

    // Import and mock costTracker
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: mockCostTracker
    }));

    const decision = await optimizer.optimize('strategic_engagement');
    
    expect(decision.allowExpensive).toBe(true); // High ROI should allow expensive
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.reasoning).toContain('ROI');
  });

  test('conservative ROI strategy under budget pressure', async () => {
    const mockCostTracker = {
      getBudgetStatus: vi.fn().mockResolvedValue({
        today_spend: 4.5,
        remaining: 0.5,
        blocked: false,
        limit: 5.0
      })
    };

    vi.spyOn(optimizer, 'getIntentROI').mockResolvedValue(1.2); // Moderate ROI
    
    vi.doMock('../src/services/costTracker', () => ({
      costTracker: mockCostTracker
    }));

    const decision = await optimizer.optimize('content_generation');
    
    expect(decision.allowExpensive).toBe(false); // Budget pressure overrides ROI
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
  });

  test('calculates weighted ROI average correctly', async () => {
    // Mock multiple scores with recency weighting
    mockRedis.zrange.mockResolvedValue(['1.0', '1.5', '2.0']); // Older to newer

    const roiScore = await optimizer.getIntentROI('test_intent');
    
    // Weighted average: (1.0*1 + 1.5*2 + 2.0*3) / (1+2+3) = 10/6 = 1.67
    expect(roiScore).toBeCloseTo(1.67, 2);
  });
});
