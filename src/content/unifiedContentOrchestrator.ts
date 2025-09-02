/**
 * UNIFIED CONTENT ORCHESTRATOR
 * Master system that coordinates generation, strategy, growth, and learning
 */

import { MasterContentSystem, ContentResult, ContentPlan } from './masterContentSystem';
import { ContentGrowthEngine, GrowthOptimizedContent } from './contentGrowthEngine';
import { ContentLearningSystem, PostAnalysis } from './contentLearningSystem';
import { AntiSpamContentGenerator } from '../ai/antiSpamContentGenerator';

export interface UltimateContentRequest {
  topic?: string;
  urgency?: 'low' | 'medium' | 'high';
  target_metric?: 'followers' | 'engagement' | 'reach' | 'quality';
  content_type?: 'single' | 'thread' | 'auto';
  learning_priority?: boolean; // Use this post primarily for learning
}

export interface UltimateContentResult {
  content: string;
  metadata: {
    generation_quality: number;
    growth_score: number;
    viral_probability: number;
    authenticity_score: number;
    learning_value: number;
    strategic_alignment: number;
  };
  predictions: {
    likes: number;
    retweets: number;
    replies: number;
    followers_gained: number;
    engagement_rate: number;
  };
  strategy: {
    posting_time: string;
    distribution_plan: string;
    follow_up_actions: string[];
  };
  learning: {
    what_to_track: string[];
    success_metrics: string[];
    hypothesis: string;
  };
}

export interface SystemPerformance {
  total_content_generated: number;
  average_quality_score: number;
  average_growth_score: number;
  total_followers_gained: number;
  learning_insights_count: number;
  system_confidence: number;
}

export class UnifiedContentOrchestrator {
  private static instance: UnifiedContentOrchestrator;
  private masterSystem: MasterContentSystem;
  private growthEngine: ContentGrowthEngine;
  private learningSystem: ContentLearningSystem;
  private antiSpamGenerator: AntiSpamContentGenerator;
  private contentHistory: UltimateContentResult[] = [];

  private constructor() {
    this.masterSystem = MasterContentSystem.getInstance();
    this.growthEngine = ContentGrowthEngine.getInstance();
    this.learningSystem = ContentLearningSystem.getInstance();
    this.antiSpamGenerator = AntiSpamContentGenerator.getInstance();
  }

  public static getInstance(): UnifiedContentOrchestrator {
    if (!UnifiedContentOrchestrator.instance) {
      UnifiedContentOrchestrator.instance = new UnifiedContentOrchestrator();
    }
    return UnifiedContentOrchestrator.instance;
  }

  /**
   * ULTIMATE CONTENT GENERATION
   * Combines all systems for maximum effectiveness
   */
  public async generateUltimateContent(request: UltimateContentRequest = {}): Promise<UltimateContentResult> {
    console.log('🚀 ULTIMATE_ORCHESTRATOR: Starting comprehensive content generation...');
    console.log(`🎯 TARGET: ${request.target_metric || 'balanced'} optimization`);

    // Step 1: Get learning recommendations
    const learningRecs = await this.learningSystem.getNextContentRecommendations();
    console.log(`🧠 LEARNING_RECS: ${learningRecs.confidence}% confidence, suggesting ${learningRecs.suggested_format}`);

    // Step 2: Choose generation strategy based on target
    const strategy = this.selectGenerationStrategy(request, learningRecs);
    console.log(`📋 STRATEGY: ${strategy.approach} approach selected`);

    // Step 3: Generate base content
    const baseContent = await this.generateBaseContent(request, strategy, learningRecs);
    
    // Step 4: Apply growth optimization
    const growthOptimized = await this.growthEngine.optimizeForGrowth(baseContent.content, request.topic || 'health');
    console.log(`📈 GROWTH_OPTIMIZED: ${growthOptimized.growth_score}/100 growth score`);

    // Step 5: Ensure authenticity (anti-spam check)
    const finalContent = await this.ensureAuthenticity(growthOptimized.content);
    
    // Step 6: Comprehensive analysis and predictions
    const analysis = await this.comprehensiveAnalysis(finalContent, growthOptimized, baseContent);
    
    // Step 7: Strategic planning
    const strategicPlan = await this.createStrategicPlan(analysis, growthOptimized);
    
    // Step 8: Learning setup
    const learningPlan = await this.setupLearningTracking(finalContent, request);

    const result: UltimateContentResult = {
      content: finalContent,
      metadata: analysis.metadata,
      predictions: analysis.predictions,
      strategy: strategicPlan,
      learning: learningPlan
    };

    // Store for future learning
    this.contentHistory.push(result);

    console.log(`✅ ULTIMATE_CONTENT: Generated with ${analysis.metadata.generation_quality}/100 quality`);
    console.log(`🎯 PREDICTIONS: ${analysis.predictions.likes} likes, ${analysis.predictions.followers_gained} followers`);
    
    return result;
  }

