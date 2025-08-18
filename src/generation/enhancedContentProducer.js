/**
 * Enhanced Content Producer
 * Integrates smart content generation with A/B testing
 */

const { SmartContentGenerator } = require('../lib/smartContentGenerator');

class EnhancedContentProducer {
  constructor() {
    this.smartGenerator = new SmartContentGenerator();
    this.generationHistory = new Map(); // Track performance of different approaches
    
    console.log('🚀 Enhanced content producer initialized');
  }

  /**
   * Generate content with smart A/B testing and quality gates
   */
  async generateContent({ topic, format, context = {}, requestId = null }) {
    try {
      console.log(`📝 SMART_GENERATION: topic="${topic}" format=${format} requestId=${requestId}`);

      // Generate multiple candidates and select best
      const result = await this.smartGenerator.generateWithABTesting({
        topic,
        format,
        context: {
          ...context,
          requestId,
          timestamp: new Date().toISOString()
        }
      });

      // Log generation details
      this.logGenerationResult(result, topic, format, requestId);

      // Store for learning
      if (requestId) {
        this.generationHistory.set(requestId, {
          topic,
          format,
          selectedScore: result.metadata.score.total,
          timestamp: Date.now()
        });
      }

      return {
        content: result.content,
        metadata: {
          ...result.metadata,
          producer: 'enhanced',
          generatedAt: new Date().toISOString()
        },
        alternatives: result.alternatives
      };

    } catch (error) {
      console.error('❌ Enhanced content generation failed:', error);
      return this.generateFallbackContent({ topic, format, context, error });
    }
  }

  /**
   * Log detailed generation results
   */
  logGenerationResult(result, topic, format, requestId) {
    const score = result.metadata.score;
    
    console.log(`✅ CONTENT_GENERATED requestId=${requestId} score=${score.total.toFixed(1)}/10`);
    console.log(`📊 QUALITY_BREAKDOWN hook=${score.hook_strength.toFixed(1)} evidence=${score.evidence_quality.toFixed(1)} action=${score.actionability.toFixed(1)}`);
    
    if (result.metadata.selectedCandidate > 0) {
      console.log(`🎯 SELECTED_VARIANT candidate=${result.metadata.selectedCandidate + 1}/${result.metadata.totalCandidates}`);
    }

    // Log content preview
    const preview = format === 'thread' 
      ? result.content.split('\n')[0].substring(0, 100)
      : result.content.substring(0, 100);
    console.log(`📖 CONTENT_PREVIEW: "${preview}..."`);
  }

  /**
   * Generate enhanced single post
   */
  async generateEnhancedSingle({ topic, context = {} }) {
    return this.generateContent({
      topic,
      format: 'single',
      context: {
        ...context,
        enhancementMode: 'viral_optimized'
      }
    });
  }

  /**
   * Generate enhanced thread
   */
  async generateEnhancedThread({ topic, context = {} }) {
    return this.generateContent({
      topic,
      format: 'thread',
      context: {
        ...context,
        enhancementMode: 'educational_deep_dive'
      }
    });
  }

  /**
   * Generate fallback content when smart generation fails
   */
  generateFallbackContent({ topic, format, context, error }) {
    console.warn(`⚠️ Using fallback content generation due to: ${error.message}`);
    
    const fallbackContent = this.smartGenerator.generateFallbackContent({
      topic,
      format,
      context
    });

    return {
      ...fallbackContent,
      metadata: {
        ...fallbackContent.metadata,
        producer: 'fallback',
        error: error.message,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get learning insights from generation history
   */
  getGenerationInsights() {
    const history = Array.from(this.generationHistory.values());
    
    if (history.length === 0) {
      return { message: 'No generation history yet' };
    }

    const avgScores = {
      single: this.calculateAverageScore(history, 'single'),
      thread: this.calculateAverageScore(history, 'thread')
    };

    const topTopics = this.getTopPerformingTopics(history);
    
    return {
      totalGenerations: history.length,
      averageScores: avgScores,
      topPerformingTopics: topTopics,
      lastGeneration: new Date(Math.max(...history.map(h => h.timestamp))).toISOString()
    };
  }

  /**
   * Calculate average score for format
   */
  calculateAverageScore(history, format) {
    const formatHistory = history.filter(h => h.format === format);
    if (formatHistory.length === 0) return 0;
    
    const totalScore = formatHistory.reduce((sum, h) => sum + h.selectedScore, 0);
    return (totalScore / formatHistory.length).toFixed(1);
  }

  /**
   * Get top performing topics
   */
  getTopPerformingTopics(history, limit = 5) {
    const topicScores = new Map();
    
    history.forEach(h => {
      if (!topicScores.has(h.topic)) {
        topicScores.set(h.topic, { total: 0, count: 0 });
      }
      const current = topicScores.get(h.topic);
      current.total += h.selectedScore;
      current.count += 1;
    });

    return Array.from(topicScores.entries())
      .map(([topic, stats]) => ({
        topic,
        averageScore: (stats.total / stats.count).toFixed(1),
        count: stats.count
      }))
      .sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore))
      .slice(0, limit);
  }

  /**
   * Clean up old generation history
   */
  cleanupHistory() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [key, value] of this.generationHistory.entries()) {
      if (value.timestamp < oneWeekAgo) {
        this.generationHistory.delete(key);
      }
    }
  }

  /**
   * Get producer status
   */
  getStatus() {
    return {
      generationHistory: this.generationHistory.size,
      insights: this.getGenerationInsights(),
      lastCleanup: new Date().toISOString()
    };
  }
}

module.exports = { EnhancedContentProducer };
