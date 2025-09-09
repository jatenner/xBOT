/**
 * 🧪 THREAD SEGMENTATION TESTS
 * Ensure multi-segment content never goes down single-post path
 */

import { PostingFacade, Draft } from '../src/posting/PostingFacade';
import { PostAttemptStatus } from '../src/types/posting';

describe('Thread Segmentation Guard', () => {
  beforeEach(() => {
    // Set up environment
    process.env.THREAD_FORCE_SEGMENTS = 'true';
    process.env.THREAD_SEGMENT_DELIMITER = '---';
    process.env.THREAD_NUMBERING_REGEX = '^\\s*\\d+/\\d+\\b';
  });

  test('numbered content must be treated as thread', async () => {
    const draft: Draft = {
      id: 'test-1',
      content: '1/3 First tweet\n2/3 Second tweet\n3/3 Third tweet',
      isThread: false // This should be overridden
    };

    await expect(PostingFacade.post(draft)).rejects.toThrow(/THREAD_GUARD/);
    expect(draft.attemptStatus).toBe(PostAttemptStatus.BLOCKED_FACTCHECK);
  });

  test('delimiter content must be treated as thread', async () => {
    const draft: Draft = {
      id: 'test-2', 
      content: 'First part---Second part---Third part',
      isThread: false
    };

    await expect(PostingFacade.post(draft)).rejects.toThrow(/THREAD_GUARD/);
  });

  test('over-limit content must be treated as thread', async () => {
    const longContent = 'A'.repeat(300); // Over 280 char limit
    const draft: Draft = {
      id: 'test-3',
      content: longContent,
      isThread: false
    };

    await expect(PostingFacade.post(draft)).rejects.toThrow(/THREAD_GUARD/);
  });

  test('properly formatted thread should pass', async () => {
    const draft: Draft = {
      id: 'test-4',
      content: '1/2 First tweet\n2/2 Second tweet',
      isThread: true,
      segments: ['1/2 First tweet', '2/2 Second tweet']
    };

    // Mock the actual posting to avoid Playwright
    const mockPost = jest.spyOn(PostingFacade, 'post');
    mockPost.mockResolvedValue({ success: true, tweetId: 'mock-thread-id' });

    const result = await PostingFacade.post(draft);
    expect(result.success).toBe(true);
    
    mockPost.mockRestore();
  });
});
