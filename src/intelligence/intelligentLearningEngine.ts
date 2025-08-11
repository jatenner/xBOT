import { TweetMetrics, TweetPerformanceTracker } from './tweetPerformanceTracker';

export interface ContentPattern {
  id: string;
  contentType: 'question' | 'statement' | 'list' | 'thread' | 'quote' | 'fact';
  topics: string[];
  sentimentScore: number;
  length: number;
  hasEmojis: boolean;
  hasHashtags: boolean;
  timeOfDay: number;
  dayOfWeek: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgFollowerGrowth: number;
  successScore: number; // 0-100
  sampleSize: number;
}

export interface LearningInsight {
  type: 'optimal_length' | 'best_timing' | 'content_style' | 'topic_performance' | 'engagement_hook';
  insight: string;
  confidence: number; // 0-1
  evidence: string[];
  recommendation: string;
  impactScore: number; // 1-10
}

/**
 * Intelligent learning engine that analyzes tweet performance patterns
 * to optimize content strategy for maximum follower growth
 */
export class IntelligentLearningEngine {
  private static instance: IntelligentLearningEngine;
  private performanceTracker: TweetPerformanceTracker;
  private patterns: Map<string, ContentPattern> = new Map();

  private constructor() {
    this.performanceTracker = TweetPerformanceTracker.getInstance();
  }

  public static getInstance(): IntelligentLearningEngine {
    if (!IntelligentLearningEngine.instance) {
      IntelligentLearningEngine.instance = new IntelligentLearningEngine();
    }
    return IntelligentLearningEngine.instance;
  }

  /**
   * Analyze all historical data to discover success patterns
   */
  public async learnFromPerformanceData(): Promise<LearningInsight[]> {
    console.log('🧠 Analyzing tweet performance data for learning insights...');
    
    try {
      // Get historical tweet data
      const tweetData = await this.getHistoricalTweetData();
      
      if (tweetData.length < 5) {
        console.log('📊 Not enough data for pattern analysis (need at least 5 tweets)');
        return [];
      }

      // Analyze patterns
      const patterns = await this.analyzeContentPatterns(tweetData);
      this.patterns = new Map(patterns.map(p => [p.id, p]));

      // Generate insights
      const insights = await this.generateLearningInsights(patterns);
      
      // Store insights for future use
      await this.storeLearningInsights(insights);

      console.log(`✅ Generated ${insights.length} learning insights from ${tweetData.length} tweets`);
      return insights;
      
    } catch (error: any) {
      console.error('⚠️ Learning analysis failed:', error.message);
      return [];
    }
  }

  /**
   * Get optimal content recommendations based on learned patterns
   */
  public async getContentRecommendations(): Promise<{
    optimalLength: number;
    bestTopics: string[];
    optimalTime: { hour: number; confidence: number };
    contentStyle: string;
    engagementHooks: string[];
    expectedScore: number;
  }> {
    console.log('🎯 Generating content recommendations based on learned patterns...');

    const insights = await this.getStoredInsights();
    const patterns = Array.from(this.patterns.values());

    // Find best performing patterns
    const topPatterns = patterns
      .filter(p => p.sampleSize >= 2)
      .sort((a, b) => b.successScore - a.successScore)
      .slice(0, 5);

    if (topPatterns.length === 0) {
      return this.getDefaultRecommendations();
    }

    // Calculate optimal parameters
    const optimalLength = this.calculateOptimalLength(topPatterns);
    const bestTopics = this.getBestTopics(topPatterns);
    const optimalTime = this.getOptimalPostingTime(topPatterns);
    const contentStyle = this.getBestContentStyle(topPatterns);
    const engagementHooks = this.getEffectiveHooks(insights);
    const expectedScore = this.predictContentScore(optimalLength, bestTopics, optimalTime.hour);

    console.log(`✅ Content recommendations: ${optimalLength} chars, ${bestTopics.join(', ')}, ${optimalTime.hour}:00`);

    return {
      optimalLength,
      bestTopics,
      optimalTime,
      contentStyle,
      engagementHooks,
      expectedScore
    };
  }

