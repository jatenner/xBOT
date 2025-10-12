/**
 * Hook Evolution Engine - Build-Safe Version
 * Genetic algorithm for evolving high-performance content hooks
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface HookDNA {
  hook_id: string;
  hook_text: string;
  hook_category: 'statistical' | 'contrarian' | 'authority' | 'curiosity' | 'social_proof' | 'value_bomb';
  
  // Performance genetics (0-1 scores)
  engagement_gene: number;
  viral_gene: number;
  follower_gene: number;
  authority_gene: number;
  
  // Hook characteristics
  word_count: number;
  has_statistics: boolean;
  has_controversy: boolean;
  has_question: boolean;
  has_emotional_trigger: boolean;
  
  // Evolution data
  generation: number;
  parent_hooks: string[];
  mutation_rate: number;
  
  // Performance tracking
  times_used: number;
  avg_engagement_rate: number;
  avg_viral_coefficient: number;
  avg_followers_gained: number;
  success_rate: number;
  
  // Context data
  best_topics: string[];
  best_audiences: string[];
  optimal_timing: string[];
  
  created_at: string;
  last_used?: string;
  last_evolved?: string;
}

export interface HookEvolutionResult {
  evolved_hooks: HookDNA[];
  evolution_insights: {
    successful_mutations: string[];
    failed_mutations: string[];
    performance_improvements: number;
    new_patterns_discovered: string[];
  };
}

export class HookEvolutionEngine {
  private supabase = getSupabaseClient();
  private hookPopulation: HookDNA[] = [];
  private readonly POPULATION_SIZE = 20;
  private readonly MUTATION_RATE = 0.15;
  private readonly CROSSOVER_RATE = 0.3;

  constructor() {
    this.initializePopulation();
  }

  /**
   * Initialize with high-performing seed hooks
   */
  private async initializePopulation(): Promise<void> {
    console.log('[HOOK_EVOLUTION] 🧬 Initializing hook population...');
    
    try {
      // Try to load existing hooks from database
      const { data, error } = await this.supabase
        .from('hook_dna')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(this.POPULATION_SIZE);

      if (data && data.length > 0) {
        this.hookPopulation = this.castToHookDNA(data);
        console.log(`[HOOK_EVOLUTION] ✅ Loaded ${this.hookPopulation.length} hooks from database`);
      } else {
        // Initialize with seed hooks
        this.hookPopulation = this.createSeedPopulation();
        await this.storeHooks(this.hookPopulation);
        console.log('[HOOK_EVOLUTION] ✅ Created seed population');
      }
    } catch (error: any) {
      console.warn('[HOOK_EVOLUTION] ⚠️ Database load failed, using seed population');
      this.hookPopulation = this.createSeedPopulation();
    }
  }

  /**
   * Create initial seed population with proven hooks
   */
  private createSeedPopulation(): HookDNA[] {
    const seedHooks = [
      {
        hook_text: 'Most people think X, but research shows Y',
        hook_category: 'contrarian' as const,
        engagement_gene: 0.8,
        viral_gene: 0.7,
        follower_gene: 0.9,
        authority_gene: 0.8
      },
      {
        hook_text: 'Did you know X% of people are wrong about Y?',
        hook_category: 'statistical' as const,
        engagement_gene: 0.7,
        viral_gene: 0.8,
        follower_gene: 0.7,
        authority_gene: 0.6
      },
      {
        hook_text: 'The #1 mistake people make with X is Y',
        hook_category: 'value_bomb' as const,
        engagement_gene: 0.9,
        viral_gene: 0.6,
        follower_gene: 0.8,
        authority_gene: 0.7
      },
      {
        hook_text: 'What if everything you knew about X was wrong?',
        hook_category: 'curiosity' as const,
        engagement_gene: 0.6,
        viral_gene: 0.7,
        follower_gene: 0.5,
        authority_gene: 0.5
      },
      {
        hook_text: 'Here\'s what X experts don\'t want you to know about Y',
        hook_category: 'authority' as const,
        engagement_gene: 0.7,
        viral_gene: 0.8,
        follower_gene: 0.6,
        authority_gene: 0.9
      }
    ];

    return seedHooks.map((seed, index) => ({
      hook_id: `seed_${index}`,
      hook_text: seed.hook_text,
      hook_category: seed.hook_category,
      engagement_gene: seed.engagement_gene,
      viral_gene: seed.viral_gene,
      follower_gene: seed.follower_gene,
      authority_gene: seed.authority_gene,
      word_count: seed.hook_text.split(' ').length,
      has_statistics: seed.hook_text.includes('%') || seed.hook_text.includes('#'),
      has_controversy: seed.hook_text.includes('wrong') || seed.hook_text.includes('mistake'),
      has_question: seed.hook_text.includes('?'),
      has_emotional_trigger: /wrong|mistake|secret|truth|experts.*don't want/i.test(seed.hook_text),
      generation: 0,
      parent_hooks: [],
      mutation_rate: this.MUTATION_RATE,
      times_used: 0,
      avg_engagement_rate: 0,
      avg_viral_coefficient: 0,
      avg_followers_gained: 0,
      success_rate: 0.5,
      best_topics: [],
      best_audiences: [],
      optimal_timing: [],
      created_at: new Date().toISOString()
    }));
  }

  /**
   * Select optimal hook based on criteria
   */
  async selectOptimalHook(criteria: {
    goal: 'engagement' | 'viral' | 'followers' | 'authority';
    topic?: string;
    audience?: string;
  }): Promise<HookDNA> {
    console.log(`[HOOK_EVOLUTION] 🎯 Selecting optimal hook for ${criteria.goal}`);
    
    if (this.hookPopulation.length === 0) {
      await this.initializePopulation();
    }

    // Score hooks based on criteria
    const scoredHooks = this.hookPopulation.map(hook => {
      let score = 0;
      
      switch (criteria.goal) {
        case 'engagement':
          score = hook.engagement_gene * 0.7 + hook.success_rate * 0.3;
          break;
        case 'viral':
          score = hook.viral_gene * 0.7 + hook.success_rate * 0.3;
          break;
        case 'followers':
          score = hook.follower_gene * 0.7 + hook.success_rate * 0.3;
          break;
        case 'authority':
          score = hook.authority_gene * 0.7 + hook.success_rate * 0.3;
          break;
      }
      
      // Bonus for topic/audience match
      if (criteria.topic && hook.best_topics.includes(criteria.topic)) {
        score += 0.1;
      }
      if (criteria.audience && hook.best_audiences.includes(criteria.audience)) {
        score += 0.1;
      }

      return { hook, score };
    });

    // Select top hook
    const selectedHook = scoredHooks.sort((a, b) => b.score - a.score)[0].hook;
    
    // Update usage
    selectedHook.times_used++;
    selectedHook.last_used = new Date().toISOString();
    
    console.log(`[HOOK_EVOLUTION] ✅ Selected hook: "${selectedHook.hook_text}" (Gen ${selectedHook.generation})`);
    return selectedHook;
  }

  /**
   * Evolve hooks based on performance data
   */
  async evolveHooks(performanceData: Array<{
    hook_id: string;
    engagement_rate: number;
    viral_coefficient: number;
    followers_gained: number;
  }>): Promise<HookEvolutionResult> {
    console.log('[HOOK_EVOLUTION] 🧬 Starting hook evolution...');
    
    // Update performance data
    this.updateHookPerformance(performanceData);
    
    // Select parents for next generation
    const parents = this.selectParents();
    
    // Create next generation
    const offspring = await this.createOffspring(parents);
    
    // Add to population and maintain size
    this.hookPopulation.push(...offspring);
    this.hookPopulation = this.hookPopulation
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, this.POPULATION_SIZE);
    
    // Store evolved hooks
    await this.storeHooks(offspring);
    
    const result: HookEvolutionResult = {
      evolved_hooks: offspring,
      evolution_insights: {
        successful_mutations: offspring.map(h => h.hook_text),
        failed_mutations: [],
        performance_improvements: this.calculateImprovements(offspring),
        new_patterns_discovered: this.discoverPatterns(offspring)
      }
    };
    
    console.log(`[HOOK_EVOLUTION] ✅ Evolution complete. Generated ${offspring.length} new hooks`);
    return result;
  }

  /**
   * Helper methods
   */
  private castToHookDNA(data: any[]): HookDNA[] {
    return data.map(item => ({
      hook_id: item.hook_id || '',
      hook_text: item.hook_text || '',
      hook_category: item.hook_category || 'contrarian',
      engagement_gene: Number(item.engagement_gene) || 0.5,
      viral_gene: Number(item.viral_gene) || 0.5,
      follower_gene: Number(item.follower_gene) || 0.5,
      authority_gene: Number(item.authority_gene) || 0.5,
      word_count: Number(item.word_count) || 0,
      has_statistics: Boolean(item.has_statistics),
      has_controversy: Boolean(item.has_controversy),
      has_question: Boolean(item.has_question),
      has_emotional_trigger: Boolean(item.has_emotional_trigger),
      generation: Number(item.generation) || 0,
      parent_hooks: Array.isArray(item.parent_hooks) ? item.parent_hooks : [],
      mutation_rate: Number(item.mutation_rate) || 0.15,
      times_used: Number(item.times_used) || 0,
      avg_engagement_rate: Number(item.avg_engagement_rate) || 0,
      avg_viral_coefficient: Number(item.avg_viral_coefficient) || 0,
      avg_followers_gained: Number(item.avg_followers_gained) || 0,
      success_rate: Number(item.success_rate) || 0.5,
      best_topics: Array.isArray(item.best_topics) ? item.best_topics : [],
      best_audiences: Array.isArray(item.best_audiences) ? item.best_audiences : [],
      optimal_timing: Array.isArray(item.optimal_timing) ? item.optimal_timing : [],
      created_at: item.created_at || new Date().toISOString(),
      last_used: item.last_used,
      last_evolved: item.last_evolved
    }));
  }

  private updateHookPerformance(performanceData: any[]): void {
    performanceData.forEach(data => {
      const hook = this.hookPopulation.find(h => h.hook_id === data.hook_id);
      if (hook) {
        // Update running averages
        const totalUses = hook.times_used || 1;
        hook.avg_engagement_rate = ((hook.avg_engagement_rate * (totalUses - 1)) + data.engagement_rate) / totalUses;
        hook.avg_viral_coefficient = ((hook.avg_viral_coefficient * (totalUses - 1)) + data.viral_coefficient) / totalUses;
        hook.avg_followers_gained = ((hook.avg_followers_gained * (totalUses - 1)) + data.followers_gained) / totalUses;
        
        // Update success rate
        hook.success_rate = (hook.avg_engagement_rate * 0.4) + (hook.avg_viral_coefficient * 0.3) + (hook.avg_followers_gained * 0.3);
      }
    });
  }

  private selectParents(): HookDNA[] {
    // Tournament selection
    const tournamentSize = 3;
    const parents: HookDNA[] = [];
    
    for (let i = 0; i < 4; i++) {
      const tournament = [];
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * this.hookPopulation.length);
        tournament.push(this.hookPopulation[randomIndex]);
      }
      tournament.sort((a, b) => b.success_rate - a.success_rate);
      parents.push(tournament[0]);
    }
    
    return parents;
  }

  private async createOffspring(parents: HookDNA[]): Promise<HookDNA[]> {
    const offspring: HookDNA[] = [];
    
    for (let i = 0; i < 2; i++) {
      const parent1 = parents[i * 2];
      const parent2 = parents[i * 2 + 1];
      
      // Crossover
      const child = await this.crossover(parent1, parent2);
      
      // Mutation
      const mutatedChild = await this.mutate(child);
      
      offspring.push(mutatedChild);
    }
    
    return offspring;
  }

  private async crossover(parent1: HookDNA, parent2: HookDNA): Promise<HookDNA> {
    const child: HookDNA = {
      hook_id: `gen${parent1.generation + 1}_${Date.now()}`,
      hook_text: Math.random() < 0.5 ? parent1.hook_text : parent2.hook_text,
      hook_category: Math.random() < 0.5 ? parent1.hook_category : parent2.hook_category,
      engagement_gene: (parent1.engagement_gene + parent2.engagement_gene) / 2,
      viral_gene: (parent1.viral_gene + parent2.viral_gene) / 2,
      follower_gene: (parent1.follower_gene + parent2.follower_gene) / 2,
      authority_gene: (parent1.authority_gene + parent2.authority_gene) / 2,
      word_count: 0, // Will be calculated
      has_statistics: parent1.has_statistics || parent2.has_statistics,
      has_controversy: parent1.has_controversy || parent2.has_controversy,
      has_question: parent1.has_question || parent2.has_question,
      has_emotional_trigger: parent1.has_emotional_trigger || parent2.has_emotional_trigger,
      generation: Math.max(parent1.generation, parent2.generation) + 1,
      parent_hooks: [parent1.hook_id, parent2.hook_id],
      mutation_rate: (parent1.mutation_rate + parent2.mutation_rate) / 2,
      times_used: 0,
      avg_engagement_rate: 0,
      avg_viral_coefficient: 0,
      avg_followers_gained: 0,
      success_rate: (parent1.success_rate + parent2.success_rate) / 2,
      best_topics: [...parent1.best_topics, ...parent2.best_topics],
      best_audiences: [...parent1.best_audiences, ...parent2.best_audiences],
      optimal_timing: [...parent1.optimal_timing, ...parent2.optimal_timing],
      created_at: new Date().toISOString(),
      last_evolved: new Date().toISOString()
    };
    
    child.word_count = child.hook_text.split(' ').length;
    return child;
  }

  private async mutate(hook: HookDNA): Promise<HookDNA> {
    if (Math.random() > hook.mutation_rate) {
      return hook; // No mutation
    }
    
    console.log(`[HOOK_EVOLUTION] 🧬 Mutating hook: "${hook.hook_text}"`);
    
    try {
      // Use LLM to generate mutation
      const response = await createBudgetedChatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a hook evolution engine. Create a variation of the given hook that maintains its core appeal but explores new angles. Keep it under 15 words and maintain the same category style.`
          },
          {
            role: 'user',
            content: `Original hook: "${hook.hook_text}"\nCategory: ${hook.hook_category}\nCreate a mutation that could be more effective:`
          }
        ],
        temperature: 0.8,
        max_tokens: 50
      }, {
        purpose: 'hook_evolution_mutation',
        requestId: `mutation_${hook.hook_id}`
      });
      
      const mutatedText = response.choices[0]?.message?.content?.trim();
      if (mutatedText && mutatedText.length > 10) {
        hook.hook_text = mutatedText;
        hook.word_count = mutatedText.split(' ').length;
        hook.has_question = mutatedText.includes('?');
        hook.has_statistics = /\d+%|\d+x|#\d+/.test(mutatedText);
        hook.has_controversy = /wrong|mistake|lie|myth|secret/i.test(mutatedText);
        hook.has_emotional_trigger = /amazing|shocking|secret|truth|wrong|mistake/i.test(mutatedText);
        
        console.log(`[HOOK_EVOLUTION] ✅ Mutation successful: "${mutatedText}"`);
      }
    } catch (error: any) {
      console.warn('[HOOK_EVOLUTION] ⚠️ Mutation failed, using original hook');
    }
    
    return hook;
  }

  private calculateImprovements(offspring: HookDNA[]): number {
    const avgParentScore = this.hookPopulation
      .slice(0, 4)
      .reduce((sum, hook) => sum + hook.success_rate, 0) / 4;
    
    const avgOffspringScore = offspring
      .reduce((sum, hook) => sum + hook.success_rate, 0) / offspring.length;
    
    return ((avgOffspringScore - avgParentScore) / avgParentScore) * 100;
  }

  private discoverPatterns(offspring: HookDNA[]): string[] {
    const patterns: string[] = [];
    
    offspring.forEach(hook => {
      if (hook.has_question && hook.has_statistics) {
        patterns.push('Question + Statistics combination');
      }
      if (hook.has_controversy && hook.authority_gene > 0.8) {
        patterns.push('High authority controversy');
      }
      if (hook.engagement_gene > 0.9) {
        patterns.push('Ultra-high engagement potential');
      }
    });
    
    return [...new Set(patterns)];
  }

  private async storeHooks(hooks: HookDNA[]): Promise<void> {
    try {
      // First, ensure the table exists by creating it if needed
      await this.ensureHookDnaTable();
      
      const hookData = hooks.map(hook => ({
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
        last_used: hook.last_used,
        last_evolved: hook.last_evolved
      }));

      const { error } = await this.supabase
        .from('hook_dna')
        .upsert(hookData, { onConflict: 'hook_id' });
      
      if (error) {
        console.error('[HOOK_EVOLUTION] ❌ Failed to store hooks:', error);
      } else {
        console.log(`[HOOK_EVOLUTION] ✅ Stored ${hooks.length} hooks to database`);
      }
    } catch (error: any) {
      console.error('[HOOK_EVOLUTION] ❌ Database storage error:', error.message);
    }
  }

  /**
   * Ensure the hook_dna table exists
   */
  private async ensureHookDnaTable(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.hook_dna (
          hook_id text PRIMARY KEY,
          hook_text text NOT NULL,
          hook_category text NOT NULL,
          engagement_gene double precision NOT NULL,
          viral_gene double precision NOT NULL,
          follower_gene double precision NOT NULL,
          authority_gene double precision NOT NULL,
          word_count integer NOT NULL,
          has_statistics boolean DEFAULT false,
          has_controversy boolean DEFAULT false,
          has_question boolean DEFAULT false,
          has_emotional_trigger boolean DEFAULT false,
          generation integer DEFAULT 0,
          parent_hooks jsonb,
          mutation_rate double precision DEFAULT 0.1,
          times_used integer DEFAULT 0,
          avg_engagement_rate double precision DEFAULT 0.0,
          avg_viral_coefficient double precision DEFAULT 0.0,
          avg_followers_gained double precision DEFAULT 0.0,
          success_rate double precision DEFAULT 0.5,
          best_topics jsonb,
          best_audiences jsonb,
          optimal_timing jsonb,
          created_at timestamptz DEFAULT now() NOT NULL,
          last_used timestamptz,
          last_evolved timestamptz
        );
        
        CREATE INDEX IF NOT EXISTS idx_hook_dna_category ON public.hook_dna (hook_category);
      `;
      
      const { error } = await this.supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (error) {
        console.warn('[HOOK_EVOLUTION] ⚠️ Could not ensure table exists:', error.message);
      }
    } catch (error: any) {
      console.warn('[HOOK_EVOLUTION] ⚠️ Table creation check failed:', error.message);
    }
  }

  async getPopulationStats(): Promise<any> {
    return {
      population_size: this.hookPopulation.length,
      avg_generation: this.hookPopulation.reduce((sum, h) => sum + h.generation, 0) / this.hookPopulation.length,
      avg_success_rate: this.hookPopulation.reduce((sum, h) => sum + h.success_rate, 0) / this.hookPopulation.length,
      top_performers: this.hookPopulation
        .sort((a, b) => b.success_rate - a.success_rate)
        .slice(0, 3)
        .map(h => ({ text: h.hook_text, success_rate: h.success_rate, generation: h.generation }))
    };
  }
}

export const hookEvolutionEngine = new HookEvolutionEngine();
