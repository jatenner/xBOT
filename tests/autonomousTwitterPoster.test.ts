/**
 * Tests for autonomous Twitter poster format handling and thread chains
 */

import { AutonomousTwitterPoster } from '../src/agents/autonomousTwitterPoster';
import { Page, BrowserContext } from 'playwright';

// Mock dependencies
jest.mock('../src/utils/tweetLinter');
jest.mock('../src/utils/formatSanitizer');
jest.mock('../src/utils/xLoggedIn');
jest.mock('../src/utils/sessionLoader');
jest.mock('../src/utils/browser');
jest.mock('../src/lib/advancedDatabaseManager');

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.FALLBACK_SINGLE_TWEET_OK = 'false';
  process.env.ENABLE_THREADS = 'true';
  process.env.THREAD_MIN_TWEETS = '5';
  process.env.THREAD_MAX_TWEETS = '9';
  process.env.THREAD_STRICT_REPLY_MODE = 'true';
  jest.clearAllMocks();
});

afterEach(() => {
  process.env = originalEnv;
});

describe('AutonomousTwitterPoster', () => {
  let poster: AutonomousTwitterPoster;
  let mockPage: jest.Mocked<Page>;
  let mockContext: jest.Mocked<BrowserContext>;

  // Mock implementations
  const mockLinter = {
    lintAndSplitThread: jest.fn().mockReturnValue({
      tweets: ['First tweet', 'Second tweet', 'Third tweet', 'Fourth tweet', 'Fifth tweet'],
      reasons: []
    })
  };

  const mockSanitizer = {
    sanitizeForFormat: jest.fn().mockImplementation((text: string) => text),
    containsThreadLanguage: jest.fn().mockReturnValue(false),
    getSanitizationSummary: jest.fn().mockReturnValue(['none'])
  };

  const mockIsLoggedIn = jest.fn().mockResolvedValue(true);
  const mockGetPageWithStorage = jest.fn();
  const mockSaveStorageStateBack = jest.fn();

  beforeEach(() => {
    // Setup mocks
    require('../src/utils/tweetLinter').lintAndSplitThread = mockLinter.lintAndSplitThread;
    require('../src/utils/formatSanitizer').sanitizeForFormat = mockSanitizer.sanitizeForFormat;
    require('../src/utils/formatSanitizer').containsThreadLanguage = mockSanitizer.containsThreadLanguage;
    require('../src/utils/formatSanitizer').getSanitizationSummary = mockSanitizer.getSanitizationSummary;
    require('../src/utils/xLoggedIn').isLoggedIn = mockIsLoggedIn;
    require('../src/utils/browser').getPageWithStorage = mockGetPageWithStorage;
    require('../src/utils/sessionLoader').saveStorageStateBack = mockSaveStorageStateBack;

    // Mock page and context
    mockContext = {
      cookies: jest.fn().mockResolvedValue([{}, {}, {}]) // 3 cookies
    } as any;

    mockPage = {
      goto: jest.fn().mockResolvedValue(null),
      waitForTimeout: jest.fn().mockResolvedValue(null),
      click: jest.fn().mockResolvedValue(null),
      fill: jest.fn().mockResolvedValue(null),
      keyboard: {
        press: jest.fn().mockResolvedValue(null)
      },
      url: jest.fn().mockReturnValue('https://x.com/status/123456789'),
      context: jest.fn().mockReturnValue(mockContext),
      waitForSelector: jest.fn().mockResolvedValue(null),
      locator: jest.fn().mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true)
        })
      })
    } as any;

    mockGetPageWithStorage.mockResolvedValue(mockPage);

    poster = AutonomousTwitterPoster.getInstance();
  });

  describe('postThread', () => {
    it('posts thread as proper reply chain', async () => {
      const tweets = [
        'First tweet about health',
        'Second tweet with more info',
        'Third tweet with details',
        'Fourth tweet with sources',
        'Fifth tweet with CTA'
      ];

      const result = await poster.postThread(tweets, 'thread');

      expect(mockLinter.lintAndSplitThread).toHaveBeenCalledWith(tweets, 'thread');
      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/compose/tweet', expect.any(Object));
      expect(result.rootTweetId).toBe('123456789');
      expect(result.replyIds).toHaveLength(4); // 5 tweets = 1 root + 4 replies
    });

    it('enforces minimum tweet count for threads', async () => {
      const shortTweets = ['First tweet', 'Second tweet']; // Only 2 tweets, need 5
      
      await expect(poster.postThread(shortTweets, 'thread')).rejects.toThrow('THREAD_ABORT');
    });

    it('falls back to single tweet when insufficient content and FALLBACK_SINGLE_TWEET_OK=true', async () => {
      process.env.FALLBACK_SINGLE_TWEET_OK = 'true';
      const shortTweets = ['Only one meaningful tweet'];
      
      const result = await poster.postThread(shortTweets, 'thread');
      
      expect(result.replyIds).toHaveLength(0);
      expect(mockSanitizer.sanitizeForFormat).toHaveBeenCalledWith('Only one meaningful tweet', 'single');
    });

    it('implements proper reply chain with in_reply_to linking', async () => {
      const tweets = ['T1', 'T2', 'T3', 'T4', 'T5'];
      
      // Mock different tweet IDs for each post
      let callCount = 0;
      mockPage.url.mockImplementation(() => {
        const ids = ['123', '124', '125', '126', '127'];
        return `https://x.com/status/${ids[callCount++]}`;
      });

      await poster.postThread(tweets, 'thread');

      // Should navigate to each previous tweet to reply
      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/x/status/123', expect.any(Object)); // Reply to T1
      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/x/status/124', expect.any(Object)); // Reply to T2
      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/x/status/125', expect.any(Object)); // Reply to T3
      expect(mockPage.goto).toHaveBeenCalledWith('https://x.com/x/status/126', expect.any(Object)); // Reply to T4
    });

    it('includes human delays between posts', async () => {
      const tweets = ['T1', 'T2', 'T3', 'T4', 'T5'];
      
      await poster.postThread(tweets, 'thread');

      // Should have delays between 600-1200ms for each reply (4 delays for 5 tweets)
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(expect.any(Number));
      const delays = (mockPage.waitForTimeout as jest.Mock).mock.calls
        .filter(call => call[0] >= 600 && call[0] <= 1200);
      expect(delays.length).toBeGreaterThanOrEqual(4);
    });

    it('handles posting failures with retry logic', async () => {
      const tweets = ['T1', 'T2', 'T3', 'T4', 'T5'];
      
      // Mock failure on first reply attempt, success on second
      let clickAttempts = 0;
      mockPage.click.mockImplementation((selector) => {
        if (selector.includes('reply') && clickAttempts === 0) {
          clickAttempts++;
          throw new Error('First attempt fails');
        }
        return Promise.resolve();
      });

      const result = await poster.postThread(tweets, 'thread');

      expect(result.rootTweetId).toBe('123456789');
      // Should still succeed after retry
    });

    it('aborts thread posting after retry failures', async () => {
      const tweets = ['T1', 'T2', 'T3', 'T4', 'T5'];
      
      // Mock persistent failure
      mockPage.click.mockRejectedValue(new Error('Persistent failure'));

      const result = await poster.postThread(tweets, 'thread');

      // Should return partial results
      expect(result.rootTweetId).toBe('123456789');
      expect(result.replyIds.length).toBeLessThan(4);
    });
  });

  describe('createAndPostContent', () => {
    it('creates and posts content successfully', async () => {
      const mockContentGenerator = {
        generateContent: jest.fn().mockResolvedValue({
          content: 'Generated health content',
          threadParts: null,
          metadata: { topic: 'health' }
        })
      };
      
      require('../src/agents/intelligentContentGenerator').IntelligentContentGenerator.getInstance = jest.fn().mockReturnValue(mockContentGenerator);
      
      const result = await poster.createAndPostContent();

      expect(result.success).toBe(true);
      expect(result.content).toBe('Generated health content');
    });

    it('throws error when not logged in during content posting', async () => {
      mockIsLoggedIn.mockResolvedValue(false);
      
      const mockContentGenerator = {
        generateContent: jest.fn().mockResolvedValue({
          content: 'Test content',
          threadParts: null,
          metadata: { topic: 'health' }
        })
      };
      
      require('../src/agents/intelligentContentGenerator').IntelligentContentGenerator.getInstance = jest.fn().mockReturnValue(mockContentGenerator);

      await expect(poster.createAndPostContent()).rejects.toThrow('POST_SKIPPED_PLAYWRIGHT: login_required');
    });
  });

  describe('format decision logging', () => {
    it('logs format decisions with correct parameters', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await poster.postThread(['T1', 'T2', 'T3', 'T4', 'T5'], 'thread');

      expect(consoleSpy).toHaveBeenCalledWith('FORMAT_DECISION: final=thread, reason=engine, tweets=5');
      
      consoleSpy.mockRestore();
    });

    it('logs thread chain progression', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await poster.postThread(['T1', 'T2', 'T3', 'T4', 'T5'], 'thread');

      expect(consoleSpy).toHaveBeenCalledWith('THREAD_CHAIN: k=1/5, in_reply_to=none');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/THREAD_CHAIN: k=2\/5, in_reply_to=\d+/));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/THREAD_CHAIN: k=3\/5, in_reply_to=\d+/));
      
      consoleSpy.mockRestore();
    });

    it('logs thread abortion when retries fail', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockPage.click.mockRejectedValue(new Error('Persistent failure'));
      
      await poster.postThread(['T1', 'T2', 'T3', 'T4', 'T5'], 'thread');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/THREAD_ABORTED_AFTER: k=\d+, error=.*/));
      
      consoleSpy.mockRestore();
    });
  });

  describe('session management', () => {
    it('saves session cookies after posting', async () => {
      await poster.postThread(['Test tweet'], 'single');

      expect(mockSaveStorageStateBack).toHaveBeenCalledWith(mockContext);
      expect(mockContext.cookies).toHaveBeenCalled();
    });

    it('saves session cookies after thread completion', async () => {
      await poster.postThread(['T1', 'T2', 'T3', 'T4', 'T5'], 'thread');

      expect(mockSaveStorageStateBack).toHaveBeenCalledWith(mockContext);
      expect(mockContext.cookies).toHaveBeenCalled();
    });

    it('saves session cookies even after thread abortion', async () => {
      mockPage.click.mockRejectedValue(new Error('Failure'));
      
      await poster.postThread(['T1', 'T2', 'T3', 'T4', 'T5'], 'thread');

      expect(mockSaveStorageStateBack).toHaveBeenCalledWith(mockContext);
    });
  });

  describe('environment variable handling', () => {
    it('reads FALLBACK_SINGLE_TWEET_OK correctly', async () => {
      process.env.FALLBACK_SINGLE_TWEET_OK = 'true';
      const shortTweets = ['One tweet'];
      
      const result = await poster.postThread(shortTweets, 'thread');
      
      expect(result.replyIds).toHaveLength(0); // Should fall back to single
    });

    it('reads THREAD_MIN_TWEETS correctly', async () => {
      process.env.THREAD_MIN_TWEETS = '3';
      const shortTweets = ['T1', 'T2']; // Less than minimum
      
      await expect(poster.postThread(shortTweets, 'thread')).rejects.toThrow('THREAD_ABORT');
    });

    it('uses default values when env vars missing', async () => {
      delete process.env.THREAD_MIN_TWEETS;
      delete process.env.FALLBACK_SINGLE_TWEET_OK;
      
      const shortTweets = ['T1', 'T2', 'T3']; // Less than default minimum of 4
      
      // Should still work because FALLBACK_SINGLE_TWEET_OK defaults to true
      const result = await poster.postThread(shortTweets, 'thread');
      expect(result).toBeDefined();
    });
  });
});