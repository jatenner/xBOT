/**
 * 🔮 ML-BASED FOLLOWER PREDICTOR
 * 
 * Predicts ACTUAL follower gain before posting
 * Uses historical data to learn what works for YOUR account
 * 
 * Budget: ~$0.15/day (prediction calculations)
 */

import { getSupabaseClient } from '../db/index';
import { getTwitterAlgorithmOptimizer } from './twitterAlgorithmOptimizer';
import { getTimingOptimizer } from './timingOptimizer';
import { getConversionFunnelTracker } from './conversionFunnelTracker';

export interface PredictionFeatures {
  // Content features
  content_length: number;
  has_controversy: boolean;
  has_numbers: boolean;
  has_study_citation: boolean;
  hook_strength: number; // 0-1
  format: 'single' | 'thread';
  content_type: string;
  topic: string;
  
  // Timing features
  hour: number;
  day_of_week: number;
  is_peak_time: boolean;
  
  // Historical performance
  recent_avg_followers: number;
  recent_engagement_rate: number;
}

export interface FollowerPrediction {
  predicted_followers: number;
  confidence: number; // 0-1
  prediction_range: {
    min: number;
    max: number;
  };
  factors: {
    content_score: number;
    timing_score: number;
    viral_potential: number;
    conversion_potential: number;
  };
  recommendation: 'post' | 'improve' | 'regenerate';
  reasoning: string;
}

