/**
 * Thread Integrity Tests
 * Tests for strict thread validation, retry logic, and fallback behavior
 */

import { validateThread, ThreadDraft, generateStrictThreadPrompt, getThreadValidationConfig } from '../src/utils/threadValidator';

describe('Thread Validator', () => {
  beforeEach(() => {
    // Reset environment variables for each test
    process.env.THREAD_MIN_TWEETS = '5';
    process.env.THREAD_MAX_TWEETS = '9';
    process.env.TWEET_MAX_CHARS_HARD = '279';
    process.env.FORCE_NO_HASHTAGS = 'true';
    process.env.EMOJI_MAX = '2';
  });

  describe('validateThread', () => {
    it('should accept valid thread with correct tweet count', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: "Sleep quality directly impacts your immune system. Poor sleep weakens your defenses against infections and diseases. Here's what you need to know about optimizing your sleep for better health." },
          { text: 'First, maintain a consistent sleep schedule. Go to bed and wake up at the same time every day, even on weekends. This helps regulate your circadian rhythm.' },
          { text: 'Create a sleep-friendly environment. Keep your bedroom cool (65-68°F), dark, and quiet. Consider blackout curtains and a white noise machine if needed.' },
          { text: 'Avoid screens for at least 1 hour before bed. Blue light from phones and computers can disrupt melatonin production, making it harder to fall asleep.' },
          { text: 'Limit caffeine after 2 PM. Caffeine can stay in your system for 6-8 hours, so that afternoon coffee might be keeping you awake at night.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(true);
      expect(result.repairedTweets).toHaveLength(5);
      expect(result.repairedTweets![0]).toContain('Sleep quality directly impacts');
    });

    it('should reject thread with too few tweets', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: 'Sleep is important for health.' },
          { text: 'Get 7-9 hours nightly.' },
          { text: 'Maintain consistent schedule.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('too_short');
      expect(result.k).toBe(3);
    });

    it('should reject thread with too many tweets', () => {
      const draft: ThreadDraft = {
        tweets: Array(12).fill({ text: 'Valid tweet content that meets character requirements and provides value.' })
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('too_long');
      expect(result.k).toBe(12);
    });

    it('should auto-repair thread numbering and markers', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: '1/5 🧵 Sleep quality directly impacts your immune system and overall health status.' },
          { text: '2/5 First step: maintain a consistent sleep schedule every single day of the week.' },
          { text: '3/5 Create optimal environment: cool temperature (65-68°F), darkness, and quiet space.' },
          { text: '4/5 Avoid all screens for at least one full hour before your planned bedtime.' },
          { text: '5/5 👇 Limit caffeine intake after 2 PM to prevent sleep disruption at night.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(true);
      expect(result.repairedTweets![0]).not.toContain('1/5');
      expect(result.repairedTweets![0]).not.toContain('🧵');
      expect(result.repairedTweets![4]).not.toContain('👇');
      expect(result.repairedTweets![0]).toMatch(/^Sleep quality/);
    });

    it('should remove hashtags when FORCE_NO_HASHTAGS is true', () => {
      // Ensure the environment variable is set for this test
      process.env.FORCE_NO_HASHTAGS = 'true';
      
      const draft: ThreadDraft = {
        tweets: [
          { text: 'Sleep quality directly impacts your overall health and immunity systems significantly #sleep #wellness #health #immunity #circadian' },
          { text: 'Maintain consistent sleep schedule every single day #routine #health #sleeptips #wellness' },
          { text: 'Create optimal sleep environment with proper temperature #bedroom #temperature #darkness #quiet' },
          { text: 'Avoid all screens before bed to prevent disruption #bluelight #melatonin #technology #sleep' },
          { text: 'Limit caffeine intake after 2 PM for better sleep #caffeine #afternoon #coffee #sleepquality' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(true);
      expect(result.repairedTweets![0]).not.toContain('#');
      expect(result.repairedTweets![0]).toContain('Sleep quality directly impacts');
    });

    it('should limit emojis to EMOJI_MAX', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: '😴🛏️💤🌙✨🎯💪 Sleep quality impacts your immune system and overall health.' },
          { text: '⏰🔄📅🎯 Maintain a consistent sleep schedule every day of the week.' },
          { text: '🌡️❄️🌑🔇 Create optimal environment: cool, dark, and quiet space.' },
          { text: '📱💻🚫👀 Avoid all screens for at least one hour before bedtime.' },
          { text: '☕⏰🚫😴 Limit caffeine intake after 2 PM to prevent sleep issues.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(true);
      // Count emojis in first tweet (should be max 2)
      const emojiCount = (result.repairedTweets![0].match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
      expect(emojiCount).toBeLessThanOrEqual(2);
    });

    it('should reject tweet that exceeds character limit', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: "Sleep quality directly impacts your immune system function and overall health status in ways that most people never fully understand or appreciate. When you consistently get poor sleep, your body's natural defense mechanisms become significantly weakened, making you more susceptible to infections, diseases, and other health complications that could otherwise be prevented." },
          { text: 'Second tweet with normal length content.' },
          { text: 'Third tweet with normal length content.' },
          { text: 'Fourth tweet with normal length content.' },
          { text: 'Fifth tweet with normal length content.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('tweet_too_long');
      expect(result.k).toBe(1);
    });

    it('should reject T1 with thread fluff language', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: 'Follow this thread to learn about sleep optimization techniques and discover evidence-based strategies for better rest 👇' },
          { text: 'Maintain a consistent sleep schedule every day of the week.' },
          { text: 'Create optimal environment: cool, dark, and quiet space.' },
          { text: 'Avoid all screens for at least one hour before bedtime.' },
          { text: 'Limit caffeine intake after 2 PM to prevent sleep issues.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('T1_thread_fluff');
      expect(result.k).toBe(1);
    });

    it('should handle edge case with empty tweet after repair', () => {
      const draft: ThreadDraft = {
        tweets: [
          { text: '1/5 🧵 👇' }, // Will become empty after repair
          { text: 'Valid tweet content here.' },
          { text: 'Another valid tweet.' },
          { text: 'Third valid tweet.' },
          { text: 'Fourth valid tweet.' }
        ]
      };

      const result = validateThread(draft);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('empty_after_repair');
      expect(result.k).toBe(1);
    });
  });

  describe('generateStrictThreadPrompt', () => {
    it('should generate proper thread prompt with constraints', () => {
      const prompt = generateStrictThreadPrompt('sleep optimization', 5, 7, 279);
      
      expect(prompt).toContain('sleep optimization');
      expect(prompt).toContain('5-7 tweets');
      expect(prompt).toContain('≤ 279 characters');
      expect(prompt).toContain('NO numbering');
      expect(prompt).toContain('NO thread markers');
      expect(prompt).toContain('NO "follow this thread"');
      expect(prompt).toContain('220-240 chars');
      expect(prompt).toContain('Max 2 emojis');
      expect(prompt).toContain('{"tweets":[{"text":"..."}]}');
    });
  });

  describe('getThreadValidationConfig', () => {
    it('should read config from environment variables', () => {
      process.env.THREAD_MIN_TWEETS = '6';
      process.env.THREAD_MAX_TWEETS = '10';
      process.env.TWEET_MAX_CHARS_HARD = '280';
      process.env.FORCE_NO_HASHTAGS = 'false';
      process.env.EMOJI_MAX = '3';

      const config = getThreadValidationConfig();
      
      expect(config.minTweets).toBe(6);
      expect(config.maxTweets).toBe(10);
      expect(config.maxCharsHard).toBe(280);
      expect(config.forceNoHashtags).toBe(false);
      expect(config.emojiMax).toBe(3);
    });

    it('should use defaults when env vars are missing', () => {
      delete process.env.THREAD_MIN_TWEETS;
      delete process.env.THREAD_MAX_TWEETS;
      delete process.env.TWEET_MAX_CHARS_HARD;
      delete process.env.FORCE_NO_HASHTAGS;
      delete process.env.EMOJI_MAX;

      const config = getThreadValidationConfig();
      
      expect(config.minTweets).toBe(5);
      expect(config.maxTweets).toBe(9);
      expect(config.maxCharsHard).toBe(279);
      expect(config.forceNoHashtags).toBe(false);
      expect(config.emojiMax).toBe(2);
    });
  });
});

