/**
 * Quality Gate Tests
 * Validates safety checks and medical claim detection
 */

import { QualityGate } from '../src/content/qualityGate';

describe('QualityGate', () => {
  let qualityGate: QualityGate;
  
  beforeEach(() => {
    qualityGate = new QualityGate();
  });

  describe('Medical Claims Detection', () => {
    test('should block unsafe medical phrasing', async () => {
      const unsafePhrases = [
        'This will cure your diabetes',
        'Take this supplement to treat depression',
        'This therapy eliminates cancer',
        'Never take medication for anxiety',
        'This diet fixes autoimmune disorders'
      ];
      
      for (const phrase of unsafePhrases) {
        const result = await qualityGate.evaluateThread([phrase]);
        
        expect(result.passed).toBe(false);
        expect(result.score.safetyScore).toBeLessThan(0.8);
        expect(result.rationale).toContain('Safety concerns');
      }
    });

    test('should allow safe wellness content', async () => {
      const safeContent = [
        'Getting 7-8 hours of sleep can improve energy levels',
        'Regular exercise supports overall wellness',
        'Eating more vegetables provides essential nutrients',
        'Stress management techniques like meditation may help with relaxation'
      ];
      
      for (const content of safeContent) {
        const result = await qualityGate.evaluateThread([content]);
        
        expect(result.score.safetyScore).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe('Hook Strength Evaluation', () => {
    test('should favor specific, numbered hooks', async () => {
      const strongHooks = [
        'I fixed my 2pm energy crash by changing 1 morning habit',
        'The 3 mistakes everyone makes with sleep hygiene:',
        'Why everything you know about metabolism is wrong:'
      ];
      
      const weakHooks = [
        'Hey everyone, let me talk about health today',
        'Some tips for better wellness',
        'Today I want to discuss nutrition'
      ];
      
      for (const hook of strongHooks) {
        const result = await qualityGate.evaluateThread([hook]);
        expect(result.score.hookStrength).toBeGreaterThan(0.6);
      }
      
      for (const hook of weakHooks) {
        const result = await qualityGate.evaluateThread([hook]);
        expect(result.score.hookStrength).toBeLessThan(0.5);
      }
    });
  });

  describe('Specificity Assessment', () => {
    test('should reward specific, actionable content', async () => {
      const specificContent = [
        'Walk for 10 minutes within 30 minutes of waking up',
        'Eat 2 servings of vegetables with each meal',
        'Set a 90-minute sleep window starting at 10pm'
      ];
      
      const vagueContent = [
        'Exercise more often',
        'Eat healthier foods',
        'Get better sleep'
      ];
      
      for (const content of specificContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.specificity).toBeGreaterThan(0.6);
      }
      
      for (const content of vagueContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.specificity).toBeLessThan(0.5);
      }
    });
  });

  describe('Jargon Level Detection', () => {
    test('should penalize excessive technical language', async () => {
      const jargonyContent = [
        'Circadian rhythm optimization through photobiological interventions affects hypothalamic-pituitary-adrenal axis homeostasis'
      ];
      
      const accessibleContent = [
        'Morning sunlight helps regulate your natural sleep-wake cycle and stress response'
      ];
      
      for (const content of jargonyContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.jargonScore).toBeGreaterThan(0.5);
      }
      
      for (const content of accessibleContent) {
        const result = await qualityGate.evaluateThread([content]);
        expect(result.score.jargonScore).toBeLessThan(0.3);
      }
    });
  });

  describe('Reply Contextuality', () => {
    test('should reward contextual replies', async () => {
      const originalTweet = 'Struggling with afternoon energy crashes around 2pm every day';
      
      const contextualReply = 'The 2pm crash often relates to cortisol patterns. Have you tried eating protein with lunch to stabilize blood sugar?';
      const genericReply = 'Great post! Thanks for sharing your experience with energy management.';
      
      const contextualResult = await qualityGate.evaluateReply(contextualReply, originalTweet);
      const genericResult = await qualityGate.evaluateReply(genericReply, originalTweet);
      
      expect(contextualResult.score.contextuality).toBeGreaterThan(genericResult.score.contextuality);
      expect(contextualResult.score.overallScore).toBeGreaterThan(genericResult.score.overallScore);
    });

    test('should detect acknowledgment patterns', async () => {
      const originalTweet = 'Morning sunlight exposure changed my sleep quality dramatically';
      
      const acknowledgedReply = 'You\'re right about sunlight being crucial. The circadian timing aspect is especially important for sleep quality.';
      const unacknowledgedReply = 'Sleep is important for health and wellness. Try going to bed earlier.';
      
      const acknowledgedResult = await qualityGate.evaluateReply(acknowledgedReply, originalTweet);
      const unacknowledgedResult = await qualityGate.evaluateReply(unacknowledgedReply, originalTweet);
      
      expect(acknowledgedResult.score.contextuality).toBeGreaterThan(unacknowledgedResult.score.contextuality);
    });
  });

  describe('Overall Quality Thresholds', () => {
    test('should pass high-quality content', async () => {
      const highQualityThread = [
        'I eliminated my 3pm energy crashes by fixing 1 morning mistake:',
        'The problem: eating breakfast within 30 minutes of waking.',
        'Step 1: Wait 90-120 minutes after waking before eating',
        'Step 2: Start with protein (20-30g) and healthy fats',
        'Step 3: Track energy levels at 2pm, 4pm, and 6pm for 1 week',
        'Research shows cortisol peaks naturally in the morning - eating too early disrupts this pattern.',
        'Common mistake: having fruit or pastries first thing - this causes blood sugar spikes.',
        'What\'s your biggest energy challenge between 2-4pm?'
      ];
      
      const result = await qualityGate.evaluateThread(highQualityThread);
      
      expect(result.passed).toBe(true);
      expect(result.score.overallScore).toBeGreaterThan(0.7);
    });

    test('should fail low-quality content', async () => {
      const lowQualityThread = [
        'Health is important',
        'You should eat good food',
        'Exercise more',
        'Sleep better'
      ];
      
      const result = await qualityGate.evaluateThread(lowQualityThread);
      
      expect(result.passed).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('Improvement Suggestions', () => {
    test('should provide actionable feedback', async () => {
      const improvableContent = [
        'Some people say that sometimes you might want to maybe try exercising more often to generally improve your overall health and wellness in various ways'
      ];
      
      const result = await qualityGate.evaluateThread(improvableContent);
      
      expect(result.passed).toBe(false);
      expect(result.suggestions).toBeDefined();
      
      const suggestions = result.suggestions!.join(' ');
      expect(suggestions).toMatch(/specific|numbers|timeframes|instructions/i);
    });
  });
});
