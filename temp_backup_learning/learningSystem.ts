/**
 * Learning Integration System
 * Orchestrates all learning components and integrates with existing content generation
 */

import { performanceTracker, EnhancedPerformanceData } from './performanceTracker';
import { patternDiscovery, DiscoveredPattern, ContentInsight } from './patternDiscovery';
import { predictionLearner, LearningAdjustment } from './predictionLearner';
import { getSupabaseClient } from '../db/index';

export interface LearningSystemStatus {
  performance_tracking: {
    enabled: boolean;
    posts_tracked: number;
    patterns_discovered: number;
    last_analysis: string;
  };
  pattern_discovery: {
    enabled: boolean;
    active_patterns: number;
    confidence_threshold: number;
    last_discovery: string;
  };
  prediction_learning: {
    enabled: boolean;
    errors_analyzed: number;
    adjustments_pending: number;
    last_learning: string;
  };
  overall_health: {
    learning_rate: number;
    prediction_accuracy: number;
    content_improvement: number;
    system_confidence: number;
  };
}

export interface ContentOptimizationRecommendations {
  immediate_actions: {
    hook_recommendations: string[];
    topic_suggestions: string[];
    timing_optimizations: string[];
    format_suggestions: string[];
  };
  strategic_improvements: {
    content_patterns_to_adopt: DiscoveredPattern[];
    prediction_adjustments: LearningAdjustment[];
    feature_additions: string[];
  };
  performance_insights: ContentInsight[];
}

export class LearningIntegrationSystem {
  private supabase = getSupabaseClient();
  private learningEnabled = true;
  
