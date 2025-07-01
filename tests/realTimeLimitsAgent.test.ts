import { RealTimeLimitsIntelligenceAgent } from '../src/agents/realTimeLimitsIntelligenceAgent';
import { xClient } from '../src/utils/xClient';

// Mock the xClient
jest.mock('../src/utils/xClient', () => ({
  xClient: {
    getUserByUsername: jest.fn(),
    checkRateLimit: jest.fn()
  }
}));

// Mock supabaseClient
jest.mock('../src/utils/supabaseClient', () => ({
  supabaseClient: {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({ data: [] }))
          }))
        }))
      }))
    }
  }
}));

describe('RealTimeLimitsAgent - Rate Limit Logic', () => {
  let agent: RealTimeLimitsIntelligenceAgent;
  
  beforeEach(() => {
    agent = new RealTimeLimitsIntelligenceAgent();
    jest.clearAllMocks();
  });

  test('should allow posting when writeRemaining > 0 even if userRemaining = 0', async () => {
    // Mock Twitter API response with write quota available but user 24h cap exhausted
    const mockError = {
      headers: {
        'x-rate-limit-remaining': '100',  // Write quota available
        'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900), // 15 min future
        'x-user-limit-24hour-remaining': '0',  // User 24h cap exhausted
        'x-user-limit-24hour-reset': String(Math.floor(Date.now() / 1000) + 86400) // 24h future
      }
    };
    
    (xClient.getUserByUsername as jest.Mock).mockRejectedValue(mockError);
    (xClient.checkRateLimit as jest.Mock).mockResolvedValue({ remaining: 100, resetTime: Date.now() + 900000 });
    
    // Test the canPost method
    const canPost = agent.canPost();
    
    // Should return true because we only care about writeRemaining, not userRemaining
    expect(canPost).toBe(true);
    
    // Also test the full limits check
    const limits = await agent.getCurrentLimits(true);
    
    // Should be able to post because writeRemaining > 0
    expect(limits.twitter.canPost).toBe(true);
    expect(limits.systemStatus.canPost).toBe(true);
  });

  test('should block posting when writeRemaining = 0 regardless of userRemaining', async () => {
    // Mock Twitter API response with write quota exhausted
    const mockError = {
      headers: {
        'x-rate-limit-remaining': '0',    // Write quota exhausted
        'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900),
        'x-user-limit-24hour-remaining': '50', // User 24h cap still available
        'x-user-limit-24hour-reset': String(Math.floor(Date.now() / 1000) + 86400)
      }
    };
    
    (xClient.getUserByUsername as jest.Mock).mockRejectedValue(mockError);
    (xClient.checkRateLimit as jest.Mock).mockResolvedValue({ remaining: 0, resetTime: Date.now() + 900000 });
    
    // Get limits which should trigger emergency cooldown
    const limits = await agent.getCurrentLimits(true);
    
    // Should be blocked because writeRemaining = 0
    expect(limits.twitter.canPost).toBe(false);
    expect(limits.systemStatus.canPost).toBe(false);
    
    // canPost should now return false due to emergency cooldown
    const canPost = agent.canPost();
    expect(canPost).toBe(false);
  });

  test('should log all four headers when fetching Twitter limits', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    
    const mockError = {
      headers: {
        'x-rate-limit-remaining': '75',
        'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 900),
        'x-user-limit-24hour-remaining': '5',
        'x-user-limit-24hour-reset': String(Math.floor(Date.now() / 1000) + 86400)
      }
    };
    
    (xClient.getUserByUsername as jest.Mock).mockRejectedValue(mockError);
    (xClient.checkRateLimit as jest.Mock).mockResolvedValue({ remaining: 75, resetTime: Date.now() + 900000 });
    
    await agent.getCurrentLimits(true);
    
    // Verify all four headers are logged
    expect(consoleSpy).toHaveBeenCalledWith('📊 Twitter API Headers:');
    expect(consoleSpy).toHaveBeenCalledWith('   x-rate-limit-remaining: 75');
    expect(consoleSpy).toHaveBeenCalledWith('   x-rate-limit-reset: ' + mockError.headers['x-rate-limit-reset']);
    expect(consoleSpy).toHaveBeenCalledWith('   x-user-limit-24hour-remaining: 5');
    expect(consoleSpy).toHaveBeenCalledWith('   x-user-limit-24hour-reset: ' + mockError.headers['x-user-limit-24hour-reset']);
    
    consoleSpy.mockRestore();
  });
}); 