  /**
   * Learn from posted content performance
   */
  public async learnFromPostedContent(
    contentResult: UltimateContentResult,
    actualPerformance: {
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
      followers_before: number;
      followers_after: number;
    }
  ): Promise<PostAnalysis> {
    console.log('🧠 ORCHESTRATOR_LEARNING: Processing real performance data...');

    // Calculate engagement rate
    const engagement_rate = actualPerformance.impressions > 0 
      ? ((actualPerformance.likes + actualPerformance.retweets + actualPerformance.replies) / actualPerformance.impressions) * 100 
      : 0;

    // Learn through the learning system
    const analysis = await this.learningSystem.learnFromPost(
      contentResult.content,
      {
        likes: actualPerformance.likes,
        retweets: actualPerformance.retweets,
        replies: actualPerformance.replies,
        impressions: actualPerformance.impressions,
        followers_gained: actualPerformance.followers_after - actualPerformance.followers_before,
        engagement_rate
      },
      {
        posted_at: new Date(),
        topic: this.extractTopic(contentResult.content),
        format: contentResult.content.includes('/') ? 'thread' : 'single'
      }
    );

    // Track growth metrics
    await this.growthEngine.trackGrowthMetrics('post_' + Date.now(), 
      { followers_count: actualPerformance.followers_before },
      { 
        followers_count: actualPerformance.followers_after,
        likes_count: actualPerformance.likes,
        retweets_count: actualPerformance.retweets,
        replies_count: actualPerformance.replies,
        impressions_count: actualPerformance.impressions
      }
    );

    // Analyze prediction accuracy
    await this.analyzePredictionAccuracy(contentResult, actualPerformance);

    console.log(`✅ LEARNED: Overall score ${analysis.analysis.overall_score}/100`);
    return analysis;
  }

  /**
   * Get system performance metrics
   */
  public async getSystemPerformance(): Promise<SystemPerformance> {
    const learningData = await this.learningSystem.getLearningData();
    
    const totalFollowersGained = this.contentHistory.reduce((sum, content) => 
      sum + (content.predictions.followers_gained || 0), 0
    );

    const avgQuality = this.contentHistory.reduce((sum, content) => 
      sum + content.metadata.generation_quality, 0
    ) / (this.contentHistory.length || 1);

    const avgGrowthScore = this.contentHistory.reduce((sum, content) => 
      sum + content.metadata.growth_score, 0
    ) / (this.contentHistory.length || 1);

    return {
      total_content_generated: this.contentHistory.length,
      average_quality_score: Math.round(avgQuality),
      average_growth_score: Math.round(avgGrowthScore),
      total_followers_gained: totalFollowersGained,
      learning_insights_count: learningData.key_insights.length,
      system_confidence: Math.min(100, learningData.total_posts_analyzed * 8)
    };
  }

  // Private methods

