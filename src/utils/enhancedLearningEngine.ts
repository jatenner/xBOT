/**
 * 🧠 ENHANCED LEARNING ENGINE
 * 
 * Advanced machine learning system that analyzes tweet performance data
 * to discover patterns and optimize for follower growth and engagement.
 * 
 * Features:
 * - Performance pattern recognition
 * - Follower growth optimization
 * - Content characteristic analysis
 * - Predictive performance scoring
 * - Continuous algorithm improvement
 * - Real-time content recommendations
 */

import { supabaseClient } from './supabaseClient';
import { BudgetAwareOpenAI } from './budgetAwareOpenAI';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';

export interface PerformancePattern {
  id?: string;
  pattern_type: 'content_type' | 'timing' | 'format' | 'tone' | 'topic';
  pattern_name: string;
  pattern_features?: any;
  avg_performance_score: number;
  avg_follower_growth: number;
  sample_size: number;
  confidence_level: number;
  validation_status?: 'active' | 'testing' | 'deprecated';
  // Additional fields that may be present from database
  pattern_description?: string;
  last_validated?: string;
  updated_at?: string;
  overall_score?: number;
  follower_score?: number;
  new_followers_attributed?: number;
  scores?: number[];
  followers?: number[];
}

export interface ContentRecommendation {
  recommended_content_type?: string;
  recommended_tone?: string;
  recommended_format?: string;
  optimal_timing?: {
    hour: number;
    day_of_week: number;
  };
  predicted_performance_score?: number;
  predicted_follower_growth?: number;
  confidence?: number;
  reasoning?: string;
}

export interface LearningInsights {
  total_tweets_analyzed: number;
  patterns_discovered: number;
  top_performing_patterns: PerformancePattern[];
  content_recommendations: ContentRecommendation;
  performance_trends: {
    avg_score_trend: number; // positive = improving
    follower_growth_trend: number;
    engagement_trend: number;
  };
  cost_effectiveness: {
    cost_per_follower: number;
    cost_per_engagement: number;
    roi_score: number;
  };
}

