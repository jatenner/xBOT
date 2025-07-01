import { QualityGate } from '../src/utils/qualityGate';

describe('QualityGate', () => {
  let qualityGate: QualityGate;

  beforeEach(() => {
    qualityGate = new QualityGate();
  });

  describe('Hashtag Prohibition', () => {
    it('should reject tweets with hashtags', async () => {
      const testCases = [
        'Great news about #AI in healthcare!',
        'This is amazing #health #tech #innovation',
        'Stanford study shows 94% accuracy #MedTech',
        'Trending: #HealthAI #Innovation #Future'
      ];

      for (const content of testCases) {
        const result = await qualityGate.checkQuality(content);
        expect(result.passesGate).toBe(false);
        expect(result.hasHashtags).toBe(true);
        expect(result.failureReasons).toContain('Hashtags prohibited for human voice - content must be hashtag-free');
      }
    });

    it('should accept tweets without hashtags', async () => {
      const validContent = 'Stanford researchers achieved 94% accuracy in their latest AI diagnostic study, published in Nature Medicine. This breakthrough could revolutionize early disease detection.';
      const result = await qualityGate.checkQuality(validContent);
      expect(result.hasHashtags).toBe(false);
      // Note: May still fail other quality checks, but hashtags shouldn't be the issue
    });
  });

  describe('Dangling Percent Rejection', () => {
    it('should reject tweets ending with dangling percent', async () => {
      const testCases = [
        'New study shows improvement of 94%',
        'AI accuracy increased to 87%',
        'Healthcare costs reduced by 23%',
        'Patient satisfaction at 91%'
      ];

      for (const content of testCases) {
        const result = await qualityGate.checkQuality(content);
        expect(result.passesGate).toBe(false);
        expect(result.failureReasons.some(reason => 
          reason.includes('dangling percent') || 
          reason.includes('lacks specificity') ||
          reason.includes('percentage') ||
          reason.includes('context')
        )).toBe(true);
      }
    });

    it('should accept tweets with percentages in proper context', async () => {
      const validContent = 'Stanford researchers achieved 94% accuracy in their AI diagnostic model, according to a new study published in Nature Medicine. The breakthrough could transform early disease detection.';
      const result = await qualityGate.checkQuality(validContent);
      // Should pass the dangling percent check (may fail other checks)
      expect(result.failureReasons.some(reason => 
        reason.includes('dangling percent')
      )).toBe(false);
    });
  });

  describe('Percentage-Only Content', () => {
    it('should reject percentage-only tweets', async () => {
      const testCases = [
        '94%',
        '  87%  ',
        '23%',
        '100%'
      ];

      for (const content of testCases) {
        const result = await qualityGate.checkQuality(content);
        expect(result.passesGate).toBe(false);
        expect(result.failureReasons.some(reason => 
          reason.includes('percentage-only') ||
          reason.includes('lacks specificity') ||
          reason.includes('coherence')
        )).toBe(true);
      }
    });
  });

  describe('Content Coherence', () => {
    it('should reject nonsensical content', async () => {
      const testCases = [
        'Random words AI health',
        'Plot twist: Your smartwatch is now smarter',
        'Thoughts? Amazing breakthrough!',
        'word word word word word word'
      ];

      for (const content of testCases) {
        const result = await qualityGate.checkQuality(content);
        expect(result.passesGate).toBe(false);
      }
    });

    it('should accept coherent professional content', async () => {
      const validContent = 'Harvard Medical School researchers developed an AI system that can detect early-stage Alzheimer\'s with 91% accuracy using routine brain scans. The study, published in Nature Neuroscience, analyzed over 10,000 patients across five years.';
      const result = await qualityGate.checkQuality(validContent);
      
      // Should pass basic coherence checks
      expect(result.readabilityScore).toBeGreaterThan(0);
      expect(result.factCount).toBeGreaterThan(0);
      expect(result.characterCount).toBeGreaterThan(30);
    });
  });

  describe('Professional Standards', () => {
    it('should require minimum length', async () => {
      const shortContent = 'AI is good';
      const result = await qualityGate.checkQuality(shortContent);
      expect(result.passesGate).toBe(false);
    });

    it('should require complete sentences', async () => {
      const incompleteContent = 'AI healthcare something...';
      const result = await qualityGate.checkQuality(incompleteContent);
      expect(result.passesGate).toBe(false);
    });

    it('should require health/tech relevance', async () => {
      const irrelevantContent = 'I had a great lunch today at the restaurant with friends and family';
      const result = await qualityGate.checkQuality(irrelevantContent);
      expect(result.passesGate).toBe(false);
    });
  });
}); 