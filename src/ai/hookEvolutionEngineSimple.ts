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
    this.hookPopulation = [
      {
        hook_id: 'default_1',
        hook_text: 'Most people think X, but research shows Y',
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
        hook_id: 'default_2',
        hook_text: 'Did you know X% of people are wrong about Y?',
        hook_category: 'curiosity',
        engagement_gene: 0.8,
        viral_gene: 0.7,
        follower_gene: 0.6,
        authority_gene: 0.5,
        generation: 0,
        success_rate: 0.6,
        created_at: new Date().toISOString()
      }
    ];
  }

  async selectOptimalHook(criteria: any): Promise<SimpleHookDNA> {
    console.log('[HOOK_EVOLUTION] Selecting optimal hook (simplified)');
    
    // Simple selection based on success rate
    const sortedHooks = [...this.hookPopulation].sort((a, b) => b.success_rate - a.success_rate);
    return sortedHooks[0] || this.hookPopulation[0];
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
