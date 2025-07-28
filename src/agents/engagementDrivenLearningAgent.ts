/**
 * 📈 ENGAGEMENT-DRIVEN LEARNING AGENT
 * 
 * Analyzes tweet performance data to continuously improve:
 * - Prompt templates based on engagement
 * - Content strategies and patterns
 * - Optimal posting structures
 * - Trending topic effectiveness
 * - Template performance ranking
 */

import { supabaseClient } from '../utils/supabaseClient';
import { promptTemplateManager } from '../utils/promptTemplateManager';
import { enhancedOpenAIClient } from '../utils/enhancedOpenAIClient';
import { trendingTopicsEngine } from '../utils/trendingTopicsEngine';

interface EngagementPattern {
  pattern_type: 'structure' | 'keyword' | 'tone' | 'length' | 'hashtag' | 'question' | 'data_point';
  pattern_value: string;
  avg_engagement_rate: number;
  sample_size: number;
  confidence_score: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface ContentInsight {
  insight_type: 'best_time' | 'best_length' | 'best_hashtags' | 'best_keywords' | 'best_structure';
  insight_value: string;
  performance_score: number;
  supporting_data: any[];
  generated_at: string;
}

interface PromptOptimization {
  current_template: string;
  optimized_template: string;
  optimization_reason: string;
  expected_improvement: number;
  confidence_level: number;
}

export class EngagementDrivenLearningAgent {
  private static readonly MIN_SAMPLE_SIZE = 5;
  private static readonly CONFIDENCE_THRESHOLD = 0.7;
  private static readonly LEARNING_CYCLE_HOURS = 24;

  /**
   * 🎯 MAIN LEARNING CYCLE
   */
  static async runLearningCycle(): Promise<{
    insights_generated: number;
    templates_optimized: number;
    patterns_discovered: number;
    strategies_updated: number;
    performance_summary: string;
  }> {
    console.log('📈 Starting engagement-driven learning cycle...');
    const startTime = Date.now();

    try {
      // Step 1: Analyze recent engagement data
      const engagementPatterns = await this.analyzeEngagementPatterns();
      console.log(`🔍 Discovered ${engagementPatterns.length} engagement patterns`);

      // Step 2: Generate content insights
      const contentInsights = await this.generateContentInsights(engagementPatterns);
      console.log(`💡 Generated ${contentInsights.length} content insights`);

      // Step 3: Optimize underperforming templates
      const templateOptimizations = await this.optimizeTemplates(engagementPatterns);
      console.log(`🔧 Optimized ${templateOptimizations.length} templates`);

      // Step 4: Update content strategies
      const strategyUpdates = await this.updateContentStrategies(contentInsights);
      console.log(`📊 Updated ${strategyUpdates} content strategies`);

      // Step 5: Generate performance summary
      const performanceSummary = await this.generatePerformanceSummary(
        engagementPatterns,
        contentInsights,
        templateOptimizations
      );

      // Store learning results
      await this.storeLearningResults({
        patterns: engagementPatterns,
        insights: contentInsights,
        optimizations: templateOptimizations,
        cycle_duration_ms: Date.now() - startTime
      });

      return {
        insights_generated: contentInsights.length,
        templates_optimized: templateOptimizations.length,
        patterns_discovered: engagementPatterns.length,
        strategies_updated: strategyUpdates,
        performance_summary: performanceSummary
      };

    } catch (error) {
      console.error('❌ Learning cycle failed:', error);
      return {
        insights_generated: 0,
        templates_optimized: 0,
        patterns_discovered: 0,
        strategies_updated: 0,
        performance_summary: 'Learning cycle failed due to error'
      };
    }
  }

  /**
   * 🔍 ANALYZE ENGAGEMENT PATTERNS
   */
  private static async analyzeEngagementPatterns(): Promise<EngagementPattern[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('analyze_engagement_patterns', {
          days_back: 7,
          min_sample_size: this.MIN_SAMPLE_SIZE
        });

      if (error) {
        console.error('❌ Failed to analyze engagement patterns:', error);
        return [];
      }

      // Process and validate patterns
      const patterns: EngagementPattern[] = (data || [])
        .filter((pattern: any) => pattern.confidence_score >= this.CONFIDENCE_THRESHOLD)
        .map((pattern: any) => ({
          pattern_type: pattern.pattern_type,
          pattern_value: pattern.pattern_value,
          avg_engagement_rate: pattern.avg_engagement_rate,
          sample_size: pattern.sample_size,
          confidence_score: pattern.confidence_score,
          trend: this.determineTrend(pattern.historical_performance)
        }));

      console.log(`🔍 Found ${patterns.length} high-confidence engagement patterns`);
      return patterns;

    } catch (error) {
      console.error('❌ Pattern analysis failed:', error);
      return [];
    }
  }