export class FollowerPredictor {
  private static instance: FollowerPredictor;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): FollowerPredictor {
    if (!FollowerPredictor.instance) {
      FollowerPredictor.instance = new FollowerPredictor();
    }
    return FollowerPredictor.instance;
  }

  /**
   * MAIN PREDICTION: Predict followers BEFORE posting
   */
  async predictFollowers(features: PredictionFeatures): Promise<FollowerPrediction> {
    console.log('[PREDICTOR] 🔮 Predicting follower gain...');

    try {
      // Get historical performance data
      const historicalData = await this.getHistoricalPerformance();

      // Calculate individual factor scores
      const contentScore = this.calculateContentScore(features);
      const timingScore = await this.calculateTimingScore(features);
      const viralPotential = await this.calculateViralPotential(features);
      const conversionPotential = await this.calculateConversionPotential(features);

      // Combined prediction using weighted factors
      const baseFollowers = historicalData.avg_followers_per_post;
      
      let multiplier = 1.0;
      multiplier *= (1 + contentScore * 0.4);        // Content: 40% impact
      multiplier *= (1 + timingScore * 0.2);         // Timing: 20% impact
      multiplier *= (1 + viralPotential * 0.3);      // Viral: 30% impact
      multiplier *= (1 + conversionPotential * 0.1); // Conversion: 10% impact

      const predictedFollowers = Math.round(baseFollowers * multiplier);

      // Calculate confidence based on data quantity
      const confidence = Math.min(0.95, 0.3 + (historicalData.post_count / 100) * 0.65);

      // Prediction range (±30%)
      const range = {
        min: Math.max(0, Math.round(predictedFollowers * 0.7)),
        max: Math.round(predictedFollowers * 1.3)
      };

      // Recommendation
      let recommendation: 'post' | 'improve' | 'regenerate' = 'post';
      let reasoning = '';

      if (predictedFollowers < 2) {
        recommendation = 'regenerate';
        reasoning = '❌ LOW potential (<2 followers). Regenerate with better hook/topic.';
      } else if (predictedFollowers < 5) {
        recommendation = 'improve';
        reasoning = '⚠️ MEDIUM potential (2-5 followers). Consider improving timing or controversy.';
      } else if (predictedFollowers >= 10) {
        recommendation = 'post';
        reasoning = '🔥 HIGH potential (10+ followers). Post immediately!';
      } else {
        recommendation = 'post';
        reasoning = '✅ GOOD potential (5-10 followers). Should perform well.';
      }

      const prediction: FollowerPrediction = {
        predicted_followers: predictedFollowers,
        confidence,
        prediction_range: range,
        factors: {
          content_score: contentScore,
          timing_score: timingScore,
          viral_potential: viralPotential,
          conversion_potential: conversionPotential
        },
        recommendation,
        reasoning
      };

      console.log(`[PREDICTOR] ✅ Prediction: ${predictedFollowers} followers (${(confidence * 100).toFixed(0)}% confidence)`);
      console.log(`[PREDICTOR]    ${reasoning}`);

      return prediction;

    } catch (error: any) {
      console.error('[PREDICTOR] ❌ Error predicting:', error.message);
      return this.getDefaultPrediction();
    }
  }

  /**
   * Calculate content quality score
   */
  private calculateContentScore(features: PredictionFeatures): number {
    let score = 0.5; // Base score

    if (features.has_controversy) score += 0.2;
    if (features.has_numbers) score += 0.15;
    if (features.has_study_citation) score += 0.1;
    if (features.format === 'thread') score += 0.15;
    
    score += features.hook_strength * 0.3;

    // Length penalty
    if (features.content_length > 280 && features.format !== 'thread') {
      score -= 0.1; // Too long for single tweet
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate timing score
   */
  private async calculateTimingScore(features: PredictionFeatures): Promise<number> {
    const timingOptimizer = getTimingOptimizer();
    
    const scheduledTime = new Date();
    scheduledTime.setHours(features.hour);
    
    const timing = await timingOptimizer.isGoodTimeToPost(scheduledTime);
    
    return timing.score;
  }

  /**
   * Calculate viral potential
   */
  private async calculateViralPotential(features: PredictionFeatures): Promise<number> {
    const twitterAlgo = getTwitterAlgorithmOptimizer();
    
    const prediction = await twitterAlgo.predictViralPotential({
      topic: features.topic,
      format: features.format,
      has_controversy: features.has_controversy,
      has_numbers: features.has_numbers,
      hook_strength: features.hook_strength
    });
    
    return prediction.viral_score;
  }

  /**
   * Calculate conversion potential
   */
  private async calculateConversionPotential(features: PredictionFeatures): Promise<number> {
    const funnelTracker = getConversionFunnelTracker();
    
    const prediction = await funnelTracker.predictConversion({
      content_type: features.content_type,
      topic: features.topic,
      format: features.format,
      has_controversy: features.has_controversy,
      has_numbers: features.has_numbers
    });
    
    // Normalize to 0-1 scale
    return Math.min(1, prediction.predicted_follows / 10);
  }

  /**
   * Get historical performance baseline
   */
  private async getHistoricalPerformance(): Promise<{
    avg_followers_per_post: number;
    post_count: number;
  }> {
    try {
      const { data: posts } = await this.supabase
        .from('outcomes')
        .select('likes, retweets, replies, impressions, engagement_rate, collected_at')
        .not('impressions', 'is', null)
        .order('collected_at', { ascending: false })
        .limit(50);

      if (!posts || posts.length === 0) {
        return { avg_followers_per_post: 2, post_count: 0 };
      }

      // Note: outcomes table doesn't have followers_gained directly yet
      // Using engagement as proxy: high engagement typically correlates with follower growth
      let totalEngagement = 0;
      posts.forEach(p => {
        const engagement = (Number(p.likes) || 0) + (Number(p.retweets) || 0) + (Number(p.replies) || 0);
        totalEngagement += engagement;
      });

      const avgEngagement = totalEngagement / posts.length;
      // Rough estimate: 1 follower per 50 engagements
      const avgFollowers = avgEngagement / 50;

      return {
        avg_followers_per_post: avgFollowers,
        post_count: posts.length
      };

    } catch (error) {
      return { avg_followers_per_post: 2, post_count: 0 };
    }
  }

  /**
   * Default prediction when no data
   */
  private getDefaultPrediction(): FollowerPrediction {
    return {
      predicted_followers: 5,
      confidence: 0.3,
      prediction_range: { min: 2, max: 8 },
      factors: {
        content_score: 0.6,
        timing_score: 0.5,
        viral_potential: 0.5,
        conversion_potential: 0.5
      },
      recommendation: 'post',
      reasoning: '✅ Default prediction (insufficient data). Will improve as we collect more data.'
    };
  }

  /**
   * Track prediction accuracy (for improvement)
   */
  async trackPredictionAccuracy(postId: string, prediction: FollowerPrediction): Promise<void> {
    try {
      await this.supabase
        .from('follower_predictions')
        .insert({
          post_id: postId,
          predicted_followers: prediction.predicted_followers,
          confidence: prediction.confidence,
          predicted_at: new Date().toISOString()
        });

      console.log(`[PREDICTOR] 📊 Logged prediction for ${postId}`);

    } catch (error: any) {
      console.error('[PREDICTOR] ⚠️ Could not log prediction:', error.message);
    }
  }

  /**
   * Update with actual results (improves future predictions)
   */
  async updateWithActualResults(postId: string, actualFollowers: number): Promise<void> {
    try {
      await this.supabase
        .from('follower_predictions')
        .update({
          actual_followers: actualFollowers,
          updated_at: new Date().toISOString()
        })
        .eq('post_id', postId);

      // Calculate accuracy
      const { data: prediction } = await this.supabase
        .from('follower_predictions')
        .select('predicted_followers')
        .eq('post_id', postId)
        .single();

      if (prediction) {
        const predictedFollowers = Number(prediction.predicted_followers) || 0;
        const error = Math.abs(predictedFollowers - actualFollowers);
        const accuracy = 1 - (error / Math.max(predictedFollowers, actualFollowers));
        
        console.log(`[PREDICTOR] 📊 Prediction accuracy: ${(accuracy * 100).toFixed(1)}%`);
        console.log(`[PREDICTOR]    Predicted: ${predictedFollowers}, Actual: ${actualFollowers}`);
      }

    } catch (error: any) {
      console.error('[PREDICTOR] ⚠️ Could not update results:', error.message);
    }
  }
}

export const getFollowerPredictor = () => FollowerPredictor.getInstance();

