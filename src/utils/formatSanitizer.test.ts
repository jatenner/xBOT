/**
 * Tests for format-aware sanitizer
 */

import { 
  sanitizeForFormat, 
  stripThreadPhrases, 
  stripLeadingNumbering, 
  containsThreadLanguage,
  getSanitizationSummary,
  FinalFormat 
} from './formatSanitizer';

describe('Format Sanitizer', () => {
  
  describe('sanitizeForFormat', () => {
    
    describe('single format', () => {
      it('removes thread emoji 🧵', () => {
        const input = '🧵 This is a great health tip for you!';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('🧵');
        expect(result).toBe('This is a great health tip for you!');
      });

      it('removes "follow this thread" language', () => {
        const input = 'Great health tips! Follow this thread for more insights.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('follow this thread');
        expect(result).toContain('Great health tips!');
      });

      it('removes numbering patterns like 1/7', () => {
        const input = '1/7 Sleep is crucial for your health and wellbeing.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('1/7');
        expect(result).toBe('Sleep is crucial for your health and wellbeing.');
      });

      it('removes parenthetical numbering (1/7)', () => {
        const input = '(1/7) Vitamin D deficiency is more common than you think.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('(1/7)');
        expect(result).toBe('Vitamin D deficiency is more common than you think.');
      });

      it('removes leading numbering 1.', () => {
        const input = '1. Exercise regularly to improve your cardiovascular health.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toMatch(/^\d+\./);
        expect(result).toBe('Exercise regularly to improve your cardiovascular health.');
      });

      it('removes "see next tweet" language', () => {
        const input = 'Important health info here. See next tweet for details.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('see next tweet');
        expect(result).toContain('Important health info here.');
      });

      it('removes 👇 when used as read below indicator', () => {
        const input = 'Health benefits of meditation 👇';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('👇');
        expect(result).toBe('Health benefits of meditation');
      });

      it('removes "continued" language', () => {
        const input = 'Stress management techniques... continued in next post.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('continued');
        expect(result).toContain('Stress management techniques');
      });

      it('fixes capitalization after removal', () => {
        const input = '1. exercise is important for health.';
        const result = sanitizeForFormat(input, 'single');
        expect(result).toBe('Exercise is important for health.');
      });

      it('handles multiple patterns in one text', () => {
        const input = '🧵 1/5 Follow this thread for health tips! See next tweet 👇';
        const result = sanitizeForFormat(input, 'single');
        expect(result).not.toContain('🧵');
        expect(result).not.toContain('1/5');
        expect(result).not.toContain('follow this thread');
        expect(result).not.toContain('see next tweet');
        expect(result).not.toContain('👇');
        expect(result).toContain('health tips');
      });
    });

    describe('thread format', () => {
      it('removes forced numbering but keeps natural content', () => {
        const input = '1/7 Sleep hygiene is essential for good health.';
        const result = sanitizeForFormat(input, 'thread');
        expect(result).not.toContain('1/7');
        expect(result).toBe('Sleep hygiene is essential for good health.');
      });

      it('keeps natural content unchanged except numbering', () => {
        const input = 'Meditation has many benefits for stress reduction.';
        const result = sanitizeForFormat(input, 'thread');
        expect(result).toBe('Meditation has many benefits for stress reduction.');
      });

      it('removes leading numbering patterns', () => {
        const input = '2.) Drink plenty of water throughout the day.';
        const result = sanitizeForFormat(input, 'thread');
        expect(result).toBe('Drink plenty of water throughout the day.');
      });
    });

    describe('longform_single format', () => {
      it('treats text like single format for sanitization', () => {
        const input = '🧵 1/1 This is a longform post with thread language.';
        const result = sanitizeForFormat(input, 'longform_single');
        expect(result).not.toContain('🧵');
        expect(result).not.toContain('1/1');
        expect(result).toBe('This is a longform post with thread language.');
      });
    });
  });

  describe('stripThreadPhrases', () => {
    it('removes thread emoji', () => {
      const input = 'Health tip 🧵 coming up!';
      const result = stripThreadPhrases(input);
      expect(result).not.toContain('🧵');
    });

    it('removes thread language case-insensitively', () => {
      const input = 'Follow This Thread for more health tips!';
      const result = stripThreadPhrases(input);
      expect(result).not.toContain('Follow This Thread');
    });

    it('removes multiple thread patterns', () => {
      const input = '🧵 Thread about health. See next tweet for more!';
      const result = stripThreadPhrases(input);
      expect(result).not.toContain('🧵');
      expect(result).not.toContain('thread');
      expect(result).not.toContain('see next tweet');
    });
  });

  describe('stripLeadingNumbering', () => {
    it('removes leading numbered lists', () => {
      const input = '1. First health tip\n2. Second health tip';
      const result = stripLeadingNumbering(input);
      expect(result).not.toMatch(/^\d+\./);
      expect(result).toContain('First health tip');
    });

    it('removes parenthetical numbering', () => {
      const input = '(2/5) Important nutrition information here.';
      const result = stripLeadingNumbering(input);
      expect(result).toBe('Important nutrition information here.');
    });

    it('removes slash numbering', () => {
      const input = '3/ Exercise recommendations for beginners.';
      const result = stripLeadingNumbering(input);
      expect(result).toBe('Exercise recommendations for beginners.');
    });
  });

  describe('containsThreadLanguage', () => {
    it('detects thread emoji', () => {
      expect(containsThreadLanguage('Health tips 🧵')).toBe(true);
    });

    it('detects follow this thread', () => {
      expect(containsThreadLanguage('Follow this thread for more')).toBe(true);
    });

    it('detects numbering patterns', () => {
      expect(containsThreadLanguage('1/7 Health tip')).toBe(true);
      expect(containsThreadLanguage('(2/5) Nutrition info')).toBe(true);
    });

    it('detects thread language case-insensitively', () => {
      expect(containsThreadLanguage('THREAD about health')).toBe(true);
    });

    it('returns false for clean content', () => {
      expect(containsThreadLanguage('Simple health tip about exercise')).toBe(false);
    });
  });

  describe('getSanitizationSummary', () => {
    it('identifies thread emoji removal', () => {
      const original = '🧵 Health tip';
      const sanitized = 'Health tip';
      const summary = getSanitizationSummary(original, sanitized);
      expect(summary).toContain('thread_emoji');
    });

    it('identifies numbering removal', () => {
      const original = '1/7 Health advice';
      const sanitized = 'Health advice';
      const summary = getSanitizationSummary(original, sanitized);
      expect(summary).toContain('numbering');
    });

    it('identifies thread CTA removal', () => {
      const original = 'Health tips! Follow this thread for more.';
      const sanitized = 'Health tips!';
      const summary = getSanitizationSummary(original, sanitized);
      expect(summary).toContain('thread_cta');
    });

    it('identifies thread language removal', () => {
      const original = 'Thread about nutrition';
      const sanitized = 'About nutrition';
      const summary = getSanitizationSummary(original, sanitized);
      expect(summary).toContain('thread_language');
    });

    it('identifies content trimming', () => {
      const original = 'Long health content here';
      const sanitized = 'Short content';
      const summary = getSanitizationSummary(original, sanitized);
      expect(summary).toContain('content_trimmed');
    });

    it('returns none for no changes', () => {
      const content = 'Simple health tip';
      const summary = getSanitizationSummary(content, content);
      expect(summary).toEqual(['none']);
    });

    it('returns multiple actions when multiple changes made', () => {
      const original = '🧵 1/7 Follow this thread about health';
      const sanitized = 'About health';
      const summary = getSanitizationSummary(original, sanitized);
      expect(summary.length).toBeGreaterThan(1);
      expect(summary).toContain('thread_emoji');
      expect(summary).toContain('numbering');
      expect(summary).toContain('thread_cta');
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      expect(sanitizeForFormat('', 'single')).toBe('');
      expect(sanitizeForFormat('   ', 'single')).toBe('');
    });

    it('handles whitespace-only input', () => {
      expect(sanitizeForFormat('   \n  \t  ', 'single')).toBe('');
    });

    it('preserves essential punctuation', () => {
      const input = '1. Health tip: drink water! It\'s important.';
      const result = sanitizeForFormat(input, 'single');
      expect(result).toBe('Health tip: drink water! It\'s important.');
    });

    it('handles complex mixed content', () => {
      const input = '🧵 (1/7) Sleep thread: 8 hours is optimal. Follow this thread for tips! See next tweet 👇';
      const result = sanitizeForFormat(input, 'single');
      expect(result).not.toContain('🧵');
      expect(result).not.toContain('(1/7)');
      expect(result).not.toContain('follow this thread');
      expect(result).not.toContain('see next tweet');
      expect(result).not.toContain('👇');
      expect(result).toContain('Sleep');
      expect(result).toContain('8 hours is optimal');
    });
  });
});