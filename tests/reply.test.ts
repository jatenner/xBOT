/**
 * Reply Engine Tests
 * Validates contextual reply generation and word inclusion
 */

import { ReplyEngine } from '../src/reply/replyEngine';

describe('ReplyEngine', () => {
  let replyEngine: ReplyEngine;
  
  beforeEach(() => {
    replyEngine = new ReplyEngine();
  });

  describe('Contextual Reply Generation', () => {
    test('should include nouns from source tweet', async () => {
      const context = {
        text: 'Sleep quality affects metabolism and energy levels throughout the day',
        authorHandle: 'healthexpert',
        authorBio: 'Sleep researcher and wellness coach'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should include at least one key noun from the original tweet
      const keyNouns = ['sleep', 'metabolism', 'energy'];
      const hasKeyNoun = keyNouns.some(noun => 
        reply.toLowerCase().includes(noun)
      );
      
      expect(hasKeyNoun).toBe(true);
    });

    test('should respect character limit', async () => {
      const context = {
        text: 'This is a very long tweet about nutrition and exercise and sleep and recovery and all sorts of health topics that could lead to a very long reply',
        authorHandle: 'user',
        authorBio: 'Fitness enthusiast'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      expect(reply.length).toBeLessThanOrEqual(240);
    });

    test('should acknowledge health accounts appropriately', async () => {
      const context = {
        text: 'Circadian rhythm disruption affects cortisol patterns',
        authorHandle: 'drhealthdoc',
        authorBio: 'MD, sleep medicine specialist',
        followerCount: 50000
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should not be too casual with medical professionals
      expect(reply).not.toMatch(/^hey|^lol|^omg/i);
      
      // Should acknowledge the scientific content
      const hasAcknowledgment = /this aligns|great point|circadian|cortisol/i.test(reply);
      expect(hasAcknowledgment).toBe(true);
    });

    test('should adapt language for non-health accounts', async () => {
      const context = {
        text: 'Always tired in the afternoon, any tips?',
        authorHandle: 'regularuser',
        followerCount: 150
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should use accessible language, not medical jargon
      expect(reply).not.toMatch(/circadian|mitochondrial|homeostasis/i);
      
      // Should address their specific issue
      expect(reply.toLowerCase()).toMatch(/afternoon|tired|energy/);
    });
  });

  describe('Content Mirroring', () => {
    test('should mirror key terms from original tweet', async () => {
      const context = {
        text: 'Meditation helped reduce my stress and improve focus',
        authorHandle: 'mindfuluser'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should reference their specific experience
      const hasMirroring = /meditation|stress|focus/i.test(reply);
      expect(hasMirroring).toBe(true);
    });

    test('should avoid generic responses', async () => {
      const context = {
        text: 'Starting a new workout routine this week',
        authorHandle: 'fitnessbegineer'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should avoid completely generic responses
      expect(reply).not.toMatch(/^great post!|^thanks for sharing|^interesting$/i);
      
      // Should reference their specific situation
      expect(reply.toLowerCase()).toMatch(/workout|routine|start/);
    });
  });

  describe('Safety and Appropriateness', () => {
    test('should avoid medical advice', async () => {
      const context = {
        text: 'Having trouble sleeping, what medication should I take?',
        authorHandle: 'insomniac_user'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should not give medical advice
      expect(reply).not.toMatch(/take|medication|prescribe|mg|dosage/i);
      
      // Should suggest general approaches instead
      expect(reply.toLowerCase()).toMatch(/sleep|routine|habits|doctor/);
    });

    test('should maintain professional tone for health topics', async () => {
      const context = {
        text: 'Struggling with anxiety and panic attacks',
        authorHandle: 'anxious_person'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should be supportive but not dismissive
      expect(reply).not.toMatch(/just relax|get over it|it's easy/i);
      
      // Should acknowledge their experience
      expect(reply.toLowerCase()).toMatch(/anxiety|understand|experience|support/);
    });
  });

  describe('Question and CTA Integration', () => {
    test('should include specific questions, not yes/no', async () => {
      const context = {
        text: 'Trying intermittent fasting for weight loss',
        authorHandle: 'diet_experimenter'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Should have a question that invites discussion
      const hasSpecificQuestion = /what|how|which|when.*\?/i.test(reply);
      expect(hasSpecificQuestion).toBe(true);
      
      // Should avoid yes/no questions
      expect(reply).not.toMatch(/do you|are you|is it.*\?$/i);
    });

    test('should relate questions to the original topic', async () => {
      const context = {
        text: 'Morning sunlight exposure changed my energy levels',
        authorHandle: 'biohacker'
      };
      
      const reply = await replyEngine.generateReply(context);
      
      // Question should relate to their specific topic
      const hasRelatedQuestion = /sunlight|morning|energy|light.*\?/i.test(reply);
      expect(hasRelatedQuestion).toBe(true);
    });
  });

  describe('Account Type Detection', () => {
    test('should detect health accounts from bio', async () => {
      const contexts = [
        {
          text: 'New research on sleep',
          authorHandle: 'sleepresearcher',
          authorBio: 'PhD in Sleep Medicine, Harvard Medical School'
        },
        {
          text: 'Nutrition tips',
          authorHandle: 'nutritionist_rd',
          authorBio: 'Registered Dietitian, 20 years experience'
        }
      ];
      
      for (const context of contexts) {
        const reply = await replyEngine.generateReply(context);
        
        // Should use more professional language for health professionals
        expect(reply).not.toMatch(/^wow|^cool|amazing/i);
        expect(reply.length).toBeGreaterThan(50); // More substantial responses
      }
    });
  });
});
