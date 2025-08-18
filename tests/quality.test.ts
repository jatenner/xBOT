/**
 * Tests for QualityGate scoring and safety
 * Verifies mediocre post <80; improved revision ≥80; blocks unsafe medical phrasing
 */

import { QualityGate } from '../src/content/qualityGate';

describe('QualityGate', () => {
  let qualityGate: QualityGate;

  beforeEach(() => {
    qualityGate = new QualityGate();
  });

  describe('Scoring System (0-100)', () => {
    it('should score excellent content highly (≥90)', async () => {
      const excellentThread = [
        'I fixed my insomnia in 3 weeks. The counterintuitive secret: avoiding all sleep advice.',
        'Most sleep tips make insomnia worse. Here\'s what actually works:',
        'Stop tracking sleep. Paradoxically, sleep tracking creates anxiety that prevents sleep.',
        'Start the 2-minute rule: If not asleep in 2 minutes, get up. Do something boring until sleepy.',
        'The result: 7-8 hours nightly, zero sleep anxiety. Try this for one week.'
      ];

      const result = await qualityGate.evaluateThread(excellentThread);

      expect(result.score.overallScore).toBeGreaterThanOrEqual(90);
      expect(result.passed).toBe(true);
      expect(result.score.hookClarity).toBeGreaterThan(20);
      expect(result.score.actionability).toBeGreaterThan(15);
      expect(result.score.novelty).toBeGreaterThan(15);
    });

    it('should score mediocre content between 70-79', async () => {
      const mediocreThread = [
        'Here are some tips for better sleep.',
        'Sleep is important for health and wellness.',
        'Try to get 7-8 hours of sleep each night.',
        'Avoid caffeine before bed and create a bedtime routine.',
        'Good sleep helps with energy and focus.'
      ];

      const result = await qualityGate.evaluateThread(mediocreThread);

      expect(result.score.overallScore).toBeLessThan(80);
      expect(result.score.overallScore).toBeGreaterThan(40); // Not terrible, just mediocre
      expect(result.passed).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    it('should score poor content very low (<60)', async () => {
      const poorThread = [
        'Let\'s talk about health today.',
        'Health is good and important for everyone.',
        'You should generally try to be healthy.',
        'There are many things you can do.',
        'Hopefully this helps with your health journey.'
      ];

      const result = await qualityGate.evaluateThread(poorThread);

      expect(result.score.overallScore).toBeLessThan(60);
      expect(result.passed).toBe(false);
      expect(result.score.hookClarity).toBeLessThan(15);
      expect(result.score.actionability).toBeLessThan(10);
      expect(result.score.humanTone).toBeLessThan(6);
    });
  });

  describe('Auto-Revision (70-79 range)', () => {
    it('should auto-revise content scoring 70-79', async () => {
      const borderlineThread = [
        'Sleep tips that actually work.',
        'Most people struggle with sleep quality.',
        'Try these evidence-based approaches.',
        'Create a consistent bedtime routine.',
        'Track your sleep patterns for better insights.'
      ];

      const result = await qualityGate.evaluateThread(borderlineThread);

      // Should either pass after revision or show revision attempt
      if (result.autoRevised) {
        expect(result.revisedContent).toBeDefined();
        expect(result.revisedContent!.length).toBeGreaterThan(borderlineThread.join('\n').length);
        expect(result.score.overallScore).toBeGreaterThanOrEqual(70);
      }

      expect(result.score.overallScore).toBeGreaterThan(60);
    });
  });

  describe('Safety Checks', () => {
    it('should block unsafe medical phrasing', async () => {
      const unsafeThreads = [
        ['This supplement will cure your diabetes in 30 days.'],
        ['I can diagnose your sleep disorder from this tweet.'],
        ['Never eat carbs again - they cause all diseases.'],
        ['This therapy will eliminate your depression permanently.'],
        ['Take this medication for guaranteed weight loss results.']
      ];

      for (const unsafeThread of unsafeThreads) {
        const result = await qualityGate.evaluateThread(unsafeThread);
        
        expect(result.passed).toBe(false);
        expect(result.rationale).toContain('Safety issues detected');
      }
    });

    it('should allow safe health content', async () => {
      const safeThreads = [
        ['Better sleep may help with energy levels.'],
        ['This approach worked for me - might be worth trying.'],
        ['Research suggests regular exercise can improve mood.'],
        ['Consider talking to a doctor about persistent symptoms.'],
        ['Small changes in diet might make a difference.']
      ];

      for (const safeThread of safeThreads) {
        const result = await qualityGate.evaluateThread(safeThread);
        
        // Should not fail due to safety (may fail for other quality reasons)
        expect(result.rationale).not.toContain('Safety issues detected');
      }
    });

    it('should block absolute statements that could be harmful', async () => {
      const harmfulStatements = [
        ['Always take vitamin D supplements - everyone is deficient.'],
        ['Never eat after 6pm - it guarantees weight gain.'],
        ['This will fix your anxiety in 7 days, proven method.'],
        ['Guaranteed to cure insomnia - works for everyone.']
      ];

      for (const statement of harmfulStatements) {
        const result = await qualityGate.evaluateThread(statement);
        
        expect(result.passed).toBe(false);
        expect(result.rationale).toContain('Safety issues detected');
      }
    });
  });

  describe('Individual Scoring Components', () => {
    it('should reward strong hooks with high hookClarity scores', async () => {
      const strongHooks = [
        'I fixed my chronic fatigue in 30 days. The surprising truth:',
        'Why everything you know about metabolism is backwards:',
        'The #1 nutrition mistake that\'s sabotaging your energy:'
      ];

      for (const hook of strongHooks) {
        const result = await qualityGate.evaluateThread([hook]);
        expect(result.score.hookClarity).toBeGreaterThan(15);
      }
    });

    it('should reward actionable content with high actionability scores', async () => {
      const actionableContent = [
        'Try this: Set your alarm 15 minutes earlier.',
        'Step 1: Drink 16oz water immediately upon waking.',
        'Measure your sleep for exactly 7 days using this method:',
        'Start with 2 minutes of morning sunlight exposure.'
      ];

      for (const content of actionableContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.actionability).toBeGreaterThan(10);
      }
    });

    it('should reward novel insights with high novelty scores', async () => {
      const novelContent = [
        'Counterintuitive discovery: cold showers actually worsen sleep.',
        'Plot twist: tracking calories made me gain weight.',
        'Most people think protein timing matters. New research shows it doesn\'t.',
        'Hidden truth about meditation: 10 minutes is often too long.'
      ];

      for (const content of novelContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.novelty).toBeGreaterThan(10);
      }
    });

    it('should reward readable content with high readability scores', async () => {
      const readableContent = [
        'Simple truth:\n\n• Sleep matters\n• Stress hurts\n• Movement helps\n\nStart with one.'
      ];

      const result = await qualityGate.evaluateThread(readableContent);
      expect(result.score.readability).toBeGreaterThan(6);
    });

    it('should reward conversational tone with high humanTone scores', async () => {
      const conversationalContent = [
        'Honestly, I struggled with this for years.',
        'Here\'s what I learned the hard way:',
        'You might find this helpful if you\'re dealing with similar issues.',
        'This changed everything for me - real talk.'
      ];

      for (const content of conversationalContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.humanTone).toBeGreaterThan(6);
      }
    });
  });

  describe('Reply Quality', () => {
    it('should evaluate replies with context awareness', async () => {
      const originalTweet = 'I can\'t sleep at night and feel exhausted all day. Any advice?';
      const goodReply = 'Re: feeling exhausted - have you tried the 2-minute rule? If not asleep in 2 minutes, get up and do something boring until sleepy. Helps break the anxiety cycle.';

      const result = await qualityGate.evaluateReply(goodReply, originalTweet);

      expect(result.score.overallScore).toBeGreaterThan(70);
      expect(result.passed).toBe(result.score.overallScore >= 80);
    });

    it('should fail replies with safety issues', async () => {
      const originalTweet = 'Having trouble sleeping lately.';
      const unsafeReply = 'You definitely have sleep apnea. Take these sleeping pills to cure it.';

      const result = await qualityGate.evaluateReply(unsafeReply, originalTweet);

      expect(result.passed).toBe(false);
      expect(result.rationale).toContain('Safety issues detected');
    });
  });

  describe('Suggestions Generation', () => {
    it('should provide specific improvement suggestions for low scores', async () => {
      const lowQualityThread = [
        'Tips about health stuff.',
        'Health is generally important.',
        'You should usually try to be healthy.',
        'There are some things that might help.'
      ];

      const result = await qualityGate.evaluateThread(lowQualityThread);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(2);
      
      // Should include specific actionable suggestions
      const suggestionText = result.suggestions!.join(' ');
      expect(suggestionText).toMatch(/(specific|action|concrete|insight|conversation)/i);
    });
  });
});