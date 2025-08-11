/**
 * 🎯 COMBINED SCORING SYSTEM
 * 
 * PURPOSE: Combine bandit sampling and model predictions
 * STRATEGY: Weighted combination with exploration parameter ε
 */

import { GamingBanditManager } from './bandit';
import { LogisticRegressionModel, FeatureExtractor, ContentFeatures } from './model';
import { QueuedCandidate } from '../candidates/queue';

export interface ScoringConfig {
  epsilon: number;           // Exploration rate (0-1)
  banditWeight: number;      // Weight for bandit scores
  modelWeight: number;       // Weight for model scores
  diversityBonus: number;    // Bonus for topic diversity
  recencyDecay: number;      // Decay factor for old content
}

export interface ScoredCandidate {
  candidate: QueuedCandidate;
  totalScore: number;
  banditScore: number;
  modelScore: number;
  explorationBonus: number;
  diversityBonus: number;
  features: ContentFeatures;
  explanation: string;
  confidence: number;
}

export interface ScoringResult {
  scoredCandidates: ScoredCandidate[];
  topCandidate: ScoredCandidate;
  scoringStats: {
    totalCandidates: number;
    avgBanditScore: number;
    avgModelScore: number;
    avgTotalScore: number;
    explorationRate: number;
    topTopics: string[];
  };
  explanations: string[];
}

/**
 * Combined scoring system for content candidates
 */
export class CombinedScorer {
  private banditManager: GamingBanditManager;
  private model: LogisticRegressionModel;
  private featureExtractor: FeatureExtractor;
  private config: ScoringConfig;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.banditManager = new GamingBanditManager();
    this.model = new LogisticRegressionModel();
    this.featureExtractor = new FeatureExtractor();
    
