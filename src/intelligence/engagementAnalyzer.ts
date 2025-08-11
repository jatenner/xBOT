import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

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

  public async analyzeEngagement(tweetId: string, metrics: EngagementMetrics): Promise<ContentAnalysis> {
    try {
      console.log(`📊 Analyzing engagement for tweet ${tweetId}...`);

      // Get tweet content from database
      const tweetData = await this.getTweetData(tweetId);
      if (!tweetData) {
        throw new Error(`Tweet ${tweetId} not found in database`);
      }

      // Calculate derived metrics
      const enhancedMetrics = this.enhanceMetrics(metrics);

      // Analyze content characteristics
      const contentType = this.detectContentType(tweetData.content);
      const topics = this.extractTopics(tweetData.content);
      const sentimentScore = this.analyzeSentiment(tweetData.content);
      const performanceRating = this.ratePerformance(enhancedMetrics);

      const analysis: ContentAnalysis = {
        tweetId,
        content: tweetData.content,
        metrics: enhancedMetrics,
        contentType,
        topics,
        sentimentScore,
        timePosted: tweetData.created_at,
        performanceRating
      };

      // Store analysis results
      await this.storeAnalysis(analysis);

      // Update learning models
      await this.updateLearningModels(analysis);

      console.log(`✅ Analysis complete for ${tweetId}: ${performanceRating} performance`);
      return analysis;

    } catch (error: any) {
      console.error(`❌ Failed to analyze engagement for ${tweetId}:`, error.message);
      throw error;
    }
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

  private async getTweetData(tweetId: string): Promise<any> {
    try {
      const result = await this.db.executeQuery(
        'get_tweet_data',
        async (client) => {
          const { data, error } = await client
            .from('tweets')
            .select('content, created_at')
            .eq('tweet_id', tweetId)
            .single();
          if (error) throw error;
          return data;
        }
      );
      return result || null;
    } catch (error) {
      console.warn(`Failed to get tweet data for ${tweetId}:`, error);
      return null;
    }
  }

  private async storeAnalysis(analysis: ContentAnalysis): Promise<void> {
    try {
      await this.db.executeQuery(`
        INSERT INTO engagement_analysis 
        (tweet_id, content_type, topics, sentiment_score, viral_score, 
         engagement_rate, performance_rating, analyzed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (tweet_id) DO UPDATE SET
        content_type = EXCLUDED.content_type,
        topics = EXCLUDED.topics,
        sentiment_score = EXCLUDED.sentiment_score,
        viral_score = EXCLUDED.viral_score,
        engagement_rate = EXCLUDED.engagement_rate,
        performance_rating = EXCLUDED.performance_rating,
        analyzed_at = EXCLUDED.analyzed_at
      `, [
        analysis.tweetId,
        analysis.contentType,
        JSON.stringify(analysis.topics),
        analysis.sentimentScore,
        analysis.metrics.viralScore,
        analysis.metrics.engagementRate,
        analysis.performanceRating
      ]);
    } catch (error) {
      console.warn('Failed to store engagement analysis:', error);
    }
  }

  private async updateLearningModels(analysis: ContentAnalysis): Promise<void> {
    try {
      // Update topic performance tracking
      for (const topic of analysis.topics) {
        await this.db.executeQuery(`
          INSERT INTO topic_performance 
          (topic, viral_score, engagement_rate, performance_rating, sample_count, last_updated)
          VALUES ($1, $2, $3, $4, 1, NOW())
          ON CONFLICT (topic) DO UPDATE SET
          viral_score = (topic_performance.viral_score * topic_performance.sample_count + EXCLUDED.viral_score) / (topic_performance.sample_count + 1),
          engagement_rate = (topic_performance.engagement_rate * topic_performance.sample_count + EXCLUDED.engagement_rate) / (topic_performance.sample_count + 1),
          sample_count = topic_performance.sample_count + 1,
          last_updated = NOW()
        `, [
          topic,
          analysis.metrics.viralScore,
          analysis.metrics.engagementRate,
          analysis.performanceRating
        ]);
      }

      // Update time-based performance
      const hour = analysis.timePosted.getHours();
      await this.db.executeQuery(`
        INSERT INTO time_performance 
        (hour_of_day, viral_score, engagement_rate, sample_count, last_updated)
        VALUES ($1, $2, $3, 1, NOW())
        ON CONFLICT (hour_of_day) DO UPDATE SET
        viral_score = (time_performance.viral_score * time_performance.sample_count + EXCLUDED.viral_score) / (time_performance.sample_count + 1),
        engagement_rate = (time_performance.engagement_rate * time_performance.sample_count + EXCLUDED.engagement_rate) / (time_performance.sample_count + 1),
        sample_count = time_performance.sample_count + 1,
        last_updated = NOW()
      `, [
        hour,
        analysis.metrics.viralScore,
        analysis.metrics.engagementRate
      ]);

    } catch (error) {
      console.warn('Failed to update learning models:', error);
    }
  }

  public async getTopPerformingTopics(limit: number = 10): Promise<Array<{topic: string, avgViralScore: number, avgEngagementRate: number}>> {
    try {
      const result = await this.db.executeQuery(`
        SELECT topic, viral_score as avg_viral_score, engagement_rate as avg_engagement_rate
        FROM topic_performance 
        WHERE sample_count >= 3
        ORDER BY (viral_score + engagement_rate) DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        topic: row.topic,
        avgViralScore: parseFloat(row.avg_viral_score),
        avgEngagementRate: parseFloat(row.avg_engagement_rate)
      }));
    } catch (error) {
      console.warn('Failed to get top performing topics:', error);
      return [];
    }
  }

  public async getBestPostingTimes(): Promise<Array<{hour: number, score: number}>> {
    try {
      const result = await this.db.executeQuery(`
        SELECT hour_of_day, (viral_score + engagement_rate) as score
        FROM time_performance 
        WHERE sample_count >= 2
        ORDER BY score DESC
        LIMIT 24
      `);

      return result.rows.map(row => ({
        hour: row.hour_of_day,
        score: parseFloat(row.score)
      }));
    } catch (error) {
      console.warn('Failed to get best posting times:', error);
      return [];
    }
  }
}