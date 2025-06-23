import { UltraViralGenerator } from '../src/agents/ultraViralGenerator';
import { TrendResearchFusion } from '../src/agents/trendResearchFusion';
import { QualityGate } from '../src/utils/qualityGate';

describe('Viral Composer System', () => {
  let viralGenerator: UltraViralGenerator;
  let qualityGate: QualityGate;

  beforeEach(() => {
    viralGenerator = new UltraViralGenerator();
    qualityGate = new QualityGate();
  });

  describe('URL and Citation Requirements', () => {
    test('should include URL in generated content', async () => {
      const tweet = await viralGenerator.generateViralTweet('AI diagnostics');
      
      expect(tweet.hasUrl || tweet.url).toBeTruthy();
      expect(
        /https?:\/\/[^\s]+/.test(tweet.content) || Boolean(tweet.url)
      ).toBeTruthy();
    });

    test('should include citation for PhD_THREAD template', async () => {
      const tweet = await viralGenerator.generateViralTweet('precision medicine', 'PHD_THREAD');
      
      expect(
        tweet.citation || 
        /\([^)]*20\d{2}[^)]*\)/.test(tweet.content) ||
        /\([^)]*nature[^)]*\)/i.test(tweet.content)
      ).toBeTruthy();
    });

    test('should include citation for BREAKING_NEWS template', async () => {
      const tweet = await viralGenerator.generateViralTweet('gene therapy', 'BREAKING_NEWS');
      
      expect(
        tweet.citation || 
        /\([^)]*20\d{2}[^)]*\)/.test(tweet.content) ||
        /\([^)]*stanford[^)]*\)/i.test(tweet.content)
      ).toBeTruthy();
    });
  });

  describe('Character Count Limits', () => {
    test('should respect 280 character limit', async () => {
      const tweet = await viralGenerator.generateViralTweet('digital therapeutics');
      
      expect(tweet.characterCount).toBeLessThanOrEqual(280);
      expect(tweet.content.length).toBeLessThanOrEqual(280);
    });

    test('should respect template-specific character limits', async () => {
      const quickStat = await viralGenerator.generateViralTweet('wearable health', 'QUICK_STAT');
      expect(quickStat.characterCount).toBeLessThanOrEqual(200);

      const visualSnack = await viralGenerator.generateViralTweet('health apps', 'VISUAL_SNACK');
      expect(visualSnack.characterCount).toBeLessThanOrEqual(180);
    });
  });

  describe('Quality Gate Integration', () => {
    test('should pass quality gate checks', async () => {
      const content = `🚨 JUST IN: Stanford AI achieves 94% accuracy in cancer detection

This breakthrough could save millions of lives annually

(Nature, 2024)`;
      
      const metrics = await qualityGate.checkQuality(
        content, 
        'https://nature.com/ai-cancer-detection', 
        'Nature'
      );

      expect(metrics.passesGate).toBeTruthy();
      expect(metrics.readabilityScore).toBeGreaterThanOrEqual(45);
      expect(metrics.factCount).toBeGreaterThanOrEqual(2);
      expect(metrics.sourceCredibility).toBeGreaterThanOrEqual(0.8);
    });

    test('should reject low-quality content', async () => {
      const lowQualityContent = `wow ai is cool`;
      
      const metrics = await qualityGate.checkQuality(lowQualityContent);

      expect(metrics.passesGate).toBeFalsy();
      expect(metrics.failureReasons.length).toBeGreaterThan(0);
    });

    test('should count facts correctly', async () => {
      const factualContent = `Stanford study of 10,000 patients shows 87% improvement in early detection using AI diagnostics`;
      
      const metrics = await qualityGate.checkQuality(factualContent);

      expect(metrics.factCount).toBeGreaterThanOrEqual(2); // Numbers + study reference
    });
  });

  describe('Template Variety', () => {
    test('should support all required templates', async () => {
      const templates = ['BREAKING_NEWS', 'PHD_THREAD', 'QUICK_STAT', 'VISUAL_SNACK'];
      
      for (const template of templates) {
        const tweet = await viralGenerator.generateViralTweet('AI healthcare', template);
        expect(tweet.style).toBe(template);
        expect(tweet.content.length).toBeGreaterThan(0);
      }
    });

    test('should generate different content for same topic', async () => {
      const tweet1 = await viralGenerator.generateViralTweet('telemedicine');
      const tweet2 = await viralGenerator.generateViralTweet('telemedicine');
      
      // Should be different content (not exact match)
      expect(tweet1.content).not.toBe(tweet2.content);
    });
  });

  describe('PhD-Level Sophistication', () => {
    test('should use sophisticated vocabulary', async () => {
      const tweet = await viralGenerator.generateViralTweet('precision medicine', 'PHD_THREAD');
      
      const sophisticatedTerms = [
        'paradigm', 'epistemological', 'ontological', 'systematicity',
        'convergence', 'methodology', 'implications', 'framework'
      ];

      const content = tweet.content.toLowerCase();
      const foundTerms = sophisticatedTerms.filter(term => 
        content.includes(term) || content.includes(term.slice(0, -2)) // partial matches
      );

      expect(foundTerms.length).toBeGreaterThanOrEqual(1);
    });

    test('should focus on systemic implications', async () => {
      const tweet = await viralGenerator.generateViralTweet('digital health', 'PHD_THREAD');
      
      const systemicKeywords = [
        'challenges', 'fundamental', 'transform', 'shift', 'implications',
        'system', 'methodology', 'paradigm', 'approach'
      ];

      const content = tweet.content.toLowerCase();
      const foundKeywords = systemicKeywords.filter(keyword => content.includes(keyword));

      expect(foundKeywords.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Trend Research Fusion', () => {
    test('should create fusion items with required fields', async () => {
      const fusion = new TrendResearchFusion();
      const items = await fusion.generateTrendResearchItems();

      if (items.length > 0) {
        const item = items[0];
        expect(item.id).toBeDefined();
        expect(item.content).toBeDefined();
        expect(item.trendTopic).toBeDefined();
        expect(item.institutionCredibility).toBeGreaterThan(0);
        expect(item.combinedScore).toBeGreaterThan(0);
        expect(Array.isArray(item.keyFacts)).toBeTruthy();
      }
    });
  });

  describe('Integration Test: Full Pipeline', () => {
    test('should generate high-quality viral content with all requirements', async () => {
      const tweet = await viralGenerator.generateViralTweet('AI drug discovery');

      // Basic requirements
      expect(tweet.content).toBeDefined();
      expect(tweet.style).toBeDefined();
      expect(tweet.viralScore).toBeGreaterThan(0);
      expect(tweet.characterCount).toBeLessThanOrEqual(280);

      // URL requirement
      expect(tweet.hasUrl || Boolean(tweet.url)).toBeTruthy();

      // Quality metrics (if available)
      if (tweet.qualityMetrics) {
        expect(tweet.qualityMetrics.readabilityScore).toBeGreaterThanOrEqual(30);
        expect(tweet.qualityMetrics.factCount).toBeGreaterThanOrEqual(1);
      }

      // Content should have substance
      expect(tweet.content.length).toBeGreaterThan(50);
      expect(tweet.content).not.toMatch(/^(wow|cool|nice)/i);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid template gracefully', async () => {
      const tweet = await viralGenerator.generateViralTweet('health tech', 'INVALID_TEMPLATE');
      
      expect(tweet.content).toBeDefined();
      expect(tweet.style).toBeDefined();
      expect(tweet.characterCount).toBeLessThanOrEqual(280);
    });

    test('should provide fallback when generation fails', async () => {
      // This should still return a valid tweet even if APIs fail
      const tweet = await viralGenerator.generateViralTweet('biotech');
      
      expect(tweet.content).toBeDefined();
      expect(tweet.content.length).toBeGreaterThan(0);
      expect(tweet.viralScore).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    test('should generate content within reasonable time', async () => {
      const startTime = Date.now();
      await viralGenerator.generateViralTweet('health monitoring');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
    });

    test('should handle multiple concurrent generations', async () => {
      const promises = Array.from({ length: 3 }, () => 
        viralGenerator.generateViralTweet('precision medicine')
      );

      const tweets = await Promise.all(promises);
      
      expect(tweets).toHaveLength(3);
      tweets.forEach(tweet => {
        expect(tweet.content).toBeDefined();
        expect(tweet.characterCount).toBeLessThanOrEqual(280);
      });
    });
  });
}); 