/**
 * Prediction Error Learning System
 * Improves prediction accuracy by learning from errors
 */

import { getSupabaseClient } from '../db/index';
import { EnhancedPerformanceData } from './performanceTracker';

export interface PredictionError {
  id: string;
  post_id: string;
  prediction_type: 'engagement_rate' | 'viral_potential' | 'follower_growth' | 'optimal_timing';
  predicted_value: number;
  actual_value: number;
  error_magnitude: number; // |predicted - actual| / actual
  error_direction: 'overestimate' | 'underestimate';
  
  // Context that led to the prediction
  prediction_context: {
    content_features: Record<string, any>;
    timing_features: Record<string, any>;
    historical_context: Record<string, any>;
  };
  
  // Analysis of why the prediction was wrong
  error_analysis: {
    likely_causes: string[];
    missing_factors: string[];
    model_weaknesses: string[];
  };
  
  created_at: string;
  learned_from: boolean; // Whether we've updated our models based on this error
}

export interface LearningAdjustment {
  id: string;
  adjustment_type: 'feature_weight' | 'new_feature' | 'model_parameter' | 'prediction_logic';
  target_component: string; // Which part of the system to adjust
  adjustment_description: string;
  expected_improvement: number;
  confidence: number;
  
  // What errors led to this adjustment
  source_errors: string[]; // PredictionError IDs
  
  // Implementation details
  implementation: {
    before_value: any;
    after_value: any;
    code_changes_needed: string[];
  };
  
  applied_at?: string;
  validation_results?: {
    improvement_achieved: number;
    side_effects: string[];
  };
}

export class PredictionErrorLearner {
  private supabase = getSupabaseClient();
  private errorThreshold = 0.2; // 20% error threshold for learning
  private minErrorsForLearning = 3; // Need at least 3 similar errors to learn
  
  /**
   * Analyze prediction errors and generate learning adjustments
   */
  async analyzePredictionErrors(): Promise<LearningAdjustment[]> {
    console.log('[PREDICTION_LEARNER] 🧠 Analyzing prediction errors for learning opportunities...');
    
    try {
      // Get recent prediction errors
      const errors = await this.getRecentPredictionErrors();
      
      if (errors.length < this.minErrorsForLearning) {
        console.log('[PREDICTION_LEARNER] ⏸️ Insufficient errors for learning');
        return [];
      }
      
      const adjustments: LearningAdjustment[] = [];
      
      // Analyze different types of systematic errors
      adjustments.push(...await this.analyzeEngagementPredictionErrors(errors));
      adjustments.push(...await this.analyzeViralPredictionErrors(errors));
      adjustments.push(...await this.analyzeTimingPredictionErrors(errors));
      adjustments.push(...await this.analyzeFeatureMissingErrors(errors));
      
      // Store and prioritize adjustments
      const validAdjustments = adjustments.filter(adj => adj.confidence > 0.6);
      
      for (const adjustment of validAdjustments) {
        await this.storeLearningAdjustment(adjustment);
      }
      
      console.log(`[PREDICTION_LEARNER] ✅ Generated ${validAdjustments.length} learning adjustments`);
      return validAdjustments;
      
    } catch (error: any) {
      console.error('[PREDICTION_LEARNER] ❌ Error analyzing prediction errors:', error.message);
      return [];
    }
  }
  