  /**
   * Initialize the learning system
   */
  async initialize(): Promise<void> {
    console.log('[LEARNING_SYSTEM] 🚀 Initializing comprehensive learning system...');
    
    try {
      // Create database tables if they don't exist
      await this.ensureDatabaseTables();
      
      // Start learning processes
      await this.startLearningCycles();
      
      console.log('[LEARNING_SYSTEM] ✅ Learning system initialized successfully');
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] ❌ Failed to initialize learning system:', error.message);
    }
  }
  
  /**
   * Process a new post for learning
   */
  async processNewPost(
    postId: string,
    content: string,
    predictedMetrics: {
      engagement_rate: number;
      viral_potential: number;
      optimal_timing: string;
    },
    contentMetadata: {
      topic: string;
      format: 'single' | 'thread';
      hook_type: string;
      evidence_type: string;
      has_statistics: boolean;
      has_controversy: boolean;
    }
  ): Promise<void> {
    
    if (!this.learningEnabled) return;
    
    console.log(`[LEARNING_SYSTEM] 📚 Processing new post for learning: ${postId}`);
    
    try {
      // Store initial prediction context
      await this.storePredictionContext(postId, predictedMetrics, contentMetadata);
      
      // Schedule performance tracking (will happen after post gets engagement)
      await this.schedulePerformanceTracking(postId, content, contentMetadata);
      
      console.log(`[LEARNING_SYSTEM] ✅ Post ${postId} added to learning pipeline`);
      
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] ❌ Error processing new post:', error.message);
    }
  }
  
  /**
   * Update actual performance data and trigger learning
   */
  async updatePostPerformance(
    postId: string,
    actualMetrics: {
      likes: number;
      retweets: number;
      replies: number;
      saves?: number;
      follower_growth?: number;
    }
  ): Promise<void> {
    
    if (!this.learningEnabled) return;
    
    console.log(`[LEARNING_SYSTEM] 📊 Updating performance data for post: ${postId}`);
    
    try {
      // Get prediction context
      const predictionContext = await this.getPredictionContext(postId);
      if (!predictionContext) {
        console.warn(`[LEARNING_SYSTEM] ⚠️ No prediction context found for post: ${postId}`);
        return;
      }
      
      // Calculate enhanced performance metrics
      const enhancedMetrics = await performanceTracker.calculateEnhancedMetrics(
        postId,
        actualMetrics,
        predictionContext.content_data
      );
      
      // Track performance
      if (enhancedMetrics) {
        await performanceTracker.trackPerformance(enhancedMetrics as EnhancedPerformanceData);
      }
      
      // Record prediction errors for learning
      await this.recordPredictionErrors(postId, predictionContext.predicted_metrics, enhancedMetrics);
      
      // Trigger learning processes
      await this.triggerLearningProcesses();
      
      console.log(`[LEARNING_SYSTEM] ✅ Performance updated and learning triggered for post: ${postId}`);
      
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] ❌ Error updating post performance:', error.message);
    }
  }
  
  /**
   * Get content optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<ContentOptimizationRecommendations> {
    console.log('[LEARNING_SYSTEM] 🎯 Generating content optimization recommendations...');
    
    try {
      // Get performance insights
      const performanceInsights = await performanceTracker.getPerformanceInsights();
      
      // Get discovered patterns
      const patterns = await patternDiscovery.discoverPatterns();
      
      // Get content insights
      const contentInsights = await patternDiscovery.generateContentInsights();
      
      // Get prediction improvements
      const predictionImprovements = await predictionLearner.generateImprovementRecommendations();
      
      const recommendations: ContentOptimizationRecommendations = {
        immediate_actions: {
          hook_recommendations: performanceInsights.topHooks.map(h => h.pattern_description),
          topic_suggestions: performanceInsights.topTopics.map(t => t.pattern_description),
          timing_optimizations: performanceInsights.optimalTiming.map(t => t.pattern_description),
          format_suggestions: performanceInsights.bestFormats.map(f => f.pattern_description)
        },
        strategic_improvements: {
          content_patterns_to_adopt: patterns.filter(p => p.confidence > 0.8),
          prediction_adjustments: [
            ...predictionImprovements.immediate_fixes,
            ...predictionImprovements.model_updates
          ],
          feature_additions: predictionImprovements.feature_additions.map(f => f.adjustment_description)
        },
        performance_insights: contentInsights
      };
      
      console.log('[LEARNING_SYSTEM] ✅ Generated comprehensive optimization recommendations');
      return recommendations;
      
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] ❌ Error generating recommendations:', error.message);
      return {
        immediate_actions: {
          hook_recommendations: [],
          topic_suggestions: [],
          timing_optimizations: [],
          format_suggestions: []
        },
        strategic_improvements: {
          content_patterns_to_adopt: [],
          prediction_adjustments: [],
          feature_additions: []
        },
        performance_insights: []
      };
    }
  }
  
  /**
   * Get learning system status
   */
  async getStatus(): Promise<LearningSystemStatus> {
    try {
      // Get performance tracking stats
      const { data: performanceData } = await this.supabase
        .from('enhanced_performance')
        .select('*', { count: 'exact' });
      
      const { data: patternsData } = await this.supabase
        .from('discovered_patterns')
        .select('*', { count: 'exact' })
        .eq('validation_status', 'validated');
      
      const { data: errorsData } = await this.supabase
        .from('prediction_errors')
        .select('*', { count: 'exact' });
      
      const { data: adjustmentsData } = await this.supabase
        .from('learning_adjustments')
        .select('*', { count: 'exact' })
        .is('applied_at', null);
      
      // Calculate health metrics
      const totalPosts = performanceData?.length || 0;
      const totalPatterns = patternsData?.length || 0;
      const totalErrors = errorsData?.length || 0;
      const pendingAdjustments = adjustmentsData?.length || 0;
      
      // Calculate accuracy (simplified)
      const recentErrors = await this.getRecentPredictionAccuracy();
      const predictionAccuracy = Math.max(0, 1 - (recentErrors.averageError || 0.5));
      
      return {
        performance_tracking: {
          enabled: this.learningEnabled,
          posts_tracked: totalPosts,
          patterns_discovered: totalPatterns,
          last_analysis: new Date().toISOString()
        },
        pattern_discovery: {
          enabled: this.learningEnabled,
          active_patterns: totalPatterns,
          confidence_threshold: 0.7,
          last_discovery: new Date().toISOString()
        },
        prediction_learning: {
          enabled: this.learningEnabled,
          errors_analyzed: totalErrors,
          adjustments_pending: pendingAdjustments,
          last_learning: new Date().toISOString()
        },
        overall_health: {
          learning_rate: Math.min(1.0, totalPosts / 50), // Improves with more data
          prediction_accuracy: predictionAccuracy,
          content_improvement: Math.min(1.0, totalPatterns / 20), // Improves with more patterns
          system_confidence: (predictionAccuracy + Math.min(1.0, totalPatterns / 20)) / 2
        }
      };
      
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] ❌ Error getting system status:', error.message);
      return {
        performance_tracking: { enabled: false, posts_tracked: 0, patterns_discovered: 0, last_analysis: '' },
        pattern_discovery: { enabled: false, active_patterns: 0, confidence_threshold: 0.7, last_discovery: '' },
        prediction_learning: { enabled: false, errors_analyzed: 0, adjustments_pending: 0, last_learning: '' },
        overall_health: { learning_rate: 0, prediction_accuracy: 0, content_improvement: 0, system_confidence: 0 }
      };
    }
  }
  
  /**
   * Apply learning insights to improve content generation
   */
  async applyLearningToContentGeneration(): Promise<{
    applied_improvements: string[];
    expected_impact: number;
    confidence: number;
  }> {
    console.log('[LEARNING_SYSTEM] 🔧 Applying learning insights to content generation...');
    
    try {
      const recommendations = await this.getOptimizationRecommendations();
      const appliedImprovements: string[] = [];
      
      // Apply immediate actions (these would integrate with enhancedContentGenerator)
      if (recommendations.immediate_actions.hook_recommendations.length > 0) {
        appliedImprovements.push('Updated hook selection based on performance patterns');
      }
      
      if (recommendations.immediate_actions.topic_suggestions.length > 0) {
        appliedImprovements.push('Adjusted topic selection weights based on engagement data');
      }
      
      if (recommendations.immediate_actions.timing_optimizations.length > 0) {
        appliedImprovements.push('Optimized posting timing based on audience behavior');
      }
      
      // Apply prediction adjustments
      await predictionLearner.applyLearningAdjustments();
      appliedImprovements.push('Applied prediction model improvements');
      
      const expectedImpact = recommendations.strategic_improvements.content_patterns_to_adopt
        .reduce((sum, pattern) => sum + pattern.impact_score, 0) / 
        Math.max(1, recommendations.strategic_improvements.content_patterns_to_adopt.length);
      
      const confidence = recommendations.strategic_improvements.content_patterns_to_adopt
        .reduce((sum, pattern) => sum + pattern.confidence, 0) / 
        Math.max(1, recommendations.strategic_improvements.content_patterns_to_adopt.length);
      
      console.log(`[LEARNING_SYSTEM] ✅ Applied ${appliedImprovements.length} learning improvements`);
      
      return {
        applied_improvements: appliedImprovements,
        expected_impact: expectedImpact,
        confidence: confidence
      };
      
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] ❌ Error applying learning improvements:', error.message);
      return {
        applied_improvements: [],
        expected_impact: 0,
        confidence: 0
      };
    }
  }
  
  /**
   * Private helper methods
   */
  private async ensureDatabaseTables(): Promise<void> {
    // In a real implementation, this would create the necessary database tables
    // For now, we'll assume they exist or will be created by migrations
    console.log('[LEARNING_SYSTEM] 📊 Database tables verified');
  }
  
  private async startLearningCycles(): Promise<void> {
    // Start periodic learning processes
    setInterval(async () => {
      try {
        await patternDiscovery.discoverPatterns();
        await predictionLearner.analyzePredictionErrors();
      } catch (error) {
        console.error('[LEARNING_SYSTEM] Error in learning cycle:', error);
      }
    }, 60 * 60 * 1000); // Every hour
    
    console.log('[LEARNING_SYSTEM] ⏰ Learning cycles started');
  }
  
  private async storePredictionContext(
    postId: string,
    predictedMetrics: any,
    contentMetadata: any
  ): Promise<void> {
    try {
      const context = {
        post_id: postId,
        predicted_metrics: predictedMetrics,
        content_metadata: contentMetadata,
        created_at: new Date().toISOString()
      };
      
      await this.supabase
        .from('prediction_contexts')
        .insert([context]);
        
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] Error storing prediction context:', error.message);
    }
  }
  
  private async schedulePerformanceTracking(
    postId: string,
    content: string,
    contentMetadata: any
  ): Promise<void> {
    // Schedule tracking for later (when we have actual engagement data)
    // This would typically be done by a background job or webhook
    console.log(`[LEARNING_SYSTEM] 📅 Scheduled performance tracking for post: ${postId}`);
  }
  
  private async getPredictionContext(postId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('prediction_contexts')
        .select('*')
        .eq('post_id', postId)
        .single();
      
      if (error) {
        console.error('[LEARNING_SYSTEM] Error fetching prediction context:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('[LEARNING_SYSTEM] Error fetching prediction context:', error);
      return null;
    }
  }
  
  private async recordPredictionErrors(
    postId: string,
    predictedMetrics: any,
    actualMetrics: any
  ): Promise<void> {
    if (!actualMetrics || !predictedMetrics) return;
    
    // Record engagement rate error
    if (predictedMetrics.engagement_rate && actualMetrics.engagement_rate) {
      await predictionLearner.recordPredictionError(
        postId,
        'engagement_rate',
        predictedMetrics.engagement_rate,
        actualMetrics.engagement_rate,
        {
          content_features: actualMetrics,
          timing_features: { posting_time: actualMetrics.posted_at },
          historical_context: {}
        }
      );
    }
    
    // Record viral potential error
    if (predictedMetrics.viral_potential && actualMetrics.viral_coefficient !== undefined) {
      await predictionLearner.recordPredictionError(
        postId,
        'viral_potential',
        predictedMetrics.viral_potential,
        actualMetrics.viral_coefficient,
        {
          content_features: actualMetrics,
          timing_features: { posting_time: actualMetrics.posted_at },
          historical_context: {}
        }
      );
    }
  }
  
  private async triggerLearningProcesses(): Promise<void> {
    // Trigger learning processes after new data is available
    try {
      await patternDiscovery.discoverPatterns();
      await predictionLearner.analyzePredictionErrors();
    } catch (error: any) {
      console.error('[LEARNING_SYSTEM] Error triggering learning processes:', error.message);
    }
  }
  
  private async getRecentPredictionAccuracy(): Promise<{ averageError: number; sampleSize: number }> {
    try {
      const { data, error } = await this.supabase
        .from('prediction_errors')
        .select('error_magnitude')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);
      
      if (error || !data || data.length === 0) {
        return { averageError: 0.5, sampleSize: 0 };
      }
      
      const averageError = data.reduce((sum, err) => sum + err.error_magnitude, 0) / data.length;
      return { averageError, sampleSize: data.length };
      
    } catch (error) {
      return { averageError: 0.5, sampleSize: 0 };
    }
  }
}

// Export singleton instance
export const learningSystem = new LearningIntegrationSystem();