  /**
   * 💡 GENERATE CONTENT INSIGHTS
   */
  private static async generateContentInsights(
    patterns: EngagementPattern[]
  ): Promise<ContentInsight[]> {
    const insights: ContentInsight[] = [];

    try {
      // Best performing structures
      const structurePatterns = patterns.filter(p => p.pattern_type === 'structure');
      if (structurePatterns.length > 0) {
        const bestStructure = structurePatterns.reduce((best, current) => 
          current.avg_engagement_rate > best.avg_engagement_rate ? current : best
        );

        insights.push({
          insight_type: 'best_structure',
          insight_value: bestStructure.pattern_value,
          performance_score: bestStructure.avg_engagement_rate,
          supporting_data: structurePatterns,
          generated_at: new Date().toISOString()
        });
      }

      // Optimal content length
      const lengthPatterns = patterns.filter(p => p.pattern_type === 'length');
      if (lengthPatterns.length > 0) {
        const optimalLength = this.findOptimalLength(lengthPatterns);
        insights.push({
          insight_type: 'best_length',
          insight_value: optimalLength.range,
          performance_score: optimalLength.engagement_rate,
          supporting_data: lengthPatterns,
          generated_at: new Date().toISOString()
        });
      }

      // Top performing keywords
      const keywordPatterns = patterns
        .filter(p => p.pattern_type === 'keyword')
        .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
        .slice(0, 5);

      if (keywordPatterns.length > 0) {
        insights.push({
          insight_type: 'best_keywords',
          insight_value: keywordPatterns.map(p => p.pattern_value).join(', '),
          performance_score: keywordPatterns[0].avg_engagement_rate,
          supporting_data: keywordPatterns,
          generated_at: new Date().toISOString()
        });
      }

      // Effective hashtags
      const hashtagPatterns = patterns
        .filter(p => p.pattern_type === 'hashtag')
        .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
        .slice(0, 3);

      if (hashtagPatterns.length > 0) {
        insights.push({
          insight_type: 'best_hashtags',
          insight_value: hashtagPatterns.map(p => p.pattern_value).join(', '),
          performance_score: hashtagPatterns[0].avg_engagement_rate,
          supporting_data: hashtagPatterns,
          generated_at: new Date().toISOString()
        });
      }

      console.log(`💡 Generated ${insights.length} actionable insights`);
      return insights;

    } catch (error) {
      console.error('❌ Insight generation failed:', error);
      return [];
    }
  }

  /**
   * 🔧 OPTIMIZE TEMPLATES
   */
  private static async optimizeTemplates(
    patterns: EngagementPattern[]
  ): Promise<PromptOptimization[]> {
    const optimizations: PromptOptimization[] = [];

    try {
      // Get underperforming templates
      const underperformingTemplates = await this.getUnderperformingTemplates();
      
      for (const template of underperformingTemplates) {
        const optimization = await this.generateTemplateOptimization(template, patterns);
        if (optimization) {
          optimizations.push(optimization);
          
          // Apply optimization
          await this.applyTemplateOptimization(template.id, optimization);
        }
      }

      console.log(`🔧 Generated ${optimizations.length} template optimizations`);
      return optimizations;

    } catch (error) {
      console.error('❌ Template optimization failed:', error);
      return [];
    }
  }

