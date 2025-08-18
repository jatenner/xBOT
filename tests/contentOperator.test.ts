/**
 * Tests for Social Content Operator system
 */

import { SocialContentOperator } from '../src/content/SocialContentOperator';
import { ContentOrchestrator } from '../src/content/ContentOrchestrator';
import { getBrandProfile, healthPerformanceBrand } from '../src/content/brandProfiles';

describe('Social Content Operator', () => {
  let operator: SocialContentOperator;
  let orchestrator: ContentOrchestrator;

  beforeEach(() => {
    operator = new SocialContentOperator(healthPerformanceBrand);
    orchestrator = new ContentOrchestrator('health');
  });

  describe('Brand Profiles', () => {
    it('should load health brand profile', () => {
      const brand = getBrandProfile('health');
      expect(brand.identity.description).toContain('health');
      expect(brand.constraints.maxEmojis).toBe(1);
      expect(brand.constraints.allowHashtags).toBe(false);
    });

    it('should load productivity brand profile', () => {
      const brand = getBrandProfile('productivity');
      expect(brand.identity.description).toContain('productivity');
      expect(brand.lexicon.preferredWords).toContain('system');
    });

    it('should load mindfulness brand profile', () => {
      const brand = getBrandProfile('mindfulness');
      expect(brand.identity.description).toContain('mindfulness');
      expect(brand.lexicon.preferredWords).toContain('awareness');
    });
  });

  describe('Content Generation', () => {
    it('should generate single posts', async () => {
      const seeds = [{ topic: 'sleep optimization', priority: 'high' as const }];
      const contentPack = await operator.generateContentPack(seeds, [], [], []);
      
      expect(contentPack.singles).toHaveLength(1);
      expect(contentPack.singles[0]).toBeTruthy();
      expect(contentPack.singles[0].length).toBeGreaterThan(10);
      expect(contentPack.singles[0].length).toBeLessThanOrEqual(240);
    });

    it('should generate threads with proper structure', async () => {
      const seeds = [{ topic: 'energy management', priority: 'high' as const }];
      const contentPack = await operator.generateContentPack(seeds, [], [], []);
      
      expect(contentPack.threads).toHaveLength(2);
      expect(contentPack.threads[0].tweets.length).toBeGreaterThanOrEqual(5);
      expect(contentPack.threads[0].tweets.length).toBeLessThanOrEqual(9);
      
      // Each tweet should be within character limit
      contentPack.threads[0].tweets.forEach(tweet => {
        expect(tweet.length).toBeLessThanOrEqual(220);
        expect(tweet.length).toBeGreaterThan(0);
      });
    });

    it('should follow brand constraints', async () => {
      const seeds = [{ topic: 'health tips', priority: 'medium' as const }];
      const contentPack = await operator.generateContentPack(seeds, [], [], []);
      
      // Check no hashtags
      const allContent = [
        ...contentPack.singles,
        ...contentPack.threads.flatMap(t => t.tweets)
      ].join(' ');
      
      expect(allContent).not.toMatch(/#\w+/);
      
      // Check emoji limit (≤1 per post)
      const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      
      contentPack.singles.forEach(single => {
        const emojiCount = (single.match(emojiRegex) || []).length;
        expect(emojiCount).toBeLessThanOrEqual(1);
      });
    });

    it('should generate quality replies with quoted details', async () => {
      const targetPosts = [{
        author: 'HealthSeeker',
        handle: '@healthseeker',
        url: '',
        content: 'Struggling with energy levels throughout the day. Any tips for maintaining consistent energy?',
        quotedDetail: 'energy levels throughout the day',
        stance: 'add_nuance' as const,
        goal: 'Provide helpful advice'
      }];

      const contentPack = await operator.generateContentPack([], [], targetPosts, []);
      
      expect(contentPack.replies).toHaveLength(1);
      expect(contentPack.replies[0].response).toBeTruthy();
      expect(contentPack.replies[0].response.length).toBeLessThanOrEqual(220);
      expect(contentPack.replies[0].quotedDetail).toBe('energy levels throughout the day');
    });
  });

  describe('Content Orchestrator Integration', () => {
    it('should generate single post via orchestrator', async () => {
      const result = await orchestrator.generateContent({
        type: 'single',
        topic: 'morning routines',
        brandType: 'health'
      });

      expect(result.type).toBe('single');
      expect(result.content).toHaveLength(1);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.metadata.topic).toBe('morning routines');
      expect(result.metadata.brandType).toBe('health');
    });

    it('should generate thread via orchestrator', async () => {
      const result = await orchestrator.generateContent({
        type: 'thread',
        topic: 'sleep optimization',
        brandType: 'health'
      });

      expect(result.type).toBe('thread');
      expect(result.content.length).toBeGreaterThanOrEqual(5);
      expect(result.content.length).toBeLessThanOrEqual(9);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.metadata.template).toBeTruthy();
    });

    it('should generate reply via orchestrator', async () => {
      const result = await orchestrator.generateContent({
        type: 'reply',
        targetPost: {
          content: 'Looking for tips on better sleep quality',
          author: 'SleepSeeker',
          context: 'better sleep quality'
        },
        brandType: 'health'
      });

      expect(result.type).toBe('reply');
      expect(result.content).toHaveLength(1);
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('should validate content properly', async () => {
      const goodContent = ['This specific tip helped me sleep better: keep your room at exactly 67°F. The cool temperature signals your body to produce melatonin naturally.'];
      const validation = await orchestrator.validateContent(goodContent, 'single');

      expect(validation.score).toBeGreaterThan(0);
      expect(typeof validation.isValid).toBe('boolean');
      expect(Array.isArray(validation.issues)).toBe(true);
      expect(Array.isArray(validation.suggestions)).toBe(true);
    });

    it('should provide brand guidelines', () => {
      const guidelines = orchestrator.getBrandGuidelines('health');

      expect(Array.isArray(guidelines.voice)).toBe(true);
      expect(Array.isArray(guidelines.constraints)).toBe(true);
      expect(Array.isArray(guidelines.preferredTopics)).toBe(true);
      expect(Array.isArray(guidelines.avoidedTopics)).toBe(true);
      
      expect(guidelines.voice.length).toBeGreaterThan(0);
      expect(guidelines.constraints.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Analysis', () => {
    it('should analyze past performance and provide insights', async () => {
      const mockPosts = [
        {
          id: 'post1',
          date: '2024-01-15',
          type: 'single' as const,
          hook: 'I fixed my sleep in 2 weeks',
          content: 'I fixed my sleep in 2 weeks. Here\'s how...',
          metrics: { likes: 100, replies: 20, reposts: 15, bookmarks: 50, views: 2000 }
        },
        {
          id: 'post2',
          date: '2024-01-14',
          type: 'single' as const,
          hook: 'Generic health tips',
          content: 'Here are some general health tips...',
          metrics: { likes: 10, replies: 2, reposts: 1, bookmarks: 5, views: 200 }
        }
      ];

      const suggestions = await orchestrator.getContentSuggestions(mockPosts);

      expect(suggestions.recommendedTopics).toBeTruthy();
      expect(suggestions.avoidPatterns).toBeTruthy();
      expect(suggestions.nextExperiments).toBeTruthy();
      
      expect(Array.isArray(suggestions.recommendedTopics)).toBe(true);
      expect(Array.isArray(suggestions.avoidPatterns)).toBe(true);
      expect(Array.isArray(suggestions.nextExperiments)).toBe(true);
    });
  });

  describe('Content Quality', () => {
    it('should prefer specific over generic content', async () => {
      const seeds = [{ topic: 'exercise', priority: 'high' as const }];
      const contentPack = await operator.generateContentPack(seeds, [], [], []);
      
      const content = contentPack.singles[0];
      
      // Should avoid generic phrases
      expect(content.toLowerCase()).not.toMatch(/generally|usually|often|sometimes/);
      expect(content.toLowerCase()).not.toMatch(/everyone should|you should always/);
      
      // Should include specific elements
      const hasNumbers = /\d+/.test(content);
      const hasSpecificAdvice = /try|do|start|set|measure/i.test(content);
      
      expect(hasNumbers || hasSpecificAdvice).toBe(true);
    });

    it('should include actionable steps', async () => {
      const seeds = [{ topic: 'productivity hacks', priority: 'high' as const }];
      const productivityOperator = new SocialContentOperator(getBrandProfile('productivity'));
      const contentPack = await productivityOperator.generateContentPack(seeds, [], [], []);
      
      const content = contentPack.singles[0];
      
      // Should include actionable language
      const actionableWords = /try|do|start|stop|set|write|measure|track|create|build/i;
      expect(content).toMatch(actionableWords);
    });

    it('should maintain brand voice consistency', async () => {
      const seeds = [{ topic: 'stress management', priority: 'high' as const }];
      const mindfulnessOperator = new SocialContentOperator(getBrandProfile('mindfulness'));
      const contentPack = await mindfulnessOperator.generateContentPack(seeds, [], [], []);
      
      const content = contentPack.singles[0];
      
      // Should avoid harsh language
      expect(content.toLowerCase()).not.toMatch(/must|should|always|never|wrong|bad/);
      
      // Should include gentle language
      const gentleWords = /might|could|may|consider|explore|notice|awareness/i;
      expect(content).toMatch(gentleWords);
    });
  });
});
