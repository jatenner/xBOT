/**
 * Learning System Status Endpoint
 * Provides comprehensive status and insights from the learning system
 */

import { Request, Response } from 'express';
import { learningSystem } from '../learning/learningSystem';
import { performanceTracker } from '../learning/performanceTracker';
import { patternDiscovery } from '../learning/patternDiscovery';
import { predictionLearner } from '../learning/predictionLearner';

export async function getLearningSystemStatus(req: Request, res: Response): Promise<void> {
  try {
    console.log('[LEARNING_STATUS] 📊 Generating learning system status report...');
    
    // Get comprehensive status
    const [
      systemStatus,
      optimizationRecommendations,
      performanceInsights,
      recentPatterns,
      predictionImprovements
    ] = await Promise.all([
      learningSystem.getSystemStatus(),
      learningSystem.getOptimizationRecommendations(),
      performanceTracker.getPerformanceInsights(),
      patternDiscovery.discoverPatterns(),
      predictionLearner.generateImprovementRecommendations()
    ]);
    
    // Apply learning improvements
    const appliedImprovements = await learningSystem.applyLearningToContentGeneration();
    
    const report = {
      timestamp: new Date().toISOString(),
      system_status: systemStatus,
      
      // Performance insights
      performance_insights: {
        top_performing_hooks: performanceInsights.topHooks.slice(0, 3),
        best_topics: performanceInsights.topTopics.slice(0, 3),
        optimal_timing: performanceInsights.optimalTiming.slice(0, 3),
        preferred_formats: performanceInsights.bestFormats.slice(0, 3)
      },
      
      // Recent discoveries
      recent_discoveries: {
        new_patterns: recentPatterns.filter(p => p.confidence > 0.8).slice(0, 5),
        pattern_count: recentPatterns.length,
        high_confidence_patterns: recentPatterns.filter(p => p.confidence > 0.8).length
      },
      
      // Optimization recommendations
      optimization_recommendations: {
        immediate_actions: optimizationRecommendations.immediate_actions,
        strategic_improvements: {
          patterns_to_adopt: optimizationRecommendations.strategic_improvements.content_patterns_to_adopt.length,
          prediction_adjustments: optimizationRecommendations.strategic_improvements.prediction_adjustments.length,
          feature_additions: optimizationRecommendations.strategic_improvements.feature_additions.length
        },
        content_insights: optimizationRecommendations.performance_insights.slice(0, 3)
      },
      
      // Prediction improvements
      prediction_improvements: {
        immediate_fixes: predictionImprovements.immediate_fixes.length,
        feature_additions: predictionImprovements.feature_additions.length,
        model_updates: predictionImprovements.model_updates.length,
        top_fixes: predictionImprovements.immediate_fixes.slice(0, 3).map(fix => ({
          description: fix.adjustment_description,
          expected_improvement: `${(fix.expected_improvement * 100).toFixed(1)}%`,
          confidence: `${(fix.confidence * 100).toFixed(1)}%`
        }))
      },
      
      // Applied improvements
      applied_improvements: {
        improvements_applied: appliedImprovements.applied_improvements,
        expected_impact: `${(appliedImprovements.expected_impact * 100).toFixed(1)}%`,
        confidence: `${(appliedImprovements.confidence * 100).toFixed(1)}%`
      },
      
      // System health metrics
      health_metrics: {
        overall_health: `${(systemStatus.overall_health.system_confidence * 100).toFixed(1)}%`,
        learning_rate: `${(systemStatus.overall_health.learning_rate * 100).toFixed(1)}%`,
        prediction_accuracy: `${(systemStatus.overall_health.prediction_accuracy * 100).toFixed(1)}%`,
        content_improvement: `${(systemStatus.overall_health.content_improvement * 100).toFixed(1)}%`
      },
      
      // Actionable insights for user
      actionable_insights: generateActionableInsights(
        optimizationRecommendations,
        systemStatus,
        recentPatterns
      )
    };
    
    console.log('[LEARNING_STATUS] ✅ Learning system status report generated');
    res.json(report);
    
  } catch (error: any) {
    console.error('[LEARNING_STATUS] ❌ Error generating learning status:', error.message);
    res.status(500).json({
      error: 'Failed to generate learning system status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Generate actionable insights for the user
 */
function generateActionableInsights(
  recommendations: any,
  systemStatus: any,
  patterns: any[]
): string[] {
  const insights: string[] = [];
  
  // Health-based insights
  if (systemStatus.overall_health.system_confidence < 0.5) {
    insights.push('🔴 System needs more data - post more content to improve learning accuracy');
  } else if (systemStatus.overall_health.system_confidence < 0.7) {
    insights.push('🟡 Learning system is developing - continue posting to unlock better insights');
  } else {
    insights.push('🟢 Learning system is performing well - applying insights to improve content');
  }
  
  // Performance insights
  if (recommendations.immediate_actions.hook_recommendations.length > 0) {
    const topHook = recommendations.immediate_actions.hook_recommendations[0];
    insights.push(`💡 Best performing hook pattern: ${topHook}`);
  }
  
  if (recommendations.immediate_actions.timing_optimizations.length > 0) {
    const topTiming = recommendations.immediate_actions.timing_optimizations[0];
    insights.push(`⏰ Optimal timing insight: ${topTiming}`);
  }
  
  // Pattern insights
  const highImpactPatterns = patterns.filter(p => p.impact_score > 0.2 && p.confidence > 0.8);
  if (highImpactPatterns.length > 0) {
    insights.push(`🚀 ${highImpactPatterns.length} high-impact patterns discovered - expect ${(highImpactPatterns[0].impact_score * 100).toFixed(1)}% improvement`);
  }
  
  // Prediction insights
  if (systemStatus.overall_health.prediction_accuracy < 0.6) {
    insights.push('📈 Prediction accuracy is improving - system is learning from recent posts');
  } else if (systemStatus.overall_health.prediction_accuracy > 0.8) {
    insights.push('🎯 High prediction accuracy achieved - content recommendations are highly reliable');
  }
  
  // Content insights
  if (recommendations.performance_insights.length > 0) {
    const topInsight = recommendations.performance_insights[0];
    insights.push(`✨ Top content insight: ${topInsight.actionable_advice}`);
  }
  
  return insights;
}

/**
 * Get learning system metrics for monitoring
 */
export async function getLearningMetrics(req: Request, res: Response): Promise<void> {
  try {
    const systemStatus = await learningSystem.getSystemStatus();
    
    // Format for monitoring/dashboard
    const metrics = {
      learning_system: {
        posts_tracked: systemStatus.performance_tracking.posts_tracked,
        patterns_discovered: systemStatus.pattern_discovery.active_patterns,
        prediction_errors_analyzed: systemStatus.prediction_learning.errors_analyzed,
        adjustments_pending: systemStatus.prediction_learning.adjustments_pending
      },
      health_scores: {
        overall_health: systemStatus.overall_health.system_confidence,
        learning_rate: systemStatus.overall_health.learning_rate,
        prediction_accuracy: systemStatus.overall_health.prediction_accuracy,
        content_improvement: systemStatus.overall_health.content_improvement
      },
      status: {
        performance_tracking_enabled: systemStatus.performance_tracking.enabled,
        pattern_discovery_enabled: systemStatus.pattern_discovery.enabled,
        prediction_learning_enabled: systemStatus.prediction_learning.enabled
      }
    };
    
    res.json(metrics);
    
  } catch (error: any) {
    console.error('[LEARNING_METRICS] ❌ Error generating metrics:', error.message);
    res.status(500).json({
      error: 'Failed to generate learning metrics',
      message: error.message
    });
  }
}