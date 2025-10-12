/**
 * Enhanced Content Generator Integration
 * Combines all advanced content generation systems for maximum follower acquisition
 */

import { generateEnhancedContent, GeneratedContent } from './enhancedContentGenerator';
import { followerAcquisitionGenerator, FollowerMagnetContent } from './followerAcquisitionGenerator';
import { viralFormulaEngine } from './viralFormulaEngine';
import { hookEvolutionEngine } from './hookEvolutionEngine';

export interface MasterContentRequest {
  // Content goals
  primary_goal: 'followers' | 'viral' | 'engagement' | 'authority';
  secondary_goal?: 'followers' | 'viral' | 'engagement' | 'authority';
  
  // Content preferences
  topic_preference?: string;
  format_preference?: 'single' | 'thread' | 'auto';
  target_audience?: 'health_seekers' | 'fitness_enthusiasts' | 'wellness_beginners' | 'biohackers';
  
  // Advanced options
  viral_target?: 'moderate' | 'high' | 'extreme';
  use_evolved_hooks?: boolean;
  apply_viral_formulas?: boolean;
  optimize_for_followers?: boolean;
}

export interface MasterContentResult {
  // Generated content
  content: string | string[];
  format: 'single' | 'thread';
  
  // Performance predictions
  follower_magnet_score: number; // 0-1 prediction of follower attraction
  viral_potential: number; // 0-1 prediction of viral spread
  engagement_prediction: number; // 0-1 prediction of engagement rate
  authority_score: number; // 0-1 prediction of authority building
  
  // Content analysis
  hook_used: {
    hook_text: string;
    hook_category: string;
    evolution_generation: number;
    predicted_performance: number;
  };
  viral_formula_applied: {
    formula_name: string;
    success_rate: number;
    avg_follower_growth: number;
  };
  content_characteristics: {
    has_statistics: boolean;
    has_controversy: boolean;
    has_authority_signals: boolean;
    has_follow_triggers: boolean;
    credibility_signals: string[];
    conversion_hooks: string[];
  };
  
  // Meta information
  generation_method: 'follower_optimized' | 'viral_formula' | 'hook_evolved' | 'hybrid';
  confidence_score: number; // Overall confidence in predictions
  expected_outcomes: {
    followers_gained_prediction: number;
    engagement_rate_prediction: number;
    viral_coefficient_prediction: number;
  };
}

export class MasterContentGenerator {
  
  /**
   * Generate the highest quality content optimized for specific goals
   */
  async generateMasterContent(request: MasterContentRequest): Promise<MasterContentResult> {
    console.log(`[MASTER_GENERATOR] 🎯 Generating content optimized for ${request.primary_goal}...`);
    
    try {
      // Determine optimal generation strategy
      const strategy = this.selectGenerationStrategy(request);
      
      // Generate content using selected strategy
      const content = await this.generateWithStrategy(strategy, request);
      
      // Enhance with additional optimization systems
      const enhancedContent = await this.applyEnhancements(content, request);
      
      // Calculate comprehensive predictions
      const predictions = await this.calculatePredictions(enhancedContent, request);
      
      console.log(`[MASTER_GENERATOR] ✅ Generated ${enhancedContent.format} content with ${(predictions.confidence_score * 100).toFixed(1)}% confidence`);
      
      return {
        content: enhancedContent.content,
        format: enhancedContent.format,
        follower_magnet_score: predictions.follower_magnet_score,
        viral_potential: predictions.viral_potential,
        engagement_prediction: predictions.engagement_prediction,
        authority_score: predictions.authority_score,
        hook_used: enhancedContent.hook_used,
        viral_formula_applied: enhancedContent.viral_formula_applied,
        content_characteristics: enhancedContent.content_characteristics,
        generation_method: strategy,
        confidence_score: predictions.confidence_score,
        expected_outcomes: predictions.expected_outcomes
      };
      
    } catch (error: any) {
      console.error('[MASTER_GENERATOR] ❌ Error generating master content:', error.message);
      
      // Fallback to basic enhanced content
      return this.generateFallbackContent(request);
    }
  }
  