  /**
   * 🤖 GENERATE TEMPLATE OPTIMIZATION
   */
  private static async generateTemplateOptimization(
    template: any,
    patterns: EngagementPattern[]
  ): Promise<PromptOptimization | null> {
    try {
      // Find relevant patterns for this template type
      const relevantPatterns = patterns.filter(p => 
        p.avg_engagement_rate > 0.03 && // Above 3% engagement rate
        p.confidence_score > this.CONFIDENCE_THRESHOLD
      );

      if (relevantPatterns.length === 0) {
        return null;
      }

      // Build optimization prompt
      const optimizationPrompt = `Improve this tweet template based on high-performing patterns:

CURRENT TEMPLATE: "${template.template}"
TEMPLATE TYPE: ${template.type}
CURRENT PERFORMANCE: ${template.avg_engagement_rate.toFixed(3)} engagement rate

HIGH-PERFORMING PATTERNS TO INCORPORATE:
${relevantPatterns.map(p => 
  `- ${p.pattern_type}: "${p.pattern_value}" (${(p.avg_engagement_rate * 100).toFixed(1)}% engagement)`
).join('\n')}

OPTIMIZATION REQUIREMENTS:
1. Keep the core template structure but improve engagement elements
2. Incorporate top-performing keywords, phrases, or structures
3. Maintain the ${template.tone} tone
4. Ensure it's still suitable for ${template.type} content
5. Make it more likely to drive likes, replies, and retweets

Return the improved template with the same placeholder format (using {variable} syntax).
Also briefly explain what changes you made and why.

FORMAT:
OPTIMIZED_TEMPLATE: [new template]
CHANGES_MADE: [brief explanation]
EXPECTED_IMPROVEMENT: [percentage estimate]`;

      const response = await enhancedOpenAIClient.generateContent(optimizationPrompt, {
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0.7,
        operation_type: 'template_optimization'
      });

      if (!response.success) {
        console.warn(`⚠️ Failed to optimize template ${template.id}: ${response.error}`);
        return null;
      }

      // Parse response
      const optimizedTemplate = this.extractOptimizedTemplate(response.content);
      const changesExplanation = this.extractChangesExplanation(response.content);
      const expectedImprovement = this.extractExpectedImprovement(response.content);

      return {
        current_template: template.template,
        optimized_template: optimizedTemplate,
        optimization_reason: changesExplanation,
        expected_improvement: expectedImprovement,
        confidence_level: 0.8
      };

    } catch (error) {
      console.error('❌ Template optimization generation failed:', error);
      return null;
    }
  }

  /**
   * 📊 UPDATE CONTENT STRATEGIES
   */
  private static async updateContentStrategies(insights: ContentInsight[]): Promise<number> {
    let updatesCount = 0;

    try {
      // Update trending topics strategy
      const keywordInsights = insights.filter(i => i.insight_type === 'best_keywords');
      if (keywordInsights.length > 0) {
        await trendingTopicsEngine.saveTrendsToDatabase([
          {
            keyword: keywordInsights[0].insight_value.split(', ')[0],
            category: 'health',
            popularity_score: keywordInsights[0].performance_score * 100,
            source: 'engagement_learning',
            last_updated: new Date().toISOString()
          }
        ]);
        updatesCount++;
      }

      // Update optimal posting strategy
      const structureInsights = insights.filter(i => i.insight_type === 'best_structure');
      if (structureInsights.length > 0) {
        await this.updatePostingStrategy(structureInsights[0]);
        updatesCount++;
      }

      // Update hashtag strategy
      const hashtagInsights = insights.filter(i => i.insight_type === 'best_hashtags');
      if (hashtagInsights.length > 0) {
        await this.updateHashtagStrategy(hashtagInsights[0]);
        updatesCount++;
      }

      console.log(`📊 Updated ${updatesCount} content strategies`);
      return updatesCount;

    } catch (error) {
      console.error('❌ Strategy update failed:', error);
      return 0;
    }
  }

  /**
   * 📈 GENERATE PERFORMANCE SUMMARY
   */
  private static async generatePerformanceSummary(
    patterns: EngagementPattern[],
    insights: ContentInsight[],
    optimizations: PromptOptimization[]
  ): Promise<string> {
    try {
      const topPatterns = patterns
        .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
        .slice(0, 3);

      const summary = `🎯 ENGAGEMENT LEARNING SUMMARY

🔥 TOP PERFORMING PATTERNS:
${topPatterns.map(p => 
  `• ${p.pattern_type}: "${p.pattern_value}" - ${(p.avg_engagement_rate * 100).toFixed(1)}% engagement`
).join('\n')}

💡 KEY INSIGHTS:
${insights.map(i => 
  `• ${i.insight_type}: ${i.insight_value} (${i.performance_score.toFixed(3)} score)`
).join('\n')}

🔧 OPTIMIZATIONS APPLIED:
${optimizations.length} templates improved with expected ${
  optimizations.reduce((sum, opt) => sum + opt.expected_improvement, 0).toFixed(1)
}% total improvement

🎯 RECOMMENDATIONS:
- Focus on ${topPatterns[0]?.pattern_value || 'high-engagement patterns'}
- Continue using successful ${insights.find(i => i.insight_type === 'best_structure')?.insight_value || 'content structures'}
- Incorporate trending keywords naturally`;

      return summary;

    } catch (error) {
      console.error('❌ Summary generation failed:', error);
      return 'Performance summary generation failed';
    }
  }