  /**
   * Record a prediction error for learning
   */
  async recordPredictionError(
    postId: string,
    predictionType: PredictionError['prediction_type'],
    predictedValue: number,
    actualValue: number,
    context: PredictionError['prediction_context']
  ): Promise<void> {
    
    const errorMagnitude = Math.abs(predictedValue - actualValue) / Math.max(actualValue, 0.001);
    
    // Only record significant errors
    if (errorMagnitude < this.errorThreshold) {
      return;
    }
    
    const error: PredictionError = {
      id: `error_${postId}_${predictionType}_${Date.now()}`,
      post_id: postId,
      prediction_type: predictionType,
      predicted_value: predictedValue,
      actual_value: actualValue,
      error_magnitude: errorMagnitude,
      error_direction: predictedValue > actualValue ? 'overestimate' : 'underestimate',
      prediction_context: context,
      error_analysis: await this.analyzeError(predictionType, predictedValue, actualValue, context),
      created_at: new Date().toISOString(),
      learned_from: false
    };
    
    try {
      const { error: dbError } = await this.supabase
        .from('prediction_errors')
        .insert([error]);
      
      if (dbError) {
        console.error('[PREDICTION_LEARNER] Error storing prediction error:', dbError);
        return;
      }
      
      console.log(`[PREDICTION_LEARNER] 📝 Recorded ${predictionType} error: ${(errorMagnitude * 100).toFixed(1)}% off`);
      
    } catch (error: any) {
      console.error('[PREDICTION_LEARNER] Error storing prediction error:', error.message);
    }
  }
  
  /**
   * Analyze engagement prediction errors
   */
  private async analyzeEngagementPredictionErrors(errors: PredictionError[]): Promise<LearningAdjustment[]> {
    const engagementErrors = errors.filter(e => e.prediction_type === 'engagement_rate');
    
    if (engagementErrors.length < this.minErrorsForLearning) {
      return [];
    }
    
    const adjustments: LearningAdjustment[] = [];
    
    // Look for systematic overestimation or underestimation
    const overestimates = engagementErrors.filter(e => e.error_direction === 'overestimate');
    const underestimates = engagementErrors.filter(e => e.error_direction === 'underestimate');
    
    if (overestimates.length > underestimates.length * 2) {
      // Systematic overestimation - we're too optimistic
      adjustments.push({
        id: `engagement_overestimate_${Date.now()}`,
        adjustment_type: 'model_parameter',
        target_component: 'engagement_predictor',
        adjustment_description: 'Reduce engagement predictions by 15% - systematic overestimation detected',
        expected_improvement: 0.15,
        confidence: Math.min(0.9, overestimates.length / 10),
        source_errors: overestimates.map(e => e.id),
        implementation: {
          before_value: 'current_prediction',
          after_value: 'current_prediction * 0.85',
          code_changes_needed: [
            'Update engagement prediction multiplier in enhancedContentGenerator.ts',
            'Add systematic bias correction factor'
          ]
        }
      });
    } else if (underestimates.length > overestimates.length * 2) {
      // Systematic underestimation - we're too pessimistic
      adjustments.push({
        id: `engagement_underestimate_${Date.now()}`,
        adjustment_type: 'model_parameter',
        target_component: 'engagement_predictor',
        adjustment_description: 'Increase engagement predictions by 20% - systematic underestimation detected',
        expected_improvement: 0.20,
        confidence: Math.min(0.9, underestimates.length / 10),
        source_errors: underestimates.map(e => e.id),
        implementation: {
          before_value: 'current_prediction',
          after_value: 'current_prediction * 1.20',
          code_changes_needed: [
            'Update engagement prediction multiplier in enhancedContentGenerator.ts',
            'Add systematic bias correction factor'
          ]
        }
      });
    }
    
    // Look for content features that consistently lead to errors
    const contentFeatureErrors = this.analyzeContentFeatureErrors(engagementErrors);
    adjustments.push(...contentFeatureErrors);
    
    return adjustments;
  }
  