  private selectGenerationStrategy(request: UltimateContentRequest, learningRecs: any): any {
    const strategies = {
      followers: { approach: 'growth_focused', priority: 'viral_optimization' },
      engagement: { approach: 'engagement_focused', priority: 'community_building' },
      reach: { approach: 'reach_focused', priority: 'shareability' },
      quality: { approach: 'quality_focused', priority: 'authenticity' }
    };

    const target = request.target_metric || 'balanced';
    return strategies[target as keyof typeof strategies] || { approach: 'balanced', priority: 'overall_optimization' };
  }

  private async generateBaseContent(request: UltimateContentRequest, strategy: any, learningRecs: any): Promise<ContentResult> {
    // Choose between master system and anti-spam generator based on strategy
    if (strategy.priority === 'authenticity' || request.urgency === 'high') {
      console.log('🔧 Using AntiSpamContentGenerator for authentic content...');
      const authentic = await this.antiSpamGenerator.generateAuthenticContent(request.topic);
      
      return {
        content: authentic.content,
        metadata: {
          type: 'single' as const,
          topic: request.topic || 'health',
          angle: 'authentic_personal',
          quality_score: authentic.authenticity_score,
          viral_prediction: authentic.engagement_prediction,
          authenticity_score: authentic.authenticity_score,
          strategic_alignment: 85
        },
        performance_prediction: {
          likes: Math.round(authentic.engagement_prediction / 10),
          retweets: Math.round(authentic.engagement_prediction / 20),
          replies: Math.round(authentic.engagement_prediction / 8),
          followers_gained: Math.round(authentic.engagement_prediction / 15)
        }
      };
    } else {
      console.log('🎯 Using MasterContentSystem for strategic content...');
      const contentPlan: Partial<ContentPlan> = {
        content_type: request.content_type === 'auto' ? undefined : request.content_type,
        topic: request.topic
      };
      
      return await this.masterSystem.generateContent(contentPlan);
    }
  }