  /**
   * 💾 HELPER METHODS
   */
  private static determineTrend(historicalPerformance: number[]): 'improving' | 'declining' | 'stable' {
    if (!historicalPerformance || historicalPerformance.length < 2) return 'stable';
    
    const recent = historicalPerformance.slice(-3);
    const older = historicalPerformance.slice(0, -3);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (changePercent > 5) return 'improving';
    if (changePercent < -5) return 'declining';
    return 'stable';
  }

  private static findOptimalLength(lengthPatterns: EngagementPattern[]): {
    range: string;
    engagement_rate: number;
  } {
    const bestPattern = lengthPatterns.reduce((best, current) => 
      current.avg_engagement_rate > best.avg_engagement_rate ? current : best
    );
    
    return {
      range: bestPattern.pattern_value,
      engagement_rate: bestPattern.avg_engagement_rate
    };
  }

  private static async getUnderperformingTemplates(): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_underperforming_templates', {
          threshold: 0.02 // Below 2% engagement rate
        });

      return error ? [] : data || [];
    } catch (error) {
      console.error('❌ Failed to get underperforming templates:', error);
      return [];
    }
  }

  private static async applyTemplateOptimization(
    templateId: string,
    optimization: PromptOptimization
  ): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('prompt_templates')
        .update({
          template: optimization.optimized_template,
          version: supabaseClient.supabase.raw('version + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId);

      // Log the optimization
      await supabaseClient.supabase
        .from('template_optimizations')
        .insert({
          template_id: templateId,
          old_template: optimization.current_template,
          new_template: optimization.optimized_template,
          optimization_reason: optimization.optimization_reason,
          expected_improvement: optimization.expected_improvement,
          applied_at: new Date().toISOString()
        });

    } catch (error) {
      console.error('❌ Failed to apply template optimization:', error);
    }
  }

  private static extractOptimizedTemplate(content: string): string {
    const match = content.match(/OPTIMIZED_TEMPLATE:\s*(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : content.split('\n')[0].trim();
  }

  private static extractChangesExplanation(content: string): string {
    const match = content.match(/CHANGES_MADE:\s*(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : 'AI-driven optimization based on engagement patterns';
  }

  private static extractExpectedImprovement(content: string): number {
    const match = content.match(/EXPECTED_IMPROVEMENT:\s*(\d+(?:\.\d+)?)%?/i);
    return match ? parseFloat(match[1]) : 15; // Default 15% expected improvement
  }

  private static async updatePostingStrategy(insight: ContentInsight): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('content_strategies')
        .upsert({
          strategy_type: 'optimal_structure',
          strategy_value: insight.insight_value,
          performance_score: insight.performance_score,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'strategy_type'
        });
    } catch (error) {
      console.error('❌ Failed to update posting strategy:', error);
    }
  }

  private static async updateHashtagStrategy(insight: ContentInsight): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('content_strategies')
        .upsert({
          strategy_type: 'optimal_hashtags',
          strategy_value: insight.insight_value,
          performance_score: insight.performance_score,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'strategy_type'
        });
    } catch (error) {
      console.error('❌ Failed to update hashtag strategy:', error);
    }
  }

  private static async storeLearningResults(results: any): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('learning_cycles')
        .insert({
          patterns_count: results.patterns.length,
          insights_count: results.insights.length,
          optimizations_count: results.optimizations.length,
          cycle_duration_ms: results.cycle_duration_ms,
          cycle_completed_at: new Date().toISOString(),
          results_summary: JSON.stringify(results, null, 2)
        });
    } catch (error) {
      console.error('❌ Failed to store learning results:', error);
    }
  }

  /**
   * 📊 GET LEARNING ANALYTICS
   */
  static async getLearningAnalytics(): Promise<{
    total_cycles: number;
    avg_patterns_per_cycle: number;
    avg_optimizations_per_cycle: number;
    total_template_improvements: number;
    learning_effectiveness: number;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_learning_analytics');

      if (error) throw error;

      return data || {
        total_cycles: 0,
        avg_patterns_per_cycle: 0,
        avg_optimizations_per_cycle: 0,
        total_template_improvements: 0,
        learning_effectiveness: 0
      };
    } catch (error) {
      console.error('❌ Failed to get learning analytics:', error);
      return {
        total_cycles: 0,
        avg_patterns_per_cycle: 0,
        avg_optimizations_per_cycle: 0,
        total_template_improvements: 0,
        learning_effectiveness: 0
      };
    }
  }
}

export const engagementDrivenLearningAgent = EngagementDrivenLearningAgent; 