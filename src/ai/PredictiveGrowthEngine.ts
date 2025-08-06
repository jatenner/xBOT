/**
 * 🧠 PREDICTIVE GROWTH ENGINE
 * ===========================
 * Predicts follower growth potential BEFORE posting content
 * Uses your sophisticated learning infrastructure for maximum accuracy
 */

import { supabaseClient } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';

interface ContentAnalysis {
  content: string;
  contentType: 'text' | 'thread' | 'poll' | 'quote';
  timing: {
    hour: number;
    dayOfWeek: number;
    optimal: boolean;
  };
  context: {
    recentPerformance: number;
    audienceActivity: number;
    competitorActivity: number;
  };
}

interface GrowthPrediction {
  predictedFollowers: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  reasoning: string;
  expectedEngagement: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
}

export class PredictiveGrowthEngine {
  
  /**
   * 🎯 MAIN PREDICTION FUNCTION
   * Analyzes content and predicts follower growth potential
   */
  async predictGrowthPotential(analysis: ContentAnalysis): Promise<GrowthPrediction> {
    console.log('🧠 === PREDICTIVE GROWTH ANALYSIS STARTING ===');
    
    try {
      // 1. Gather historical performance data
      const historicalData = await this.gatherHistoricalData();
      
      // 2. Analyze content quality and appeal
      const contentScore = await this.analyzeContentQuality(analysis.content, analysis.contentType);
      
      // 3. Check timing optimization
      const timingScore = await this.analyzeTimingOptimization(analysis.timing);
      
      // 4. Assess current context
      const contextScore = await this.analyzeCurrentContext(analysis.context);
      
      // 5. Run AI prediction model
      const prediction = await this.runPredictionModel({
        historicalData,
        contentScore,
        timingScore,
        contextScore,
        analysis
      });
      
      // 6. Store prediction for learning
      await this.storePredictionForLearning(analysis, prediction);
      
      console.log('✅ Growth prediction completed:', {
        predicted: prediction.predictedFollowers,
        confidence: prediction.confidence,
        risk: prediction.riskLevel
      });
      
      return prediction;
      
    } catch (error) {
      console.error('❌ Prediction engine error:', error);
      return this.getDefaultPrediction();
    }
  }