  /**
   * Analyze viral prediction errors
   */
  private async analyzeViralPredictionErrors(errors: PredictionError[]): Promise<LearningAdjustment[]> {
    const viralErrors = errors.filter(e => e.prediction_type === 'viral_potential');
    
    if (viralErrors.length < this.minErrorsForLearning) {
      return [];
    }
    
    const adjustments: LearningAdjustment[] = [];
    
    // Analyze what we're missing in viral predictions
    const highErrorViralPredictions = viralErrors.filter(e => e.error_magnitude > 0.5);
    
    if (highErrorViralPredictions.length >= 3) {
      // We're really bad at predicting viral content
      adjustments.push({
        id: `viral_prediction_overhaul_${Date.now()}`,
        adjustment_type: 'new_feature',
        target_component: 'viral_predictor',
        adjustment_description: 'Add new viral prediction factors: controversy level, hook strength, timing factors',
        expected_improvement: 0.3,
        confidence: 0.7,
        source_errors: highErrorViralPredictions.map(e => e.id),
        implementation: {
          before_value: 'basic_viral_score',
          after_value: 'enhanced_viral_score_with_multiple_factors',
          code_changes_needed: [
            'Add controversy detection to content analysis',
            'Implement hook strength scoring',
            'Add timing-based viral multipliers'
          ]
        }
      });
    }
    
    return adjustments;
  }
  
  /**
   * Analyze timing prediction errors
   */
  private async analyzeTimingPredictionErrors(errors: PredictionError[]): Promise<LearningAdjustment[]> {
    const timingErrors = errors.filter(e => e.prediction_type === 'optimal_timing');
    
    if (timingErrors.length < this.minErrorsForLearning) {
      return [];
    }
    
    const adjustments: LearningAdjustment[] = [];
    
    // Look for patterns in timing errors
    const dayOfWeekErrors = this.groupBy(timingErrors, e => 
      new Date(e.prediction_context.timing_features.posting_time).getDay().toString()
    );
    
    for (const [dayOfWeek, dayErrors] of Object.entries(dayOfWeekErrors)) {
      if (dayErrors.length >= 2) {
        const avgError = dayErrors.reduce((sum, e) => sum + e.error_magnitude, 0) / dayErrors.length;
        
        if (avgError > 0.3) {
          adjustments.push({
            id: `timing_day_${dayOfWeek}_${Date.now()}`,
            adjustment_type: 'feature_weight',
            target_component: 'timing_predictor',
            adjustment_description: `Adjust timing predictions for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(dayOfWeek)]} - ${(avgError * 100).toFixed(1)}% average error`,
            expected_improvement: avgError,
            confidence: Math.min(0.8, dayErrors.length / 5),
            source_errors: dayErrors.map(e => e.id),
            implementation: {
              before_value: `day_${dayOfWeek}_weight`,
              after_value: `adjusted_day_${dayOfWeek}_weight`,
              code_changes_needed: [
                'Update day-of-week weights in timing prediction',
                'Add day-specific error correction factors'
              ]
            }
          });
        }
      }
    }
    
    return adjustments;
  }
  
  /**
   * Analyze errors caused by missing features
   */
  private async analyzeFeatureMissingErrors(errors: PredictionError[]): Promise<LearningAdjustment[]> {
    const adjustments: LearningAdjustment[] = [];
    
    // Look for common missing factors in error analysis
    const missingFactors: Record<string, number> = {};
    
    for (const error of errors) {
      for (const factor of error.error_analysis.missing_factors) {
        missingFactors[factor] = (missingFactors[factor] || 0) + 1;
      }
    }
    
    // Find frequently missing factors
    const frequentlyMissing = Object.entries(missingFactors)
      .filter(([factor, count]) => count >= this.minErrorsForLearning)
      .sort(([, a], [, b]) => b - a);
    
    for (const [factor, count] of frequentlyMissing.slice(0, 3)) { // Top 3 missing factors
      adjustments.push({
        id: `missing_feature_${factor.replace(/\s+/g, '_')}_${Date.now()}`,
        adjustment_type: 'new_feature',
        target_component: 'content_analyzer',
        adjustment_description: `Add missing feature: ${factor} (identified in ${count} prediction errors)`,
        expected_improvement: 0.1 + (count / errors.length) * 0.2, // Higher improvement for more frequent issues
        confidence: Math.min(0.8, count / 10),
        source_errors: errors.filter(e => e.error_analysis.missing_factors.includes(factor)).map(e => e.id),
        implementation: {
          before_value: 'current_features',
          after_value: `current_features + ${factor}`,
          code_changes_needed: [
            `Implement ${factor} detection in content analysis`,
            `Add ${factor} to prediction models`,
            `Update feature extraction pipeline`
          ]
        }
      });
    }
    
    return adjustments;
  }
  
