/**
 * 📚 CONTENT PERFORMANCE LEARNING SYSTEM
 * =====================================
 * Automatically learns from engagement patterns to improve future predictions
 * Leverages your sophisticated learning table infrastructure
 */

import { supabase } from '../utils/supabaseClient';
import { EnhancedOpenAIClient } from '../utils/enhancedOpenAIClient';

interface PerformanceData {
  tweetId: string;
  content: string;
  contentType: string;
  actualFollowers: number;
  actualLikes: number;
  actualRetweets: number;
  actualReplies: number;
  actualImpressions: number;
  predictedFollowers?: number;
  predictedLikes?: number;
  postedAt: Date;
  timingData: {
    hour: number;
    dayOfWeek: number;
  };
}

interface LearningInsight {
  pattern: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  evidence: any;
}

export class ContentPerformanceLearning {

  /**
   * 🧠 MAIN LEARNING FUNCTION
   * Analyzes recent performance and extracts actionable insights
   */
  async learnFromRecentPerformance(): Promise<LearningInsight[]> {
    console.log('📚 === CONTENT PERFORMANCE LEARNING STARTING ===');
    
    try {
      // 1. Gather recent performance data
      const performanceData = await this.gatherRecentPerformanceData();
      
      if (performanceData.length < 5) {
        console.log('⚠️ Insufficient data for learning (need 5+ tweets)');
        return [];
      }

      // 2. Analyze prediction accuracy
      const predictionAccuracy = await this.analyzePredictionAccuracy(performanceData);
      
      // 3. Identify content patterns
      const contentPatterns = await this.identifyContentPatterns(performanceData);
      
      // 4. Analyze timing patterns
      const timingPatterns = await this.analyzeTimingPatterns(performanceData);
      
      // 5. Extract follower growth insights
      const followerInsights = await this.extractFollowerGrowthInsights(performanceData);
      
      // 6. Generate AI insights
      const aiInsights = await this.generateAIInsights(performanceData);
      
      // 7. Store learning insights
      const allInsights = [
        ...predictionAccuracy,
        ...contentPatterns,
        ...timingPatterns,
        ...followerInsights,
        ...aiInsights
      ];
      
      await this.storeLearningInsights(allInsights);
      
      console.log(`✅ Learning completed: ${allInsights.length} insights generated`);
      return allInsights;
      
    } catch (error) {
      console.error('❌ Learning system error:', error);
      return [];
    }
  }

