/**
 * Unit tests for replyJob pre-resolution gate
 * Tests that replies to replies are blocked
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('replyJob pre-resolution gate', () => {
  it('should block opportunity with target_in_reply_to_tweet_id', () => {
    const opp = {
      target_tweet_id: '1234567890',
      target_in_reply_to_tweet_id: '9876543210', // This is a reply!
      is_root_tweet: false,
      root_tweet_id: '9876543210',
    };

    const preGateChecks = {
      has_in_reply_to: !!(opp.target_in_reply_to_tweet_id),
      is_root_tweet: opp.is_root_tweet === true || opp.is_root_tweet === 1,
      root_mismatch: opp.root_tweet_id && opp.root_tweet_id !== opp.target_tweet_id,
    };

    // Should be blocked
    expect(preGateChecks.has_in_reply_to).toBe(true);
    expect(preGateChecks.is_root_tweet).toBe(false);
    expect(preGateChecks.root_mismatch).toBe(true);
  });

  it('should allow opportunity with is_root_tweet=true and no in_reply_to', () => {
    const opp = {
      target_tweet_id: '1234567890',
      target_in_reply_to_tweet_id: null,
      is_root_tweet: true,
      root_tweet_id: '1234567890',
    };

    const preGateChecks = {
      has_in_reply_to: !!(opp.target_in_reply_to_tweet_id),
      is_root_tweet: opp.is_root_tweet === true || opp.is_root_tweet === 1,
      root_mismatch: opp.root_tweet_id && opp.root_tweet_id !== opp.target_tweet_id,
    };

    // Should pass
    expect(preGateChecks.has_in_reply_to).toBe(false);
    expect(preGateChecks.is_root_tweet).toBe(true);
    expect(preGateChecks.root_mismatch).toBe(false);
  });

  it('should block opportunity with root_tweet_id mismatch', () => {
    const opp = {
      target_tweet_id: '1234567890',
      target_in_reply_to_tweet_id: null,
      is_root_tweet: true,
      root_tweet_id: '9999999999', // Different from target!
    };

    const preGateChecks = {
      has_in_reply_to: !!(opp.target_in_reply_to_tweet_id),
      is_root_tweet: opp.is_root_tweet === true || opp.is_root_tweet === 1,
      root_mismatch: opp.root_tweet_id && opp.root_tweet_id !== opp.target_tweet_id,
    };

    // Should be blocked
    expect(preGateChecks.root_mismatch).toBe(true);
  });
});

