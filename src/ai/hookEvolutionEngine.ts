/**
 * Content Hook Evolution Engine
 * Continuously evolves and improves opening lines for maximum engagement
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { HookDNA } from '../types/learning';

// HookDNA interface imported from shared types

export interface HookEvolutionResult {
  evolved_hooks: HookDNA[];
  evolution_insights: {
    successful_mutations: string[];
    failed_mutations: string[];
    performance_improvements: number;
    new_patterns_discovered: string[];
  };
  next_generation_predictions: {
    expected_engagement_boost: number;
    viral_potential_increase: number;
    follower_conversion_improvement: number;
  };
}

export class ContentHookEvolutionEngine {
  private supabase = getSupabaseClient();
  private hookPopulation: HookDNA[] = [];
  private generationCount = 0;
  
  constructor() {
    this.initializeFoundationHooks();
  }
  
  /**
   * Evolve hooks based on performance data
   */
  async evolveHooks(): Promise<HookEvolutionResult> {
    console.log('[HOOK_EVOLUTION] 🧬 Starting hook evolution cycle...');
    
    try {
      // Get current hook population performance
      const performanceData = await this.getHookPerformanceData();
      
      // Update hook fitness scores
      await this.updateHookFitness(performanceData);
      
      // Select top-performing hooks for breeding
      const eliteHooks = this.selectEliteHooks();
      
      // Generate new hook mutations
      const mutations = await this.generateMutations(eliteHooks);
      
      // Create hybrid hooks from successful combinations
      const hybrids = await this.createHookHybrids(eliteHooks);
      
      // Combine all evolved hooks
      const evolvedHooks = [...mutations, ...hybrids];
      
      // Store evolved hooks
      for (const hook of evolvedHooks) {
        await this.storeHook(hook);
      }
      
      this.generationCount++;
      
      const result: HookEvolutionResult = {
        evolved_hooks: evolvedHooks,
        evolution_insights: await this.generateEvolutionInsights(evolvedHooks),
        next_generation_predictions: this.predictNextGeneration(evolvedHooks)
      };
      
      console.log(`[HOOK_EVOLUTION] ✅ Evolution complete - Generated ${evolvedHooks.length} new hooks (Generation ${this.generationCount})`);
      return result;
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] ❌ Error in hook evolution:', error.message);
      return {
        evolved_hooks: [],
        evolution_insights: {
          successful_mutations: [],
          failed_mutations: [],
          performance_improvements: 0,
          new_patterns_discovered: []
        },
        next_generation_predictions: {
          expected_engagement_boost: 0,
          viral_potential_increase: 0,
          follower_conversion_improvement: 0
        }
      };
    }
  }
  
  /**
   * Select the best hook for current context
   */
  async selectOptimalHook(context: {
    topic: string;
    audience: string;
    goal: 'engagement' | 'viral' | 'followers' | 'authority';
    timing?: string;
  }): Promise<HookDNA> {
    
    console.log(`[HOOK_EVOLUTION] 🎯 Selecting optimal hook for ${context.goal} goal...`);
    
    try {
      // Get hooks that match context
      const candidateHooks = await this.getContextualHooks(context);
      
      if (candidateHooks.length === 0) {
        return this.getDefaultHook();
      }
      
      // Score hooks based on goal
      const scoredHooks = candidateHooks.map(hook => ({
        hook,
        score: this.calculateHookScore(hook, context)
      }));
      
      // Sort by score and select best
      scoredHooks.sort((a, b) => b.score - a.score);
      
      const selectedHook = scoredHooks[0].hook;
      
      // Update usage statistics
      await this.updateHookUsage(selectedHook.hook_id);
      
      console.log(`[HOOK_EVOLUTION] ✅ Selected hook: "${selectedHook.hook_text.substring(0, 50)}..." (Score: ${scoredHooks[0].score.toFixed(3)})`);
      
      return selectedHook;
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] ❌ Error selecting optimal hook:', error.message);
      return this.getDefaultHook();
    }
  }
  
  /**
   * Learn from hook performance and adapt
   */
  async learnFromHookPerformance(hookId: string, performance: {
    engagement_rate: number;
    viral_coefficient: number;
    followers_gained: number;
    topic: string;
    audience: string;
  }): Promise<void> {
    
    console.log(`[HOOK_EVOLUTION] 📚 Learning from hook performance: ${hookId}`);
    
    try {
      // Update hook performance data
      await this.updateHookPerformance(hookId, performance);
      
      // Analyze what made this hook successful/unsuccessful
      const performanceInsights = await this.analyzeHookPerformance(hookId, performance);
      
      // Apply insights to improve hook genetics
      await this.applyPerformanceInsights(hookId, performanceInsights);
      
      console.log(`[HOOK_EVOLUTION] ✅ Learning complete for hook: ${hookId}`);
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] ❌ Error learning from hook performance:', error.message);
    }
  }
  
  /**
   * Generate new hook variations using AI
   */
  async generateHookVariations(baseHook: HookDNA, variationCount: number = 5): Promise<HookDNA[]> {
    console.log(`[HOOK_EVOLUTION] 🎨 Generating ${variationCount} variations of hook...`);
    
    try {
      const systemPrompt = `You are an expert at creating viral Twitter hooks. You're evolving this successful hook:

BASE HOOK: "${baseHook.hook_text}"
CATEGORY: ${baseHook.hook_category}
PERFORMANCE: Engagement ${(baseHook.avg_engagement_rate * 100).toFixed(1)}%, Viral coefficient ${baseHook.avg_viral_coefficient.toFixed(3)}

EVOLUTION RULES:
- Keep the core psychological trigger that makes this hook work
- Vary the specific words, numbers, or examples
- Maintain the same emotional impact and curiosity level
- Each variation should feel fresh but follow the same proven pattern
- Focus on health/wellness topics for @SignalAndSynapse

Create ${variationCount} evolved variations that improve upon the original.`;

      const userPrompt = `Generate ${variationCount} hook variations that:
1. Keep the same psychological appeal as the original
2. Use different specific examples or statistics
3. Maintain the same length and structure
4. Are optimized for health/wellness content
5. Would perform as well or better than the original

Output as JSON:
{
  "variations": [
    {
      "hook_text": "variation 1 text",
      "reasoning": "why this variation should work"
    },
    {
      "hook_text": "variation 2 text", 
      "reasoning": "why this variation should work"
    }
  ]
}`;

      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9, // Higher creativity for variations
        max_tokens: 600,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'hook_variation_generation',
        requestId: `hook_var_${baseHook.hook_id}_${Date.now()}`
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(rawContent);
      const variations: HookDNA[] = [];
      
      for (const variation of parsed.variations) {
        const newHook: HookDNA = {
          ...baseHook,
          hook_id: `evolved_${baseHook.hook_id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          hook_text: variation.hook_text,
          generation: baseHook.generation + 1,
          parent_hooks: [baseHook.hook_id],
          times_used: 0,
          avg_engagement_rate: 0,
          avg_viral_coefficient: 0,
          avg_followers_gained: 0,
          success_rate: 0,
          created_at: new Date().toISOString(),
          last_used: '',
          last_evolved: new Date().toISOString()
        };
        
        // Update characteristics based on new text
        this.updateHookCharacteristics(newHook);
        variations.push(newHook);
      }
      
      console.log(`[HOOK_EVOLUTION] ✅ Generated ${variations.length} hook variations`);
      return variations;
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] ❌ Error generating hook variations:', error.message);
      return [];
    }
  }
  
  /**
   * Get hook performance analytics
   */
  async getHookAnalytics(): Promise<{
    top_performing_hooks: HookDNA[];
    hook_categories_performance: Record<string, number>;
    evolution_trends: any;
    optimization_opportunities: string[];
  }> {
    
    try {
      const allHooks = await this.getAllHooks();
      
      // Get top performers
      const topHooks = allHooks
        .filter(h => h.times_used >= 3)
        .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
        .slice(0, 10);
      
      // Analyze category performance
      const categoryPerformance: Record<string, number> = {};
      for (const category of ['statistical', 'contrarian', 'authority', 'curiosity', 'social_proof', 'value_bomb']) {
        const categoryHooks = allHooks.filter(h => h.hook_category === category && h.times_used >= 2);
        if (categoryHooks.length > 0) {
          categoryPerformance[category] = categoryHooks.reduce((sum, h) => sum + h.avg_engagement_rate, 0) / categoryHooks.length;
        }
      }
      
      // Evolution trends
      const evolutionTrends = {
        generations_created: this.generationCount,
        average_generation: allHooks.reduce((sum, h) => sum + h.generation, 0) / allHooks.length,
        performance_by_generation: this.analyzePerformanceByGeneration(allHooks)
      };
      
      // Optimization opportunities
      const optimizationOpportunities = this.identifyOptimizationOpportunities(allHooks, categoryPerformance);
      
      return {
        top_performing_hooks: topHooks,
        hook_categories_performance: categoryPerformance,
        evolution_trends: evolutionTrends,
        optimization_opportunities: optimizationOpportunities
      };
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] ❌ Error getting hook analytics:', error.message);
      return {
        top_performing_hooks: [],
        hook_categories_performance: {},
        evolution_trends: {},
        optimization_opportunities: []
      };
    }
  }
  
  /**
   * Private helper methods
   */
  private initializeFoundationHooks(): void {
    this.hookPopulation = [
      {
        hook_id: 'foundation_stat_1',
        hook_text: 'X% of people believe Y, but new research shows Z',
        hook_category: 'statistical',
        engagement_gene: 0.7,
        viral_gene: 0.6,
        follower_gene: 0.8,
        authority_gene: 0.9,
        word_count: 9,
        has_statistics: true,
        has_controversy: true,
        has_question: false,
        has_emotional_trigger: true,
        generation: 0,
        parent_hooks: [],
        mutation_rate: 0.3,
        times_used: 0,
        avg_engagement_rate: 0,
        avg_viral_coefficient: 0,
        avg_followers_gained: 0,
        success_rate: 0,
        best_topics: ['health', 'nutrition', 'fitness'],
        best_audiences: ['health_seekers', 'biohackers'],
        optimal_timing: ['Tuesday', 'Thursday'],
        created_at: new Date().toISOString(),
        last_used: '',
        last_evolved: ''
      },
      {
        hook_id: 'foundation_contrarian_1',
        hook_text: 'Everything you know about X is wrong. Here\'s why:',
        hook_category: 'contrarian',
        engagement_gene: 0.8,
        viral_gene: 0.9,
        follower_gene: 0.7,
        authority_gene: 0.6,
        word_count: 8,
        has_statistics: false,
        has_controversy: true,
        has_question: false,
        has_emotional_trigger: true,
        generation: 0,
        parent_hooks: [],
        mutation_rate: 0.4,
        times_used: 0,
        avg_engagement_rate: 0,
        avg_viral_coefficient: 0,
        avg_followers_gained: 0,
        success_rate: 0,
        best_topics: ['myths', 'misconceptions', 'conventional_wisdom'],
        best_audiences: ['wellness_beginners', 'fitness_enthusiasts'],
        optimal_timing: ['Monday', 'Wednesday'],
        created_at: new Date().toISOString(),
        last_used: '',
        last_evolved: ''
      }
    ];
  }
  
  private async getHookPerformanceData(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('hook_performance')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) {
        console.error('[HOOK_EVOLUTION] Error fetching hook performance:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('[HOOK_EVOLUTION] Error fetching hook performance:', error);
      return [];
    }
  }
  
  private async updateHookFitness(performanceData: any[]): Promise<void> {
    for (const hook of this.hookPopulation) {
      const hookPerformance = performanceData.filter(p => p.hook_id === hook.hook_id);
      
      if (hookPerformance.length > 0) {
        hook.avg_engagement_rate = hookPerformance.reduce((sum, p) => sum + p.engagement_rate, 0) / hookPerformance.length;
        hook.avg_viral_coefficient = hookPerformance.reduce((sum, p) => sum + p.viral_coefficient, 0) / hookPerformance.length;
        hook.avg_followers_gained = hookPerformance.reduce((sum, p) => sum + p.followers_gained, 0) / hookPerformance.length;
        hook.times_used = hookPerformance.length;
        hook.success_rate = hookPerformance.filter(p => p.engagement_rate > 0.04).length / hookPerformance.length;
      }
    }
  }
  
  private selectEliteHooks(): HookDNA[] {
    return this.hookPopulation
      .filter(h => h.times_used >= 2) // Must have been tested
      .sort((a, b) => this.calculateOverallFitness(b) - this.calculateOverallFitness(a))
      .slice(0, 5); // Top 5 performers
  }
  
  private calculateOverallFitness(hook: HookDNA): number {
    if (hook.times_used === 0) return 0;
    
    return (
      hook.avg_engagement_rate * 0.4 +
      hook.avg_viral_coefficient * 0.3 +
      (hook.avg_followers_gained / 20) * 0.2 + // Normalize followers to 0-1 scale
      hook.success_rate * 0.1
    );
  }
  
  private async generateMutations(eliteHooks: HookDNA[]): Promise<HookDNA[]> {
    const mutations: HookDNA[] = [];
    
    for (const hook of eliteHooks) {
      // Generate 2-3 mutations per elite hook
      const mutationCount = Math.floor(Math.random() * 2) + 2;
      const hookMutations = await this.generateHookVariations(hook, mutationCount);
      mutations.push(...hookMutations);
    }
    
    return mutations;
  }
  
  private async createHookHybrids(eliteHooks: HookDNA[]): Promise<HookDNA[]> {
    const hybrids: HookDNA[] = [];
    
    // Create hybrids from pairs of elite hooks
    for (let i = 0; i < eliteHooks.length; i++) {
      for (let j = i + 1; j < eliteHooks.length; j++) {
        const hybrid = await this.hybridizeHooks(eliteHooks[i], eliteHooks[j]);
        if (hybrid) {
          hybrids.push(hybrid);
        }
      }
    }
    
    return hybrids.slice(0, 3); // Limit to 3 hybrids per generation
  }
  
  private async hybridizeHooks(hook1: HookDNA, hook2: HookDNA): Promise<HookDNA | null> {
    try {
      const systemPrompt = `You are creating a hybrid Twitter hook by combining the best elements of two successful hooks:

HOOK 1: "${hook1.hook_text}" (Category: ${hook1.hook_category}, Engagement: ${(hook1.avg_engagement_rate * 100).toFixed(1)}%)
HOOK 2: "${hook2.hook_text}" (Category: ${hook2.hook_category}, Engagement: ${(hook2.avg_engagement_rate * 100).toFixed(1)}%)

Create a hybrid hook that combines the psychological triggers and successful elements from both hooks.`;

      const userPrompt = `Create a single hybrid hook that:
1. Combines the most effective elements from both parent hooks
2. Maintains the psychological appeal of both
3. Creates something new but proven
4. Is optimized for health/wellness content
5. Should perform better than either parent

Output as JSON:
{
  "hybrid_hook": "the hybrid hook text",
  "elements_from_hook1": ["element1", "element2"],
  "elements_from_hook2": ["element1", "element2"],
  "expected_improvement": "why this should work better"
}`;

      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      }, {
        purpose: 'hook_hybridization',
        requestId: `hybrid_${hook1.hook_id}_${hook2.hook_id}_${Date.now()}`
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        return null;
      }

      const parsed = JSON.parse(rawContent);
      
      const hybrid: HookDNA = {
        hook_id: `hybrid_${hook1.hook_id}_${hook2.hook_id}_${Date.now()}`,
        hook_text: parsed.hybrid_hook,
        hook_category: hook1.avg_engagement_rate > hook2.avg_engagement_rate ? hook1.hook_category : hook2.hook_category,
        engagement_gene: (hook1.engagement_gene + hook2.engagement_gene) / 2,
        viral_gene: Math.max(hook1.viral_gene, hook2.viral_gene),
        follower_gene: Math.max(hook1.follower_gene, hook2.follower_gene),
        authority_gene: (hook1.authority_gene + hook2.authority_gene) / 2,
        word_count: parsed.hybrid_hook.split(' ').length,
        has_statistics: hook1.has_statistics || hook2.has_statistics,
        has_controversy: hook1.has_controversy || hook2.has_controversy,
        has_question: parsed.hybrid_hook.includes('?'),
        has_emotional_trigger: true, // Hybrids typically have strong emotional triggers
        generation: Math.max(hook1.generation, hook2.generation) + 1,
        parent_hooks: [hook1.hook_id, hook2.hook_id],
        mutation_rate: (hook1.mutation_rate + hook2.mutation_rate) / 2,
        times_used: 0,
        avg_engagement_rate: 0,
        avg_viral_coefficient: 0,
        avg_followers_gained: 0,
        success_rate: 0,
        best_topics: [...new Set([...hook1.best_topics, ...hook2.best_topics])],
        best_audiences: [...new Set([...hook1.best_audiences, ...hook2.best_audiences])],
        optimal_timing: [...new Set([...hook1.optimal_timing, ...hook2.optimal_timing])],
        created_at: new Date().toISOString(),
        last_used: '',
        last_evolved: new Date().toISOString()
      };
      
      return hybrid;
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] Error creating hybrid hook:', error.message);
      return null;
    }
  }
  
  private async storeHook(hook: HookDNA): Promise<void> {
    try {
      const hookData = {
        hook_id: hook.hook_id,
        hook_text: hook.hook_text,
        hook_category: hook.hook_category,
        engagement_gene: hook.engagement_gene,
        viral_gene: hook.viral_gene,
        follower_gene: hook.follower_gene,
        authority_gene: hook.authority_gene,
        word_count: hook.word_count,
        has_statistics: hook.has_statistics,
        has_controversy: hook.has_controversy,
        has_question: hook.has_question,
        has_emotional_trigger: hook.has_emotional_trigger,
        generation: hook.generation,
        parent_hooks: JSON.stringify(hook.parent_hooks),
        mutation_rate: hook.mutation_rate,
        times_used: hook.times_used,
        avg_engagement_rate: hook.avg_engagement_rate,
        avg_viral_coefficient: hook.avg_viral_coefficient,
        avg_followers_gained: hook.avg_followers_gained,
        success_rate: hook.success_rate,
        best_topics: JSON.stringify(hook.best_topics),
        best_audiences: JSON.stringify(hook.best_audiences),
        optimal_timing: JSON.stringify(hook.optimal_timing),
        created_at: hook.created_at,
        last_used: hook.last_used || null,
        last_evolved: hook.last_evolved || null
      };

      const { error } = await this.supabase
        .from('hook_dna')
        .upsert([hookData], { onConflict: 'hook_id' });
      
      if (error) {
        console.error('[HOOK_EVOLUTION] Error storing hook:', error);
        return;
      }
      
      // Also add to local population
      this.hookPopulation.push(hook);
      
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] Error storing hook:', error.message);
    }
  }
  
  private async generateEvolutionInsights(evolvedHooks: HookDNA[]): Promise<any> {
    const insights = {
      successful_mutations: [],
      failed_mutations: [],
      performance_improvements: 0,
      new_patterns_discovered: []
    };
    
    // Analyze evolved hooks for patterns
    const categories = evolvedHooks.map(h => h.hook_category);
    const uniqueCategories = [...new Set(categories)];
    
    if (uniqueCategories.length > 2) {
      insights.new_patterns_discovered.push('Cross-category hybridization successful');
    }
    
    return insights;
  }
  
  private predictNextGeneration(evolvedHooks: HookDNA[]): any {
    const avgEngagementGene = evolvedHooks.reduce((sum, h) => sum + h.engagement_gene, 0) / evolvedHooks.length;
    const avgViralGene = evolvedHooks.reduce((sum, h) => sum + h.viral_gene, 0) / evolvedHooks.length;
    const avgFollowerGene = evolvedHooks.reduce((sum, h) => sum + h.follower_gene, 0) / evolvedHooks.length;
    
    return {
      expected_engagement_boost: (avgEngagementGene - 0.5) * 0.2, // Estimate improvement
      viral_potential_increase: (avgViralGene - 0.5) * 0.15,
      follower_conversion_improvement: (avgFollowerGene - 0.5) * 0.1
    };
  }
  
  private async getContextualHooks(context: any): Promise<HookDNA[]> {
    try {
      const { data, error } = await this.supabase
        .from('hook_dna')
        .select('*')
        .contains('best_topics', [context.topic])
        .gte('times_used', 1);
      
      if (error) {
        console.error('[HOOK_EVOLUTION] Error fetching contextual hooks:', error);
        return this.hookPopulation.filter(h => h.best_topics.includes(context.topic));
      }
      
      return data || [];
    } catch (error) {
      return this.hookPopulation.filter(h => h.best_topics.includes(context.topic));
    }
  }
  
  private calculateHookScore(hook: HookDNA, context: any): number {
    let score = 0;
    
    // Base score from genetics
    switch (context.goal) {
      case 'engagement':
        score = hook.engagement_gene;
        break;
      case 'viral':
        score = hook.viral_gene;
        break;
      case 'followers':
        score = hook.follower_gene;
        break;
      case 'authority':
        score = hook.authority_gene;
        break;
      default:
        score = (hook.engagement_gene + hook.viral_gene + hook.follower_gene) / 3;
    }
    
    // Boost for topic match
    if (hook.best_topics.includes(context.topic)) {
      score += 0.2;
    }
    
    // Boost for audience match
    if (hook.best_audiences.includes(context.audience)) {
      score += 0.1;
    }
    
    // Boost for historical performance
    if (hook.times_used > 0) {
      score += hook.success_rate * 0.1;
    }
    
    return score;
  }
  
  private getDefaultHook(): HookDNA {
    return this.hookPopulation[0] || {
      hook_id: 'default_hook',
      hook_text: 'New research reveals surprising truth about X',
      hook_category: 'authority',
      engagement_gene: 0.6,
      viral_gene: 0.5,
      follower_gene: 0.7,
      authority_gene: 0.8,
      word_count: 7,
      has_statistics: false,
      has_controversy: false,
      has_question: false,
      has_emotional_trigger: true,
      generation: 0,
      parent_hooks: [],
      mutation_rate: 0.3,
      times_used: 0,
      avg_engagement_rate: 0,
      avg_viral_coefficient: 0,
      avg_followers_gained: 0,
      success_rate: 0,
      best_topics: ['health'],
      best_audiences: ['health_seekers'],
      optimal_timing: ['Tuesday'],
      created_at: new Date().toISOString(),
      last_used: '',
      last_evolved: ''
    };
  }
  
  private updateHookCharacteristics(hook: HookDNA): void {
    hook.word_count = hook.hook_text.split(' ').length;
    hook.has_statistics = /\d+%|\d+x|\d+ people/i.test(hook.hook_text);
    hook.has_controversy = /wrong|myth|actually|but|however/i.test(hook.hook_text);
    hook.has_question = hook.hook_text.includes('?');
    hook.has_emotional_trigger = /wrong|amazing|shocking|secret|truth/i.test(hook.hook_text);
  }
  
  private async updateHookUsage(hookId: string): Promise<void> {
    try {
      const { data: currentHook } = await this.supabase
        .from('hook_dna')
        .select('times_used')
        .eq('hook_id', hookId)
        .single();
      
      if (currentHook) {
        await this.supabase
          .from('hook_dna')
          .update({ 
            last_used: new Date().toISOString(),
            times_used: (currentHook.times_used || 0) + 1
          })
          .eq('hook_id', hookId);
      }
    } catch (error) {
      console.error('[HOOK_EVOLUTION] Error updating hook usage:', error);
    }
  }
  
  private async updateHookPerformance(hookId: string, performance: any): Promise<void> {
    // Store performance data for learning
    try {
      await this.supabase
        .from('hook_performance')
        .insert([{
          hook_id: hookId,
          engagement_rate: performance.engagement_rate,
          viral_coefficient: performance.viral_coefficient,
          followers_gained: performance.followers_gained,
          topic: performance.topic,
          audience: performance.audience,
          created_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('[HOOK_EVOLUTION] Error storing hook performance:', error);
    }
  }
  
  private async analyzeHookPerformance(hookId: string, performance: any): Promise<any> {
    return {
      performance_level: performance.engagement_rate > 0.05 ? 'high' : performance.engagement_rate > 0.03 ? 'medium' : 'low',
      viral_potential: performance.viral_coefficient > 0.3 ? 'high' : 'low',
      follower_conversion: performance.followers_gained > 5 ? 'high' : 'low'
    };
  }
  
  private async applyPerformanceInsights(hookId: string, insights: any): Promise<void> {
    // Apply insights to improve hook genetics
    console.log(`[HOOK_EVOLUTION] 📈 Applying performance insights to hook: ${hookId}`);
  }
  
  private async getAllHooks(): Promise<HookDNA[]> {
    try {
      const { data, error } = await this.supabase
        .from('hook_dna')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[HOOK_EVOLUTION] Error fetching all hooks:', error);
        return this.hookPopulation;
      }
      
      return data || this.hookPopulation;
    } catch (error) {
      return this.hookPopulation;
    }
  }
  
  private analyzePerformanceByGeneration(hooks: HookDNA[]): any {
    const generationPerformance: Record<number, number[]> = {};
    
    for (const hook of hooks) {
      if (hook.times_used > 0) {
        if (!generationPerformance[hook.generation]) {
          generationPerformance[hook.generation] = [];
        }
        generationPerformance[hook.generation].push(hook.avg_engagement_rate);
      }
    }
    
    const result: Record<number, number> = {};
    for (const [gen, performances] of Object.entries(generationPerformance)) {
      result[parseInt(gen)] = performances.reduce((sum, p) => sum + p, 0) / performances.length;
    }
    
    return result;
  }
  
  private identifyOptimizationOpportunities(hooks: HookDNA[], categoryPerformance: Record<string, number>): string[] {
    const opportunities: string[] = [];
    
    // Find underperforming categories
    const avgPerformance = Object.values(categoryPerformance).reduce((sum, p) => sum + p, 0) / Object.values(categoryPerformance).length;
    
    for (const [category, performance] of Object.entries(categoryPerformance)) {
      if (performance < avgPerformance * 0.8) {
        opportunities.push(`Improve ${category} hooks - currently underperforming by ${((avgPerformance - performance) * 100).toFixed(1)}%`);
      }
    }
    
    // Find evolution opportunities
    const oldGenerationHooks = hooks.filter(h => h.generation === 0 && h.times_used > 5);
    if (oldGenerationHooks.length > 0) {
      opportunities.push(`Evolve ${oldGenerationHooks.length} foundation hooks that have proven successful`);
    }
    
    return opportunities;
  }
}

// Export singleton instance
export const hookEvolutionEngine = new ContentHookEvolutionEngine();
