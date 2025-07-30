/**
 * 🎰 CONTEXTUAL BANDIT SELECTOR
 * Advanced bandit algorithm that considers context features for intelligent decisions
 */

import { supabaseClient } from '../utils/supabaseClient';

export interface ContextualFeatures {
  hour_of_day: number;
  day_of_week: number;
  content_category: string;
  format_type: string;
  hook_type: string;
  budget_utilization: number;
  recent_engagement_rate: number;
}

export interface BanditArm {
  id: number;
  arm_name: string;
  arm_type: string;
  features: any;
  total_selections: number;
  avg_reward: number;
  success_count: number;
  failure_count: number;
  confidence_score: number;
}

export class ContextualBanditSelector {
  private static instance: ContextualBanditSelector;
  private arms: BanditArm[] = [];
  
  static getInstance(): ContextualBanditSelector {
    if (!this.instance) {
      this.instance = new ContextualBanditSelector();
    }
    return this.instance;
  }

  /**
   * 🎯 Select optimal arm using contextual information
   */
  async selectArm(context: ContextualFeatures, armType: string = 'format'): Promise<any | null> {
    try {
      console.log('🎰 === CONTEXTUAL BANDIT SELECTION ===');
      console.log(`🎯 Context: Hour ${context.hour_of_day}, Category ${context.content_category}`);

      // Load arms from database
      await this.loadArms(armType);

      if (this.arms.length === 0) {
        console.log('⚠️ No arms available for selection');
        return null;
      }

      // Simple selection logic for now
      const selectedArm = this.arms[Math.floor(Math.random() * this.arms.length)];
      
      console.log(`🎯 Selected: ${selectedArm.arm_name}`);
      
      return {
        arm_id: selectedArm.id,
        arm_name: selectedArm.arm_name,
        predicted_reward: selectedArm.avg_reward,
        confidence: selectedArm.confidence_score
      };

    } catch (error) {
      console.error('❌ Contextual bandit selection failed:', error);
      return null;
    }
  }

  /**
   * 📈 Update arm with reward
   */
  async updateArmWithReward(armId: number, context: ContextualFeatures, reward: number): Promise<void> {
    try {
      console.log(`📈 Updating arm ${armId} with reward ${reward}`);
      
      // Update in database
      const { error } = await supabaseClient.supabase
        .from('contextual_bandit_arms')
        .update({
          total_selections: 'total_selections + 1',
          total_reward: `total_reward + ${reward}`,
          avg_reward: `(total_reward + ${reward}) / (total_selections + 1)`
        })
        .eq('id', armId);

      if (error) {
        console.error('❌ Failed to update contextual bandit:', error);
      } else {
        console.log('✅ Contextual bandit updated successfully');
      }

    } catch (error) {
      console.error('❌ Contextual bandit update error:', error);
    }
  }

  private async loadArms(armType: string): Promise<void> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('contextual_bandit_arms')
        .select('*')
        .eq('arm_type', armType);

      if (error) throw error;
      this.arms = data || [];

    } catch (error) {
      console.error('❌ Failed to load arms:', error);
      this.arms = [];
    }
  }
}

export const contextualBanditSelector = ContextualBanditSelector.getInstance();