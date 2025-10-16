/**
 * Simplified Hook Evolution Engine (Build-Safe Version)
 * Provides basic hook functionality without complex database operations
 */

import { getSupabaseClient } from '../db/index';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface SimpleHookDNA {
  hook_id: string;
  hook_text: string;
  hook_category: string;
  engagement_gene: number;
  viral_gene: number;
  follower_gene: number;
  authority_gene: number;
  generation: number;
  success_rate: number;
  created_at: string;
}

export class HookEvolutionEngine {
  private supabase = getSupabaseClient();
  private hookPopulation: SimpleHookDNA[] = [];

  constructor() {
    this.initializeDefaultHooks();
  }

  private initializeDefaultHooks(): void {
    // NATURAL, VARIED HOOKS - No more robotic templates!
    // These are guidance patterns, NOT literal templates to fill
    this.hookPopulation = [
      {
        hook_id: 'natural_contrarian',
        hook_text: 'contrarian_insight_with_evidence',
        hook_category: 'contrarian',
        engagement_gene: 0.7,
        viral_gene: 0.6,
        follower_gene: 0.8,
        authority_gene: 0.7,
        generation: 0,
        success_rate: 0.65,
        created_at: new Date().toISOString()
      },
      {
        hook_id: 'natural_curiosity',
        hook_text: 'surprising_statistic_hook',
        hook_category: 'curiosity',
        engagement_gene: 0.8,
        viral_gene: 0.7,
        follower_gene: 0.6,
        authority_gene: 0.5,
        generation: 0,
        success_rate: 0.6,
        created_at: new Date().toISOString()
      },
      {
        hook_id: 'natural_question',
        hook_text: 'thought_provoking_question',
        hook_category: 'curiosity',
        engagement_gene: 0.85,
        viral_gene: 0.6,
        follower_gene: 0.7,
        authority_gene: 0.5,
        generation: 0,
        success_rate: 0.6,
        created_at: new Date().toISOString()
      },
      {
        hook_id: 'natural_bold_claim',
        hook_text: 'bold_statement_backed_by_data',
        hook_category: 'authority',
        engagement_gene: 0.75,
        viral_gene: 0.8,
        follower_gene: 0.85,
        authority_gene: 0.9,
        generation: 0,
        success_rate: 0.7,
        created_at: new Date().toISOString()
      },
      {
        hook_id: 'natural_story_start',
        hook_text: 'conversational_story_opening',
        hook_category: 'storytelling',
        engagement_gene: 0.8,
        viral_gene: 0.65,
        follower_gene: 0.75,
        authority_gene: 0.6,
        generation: 0,
        success_rate: 0.65,
        created_at: new Date().toISOString()
      },
      {
        hook_id: 'no_hook',
        hook_text: 'direct_start_no_hook',
        hook_category: 'direct',
        engagement_gene: 0.6,
        viral_gene: 0.5,
        follower_gene: 0.6,
        authority_gene: 0.7,
        generation: 0,
        success_rate: 0.5,
        created_at: new Date().toISOString()
      }
    ];
  }

  async selectOptimalHook(criteria: any): Promise<SimpleHookDNA> {
    console.log('[HOOK_EVOLUTION] 🎯 Selecting optimal hook for followers');
    
    // Simple selection based on follower_gene (since goal is followers)
    const sortedHooks = [...this.hookPopulation].sort((a, b) => b.follower_gene - a.follower_gene);
    const selected = sortedHooks[0] || this.hookPopulation[0];
    
    console.log(`[HOOK_EVOLUTION] ✅ Selected hook: "${selected.hook_text}" (Gen ${selected.generation})`);
    
    return selected;
  }

  async evolveHooks(): Promise<void> {
    console.log('[HOOK_EVOLUTION] Evolution disabled in simplified mode');
    // Evolution disabled for build stability
  }

  async getHookPopulation(): Promise<SimpleHookDNA[]> {
    return this.hookPopulation;
  }
}

export const hookEvolutionEngine = new HookEvolutionEngine();
