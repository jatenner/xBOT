/**
 * 🧠 LOGISTIC REGRESSION MODEL
 * 
 * PURPOSE: Lightweight content scoring model
 * STRATEGY: Feature-based engagement prediction with cached weights
 */

import { redisManager } from '../lib/redisManager';

export interface ContentFeatures {
  hour: number;           // 0-23
  weekday: number;        // 0-6 (Sunday=0)
  topic: string;          // gaming_fps, gaming_moba, etc.
  tagCount: number;       // Number of hashtags
  mediaHint: string;      // clip, image, none
  lengthBucket: string;   // short, medium, long
  hasCta: boolean;        // Call-to-action present
  hasQuestion: boolean;   // Contains question mark
  hasEmoji: boolean;      // Contains emojis
  sentiment: number;      // -1 to 1 (negative to positive)
}

export interface ModelWeights {
  version: string;
  intercept: number;
  coefficients: {
    hourCoef: number[];          // 24 coefficients for hours
    weekdayCoef: number[];       // 7 coefficients for weekdays
    topicCoef: Record<string, number>;  // Topic weights
    tagCountCoef: number;        // Tag count multiplier
    mediaCoef: Record<string, number>;  // Media type weights
    lengthCoef: Record<string, number>; // Length bucket weights
    ctaCoef: number;             // CTA boost
    questionCoef: number;        // Question boost
    emojiCoef: number;           // Emoji boost
    sentimentCoef: number;       // Sentiment multiplier
  };
  trainingMetrics: {
    accuracy: number;
    trainedOn: number;  // Number of samples
    lastUpdate: Date;
  };
}

/**
 * Content feature extractor
 */
export class FeatureExtractor {
  /**
   * Extract features from content and metadata
   */
  extractFeatures(content: {
    text: string;
    topic: string;
    tags: string[];
    mediaHint: string;
    timestamp?: Date;
  }): ContentFeatures {
    const now = content.timestamp || new Date();
    
    return {
      hour: now.getHours(),
      weekday: now.getDay(),
      topic: content.topic,
      tagCount: content.tags.length,
      mediaHint: content.mediaHint,
      lengthBucket: this.getLengthBucket(content.text),
      hasCta: this.hasCta(content.text),
      hasQuestion: content.text.includes('?'),
      hasEmoji: this.hasEmoji(content.text),
      sentiment: this.estimateSentiment(content.text)
    };
  }

  /**
   * Categorize text length
   */
  private getLengthBucket(text: string): string {
    const length = text.length;
    if (length <= 100) return 'short';
    if (length <= 200) return 'medium';
    return 'long';
  }

  /**
   * Check for call-to-action patterns
   */
  private hasCta(text: string): boolean {
    const ctaPatterns = [
      /like if/i,
      /retweet if/i,
      /share if/i,
      /comment if/i,
      /thoughts\?/i,
      /what do you think/i,
      /agree\?/i,
      /disagree\?/i,
      /let me know/i,
      /tell me/i
    ];

    return ctaPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check for emoji presence
   */
  private hasEmoji(text: string): boolean {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    return emojiRegex.test(text);
  }

  /**
   * Basic sentiment estimation
   */
  private estimateSentiment(text: string): number {
    const positiveWords = [
      'amazing', 'awesome', 'great', 'love', 'best', 'incredible', 
      'fantastic', 'perfect', 'excellent', 'outstanding', 'brilliant',
      'epic', 'legendary', 'clutch', 'sick', 'fire', 'goated'
    ];

    const negativeWords = [
      'terrible', 'awful', 'hate', 'worst', 'bad', 'horrible',
      'disappointing', 'trash', 'broken', 'toxic', 'overrated',
      'boring', 'dead', 'rip', 'nerf', 'broken'
    ];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    }

    // Normalize to -1 to 1 range
    const maxWords = Math.max(positiveWords.length, negativeWords.length);
    return Math.max(-1, Math.min(1, score / maxWords));
  }
}

/**
 * Logistic regression model for engagement prediction
 */
export class LogisticRegressionModel {
  private redisPrefix: string;
  private cacheKey: string;
  private defaultWeights: ModelWeights;