    this.config = {
      epsilon: 0.2,
      banditWeight: 0.6,
      modelWeight: 0.4,
      diversityBonus: 0.1,
      recencyDecay: 0.95,
      ...config
    };
  }

  /**
   * Update scoring configuration
   */
  updateConfig(newConfig: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`🎯 Updated scoring config: ε=${this.config.epsilon}, bandit=${this.config.banditWeight}, model=${this.config.modelWeight}`);
  }

  /**
   * Calculate diversity bonus based on recent topic usage
   */
  private calculateDiversityBonus(topic: string, recentTopics: string[]): number {
    const recentCount = recentTopics.filter(t => t === topic).length;
    const totalRecent = recentTopics.length;
    
    if (totalRecent === 0) return 0;
    
    // Bonus for less frequently used topics
    const frequency = recentCount / totalRecent;
    return (1 - frequency) * this.config.diversityBonus;
  }

  /**
   * Calculate recency score based on content age
   */
  private calculateRecencyScore(candidate: QueuedCandidate): number {
    const hoursAgo = (Date.now() - new Date(candidate.queuedAt).getTime()) / (1000 * 60 * 60);
    return Math.pow(this.config.recencyDecay, hoursAgo);
  }

  /**
   * Score a single candidate
   */
  async scoreCandidate(
    candidate: QueuedCandidate,
    recentTopics: string[] = []
  ): Promise<ScoredCandidate> {
    // Extract features
    const features = this.featureExtractor.extractFeatures({
      text: candidate.text,
      topic: candidate.topic,
      tags: candidate.tags,
      mediaHint: candidate.mediaHint,
      timestamp: new Date(candidate.queuedAt)
    });

    // Get bandit score (Thompson sampling)
    const topicSample = await this.banditManager.sampleBestTopic([candidate.topic]);
    const hourSample = await this.banditManager.sampleBestHour();
    
    // Average bandit scores from multiple dimensions
    const banditScore = (topicSample.sample.sample + hourSample.sample.sample) / 2;

    // Get model prediction
    const modelPrediction = await this.model.predict(features);
    const modelScore = modelPrediction.probability;

    // Calculate bonuses
    const diversityBonus = this.calculateDiversityBonus(candidate.topic, recentTopics);
    const recencyScore = this.calculateRecencyScore(candidate);
    
    // Exploration bonus (random boost for exploration)
    const explorationBonus = Math.random() < this.config.epsilon ? 
      Math.random() * 0.3 : 0; // Up to 30% random boost

    // Combined score
    let totalScore = 
      (this.config.banditWeight * banditScore) +
      (this.config.modelWeight * modelScore) +
      diversityBonus +
      explorationBonus;

    // Apply recency decay
    totalScore *= recencyScore;

    // Calculate confidence (average of bandit and model confidence)
    const banditConfidence = (topicSample.sample.confidence + hourSample.sample.confidence) / 2;
    const modelConfidence = 0.8; // Fixed for now, could be dynamic
    const confidence = (banditConfidence + modelConfidence) / 2;

    // Generate explanation
    const explanation = this.generateExplanation({
      candidate,
      banditScore,
      modelScore,
      diversityBonus,
      explorationBonus,
      totalScore,
      features
    });

    return {
      candidate,
      totalScore,
      banditScore,
      modelScore,
      explorationBonus,
      diversityBonus,
      features,
      explanation,
      confidence
    };
  }

  /**
   * Score multiple candidates and return ranked results
   */
  async scoreCandidates(
    candidates: QueuedCandidate[],
    recentTopics: string[] = []
  ): Promise<ScoringResult> {
    console.log(`🎯 Scoring ${candidates.length} candidates...`);
    
    const scoredCandidates: ScoredCandidate[] = [];
    
    // Score each candidate
    for (const candidate of candidates) {
      try {
        const scored = await this.scoreCandidate(candidate, recentTopics);
        scoredCandidates.push(scored);
      } catch (error: any) {
        console.error(`Failed to score candidate ${candidate.hash}:`, error.message);
      }
    }

    // Sort by total score descending
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    // Calculate statistics
    const totalCandidates = scoredCandidates.length;
    const avgBanditScore = scoredCandidates.reduce((sum, c) => sum + c.banditScore, 0) / totalCandidates;
    const avgModelScore = scoredCandidates.reduce((sum, c) => sum + c.modelScore, 0) / totalCandidates;
    const avgTotalScore = scoredCandidates.reduce((sum, c) => sum + c.totalScore, 0) / totalCandidates;
    const explorationRate = scoredCandidates.filter(c => c.explorationBonus > 0).length / totalCandidates;
    
    // Get top topics
    const topicCounts: Record<string, number> = {};
    scoredCandidates.forEach(c => {
      topicCounts[c.candidate.topic] = (topicCounts[c.candidate.topic] || 0) + 1;
    });
    const topTopics = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);

    // Generate explanations
    const explanations = [
      `Scored ${totalCandidates} candidates with ε=${this.config.epsilon}`,
      `Top candidate: "${scoredCandidates[0]?.candidate.text.substring(0, 50)}..." (score: ${scoredCandidates[0]?.totalScore.toFixed(3)})`,
      `Avg scores: bandit=${avgBanditScore.toFixed(3)}, model=${avgModelScore.toFixed(3)}, total=${avgTotalScore.toFixed(3)}`,
      `Exploration rate: ${(explorationRate * 100).toFixed(1)}%`,
      `Top topics: ${topTopics.join(', ')}`
    ];

    const result: ScoringResult = {
      scoredCandidates,
      topCandidate: scoredCandidates[0],
      scoringStats: {
        totalCandidates,
        avgBanditScore,
        avgModelScore,
        avgTotalScore,
        explorationRate,
        topTopics
      },
      explanations
    };

    console.log(`✅ Scoring complete. Top score: ${result.topCandidate?.totalScore.toFixed(3) || 'N/A'}`);
    return result;
  }

  /**
   * Get top N candidates
   */
  async getTopCandidates(
    candidates: QueuedCandidate[],
    n: number = 1,
    recentTopics: string[] = []
  ): Promise<ScoredCandidate[]> {
    const result = await this.scoreCandidates(candidates, recentTopics);
    return result.scoredCandidates.slice(0, n);
  }

  /**
   * Generate human-readable explanation for scoring
   */
  private generateExplanation(params: {
    candidate: QueuedCandidate;
    banditScore: number;
    modelScore: number;
    diversityBonus: number;
    explorationBonus: number;
    totalScore: number;
    features: ContentFeatures;
  }): string {
    const { candidate, banditScore, modelScore, diversityBonus, explorationBonus, totalScore, features } = params;
    
    const parts = [];
    
    // Total score
    parts.push(`Score: ${totalScore.toFixed(3)}`);
    
    // Component breakdown
    const components = [];
    components.push(`bandit: ${banditScore.toFixed(3)}`);
    components.push(`model: ${modelScore.toFixed(3)}`);
    
    if (diversityBonus > 0) {
      components.push(`diversity: +${diversityBonus.toFixed(3)}`);
    }
    
    if (explorationBonus > 0) {
      components.push(`exploration: +${explorationBonus.toFixed(3)}`);
    }
    
    parts.push(`(${components.join(', ')})`);
    
    // Key features
    const keyFeatures = [];
    if (features.mediaHint !== 'none') {
      keyFeatures.push(`${features.mediaHint} media`);
    }
    if (features.hasCta) {
      keyFeatures.push('CTA');
    }
    if (features.hasQuestion) {
      keyFeatures.push('question');
    }
    if (features.hasEmoji) {
      keyFeatures.push('emoji');
    }
    
    if (keyFeatures.length > 0) {
      parts.push(`Features: ${keyFeatures.join(', ')}`);
    }
    
    // Topic and timing
    parts.push(`${candidate.topic} at ${features.hour}:00`);
    
    return parts.join(' | ');
  }

  /**
   * A/B test different scoring configurations
   */
  async compareConfigurations(
    candidates: QueuedCandidate[],
    configs: Array<{ name: string; config: Partial<ScoringConfig> }>
  ): Promise<Array<{
    name: string;
    topCandidate: ScoredCandidate;
    avgScore: number;
    config: ScoringConfig;
  }>> {
    const results = [];
    const originalConfig = { ...this.config };
    
    for (const { name, config } of configs) {
      this.updateConfig(config);
      const result = await this.scoreCandidates(candidates);
      
      results.push({
        name,
        topCandidate: result.topCandidate,
        avgScore: result.scoringStats.avgTotalScore,
        config: { ...this.config }
      });
    }
    
    // Restore original config
    this.config = originalConfig;
    
    return results;
  }

  /**
   * Get scoring system health
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    banditHealth: any;
    modelHealth: any;
    lastScoring: Date | null;
    errorRate: number;
  }> {
    try {
      const banditHealth = await this.banditManager.getPerformanceReport();
      const modelHealth = await this.model.getPerformanceMetrics();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      // Check for issues
      if (banditHealth.system.totalArms === 0) {
        status = 'warning';
      }
      
      if (modelHealth.accuracy < 0.5) {
        status = 'warning';
      }
      
      if (modelHealth.cacheStatus === 'error') {
        status = 'critical';
      }

      return {
        status,
        banditHealth,
        modelHealth,
        lastScoring: null, // Would track in production
        errorRate: 0 // Would track in production
      };
    } catch (error: any) {
      return {
        status: 'critical',
        banditHealth: null,
        modelHealth: null,
        lastScoring: null,
        errorRate: 1.0
      };
    }
  }
}