  private async ensureAuthenticity(content: string): Promise<string> {
    // Check if content passes anti-spam filter
    if (this.antiSpamGenerator.isSpammy(content)) {
      console.log('⚠️ Content flagged as spammy, applying authenticity fixes...');
      
      // Apply fixes
      let fixed = content;
      
      // Remove common spam patterns
      fixed = fixed.replace(/Sleep Myth Busted!|Shocking Health Truth:|Biohack Alert!/gi, '');
      fixed = fixed.replace(/\d+% of people don't know/gi, 'Many people miss');
      fixed = fixed.replace(/According to .* study/gi, 'Research suggests');
      
      // Add personal touch if missing
      if (!fixed.includes('I ') && !fixed.includes('my ')) {
        fixed = `I ${fixed.toLowerCase()}`;
      }
      
      return fixed.trim();
    }
    
    return content;
  }

  private async comprehensiveAnalysis(content: string, growthData: GrowthOptimizedContent, baseData: ContentResult): Promise<{
    metadata: UltimateContentResult['metadata'];
    predictions: UltimateContentResult['predictions'];
  }> {
    
    const authenticity = await this.antiSpamGenerator.generateAuthenticContent();
    const authScore = this.antiSpamGenerator.isSpammy(content) ? 30 : authenticity.authenticity_score;
    
    return {
      metadata: {
        generation_quality: baseData.metadata.quality_score,
        growth_score: growthData.growth_score,
        viral_probability: growthData.viral_prediction.probability,
        authenticity_score: authScore,
        learning_value: this.calculateLearningValue(content),
        strategic_alignment: baseData.metadata.strategic_alignment
      },
      predictions: {
        likes: Math.max(baseData.performance_prediction.likes, Math.round(growthData.growth_score / 10)),
        retweets: Math.max(baseData.performance_prediction.retweets, Math.round(growthData.viral_prediction.probability / 20)),
        replies: Math.max(baseData.performance_prediction.replies, content.includes('?') ? 5 : 2),
        followers_gained: Math.max(baseData.performance_prediction.followers_gained, Math.round(growthData.growth_score / 12)),
        engagement_rate: Math.round((growthData.growth_score + authScore) / 25)
      }
    };
  }

  private async createStrategicPlan(analysis: any, growthData: GrowthOptimizedContent): Promise<UltimateContentResult['strategy']> {
    const hour = new Date().getHours();
    const optimalTime = growthData.viral_prediction.factors.timing_score > 70 
      ? 'Now (optimal timing)' 
      : 'Next peak hour (6-9 AM, 12-2 PM, or 5-8 PM)';

    return {
      posting_time: optimalTime,
      distribution_plan: growthData.distribution_strategy,
      follow_up_actions: [
        'Monitor replies in first 2 hours',
        'Engage with early commenters',
        'Share insights from engagement patterns',
        ...growthData.viral_prediction.recommendations.slice(0, 2)
      ]
    };
  }

  private async setupLearningTracking(content: string, request: UltimateContentRequest): Promise<UltimateContentResult['learning']> {
    const whatToTrack = [
      'Total engagement (likes + retweets + replies)',
      'Reply sentiment and topics',
      'Time to peak engagement',
      'Follower conversion rate'
    ];

    if (content.includes('?')) {
      whatToTrack.push('Reply rate and discussion quality');
    }

    if (content.includes('I tried') || content.includes('I noticed')) {
      whatToTrack.push('Credibility and trust signals in replies');
    }

    return {
      what_to_track: whatToTrack,
      success_metrics: [
        'Engagement rate > 3%',
        'At least 1 new follower per 10 likes',
        'Positive reply sentiment > 80%',
        'Reach expansion > baseline'
      ],
      hypothesis: this.generateHypothesis(content, request)
    };
  }

  private generateHypothesis(content: string, request: UltimateContentRequest): string {
    if (content.includes('Anyone else')) {
      return 'Community questions will drive high reply engagement and foster connection';
    } else if (content.includes('I tried')) {
      return 'Personal experiments will build credibility and inspire action';
    } else if (content.includes('might be backwards')) {
      return 'Contrarian insights will generate discussion and shares';
    } else {
      return 'Authentic, specific content will outperform generic health advice';
    }
  }

  private calculateLearningValue(content: string): number {
    let value = 50; // Base value

    // High learning value indicators
    if (content.includes('?')) value += 20; // Questions generate learnable engagement
    if (content.includes('I tried') || content.includes('I noticed')) value += 15; // Personal experiments
    if (content.includes('Anyone else')) value += 25; // Community builders
    if (/\d+ (days?|weeks?)/.test(content)) value += 10; // Specific timeframes

    return Math.min(100, value);
  }

  private async analyzePredictionAccuracy(predicted: UltimateContentResult, actual: any): Promise<void> {
    const accuracyScore = this.calculateAccuracy(predicted.predictions, {
      likes: actual.likes,
      retweets: actual.retweets,
      replies: actual.replies,
      followers_gained: actual.followers_after - actual.followers_before
    });

    console.log(`🎯 PREDICTION_ACCURACY: ${accuracyScore.toFixed(1)}% accurate`);
    
    if (accuracyScore < 70) {
      console.log('⚠️ Low prediction accuracy - system learning needed');
    }
  }

  private calculateAccuracy(predicted: any, actual: any): number {
    const metrics = ['likes', 'retweets', 'replies', 'followers_gained'];
    let totalAccuracy = 0;

    for (const metric of metrics) {
      const pred = predicted[metric] || 0;
      const act = actual[metric] || 0;
      
      if (pred === 0 && act === 0) {
        totalAccuracy += 100;
      } else {
        const accuracy = Math.max(0, 100 - Math.abs(pred - act) / Math.max(pred, act) * 100);
        totalAccuracy += accuracy;
      }
    }

    return totalAccuracy / metrics.length;
  }

  private extractTopic(content: string): string {
    const words = content.toLowerCase();
    const topics = ['sleep', 'diet', 'exercise', 'nutrition', 'productivity', 'wellness'];
    
    for (const topic of topics) {
      if (words.includes(topic)) {
        return topic;
      }
    }
    
    return 'health';
  }
}

export const unifiedContentOrchestrator = UnifiedContentOrchestrator.getInstance();
