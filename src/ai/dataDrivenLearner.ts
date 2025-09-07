/**
 * 🧠 DATA-DRIVEN LEARNING ENGINE
 * 
 * Continuously learns from engagement data to improve content quality
 * - Real-time performance analysis and pattern extraction
 * - Adaptive content optimization based on follower growth
 * - Dynamic strategy adjustment for maximum engagement
 * - Eliminates low-performing patterns automatically
 */

import { admin as supabase } from '../lib/supabaseClients';

interface LearningMetrics {
  content_pattern: string;
  performance_score: number;
  follower_conversion_rate: number;
  engagement_rate: number;
  sample_size: number;
  confidence_level: number;
  trend_direction: 'improving' | 'declining' | 'stable';
}

interface ContentPattern {
  id: string;
  pattern_type: 'opener' | 'structure' | 'topic' | 'voice_style' | 'length' | 'timing';
  pattern_text: string;
  success_count: number;
  failure_count: number;
  avg_engagement_rate: number;
  avg_follower_conversion: number;
  last_performance_update: string;
  confidence_score: number;
}

interface LearningRecommendations {
  amplify_patterns: string[];
  avoid_patterns: string[];
  experiment_patterns: string[];
  optimal_posting_strategy: {
    best_times: number[];
    content_length_range: { min: number; max: number };
    optimal_content_types: string[];
    voice_style_recommendations: string[];
  };
}

interface PerformanceInsight {
  insight_type: 'pattern_success' | 'pattern_failure' | 'timing_optimization' | 'voice_improvement';
  description: string;
  confidence: number;
  action_recommended: string;
  expected_improvement: number;
}

export class DataDrivenLearner {
  private static instance: DataDrivenLearner;
  private learningMetrics: LearningMetrics[] = [];
  private contentPatterns: ContentPattern[] = [];
  private minSampleSize = 5; // Minimum posts needed for reliable patterns
  private confidenceThreshold = 0.7; // 70% confidence required for decisions

  private constructor() {
    this.initializeLearning();
  }

  public static getInstance(): DataDrivenLearner {
    if (!DataDrivenLearner.instance) {
      DataDrivenLearner.instance = new DataDrivenLearner();
    }
    return DataDrivenLearner.instance;
  }

  /**
   * 🚀 Initialize learning system
   */
  private async initializeLearning(): Promise<void> {
    console.log('🧠 DATA_LEARNER: Initializing data-driven learning engine...');
    await this.loadHistoricalPatterns();
    await this.analyzeCurrentPerformance();
  }