  /**
   * Learn from content performance to improve future generation
   */
  async learnFromPerformance(
    contentId: string,
    originalRequest: MasterContentRequest,
    actualPerformance: {
      engagement_rate: number;
      viral_coefficient: number;
      followers_gained: number;
      likes: number;
      retweets: number;
      replies: number;
    }
  ): Promise<void> {
    
    console.log(`[MASTER_GENERATOR] 📚 Learning from content performance: ${contentId}`);
    
    try {
      // Learn from follower acquisition performance
      if (originalRequest.optimize_for_followers) {
        await followerAcquisitionGenerator.learnFromFollowerGrowth({
          post_id: contentId,
          content: '', // Would need to store original content
          followers_gained: actualPerformance.followers_gained,
          engagement_rate: actualPerformance.engagement_rate,
          viral_coefficient: actualPerformance.viral_coefficient,
          content_characteristics: {}
        });
      }
      
      // Learn from hook performance
      if (originalRequest.use_evolved_hooks) {
        await hookEvolutionEngine.learnFromHookPerformance(contentId, {
          engagement_rate: actualPerformance.engagement_rate,
          viral_coefficient: actualPerformance.viral_coefficient,
          followers_gained: actualPerformance.followers_gained,
          topic: originalRequest.topic_preference || 'health',
          audience: originalRequest.target_audience || 'health_seekers'
        });
      }
      
      // Analyze content DNA for viral patterns
      await viralFormulaEngine.analyzeContentDNA('', actualPerformance);
      
      console.log('[MASTER_GENERATOR] ✅ Learning complete - systems updated');
      
    } catch (error: any) {
      console.error('[MASTER_GENERATOR] ❌ Error learning from performance:', error.message);
    }
  }
  
  /**
   * Get content generation insights and recommendations
   */
  async getGenerationInsights(): Promise<{
    hook_analytics: any;
    viral_patterns: any;
    follower_formulas: any;
    optimization_recommendations: string[];
  }> {
    
    try {
      const [hookAnalytics, viralPatterns, followerFormulas] = await Promise.all([
        hookEvolutionEngine.getHookAnalytics(),
        viralFormulaEngine.discoverViralPatterns(),
        followerAcquisitionGenerator.getTopViralFormulas()
      ]);
      
      const optimizationRecommendations = this.generateOptimizationRecommendations(
        hookAnalytics,
        viralPatterns,
        followerFormulas
      );
      
      return {
        hook_analytics: hookAnalytics,
        viral_patterns: viralPatterns.slice(0, 5), // Top 5 patterns
        follower_formulas: followerFormulas,
        optimization_recommendations: optimizationRecommendations
      };
      
    } catch (error: any) {
      console.error('[MASTER_GENERATOR] ❌ Error getting generation insights:', error.message);
      return {
        hook_analytics: {},
        viral_patterns: [],
        follower_formulas: [],
        optimization_recommendations: []
      };
    }
  }
  
  /**
   * Private helper methods
   */
  private selectGenerationStrategy(request: MasterContentRequest): 'follower_optimized' | 'viral_formula' | 'hook_evolved' | 'hybrid' {
    // Determine best strategy based on request
    if (request.primary_goal === 'followers' && request.optimize_for_followers) {
      return 'follower_optimized';
    } else if (request.primary_goal === 'viral' && request.apply_viral_formulas) {
      return 'viral_formula';
    } else if (request.use_evolved_hooks) {
      return 'hook_evolved';
    } else {
      return 'hybrid'; // Use combination of systems
    }
  }
  
  private async generateWithStrategy(
    strategy: 'follower_optimized' | 'viral_formula' | 'hook_evolved' | 'hybrid',
    request: MasterContentRequest
  ): Promise<any> {
    
    switch (strategy) {
      case 'follower_optimized':
        return await followerAcquisitionGenerator.generateFollowerMagnetContent({
          target_audience: request.target_audience,
          content_goal: request.primary_goal === 'followers' ? 'value' : request.primary_goal as any,
          topic_preference: request.topic_preference,
          format_preference: request.format_preference === 'auto' ? undefined : request.format_preference
        });
        
      case 'viral_formula':
        return await viralFormulaEngine.generateViralContent({
          target_virality: request.viral_target || 'high',
          topic_preference: request.topic_preference,
          audience_segment: request.target_audience,
          format_preference: request.format_preference === 'auto' ? undefined : request.format_preference
        });
        
      case 'hook_evolved':
        const optimalHook = await hookEvolutionEngine.selectOptimalHook({
          topic: request.topic_preference || 'health',
          audience: request.target_audience || 'health_seekers',
          goal: request.primary_goal
        });
        
        // Generate content using the evolved hook
        return await this.generateWithEvolvedHook(optimalHook, request);
        
      case 'hybrid':
      default:
        return await this.generateHybridContent(request);
    }
  }
  