export class EnhancedLearningEngine {
  private static budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  
  /**
   * 🚀 RUN COMPREHENSIVE LEARNING CYCLE
   * Analyzes all available data to extract insights and patterns
   */
  static async runLearningCycle(): Promise<{
    success: boolean;
    insights?: LearningInsights;
    error?: string;
  }> {
    try {
      console.log('🧠 Starting enhanced learning cycle...');
      
      // Step 1: Analyze performance patterns
      const patterns = await this.discoverPerformancePatterns();
      console.log(`📊 Discovered ${patterns.length} performance patterns`);
      
      // Step 2: Generate content recommendations
      const recommendations = await this.generateContentRecommendations(patterns);
      console.log('🎯 Generated content recommendations');
      
      // Step 3: Calculate performance trends
      const trends = await this.calculatePerformanceTrends();
      console.log('📈 Calculated performance trends');
      
      // Step 4: Analyze cost effectiveness
      const costEffectiveness = await this.analyzeCostEffectiveness();
      console.log('💰 Analyzed cost effectiveness');
      
      // Step 5: Update learning patterns in database
      await this.updateLearningPatterns(patterns);
      console.log('💾 Updated learning patterns in database');
      
      // Step 6: Generate insights summary
      const insights: LearningInsights = {
        total_tweets_analyzed: await this.getTotalTweetsAnalyzed(),
        patterns_discovered: patterns.length,
        top_performing_patterns: patterns.slice(0, 10),
        content_recommendations: recommendations,
        performance_trends: trends,
        cost_effectiveness: costEffectiveness
      };
      
      console.log('✅ Enhanced learning cycle completed successfully');
      return { success: true, insights };
      
    } catch (error) {
      console.error('❌ Enhanced learning cycle failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 🔍 DISCOVER PERFORMANCE PATTERNS
   * Analyzes data to find what content characteristics correlate with success
   */
  private static async discoverPerformancePatterns(): Promise<PerformancePattern[]> {
    const patterns: PerformancePattern[] = [];
    
    // Analyze content type patterns
    const contentTypePatterns = await this.analyzeContentTypePatterns();
    patterns.push(...contentTypePatterns);
    
    // Analyze timing patterns
    const timingPatterns = await this.analyzeTimingPatterns();
    patterns.push(...timingPatterns);
    
    // Analyze tone patterns
    const tonePatterns = await this.analyzeTonePatterns();
    patterns.push(...tonePatterns);
    
    // Analyze topic patterns
    const topicPatterns = await this.analyzeTopicPatterns();
    patterns.push(...topicPatterns);
    
    // Analyze format patterns
    const formatPatterns = await this.analyzeFormatPatterns();
    patterns.push(...formatPatterns);
    
    return patterns.filter(p => p.sample_size >= 5 && p.confidence_level >= 0.7);
  }
  
  /**
   * 📝 ANALYZE CONTENT TYPE PATTERNS
   */
  private static async analyzeContentTypePatterns(): Promise<PerformancePattern[]> {
    const { data, error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .select(`
        content_type,
        tweet_id,
        tweet_performance_scores!inner(
          overall_score,
          follower_score
        ),
        tweet_analytics!inner(
          new_followers_attributed
        )
      `)
      .not('tweet_performance_scores.overall_score', 'is', null);

    if (error || !data) {
      console.warn('⚠️ Failed to fetch content type data:', error);
      return [];
    }

    // Group by content type and calculate averages
    const typeGroups = data.reduce((groups: any, item: any) => {
      const type = item.content_type;
      if (!groups[type]) {
        groups[type] = {
          scores: [],
          followers: [],
          tweets: []
        };
      }
      
      // Safely extract scores and followers from database response
      const performanceData = Array.isArray(item.tweet_performance_scores) 
        ? item.tweet_performance_scores[0] 
        : item.tweet_performance_scores;
      const analyticsData = Array.isArray(item.tweet_analytics) 
        ? item.tweet_analytics[0] 
        : item.tweet_analytics;
      
      if (performanceData?.overall_score !== undefined) {
        groups[type].scores.push(performanceData.overall_score);
      }
      if (analyticsData?.new_followers_attributed !== undefined) {
        groups[type].followers.push(analyticsData.new_followers_attributed);
      }
      groups[type].tweets.push(item.tweet_id);
      return groups;
    }, {});

    const patterns: PerformancePattern[] = [];
    
    for (const [contentType, group] of Object.entries(typeGroups)) {
      const scores = (group as any).scores;
      const followers = (group as any).followers;
      const sampleSize = scores.length;
      
      if (sampleSize >= 3 && scores.length > 0 && followers.length > 0) {
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const avgFollowers = followers.reduce((a: number, b: number) => a + b, 0) / followers.length;
        
        // Calculate confidence based on sample size and consistency
        const scoreVariance = this.calculateVariance(scores);
        const confidence = Math.min(
          0.5 + (sampleSize / 20), // Base confidence from sample size
          1.0 - (scoreVariance / 100) // Reduce confidence for high variance
        );
        
        patterns.push({
          pattern_type: 'content_type',
          pattern_name: contentType,
          pattern_features: { content_type: contentType },
          avg_performance_score: avgScore,
          avg_follower_growth: avgFollowers,
          sample_size: sampleSize,
          confidence_level: Math.max(0.1, confidence),
          validation_status: 'active'
        });
      }
    }
    
    return patterns.sort((a, b) => b.avg_performance_score - a.avg_performance_score);
  }
  
  /**
   * ⏰ ANALYZE TIMING PATTERNS
   */
  private static async analyzeTimingPatterns(): Promise<PerformancePattern[]> {
    const { data, error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .select(`
        posted_hour,
        posted_day_of_week,
        is_weekend,
        tweet_id,
        tweet_performance_scores!inner(
          overall_score,
          follower_score
        ),
        tweet_analytics!inner(
          new_followers_attributed
        )
      `)
      .not('tweet_performance_scores.overall_score', 'is', null);

    if (error || !data) {
      console.warn('⚠️ Failed to fetch timing data:', error);
      return [];
    }

    const patterns: PerformancePattern[] = [];
    
    // Analyze by hour
    const hourlyData = data.reduce((groups: any, item: any) => {
      const hour = item.posted_hour;
      if (!groups[hour]) {
        groups[hour] = { scores: [], followers: [] };
      }
      
      // Safely extract scores and followers from database response
      const performanceData = Array.isArray(item.tweet_performance_scores) 
        ? item.tweet_performance_scores[0] 
        : item.tweet_performance_scores;
      const analyticsData = Array.isArray(item.tweet_analytics) 
        ? item.tweet_analytics[0] 
        : item.tweet_analytics;
      
      if (performanceData?.overall_score !== undefined) {
        groups[hour].scores.push(performanceData.overall_score);
      }
      if (analyticsData?.new_followers_attributed !== undefined) {
        groups[hour].followers.push(analyticsData.new_followers_attributed);
      }
      return groups;
    }, {});

    for (const [hour, group] of Object.entries(hourlyData)) {
      const scores = (group as any).scores;
      const followers = (group as any).followers;
      const sampleSize = scores.length;
      
      if (sampleSize >= 3 && scores.length > 0 && followers.length > 0) {
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const avgFollowers = followers.reduce((a: number, b: number) => a + b, 0) / followers.length;
        const confidence = Math.min(0.3 + (sampleSize / 15), 0.9);
        
        patterns.push({
          pattern_type: 'timing',
          pattern_name: `Hour ${hour}`,
          pattern_features: { hour: parseInt(hour) },
          avg_performance_score: avgScore,
          avg_follower_growth: avgFollowers,
          sample_size: sampleSize,
          confidence_level: confidence,
          validation_status: 'active'
        });
      }
    }
    
    // Analyze weekend vs weekday
    const weekendData = data.reduce((groups: any, item: any) => {
      const key = item.is_weekend ? 'weekend' : 'weekday';
      if (!groups[key]) {
        groups[key] = { scores: [], followers: [] };
      }
      
      // Safely extract scores and followers from database response
      const performanceData = Array.isArray(item.tweet_performance_scores) 
        ? item.tweet_performance_scores[0] 
        : item.tweet_performance_scores;
      const analyticsData = Array.isArray(item.tweet_analytics) 
        ? item.tweet_analytics[0] 
        : item.tweet_analytics;
      
      if (performanceData?.overall_score !== undefined) {
        groups[key].scores.push(performanceData.overall_score);
      }
      if (analyticsData?.new_followers_attributed !== undefined) {
        groups[key].followers.push(analyticsData.new_followers_attributed);
      }
      return groups;
    }, {});

    for (const [period, group] of Object.entries(weekendData)) {
      const scores = (group as any).scores;
      const followers = (group as any).followers;
      const sampleSize = scores.length;
      
      if (sampleSize >= 5 && scores.length > 0 && followers.length > 0) {
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const avgFollowers = followers.reduce((a: number, b: number) => a + b, 0) / followers.length;
        const confidence = Math.min(0.4 + (sampleSize / 20), 0.9);
        
        patterns.push({
          pattern_type: 'timing',
          pattern_name: period,
          pattern_features: { is_weekend: period === 'weekend' },
          avg_performance_score: avgScore,
          avg_follower_growth: avgFollowers,
          sample_size: sampleSize,
          confidence_level: confidence,
          validation_status: 'active'
        });
      }
    }
    
    return patterns.sort((a, b) => b.avg_performance_score - a.avg_performance_score);
  }
  
  /**
   * 🎨 ANALYZE TONE PATTERNS
   */
  private static async analyzeTonePatterns(): Promise<PerformancePattern[]> {
    const { data, error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .select(`
        tone_profile,
        tweet_id,
        tweet_performance_scores!inner(
          overall_score,
          follower_score
        ),
        tweet_analytics!inner(
          new_followers_attributed
        )
      `)
      .not('tweet_performance_scores.overall_score', 'is', null);

    if (error || !data) {
      console.warn('⚠️ Failed to fetch tone data:', error);
      return [];
    }

    // Group by tone and calculate performance
    const toneGroups = data.reduce((groups: any, item: any) => {
      const tone = item.tone_profile;
      if (!groups[tone]) {
        groups[tone] = { scores: [], followers: [] };
      }
      
      // Safely extract scores and followers from database response
      const performanceData = Array.isArray(item.tweet_performance_scores) 
        ? item.tweet_performance_scores[0] 
        : item.tweet_performance_scores;
      const analyticsData = Array.isArray(item.tweet_analytics) 
        ? item.tweet_analytics[0] 
        : item.tweet_analytics;
      
      if (performanceData?.overall_score !== undefined) {
        groups[tone].scores.push(performanceData.overall_score);
      }
      if (analyticsData?.new_followers_attributed !== undefined) {
        groups[tone].followers.push(analyticsData.new_followers_attributed);
      }
      return groups;
    }, {});

    const patterns: PerformancePattern[] = [];
    
    for (const [tone, group] of Object.entries(toneGroups)) {
      const scores = (group as any).scores;
      const followers = (group as any).followers;
      const sampleSize = scores.length;
      
      if (sampleSize >= 3 && scores.length > 0 && followers.length > 0) {
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const avgFollowers = followers.reduce((a: number, b: number) => a + b, 0) / followers.length;
        const confidence = Math.min(0.4 + (sampleSize / 15), 0.9);
        
        patterns.push({
          pattern_type: 'tone',
          pattern_name: tone,
          pattern_features: { tone_profile: tone },
          avg_performance_score: avgScore,
          avg_follower_growth: avgFollowers,
          sample_size: sampleSize,
          confidence_level: confidence,
          validation_status: 'active'
        });
      }
    }
    
    return patterns.sort((a, b) => b.avg_performance_score - a.avg_performance_score);
  }
  
  /**
   * 📚 ANALYZE TOPIC PATTERNS
   */
  private static async analyzeTopicPatterns(): Promise<PerformancePattern[]> {
    const { data, error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .select(`
        primary_topic,
        tweet_id,
        tweet_performance_scores!inner(
          overall_score,
          follower_score
        ),
        tweet_analytics!inner(
          new_followers_attributed
        )
      `)
      .not('tweet_performance_scores.overall_score', 'is', null)
      .not('primary_topic', 'is', null);

    if (error || !data) {
      console.warn('⚠️ Failed to fetch topic data:', error);
      return [];
    }

    // Group by topic and calculate performance
    const topicGroups = data.reduce((groups: any, item: any) => {
      const topic = item.primary_topic;
      if (!groups[topic]) {
        groups[topic] = { scores: [], followers: [] };
      }
      
      // Safely extract scores and followers from database response
      const performanceData = Array.isArray(item.tweet_performance_scores) 
        ? item.tweet_performance_scores[0] 
        : item.tweet_performance_scores;
      const analyticsData = Array.isArray(item.tweet_analytics) 
        ? item.tweet_analytics[0] 
        : item.tweet_analytics;
      
      if (performanceData?.overall_score !== undefined) {
        groups[topic].scores.push(performanceData.overall_score);
      }
      if (analyticsData?.new_followers_attributed !== undefined) {
        groups[topic].followers.push(analyticsData.new_followers_attributed);
      }
      return groups;
    }, {});

    const patterns: PerformancePattern[] = [];
    
    for (const [topic, group] of Object.entries(topicGroups)) {
      const scores = (group as any).scores;
      const followers = (group as any).followers;
      const sampleSize = scores.length;
      
      if (sampleSize >= 3 && scores.length > 0 && followers.length > 0) {
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const avgFollowers = followers.reduce((a: number, b: number) => a + b, 0) / followers.length;
        const confidence = Math.min(0.4 + (sampleSize / 15), 0.9);
        
        patterns.push({
          id: `topic_${topic}`,
          pattern_type: 'topic',
          pattern_name: topic,
          pattern_features: { primary_topic: topic },
          avg_performance_score: avgScore,
          avg_follower_growth: avgFollowers,
          sample_size: sampleSize,
          confidence_level: confidence,
          validation_status: 'active'
        });
      }
    }
    
    return patterns.sort((a, b) => b.avg_performance_score - a.avg_performance_score);
  }
  
  /**
   * 📐 ANALYZE FORMAT PATTERNS
   */
  private static async analyzeFormatPatterns(): Promise<PerformancePattern[]> {
    const { data, error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .select(`
        format_style,
        has_question,
        has_call_to_action,
        has_emoji,
        has_hashtags,
        tweet_id,
        tweet_performance_scores!inner(
          overall_score,
          follower_score
        ),
        tweet_analytics!inner(
          new_followers_attributed
        )
      `)
      .not('tweet_performance_scores.overall_score', 'is', null);

    if (error || !data) {
      console.warn('⚠️ Failed to fetch format data:', error);
      return [];
    }

    const patterns: PerformancePattern[] = [];
    
    // Analyze format styles
    const formatGroups = data.reduce((groups: any, item: any) => {
      const format = item.format_style;
      if (!groups[format]) {
        groups[format] = { scores: [], followers: [] };
      }
      
      // Safely extract scores and followers from database response
      const performanceData = Array.isArray(item.tweet_performance_scores) 
        ? item.tweet_performance_scores[0] 
        : item.tweet_performance_scores;
      const analyticsData = Array.isArray(item.tweet_analytics) 
        ? item.tweet_analytics[0] 
        : item.tweet_analytics;
      
      if (performanceData?.overall_score !== undefined) {
        groups[format].scores.push(performanceData.overall_score);
      }
      if (analyticsData?.new_followers_attributed !== undefined) {
        groups[format].followers.push(analyticsData.new_followers_attributed);
      }
      return groups;
    }, {});

    for (const [format, group] of Object.entries(formatGroups)) {
      const scores = (group as any).scores;
      const followers = (group as any).followers;
      const sampleSize = scores.length;
      
      if (sampleSize >= 3 && scores.length > 0 && followers.length > 0) {
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const avgFollowers = followers.reduce((a: number, b: number) => a + b, 0) / followers.length;
        const confidence = Math.min(0.4 + (sampleSize / 15), 0.9);
        
        patterns.push({
          id: `format_${format}`,
          pattern_type: 'format',
          pattern_name: format,
          pattern_features: { format_style: format },
          avg_performance_score: avgScore,
          avg_follower_growth: avgFollowers,
          sample_size: sampleSize,
          confidence_level: confidence,
          validation_status: 'active'
        });
      }
    }
    
    // Analyze engagement elements
    const elementAnalysis = ['has_question', 'has_call_to_action', 'has_emoji', 'has_hashtags'];
    
    for (const element of elementAnalysis) {
      const withElement = data.filter((item: any) => item[element]);
      const withoutElement = data.filter((item: any) => !item[element]);
      
      if (withElement.length >= 3 && withoutElement.length >= 3) {
        const withScores = withElement.map((item: any) => {
          const performanceData = Array.isArray(item.tweet_performance_scores) 
            ? item.tweet_performance_scores[0] 
            : item.tweet_performance_scores;
          return performanceData?.overall_score || 0;
        });
        const withFollowers = withElement.map((item: any) => {
          const analyticsData = Array.isArray(item.tweet_analytics) 
            ? item.tweet_analytics[0] 
            : item.tweet_analytics;
          return analyticsData?.new_followers_attributed || 0;
        });
        const withoutScores = withoutElement.map((item: any) => {
          const performanceData = Array.isArray(item.tweet_performance_scores) 
            ? item.tweet_performance_scores[0] 
            : item.tweet_performance_scores;
          return performanceData?.overall_score || 0;
        });
        const withoutFollowers = withoutElement.map((item: any) => {
          const analyticsData = Array.isArray(item.tweet_analytics) 
            ? item.tweet_analytics[0] 
            : item.tweet_analytics;
          return analyticsData?.new_followers_attributed || 0;
        });
        
        const withAvgScore = withScores.reduce((a: number, b: number) => a + b, 0) / withScores.length;
        const withAvgFollowers = withFollowers.reduce((a: number, b: number) => a + b, 0) / withFollowers.length;
        const withoutAvgScore = withoutScores.reduce((a: number, b: number) => a + b, 0) / withoutScores.length;
        const withoutAvgFollowers = withoutFollowers.reduce((a: number, b: number) => a + b, 0) / withoutFollowers.length;
        
        // Only create pattern if there's a meaningful difference
        const scoreDiff = withAvgScore - withoutAvgScore;
        const followerDiff = withAvgFollowers - withoutAvgFollowers;
        
        if (Math.abs(scoreDiff) > 2 || Math.abs(followerDiff) > 0.1) {
          const confidence = Math.min(0.5 + (withElement.length / 20), 0.9);
          
          patterns.push({
            id: `element_${element}`,
            pattern_type: 'format',
            pattern_name: `${element.replace('has_', '')} elements`,
            pattern_features: { [element]: true },
            avg_performance_score: withAvgScore,
            avg_follower_growth: withAvgFollowers,
            sample_size: withElement.length,
            confidence_level: confidence,
            validation_status: 'active'
          });
        }
      }
    }
    
    return patterns.sort((a, b) => b.avg_performance_score - a.avg_performance_score);
  }
  
  /**
   * 🎯 GENERATE CONTENT RECOMMENDATIONS
   * Creates intelligent recommendations based on discovered patterns
   */
  private static async generateContentRecommendations(patterns: PerformancePattern[]): Promise<ContentRecommendation> {
    // Find best patterns by type
    const bestContentType = patterns.filter(p => p.pattern_type === 'content_type')[0];
    const bestTone = patterns.filter(p => p.pattern_type === 'tone')[0];
    const bestFormat = patterns.filter(p => p.pattern_type === 'format')[0];
    const bestTiming = patterns.filter(p => p.pattern_type === 'timing' && p.pattern_features.hour !== undefined)[0];
    
    // Calculate weighted predictions
    const patterns_to_consider = [bestContentType, bestTone, bestFormat].filter(Boolean);
    const avgPredictedScore = patterns_to_consider.length > 0 ? 
      patterns_to_consider.reduce((sum, p) => sum + p.avg_performance_score, 0) / patterns_to_consider.length : 50;
    const avgPredictedFollowers = patterns_to_consider.length > 0 ?
      patterns_to_consider.reduce((sum, p) => sum + p.avg_follower_growth, 0) / patterns_to_consider.length : 1;
    
    // Calculate confidence based on pattern strength
    const avgConfidence = patterns_to_consider.length > 0 ?
      patterns_to_consider.reduce((sum, p) => sum + p.confidence_level, 0) / patterns_to_consider.length : 0.5;
    
    return {
      recommended_content_type: bestContentType?.pattern_name || 'single_tip',
      recommended_tone: bestTone?.pattern_name || 'conversational',
      recommended_format: bestFormat?.pattern_name || 'narrative',
      optimal_timing: {
        hour: bestTiming?.pattern_features?.hour || 12,
        day_of_week: 1 // Default to Tuesday
      },
      predicted_performance_score: avgPredictedScore,
      predicted_follower_growth: avgPredictedFollowers,
      confidence: avgConfidence,
      reasoning: `Based on analysis of ${patterns.length} performance patterns. Top performing content type: ${bestContentType?.pattern_name || 'unknown'} (${bestContentType?.avg_performance_score?.toFixed(1) || 'N/A'} score), tone: ${bestTone?.pattern_name || 'unknown'} (${bestTone?.avg_performance_score?.toFixed(1) || 'N/A'} score).`
    };
  }
  
  /**
   * 📈 CALCULATE PERFORMANCE TRENDS
   * Analyzes how performance is changing over time
   */
  private static async calculatePerformanceTrends(): Promise<{
    avg_score_trend: number;
    follower_growth_trend: number;
    engagement_trend: number;
  }> {
    // Get performance data for the last 30 days, grouped by day
    const { data, error } = await supabaseClient.supabase
      .from('daily_performance_summary')
      .select('summary_date, avg_performance_score, new_followers, avg_engagement_rate')
      .gte('summary_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('summary_date', { ascending: true });

    if (error || !data || data.length < 7) {
      console.warn('⚠️ Insufficient data for trend analysis');
      return {
        avg_score_trend: 0,
        follower_growth_trend: 0,
        engagement_trend: 0
      };
    }

    // Calculate trends using linear regression
    const scoreTrend = this.calculateTrend(data.map(d => d.avg_performance_score || 0));
    const followerTrend = this.calculateTrend(data.map(d => d.new_followers || 0));
    const engagementTrend = this.calculateTrend(data.map(d => d.avg_engagement_rate || 0));

    return {
      avg_score_trend: scoreTrend,
      follower_growth_trend: followerTrend,
      engagement_trend: engagementTrend
    };
  }
  
  /**
   * 💰 ANALYZE COST EFFECTIVENESS
   */
  private static async analyzeCostEffectiveness(): Promise<{
    cost_per_follower: number;
    cost_per_engagement: number;
    roi_score: number;
  }> {
    // Get recent cost and performance data
    const { data, error } = await supabaseClient.supabase
      .from('daily_performance_summary')
      .select('ai_cost_usd, new_followers, total_likes, total_retweets, total_replies')
      .gte('summary_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('ai_cost_usd', 'is', null);

    if (error || !data || data.length === 0) {
      return {
        cost_per_follower: 0,
        cost_per_engagement: 0,
        roi_score: 0
      };
    }

    const totalCost = data.reduce((sum, d) => sum + (d.ai_cost_usd || 0), 0);
    const totalFollowers = data.reduce((sum, d) => sum + (d.new_followers || 0), 0);
    const totalEngagements = data.reduce((sum, d) => 
      sum + (d.total_likes || 0) + (d.total_retweets || 0) + (d.total_replies || 0), 0);

    const costPerFollower = totalFollowers > 0 ? totalCost / totalFollowers : 0;
    const costPerEngagement = totalEngagements > 0 ? totalCost / totalEngagements : 0;
    
    // Calculate ROI score (higher is better)
    // Assumes each follower is worth $0.10 and each engagement is worth $0.01
    const followerValue = totalFollowers * 0.10;
    const engagementValue = totalEngagements * 0.01;
    const totalValue = followerValue + engagementValue;
    const roiScore = totalCost > 0 ? (totalValue / totalCost) : 0;

    return {
      cost_per_follower: costPerFollower,
      cost_per_engagement: costPerEngagement,
      roi_score: roiScore
    };
  }
  
  /**
   * 💾 UPDATE LEARNING PATTERNS
   * Stores discovered patterns in the database
   */
  private static async updateLearningPatterns(patterns: PerformancePattern[]): Promise<void> {
    for (const pattern of patterns) {
      const { error } = await supabaseClient.supabase
        .from('learning_patterns')
        .upsert({
          pattern_type: pattern.pattern_type,
          pattern_name: pattern.pattern_name,
          pattern_description: `Pattern discovered from ${pattern.sample_size} tweets with ${(pattern.confidence_level * 100).toFixed(0)}% confidence`,
          pattern_features: pattern.pattern_features,
          sample_size: pattern.sample_size,
          avg_performance_score: pattern.avg_performance_score,
          avg_follower_growth: pattern.avg_follower_growth,
          confidence_level: pattern.confidence_level,
          validation_status: pattern.validation_status,
          last_validated: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'pattern_type,pattern_name'
        });

      if (error) {
        console.warn(`⚠️ Failed to update pattern ${pattern.pattern_name}:`, error);
      }
    }
  }
  
  /**
   * 📊 UTILITY: CALCULATE VARIANCE
   */
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }
  
  /**
   * 📈 UTILITY: CALCULATE LINEAR TREND
   */
  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    
    const numerator = xValues.reduce((sum, x, i) => sum + (x - xMean) * (values[i] - yMean), 0);
    const denominator = xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0);
    
    return denominator !== 0 ? numerator / denominator : 0;
  }
  
  /**
   * 📊 UTILITY: GET TOTAL TWEETS ANALYZED
   */
  private static async getTotalTweetsAnalyzed(): Promise<number> {
    const { count, error } = await supabaseClient.supabase
      .from('tweet_content_features')
      .select('*', { count: 'exact', head: true });

    return error ? 0 : (count || 0);
  }
  
  /**
   * 🎯 GET CONTENT RECOMMENDATIONS FOR GENERATION
   * Returns optimized recommendations for the content generator
   */
  static async getContentRecommendations(): Promise<ContentRecommendation | null> {
    try {
      // Get latest learning insights
      const { data, error } = await supabaseClient.supabase
        .from('learning_patterns')
        .select('*')
        .eq('validation_status', 'active')
        .gte('confidence_level', 0.6)
        .order('avg_performance_score', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        console.warn('⚠️ No learning patterns available for recommendations');
        return null;
      }

      return this.generateContentRecommendations(data);
    } catch (error) {
      console.error('❌ Failed to get content recommendations:', error);
      return null;
    }
  }
}

export const enhancedLearningEngine = EnhancedLearningEngine;