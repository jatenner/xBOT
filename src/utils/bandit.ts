/**
 * Thompson Sampling Bandit for Hook Style Optimization
 */

import { supabaseClient } from './supabaseClient';

export interface HookStyle {
  id: number;
  hook_style: string;
  pulls: number;
  rewards: number;
}

class ThompsonBandit {
  private supabase = supabaseClient;

  /**
   * Pick a hook style using Thompson sampling
   */
  async pickHookStyle(): Promise<HookStyle> {
    // Get all hook styles from database using the client directly
    const { data: hookStyles, error } = await this.supabase.supabase!
      .from('hook_bandit')
      .select('*')
      .order('id');

    if (error || !hookStyles || hookStyles.length === 0) {
      throw new Error('Failed to fetch hook styles from database');
    }

    // Thompson sampling: sample from Beta(rewards+1, pulls-rewards+1) for each arm
    let bestScore = -1;
    let selectedHook = hookStyles[0];

    for (const hook of hookStyles) {
      const alpha = hook.rewards + 1;
      const beta = hook.pulls - hook.rewards + 1;
      
      // Sample from Beta distribution using gamma ratio method
      const sample = this.sampleBeta(alpha, beta);
      
      if (sample > bestScore) {
        bestScore = sample;
        selectedHook = hook;
      }
    }

    return selectedHook;
  }

  /**
   * Record the result of using a hook style
   */
  async recordHookResult(hookStyle: string, likes: number, retweets: number): Promise<void> {
    const isReward = (likes + retweets) >= 3;
    
    // First get current values
    const { data: currentData, error: fetchError } = await this.supabase.supabase!
      .from('hook_bandit')
      .select('pulls, rewards')
      .eq('hook_style', hookStyle)
      .single();

    if (fetchError || !currentData) {
      console.error('Failed to fetch current hook data:', fetchError);
      return;
    }

    // Update with incremented values
    const { error } = await this.supabase.supabase!
      .from('hook_bandit')
      .update({
        pulls: currentData.pulls + 1,
        rewards: isReward ? currentData.rewards + 1 : currentData.rewards
      })
      .eq('hook_style', hookStyle);

    if (error) {
      console.error('Failed to record hook result:', error);
    }
  }

  /**
   * Penalize a hook style for quality failures
   */
  async penalizeHook(hookStyle: string, reason: string): Promise<void> {
    const penaltyReasons = ['has_hashtag', 'percent_only', 'too_short'];
    
    if (!penaltyReasons.includes(reason)) {
      return; // Only penalize for specific quality failures
    }

    // First get current rewards value
    const { data: currentData, error: fetchError } = await this.supabase.supabase!
      .from('hook_bandit')
      .select('rewards')
      .eq('hook_style', hookStyle)
      .single();

    if (fetchError || !currentData) {
      console.error('Failed to fetch current hook data:', fetchError);
      return;
    }

    // Update with decremented value (minimum 0)
    const { error } = await this.supabase.supabase!
      .from('hook_bandit')
      .update({
        rewards: Math.max(currentData.rewards - 1, 0)
      })
      .eq('hook_style', hookStyle);

    if (error) {
      console.error('Failed to penalize hook:', error);
    }
  }

  /**
   * Sample from Beta distribution using gamma ratio method
   */
  private sampleBeta(alpha: number, beta: number): number {
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  /**
   * Sample from Gamma distribution using Marsaglia-Tsang method
   */
  private sampleGamma(alpha: number): number {
    if (alpha < 1) {
      // Use transformation for alpha < 1
      return this.sampleGamma(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
    }

    const d = alpha - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x: number;
      let v: number;

      do {
        x = this.sampleNormal();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  /**
   * Sample from standard normal distribution using Box-Muller transform
   */
  private sampleNormal(): number {
    if (this.spare !== null) {
      const temp = this.spare;
      this.spare = null;
      return temp;
    }

    const u = Math.random();
    const v = Math.random();
    const mag = Math.sqrt(-2 * Math.log(u));
    
    this.spare = mag * Math.cos(2 * Math.PI * v);
    return mag * Math.sin(2 * Math.PI * v);
  }

  private spare: number | null = null;
}

// Export singleton instance
export const thompsonBandit = new ThompsonBandit(); 