  /**
   * 📊 GATHER HISTORICAL PERFORMANCE DATA
   * Pulls data from your learning infrastructure
   */
  private async gatherHistoricalData() {
          const [
      recentTweets,
      performancePatterns,
      banditData,
      followerGrowth
    ] = await Promise.all([
      // Recent tweet performance
      supabaseClient
        .from('tweets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
        
      // Learned performance patterns
      supabaseClient
        .from('learned_performance_patterns')
        .select('*')
        .order('confidence_score', { ascending: false })
        .limit(20),
        
      // Bandit algorithm insights
      supabaseClient
        .from('bandit_performance_analysis')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
        
      // Follower growth analytics
      supabaseClient
        .from('follower_growth_analytics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30)
    ]);

    return {
      recentTweets: recentTweets.data || [],
      patterns: performancePatterns.data || [],
      banditInsights: banditData.data || [],
      growthHistory: followerGrowth.data || []
    };
  }

  /**
   * 🎯 ANALYZE CONTENT QUALITY & APPEAL
   * Uses AI to assess content for follower growth potential
   */
  private async analyzeContentQuality(content: string, contentType: string): Promise<number> {
    try {
      const client = openaiClient.getClient();
      if (!client) {
        throw new Error('OpenAI client not available');
      }
      
      const analysis = await client.chat.completions.create({
        messages: [{
          role: 'system',
          content: `You are an expert Twitter growth analyst. Analyze this ${contentType} content for follower growth potential.
          
          Score from 0-100 based on:
          - Viral potential (shareability, relatability)
          - Educational value (will people learn something?)
          - Engagement hooks (questions, controversial takes, actionable tips)
          - Authority building (positions author as expert)
          - Community building (encourages responses/discussion)
          
          Return ONLY a JSON object with:
          {
            "score": number (0-100),
            "viral_elements": ["element1", "element2"],
            "engagement_hooks": ["hook1", "hook2"],
            "improvement_suggestions": ["suggestion1", "suggestion2"],
            "target_audience": "description",
            "growth_potential": "low|medium|high"
          }`
        }, {
          role: 'user',
          content: `Analyze this ${contentType}: "${content}"`
        }],
        max_tokens: 500,
        temperature: 0.3
      });

      const result = JSON.parse(analysis.choices[0]?.message?.content || '{"score": 50}');
      
      // Store content analysis for learning
      await supabaseClient.from('content_performance_analysis').insert({
        content_hash: this.hashContent(content),
        content_type: contentType,
        quality_score: result.score,
        viral_elements: result.viral_elements,
        engagement_hooks: result.engagement_hooks,
        improvement_suggestions: result.improvement_suggestions,
        target_audience: result.target_audience,
        growth_potential: result.growth_potential,
        analyzed_at: new Date().toISOString()
      });

      return result.score;
      
    } catch (error) {
      console.error('Content analysis error:', error);
      return 50; // Default neutral score
    }
  }

  /**
   * ⏰ ANALYZE TIMING OPTIMIZATION
   * Leverages optimal_posting_windows data
   */
  private async analyzeTimingOptimization(timing: ContentAnalysis['timing']): Promise<number> {
    try {
      // Get optimal posting windows
      const { data: optimalWindows } = await supabaseClient
        .from('optimal_posting_windows')
        .select('*')
        .eq('day_of_week', timing.dayOfWeek)
        .gte('hour_start', timing.hour - 1)
        .lte('hour_end', timing.hour + 1);

      if (!optimalWindows?.length) return 30; // Poor timing

      const bestWindow = optimalWindows.reduce((best, window) => 
        window.engagement_multiplier > best.engagement_multiplier ? window : best
      );

      // Calculate timing score
      const score = Math.min(100, bestWindow.engagement_multiplier * 50);
      
      // Store timing analysis
      await supabaseClient.from('posting_time_analytics').insert({
        hour_posted: timing.hour,
        day_of_week: timing.dayOfWeek,
        timing_score: score,
        is_optimal: timing.optimal,
        engagement_multiplier: bestWindow.engagement_multiplier,
        analyzed_at: new Date().toISOString()
      });

      return score;
      
    } catch (error) {
      console.error('Timing analysis error:', error);
      return 50;
    }
  }

  /**
   * 🌍 ANALYZE CURRENT CONTEXT
   * Considers recent performance, audience activity, competition
   */
  private async analyzeCurrentContext(context: ContentAnalysis['context']): Promise<number> {
    // Context scoring algorithm
    const recentPerformanceWeight = 0.4;
    const audienceActivityWeight = 0.3;
    const competitorWeight = 0.3;

    const score = 
      (context.recentPerformance * recentPerformanceWeight) +
      (context.audienceActivity * audienceActivityWeight) +
      ((100 - context.competitorActivity) * competitorWeight); // Less competition = better

    // Store context analysis
    await supabaseClient.from('posting_context_analysis').insert({
      recent_performance: context.recentPerformance,
      audience_activity: context.audienceActivity,
      competitor_activity: context.competitorActivity,
      context_score: score,
      analyzed_at: new Date().toISOString()
    });

    return score;
  }

  /**
   * 🤖 RUN AI PREDICTION MODEL
   * Combines all factors for final growth prediction
   */
  private async runPredictionModel(data: any): Promise<GrowthPrediction> {
    try {
      const prompt = `As an expert Twitter growth AI, predict follower growth for this content.

HISTORICAL DATA:
- Recent average followers per tweet: ${this.calculateAverageGrowth(data.historicalData.recentTweets)}
- Best performing pattern score: ${data.historicalData.patterns[0]?.confidence_score || 0}
- Current growth trend: ${this.calculateGrowthTrend(data.historicalData.growthHistory)}

CONTENT ANALYSIS:
- Content quality score: ${data.contentScore}/100
- Timing optimization: ${data.timingScore}/100  
- Current context score: ${data.contextScore}/100

Based on this data, predict:
1. Expected new followers (be realistic, usually 0-5 for most tweets)
2. Confidence level (0-100)
3. Risk assessment
4. Specific recommendations
5. Expected engagement numbers

Return JSON only:
{
  "predictedFollowers": number,
  "confidence": number,
  "riskLevel": "low|medium|high",
  "recommendations": ["rec1", "rec2"],
  "reasoning": "explanation",
  "expectedEngagement": {
    "likes": number,
    "retweets": number, 
    "replies": number,
    "impressions": number
  }
}`;

      const client = openaiClient.getClient();
      if (!client) {
        throw new Error('OpenAI client not available');
      }
      
      const prediction = await client.chat.completions.create({
        messages: [{
          role: 'system',
          content: 'You are a precise Twitter growth prediction AI. Return only valid JSON.'
        }, {
          role: 'user',
          content: prompt
        }],
        max_tokens: 600,
        temperature: 0.2
      });

      return JSON.parse(prediction.choices[0]?.message?.content || '{}');
      
    } catch (error) {
      console.error('Prediction model error:', error);
      return this.getDefaultPrediction();
    }
  }

  /**
   * 💾 STORE PREDICTION FOR LEARNING
   * Saves prediction to enable future learning
   */
  private async storePredictionForLearning(analysis: ContentAnalysis, prediction: GrowthPrediction) {
    await supabaseClient.from('content_performance_predictions').insert({
      content_hash: this.hashContent(analysis.content),
      content_type: analysis.contentType,
      predicted_followers: prediction.predictedFollowers,
      predicted_likes: prediction.expectedEngagement.likes,
      predicted_retweets: prediction.expectedEngagement.retweets,
      predicted_replies: prediction.expectedEngagement.replies,
      predicted_impressions: prediction.expectedEngagement.impressions,
      confidence_score: prediction.confidence,
      risk_level: prediction.riskLevel,
      recommendations: prediction.recommendations,
      reasoning: prediction.reasoning,
      timing_hour: analysis.timing.hour,
      timing_day: analysis.timing.dayOfWeek,
      context_score: analysis.context.recentPerformance,
      predicted_at: new Date().toISOString()
    });
  }

  // Helper methods
  private hashContent(content: string): string {
    return Buffer.from(content).toString('base64').slice(0, 32);
  }

  private calculateAverageGrowth(tweets: any[]): number {
    if (!tweets.length) return 0;
    const totalGrowth = tweets.reduce((sum, tweet) => sum + (tweet.new_followers || 0), 0);
    return totalGrowth / tweets.length;
  }

  private calculateGrowthTrend(growthHistory: any[]): string {
    if (growthHistory.length < 2) return 'stable';
    const recent = growthHistory[0]?.new_followers || 0;
    const previous = growthHistory[1]?.new_followers || 0;
    return recent > previous ? 'increasing' : recent < previous ? 'decreasing' : 'stable';
  }

  private getDefaultPrediction(): GrowthPrediction {
    return {
      predictedFollowers: 1,
      confidence: 50,
      riskLevel: 'medium',
      recommendations: ['Monitor performance', 'Consider timing optimization'],
      reasoning: 'Default prediction due to analysis error',
      expectedEngagement: {
        likes: 10,
        retweets: 2,
        replies: 1,
        impressions: 500
      }
    };
  }
}

export const predictiveGrowthEngine = new PredictiveGrowthEngine();