  constructor() {
    this.redisPrefix = process.env.REDIS_PREFIX || 'app:';
    this.cacheKey = `${this.redisPrefix}cache:config:model_weights`;
    this.defaultWeights = this.getDefaultWeights();
  }

  /**
   * Get default model weights
   */
  private getDefaultWeights(): ModelWeights {
    return {
      version: '1.0.0',
      intercept: -1.2,
      coefficients: {
        // Prime gaming hours (6-10 PM) get higher weights
        hourCoef: [
          0.1, 0.05, 0.05, 0.05, 0.05, 0.1,  // 0-5: Low activity
          0.15, 0.2, 0.25, 0.2, 0.15, 0.15,  // 6-11: Morning activity
          0.2, 0.25, 0.2, 0.15, 0.2, 0.25,   // 12-17: Afternoon
          0.35, 0.4, 0.35, 0.3, 0.25, 0.15   // 18-23: Prime time
        ],
        // Weekends slightly better
        weekdayCoef: [0.25, 0.2, 0.2, 0.2, 0.2, 0.25, 0.3], // Sun-Sat
        // Gaming topics weights
        topicCoef: {
          'gaming_fps': 0.3,
          'gaming_battle_royale': 0.35,
          'gaming_moba': 0.25,
          'gaming_rpg': 0.2,
          'gaming_sports': 0.15,
          'gaming_indie': 0.1,
          'gaming_esports': 0.4,
          'gaming_hardware': 0.15,
          'gaming_general': 0.2
        },
        tagCountCoef: 0.05,    // Small boost per hashtag
        mediaCoef: {
          'clip': 0.4,         // Video content performs best
          'image': 0.2,        // Images decent
          'none': 0.0          // Text only baseline
        },
        lengthCoef: {
          'short': 0.1,        // Punchy content
          'medium': 0.15,      // Sweet spot
          'long': -0.05        // Slightly penalized
        },
        ctaCoef: 0.08,         // Call-to-action boost
        questionCoef: 0.1,     // Questions drive engagement
        emojiCoef: 0.05,       // Light emoji boost
        sentimentCoef: 0.12    // Positive sentiment helps
      },
      trainingMetrics: {
        accuracy: 0.65,        // Reasonable baseline
        trainedOn: 100,        // Simulated training data
        lastUpdate: new Date()
      }
    };
  }

  /**
   * Load model weights from cache or config
   */
  async loadWeights(): Promise<ModelWeights> {
    try {
      // Try Redis cache first
      const cached = await redisManager.get(this.cacheKey);
      if (cached) {
        const weights = JSON.parse(cached);
        console.log(`📊 Loaded model weights v${weights.version} from cache`);
        return weights;
      }

      // TODO: Load from bot_config JSONB in Supabase
      // For now, use defaults and cache them
      await this.cacheWeights(this.defaultWeights);
      console.log(`📊 Using default model weights v${this.defaultWeights.version}`);
      return this.defaultWeights;
    } catch (error: any) {
      console.error('Failed to load model weights:', error.message);
      return this.defaultWeights;
    }
  }

  /**
   * Cache model weights in Redis
   */
  async cacheWeights(weights: ModelWeights): Promise<void> {
    try {
      await redisManager.set(this.cacheKey, JSON.stringify(weights), 3600); // 1 hour TTL
    } catch (error: any) {
      console.error('Failed to cache model weights:', error.message);
    }
  }

