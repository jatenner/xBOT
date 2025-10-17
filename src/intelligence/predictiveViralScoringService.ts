/**
 * 🔮 PREDICTIVE VIRAL SCORING SERVICE
 * 
 * Predicts post performance BEFORE generating full content
 * Saves AI costs by preventing low-quality content generation
 */

import { getSupabaseClient } from '../db';
import { HookAnalysisService } from './hookAnalysisService';

export interface PredictedPerformance {
  predictedFollowers: number;
  predictedEngagement: number;
  predictedImpressions: number;
  confidence: number;
  shouldGenerate: boolean;
  reasoning: string;
}

export class PredictiveViralScoringService {
  private static instance: PredictiveViralScoringService;
  
  private constructor() {}
  
  static getInstance(): PredictiveViralScoringService {
    if (!PredictiveViralScoringService.instance) {
      PredictiveViralScoringService.instance = new PredictiveViralScoringService();
    }
    return PredictiveViralScoringService.instance;
  }

  /**
   * Predict performance before generating full content
   */
  async predictPostPerformance(params: {
    topic: string;
    generator: string;
    hook: string;
    hookType: string;
    hour?: number;
  }): Promise<PredictedPerformance> {
    const supabase = getSupabaseClient();
    const hour = params.hour ?? new Date().getHours();
    
    try {
      // Get historical performance for similar posts
      const { data: similar } = await supabase
        .from('outcomes')
        .select('followers_gained, likes, retweets, impressions')
        .eq('topic_cluster', params.topic)
        .eq('generator_used', params.generator)
        .gte('post_hour', hour - 2)
        .lte('post_hour', hour + 2)
        .limit(20);
      
      // No historical data - use conservative defaults
      if (!similar || similar.length === 0) {
        console.log('[PREDICTOR] ℹ️ No historical data, using defaults');
        return {
          predictedFollowers: 0.5,
          predictedEngagement: 15,
          predictedImpressions: 100,
          confidence: 0.1,
          shouldGenerate: true, // Generate anyway, need data
          reasoning: 'No historical data - exploring'
        };
      }
      
      // Calculate baseline averages
      const avgFollowers = similar.reduce((sum, s) => sum + (s.followers_gained || 0), 0) / similar.length;
      const avgLikes = similar.reduce((sum, s) => sum + (s.likes || 0), 0) / similar.length;
      const avgRetweets = similar.reduce((sum, s) => sum + (s.retweets || 0), 0) / similar.length;
      const avgImpressions = similar.reduce((sum, s) => sum + (s.impressions || 0), 0) / similar.length;
      
      // Hook type multiplier
      const hookAnalysis = HookAnalysisService.getInstance();
      const hookPerf = await hookAnalysis.getHookTypePerformance();
      const thisHookPerf = hookPerf[params.hookType];
      
      let hookMultiplier = 1.0;
      if (thisHookPerf && thisHookPerf.count >= 3) {
        // Compare this hook type to average
        const allHookAvgFollowers = Object.values(hookPerf)
          .reduce((sum, p) => sum + (p.avgFollowers || 0), 0) / Object.keys(hookPerf).length;
        
        if (allHookAvgFollowers > 0) {
          hookMultiplier = (thisHookPerf.avgFollowers || 1) / allHookAvgFollowers;
          hookMultiplier = Math.max(0.5, Math.min(2.0, hookMultiplier)); // Clamp to 0.5x-2x
        }
      }
      
      // Apply multiplier
      const predicted = {
        predictedFollowers: avgFollowers * hookMultiplier,
        predictedEngagement: (avgLikes + avgRetweets * 2) * hookMultiplier,
        predictedImpressions: avgImpressions * hookMultiplier,
        confidence: Math.min(1, similar.length / 10), // More data = higher confidence
        shouldGenerate: false,
        reasoning: ''
      };
      
      // Decision: should we generate?
      const minFollowers = parseFloat(process.env.MIN_PREDICTED_FOLLOWERS || '0.3');
      const minEngagement = parseInt(process.env.MIN_PREDICTED_ENGAGEMENT || '15');
      
      if (predicted.predictedFollowers >= minFollowers) {
        predicted.shouldGenerate = true;
        predicted.reasoning = `High follower potential: ${predicted.predictedFollowers.toFixed(1)}`;
      } else if (predicted.predictedEngagement >= minEngagement) {
        predicted.shouldGenerate = true;
        predicted.reasoning = `Good engagement potential: ${Math.round(predicted.predictedEngagement)}`;
      } else if (predicted.confidence < 0.5) {
        predicted.shouldGenerate = true;
        predicted.reasoning = `Low confidence - need more data`;
      } else {
        predicted.shouldGenerate = false;
        predicted.reasoning = `Low potential: ${predicted.predictedFollowers.toFixed(1)} followers, ${Math.round(predicted.predictedEngagement)} engagement`;
      }
      
      return predicted;
      
    } catch (error: any) {
      console.error('[PREDICTOR] ❌ Prediction failed:', error.message);
      
      // On error, default to generate (don't block system)
      return {
        predictedFollowers: 0.5,
        predictedEngagement: 20,
        predictedImpressions: 150,
        confidence: 0,
        shouldGenerate: true,
        reasoning: 'Error in prediction - defaulting to generate'
      };
    }
  }

  /**
   * Store prediction for later accuracy analysis
   */
  async storePrediction(tweetId: string, prediction: PredictedPerformance): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('outcomes')
        .update({
          predicted_followers: prediction.predictedFollowers,
          predicted_engagement: prediction.predictedEngagement
        })
        .eq('tweet_id', tweetId);
      
      console.log(`[PREDICTOR] 📝 Stored prediction for ${tweetId}`);
      
    } catch (error: any) {
      console.warn('[PREDICTOR] ⚠️ Failed to store prediction:', error.message);
    }
  }

  /**
   * Get prediction accuracy stats
   */
  async getPredictionAccuracy() {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('outcomes')
      .select('predicted_followers, followers_gained, predicted_engagement, likes, retweets')
      .not('predicted_followers', 'is', null)
      .not('followers_gained', 'is', null);
    
    if (!data || data.length === 0) {
      return {
        totalPredictions: 0,
        avgFollowerError: 0,
        avgEngagementError: 0,
        accuracy: 0
      };
    }
    
    let followerErrorSum = 0;
    let engagementErrorSum = 0;
    
    for (const outcome of data) {
      const actualFollowers = outcome.followers_gained || 0;
      const predictedFollowers = outcome.predicted_followers || 0;
      followerErrorSum += Math.abs(actualFollowers - predictedFollowers);
      
      const actualEngagement = (outcome.likes || 0) + (outcome.retweets || 0) * 2;
      const predictedEngagement = outcome.predicted_engagement || 0;
      engagementErrorSum += Math.abs(actualEngagement - predictedEngagement);
    }
    
    return {
      totalPredictions: data.length,
      avgFollowerError: followerErrorSum / data.length,
      avgEngagementError: engagementErrorSum / data.length,
      accuracy: 100 - ((followerErrorSum / data.length) * 100 / Math.max(1, data[0].followers_gained || 1))
    };
  }
}

export const predictiveViralScoringService = PredictiveViralScoringService.getInstance();

