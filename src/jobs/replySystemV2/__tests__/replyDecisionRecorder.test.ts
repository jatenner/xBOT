/**
 * Unit tests for replyDecisionRecorder
 * Tests ancestry gate logic, especially Reply V2 soft-pass for UNCERTAIN
 */

import { shouldAllowReply, ReplyAncestry } from '../replyDecisionRecorder';
import { getSupabaseClient } from '../../../db';

// Mock Supabase client
jest.mock('../../../db', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('shouldAllowReply', () => {
  const mockSupabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({})),
    })),
  };

  beforeEach(() => {
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    jest.clearAllMocks();
  });

  describe('Reply V2 soft-pass for UNCERTAIN', () => {
    it('should allow UNCERTAIN ancestry for Reply V2 decision with runtime_preflight_status=ok', async () => {
      const ancestry: ReplyAncestry = {
        targetTweetId: '1234567890',
        targetInReplyToTweetId: null,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'UNCERTAIN',
        confidence: 'LOW',
        method: 'explicit_signals',
      };

      // Mock decision metadata with Reply V2 + runtime_ok
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({
              data: {
                pipeline_source: 'reply_v2_planner',
                features: {
                  runtime_preflight_status: 'ok',
                },
              },
            })),
          })),
        })),
      });

      // Mock system_events insert
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => Promise.resolve({})),
      });

      const result = await shouldAllowReply(ancestry, {
        decision_id: 'test-decision-id',
      });

      expect(result.allow).toBe(true);
      expect(result.reason).toContain('Reply V2 soft-pass');
      expect(result.reason).toContain('runtime_preflight_status=ok');
    });

    it('should block UNCERTAIN ancestry for non-Reply V2 decision', async () => {
      const ancestry: ReplyAncestry = {
        targetTweetId: '1234567890',
        targetInReplyToTweetId: null,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'UNCERTAIN',
        confidence: 'LOW',
        method: 'explicit_signals',
      };

      // Mock decision metadata with non-Reply V2 pipeline
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({
              data: {
                pipeline_source: 'reply_v1',
                features: {},
              },
            })),
          })),
        })),
      });

      const result = await shouldAllowReply(ancestry, {
        decision_id: 'test-decision-id',
      });

      expect(result.allow).toBe(false);
      expect(result.deny_reason_code).toBe('ANCESTRY_UNCERTAIN');
    });

    it('should block UNCERTAIN ancestry for Reply V2 decision without runtime_preflight_status=ok', async () => {
      const ancestry: ReplyAncestry = {
        targetTweetId: '1234567890',
        targetInReplyToTweetId: null,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'UNCERTAIN',
        confidence: 'LOW',
        method: 'explicit_signals',
      };

      // Mock decision metadata with Reply V2 but no runtime_ok
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({
              data: {
                pipeline_source: 'reply_v2_planner',
                features: {
                  runtime_preflight_status: 'timeout',
                },
              },
            })),
          })),
        })),
      });

      const result = await shouldAllowReply(ancestry, {
        decision_id: 'test-decision-id',
      });

      expect(result.allow).toBe(false);
      expect(result.deny_reason_code).toBe('ANCESTRY_UNCERTAIN');
    });

    it('should always block INVALID ancestry status', async () => {
      const ancestry: ReplyAncestry = {
        targetTweetId: '1234567890',
        targetInReplyToTweetId: null,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'ERROR',
        confidence: 'LOW',
        method: 'explicit_signals',
        error: 'INVALID',
      };

      // Mock decision metadata with Reply V2 + runtime_ok
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({
              data: {
                pipeline_source: 'reply_v2_planner',
                features: {
                  runtime_preflight_status: 'ok',
                },
              },
            })),
          })),
        })),
      });

      const result = await shouldAllowReply(ancestry, {
        decision_id: 'test-decision-id',
      });

      expect(result.allow).toBe(false);
      expect(result.deny_reason_code).toBe('ANCESTRY_ERROR');
    });
  });
});
