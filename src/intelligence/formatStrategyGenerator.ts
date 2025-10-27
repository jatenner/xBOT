/**
 * 🎨 FORMAT STRATEGY GENERATOR
 * 
 * Generates unique formatting and structural strategies for content.
 * 
 * What is a "format strategy"?
 * - The VISUAL STRUCTURE and organizational approach for content
 * - How information should be presented, organized, and formatted
 * - The flow, hierarchy, and visual elements that make content scannable
 * 
 * Examples of AI-generated strategies:
 * - "Progressive timeline showing effects at 0h→4h→12h with optimal windows highlighted"
 * - "Question-driven cascade where each line answers deeper why about previous"
 * - "Before/after comparison with common mistakes marked, optimal approach emphasized"
 * - "Arrow-based cause-effect chain starting with trigger, cascading through responses"
 * - "Data reveal: Start with headline number, break into components, end with protocol"
 * 
 * This creates INFINITE visual diversity - same content can be structured many different ways!
 * 
 * Avoidance Strategy: Last 4 (lighter than topics/angles/tones)
 * - Format strategies are naturally more varied
 * - Only need to avoid immediate back-to-back repetition
 * - Allows successful formats to emerge and be used more frequently
 * - Perfect for data-driven learning
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db/index';

export class FormatStrategyGenerator {
  private static instance: FormatStrategyGenerator;
  private supabase = getSupabaseClient();
  
  private constructor() {}
  
  public static getInstance(): FormatStrategyGenerator {
    if (!FormatStrategyGenerator.instance) {
      FormatStrategyGenerator.instance = new FormatStrategyGenerator();
    }
    return FormatStrategyGenerator.instance;
  }
  
  /**
   * Generate a unique formatting strategy
   * 
   * @param topic - The content topic
   * @param angle - The content angle/perspective
   * @param tone - The content tone/voice
   * @param generator - The generator personality
   * @returns Formatting strategy description
   */
  async generateStrategy(
    topic: string,
    angle: string,
    tone: string,
    generator: string
  ): Promise<string> {
    console.log('[FORMAT_STRATEGY] 🎨 Generating unique formatting strategy...');
    
    // Get last 4 format strategies (lighter avoidance than topics/angles/tones)
    const recentStrategies = await this.getLast4Strategies();
    
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await createBudgetedChatCompletion({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'You are a content formatting strategist with unlimited creative freedom. Design unique, context-aware visual structures for Twitter content that maximize scannability and engagement.'
            },
            { 
              role: 'user', 
              content: this.buildPrompt(topic, angle, tone, generator, recentStrategies)
            }
          ],
          temperature: 1.5, // Maximum creativity for format innovation
          max_tokens: 120, // Concise strategy description
          response_format: { type: 'json_object' }
        }, {
          purpose: 'format_strategy_generation'
        });
        
        const parsed = JSON.parse(response.choices[0].message.content || '{}');
        const strategy = parsed.strategy || 'Clear, scannable format with logical flow and visual hierarchy';
        
        // Validate it's not in recent list
        if (recentStrategies.length > 0 && recentStrategies.includes(strategy)) {
          console.log(`[FORMAT_STRATEGY] ⚠️ Generated recently-used strategy, retrying (attempt ${attempt}/${maxRetries})`);
          continue;
        }
        
        console.log(`[FORMAT_STRATEGY] ✅ Generated: "${strategy}"`);
        
        return strategy;
        
      } catch (error: any) {
        console.error(`[FORMAT_STRATEGY] ❌ Attempt ${attempt}/${maxRetries} error:`, error.message);
        
        if (attempt === maxRetries) {
          // Final fallback
          console.log('[FORMAT_STRATEGY] ⚠️ Using fallback strategy');
          return 'Clear sections with visual hierarchy and scannable structure';
        }
      }
    }
    
    // TypeScript safety (should never reach here)
    return 'Clear sections with visual hierarchy and scannable structure';
  }
  
  /**
   * Build the format strategy generation prompt
   * NO hardcoded list of elements - pure AI creativity
   */
  private buildPrompt(
    topic: string,
    angle: string,
    tone: string,
    generator: string,
    recentStrategies: string[]
  ): string {
    return `
Generate a unique visual formatting and structural strategy for this Twitter content:

Content Context:
- Topic: ${topic}
- Angle: ${angle}
- Tone: ${tone}
- Generator personality: ${generator}

Your job: Design how this content should be visually structured and organized for maximum engagement.

Consider:
- What organizational flow fits this angle best?
- What visual elements would enhance this tone?
- How can structure make the topic more scannable?
- What formatting amplifies the generator's personality?
- How can visual hierarchy improve comprehension?

${recentStrategies.length > 0 ? `
🚫 RECENTLY USED (create something different):
${recentStrategies.map((s, i) => `${i + 1}. "${s}"`).join('\n')}
` : '(No recent strategies - total creative freedom!)'}

⚡ UNLIMITED CREATIVE FREEDOM:
You have complete freedom to design formatting approaches.
- Create ANY organizational structure
- Design ANY visual hierarchy
- Use ANY flow pattern or sequence
- Invent novel formatting combinations
- Think beyond conventional Twitter structures

Don't follow templates or lists. Design formatting that serves THIS specific content uniquely.

Examples of creative strategies (for inspiration only - create your own):
- "Countdown revelation: Start with number, count down through mechanisms to action"
- "Split-screen comparison: Side-by-side conventional vs optimal with visual contrast"
- "Question cascade: Each sentence answers deeper 'why' building to breakthrough insight"
- "Data waterfall: Lead with headline stat, cascade through components, pool at protocol"
- "Reverse engineering: Begin with outcome, trace back through causal pathway"
- "Dual pathway flow: Show two routes to same outcome, highlight which is superior"
- "Progressive reveal: Layer information with increasing specificity"
- "Checklist with rationale: Each item paired with why it matters"

Be innovative. Create something unique and context-appropriate.

Output JSON format:
{
  "strategy": "Your unique formatting strategy description (1-2 sentences max)"
}
`;
  }
  
  /**
   * Get last 4 format strategies (avoid immediate repetition)
   * Lighter window than topics/angles/tones since format strategies are naturally more varied
   */
  private async getLast4Strategies(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('content_metadata')
        .select('format_strategy')
        .not('format_strategy', 'is', null)
        .order('created_at', { ascending: false })
        .limit(4); // Only last 4 (vs 10 for topics/angles/tones)
      
      if (error) {
        console.error('[FORMAT_STRATEGY] Error fetching recent strategies:', error);
        return [];
      }
      
      const strategies = (data || [])
        .map(d => d.format_strategy)
        .filter((s): s is string => !!s && s.trim().length > 0);
      
      console.log(`[FORMAT_STRATEGY] 🚫 Avoiding last ${strategies.length} strategies`);
      
      return strategies;
      
    } catch (error) {
      console.error('[FORMAT_STRATEGY] Exception fetching recent strategies:', error);
      return [];
    }
  }
  
  /**
   * Get top-performing format strategies (for Phase 2 learning)
   * 
   * @param limit - Number of top strategies to return
   * @returns Array of high-performing format strategies with metrics
   */
  async getTopPerformingStrategies(limit: number = 10): Promise<Array<{
    strategy: string;
    avg_views: number;
    avg_likes: number;
    posts: number;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('content_metadata')
        .select('format_strategy, actual_impressions, actual_likes')
        .not('format_strategy', 'is', null)
        .not('actual_impressions', 'is', null)
        .gte('actual_impressions', 1)
        .order('created_at', { ascending: false })
        .limit(500); // Analyze recent 500 posts
      
      if (error || !data || data.length === 0) {
        console.log('[FORMAT_STRATEGY] 📊 No performance data yet');
        return [];
      }
      
      // Group by strategy and calculate averages
      const strategyMap = new Map<string, { 
        views: number[]; 
        likes: number[]; 
      }>();
      
      data.forEach(row => {
        const strategy = row.format_strategy;
        if (!strategy) return;
        
        if (!strategyMap.has(strategy)) {
          strategyMap.set(strategy, { views: [], likes: [] });
        }
        
        const entry = strategyMap.get(strategy)!;
        entry.views.push(row.actual_impressions || 0);
        entry.likes.push(row.actual_likes || 0);
      });
      
      // Calculate averages and sort by performance
      const results = Array.from(strategyMap.entries())
        .filter(([_, data]) => data.views.length >= 3) // At least 3 examples for confidence
        .map(([strategy, data]) => ({
          strategy,
          avg_views: Math.round(data.views.reduce((a, b) => a + b, 0) / data.views.length),
          avg_likes: Math.round(data.likes.reduce((a, b) => a + b, 0) / data.likes.length),
          posts: data.views.length
        }))
        .sort((a, b) => b.avg_views - a.avg_views)
        .slice(0, limit);
      
      console.log(`[FORMAT_STRATEGY] 📊 Found ${results.length} proven strategies (3+ uses each)`);
      if (results.length > 0) {
        console.log(`   Top performer: "${results[0].strategy.substring(0, 50)}..." - ${results[0].avg_views} avg views`);
      }
      
      return results;
      
    } catch (error) {
      console.error('[FORMAT_STRATEGY] Error analyzing top performers:', error);
      return [];
    }
  }
  
  /**
   * Phase 2: Generate strategy WITH learning from performance data
   * This method feeds successful strategies back as inspiration
   */
  async generateStrategyWithLearning(
    topic: string,
    angle: string,
    tone: string,
    generator: string
  ): Promise<string> {
    console.log('[FORMAT_STRATEGY] 🧠 Generating with learning data...');
    
    const recentStrategies = await this.getLast4Strategies();
    const topPerformers = await this.getTopPerformingStrategies(5);
    
    if (topPerformers.length === 0) {
      // Not enough data yet, fall back to pure random
      console.log('[FORMAT_STRATEGY] ℹ️ No learning data yet, using pure random');
      return this.generateStrategy(topic, angle, tone, generator);
    }
    
    const prompt = `
Generate a unique visual formatting strategy for this content:

Content Context:
- Topic: ${topic}
- Angle: ${angle}
- Tone: ${tone}
- Generator: ${generator}

${recentStrategies.length > 0 ? `
🚫 AVOID (recently used):
${recentStrategies.map((s, i) => `${i + 1}. "${s}"`).join('\n')}
` : ''}

💡 HIGH-PERFORMING STRATEGIES (from YOUR data - draw inspiration):
${topPerformers.map(s => 
  `"${s.strategy}" - ${s.avg_views} avg views, ${s.avg_likes} avg likes (${s.posts} posts)`
).join('\n')}

These strategies performed well for YOUR specific audience.
Draw inspiration from WHAT MAKES THEM WORK (their structure, flow, or hierarchy),
but create something NEW and unique for THIS specific content.

Don't copy exactly. Create a novel strategy informed by proven patterns.

Output JSON:
{
  "strategy": "Your unique formatting strategy (1-2 sentences)"
}
`;
    
    try {
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a content formatting strategist that learns from data. Create new formatting approaches inspired by proven patterns.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 1.3, // Slightly lower than pure random (learning phase)
        max_tokens: 120,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'format_strategy_learning'
      });
      
      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      const strategy = parsed.strategy || 'Clear, scannable format with logical flow';
      
      console.log(`[FORMAT_STRATEGY] ✅ Generated (learning-enhanced): "${strategy}"`);
      
      return strategy;
      
    } catch (error: any) {
      console.error('[FORMAT_STRATEGY] ❌ Learning generation failed:', error.message);
      // Fall back to non-learning version
      return this.generateStrategy(topic, angle, tone, generator);
    }
  }
}

/**
 * Singleton instance getter
 */
export function getFormatStrategyGenerator(): FormatStrategyGenerator {
  return FormatStrategyGenerator.getInstance();
}