  /**
   * Analyze content feature errors
   */
  private analyzeContentFeatureErrors(errors: PredictionError[]): LearningAdjustment[] {
    const adjustments: LearningAdjustment[] = [];
    
    // Group errors by content features
    const featureGroups = {
      has_statistics: errors.filter(e => e.prediction_context.content_features.has_statistics),
      has_controversy: errors.filter(e => e.prediction_context.content_features.has_controversy),
      long_content: errors.filter(e => e.prediction_context.content_features.content_length > 200),
      short_content: errors.filter(e => e.prediction_context.content_features.content_length < 100)
    };
    
    for (const [feature, featureErrors] of Object.entries(featureGroups)) {
      if (featureErrors.length >= this.minErrorsForLearning) {
        const avgError = featureErrors.reduce((sum, e) => sum + e.error_magnitude, 0) / featureErrors.length;
        const errorDirection = featureErrors.filter(e => e.error_direction === 'overestimate').length > featureErrors.length / 2 ? 'overestimate' : 'underestimate';
        
        if (avgError > 0.25) {
          adjustments.push({
            id: `feature_${feature}_${Date.now()}`,
            adjustment_type: 'feature_weight',
            target_component: 'content_feature_weights',
            adjustment_description: `Adjust ${feature} weight - causing ${(avgError * 100).toFixed(1)}% average error (${errorDirection})`,
            expected_improvement: avgError * 0.7, // Expect to reduce error by 70%
            confidence: Math.min(0.85, featureErrors.length / 8),
            source_errors: featureErrors.map(e => e.id),
            implementation: {
              before_value: `${feature}_weight`,
              after_value: errorDirection === 'overestimate' ? `${feature}_weight * 0.8` : `${feature}_weight * 1.2`,
              code_changes_needed: [
                `Update ${feature} weight in prediction model`,
                'Recalibrate feature importance scores'
              ]
            }
          });
        }
      }
    }
    
    return adjustments;
  }
  
  /**
   * Apply learning adjustments to improve predictions
   */
  async applyLearningAdjustments(): Promise<void> {
    console.log('[PREDICTION_LEARNER] 🔧 Applying learning adjustments...');
    
    try {
      // Get unapplied adjustments with high confidence
      const { data: adjustments, error } = await this.supabase
        .from('learning_adjustments')
        .select('*')
        .is('applied_at', null)
        .gte('confidence', 0.7)
        .order('expected_improvement', { ascending: false })
        .limit(5); // Apply top 5 adjustments
      
      if (error || !adjustments || adjustments.length === 0) {
        console.log('[PREDICTION_LEARNER] ⏸️ No high-confidence adjustments to apply');
        return;
      }
      
      for (const adjustment of adjustments) {
        await this.applyAdjustment(adjustment);
      }
      
      console.log(`[PREDICTION_LEARNER] ✅ Applied ${adjustments.length} learning adjustments`);
      
    } catch (error: any) {
      console.error('[PREDICTION_LEARNER] ❌ Error applying adjustments:', error.message);
    }
  }
  
  /**
   * Generate prediction improvement recommendations
   */
  async generateImprovementRecommendations(): Promise<{
    immediate_fixes: LearningAdjustment[];
    feature_additions: LearningAdjustment[];
    model_updates: LearningAdjustment[];
  }> {
    const adjustments = await this.getTopAdjustments();
    
    return {
      immediate_fixes: adjustments.filter(a => a.adjustment_type === 'model_parameter'),
      feature_additions: adjustments.filter(a => a.adjustment_type === 'new_feature'),
      model_updates: adjustments.filter(a => a.adjustment_type === 'feature_weight')
    };
  }
  
