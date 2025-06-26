import { FollowGrowthAgent } from '../src/agents/followGrowthAgent';

// Mock dependencies
jest.mock('../src/utils/supabaseClient', () => ({
  supabaseClient: {
    getBotConfig: jest.fn(),
    setBotConfig: jest.fn(),
    supabase: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    }
  }
}));

jest.mock('../src/utils/xClient', () => ({
  xClient: {
    v2: {
      followers: jest.fn(),
      follow: jest.fn(),
      unfollow: jest.fn()
    },
    currentUser: jest.fn(),
    followUser: jest.fn(),
    getUserByUsername: jest.fn(),
    getUsersToFollow: jest.fn()
  }
}));

jest.mock('../src/utils/followerRatioGuard', () => ({
  followerRatioGuard: jest.fn()
}));

jest.mock('../src/utils/quotaGuard', () => ({
  quotaGuard: {
    canMakeWriteCall: jest.fn(),
    canMakeReadCall: jest.fn()
  }
}));

jest.mock('../src/utils/awarenessLogger', () => ({
  awarenessLogger: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('FollowGrowthAgent', () => {
  let followGrowthAgent: FollowGrowthAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    followGrowthAgent = new FollowGrowthAgent();
  });

  describe('daily limits enforcement', () => {
    test('should respect daily follow limit', async () => {
      const mockActionCounts = { follows: 20, unfollows: 5 };
      jest.spyOn(followGrowthAgent as any, 'getTodayActionCounts').mockResolvedValue(mockActionCounts);
      jest.spyOn(followGrowthAgent as any, 'performFollowActions').mockResolvedValue(undefined);
      jest.spyOn(followGrowthAgent as any, 'performUnfollowActions').mockResolvedValue(undefined);
      
      require('../src/utils/followerRatioGuard').followerRatioGuard.mockResolvedValue(true);
      require('../src/utils/supabaseClient').supabaseClient.getBotConfig.mockResolvedValue('false');

      await followGrowthAgent.run();

      expect((followGrowthAgent as any).performFollowActions).toHaveBeenCalledWith(5); // 25 - 20 = 5
    });

    test('should respect daily unfollow limit', async () => {
      const mockActionCounts = { follows: 10, unfollows: 24 };
      jest.spyOn(followGrowthAgent as any, 'getTodayActionCounts').mockResolvedValue(mockActionCounts);
      jest.spyOn(followGrowthAgent as any, 'performFollowActions').mockResolvedValue(undefined);
      jest.spyOn(followGrowthAgent as any, 'performUnfollowActions').mockResolvedValue(undefined);
      
      require('../src/utils/followerRatioGuard').followerRatioGuard.mockResolvedValue(true);
      require('../src/utils/supabaseClient').supabaseClient.getBotConfig.mockResolvedValue('false');

      await followGrowthAgent.run();

      expect((followGrowthAgent as any).performUnfollowActions).toHaveBeenCalledWith(1); // 25 - 24 = 1
      expect((followGrowthAgent as any).performFollowActions).toHaveBeenCalledWith(15); // 25 - 10 = 15
    });

    test('should skip when daily limits are reached', async () => {
      const mockActionCounts = { follows: 25, unfollows: 25 };
      jest.spyOn(followGrowthAgent as any, 'getTodayActionCounts').mockResolvedValue(mockActionCounts);
      jest.spyOn(followGrowthAgent as any, 'performFollowActions').mockResolvedValue(undefined);
      jest.spyOn(followGrowthAgent as any, 'performUnfollowActions').mockResolvedValue(undefined);
      
      require('../src/utils/followerRatioGuard').followerRatioGuard.mockResolvedValue(true);
      require('../src/utils/supabaseClient').supabaseClient.getBotConfig.mockResolvedValue('false');

      await followGrowthAgent.run();

      expect((followGrowthAgent as any).performFollowActions).toHaveBeenCalledWith(0);
      expect((followGrowthAgent as any).performUnfollowActions).toHaveBeenCalledWith(0);
    });
  });

  describe('ratio guard integration', () => {
    test('should pause following when ratio guard triggers', async () => {
      require('../src/utils/followerRatioGuard').followerRatioGuard.mockResolvedValue(false);
      require('../src/utils/supabaseClient').supabaseClient.setBotConfig.mockResolvedValue(undefined);

      await followGrowthAgent.run();

      expect(require('../src/utils/supabaseClient').supabaseClient.setBotConfig)
        .toHaveBeenCalledWith('follow_pause', 'true');
    });

    test('should skip when follow_pause is active', async () => {
      require('../src/utils/supabaseClient').supabaseClient.getBotConfig.mockResolvedValue('true');
      jest.spyOn(followGrowthAgent as any, 'performFollowActions').mockResolvedValue(undefined);
      
      await followGrowthAgent.run();

      expect((followGrowthAgent as any).performFollowActions).not.toHaveBeenCalled();
    });
  });

  describe('target filtering', () => {
    test('should filter out obvious bots', () => {
      const botUser = {
        username: 'bot12345',
        description: 'Automated account',
        public_metrics: {
          followers_count: 100,
          following_count: 5000,
          tweet_count: 10000
        }
      };

      expect((followGrowthAgent as any).isValidFollowTarget(botUser)).toBe(false);
    });

    test('should reject users with poor follower ratios', () => {
      const poorRatioUser = {
        username: 'example',
        description: 'Health enthusiast',
        public_metrics: {
          followers_count: 10,
          following_count: 2000,
          tweet_count: 100
        }
      };

      expect((followGrowthAgent as any).isValidFollowTarget(poorRatioUser)).toBe(false);
    });

    test('should reject users with extreme follower counts', () => {
      const extremeUser = {
        username: 'celebrity',
        description: 'Famous person',
        public_metrics: {
          followers_count: 10000000,
          following_count: 100,
          tweet_count: 1000
        }
      };

      expect((followGrowthAgent as any).isValidFollowTarget(extremeUser)).toBe(false);
    });
  });

  describe('unfollow timing', () => {
    test('should target users followed 4+ days ago', async () => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const expectedDateStr = fourDaysAgo.toISOString().split('T')[0];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ user_id: '123', followed_at: fourDaysAgo.toISOString() }],
          error: null
        })
      };

      require('../src/utils/supabaseClient').supabaseClient.supabase.from.mockReturnValue(mockQuery);

      await (followGrowthAgent as any).getUnfollowTargets(5);

      expect(mockQuery.lte).toHaveBeenCalledWith('followed_at', expect.stringContaining(expectedDateStr));
    });
  });

  describe('rate limiting', () => {
    test('should stop following when write quota is reached', async () => {
      require('../src/utils/quotaGuard').quotaGuard.canMakeWriteCall.mockResolvedValue(false);
      
      const mockActionCounts = { follows: 0, unfollows: 0 };
      jest.spyOn(followGrowthAgent as any, 'getTodayActionCounts').mockResolvedValue(mockActionCounts);
      jest.spyOn(followGrowthAgent as any, 'performFollowActions').mockResolvedValue(undefined);
      jest.spyOn(followGrowthAgent as any, 'performUnfollowActions').mockResolvedValue(undefined);
      
      require('../src/utils/followerRatioGuard').followerRatioGuard.mockResolvedValue(true);
      require('../src/utils/supabaseClient').supabaseClient.getBotConfig.mockResolvedValue('false');

      await followGrowthAgent.run();

      expect((followGrowthAgent as any).performFollowActions).toHaveBeenCalledWith(0);
    });

    test('should respect quota guard for API calls', async () => {
      require('../src/utils/quotaGuard').quotaGuard.canMakeReadCall.mockResolvedValue(true);
      require('../src/utils/quotaGuard').quotaGuard.canMakeWriteCall.mockResolvedValue(true);
      
      const mockActionCounts = { follows: 0, unfollows: 0 };
      jest.spyOn(followGrowthAgent as any, 'getTodayActionCounts').mockResolvedValue(mockActionCounts);
      jest.spyOn(followGrowthAgent as any, 'performFollowActions').mockResolvedValue(undefined);
      jest.spyOn(followGrowthAgent as any, 'performUnfollowActions').mockResolvedValue(undefined);
      
      require('../src/utils/followerRatioGuard').followerRatioGuard.mockResolvedValue(true);
      require('../src/utils/supabaseClient').supabaseClient.getBotConfig.mockResolvedValue('false');

      await followGrowthAgent.run();

      expect(require('../src/utils/quotaGuard').quotaGuard.canMakeWriteCall).toHaveBeenCalled();
    });
  });
}); 