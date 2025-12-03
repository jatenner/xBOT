/**
 * 🔄 EXPERT INSIGHTS AGGREGATOR
 * 
 * Aggregates expert analyses by angle/tone/structure combinations
 * Synthesizes common patterns into strategic recommendations
 * 
 * Used by: expertInsightsAggregatorJob (scheduled every 12 hours)
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { log } from '../lib/logger';

export interface AggregatedExpertInsights {
  strategic_insights: string;
  content_strategy: string[];
  hook_advice: string;
  messaging_tips: string[];
  formatting_advice: string[];
  timing_recommendations: string[];
  audience_targeting: string[];
  based_on_count: number;
}

export class ExpertInsightsAggregator {
  private supabase = getSupabaseClient();

  /**
   * Get recent expert analyses (last N days)
   */
  async getRecentAnalyses(daysBack: number = 30): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    log({ op: 'expert_aggregator_get_analyses', daysBack, cutoffDate });

    const { data, error } = await this.supabase
      .from('expert_tweet_analysis')
      .select('*')
      .gte('analyzed_at', cutoffDate.toISOString())
      .order('analyzed_at', { ascending: false });

    if (error) {
      log({ op: 'expert_aggregator_error', error: error.message });
      throw new Error(`Failed to get recent analyses: ${error.message}`);
    }

    log({ op: 'expert_aggregator_analyses_found', count: data?.length || 0 });

    return data || [];
  }

  /**
   * Group analyses by angle/tone/structure combination
   */
  async groupByCombination(analyses: any[]): Promise<Map<string, any[]>> {
    const grouped = new Map<string, any[]>();

    // Get classifications for each tweet
    for (const analysis of analyses) {
      const { data: classification } = await this.supabase
        .from('vi_content_classification')
        .select('angle, tone, structure')
        .eq('tweet_id', analysis.tweet_id)
        .maybeSingle();

      if (!classification || !classification.angle || !classification.tone || !classification.structure) {
        continue; // Skip if no classification
      }

      const combination = `${classification.angle}|${classification.tone}|${classification.structure}`;

      if (!grouped.has(combination)) {
        grouped.set(combination, []);
      }

      grouped.get(combination)!.push({
        ...analysis,
        angle: classification.angle,
        tone: classification.tone,
        structure: classification.structure
      });
    }

    log({ op: 'expert_aggregator_grouped', combinations: grouped.size });

    return grouped;
  }

  /**
   * Synthesize insights for a combination
   */
  async synthesizeInsights(analyses: any[]): Promise<AggregatedExpertInsights> {
    if (analyses.length === 0) {
      throw new Error('Cannot synthesize insights from empty analyses');
    }

    log({ op: 'expert_aggregator_synthesize_start', count: analyses.length });

    // ✅ NEW: Extract visual patterns across tweets
    const visualPatterns = this.extractVisualPatterns(analyses);
    
    // ✅ NEW: Calculate performance correlations
    const correlations = this.calculateCorrelations(analyses);

    // Build synthesis prompt (with visual patterns and correlations)
    const prompt = this.buildSynthesisPrompt(analyses, visualPatterns, correlations);

    // Get synthesized insights from GPT-4o
    const synthesized = await this.getSynthesizedInsights(prompt, analyses.length, visualPatterns, correlations);

    log({ op: 'expert_aggregator_synthesize_complete' });

    return synthesized;
  }

  /**
   * ✅ NEW: Extract visual patterns across tweets
   */
  private extractVisualPatterns(analyses: any[]): any {
    const patterns = {
      emoji_placement: {
        hook_emoji: { positions: [] as number[], success_count: 0, total_count: 0 },
        structural_emojis: { positions: [] as number[], success_count: 0, total_count: 0 }
      },
      structural_ratios: [] as number[],
      visual_complexity: [] as number[]
    };
    
    analyses.forEach(analysis => {
      if (analysis.visual_data_points) {
        const vdp = analysis.visual_data_points;
        
        // Extract emoji positions
        if (vdp.emoji_positions && Array.isArray(vdp.emoji_positions)) {
          vdp.emoji_positions.forEach((emoji: any) => {
            if (emoji.role === 'hook_enhancement' && emoji.position <= 10) {
              patterns.emoji_placement.hook_emoji.positions.push(emoji.position);
              patterns.emoji_placement.hook_emoji.total_count++;
            } else if (emoji.role === 'structural') {
              patterns.emoji_placement.structural_emojis.positions.push(emoji.position);
              patterns.emoji_placement.structural_emojis.total_count++;
            }
          });
        }
        
        // Extract structural ratios
        if (vdp.structural_ratio !== undefined && vdp.structural_ratio !== null) {
          patterns.structural_ratios.push(vdp.structural_ratio);
        }
        
        // Extract visual complexity
        if (vdp.visual_complexity !== undefined && vdp.visual_complexity !== null) {
          patterns.visual_complexity.push(vdp.visual_complexity);
        }
      }
    });
    
    // Calculate averages
    if (patterns.structural_ratios.length > 0) {
      const avgRatio = patterns.structural_ratios.reduce((a, b) => a + b, 0) / patterns.structural_ratios.length;
      patterns.structural_ratios = [avgRatio]; // Store average
    }
    
    if (patterns.visual_complexity.length > 0) {
      const avgComplexity = patterns.visual_complexity.reduce((a, b) => a + b, 0) / patterns.visual_complexity.length;
      patterns.visual_complexity = [avgComplexity]; // Store average
    }
    
    return patterns;
  }

  /**
   * ✅ NEW: Calculate performance correlations
   */
  private calculateCorrelations(analyses: any[]): any {
    const correlations = {
      hook_emoji_at_0: { success_count: 0, total_count: 0 },
      structural_ratio_0_7_0_9: { success_count: 0, total_count: 0 },
      visual_complexity_60_70: { success_count: 0, total_count: 0 }
    };
    
    analyses.forEach(analysis => {
      const er = analysis.engagement_rate || 0;
      const is_success = er >= 0.02; // 2%+ ER = success
      
      // Hook emoji at position 0
      const hasHookEmojiAt0 = analysis.visual_data_points?.emoji_positions?.some(
        (e: any) => e.position <= 10 && e.role === 'hook_enhancement'
      );
      if (hasHookEmojiAt0) {
        correlations.hook_emoji_at_0.total_count++;
        if (is_success) correlations.hook_emoji_at_0.success_count++;
      }
      
      // Structural ratio 0.7-0.9
      const ratio = analysis.visual_data_points?.structural_ratio || 0;
      if (ratio >= 0.7 && ratio <= 0.9) {
        correlations.structural_ratio_0_7_0_9.total_count++;
        if (is_success) correlations.structural_ratio_0_7_0_9.success_count++;
      }
      
      // Visual complexity 60-70
      const complexity = analysis.visual_data_points?.visual_complexity || 0;
      if (complexity >= 60 && complexity <= 70) {
        correlations.visual_complexity_60_70.total_count++;
        if (is_success) correlations.visual_complexity_60_70.success_count++;
      }
    });
    
    // Calculate success rates
    Object.keys(correlations).forEach(key => {
      const corr = correlations[key as keyof typeof correlations];
      (corr as any).success_rate = corr.total_count > 0 
        ? corr.success_count / corr.total_count 
        : 0;
    });
    
    return correlations;
  }

  /**
   * Build synthesis prompt
   */
  private buildSynthesisPrompt(analyses: any[], visualPatterns?: any, correlations?: any): string {
    const examples = analyses.slice(0, 10).map(a => ({
      tweet_id: a.tweet_id,
      strategic_analysis: a.strategic_analysis,
      content_intelligence: a.content_intelligence,
      actionable_recommendations: a.actionable_recommendations
    }));

    // ✅ NEW: Build visual patterns section
    let visualPatternsSection = '';
    if (visualPatterns && correlations) {
      visualPatternsSection = `

VISUAL DATA PATTERNS (from Visual Analysis Agent):
- Hook emoji at position 0-10: ${visualPatterns.emoji_placement.hook_emoji.total_count} out of ${analyses.length} tweets (${Math.round(visualPatterns.emoji_placement.hook_emoji.total_count / analyses.length * 100)}%)
- Structural ratio 0.7-0.9: ${visualPatterns.structural_ratios.length > 0 ? Math.round(visualPatterns.structural_ratios[0] * 100) + '% average' : 'N/A'}
- Visual complexity 60-70: ${visualPatterns.visual_complexity.length > 0 ? Math.round(visualPatterns.visual_complexity[0]) : 'N/A'} average

PERFORMANCE CORRELATIONS:
- Hook emoji at 0-10: ${correlations.hook_emoji_at_0.success_rate * 100}% success rate (${correlations.hook_emoji_at_0.success_count}/${correlations.hook_emoji_at_0.total_count})
- Structural ratio 0.7-0.9: ${correlations.structural_ratio_0_7_0_9.success_rate * 100}% success rate (${correlations.structural_ratio_0_7_0_9.success_count}/${correlations.structural_ratio_0_7_0_9.total_count})
- Visual complexity 60-70: ${correlations.visual_complexity_60_70.success_rate * 100}% success rate (${correlations.visual_complexity_60_70.success_count}/${correlations.visual_complexity_60_70.total_count})`;
    }

    return `You are an expert social media strategist synthesizing insights from ${analyses.length} successful tweets.

ANALYSES:
${JSON.stringify(examples, null, 2)}${visualPatternsSection}

YOUR TASK: Synthesize common patterns and create strategic recommendations.
${visualPatternsSection ? 'Include visual data patterns and performance correlations in your recommendations.' : ''}

SYNTHESIS FRAMEWORK:

1. STRATEGIC INSIGHTS:
   - What common patterns emerge across these successful tweets?
   - Why do these patterns work?
   - What's the underlying strategy?

2. CONTENT STRATEGY:
   - How should content creators approach this combination?
   - What are the key principles?
   - What should they focus on?

3. HOOK ADVICE:
   - What hook strategies work best?
   - Why do they work?
   - How to improve hooks?

4. MESSAGING TIPS:
   - What messaging approaches work?
   - How to deliver value?
   - What tone/style works?

5. FORMATTING ADVICE:
   - How should content be formatted?
   - What visual elements help?
   - What structure works?

6. TIMING RECOMMENDATIONS:
   - When should this type be posted?
   - What timing patterns work?

7. AUDIENCE TARGETING:
   - Who resonates with this?
   - How to target audience?

Return JSON in this exact format:
{
  "strategic_insights": "string (plain English explanation of common patterns)",
  "content_strategy": ["string", "string"],
  "hook_advice": "string (plain English advice on hooks)",
  "messaging_tips": ["string", "string"],
  "formatting_advice": ["string", "string"],
  "timing_recommendations": ["string", "string"],
  "audience_targeting": ["string", "string"]
}`;
  }

  /**
   * Get synthesized insights from GPT-4o
   */
  private async getSynthesizedInsights(prompt: string, basedOnCount: number, visualPatterns?: any, correlations?: any): Promise<AggregatedExpertInsights> {
    const response = await createBudgetedChatCompletion(
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert social media strategist synthesizing insights from multiple successful tweets. 
Provide clear, actionable strategic recommendations in plain English.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      },
      {
        purpose: 'expert_insights_synthesis',
        priority: 'medium'
      }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    // Parse JSON response
    let synthesized: any;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        synthesized = JSON.parse(jsonMatch[1]);
      } else {
        synthesized = JSON.parse(content);
      }
    } catch (error: any) {
      log({ op: 'expert_aggregator_parse_error', error: error.message });
      throw new Error(`Failed to parse synthesized insights: ${error.message}`);
    }

    // ✅ NEW: Enhance with visual patterns and correlations
    const enhanced = {
      ...synthesized,
      based_on_count: basedOnCount
    } as AggregatedExpertInsights;
    
    // Add visual patterns and correlations to the insights
    if (visualPatterns && correlations) {
      (enhanced as any).visual_data_patterns = visualPatterns;
      (enhanced as any).pattern_correlations = correlations;
      (enhanced as any).specific_guidance = {
        emoji_placement: `Place hook emoji at position 0-10 (🔥 ⚡) - ${correlations.hook_emoji_at_0.success_rate * 100}% success rate`,
        structural_ratio: `Maintain structural ratio 0.7-0.9 (80% structural, 20% decorative) - ${correlations.structural_ratio_0_7_0_9.success_rate * 100}% success rate`,
        visual_complexity: `Aim for visual complexity 60-70 - ${correlations.visual_complexity_60_70.success_rate * 100}% success rate`
      };
    }
    
    return enhanced;
  }

  /**
   * Store aggregated insights in vi_format_intelligence
   */
  async storeInsights(combination: string, insights: AggregatedExpertInsights): Promise<void> {
    const [angle, tone, structure] = combination.split('|');

    // Find or create vi_format_intelligence entry
    const queryKey = `|${angle}|${tone}|${structure}`;

    // Try to find existing entry
    const { data: existing } = await this.supabase
      .from('vi_format_intelligence')
      .select('id')
      .eq('query_key', queryKey)
      .maybeSingle();

    if (existing) {
      // ✅ NEW: Build enhanced expert_insights with visual patterns
      const enhancedInsights = {
        strategic_insights: insights.strategic_insights,
        content_strategy: insights.content_strategy,
        hook_advice: insights.hook_advice,
        messaging_tips: insights.messaging_tips,
        formatting_advice: insights.formatting_advice,
        timing_recommendations: insights.timing_recommendations,
        audience_targeting: insights.audience_targeting,
        based_on_count: insights.based_on_count,
        // ✅ NEW: Include visual patterns and correlations if available
        visual_data_patterns: (insights as any).visual_data_patterns || null,
        pattern_correlations: (insights as any).pattern_correlations || null,
        specific_guidance: (insights as any).specific_guidance || null
      };

      // Update existing entry
      const { error } = await this.supabase
        .from('vi_format_intelligence')
        .update({
          expert_insights: enhancedInsights,
          strategic_recommendations: insights.content_strategy,
          content_strategy: insights.strategic_insights,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        log({ op: 'expert_aggregator_store_error', error: error.message });
        throw new Error(`Failed to update insights: ${error.message}`);
      }
    } else {
      // ✅ NEW: Build enhanced expert_insights with visual patterns
      const enhancedInsights = {
        strategic_insights: insights.strategic_insights,
        content_strategy: insights.content_strategy,
        hook_advice: insights.hook_advice,
        messaging_tips: insights.messaging_tips,
        formatting_advice: insights.formatting_advice,
        timing_recommendations: insights.timing_recommendations,
        audience_targeting: insights.audience_targeting,
        based_on_count: insights.based_on_count,
        // ✅ NEW: Include visual patterns and correlations if available
        visual_data_patterns: (insights as any).visual_data_patterns || null,
        pattern_correlations: (insights as any).pattern_correlations || null,
        specific_guidance: (insights as any).specific_guidance || null
      };

      // Create new entry (minimal required fields)
      const { error } = await this.supabase
        .from('vi_format_intelligence')
        .insert({
          topic: 'general', // Will be updated when matched with topic
          angle,
          tone,
          structure,
          query_key: queryKey,
          recommended_format: {}, // Empty, will be filled by VI processor
          tier_breakdown: {},
          confidence_level: 'medium',
          based_on_count: insights.based_on_count,
          expert_insights: enhancedInsights,
          strategic_recommendations: insights.content_strategy,
          content_strategy: insights.strategic_insights
        });

      if (error) {
        log({ op: 'expert_aggregator_store_error', error: error.message });
        throw new Error(`Failed to create insights entry: ${error.message}`);
      }
    }

    log({ op: 'expert_aggregator_stored', combination });
  }

  /**
   * Aggregate all insights
   */
  async aggregateAllInsights(): Promise<void> {
    log({ op: 'expert_aggregator_start' });

    // Get recent analyses
    const analyses = await this.getRecentAnalyses(30);

    if (analyses.length === 0) {
      log({ op: 'expert_aggregator_no_data' });
      return;
    }

    // Group by combination
    const grouped = await this.groupByCombination(analyses);

    // Synthesize insights for each combination
    for (const [combination, groupAnalyses] of grouped.entries()) {
      if (groupAnalyses.length < 3) {
        log({ op: 'expert_aggregator_skip', combination, reason: 'insufficient_data', count: groupAnalyses.length });
        continue; // Need at least 3 analyses to synthesize
      }

      try {
        const synthesized = await this.synthesizeInsights(groupAnalyses);
        await this.storeInsights(combination, synthesized);
        log({ op: 'expert_aggregator_combination_complete', combination });
      } catch (error: any) {
        log({ op: 'expert_aggregator_combination_error', combination, error: error.message });
        // Continue with other combinations
      }
    }

    log({ op: 'expert_aggregator_complete' });
  }
}