  /**
   * Predict how well content will perform before posting
   */
  public async predictContentPerformance(content: string): Promise<{
    expectedLikes: number;
    expectedRetweets: number;
    expectedFollowers: number;
    confidenceScore: number;
    recommendations: string[];
  }> {
    const analysis = this.analyzeContentFeatures(content);
    const matchingPatterns = this.findMatchingPatterns(analysis);
    
    if (matchingPatterns.length === 0) {
      return {
        expectedLikes: 5,
        expectedRetweets: 1,
        expectedFollowers: 1,
        confidenceScore: 0.3,
        recommendations: ['Need more historical data for accurate prediction']
      };
    }

    // Calculate weighted averages based on pattern similarity
    let totalWeight = 0;
    let weightedLikes = 0;
    let weightedRetweets = 0;
    let weightedFollowers = 0;

    matchingPatterns.forEach(({ pattern, similarity }) => {
      const weight = similarity * Math.min(pattern.sampleSize, 10);
      totalWeight += weight;
      weightedLikes += pattern.avgLikes * weight;
      weightedRetweets += pattern.avgRetweets * weight;
      weightedFollowers += pattern.avgFollowerGrowth * weight;
    });

    const expectedLikes = Math.round(weightedLikes / totalWeight);
    const expectedRetweets = Math.round(weightedRetweets / totalWeight);
    const expectedFollowers = Math.round(weightedFollowers / totalWeight);
    const confidenceScore = Math.min(totalWeight / 20, 1); // Higher weight = higher confidence

    // Generate recommendations
    const recommendations = this.generateContentRecommendations(analysis, matchingPatterns);

    console.log(`🎯 Predicted performance: ${expectedLikes} likes, ${expectedRetweets} retweets, ${expectedFollowers} followers (confidence: ${Math.round(confidenceScore * 100)}%)`);

    return {
      expectedLikes,
      expectedRetweets,
      expectedFollowers,
      confidenceScore,
      recommendations
    };
  }

  /**
   * Get historical tweet data from database
   */
  private async getHistoricalTweetData(): Promise<any[]> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      await dbManager.initialize();

