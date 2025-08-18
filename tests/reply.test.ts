/**
 * Tests for ReplyEngine contextuality and length limits
 * Verifies replies include quoted details and adhere to ≤220 char limit
 */

import { ReplyEngine } from '../src/reply/replyEngine';

describe('ReplyEngine', () => {
  let replyEngine: ReplyEngine;

  beforeEach(() => {
    replyEngine = new ReplyEngine();
  });

  describe('Contextuality Requirements', () => {
    it('should include specific details from the original tweet', async () => {
      const originalTweet = 'I tried intermittent fasting for 30 days and lost 15 pounds. The hunger was intense the first week but got easier.';
      
      const result = await replyEngine.generateReply(originalTweet);
      
      const replyLower = result.selectedReply.toLowerCase();
      const originalLower = originalTweet.toLowerCase();
      
      // Should reference specific details from original
      const hasSpecificReference = 
        replyLower.includes('intermittent fasting') ||
        replyLower.includes('30 days') ||
        replyLower.includes('15 pounds') ||
        replyLower.includes('first week') ||
        replyLower.includes('hunger');
      
      expect(hasSpecificReference).toBe(true);
      expect(result.analysis.healthRelevance).toBeGreaterThan(0.4);
    });

    it('should maintain context with sleep-related tweets', async () => {
      const sleepTweet = 'Been struggling with insomnia for months. Tried melatonin but it makes me groggy the next day.';
      
      const result = await replyEngine.generateReply(sleepTweet);
      
      const replyLower = result.selectedReply.toLowerCase();
      
      // Should reference sleep-specific details
      const hasSleepContext = 
        replyLower.includes('insomnia') ||
        replyLower.includes('melatonin') ||
        replyLower.includes('groggy') ||
        replyLower.includes('sleep');
      
      expect(hasSleepContext).toBe(true);
      expect(result.analysis.keyTopics).toContain('sleep');
    });

    it('should reference exercise details from fitness tweets', async () => {
      const fitnessTweet = 'Started doing push-ups every morning. Went from 10 to 50 in 2 months. Simple but effective.';
      
      const result = await replyEngine.generateReply(fitnessTweet);
      
      const replyLower = result.selectedReply.toLowerCase();
      
      // Should reference specific fitness details
      const hasFitnessContext = 
        replyLower.includes('push-ups') ||
        replyLower.includes('morning') ||
        replyLower.includes('10') ||
        replyLower.includes('50') ||
        replyLower.includes('2 months');
      
      expect(hasFitnessContext).toBe(true);
    });
  });

  describe('Character Limit Compliance', () => {
    it('should keep replies ≤220 characters', async () => {
      const tweets = [
        'I drink green tea every morning for antioxidants and energy.',
        'Meditation helped reduce my stress and improve focus significantly.',
        'Walking 10,000 steps daily transformed my energy levels completely.',
        'Meal prep on Sundays saves time and helps me eat healthier foods.',
        'Cold showers wake me up better than coffee and boost my mood.'
      ];

      for (const tweet of tweets) {
        const result = await replyEngine.generateReply(tweet);
        
        expect(result.selectedReply.length).toBeLessThanOrEqual(220);
        expect(result.selectedReply.length).toBeGreaterThan(10); // Not too short either
        
        // All alternatives should also comply
        for (const alt of result.alternatives) {
          expect(alt.length).toBeLessThanOrEqual(220);
        }
      }
    });

    it('should truncate overly long replies gracefully', async () => {
      // Create a mock reply that would be too long
      const longTweet = 'I have been struggling with maintaining consistent sleep patterns and energy levels throughout the day, especially when dealing with work stress and family responsibilities that require my attention.';
      
      const result = await replyEngine.generateReply(longTweet);
      
      expect(result.selectedReply.length).toBeLessThanOrEqual(220);
      
      // Should not end abruptly mid-word if truncated
      if (result.selectedReply.length === 220) {
        expect(result.selectedReply).toMatch(/\.\.\.$|[.!?]$/);
      }
    });
  });

  describe('Health Relevance Filtering', () => {
    it('should accept health-relevant tweets', async () => {
      const healthTweets = [
        'My sleep quality improved after cutting caffeine.',
        'Started taking vitamin D and feel more energetic.',
        'Stress eating is ruining my health goals.',
        'Morning workouts boost my energy all day.',
        'Hydration makes such a difference in focus.'
      ];

      for (const tweet of healthTweets) {
        await expect(replyEngine.generateReply(tweet)).resolves.toBeDefined();
      }
    });

    it('should reject non-health-relevant tweets', async () => {
      const nonHealthTweets = [
        'Just watched a great movie about space exploration.',
        'The weather is really nice today for a change.',
        'Programming is challenging but rewarding work.',
        'My cat does the funniest things in the morning.',
        'Traffic was terrible during my commute today.'
      ];

      for (const tweet of nonHealthTweets) {
        await expect(replyEngine.generateReply(tweet))
          .rejects
          .toThrow('Tweet not health-relevant enough for reply');
      }
    });
  });

  describe('Reply Style Appropriateness', () => {
    it('should use helpful_pointer style for sharing info', async () => {
      const infoTweet = 'Green tea has so many antioxidants and helps with focus.';
      
      const result = await replyEngine.generateReply(infoTweet);
      
      // Should build on the shared information
      expect(result.selectedReply).toMatch(/(good|great|building|also|research)/i);
      expect(result.reasoning).toContain('style');
    });

    it('should use supportive style for struggles/complaints', async () => {
      const struggleTweet = 'Been struggling with low energy for weeks. Nothing seems to help.';
      
      const result = await replyEngine.generateReply(struggleTweet);
      
      // Should be supportive and helpful
      expect(result.selectedReply).not.toMatch(/(wrong|bad|terrible)/i);
      expect(result.analysis.intent).toBe('complaining');
    });

    it('should use questioning style for questions', async () => {
      const questionTweet = 'What time should I stop drinking coffee to avoid sleep issues?';
      
      const result = await replyEngine.generateReply(questionTweet);
      
      // Should provide helpful answer or follow-up question
      expect(result.selectedReply).toMatch(/(coffee|caffeine|sleep|hours|afternoon)/i);
      expect(result.analysis.postType).toBe('question');
    });
  });

  describe('Safety Guardrails', () => {
    it('should avoid medical advice language', async () => {
      const tweets = [
        'Having chest pains and shortness of breath lately.',
        'My depression has been getting worse recently.',
        'Experiencing weird heart palpitations during exercise.'
      ];

      for (const tweet of tweets) {
        try {
          const result = await replyEngine.generateReply(tweet);
          
          // If reply is generated, should not contain medical advice
          const replyLower = result.selectedReply.toLowerCase();
          expect(replyLower).not.toMatch(/(diagnose|cure|treat|prescribe|medical advice)/);
          expect(replyLower).not.toMatch(/(you should|you must|always|never)/);
        } catch (error) {
          // May reject due to low health relevance, which is also acceptable
          expect(error.message).toContain('not health-relevant enough');
        }
      }
    });

    it('should use cautious language with health concerns', async () => {
      const concernTweet = 'Feeling dizzy and nauseous after my workouts lately.';
      
      try {
        const result = await replyEngine.generateReply(concernTweet);
        
        // Should suggest consulting professionals for concerning symptoms
        const replyLower = result.selectedReply.toLowerCase();
        expect(replyLower).toMatch(/(might|could|consider|doctor|professional)/);
        expect(replyLower).not.toMatch(/(definitely|absolutely|certainly|guaranteed)/);
      } catch (error) {
        // Acceptable to reject concerning medical tweets
        expect(error.message).toContain('not health-relevant enough');
      }
    });
  });

  describe('Tweet Analysis', () => {
    it('should correctly identify post types', async () => {
      const testCases = [
        { tweet: 'How much protein should I eat daily?', expectedType: 'question' },
        { tweet: 'I lost 20 pounds with intermittent fasting.', expectedType: 'story' },
        { tweet: 'Studies show 8 hours of sleep improves cognitive function.', expectedType: 'data' },
        { tweet: 'The keto diet is a total scam and doesn\'t work.', expectedType: 'hot_take' }
      ];

      for (const { tweet, expectedType } of testCases) {
        try {
          const result = await replyEngine.generateReply(tweet);
          expect(result.analysis.postType).toBe(expectedType);
        } catch (error) {
          // Skip if not health-relevant enough
          if (!error.message.includes('not health-relevant enough')) {
            throw error;
          }
        }
      }
    });

    it('should calculate health relevance scores accurately', async () => {
      const testCases = [
        { tweet: 'Sleep deprivation affects cognitive performance and memory.', minScore: 0.6 },
        { tweet: 'My morning coffee routine helps me start the day right.', minScore: 0.3 },
        { tweet: 'The weather is nice today for outdoor activities.', maxScore: 0.3 }
      ];

      for (const { tweet, minScore, maxScore } of testCases) {
        try {
          const result = await replyEngine.generateReply(tweet);
          
          if (minScore) {
            expect(result.analysis.healthRelevance).toBeGreaterThanOrEqual(minScore);
          }
          if (maxScore) {
            expect(result.analysis.healthRelevance).toBeLessThanOrEqual(maxScore);
          }
        } catch (error) {
          // If rejection due to low health relevance, that's expected for some cases
          if (maxScore && error.message.includes('not health-relevant enough')) {
            // This is expected for low health relevance tweets
            continue;
          }
          throw error;
        }
      }
    });
  });

  describe('Emoji and Formatting Limits', () => {
    it('should use 0-1 emojis maximum', async () => {
      const tweets = [
        'Morning stretches help reduce back pain significantly.',
        'Drinking more water improved my skin and energy.',
        'Consistent bedtime routine changed my sleep quality.'
      ];

      for (const tweet of tweets) {
        const result = await replyEngine.generateReply(tweet);
        
        // Count emojis in reply
        const emojiCount = (result.selectedReply.match(/[\u{1f300}-\u{1f9ff}]/gu) || []).length;
        expect(emojiCount).toBeLessThanOrEqual(1);
      }
    });

    it('should avoid hashtags in replies', async () => {
      const tweet = 'Green smoothies give me energy for morning workouts.';
      
      const result = await replyEngine.generateReply(tweet);
      
      expect(result.selectedReply).not.toMatch(/#\w+/);
      
      // Check alternatives too
      for (const alt of result.alternatives) {
        expect(alt).not.toMatch(/#\w+/);
      }
    });
  });
});