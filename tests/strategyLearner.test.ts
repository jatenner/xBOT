import { StrategyLearner } from '../src/agents/strategyLearner';

// Mock dependencies
jest.mock('../src/utils/supabaseClient', () => ({
  supabaseClient: {
    getBotConfig: jest.fn(),
    setBotConfig: jest.fn(),
    supabase: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    }
  }
}));

jest.mock('../src/utils/awarenessLogger', () => ({
  awarenessLogger: {
    log: jest.fn()
  }
}));

describe('StrategyLearner', () => {
  let strategyLearner: StrategyLearner;

  beforeEach(() => {
    strategyLearner = new StrategyLearner();
    jest.clearAllMocks();
  });

  describe('ε-greedy algorithm', () => {
    test('should explore with probability ε', async () => {
      // Mock Math.random to force exploration
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.05); // Less than ε (0.1)

      // Mock empty performance data to trigger exploration
      const mockPerformance: any[] = [];
      
      const result = await (strategyLearner as any).epsilonGreedySelection(mockPerformance);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      Math.random = originalRandom;
    });

    test('should exploit best style when not exploring', async () => {
      // Mock Math.random to force exploitation
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.5); // Greater than ε (0.1)

      const mockPerformance = [
        { style_name: 'educational', f_per_1k_reward: 3.5, confidence: 0.8, weighted_reward: 2.8 },
        { style_name: 'viral_take', f_per_1k_reward: 5.2, confidence: 0.9, weighted_reward: 4.68 },
        { style_name: 'data_story', f_per_1k_reward: 2.1, confidence: 0.6, weighted_reward: 1.26 }
      ];
      
      const result = await (strategyLearner as any).epsilonGreedySelection(mockPerformance);
      
      expect(result).toBe('viral_take'); // Highest weighted reward
      
      Math.random = originalRandom;
    });

    test('should handle empty performance data gracefully', async () => {
      const result = await (strategyLearner as any).epsilonGreedySelection([]);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Should return one of the predefined content styles
      const validStyles = [
        'educational', 'breaking_news', 'viral_take', 'data_story',
        'thought_leadership', 'community_building', 'trending_analysis', 'research_insight'
      ];
      expect(validStyles).toContain(result);
    });

    test('should calculate weighted rewards correctly', async () => {
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.5); // Force exploitation

      const mockPerformance = [
        { style_name: 'style_a', f_per_1k_reward: 10.0, confidence: 0.5, sample_count: 5 },
        { style_name: 'style_b', f_per_1k_reward: 8.0, confidence: 1.0, sample_count: 20 }
      ];
      
      const result = await (strategyLearner as any).epsilonGreedySelection(mockPerformance);
      
      // style_b should win: 8.0 * 1.0 = 8.0 > 10.0 * 0.5 = 5.0
      expect(result).toBe('style_b');
      
      Math.random = originalRandom;
    });
  });

  describe('adaptation logic', () => {
    test('should increase epsilon when performance is poor', async () => {
      const initialEpsilon = (strategyLearner as any).epsilon;
      
      // Mock poor performance
      jest.spyOn(strategyLearner as any, 'getStylePerformance').mockResolvedValue([
        { f_per_1k_reward: 1.0 },
        { f_per_1k_reward: 1.5 }
      ]);

      await strategyLearner.adaptEpsilon();
      
      expect((strategyLearner as any).epsilon).toBeGreaterThan(initialEpsilon);
    });

    test('should decrease epsilon when performance is good', async () => {
      const initialEpsilon = (strategyLearner as any).epsilon;
      
      // Mock good performance
      jest.spyOn(strategyLearner as any, 'getStylePerformance').mockResolvedValue([
        { f_per_1k_reward: 6.0 },
        { f_per_1k_reward: 7.5 }
      ]);

      await strategyLearner.adaptEpsilon();
      
      expect((strategyLearner as any).epsilon).toBeLessThan(initialEpsilon);
    });

    test('should maintain epsilon bounds', async () => {
      // Test minimum bound
      (strategyLearner as any).epsilon = 0.05;
      jest.spyOn(strategyLearner as any, 'getStylePerformance').mockResolvedValue([
        { f_per_1k_reward: 10.0 }
      ]);
      
      await strategyLearner.adaptEpsilon();
      expect((strategyLearner as any).epsilon).toBeGreaterThanOrEqual(0.05);

      // Test maximum bound
      (strategyLearner as any).epsilon = 0.3;
      jest.spyOn(strategyLearner as any, 'getStylePerformance').mockResolvedValue([
        { f_per_1k_reward: 0.5 }
      ]);
      
      await strategyLearner.adaptEpsilon();
      expect((strategyLearner as any).epsilon).toBeLessThanOrEqual(0.3);
    });
  });

  describe('performance tracking', () => {
    test('should aggregate style performance correctly', async () => {
      const mockTweets = [
        { content_type: 'educational', impressions: 1000, new_followers: 5 },
        { content_type: 'educational', impressions: 2000, new_followers: 8 },
        { content_type: 'viral_take', impressions: 1500, new_followers: 12 }
      ];

      // Mock supabase response
      require('../src/utils/supabaseClient').supabaseClient.supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: mockTweets, error: null })
      });

      const result = await (strategyLearner as any).getStylePerformance();

      expect(result).toHaveLength(2);
      
      const educational = result.find((r: any) => r.style_name === 'educational');
      expect(educational.f_per_1k_reward).toBeCloseTo(4.33, 1); // (5+8)*1000/(1000+2000)
      expect(educational.sample_count).toBe(2);
      
      const viralTake = result.find((r: any) => r.style_name === 'viral_take');
      expect(viralTake.f_per_1k_reward).toBe(8.0); // 12*1000/1500
      expect(viralTake.sample_count).toBe(1);
    });

    test('should handle zero impressions gracefully', async () => {
      const mockTweets = [
        { content_type: 'test_style', impressions: 0, new_followers: 5 }
      ];

      require('../src/utils/supabaseClient').supabaseClient.supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: mockTweets, error: null })
      });

      const result = await (strategyLearner as any).getStylePerformance();
      
      expect(result).toHaveLength(1);
      expect(result[0].f_per_1k_reward).toBe(0);
    });
  });
}); 