      const data = await dbManager.executeQuery(
        'get_learning_data',
        async (client) => {
          const { data, error } = await client
            .from('learning_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
          
          if (error) throw error;
          return data || [];
        },
        'historical_tweets',
        600000 // 10 minute cache
      );

      return data;
    } catch (error: any) {
      console.error('Failed to get historical data:', error.message);
      return [];
    }
  }

  /**
   * Analyze content to identify patterns
   */
  private async analyzeContentPatterns(tweetData: any[]): Promise<ContentPattern[]> {
    const patternMap = new Map<string, {
      tweets: any[];
      totalLikes: number;
      totalRetweets: number;
      totalReplies: number;
      totalFollowers: number;
    }>();

    // Group tweets by similar characteristics
    tweetData.forEach(tweet => {
      if (!tweet.content) return;

      const features = this.analyzeContentFeatures(tweet.content);
      const patternKey = `${features.contentType}_${features.length}_${features.timeOfDay}`;

      if (!patternMap.has(patternKey)) {
        patternMap.set(patternKey, {
          tweets: [],
          totalLikes: 0,
          totalRetweets: 0,
          totalReplies: 0,
          totalFollowers: 0
        });
      }

      const pattern = patternMap.get(patternKey)!;
      pattern.tweets.push(tweet);
      pattern.totalLikes += tweet.likes_count || 0;
      pattern.totalRetweets += tweet.retweets_count || 0;
      pattern.totalReplies += tweet.replies_count || 0;
      pattern.totalFollowers += tweet.converted_followers || 0;
    });

    // Convert to ContentPattern objects
    const patterns: ContentPattern[] = [];
    
    patternMap.forEach((data, key) => {
      if (data.tweets.length < 1) return;

      const firstTweet = data.tweets[0];
      const features = this.analyzeContentFeatures(firstTweet.content);
      const sampleSize = data.tweets.length;

      patterns.push({
        id: key,
        contentType: features.contentType,
        topics: features.topics,
        sentimentScore: features.sentimentScore,
        length: features.length,
        hasEmojis: features.hasEmojis,
        hasHashtags: features.hasHashtags,
        timeOfDay: features.timeOfDay,
        dayOfWeek: features.dayOfWeek,
        avgLikes: Math.round(data.totalLikes / sampleSize),
        avgRetweets: Math.round(data.totalRetweets / sampleSize),
        avgReplies: Math.round(data.totalReplies / sampleSize),
        avgFollowerGrowth: Math.round(data.totalFollowers / sampleSize),
        successScore: this.calculateSuccessScore(data, sampleSize),
        sampleSize
      });
    });

    return patterns.sort((a, b) => b.successScore - a.successScore);
  }

  /**
   * Analyze individual content features
   */
  private analyzeContentFeatures(content: string): {
    contentType: 'question' | 'statement' | 'list' | 'thread' | 'quote' | 'fact';
    topics: string[];
    sentimentScore: number;
    length: number;
    hasEmojis: boolean;
    hasHashtags: boolean;
    timeOfDay: number;
    dayOfWeek: number;
  } {
    const length = content.length;
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content);
    const hasHashtags = /#\w+/.test(content);
    const now = new Date();

    // Determine content type
    let contentType: 'question' | 'statement' | 'list' | 'thread' | 'quote' | 'fact' = 'statement';
    if (content.includes('?')) contentType = 'question';
    else if (/^\d+\.|\n\d+\./m.test(content)) contentType = 'list';
    else if (/\d+\/\d+/.test(content)) contentType = 'thread';
    else if (content.includes('"') || content.includes('"')) contentType = 'quote';
    else if (/study|research|shows|found|percent|%/i.test(content)) contentType = 'fact';

    // Extract topics
    const topics = this.extractTopics(content);

    // Simple sentiment analysis
    const sentimentScore = this.calculateSentiment(content);

    return {
      contentType,
      topics,
      sentimentScore,
      length,
      hasEmojis,
      hasHashtags,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay()
    };
  }

  private extractTopics(content: string): string[] {
    const viralTopics = [
      'productivity', 'life hacks', 'tips', 'career', 'finance', 'tech', 'science',
      'relationships', 'communication', 'success', 'mindset', 'learning', 'creativity',
      'business', 'entrepreneurship', 'innovation', 'psychology', 'habits', 'motivation',
      'time management', 'goal setting', 'personal growth', 'leadership', 'networking',
      'health', 'fitness', 'nutrition', 'wellness', 'self-care', 'mental health'
    ];

    const lowerContent = content.toLowerCase();
    const foundTopics: string[] = [];

    viralTopics.forEach(topic => {
      if (lowerContent.includes(topic)) {
        foundTopics.push(topic);
      }
    });

    return foundTopics;
  }

  private calculateSentiment(content: string): number {
    const positiveWords = ['great', 'awesome', 'amazing', 'love', 'best', 'excellent', 'perfect', 'wonderful', 'happy', 'good'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'sad', 'angry', 'difficult'];

    const words = content.toLowerCase().split(/\W+/);
    let sentiment = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) sentiment += 1;
      if (negativeWords.includes(word)) sentiment -= 1;
    });

    return Math.max(-100, Math.min(100, sentiment * 10));
  }

  private calculateSuccessScore(data: any, sampleSize: number): number {
    const avgLikes = data.totalLikes / sampleSize;
    const avgRetweets = data.totalRetweets / sampleSize;
    const avgReplies = data.totalReplies / sampleSize;
    const avgFollowers = data.totalFollowers / sampleSize;

    // Weight followers most heavily (main goal)
    const score = (avgFollowers * 40) + (avgRetweets * 25) + (avgLikes * 20) + (avgReplies * 15);
    return Math.min(100, score);
  }

  private async generateLearningInsights(patterns: ContentPattern[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    // Analyze optimal length
    const lengthInsight = this.analyzeLengthPerformance(patterns);
    if (lengthInsight) insights.push(lengthInsight);

    // Analyze timing patterns
    const timingInsight = this.analyzeTimingPerformance(patterns);
    if (timingInsight) insights.push(timingInsight);

    // Analyze content styles
    const styleInsight = this.analyzeContentStyles(patterns);
    if (styleInsight) insights.push(styleInsight);

    // Analyze topic performance
    const topicInsight = this.analyzeTopicPerformance(patterns);
    if (topicInsight) insights.push(topicInsight);

    return insights;
  }

  private analyzeLengthPerformance(patterns: ContentPattern[]): LearningInsight | null {
    if (patterns.length < 3) return null;

    const lengthGroups = {
      short: patterns.filter(p => p.length < 100),
      medium: patterns.filter(p => p.length >= 100 && p.length < 200),
      long: patterns.filter(p => p.length >= 200)
    };

    const avgScores = {
      short: lengthGroups.short.reduce((sum, p) => sum + p.successScore, 0) / Math.max(lengthGroups.short.length, 1),
      medium: lengthGroups.medium.reduce((sum, p) => sum + p.successScore, 0) / Math.max(lengthGroups.medium.length, 1),
      long: lengthGroups.long.reduce((sum, p) => sum + p.successScore, 0) / Math.max(lengthGroups.long.length, 1)
    };

    const bestLength = Object.keys(avgScores).reduce((a, b) => avgScores[a] > avgScores[b] ? a : b);
    const confidence = Math.min(patterns.length / 10, 1);

    return {
      type: 'optimal_length',
      insight: `${bestLength} tweets perform best (avg score: ${avgScores[bestLength].toFixed(1)})`,
      confidence,
      evidence: [`${lengthGroups[bestLength].length} ${bestLength} tweets analyzed`],
      recommendation: `Target ${bestLength === 'short' ? '<100' : bestLength === 'medium' ? '100-200' : '>200'} characters`,
      impactScore: Math.round(confidence * 10)
    };
  }

  private analyzeTimingPerformance(patterns: ContentPattern[]): LearningInsight | null {
    if (patterns.length < 3) return null;

    const timeGroups = new Map<number, ContentPattern[]>();
    patterns.forEach(p => {
      if (!timeGroups.has(p.timeOfDay)) {
        timeGroups.set(p.timeOfDay, []);
      }
      timeGroups.get(p.timeOfDay)!.push(p);
    });

    let bestHour = 12;
    let bestScore = 0;

    timeGroups.forEach((patterns, hour) => {
      const avgScore = patterns.reduce((sum, p) => sum + p.successScore, 0) / patterns.length;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestHour = hour;
      }
    });

    return {
      type: 'best_timing',
      insight: `Posts at ${bestHour}:00 perform best (avg score: ${bestScore.toFixed(1)})`,
      confidence: Math.min(patterns.length / 10, 1),
      evidence: [`${timeGroups.get(bestHour)?.length || 0} posts analyzed for ${bestHour}:00`],
      recommendation: `Post around ${bestHour}:00 for optimal engagement`,
      impactScore: 8
    };
  }

  private analyzeContentStyles(patterns: ContentPattern[]): LearningInsight | null {
    if (patterns.length < 3) return null;

    const styleGroups = new Map<string, ContentPattern[]>();
    patterns.forEach(p => {
      if (!styleGroups.has(p.contentType)) {
        styleGroups.set(p.contentType, []);
      }
      styleGroups.get(p.contentType)!.push(p);
    });

    let bestStyle = 'statement';
    let bestScore = 0;

    styleGroups.forEach((patterns, style) => {
      const avgScore = patterns.reduce((sum, p) => sum + p.successScore, 0) / patterns.length;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestStyle = style;
      }
    });

    return {
      type: 'content_style',
      insight: `${bestStyle} content performs best (avg score: ${bestScore.toFixed(1)})`,
      confidence: Math.min(patterns.length / 8, 1),
      evidence: [`${styleGroups.get(bestStyle)?.length || 0} ${bestStyle} posts analyzed`],
      recommendation: `Use more ${bestStyle}-style content`,
      impactScore: 7
    };
  }

  private analyzeTopicPerformance(patterns: ContentPattern[]): LearningInsight | null {
    const topicScores = new Map<string, { total: number; count: number }>();

    patterns.forEach(p => {
      p.topics.forEach(topic => {
        if (!topicScores.has(topic)) {
          topicScores.set(topic, { total: 0, count: 0 });
        }
        const data = topicScores.get(topic)!;
        data.total += p.successScore;
        data.count += 1;
      });
    });

    if (topicScores.size === 0) return null;

    const bestTopic = Array.from(topicScores.entries())
      .map(([topic, data]) => ({ topic, avgScore: data.total / data.count, count: data.count }))
      .filter(item => item.count >= 2)
      .sort((a, b) => b.avgScore - a.avgScore)[0];

    if (!bestTopic) return null;

    return {
      type: 'topic_performance',
      insight: `"${bestTopic.topic}" content performs best (avg score: ${bestTopic.avgScore.toFixed(1)})`,
      confidence: Math.min(bestTopic.count / 5, 1),
      evidence: [`${bestTopic.count} posts about ${bestTopic.topic} analyzed`],
      recommendation: `Create more content about ${bestTopic.topic}`,
      impactScore: 9
    };
  }

  // Helper methods for recommendations
  private calculateOptimalLength(patterns: ContentPattern[]): number {
    const weightedSum = patterns.reduce((sum, p) => sum + (p.length * p.successScore), 0);
    const weightSum = patterns.reduce((sum, p) => sum + p.successScore, 0);
    return Math.round(weightedSum / Math.max(weightSum, 1));
  }

  private getBestTopics(patterns: ContentPattern[]): string[] {
    const topicScores = new Map<string, number>();
    patterns.forEach(p => {
      p.topics.forEach(topic => {
        topicScores.set(topic, (topicScores.get(topic) || 0) + p.successScore);
      });
    });

    return Array.from(topicScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
  }

  private getOptimalPostingTime(patterns: ContentPattern[]): { hour: number; confidence: number } {
    const timeScores = new Map<number, { total: number; count: number }>();
    patterns.forEach(p => {
      if (!timeScores.has(p.timeOfDay)) {
        timeScores.set(p.timeOfDay, { total: 0, count: 0 });
      }
      const data = timeScores.get(p.timeOfDay)!;
      data.total += p.successScore;
      data.count += 1;
    });

    let bestHour = 12;
    let bestScore = 0;
    timeScores.forEach((data, hour) => {
      const avgScore = data.total / data.count;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestHour = hour;
      }
    });

    return {
      hour: bestHour,
      confidence: Math.min(patterns.length / 10, 1)
    };
  }

  private getBestContentStyle(patterns: ContentPattern[]): string {
    const styleScores = new Map<string, { total: number; count: number }>();
    patterns.forEach(p => {
      if (!styleScores.has(p.contentType)) {
        styleScores.set(p.contentType, { total: 0, count: 0 });
      }
      const data = styleScores.get(p.contentType)!;
      data.total += p.successScore;
      data.count += 1;
    });

    let bestStyle = 'statement';
    let bestScore = 0;
    styleScores.forEach((data, style) => {
      const avgScore = data.total / data.count;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestStyle = style;
      }
    });

    return bestStyle;
  }

  private getEffectiveHooks(insights: LearningInsight[]): string[] {
    return [
      'Did you know',
      'Here\'s something interesting',
      'Quick reminder',
      'Fun fact',
      'Pro tip',
      'Reality check'
    ];
  }

  private predictContentScore(length: number, topics: string[], hour: number): number {
    // Simple prediction based on patterns
    let score = 50; // Base score

    // Length optimization
    if (length >= 100 && length <= 200) score += 10;
    
    // Time optimization
    if ([7, 12, 18, 20].includes(hour)) score += 10;

    // Topic boost
          if (topics.includes('productivity') || topics.includes('life hacks') || topics.includes('tips')) score += 15;

    return Math.min(100, score);
  }

  private findMatchingPatterns(analysis: any): Array<{ pattern: ContentPattern; similarity: number }> {
    return Array.from(this.patterns.values())
      .map(pattern => ({
        pattern,
        similarity: this.calculatePatternSimilarity(analysis, pattern)
      }))
      .filter(match => match.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  private calculatePatternSimilarity(analysis: any, pattern: ContentPattern): number {
    let similarity = 0;

    // Content type match
    if (analysis.contentType === pattern.contentType) similarity += 0.3;

    // Length similarity
    const lengthDiff = Math.abs(analysis.length - pattern.length);
    if (lengthDiff < 50) similarity += 0.2;

    // Topic overlap
    const commonTopics = analysis.topics.filter(topic => pattern.topics.includes(topic));
    if (commonTopics.length > 0) similarity += 0.3;

    // Time similarity
    const timeDiff = Math.abs(analysis.timeOfDay - pattern.timeOfDay);
    if (timeDiff < 2) similarity += 0.2;

    return similarity;
  }

  private generateContentRecommendations(analysis: any, matchingPatterns: Array<{ pattern: ContentPattern; similarity: number }>): string[] {
    const recommendations: string[] = [];

    // Length recommendations
    if (analysis.length < 50) {
      recommendations.push('Consider adding more detail (50+ characters)');
    } else if (analysis.length > 250) {
      recommendations.push('Consider shortening for better engagement (<250 characters)');
    }

    // Topic recommendations
    if (analysis.topics.length === 0) {
      recommendations.push('Add relevant health topics for better discovery');
    }

    // Engagement recommendations
    if (!analysis.hasEmojis) {
      recommendations.push('Consider adding 1-2 relevant emojis');
    }

    return recommendations;
  }

  private async storeLearningInsights(insights: LearningInsight[]): Promise<void> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      await dbManager.initialize();

      for (const insight of insights) {
        await dbManager.executeQuery(
          `store_insight_${insight.type}`,
          async (client) => {
            const { error } = await client.from('learning_insights').upsert({
              insight_type: insight.type,
              insight_data: {
                insight: insight.insight,
                confidence: insight.confidence,
                evidence: insight.evidence,
                recommendation: insight.recommendation,
                impactScore: insight.impactScore
              },
              confidence_score: insight.confidence,
              created_at: new Date().toISOString()
            });
            
            if (error) throw error;
            return true;
          },
          `insight_${insight.type}`,
          3600000 // 1 hour cache
        );
      }

      console.log('📊 Learning insights stored successfully');
    } catch (error: any) {
      console.error('Failed to store learning insights:', error.message);
    }
  }

  private async getStoredInsights(): Promise<LearningInsight[]> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      await dbManager.initialize();

      const data = await dbManager.executeQuery(
        'get_stored_insights',
        async (client) => {
          const { data, error } = await client
            .from('learning_insights')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
          
          if (error) throw error;
          return data || [];
        },
        'stored_insights',
        3600000 // 1 hour cache
      );

      return data.map(row => ({
        type: row.insight_type,
        insight: row.insight_data.insight,
        confidence: row.confidence_score,
        evidence: row.insight_data.evidence || [],
        recommendation: row.insight_data.recommendation,
        impactScore: row.insight_data.impactScore || 5
      }));

    } catch (error: any) {
      console.error('Failed to get stored insights:', error.message);
      return [];
    }
  }

  private getDefaultRecommendations() {
    return {
      optimalLength: 150,
              bestTopics: ['productivity tips', 'life hacks', 'surprising facts'],
      optimalTime: { hour: 12, confidence: 0.5 },
      contentStyle: 'question',
      engagementHooks: ['Did you know', 'Quick reminder', 'Pro tip'],
      expectedScore: 50
    };
  }

  /**
   * Initialize learning system with scheduled analysis
   */
  public async initialize(): Promise<void> {
    console.log('🧠 Initializing Intelligent Learning Engine...');
    
    // Run initial analysis
    await this.learnFromPerformanceData();

    // Schedule regular learning updates
    setInterval(async () => {
      try {
        await this.learnFromPerformanceData();
        console.log('🔄 Learning patterns updated');
      } catch (error) {
        console.error('⚠️ Scheduled learning update failed:', error);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours

    console.log('✅ Intelligent Learning Engine initialized');
  }
}