  /**
   * 📊 GATHER RECENT PERFORMANCE DATA
   * Collects actual vs predicted performance data
   */
  private async gatherRecentPerformanceData(): Promise<PerformanceData[]> {
    // Get recent tweets with actual performance
    const { data: recentTweets } = await supabase
      .from('tweets')
      .select(`
        id, tweet_id, content, content_type,
        new_followers, likes, retweets, replies, impressions,
        posted_at, hour_posted, day_of_week
      `)
      .not('posted_at', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(50);

    if (!recentTweets) return [];

    // Get predictions for these tweets
    const tweetHashes = recentTweets.map(t => this.hashContent(t.content));
    
    const { data: predictions } = await supabase
      .from('content_performance_predictions')
      .select('*')
      .in('content_hash', tweetHashes);

    // Combine actual and predicted data
    return recentTweets.map(tweet => {
      const prediction = predictions?.find(p => 
        p.content_hash === this.hashContent(tweet.content)
      );

      return {
        tweetId: tweet.tweet_id,
        content: tweet.content,
        contentType: tweet.content_type || 'text',
        actualFollowers: tweet.new_followers || 0,
        actualLikes: tweet.likes || 0,
        actualRetweets: tweet.retweets || 0,
        actualReplies: tweet.replies || 0,
        actualImpressions: tweet.impressions || 0,
        predictedFollowers: prediction?.predicted_followers,
        predictedLikes: prediction?.predicted_likes,
        postedAt: new Date(tweet.posted_at),
        timingData: {
          hour: tweet.hour_posted || 12,
          dayOfWeek: tweet.day_of_week || 1
        }
      };
    });
  }

  /**
   * 🎯 ANALYZE PREDICTION ACCURACY
   * Learns how accurate our predictions are
   */
  private async analyzePredictionAccuracy(data: PerformanceData[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Filter tweets with predictions
    const tweetsWithPredictions = data.filter(t => 
      t.predictedFollowers !== undefined && t.predictedLikes !== undefined
    );

    if (tweetsWithPredictions.length < 3) return insights;

    // Calculate accuracy metrics
    const followerAccuracy = this.calculateAccuracy(
      tweetsWithPredictions.map(t => t.actualFollowers),
      tweetsWithPredictions.map(t => t.predictedFollowers!)
    );

    const likesAccuracy = this.calculateAccuracy(
      tweetsWithPredictions.map(t => t.actualLikes),
      tweetsWithPredictions.map(t => t.predictedLikes!)
    );

    // Generate insights based on accuracy
    if (followerAccuracy < 60) {
      insights.push({
        pattern: 'low_follower_prediction_accuracy',
        confidence: 0.8,
        impact: 'high',
        recommendation: 'Improve follower growth prediction model - consider more timing and content factors',
        evidence: { accuracy: followerAccuracy, sampleSize: tweetsWithPredictions.length }
      });
    }

    if (likesAccuracy < 70) {
      insights.push({
        pattern: 'low_engagement_prediction_accuracy',
        confidence: 0.7,
        impact: 'medium',
        recommendation: 'Refine engagement prediction algorithms - analyze content hooks more deeply',
        evidence: { accuracy: likesAccuracy, sampleSize: tweetsWithPredictions.length }
      });
    }

    return insights;
  }

  /**
   * 📝 IDENTIFY CONTENT PATTERNS
   * Finds what content types/topics perform best
   */
  private async identifyContentPatterns(data: PerformanceData[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Group by content type
    const byType = this.groupBy(data, 'contentType');
    
    for (const [type, tweets] of Object.entries(byType)) {
      if (tweets.length < 3) continue;
      
      const avgFollowers = tweets.reduce((sum, t) => sum + t.actualFollowers, 0) / tweets.length;
      const avgLikes = tweets.reduce((sum, t) => sum + t.actualLikes, 0) / tweets.length;
      
      // High performing content type
      if (avgFollowers > 2 && tweets.length >= 5) {
        insights.push({
          pattern: `high_performing_content_type_${type}`,
          confidence: Math.min(0.9, tweets.length / 10),
          impact: 'high',
          recommendation: `Focus more on ${type} content - averaging ${avgFollowers.toFixed(1)} followers per post`,
          evidence: { contentType: type, avgFollowers, avgLikes, sampleSize: tweets.length }
        });
      }
      
      // Low performing content type
      if (avgFollowers < 0.5 && tweets.length >= 5) {
        insights.push({
          pattern: `low_performing_content_type_${type}`,
          confidence: Math.min(0.8, tweets.length / 10),
          impact: 'medium',
          recommendation: `Reduce or improve ${type} content - only averaging ${avgFollowers.toFixed(1)} followers per post`,
          evidence: { contentType: type, avgFollowers, avgLikes, sampleSize: tweets.length }
        });
      }
    }

    return insights;
  }

  /**
   * ⏰ ANALYZE TIMING PATTERNS
   * Identifies optimal posting times
   */
  private async analyzeTimingPatterns(data: PerformanceData[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Group by hour
    const byHour = this.groupBy(data, (t: PerformanceData) => t.timingData.hour);
    
    let bestHour = -1;
    let bestPerformance = -1;
    
    for (const [hour, tweets] of Object.entries(byHour)) {
      if (tweets.length < 2) continue;
      
      const avgEngagement = tweets.reduce((sum, t) => 
        sum + (t.actualLikes + t.actualRetweets * 3 + t.actualReplies * 5), 0
      ) / tweets.length;
      
      if (avgEngagement > bestPerformance) {
        bestPerformance = avgEngagement;
        bestHour = parseInt(hour);
      }
    }
    
    if (bestHour !== -1 && bestPerformance > 10) {
      insights.push({
        pattern: 'optimal_posting_hour',
        confidence: 0.7,
        impact: 'medium',
        recommendation: `Best posting time appears to be ${bestHour}:00 - ${bestPerformance.toFixed(1)} avg engagement`,
        evidence: { hour: bestHour, avgEngagement: bestPerformance }
      });
    }

    return insights;
  }

  /**
   * 👥 EXTRACT FOLLOWER GROWTH INSIGHTS
   * Analyzes what drives follower growth specifically
   */
  private async extractFollowerGrowthInsights(data: PerformanceData[]): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Find tweets that gained followers
    const followerGrowthTweets = data.filter(t => t.actualFollowers > 0);
    
    if (followerGrowthTweets.length < 3) {
      insights.push({
        pattern: 'low_follower_acquisition',
        confidence: 0.9,
        impact: 'high',
        recommendation: 'Focus on follower-driving content - very few tweets gaining followers',
        evidence: { 
          totalTweets: data.length, 
          followerGrowthTweets: followerGrowthTweets.length,
          ratio: followerGrowthTweets.length / data.length
        }
      });
      return insights;
    }

    // Analyze characteristics of follower-driving tweets
    const avgLength = followerGrowthTweets.reduce((sum, t) => sum + t.content.length, 0) / followerGrowthTweets.length;
    const hasQuestions = followerGrowthTweets.filter(t => t.content.includes('?')).length;
    const hasNumbers = followerGrowthTweets.filter(t => /\d/.test(t.content)).length;
    
    if (hasQuestions / followerGrowthTweets.length > 0.6) {
      insights.push({
        pattern: 'questions_drive_followers',
        confidence: 0.8,
        impact: 'high',
        recommendation: 'Include more questions in tweets - they seem to drive follower growth',
        evidence: { questionRatio: hasQuestions / followerGrowthTweets.length }
      });
    }

    if (hasNumbers / followerGrowthTweets.length > 0.7) {
      insights.push({
        pattern: 'numbers_drive_engagement',
        confidence: 0.7,
        impact: 'medium',
        recommendation: 'Include specific numbers/statistics - they correlate with follower growth',
        evidence: { numberRatio: hasNumbers / followerGrowthTweets.length }
      });
    }

    return insights;
  }

  /**
   * 🤖 GENERATE AI INSIGHTS
   * Uses AI to find patterns humans might miss
   */
  private async generateAIInsights(data: PerformanceData[]): Promise<LearningInsight[]> {
    try {
      const topPerformers = data
        .filter(t => t.actualFollowers > 1 || t.actualLikes > 20)
        .slice(0, 10);

      if (topPerformers.length < 3) return [];

      const analysis = await EnhancedOpenAIClient.generateContent(
        `Analyze these high-performing tweets for patterns. Return JSON array: [{"pattern": "name", "confidence": 0.8, "impact": "high", "recommendation": "advice"}]

Tweets: ${topPerformers.map((t, i) => 
  `${i+1}. "${t.content}" (${t.actualFollowers} followers, ${t.actualLikes} likes)`
).join('\n')}`,
        {
          model: 'gpt-4o-mini',
          max_tokens: 600,
          temperature: 0.3
        }
      );

      const aiInsights = JSON.parse(analysis.content || '[]');
      return aiInsights.slice(0, 3); // Limit to top 3 insights
      
    } catch (error) {
      console.error('AI insights error:', error);
      return [];
    }
  }

  /**
   * 💾 STORE LEARNING INSIGHTS
   * Saves insights for future reference and trend analysis
   */
  private async storeLearningInsights(insights: LearningInsight[]) {
    const insertData = insights.map(insight => ({
      pattern_name: insight.pattern,
      confidence_score: insight.confidence,
      impact_level: insight.impact,
      recommendation: insight.recommendation,
      evidence_data: insight.evidence,
      discovered_at: new Date().toISOString(),
      source: 'content_performance_learning'
    }));

    await supabase.from('ai_learning_insights').insert(insertData);
    
    // Also update learned patterns table
    for (const insight of insights) {
      await supabase.from('learned_performance_patterns').upsert({
        pattern_id: insight.pattern,
        confidence_score: insight.confidence,
        impact_level: insight.impact,
        description: insight.recommendation,
        evidence: insight.evidence,
        last_updated: new Date().toISOString(),
        usage_count: 1
      }, {
        onConflict: 'pattern_id'
      });
    }
  }

  // Helper methods
  private calculateAccuracy(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;
    
    const errors = actual.map((a, i) => Math.abs(a - predicted[i]));
    const meanError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const actualMean = actual.reduce((sum, a) => sum + a, 0) / actual.length;
    
    return Math.max(0, 100 - (meanError / Math.max(actualMean, 1)) * 100);
  }

  private groupBy<T>(array: T[], keyFn: string | ((item: T) => any)): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = typeof keyFn === 'string' ? (item as any)[keyFn] : keyFn(item);
      (groups[key] = groups[key] || []).push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private hashContent(content: string): string {
    return Buffer.from(content).toString('base64').slice(0, 32);
  }
}

export const contentPerformanceLearning = new ContentPerformanceLearning();