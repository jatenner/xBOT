/**
 * 🎰 MULTI-ARM BANDIT FORMAT SELECTOR
 * 
 * Uses Thompson sampling to intelligently select content formats
 * based on historical performance data. Balances exploration vs exploitation.
 */

import { supabaseClient } from '../utils/supabaseClient';
import { RewardCalculator } from '../utils/rewardCalculator';

interface BanditArm {
  format_type: string;
  hook_type: string;
  content_category: string;
  alpha: number; // Beta distribution parameter (successes + 1)
  beta: number;  // Beta distribution parameter (failures + 1)
  total_posts: number;
  avg_reward: number;
  confidence_interval: number;
  last_selected?: Date;
}

interface ContentRequest {
  exploration_rate?: number; // 0-1, higher = more exploration
  exclude_recent?: boolean;  // Avoid recently used formats
  min_sample_size?: number;  // Minimum posts required
  preferred_category?: string;
}

interface SelectionResult {
  format_type: string;
  hook_type: string;
  content_category: string;
  selection_probability: number;
  exploration_score: number;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    format_type: string;
    probability: number;
    reason: string;
  }>;
}

export class BanditFormatSelector {
  private static instance: BanditFormatSelector;
  private arms: BanditArm[] = [];
  private lastUpdate: Date | null = null;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  static getInstance(): BanditFormatSelector {
    if (!BanditFormatSelector.instance) {
      BanditFormatSelector.instance = new BanditFormatSelector();
    }
    return BanditFormatSelector.instance;
  }

