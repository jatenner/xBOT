/**
 * Unit tests for resolveRootTweetId
 * Tests fail-closed behavior and reply detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveRootTweetId } from '../src/utils/resolveRootTweet';

// Mock UnifiedBrowserPool
vi.mock('../src/browser/UnifiedBrowserPool', () => {
  return {
    UnifiedBrowserPool: {
      getInstance: () => ({
        acquirePage: vi.fn(),
        releasePage: vi.fn(),
      }),
    },
  };
});

describe('resolveRootTweetId', () => {
  let mockPage: any;
  let mockPool: any;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
    };

    const { UnifiedBrowserPool } = await import('../src/browser/UnifiedBrowserPool');
    mockPool = UnifiedBrowserPool.getInstance();
    vi.mocked(mockPool.acquirePage).mockResolvedValue(mockPage);
    vi.mocked(mockPool.releasePage).mockResolvedValue(undefined);
  });

  it('should return isRootTweet=true for root tweet', async () => {
    // Mock: No reply indicators found
    mockPage.evaluate.mockResolvedValueOnce({
      isReply: false,
      checks: [
        { signal: 'replying_to_text', found: false },
        { signal: 'social_context', found: false },
        { signal: 'main_article_reply_indicator', found: false },
        { signal: 'multiple_articles', found: false },
      ],
    });

    // Mock: Verification passes
    mockPage.evaluate.mockResolvedValueOnce({
      verified: true,
      articleTweetId: '1234567890',
      author: 'testuser',
      content: 'This is a root tweet',
    });

    const result = await resolveRootTweetId('1234567890');

    expect(result.isRootTweet).toBe(true);
    expect(result.rootTweetId).toBe('1234567890');
    expect(result.originalTweetId).toBe('1234567890');
  });

  it('should return isRootTweet=false for reply tweet', async () => {
    // Mock: Reply indicators found
    mockPage.evaluate.mockResolvedValueOnce({
      isReply: true,
      checks: [
        { signal: 'replying_to_text', found: true, details: 'Replying to @user' },
        { signal: 'social_context', found: false },
        { signal: 'main_article_reply_indicator', found: false },
        { signal: 'multiple_articles', found: true, details: 2 },
      ],
    });

    // Mock: Root tweet extraction
    mockPage.evaluate.mockResolvedValueOnce({
      rootId: '9876543210',
      author: 'rootuser',
      content: 'This is the root tweet',
    });

    const result = await resolveRootTweetId('1234567890');

    expect(result.isRootTweet).toBe(false);
    expect(result.rootTweetId).toBe('9876543210');
    expect(result.originalTweetId).toBe('1234567890');
  });

  it('should fail-closed (isRootTweet=false) when verification fails', async () => {
    // Mock: No reply indicators found
    mockPage.evaluate.mockResolvedValueOnce({
      isReply: false,
      checks: [
        { signal: 'replying_to_text', found: false },
        { signal: 'social_context', found: false },
        { signal: 'main_article_reply_indicator', found: false },
        { signal: 'multiple_articles', found: false },
      ],
    });

    // Mock: Verification fails
    mockPage.evaluate.mockResolvedValueOnce({
      verified: false,
      reason: 'no_main_article',
    });

    const result = await resolveRootTweetId('1234567890');

    expect(result.isRootTweet).toBe(false);
    expect(result.rootTweetId).toBe(null); // Fail-closed: null
  });

  it('should fail-closed (isRootTweet=false) when root extraction fails', async () => {
    // Mock: Reply indicators found
    mockPage.evaluate.mockResolvedValueOnce({
      isReply: true,
      checks: [
        { signal: 'replying_to_text', found: true },
      ],
    });

    // Mock: Root extraction fails (null rootId)
    mockPage.evaluate.mockResolvedValueOnce({
      rootId: null,
      author: null,
      content: null,
    });

    const result = await resolveRootTweetId('1234567890');

    expect(result.isRootTweet).toBe(false);
    expect(result.rootTweetId).toBe(null); // Fail-closed: null
  });

  it('should fail-closed (isRootTweet=false) on error', async () => {
    // Mock: Error during page evaluation
    mockPage.evaluate.mockRejectedValueOnce(new Error('Network error'));

    const result = await resolveRootTweetId('1234567890');

    expect(result.isRootTweet).toBe(false);
    expect(result.rootTweetId).toBe(null); // Fail-closed: null
  });

  it('should fail-closed when rootId equals tweetId (edge case)', async () => {
    // Mock: Reply indicators found
    mockPage.evaluate.mockResolvedValueOnce({
      isReply: true,
      checks: [{ signal: 'replying_to_text', found: true }],
    });

    // Mock: Root extraction returns same ID (should not happen, but fail-closed)
    mockPage.evaluate.mockResolvedValueOnce({
      rootId: '1234567890', // Same as tweetId
      author: 'testuser',
      content: 'Tweet content',
    });

    const result = await resolveRootTweetId('1234567890');

    // Should still return isRootTweet=false because reply indicators were found
    expect(result.isRootTweet).toBe(false);
    expect(result.rootTweetId).toBe('1234567890');
  });
});

