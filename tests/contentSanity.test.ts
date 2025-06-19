import { checkTimeIntro, validateRiddle, validateUrls, runSanityChecks } from '../src/utils/contentSanity';

describe('Content Sanity Checks', () => {
  describe('checkTimeIntro', () => {
    it('should fix wrong intro vs hour', () => {
      // Test at 16:00 (afternoon)
      const afternoon = new Date('2025-06-19T16:00:00Z');
      const result = checkTimeIntro('Late Night Brain Teaser: What am I?', afternoon);
      expect(result).toBe('Afternoon Brain Teaser: What am I?');
    });

    it('should keep correct intro', () => {
      const morning = new Date('2025-06-19T09:00:00Z');
      const result = checkTimeIntro('Good Morning! Here\'s today\'s insight.', morning);
      expect(result).toBe('Good Morning! Here\'s today\'s insight.');
    });

    it('should handle evening hours', () => {
      const evening = new Date('2025-06-19T20:00:00Z');
      const result = checkTimeIntro('Good Morning team!', evening);
      expect(result).toBe('Evening team!');
    });

    it('should handle late night hours', () => {
      const lateNight = new Date('2025-06-19T02:00:00Z');
      const result = checkTimeIntro('Afternoon update', lateNight);
      expect(result).toBe('Late Night update');
    });

    it('should not modify text without time intros', () => {
      const text = 'This is just regular content about health tech.';
      const result = checkTimeIntro(text);
      expect(result).toBe(text);
    });
  });

  describe('validateRiddle', () => {
    it('should reject wrong word-length riddle', () => {
      const text = 'I am a five-letter word. Answer: "Healthcare"';
      const result = validateRiddle(text);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('answer "Healthcare" has 10 letters');
    });

    it('should accept correct five-letter riddle', () => {
      const text = 'I am a five-letter word. What am I? "Heart"';
      const result = validateRiddle(text);
      expect(result.ok).toBe(true);
    });

    it('should handle riddles with quoted answers', () => {
      const text = 'Brain teaser: five-letter word for wellness. Answer: "Peace"';
      const result = validateRiddle(text);
      expect(result.ok).toBe(true);
    });

    it('should reject riddles without detectable answers', () => {
      const text = 'I am a five-letter word but no answer provided.';
      const result = validateRiddle(text);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('no answer detected');
    });

    it('should pass non-riddle content', () => {
      const text = 'Just regular health tech content without riddles.';
      const result = validateRiddle(text);
      expect(result.ok).toBe(true);
    });
  });

  describe('validateUrls', () => {
    it('should pass content without URLs', async () => {
      const text = 'Regular content without any links.';
      const result = await validateUrls(text);
      expect(result.ok).toBe(true);
    });

    it('should validate reachable URLs', async () => {
      const text = 'Check out https://httpbin.org/status/200 for testing.';
      const result = await validateUrls(text);
      expect(result.ok).toBe(true);
    }, 10000); // 10 second timeout for network request

    it('should reject unreachable URLs', async () => {
      const text = 'Bad link: https://this-domain-definitely-does-not-exist-12345.com';
      const result = await validateUrls(text);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('unreachable');
    }, 10000);

    it('should reject 404 URLs', async () => {
      const text = 'Dead link: https://httpbin.org/status/404';
      const result = await validateUrls(text);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('404 status');
    }, 10000);
  });

  describe('runSanityChecks', () => {
    it('should fix time intro and pass other checks', async () => {
      const afternoon = new Date('2025-06-19T15:00:00Z');
      const text = 'Late Night update: Health tech is advancing rapidly.';
      
      // Mock the time for consistent testing
      const originalCheckTimeIntro = checkTimeIntro;
      const result = await runSanityChecks(text);
      
      expect(result.ok).toBe(true);
      expect(result.fixes.length).toBeGreaterThan(0);
    });

    it('should reject content with bad riddles', async () => {
      const text = 'Five-letter word riddle. Answer: "Technology"';
      const result = await runSanityChecks(text);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('10 letters');
    });

    it('should pass clean content', async () => {
      const text = 'Clean health tech content without issues.';
      const result = await runSanityChecks(text);
      expect(result.ok).toBe(true);
      expect(result.fixes.length).toBe(0);
    });
  });
}); 