  private async generateWithEvolvedHook(hook: any, request: MasterContentRequest): Promise<any> {
    // Use the evolved hook to generate content
    const enhancedContent = await generateEnhancedContent({
      style: 'contrarian',
      format: request.format_preference,
      forceFormat: request.format_preference !== 'auto'
    });
    
    // Replace the hook with the evolved one
    let content = enhancedContent.content;
    if (Array.isArray(content)) {
      content[0] = hook.hook_text + ' ' + content[0].substring(content[0].indexOf(' ') + 1);
    } else {
      content = hook.hook_text + ' ' + content.substring(content.indexOf(' ') + 1);
    }
    
    return {
      content,
      format: enhancedContent.format,
      hook_used: {
        hook_text: hook.hook_text,
        hook_category: hook.hook_category,
        evolution_generation: hook.generation,
        predicted_performance: hook.avg_engagement_rate
      },
      viral_formula_applied: {
        formula_name: 'hook_evolved',
        success_rate: hook.success_rate,
        avg_follower_growth: hook.avg_followers_gained
      },
      content_characteristics: {
        has_statistics: hook.has_statistics,
        has_controversy: hook.has_controversy,
        has_authority_signals: true,
        has_follow_triggers: false,
        credibility_signals: ['evolved_hook'],
        conversion_hooks: ['optimized_opening']
      }
    };
  }
  
  private async generateHybridContent(request: MasterContentRequest): Promise<any> {
    // Combine multiple systems for optimal results
    console.log('[MASTER_GENERATOR] 🧬 Generating hybrid content using multiple systems...');
    
    // Get optimal hook
    const optimalHook = await hookEvolutionEngine.selectOptimalHook({
      topic: request.topic_preference || 'health',
      audience: request.target_audience || 'health_seekers',
      goal: request.primary_goal
    });
    
    // Get viral formula
    const viralContent = await viralFormulaEngine.generateViralContent({
      target_virality: request.viral_target || 'moderate',
      topic_preference: request.topic_preference,
      audience_segment: request.target_audience,
      format_preference: request.format_preference
    });
    
    // Get follower-optimized content
    const followerContent = await followerAcquisitionGenerator.generateFollowerMagnetContent({
      target_audience: request.target_audience,
      content_goal: 'value',
      topic_preference: request.topic_preference,
      format_preference: request.format_preference === 'auto' ? undefined : request.format_preference
    });
    
    // Combine the best elements
    return this.combineContentElements(optimalHook, viralContent, followerContent, request);
  }
  
  private combineContentElements(hook: any, viralContent: any, followerContent: any, request: MasterContentRequest): any {
    // Take the best hook
    const bestHook = hook.hook_text;
    
    // Take the best content structure (viral vs follower-optimized)
    const baseContent = viralContent.viral_prediction > followerContent.follower_magnet_score 
      ? viralContent.content 
      : followerContent.content;
    
    // Combine elements
    let hybridContent;
    if (Array.isArray(baseContent)) {
      // Thread format
      hybridContent = [...baseContent];
      hybridContent[0] = bestHook + ' ' + hybridContent[0].substring(hybridContent[0].indexOf(' ') + 1);
    } else {
      // Single format
      hybridContent = bestHook + ' ' + baseContent.substring(baseContent.indexOf(' ') + 1);
    }
    
    return {
      content: hybridContent,
      format: Array.isArray(hybridContent) ? 'thread' : 'single',
      hook_used: {
        hook_text: bestHook,
        hook_category: hook.hook_category,
        evolution_generation: hook.generation,
        predicted_performance: hook.avg_engagement_rate
      },
      viral_formula_applied: viralContent.pattern_used,
      content_characteristics: {
        has_statistics: hook.has_statistics || followerContent.credibility_signals?.includes('statistical_evidence'),
        has_controversy: hook.has_controversy || followerContent.credibility_signals?.includes('contrarian_angle'),
        has_authority_signals: true,
        has_follow_triggers: followerContent.follow_triggers?.length > 0,
        credibility_signals: followerContent.credibility_signals || [],
        conversion_hooks: followerContent.conversion_hooks || []
      }
    };
  }
  
  private async applyEnhancements(content: any, request: MasterContentRequest): Promise<any> {
    // Apply additional enhancements based on request
    if (request.secondary_goal && request.secondary_goal !== request.primary_goal) {
      // Apply secondary optimizations
      content = await this.applySecondaryOptimizations(content, request.secondary_goal);
    }
    
    return content;
  }
  
  private async applySecondaryOptimizations(content: any, secondaryGoal: string): Promise<any> {
    // Apply secondary optimizations without overriding primary optimizations
    console.log(`[MASTER_GENERATOR] 🔧 Applying secondary optimizations for: ${secondaryGoal}`);
    
    // For now, just return content as-is
    // In a full implementation, this would apply additional optimizations
    return content;
  }
  