  /**
   * Helper methods
   */
  private async analyzeError(
    predictionType: PredictionError['prediction_type'],
    predicted: number,
    actual: number,
    context: PredictionError['prediction_context']
  ): Promise<PredictionError['error_analysis']> {
    
    const analysis: PredictionError['error_analysis'] = {
      likely_causes: [],
      missing_factors: [],
      model_weaknesses: []
    };
    
    // Analyze based on prediction type
    switch (predictionType) {
      case 'engagement_rate':
        if (predicted > actual) {
          analysis.likely_causes.push('Overestimated audience interest');
          analysis.likely_causes.push('Content saturation not accounted for');
        } else {
          analysis.likely_causes.push('Underestimated viral potential');
          analysis.likely_causes.push('Missed trending topic boost');
        }
        
        // Check for missing factors
        if (!context.content_features.has_statistics && actual > predicted * 1.5) {
          analysis.missing_factors.push('statistical_evidence_boost');
        }
        if (!context.content_features.has_controversy && actual > predicted * 1.3) {
          analysis.missing_factors.push('controversy_engagement_factor');
        }
        break;
        
      case 'viral_potential':
        if (predicted < actual) {
          analysis.likely_causes.push('Underestimated viral elements');
          analysis.missing_factors.push('hook_strength_analysis');
          analysis.missing_factors.push('sharability_score');
        }
        break;
        
      case 'optimal_timing':
        analysis.likely_causes.push('Audience behavior change');
        analysis.missing_factors.push('real_time_audience_activity');
        analysis.missing_factors.push('competing_content_analysis');
        break;
    }
    
    // General model weaknesses
    const errorMagnitude = Math.abs(predicted - actual) / Math.max(actual, 0.001);
    if (errorMagnitude > 0.5) {
      analysis.model_weaknesses.push('high_variance_predictions');
    }
    if (errorMagnitude > 0.3) {
      analysis.model_weaknesses.push('insufficient_training_data');
    }
    
    return analysis;
  }
  
  private async getRecentPredictionErrors(days: number = 14): Promise<PredictionError[]> {
    try {
      const { data, error } = await this.supabase
        .from('prediction_errors')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .eq('learned_from', false)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[PREDICTION_LEARNER] Error fetching prediction errors:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[PREDICTION_LEARNER] Error fetching prediction errors:', error);
      return [];
    }
  }
  
  private async storeLearningAdjustment(adjustment: LearningAdjustment): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('learning_adjustments')
        .insert([adjustment]);
      
      if (error) {
        console.error('[PREDICTION_LEARNER] Error storing adjustment:', error);
        return;
      }
      
      console.log(`[PREDICTION_LEARNER] 💡 Learning adjustment stored: ${adjustment.adjustment_description}`);
    } catch (error: any) {
      console.error('[PREDICTION_LEARNER] Error storing adjustment:', error.message);
    }
  }
  
  private async applyAdjustment(adjustment: LearningAdjustment): Promise<void> {
    // This would implement the actual code changes
    // For now, just mark as applied and log
    console.log(`[PREDICTION_LEARNER] 🔧 Applying: ${adjustment.adjustment_description}`);
    
    // Mark as applied
    await this.supabase
      .from('learning_adjustments')
      .update({ applied_at: new Date().toISOString() })
      .eq('id', adjustment.id);
    
    // In a real implementation, this would:
    // 1. Update model parameters
    // 2. Adjust feature weights
    // 3. Add new features to the pipeline
    // 4. Modify prediction logic
  }
  
  private async getTopAdjustments(): Promise<LearningAdjustment[]> {
    try {
      const { data, error } = await this.supabase
        .from('learning_adjustments')
        .select('*')
        .gte('confidence', 0.6)
        .order('expected_improvement', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('[PREDICTION_LEARNER] Error fetching adjustments:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[PREDICTION_LEARNER] Error fetching adjustments:', error);
      return [];
    }
  }
  
  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}

// Export singleton instance
export const predictionLearner = new PredictionErrorLearner();