  /**
   * 📊 Analyze real-time performance and update learning
   */
  public async analyzePerformanceAndLearn(postData: {
    content: string;
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
      followers_gained: number;
    };
    post_time: string;
    content_type: string;
  }): Promise<PerformanceInsight[]> {
    console.log('🧠 DATA_LEARNER: Analyzing post performance for learning...');

    const insights: PerformanceInsight[] = [];
    
    // Extract patterns from the content
    const extractedPatterns = this.extractContentPatterns(postData.content, postData.content_type);
    
    // Calculate performance metrics
    const engagementRate = postData.engagement.impressions > 0 
      ? (postData.engagement.likes + postData.engagement.retweets + postData.engagement.replies) / postData.engagement.impressions 
      : 0;
    
    const followerConversion = postData.engagement.impressions > 0
      ? postData.engagement.followers_gained / postData.engagement.impressions
      : 0;

    // Update pattern performance
    for (const pattern of extractedPatterns) {
      await this.updatePatternPerformance(pattern, engagementRate, followerConversion);
    }

    // Generate insights based on performance
    insights.push(...await this.generatePerformanceInsights(postData, engagementRate, followerConversion));

    // Update learning metrics
    await this.updateLearningMetrics();

    console.log(`✅ DATA_LEARNER: Generated ${insights.length} performance insights`);
    return insights;
  }

  /**
   * 🔍 Extract content patterns for analysis
   */
  private extractContentPatterns(content: string, contentType: string): ContentPattern[] {
    const patterns: ContentPattern[] = [];
    
    // Extract opener patterns
    const openerMatch = content.match(/^([^.!?]{1,50}[.!?])/);
    if (openerMatch) {
      patterns.push(this.createPattern('opener', openerMatch[1], contentType));
    }

    // Extract structure patterns
    const questionCount = (content.match(/\?/g) || []).length;
    if (questionCount > 0) {
      patterns.push(this.createPattern('structure', `${questionCount}_questions`, contentType));
    }

    // Extract length patterns
    const lengthCategory = this.categorizeLength(content.length);
    patterns.push(this.createPattern('length', lengthCategory, contentType));

    // Extract voice style patterns
    const voiceStyle = this.detectVoiceStyle(content);
    if (voiceStyle) {
      patterns.push(this.createPattern('voice_style', voiceStyle, contentType));
    }

    // Extract topic patterns (basic keyword extraction)
    const topicKeywords = this.extractTopicKeywords(content);
    topicKeywords.forEach(keyword => {
      patterns.push(this.createPattern('topic', keyword, contentType));
    });

    return patterns;
  }

  /**
   * 🆕 Create content pattern
   */
  private createPattern(type: string, text: string, contentType: string): ContentPattern {
    const patternId = `${type}_${text}_${contentType}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    return {
      id: patternId,
      pattern_type: type as any,
      pattern_text: text,
      success_count: 0,
      failure_count: 0,
      avg_engagement_rate: 0,
      avg_follower_conversion: 0,
      last_performance_update: new Date().toISOString(),
      confidence_score: 0
    };
  }

  /**
   * 📈 Update pattern performance based on results
   */
  private async updatePatternPerformance(
    pattern: ContentPattern, 
    engagementRate: number, 
    followerConversion: number
  ): Promise<void> {
    try {
      // Using imported supabase admin client
      
      // Define success thresholds
      const engagementThreshold = 0.03; // 3% engagement rate
      const followerThreshold = 0.01; // 1% follower conversion (realistic target)

      const isSuccess = engagementRate >= engagementThreshold && followerConversion >= followerThreshold;
      
      // Load existing pattern or create new
      const { data: existingPattern } = await supabase
        .from('content_patterns')
        .select('*')
        .eq('pattern_id', pattern.id)
        .single();

      if (existingPattern) {
        // Update existing pattern
        const newSuccessCount = existingPattern.success_count + (isSuccess ? 1 : 0);
        const newFailureCount = existingPattern.failure_count + (isSuccess ? 0 : 1);
        const totalCount = newSuccessCount + newFailureCount;
        
        const newAvgEngagement = (existingPattern.avg_engagement_rate * (totalCount - 1) + engagementRate) / totalCount;
        const newAvgFollowerConversion = (existingPattern.avg_follower_conversion * (totalCount - 1) + followerConversion) / totalCount;
        
        // Calculate confidence based on sample size and consistency
        const confidenceScore = this.calculateConfidence(newSuccessCount, totalCount);

        await supabase
          .from('content_patterns')
          .update({
            success_count: newSuccessCount,
            failure_count: newFailureCount,
            avg_engagement_rate: newAvgEngagement,
            avg_follower_conversion: newAvgFollowerConversion,
            confidence_score: confidenceScore,
            last_performance_update: new Date().toISOString()
          })
          .eq('pattern_id', pattern.id);

      } else {
        // Create new pattern
        await supabase
          .from('content_patterns')
          .insert({
            pattern_id: pattern.id,
            pattern_type: pattern.pattern_type,
            pattern_text: pattern.pattern_text,
            success_count: isSuccess ? 1 : 0,
            failure_count: isSuccess ? 0 : 1,
            avg_engagement_rate: engagementRate,
            avg_follower_conversion: followerConversion,
            confidence_score: 0.1, // Low confidence for new patterns
            last_performance_update: new Date().toISOString()
          });
      }

      console.log(`📊 DATA_LEARNER: Updated pattern "${pattern.pattern_text}" - Success: ${isSuccess}`);
    } catch (error) {
      console.warn('⚠️ DATA_LEARNER: Failed to update pattern performance:', error);
    }
  }

  /**
   * 💡 Generate performance insights
   */
  private async generatePerformanceInsights(
    postData: any, 
    engagementRate: number, 
    followerConversion: number
  ): Promise<PerformanceInsight[]> {
    const insights: PerformanceInsight[] = [];
    
    // High performance insight
    if (engagementRate > 0.05 && followerConversion > 0.003) {
      insights.push({
        insight_type: 'pattern_success',
        description: `Content achieved ${(engagementRate * 100).toFixed(1)}% engagement with ${postData.engagement.followers_gained} new followers`,
        confidence: 0.9,
        action_recommended: 'Amplify similar content patterns',
        expected_improvement: 25
      });
    }

    // Low performance insight
    if (engagementRate < 0.02 && postData.engagement.impressions > 100) {
      insights.push({
        insight_type: 'pattern_failure',
        description: `Low engagement despite ${postData.engagement.impressions} impressions suggests content pattern issues`,
        confidence: 0.8,
        action_recommended: 'Avoid current content structure and voice patterns',
        expected_improvement: 15
      });
    }

    // Timing insight
    const postHour = new Date(postData.post_time).getHours();
    const timingPerformance = await this.analyzeTimingPerformance(postHour, engagementRate);
    if (timingPerformance.confidence > 0.7) {
      insights.push({
        insight_type: 'timing_optimization',
        description: timingPerformance.description,
        confidence: timingPerformance.confidence,
        action_recommended: timingPerformance.recommendation,
        expected_improvement: timingPerformance.improvement
      });
    }

    // Voice improvement insight
    if (followerConversion < 0.001 && engagementRate > 0.03) {
      insights.push({
        insight_type: 'voice_improvement',
        description: 'High engagement but low follower conversion suggests voice/authenticity issues',
        confidence: 0.75,
        action_recommended: 'Increase personal touch and authenticity in voice',
        expected_improvement: 20
      });
    }

    return insights;
  }

  /**
   * 🕐 Analyze timing performance
   */
  private async analyzeTimingPerformance(hour: number, currentEngagement: number): Promise<{
    description: string;
    confidence: number;
    recommendation: string;
    improvement: number;
  }> {
    try {
      // Using imported supabase admin client
      
      // Get historical performance by hour
      const { data: hourlyData } = await supabase
        .from('post_performance_by_hour')
        .select('hour, avg_engagement_rate, post_count')
        .gte('post_count', 3) // Only consider hours with enough data
        .order('avg_engagement_rate', { ascending: false });

      if (!hourlyData || hourlyData.length === 0) {
        return { description: 'Insufficient timing data', confidence: 0, recommendation: 'Continue posting', improvement: 0 };
      }

      const currentHourData = hourlyData.find(d => d.hour === hour);
      const bestHour = hourlyData[0];
      const avgEngagement = hourlyData.reduce((sum, d) => sum + d.avg_engagement_rate, 0) / hourlyData.length;

      if (currentHourData && currentHourData.avg_engagement_rate < avgEngagement * 0.8) {
        const potentialImprovement = ((bestHour.avg_engagement_rate - currentHourData.avg_engagement_rate) / currentHourData.avg_engagement_rate) * 100;
        
        return {
          description: `Hour ${hour} historically underperforms (${(currentHourData.avg_engagement_rate * 100).toFixed(1)}% vs best ${(bestHour.avg_engagement_rate * 100).toFixed(1)}%)`,
          confidence: 0.8,
          recommendation: `Consider posting at hour ${bestHour.hour} instead`,
          improvement: Math.round(potentialImprovement)
        };
      }

      return { description: 'Timing appears optimal', confidence: 0.6, recommendation: 'Continue current timing', improvement: 0 };
    } catch (error) {
      return { description: 'Timing analysis failed', confidence: 0, recommendation: 'Continue posting', improvement: 0 };
    }
  }

  /**
   * 🎯 Get learning-based recommendations
   */
  public async getLearningRecommendations(): Promise<LearningRecommendations> {
    console.log('🧠 DATA_LEARNER: Generating learning-based recommendations...');
    
    await this.loadHistoricalPatterns();
    
    const amplifyPatterns: string[] = [];
    const avoidPatterns: string[] = [];
    const experimentPatterns: string[] = [];

    // Analyze high-confidence patterns
    this.contentPatterns.forEach(pattern => {
      if (pattern.confidence_score >= this.confidenceThreshold) {
        const successRate = pattern.success_count / (pattern.success_count + pattern.failure_count);
        
        if (successRate >= 0.7 && pattern.avg_follower_conversion > 0.002) {
          amplifyPatterns.push(pattern.pattern_text);
        } else if (successRate <= 0.3) {
          avoidPatterns.push(pattern.pattern_text);
        }
      } else if ((pattern.success_count + pattern.failure_count) >= this.minSampleSize) {
        experimentPatterns.push(pattern.pattern_text);
      }
    });

    // Generate optimal posting strategy
    const optimalStrategy = await this.generateOptimalStrategy();

    const recommendations: LearningRecommendations = {
      amplify_patterns: amplifyPatterns.slice(0, 10), // Top 10
      avoid_patterns: avoidPatterns.slice(0, 10),
      experiment_patterns: experimentPatterns.slice(0, 5),
      optimal_posting_strategy: optimalStrategy
    };

    console.log(`✅ DATA_LEARNER: Generated recommendations - Amplify: ${amplifyPatterns.length}, Avoid: ${avoidPatterns.length}`);
    return recommendations;
  }

  /**
   * 🎯 Generate optimal posting strategy
   */
  private async generateOptimalStrategy(): Promise<any> {
    try {
      // Using imported supabase admin client
      
      // Get best performing times
      const { data: timingData } = await supabase
        .from('post_performance_by_hour')
        .select('hour, avg_engagement_rate')
        .gte('post_count', 3)
        .order('avg_engagement_rate', { ascending: false })
        .limit(6);

      // Get optimal content lengths
      const { data: lengthData } = await supabase
        .from('content_length_performance')
        .select('length_range, avg_follower_conversion')
        .order('avg_follower_conversion', { ascending: false })
        .limit(1);

      // Get best content types
      const { data: contentTypeData } = await supabase
        .from('content_type_performance')
        .select('content_type, avg_engagement_rate')
        .order('avg_engagement_rate', { ascending: false })
        .limit(5);

      // Get best voice styles
      const highPerformingVoiceStyles = this.contentPatterns
        .filter(p => p.pattern_type === 'voice_style' && p.confidence_score > 0.6)
        .sort((a, b) => b.avg_follower_conversion - a.avg_follower_conversion)
        .slice(0, 3)
        .map(p => p.pattern_text);

      return {
        best_times: timingData?.map(d => d.hour) || [9, 13, 17, 20],
        content_length_range: lengthData?.[0] ? 
          JSON.parse(lengthData[0].length_range) : 
          { min: 140, max: 220 },
        optimal_content_types: contentTypeData?.map(d => d.content_type) || ['personal_discovery', 'counterintuitive_insight'],
        voice_style_recommendations: highPerformingVoiceStyles.length > 0 ? 
          highPerformingVoiceStyles : 
          ['curious_observer', 'experienced_friend']
      };
    } catch (error) {
      console.warn('⚠️ DATA_LEARNER: Strategy generation failed:', error);
      return {
        best_times: [9, 13, 17, 20],
        content_length_range: { min: 140, max: 220 },
        optimal_content_types: ['personal_discovery', 'counterintuitive_insight'],
        voice_style_recommendations: ['curious_observer', 'experienced_friend']
      };
    }
  }

  /**
   * 📚 Load historical patterns from database
   */
  private async loadHistoricalPatterns(): Promise<void> {
    try {
      // Using imported supabase admin client
      
      const { data } = await supabase
        .from('content_patterns')
        .select('*')
        .gte('confidence_score', 0.3) // Only load patterns with some confidence
        .order('avg_follower_conversion', { ascending: false });

      if (data) {
        this.contentPatterns = data.map(row => ({
          id: row.pattern_id,
          pattern_type: row.pattern_type,
          pattern_text: row.pattern_text,
          success_count: row.success_count,
          failure_count: row.failure_count,
          avg_engagement_rate: row.avg_engagement_rate,
          avg_follower_conversion: row.avg_follower_conversion,
          last_performance_update: row.last_performance_update,
          confidence_score: row.confidence_score
        }));

        console.log(`📚 DATA_LEARNER: Loaded ${this.contentPatterns.length} historical patterns`);
      }
    } catch (error) {
      console.warn('⚠️ DATA_LEARNER: Failed to load historical patterns:', error);
    }
  }

  /**
   * 🔢 Calculate confidence score
   */
  private calculateConfidence(successCount: number, totalCount: number): number {
    if (totalCount < this.minSampleSize) return Math.min(0.5, totalCount / this.minSampleSize * 0.5);
    
    const successRate = successCount / totalCount;
    const sampleSizeBonus = Math.min(0.3, (totalCount - this.minSampleSize) / 20 * 0.3);
    
    // Higher confidence for extreme success/failure rates with good sample sizes
    let baseConfidence = 0.5;
    if (successRate >= 0.8 || successRate <= 0.2) {
      baseConfidence = 0.8;
    } else if (successRate >= 0.7 || successRate <= 0.3) {
      baseConfidence = 0.7;
    }
    
    return Math.min(0.95, baseConfidence + sampleSizeBonus);
  }

  /**
   * 🎯 Helper methods for pattern extraction
   */
  private categorizeLength(length: number): string {
    if (length < 100) return 'very_short';
    if (length < 150) return 'short';
    if (length < 200) return 'medium';
    if (length < 250) return 'long';
    return 'very_long';
  }

  private detectVoiceStyle(content: string): string | null {
    if (/\b(I noticed|I realized|I found|I discovered)\b/i.test(content)) return 'personal_discovery';
    if (/\b(turns out|opposite|wrong|misconception)\b/i.test(content)) return 'counterintuitive';
    if (/\b(tried|tested|experiment|been doing)\b/i.test(content)) return 'experimental';
    if (/\b(noticed|anyone else|curious|weird)\b/i.test(content)) return 'observational';
    if (/\b(myth|believe|common|people say)\b/i.test(content)) return 'myth_busting';
    return null;
  }

  private extractTopicKeywords(content: string): string[] {
    const healthKeywords = [
      'sleep', 'nutrition', 'exercise', 'stress', 'metabolism', 'inflammation',
      'gut', 'brain', 'heart', 'immunity', 'energy', 'recovery', 'focus',
      'meditation', 'fasting', 'supplement', 'vitamin', 'protein', 'carbs'
    ];
    
    return healthKeywords.filter(keyword => 
      new RegExp(`\\b${keyword}`, 'i').test(content)
    );
  }

  private async analyzeCurrentPerformance(): Promise<void> {
    // Implementation for current performance analysis
    console.log('📊 DATA_LEARNER: Analyzing current performance trends...');
  }

  private async updateLearningMetrics(): Promise<void> {
    // Implementation for updating learning metrics
    console.log('📈 DATA_LEARNER: Updating learning metrics...');
  }
}
