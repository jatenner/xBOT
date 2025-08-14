/**
 * Tests for enhanced tweet linter with format-aware validation
 */

import { lintAndSplitThread, LintResult } from '../src/utils/tweetLinter';
import { FinalFormat } from '../src/utils/formatSanitizer';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('Tweet Linter', () => {
  
  describe('lintAndSplitThread', () => {
    
    describe('single format', () => {
      it('does not trim singles under 279 chars', () => {
        const shortTweet = 'This is a short health tip about exercise that is under 279 characters.';
        const { tweets, reasons } = lintAndSplitThread([shortTweet], 'single');
        
        expect(tweets).toHaveLength(1);
        expect(tweets[0]).toBe(shortTweet);
        expect(reasons).not.toContain('trim');
      });

      it('trims singles over 279 chars at word boundary', () => {
        const longTweet = 'This is a very long health tip about exercise and nutrition that exceeds 279 characters and should be trimmed at a word boundary to ensure it fits within the Twitter character limit for single tweets without breaking words in the middle of sentences which would look unprofessional.';
        const { tweets, reasons } = lintAndSplitThread([longTweet], 'single');
        
        expect(tweets).toHaveLength(1);
        expect(tweets[0].length).toBeLessThanOrEqual(279);
        expect(reasons).toContain('trim');
        expect(tweets[0]).not.toMatch(/\w-$/); // Should not end mid-word
      });

      it('respects TWEET_MAX_CHARS_HARD environment variable', () => {
        process.env.TWEET_MAX_CHARS_HARD = '250';
        const tweet = 'A'.repeat(260);
        const { tweets } = lintAndSplitThread([tweet], 'single');
        
        expect(tweets[0].length).toBeLessThanOrEqual(250);
      });

      it('reduces emojis only if above EMOJI_MAX', () => {
        process.env.EMOJI_MAX = '2';
        const emojiTweet = 'Health tip 😊🌟💪🎯 with four emojis!';
        const { tweets, reasons } = lintAndSplitThread([emojiTweet], 'single');
        
        const emojiCount = (tweets[0].match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
        expect(emojiCount).toBeLessThanOrEqual(2);
        expect(reasons).toContain('emoji_reduce');
      });

      it('keeps emojis under EMOJI_MAX limit', () => {
        process.env.EMOJI_MAX = '3';
        const emojiTweet = 'Health tip 😊🌟 with two emojis!';
        const { tweets, reasons } = lintAndSplitThread([emojiTweet], 'single');
        
        expect(tweets[0]).toContain('😊');
        expect(tweets[0]).toContain('🌟');
        expect(reasons).not.toContain('emoji_reduce');
      });

      it('removes all hashtags when FORCE_NO_HASHTAGS=true', () => {
        process.env.FORCE_NO_HASHTAGS = 'true';
        const hashtagTweet = 'Great #health tip about #nutrition and #wellness!';
        const { tweets, reasons } = lintAndSplitThread([hashtagTweet], 'single');
        
        expect(tweets[0]).not.toContain('#health');
        expect(tweets[0]).not.toContain('#nutrition');
        expect(tweets[0]).not.toContain('#wellness');
        expect(reasons).toContain('hashtags_removed');
      });

      it('emits correct log format for single', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const testTweet = 'Test health tip for logging';
        
        lintAndSplitThread([testTweet], 'single');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/^LINTER: format=single, tweets=\d+, t1_chars=\d+, actions=\[.*\]$/)
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('thread format', () => {
      it('applies 240 char limit to T1 (before-the-fold)', () => {
        const longT1 = 'A'.repeat(250) + ' This should be trimmed as it exceeds 240 chars for T1';
        const shortT2 = 'Second tweet is fine';
        const { tweets } = lintAndSplitThread([longT1, shortT2], 'thread');
        
        expect(tweets[0].length).toBeLessThanOrEqual(240);
        expect(tweets[1]).toBe(shortT2);
      });

      it('applies 270 char limit to T2+ tweets', () => {
        const t1 = 'First tweet under 240 chars';
        const longT2 = 'A'.repeat(275) + ' This T2 should be trimmed to 270 chars max';
        const { tweets } = lintAndSplitThread([t1, longT2], 'thread');
        
        expect(tweets[0]).toBe(t1);
        expect(tweets[1].length).toBeLessThanOrEqual(270);
      });

      it('trims thread tweets at word boundary only', () => {
        const longTweets = [
          'First tweet that is exactly long enough to trigger word boundary trimming at two hundred and forty characters exactly which should trim properly',
          'Second tweet that is also long enough to trigger the two hundred and seventy character limit for T2+ tweets and should also trim at word boundary'
        ];
        const { tweets } = lintAndSplitThread(longTweets, 'thread');
        
        // Should not end with partial words
        expect(tweets[0]).not.toMatch(/\w-$/);
        expect(tweets[1]).not.toMatch(/\w-$/);
      });

      it('preserves emojis in bullet points and parentheticals', () => {
        const bulletTweet = '• Exercise daily 💪\n• Eat healthy 🥗\n• Get sleep 😴';
        const parentheticalTweet = 'Health tips (😊 important note) for everyone';
        
        const { tweets: bulletResult } = lintAndSplitThread([bulletTweet], 'thread');
        const { tweets: parenResult } = lintAndSplitThread([parentheticalTweet], 'thread');
        
        expect(bulletResult[0]).toContain('💪');
        expect(bulletResult[0]).toContain('🥗');
        expect(parenResult[0]).toContain('😊');
      });

      it('emits correct log format for thread', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const testTweets = ['First tweet', 'Second tweet'];
        
        lintAndSplitThread(testTweets, 'thread');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/^LINTER: format=thread, tweets=2, t1_chars=\d+, actions=\[.*\]$/)
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('longform_single format', () => {
      it('treats longform as single for character limits', () => {
        process.env.TWEET_MAX_CHARS_HARD = '279';
        const longformTweet = 'A'.repeat(285) + ' longform content';
        const { tweets } = lintAndSplitThread([longformTweet], 'longform_single');
        
        expect(tweets[0].length).toBeLessThanOrEqual(279);
      });
    });

    describe('error handling', () => {
      it('throws error for non-array input', () => {
        expect(() => {
          lintAndSplitThread('not an array' as any, 'single');
        }).toThrow('LINTER_INPUT_MUST_BE_ARRAY');
      });

      it('throws error for empty array', () => {
        expect(() => {
          lintAndSplitThread([], 'single');
        }).toThrow('NO_TWEETS_ARRAY_ABORT');
      });

      it('throws error for whitespace-only tweets', () => {
        expect(() => {
          lintAndSplitThread(['   ', '  '], 'single');
        }).toThrow('THREAD_ABORT_LINT_FAIL');
      });
    });

    describe('validation rules', () => {
      it('validates single tweet length against TWEET_MAX_CHARS_HARD', () => {
        process.env.TWEET_MAX_CHARS_HARD = '100';
        const longTweet = 'A'.repeat(200); // No spaces, cannot be trimmed properly
        
        expect(() => {
          lintAndSplitThread([longTweet], 'single');
        }).toThrow('THREAD_ABORT_LINT_FAIL');
      });

      it('validates thread T1 against 240 char limit', () => {
        const veryLongT1 = 'A'.repeat(400); // No spaces, too long to trim properly
        
        expect(() => {
          lintAndSplitThread([veryLongT1], 'thread');
        }).toThrow('THREAD_ABORT_LINT_FAIL');
      });

      it('validates thread T2+ against 270 char limit', () => {
        const t1 = 'Valid first tweet';
        const veryLongT2 = 'A'.repeat(450); // No spaces, too long to trim properly
        
        expect(() => {
          lintAndSplitThread([t1, veryLongT2], 'thread');
        }).toThrow('THREAD_ABORT_LINT_FAIL');
      });
    });

    describe('environment variable defaults', () => {
      it('uses default TWEET_MAX_CHARS_HARD of 279', () => {
        delete process.env.TWEET_MAX_CHARS_HARD;
        const tweet = 'A'.repeat(280);
        const { tweets } = lintAndSplitThread([tweet], 'single');
        
        expect(tweets[0].length).toBeLessThanOrEqual(279);
      });

      it('uses default EMOJI_MAX of 2', () => {
        delete process.env.EMOJI_MAX;
        const emojiTweet = 'Test 😊🌟💪 with three emojis';
        const { tweets, reasons } = lintAndSplitThread([emojiTweet], 'single');
        
        const emojiCount = (tweets[0].match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
        expect(emojiCount).toBeLessThanOrEqual(2);
        expect(reasons).toContain('emoji_reduce');
      });

      it('uses default FORCE_NO_HASHTAGS of false', () => {
        delete process.env.FORCE_NO_HASHTAGS;
        const hashtagTweet = 'Test #health hashtag';
        const { tweets, reasons } = lintAndSplitThread([hashtagTweet], 'single');
        
        expect(tweets[0]).toContain('#health');
        expect(reasons).not.toContain('hashtags_removed');
      });
    });

    describe('logging output', () => {
      it('logs actions correctly', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        process.env.EMOJI_MAX = '1';
        process.env.FORCE_NO_HASHTAGS = 'true';
        
        const complexTweet = 'This is a very long health tip with emojis 😊🌟💪 and #health #nutrition hashtags that will trigger all three actions because it is long enough to be trimmed and exceeds the character limit for tweets which means the linter will need to apply trimming functionality to keep it under the maximum allowed character count for a single tweet';
        lintAndSplitThread([complexTweet], 'single');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/LINTER: format=single, tweets=1, t1_chars=\d+, actions=\[trim\|emoji_reduce\|hashtags_removed\]/)
        );
        
        consoleSpy.mockRestore();
      });

      it('logs "none" when no actions taken', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const cleanTweet = 'Simple health tip';
        
        lintAndSplitThread([cleanTweet], 'single');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/actions=\[none\]/)
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('interface compatibility', () => {
      it('returns LintResult with correct structure', () => {
        const result = lintAndSplitThread(['Test tweet'], 'single');
        
        expect(result).toHaveProperty('tweets');
        expect(result).toHaveProperty('reasons');
        expect(Array.isArray(result.tweets)).toBe(true);
        expect(Array.isArray(result.reasons)).toBe(true);
      });

      it('maintains backward compatibility with optional format parameter', () => {
        const result = lintAndSplitThread(['Test tweet']);
        
        expect(result).toHaveProperty('tweets');
        expect(result).toHaveProperty('reasons');
        expect(result.tweets).toHaveLength(1);
      });
    });
  });
});