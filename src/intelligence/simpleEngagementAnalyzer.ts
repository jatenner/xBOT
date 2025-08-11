export interface EngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions?: number;
  engagementRate: number;
  viralScore: number;
}

export interface ContentAnalysis {
  tweetId: string;
  content: string;
  metrics: EngagementMetrics;
  contentType: 'thread' | 'single' | 'reply';
  topics: string[];
  sentimentScore: number;
  timePosted: Date;
  performanceRating: 'poor' | 'average' | 'good' | 'excellent';
}

export class SimpleEngagementAnalyzer {
  private static instance: SimpleEngagementAnalyzer;

  private constructor() {}

  public static getInstance(): SimpleEngagementAnalyzer {
    if (!SimpleEngagementAnalyzer.instance) {
      SimpleEngagementAnalyzer.instance = new SimpleEngagementAnalyzer();
    }
    return SimpleEngagementAnalyzer.instance;
  }

  public analyzeEngagement(tweetId: string, content: string, metrics: EngagementMetrics): ContentAnalysis {
    console.log(`📊 Analyzing engagement for tweet ${tweetId}...`);

    // Calculate derived metrics
    const enhancedMetrics = this.enhanceMetrics(metrics);

    // Analyze content characteristics
    const contentType = this.detectContentType(content);
    const topics = this.extractTopics(content);
    const sentimentScore = this.analyzeSentiment(content);
    const performanceRating = this.ratePerformance(enhancedMetrics);

    const analysis: ContentAnalysis = {
      tweetId,
      content,
      metrics: enhancedMetrics,
      contentType,
      topics,
      sentimentScore,
      timePosted: new Date(),
      performanceRating
    };

    console.log(`✅ Analysis complete for ${tweetId}: ${performanceRating} performance`);
    return analysis;
  }

  private enhanceMetrics(metrics: EngagementMetrics): EngagementMetrics {
    // Calculate engagement rate if not provided
    let engagementRate = metrics.engagementRate;
    if (!engagementRate && metrics.impressions) {
      engagementRate = ((metrics.likes + metrics.retweets + metrics.replies) / metrics.impressions) * 100;
    }

    // Calculate viral score
    const viralScore = this.calculateViralScore(metrics);

    return {
      ...metrics,
      engagementRate: engagementRate || 0,
      viralScore
    };
  }

  private calculateViralScore(metrics: EngagementMetrics): number {
    // Viral score algorithm considers retweets most important for virality
    const retweetWeight = 3;
    const likeWeight = 1;
    const replyWeight = 2;

    const weightedScore = 
      (metrics.retweets * retweetWeight) + 
      (metrics.likes * likeWeight) + 
      (metrics.replies * replyWeight);

    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, Math.log(weightedScore + 1) * 15));
  }

  private detectContentType(content: string): 'thread' | 'single' | 'reply' {
    if (/\d+\//.test(content)) {
      return 'thread';
    }
    if (content.startsWith('@') || content.includes('replying to')) {
      return 'reply';
    }
    return 'single';
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];
    
    // Health-related keywords
    const healthTopics = [
      'nutrition', 'diet', 'exercise', 'fitness', 'sleep', 'stress', 'mental health',
      'supplements', 'vitamins', 'protein', 'cardio', 'strength', 'yoga', 'meditation',
      'wellness', 'immunity', 'recovery', 'hydration', 'metabolism', 'weight loss'
    ];

    const lowerContent = content.toLowerCase();
    
    healthTopics.forEach(topic => {
      if (lowerContent.includes(topic)) {
        topics.push(topic);
      }
    });

    // Extract hashtags as topics
    const hashtags = content.match(/#(\w+)/g);
    if (hashtags) {
      topics.push(...hashtags.map(tag => tag.slice(1).toLowerCase()));
    }

    return [...new Set(topics)]; // Remove duplicates
  }

  private analyzeSentiment(content: string): number {
    // Simplified sentiment analysis
    const positiveWords = ['great', 'awesome', 'amazing', 'love', 'best', 'excellent', 'perfect', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'sucks'];

    const words = content.toLowerCase().split(/\W+/);
    let sentiment = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) sentiment += 1;
      if (negativeWords.includes(word)) sentiment -= 1;
    });

    // Normalize to -100 to 100 scale
    return Math.max(-100, Math.min(100, sentiment * 10));
  }

  private ratePerformance(metrics: EngagementMetrics): 'poor' | 'average' | 'good' | 'excellent' {
    const score = metrics.viralScore + (metrics.engagementRate * 2);
    
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 30) return 'average';
    return 'poor';
  }

  public getBestPostingTimes(): Array<{hour: number, score: number}> {
    // Return some reasonable defaults for health content
    return [
      { hour: 7, score: 85 },   // Morning routine time
      { hour: 12, score: 75 },  // Lunch break
      { hour: 18, score: 80 },  // Evening wind-down
      { hour: 20, score: 70 }   // Evening social time
    ];
  }
}