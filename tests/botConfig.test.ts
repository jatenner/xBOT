// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
};

const mockSupabaseClient = {
  supabase: mockSupabase
};

jest.mock('../src/utils/supabaseClient', () => ({
  supabaseClient: mockSupabaseClient,
}));

import { getConfig } from '../src/utils/botConfig';

describe('botConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache by accessing the internal cache (for testing only)
    const configModule = require('../src/utils/botConfig');
    if (configModule.clearCache) configModule.clearCache();
  });

  describe('getConfig', () => {
    it('should return default value when no config row exists', async () => {
      // Mock a failed query (no row found)
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows returned' }
          })
        })
      });
      
      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getConfig('mode', 'production');
      
      expect(result).toBe('production');
      expect(mockSupabase.from).toHaveBeenCalledWith('bot_config');
      expect(mockSelect).toHaveBeenCalledWith('value');
    });

    it('should return config value when row exists', async () => {
      // Mock a successful query
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { value: 'balanced' },
            error: null
          })
        })
      });
      
      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getConfig('postingStrategy', 'production');
      
      expect(result).toBe('balanced');
      expect(mockSupabase.from).toHaveBeenCalledWith('bot_config');
    });

    it('should return default value when Supabase throws error', async () => {
      // Mock a query that throws
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Database connection failed'))
        })
      });
      
      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await getConfig('mode', 'production');
      
      expect(result).toBe('production');
    });

    it('should cache results for subsequent calls', async () => {
      // Mock a successful query
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { value: 'balanced' },
            error: null
          })
        })
      });
      
      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      // Make two calls to the same key
      const result1 = await getConfig('testKey', 'default');
      const result2 = await getConfig('testKey', 'default');
      
      expect(result1).toBe('balanced');
      expect(result2).toBe('balanced');
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only called once due to caching
    });
  });
});
