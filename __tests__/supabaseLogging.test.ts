/**
 * 🧪 SUPABASE LOGGING TESTS
 * Test RPC fallback to direct insert
 */

import { describe, test, expect, vi } from 'vitest';
import { CostTracker } from '../src/services/costTracker';

describe('Supabase Cost Logging', () => {
  test('recordUsage tries RPC first then direct insert', async () => {
    const costTracker = CostTracker.getInstance();
    const mockSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error('RPC not found')),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })
    };

    // Mock Supabase client
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
});