  /**
   * 🎯 SELECT OPTIMAL FORMAT USING THOMPSON SAMPLING
   */
  async selectFormat(request: ContentRequest = {}): Promise<SelectionResult> {
    try {
      console.log('🎰 === BANDIT FORMAT SELECTION ===');

      // Ensure we have fresh data
      await this.updateArms();

      if (this.arms.length === 0) {
        return this.getDefaultSelection();
      }

      // Filter arms based on request criteria
      const eligibleArms = this.filterEligibleArms(request);

      if (eligibleArms.length === 0) {
        console.log('⚠️ No eligible arms found, using default');
        return this.getDefaultSelection();
      }

      // Apply Thompson sampling
      const selectedArm = this.thompsonSampling(eligibleArms, request.exploration_rate || 0.15);

      // Record selection for diversity tracking
      await this.recordSelection(selectedArm);

      const result: SelectionResult = {
        format_type: selectedArm.format_type,
        hook_type: selectedArm.hook_type,
        content_category: selectedArm.content_category,
        selection_probability: this.calculateSelectionProbability(selectedArm, eligibleArms),
        exploration_score: this.calculateExplorationScore(selectedArm),
        confidence: this.calculateConfidence(selectedArm),
        reasoning: this.generateReasoning(selectedArm, eligibleArms),
        alternatives: this.getAlternatives(eligibleArms, selectedArm)
      };

      console.log(`🎯 Selected: ${result.format_type}/${result.hook_type}/${result.content_category}`);
      console.log(`📊 Probability: ${(result.selection_probability * 100).toFixed(1)}%, Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`💡 Reasoning: ${result.reasoning}`);

      return result;

    } catch (error) {
      console.error('❌ Bandit selection failed:', error);
      return this.getDefaultSelection();
    }
  }

  /**
   * 📊 UPDATE BANDIT ARMS WITH LATEST PERFORMANCE DATA
   */
  private async updateArms(): Promise<void> {
    // Check if cache is still valid
    if (this.lastUpdate && Date.now() - this.lastUpdate.getTime() < this.CACHE_DURATION_MS) {
      return;
    }

    try {
      const { data, error } = await supabaseClient.supabase
        .from('format_stats')
        .select('*')
        .gte('total_posts', 1) // At least 1 post
        .order('last_updated', { ascending: false });

      if (error) throw error;

      this.arms = (data || []).map(stat => ({
        format_type: stat.format_type,
        hook_type: stat.hook_type || '',
        content_category: stat.content_category || '',
        alpha: Math.max(1, stat.alpha || 1),
        beta: Math.max(1, stat.beta || 1),
        total_posts: stat.total_posts,
        avg_reward: stat.avg_reward,
        confidence_interval: stat.confidence_interval || 0,
        last_selected: stat.last_selected ? new Date(stat.last_selected) : undefined
      }));

      this.lastUpdate = new Date();
      console.log(`📊 Updated ${this.arms.length} bandit arms`);

    } catch (error) {
      console.error('❌ Error updating bandit arms:', error);
    }
  }

  /**
   * 🔍 FILTER ARMS BASED ON REQUEST CRITERIA
   */
  private filterEligibleArms(request: ContentRequest): BanditArm[] {
    let eligible = [...this.arms];

    // Filter by minimum sample size
    if (request.min_sample_size) {
      eligible = eligible.filter(arm => arm.total_posts >= request.min_sample_size);
    }

    // Filter by preferred category
    if (request.preferred_category) {
      const preferredArms = eligible.filter(arm => 
        arm.content_category === request.preferred_category
      );
      if (preferredArms.length > 0) {
        eligible = preferredArms;
      }
    }

    // Exclude recently used formats if requested
    if (request.exclude_recent) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      eligible = eligible.filter(arm => 
        !arm.last_selected || arm.last_selected < oneHourAgo
      );
    }

    return eligible;
  }

  /**
   * 🎲 THOMPSON SAMPLING SELECTION
   */
  private thompsonSampling(arms: BanditArm[], explorationRate: number): BanditArm {
    const samples = arms.map(arm => {
      // Generate beta distribution sample
      const sample = this.betaSample(arm.alpha, arm.beta);
      
      // Add exploration bonus for less-tried arms
      const explorationBonus = explorationRate * Math.sqrt(
        Math.log(arms.reduce((sum, a) => sum + a.total_posts, 0)) / (arm.total_posts + 1)
      );
      
      return {
        arm,
        sample: sample + explorationBonus
      };
    });

    // Select arm with highest sample
    const bestSample = samples.reduce((best, current) => 
      current.sample > best.sample ? current : best
    );

    return bestSample.arm;
  }

  /**
   * 📈 GENERATE BETA DISTRIBUTION SAMPLE
   */
  private betaSample(alpha: number, beta: number): number {
    // Simplified beta distribution sampling using ratio of gammas
    // For production, consider using a proper statistical library
    
    if (alpha === 1 && beta === 1) {
      return Math.random(); // Uniform distribution
    }

    // Simple approximation for beta distribution
    const x = this.gammaSample(alpha);
    const y = this.gammaSample(beta);
    return x / (x + y);
  }

  /**
   * 📊 SIMPLE GAMMA DISTRIBUTION SAMPLE
   */
  private gammaSample(alpha: number): number {
    // Simplified gamma sampling - for production use proper implementation
    if (alpha < 1) {
      return this.gammaSample(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
    }

    // Marsaglia and Tsang method approximation
    const d = alpha - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    
    let v, x;
    do {
      do {
        x = this.normalSample();
        v = 1 + c * x;
      } while (v <= 0);
      
      v = v * v * v;
      const u = Math.random();
      
      if (u < 1 - 0.331 * x * x * x * x) {
        return d * v;
      }
      
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    } while (true);
  }

  /**
   * 📊 NORMAL DISTRIBUTION SAMPLE (BOX-MULLER)
   */
  private normalSample(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * 📊 CALCULATE SELECTION PROBABILITY
   */
  private calculateSelectionProbability(selectedArm: BanditArm, allArms: BanditArm[]): number {
    if (allArms.length <= 1) return 1.0;

    // Simple approximation: relative sample mean
    const selectedMean = selectedArm.alpha / (selectedArm.alpha + selectedArm.beta);
    const totalMean = allArms.reduce((sum, arm) => 
      sum + arm.alpha / (arm.alpha + arm.beta), 0
    );

    return selectedMean / totalMean;
  }

  /**
   * 🔍 CALCULATE EXPLORATION SCORE
   */
  private calculateExplorationScore(arm: BanditArm): number {
    const totalPosts = arm.total_posts;
    if (totalPosts === 0) return 1.0;
    if (totalPosts >= 20) return 0.1;
    
    // Higher exploration score for less-tried arms
    return Math.max(0.1, 1 - (totalPosts / 20));
  }

  /**
   * 🎯 CALCULATE CONFIDENCE
   */
  private calculateConfidence(arm: BanditArm): number {
    // Confidence based on sample size and variance
    const n = arm.total_posts;
    if (n === 0) return 0.1;
    if (n >= 20) return 0.95;
    
    // Linear interpolation between 0.5 and 0.95
    return 0.5 + (0.45 * Math.min(n, 20) / 20);
  }

  /**
   * 💬 GENERATE SELECTION REASONING
   */
  private generateReasoning(selectedArm: BanditArm, allArms: BanditArm[]): string {
    const avgReward = selectedArm.avg_reward;
    const totalPosts = selectedArm.total_posts;
    
    if (totalPosts < 5) {
      return `Exploring ${selectedArm.format_type} format (${totalPosts} posts) for learning`;
    }
    
    if (avgReward > 0) {
      const rank = allArms.filter(arm => arm.avg_reward > avgReward).length + 1;
      return `Selected top-${rank} performing format (${avgReward.toFixed(2)} avg reward, ${totalPosts} posts)`;
    }
    
    return `Selected ${selectedArm.format_type} format for content diversity`;
  }

  /**
   * 🔄 GET ALTERNATIVE OPTIONS
   */
  private getAlternatives(arms: BanditArm[], selected: BanditArm): Array<{
    format_type: string;
    probability: number;
    reason: string;
  }> {
    return arms
      .filter(arm => arm !== selected)
      .slice(0, 3)
      .map(arm => ({
        format_type: arm.format_type,
        probability: this.calculateSelectionProbability(arm, arms),
        reason: arm.total_posts < 5 ? 'Exploration opportunity' : 
                `${arm.avg_reward.toFixed(2)} avg reward`
      }));
  }

  /**
   * 🔄 RECORD SELECTION FOR TRACKING
   */
  private async recordSelection(arm: BanditArm): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('format_stats')
        .update({ last_selected: new Date().toISOString() })
        .eq('format_type', arm.format_type)
        .eq('hook_type', arm.hook_type)
        .eq('content_category', arm.content_category);
    } catch (error) {
      console.warn('⚠️ Could not record selection:', error);
    }
  }

  /**
   * 🎯 UPDATE BANDIT WITH REWARD
   */
  async updateWithReward(
    format_type: string,
    hook_type: string,
    content_category: string,
    reward: number,
    engagement_rate: number
  ): Promise<void> {
    try {
      console.log(`🎰 Updating bandit: ${format_type}/${hook_type}/${content_category} with reward ${reward}`);

      // Simple reward-based update for beta parameters
      const success = reward > 1.0 ? 1 : 0; // Consider reward > 1 as success
      const failure = 1 - success;

      // Get current values first, then update
      const { data: currentStats } = await supabaseClient.supabase
        .from('format_stats')
        .select('alpha, beta')
        .eq('format_type', format_type)
        .eq('hook_type', hook_type || '')
        .eq('content_category', content_category || '')
        .single();

      if (currentStats) {
        const newAlpha = currentStats.alpha + success;
        const newBeta = currentStats.beta + failure;

        const { error } = await supabaseClient.supabase
          .from('format_stats')
          .update({
            alpha: newAlpha,
            beta: newBeta,
            last_updated: new Date().toISOString()
          })
          .eq('format_type', format_type)
          .eq('hook_type', hook_type || '')
          .eq('content_category', content_category || '');

        if (error) {
          console.error('❌ Error updating bandit:', error);
        } else {
          console.log(`✅ Bandit updated: alpha ${currentStats.alpha} → ${newAlpha}, beta ${currentStats.beta} → ${newBeta}`);
          // Invalidate cache to force refresh
          this.lastUpdate = null;
        }
      } else {
        console.warn('⚠️ Format stats not found for bandit update');
      }

    } catch (error) {
      console.error('❌ Bandit reward update failed:', error);
    }
  }

  /**
   * 🎯 GET DEFAULT SELECTION
   */
  private getDefaultSelection(): SelectionResult {
    return {
      format_type: 'data_insight',
      hook_type: 'question',
      content_category: 'health_optimization',
      selection_probability: 1.0,
      exploration_score: 1.0,
      confidence: 0.5,
      reasoning: 'Default format - no performance data available',
      alternatives: []
    };
  }

  /**
   * 📊 GET BANDIT STATISTICS
   */
  async getStatistics(): Promise<{
    total_arms: number;
    total_posts: number;
    avg_reward: number;
    top_performers: Array<{
      format_type: string;
      hook_type: string;
      total_posts: number;
      avg_reward: number;
      confidence: number;
    }>;
  }> {
    await this.updateArms();

    const totalPosts = this.arms.reduce((sum, arm) => sum + arm.total_posts, 0);
    const avgReward = totalPosts > 0 
      ? this.arms.reduce((sum, arm) => sum + arm.avg_reward * arm.total_posts, 0) / totalPosts
      : 0;

    const topPerformers = this.arms
      .filter(arm => arm.total_posts >= 3)
      .sort((a, b) => b.avg_reward - a.avg_reward)
      .slice(0, 5)
      .map(arm => ({
        format_type: arm.format_type,
        hook_type: arm.hook_type,
        total_posts: arm.total_posts,
        avg_reward: arm.avg_reward,
        confidence: this.calculateConfidence(arm)
      }));

    return {
      total_arms: this.arms.length,
      total_posts: totalPosts,
      avg_reward: avgReward,
      top_performers: topPerformers
    };
  }
}

export const banditFormatSelector = BanditFormatSelector.getInstance(); 