  private async calculatePredictions(content: any, request: MasterContentRequest): Promise<any> {
    // Calculate comprehensive performance predictions
    const baseFollowerScore = content.viral_formula_applied?.avg_follower_growth || 0;
    const baseViralScore = content.viral_formula_applied?.success_rate || 0;
    const baseEngagementScore = content.hook_used?.predicted_performance || 0;
    
    // Normalize scores to 0-1 range
    const follower_magnet_score = Math.min(1.0, baseFollowerScore / 25);
    const viral_potential = Math.min(1.0, baseViralScore);
    const engagement_prediction = Math.min(1.0, baseEngagementScore * 2);
    
    // Calculate authority score based on content characteristics
    let authority_score = 0.5;
    if (content.content_characteristics.has_authority_signals) authority_score += 0.2;
    if (content.content_characteristics.has_statistics) authority_score += 0.2;
    if (content.content_characteristics.credibility_signals?.length > 0) authority_score += 0.1;
    
    // Calculate confidence score
    const confidence_score = (
      (content.hook_used.predicted_performance > 0 ? 0.3 : 0) +
      (content.viral_formula_applied.success_rate > 0.3 ? 0.3 : 0) +
      (content.content_characteristics.has_authority_signals ? 0.2 : 0) +
      (content.content_characteristics.has_follow_triggers ? 0.2 : 0)
    );
    
    return {
      follower_magnet_score,
      viral_potential,
      engagement_prediction,
      authority_score: Math.min(1.0, authority_score),
      confidence_score: Math.min(1.0, confidence_score),
      expected_outcomes: {
        followers_gained_prediction: Math.round(follower_magnet_score * 20), // Up to 20 followers
        engagement_rate_prediction: engagement_prediction * 0.08, // Up to 8% engagement rate
        viral_coefficient_prediction: viral_potential * 0.6 // Up to 0.6 viral coefficient
      }
    };
  }
  
  private async generateFallbackContent(request: MasterContentRequest): Promise<MasterContentResult> {
    // Generate basic fallback content
    const basicContent = await generateEnhancedContent({
      style: 'contrarian',
      format: request.format_preference || 'single'
    });
    
    return {
      content: basicContent.content,
      format: basicContent.format,
      follower_magnet_score: 0.5,
      viral_potential: 0.4,
      engagement_prediction: 0.35,
      authority_score: 0.6,
      hook_used: {
        hook_text: 'Fallback hook used',
        hook_category: 'authority',
        evolution_generation: 0,
        predicted_performance: 0.35
      },
      viral_formula_applied: {
        formula_name: 'fallback_formula',
        success_rate: 0.4,
        avg_follower_growth: 5
      },
      content_characteristics: {
        has_statistics: true,
        has_controversy: true,
        has_authority_signals: true,
        has_follow_triggers: false,
        credibility_signals: ['evidence_based'],
        conversion_hooks: ['authority_signal']
      },
      generation_method: 'hybrid',
      confidence_score: 0.5,
      expected_outcomes: {
        followers_gained_prediction: 5,
        engagement_rate_prediction: 0.035,
        viral_coefficient_prediction: 0.25
      }
    };
  }
  
  private generateOptimizationRecommendations(
    hookAnalytics: any,
    viralPatterns: any,
    followerFormulas: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Hook recommendations
    if (hookAnalytics.top_performing_hooks?.length > 0) {
      const topHook = hookAnalytics.top_performing_hooks[0];
      recommendations.push(`Top hook category: ${topHook.hook_category} (${(topHook.avg_engagement_rate * 100).toFixed(1)}% engagement)`);
    }
    
    // Viral pattern recommendations
    if (viralPatterns.length > 0) {
      const topPattern = viralPatterns[0];
      recommendations.push(`Most viral pattern: ${topPattern.name} (${(topPattern.viral_success_rate * 100).toFixed(1)}% success rate)`);
    }
    
    // Follower formula recommendations
    if (followerFormulas.length > 0) {
      const topFormula = followerFormulas[0];
      recommendations.push(`Best follower formula: ${topFormula.name} (${topFormula.avg_follower_growth.toFixed(1)} avg followers)`);
    }
    
    // Evolution recommendations
    if (hookAnalytics.optimization_opportunities?.length > 0) {
      recommendations.push(...hookAnalytics.optimization_opportunities.slice(0, 2));
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const masterContentGenerator = new MasterContentGenerator();