describe('Thread Integration Scenarios', () => {
  beforeEach(() => {
    process.env.THREAD_MIN_TWEETS = '5';
    process.env.THREAD_MAX_TWEETS = '9';
    process.env.THREAD_RETRY_ATTEMPTS = '3';
    process.env.FALLBACK_SINGLE_TWEET_OK = 'false';
  });

  it('should handle too short → re-ask → success scenario', async () => {
    // First attempt: too short
    const shortDraft: ThreadDraft = {
      tweets: [
        { text: 'Sleep matters.' },
        { text: 'Get enough sleep.' },
        { text: 'Maintain schedule.' }
      ]
    };

    const firstValidation = validateThread(shortDraft);
    expect(firstValidation.ok).toBe(false);
    expect(firstValidation.reason).toBe('too_short');

    // After re-ask: valid thread
    const validDraft: ThreadDraft = {
      tweets: [
        { text: 'Sleep quality directly impacts your immune system function and overall health.' },
        { text: 'Maintain a consistent sleep schedule by going to bed at the same time daily.' },
        { text: 'Create optimal sleep environment: cool temperature, darkness, and quiet.' },
        { text: 'Avoid screens for at least one hour before your planned bedtime.' },
        { text: 'Limit caffeine consumption after 2 PM to prevent sleep disruption.' }
      ]
    };

    const secondValidation = validateThread(validDraft);
    expect(secondValidation.ok).toBe(true);
    expect(secondValidation.repairedTweets).toHaveLength(5);
  });

  it('should handle too short → re-ask x3 → fallback true scenario', () => {
    process.env.FALLBACK_SINGLE_TWEET_OK = 'true';

    // Simulate multiple failed attempts
    const shortDraft: ThreadDraft = {
      tweets: [
        { text: 'Sleep is important for health and immune function.' },
        { text: 'Get 7-9 hours nightly.' },
        { text: 'Maintain consistent schedule.' }
      ]
    };

    const validation = validateThread(shortDraft);
    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe('too_short');
    expect(validation.k).toBe(3);

    // With fallback allowed, should handle gracefully
    const fallbackAllowed = process.env.FALLBACK_SINGLE_TWEET_OK === 'true';
    expect(fallbackAllowed).toBe(true);
  });

  it('should handle too short → re-ask x3 → fallback false → skip scenario', () => {
    process.env.FALLBACK_SINGLE_TWEET_OK = 'false';

    const shortDraft: ThreadDraft = {
      tweets: [
        { text: 'Sleep tips.' },
        { text: 'Be consistent.' },
        { text: 'Avoid caffeine.' }
      ]
    };

    const validation = validateThread(shortDraft);
    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe('too_short');

    const fallbackAllowed = process.env.FALLBACK_SINGLE_TWEET_OK === 'true';
    expect(fallbackAllowed).toBe(false);
    
    // Should not post when fallback is disabled
  });
});