  /**
   * Predict engagement probability using logistic regression
   */
  async predict(features: ContentFeatures): Promise<{
    probability: number;
    logits: number;
    featureContributions: Record<string, number>;
  }> {
    const weights = await this.loadWeights();
    let logits = weights.intercept;
    const contributions: Record<string, number> = {};

    // Hour contribution
    const hourContrib = weights.coefficients.hourCoef[features.hour] || 0;
    logits += hourContrib;
    contributions.hour = hourContrib;

    // Weekday contribution
    const weekdayContrib = weights.coefficients.weekdayCoef[features.weekday] || 0;
    logits += weekdayContrib;
    contributions.weekday = weekdayContrib;

    // Topic contribution
    const topicContrib = weights.coefficients.topicCoef[features.topic] || 0;
    logits += topicContrib;
    contributions.topic = topicContrib;

    // Tag count contribution
    const tagContrib = weights.coefficients.tagCountCoef * features.tagCount;
    logits += tagContrib;
    contributions.tagCount = tagContrib;

    // Media contribution
    const mediaContrib = weights.coefficients.mediaCoef[features.mediaHint] || 0;
    logits += mediaContrib;
    contributions.media = mediaContrib;

    // Length contribution
    const lengthContrib = weights.coefficients.lengthCoef[features.lengthBucket] || 0;
    logits += lengthContrib;
    contributions.length = lengthContrib;

    // Boolean feature contributions
    const ctaContrib = features.hasCta ? weights.coefficients.ctaCoef : 0;
    logits += ctaContrib;
    contributions.cta = ctaContrib;

    const questionContrib = features.hasQuestion ? weights.coefficients.questionCoef : 0;
    logits += questionContrib;
    contributions.question = questionContrib;

    const emojiContrib = features.hasEmoji ? weights.coefficients.emojiCoef : 0;
    logits += emojiContrib;
    contributions.emoji = emojiContrib;

    // Sentiment contribution
    const sentimentContrib = weights.coefficients.sentimentCoef * features.sentiment;
    logits += sentimentContrib;
    contributions.sentiment = sentimentContrib;

    // Convert logits to probability using sigmoid function
    const probability = 1 / (1 + Math.exp(-logits));

    return {
      probability,
      logits,
      featureContributions: contributions
    };
  }

  /**
   * Batch predict for multiple candidates
   */
  async predictBatch(featuresArray: ContentFeatures[]): Promise<Array<{
    features: ContentFeatures;
    probability: number;
    logits: number;
    featureContributions: Record<string, number>;
  }>> {
    const results = [];
    
    for (const features of featuresArray) {
      const prediction = await this.predict(features);
      results.push({
        features,
        ...prediction
      });
    }

    return results;
  }

  /**
   * Update model weights
   */
  async updateWeights(newWeights: Partial<ModelWeights>): Promise<void> {
    const currentWeights = await this.loadWeights();
    const updatedWeights = {
      ...currentWeights,
      ...newWeights,
      version: newWeights.version || currentWeights.version
    };

    await this.cacheWeights(updatedWeights);
    console.log(`📊 Updated model weights to v${updatedWeights.version}`);
  }

  /**
   * Get model performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    version: string;
    accuracy: number;
    trainedOn: number;
    lastUpdate: Date;
    cacheStatus: 'hit' | 'miss' | 'error';
  }> {
    try {
      const weights = await this.loadWeights();
      const cacheStatus = await redisManager.exists(this.cacheKey) ? 'hit' : 'miss';
      
      return {
        version: weights.version,
        accuracy: weights.trainingMetrics.accuracy,
        trainedOn: weights.trainingMetrics.trainedOn,
        lastUpdate: new Date(weights.trainingMetrics.lastUpdate),
        cacheStatus
      };
    } catch (error: any) {
      console.error('Failed to get model performance metrics:', error.message);
      return {
        version: 'unknown',
        accuracy: 0,
        trainedOn: 0,
        lastUpdate: new Date(),
        cacheStatus: 'error'
      };
    }
  }

  /**
   * Explain prediction for debugging
   */
  async explainPrediction(features: ContentFeatures): Promise<{
    prediction: number;
    topContributors: Array<{ feature: string; contribution: number }>;
    explanation: string;
  }> {
    const result = await this.predict(features);
    
    // Sort contributions by absolute value
    const sortedContributions = Object.entries(result.featureContributions)
      .map(([feature, contribution]) => ({ feature, contribution }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    // Generate explanation
    const topContributors = sortedContributions.slice(0, 3);
    const explanation = `Prediction: ${(result.probability * 100).toFixed(1)}%. ` +
      `Top factors: ${topContributors.map(c => 
        `${c.feature} (${c.contribution > 0 ? '+' : ''}${(c.contribution * 100).toFixed(1)}%)`
      ).join(', ')}`;

    return {
      prediction: result.probability,
      topContributors,
      explanation
    };
  }
}