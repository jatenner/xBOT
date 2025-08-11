import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface EngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  viralScore: number;
}

export interface ContentAnalysis {
  tweetId: string;
  content: string;
  contentType: string;
  topics: string[];
  sentimentScore: number;
  metrics: EngagementMetrics;
  viralPotential: number;
  reachPotential: number;
  qualityScore: number;
  performanceRating: number;
  timestamp: Date;
}

export interface PostingRecommendation {
  shouldPost: boolean;
  confidence: number;
  reasoning: string;
  optimalTiming?: Date;
  contentSuggestions?: string[];
}

export class EngagementAnalyzer {
  private static instance: EngagementAnalyzer;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): EngagementAnalyzer {
    if (!EngagementAnalyzer.instance) {
      EngagementAnalyzer.instance = new EngagementAnalyzer();
    }
    return EngagementAnalyzer.instance;
  }

  public async analyzeContent(content: string, existingMetrics?: EngagementMetrics): Promise<ContentAnalysis> {
    // Simplified content analysis for now
    const topics = this.extractTopics(content);
    const sentimentScore = this.analyzeSentiment(content);
    const viralPotential = this.calculateViralPotential(content, topics);
    
    const metrics = existingMetrics || {
      likes: 0,
      retweets: 0,
      replies: 0,
      impressions: 0,
      engagementRate: 0,
      viralScore: viralPotential
    };

    return {
      tweetId: 'pending_' + Date.now(),
      content,
      contentType: this.determineContentType(content),
      topics,
      sentimentScore,
      metrics,
      viralPotential,
      reachPotential: this.calculateReachPotential(content),
      qualityScore: this.calculateQualityScore(content),
      performanceRating: this.calculatePerformanceRating(metrics),
      timestamp: new Date()
    };
  }

  public async getPostingRecommendation(): Promise<PostingRecommendation> {
    // Simplified recommendation logic
    return {
      shouldPost: true,
      confidence: 0.8,
      reasoning: 'Good engagement window detected',
      optimalTiming: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
    };
  }

  public getBestPostingTimes(): Array<{ hour: number; score: number }> {
    // Return hardcoded best posting times for now
    return [
      { hour: 9, score: 0.9 },
      { hour: 12, score: 0.8 },
      { hour: 15, score: 0.85 },
      { hour: 18, score: 0.9 },
      { hour: 21, score: 0.8 }
    ];
  }

  public async getTopPerformingTopics(limit: number = 10): Promise<Array<{ topic: string; performance: number }>> {
    // Return hardcoded top topics for now
    return [
      { topic: 'productivity', performance: 0.9 },
      { topic: 'health tips', performance: 0.85 },
      { topic: 'technology', performance: 0.8 },
      { topic: 'life advice', performance: 0.88 },
      { topic: 'wellness', performance: 0.82 }
    ].slice(0, limit);
  }

  private extractTopics(content: string): string[] {
    // Simple topic extraction
    const topics = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('health') || lowerContent.includes('wellness')) topics.push('health');
    if (lowerContent.includes('productivity') || lowerContent.includes('work')) topics.push('productivity');
    if (lowerContent.includes('tech') || lowerContent.includes('ai')) topics.push('technology');
    if (lowerContent.includes('tip') || lowerContent.includes('advice')) topics.push('advice');
    if (lowerContent.includes('life') || lowerContent.includes('lifestyle')) topics.push('lifestyle');
    
    return topics.length > 0 ? topics : ['general'];
  }

  private analyzeSentiment(content: string): number {
    // Simple sentiment analysis (-1 to 1)
    const positiveWords = ['great', 'amazing', 'love', 'best', 'awesome', 'good', 'excellent'];
    const negativeWords = ['bad', 'hate', 'worst', 'terrible', 'awful', 'problem'];
    
    const words = content.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  private calculateViralPotential(content: string, topics: string[]): number {
    let score = 0.5; // Base score
    
    // Length bonus (tweets between 100-200 chars perform well)
    const length = content.length;
    if (length >= 100 && length <= 200) score += 0.2;
    
    // Question mark bonus (engagement)
    if (content.includes('?')) score += 0.1;
    
    // Numbers/lists bonus
    if (/\d+/.test(content)) score += 0.1;
    
    // Hot topics bonus
    if (topics.includes('productivity') || topics.includes('health')) score += 0.1;
    
    return Math.min(1, score);
  }

  private calculateReachPotential(content: string): number {
    // Simple reach calculation
    return Math.random() * 0.3 + 0.4; // 0.4 to 0.7
  }

  private calculateQualityScore(content: string): number {
    let score = 0.5;
    
    // Grammar/spelling (simplified)
    if (content.includes('.') || content.includes('!')) score += 0.1;
    if (content.length > 50) score += 0.1;
    if (!/\s{2,}/.test(content)) score += 0.1; // No double spaces
    
    return Math.min(1, score);
  }

  private calculatePerformanceRating(metrics: EngagementMetrics): number {
    // Weighted performance calculation
    const { likes, retweets, replies, engagementRate } = metrics;
    return (likes * 0.3 + retweets * 0.4 + replies * 0.2 + engagementRate * 100 * 0.1) / 100;
  }

  private determineContentType(content: string): string {
    if (content.includes('?')) return 'question';
    if (content.includes('\n') || content.length > 200) return 'thread';
    if (/\d+/.test(content)) return 'list';
    return 'tweet';
  }

  // Store analysis method - simplified for now
  private async storeAnalysis(analysis: ContentAnalysis): Promise<void> {
    try {
      await this.db.executeQuery('store_engagement_analysis', async (client) => {
        return await client.from('tweet_analytics').upsert({
          tweet_id: analysis.tweetId,
          content_type: analysis.contentType,
          topics: JSON.stringify(analysis.topics),
          sentiment_score: analysis.sentimentScore,
          viral_score: analysis.metrics.viralScore,
          engagement_rate: analysis.metrics.engagementRate,
          performance_rating: analysis.performanceRating,
          analyzed_at: new Date().toISOString()
        });
      });
    } catch (error) {
      console.warn('Failed to store engagement analysis:', error);
    }
  }
}