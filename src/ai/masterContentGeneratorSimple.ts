/**
 * Simplified Master Content Generator
 * Provides basic content generation without complex dependencies
 */

import { followerAcquisitionGenerator } from './followerAcquisitionGenerator';

export interface MasterContentRequest {
  primary_goal: 'followers' | 'viral' | 'engagement' | 'authority';
  secondary_goal?: 'followers' | 'viral' | 'engagement' | 'authority';
  topic_preference?: string;
  format_preference?: 'single' | 'thread';
  target_audience?: string;
  viral_target?: 'moderate' | 'high' | 'extreme';
  use_evolved_hooks?: boolean;
  apply_viral_formulas?: boolean;
  optimize_for_followers?: boolean;
}

export interface MasterContentOutput {
  content: string | string[];
  format: 'single' | 'thread';
  generation_method: string;
  hook_used: {
    hook_text: string;
    hook_category: string;
    evolution_generation: number;
  };
  viral_formula_applied: {
    formula_name: string;
    success_rate: number;
  };
  follower_magnet_score: number;
  confidence_score: number;
  expected_outcomes: {
    engagement_rate_prediction: number;
    viral_coefficient_prediction: number;
    followers_gained_prediction: number;
  };
  content_characteristics: {
    has_statistics: boolean;
    has_controversy: boolean;
    credibility_signals: string[];
    follow_triggers: string[];
  };
}

export class MasterContentGenerator {
  /**
   * Generate master content using simplified approach
   */
  async generateMasterContent(request: MasterContentRequest): Promise<MasterContentOutput> {
    console.log('[MASTER_GENERATOR] Generating simplified master content...');
    
    try {
      // Use follower acquisition generator as the primary method
      const content = await followerAcquisitionGenerator.generateFollowerMagnetContent({
        target_audience: request.target_audience,
        content_goal: 'value',
        topic_preference: request.topic_preference,
        format_preference: request.format_preference
      });

      return {
        content: content.content,
        format: content.format,
        generation_method: 'simplified_master',
        hook_used: {
          hook_text: 'Most people think...',
          hook_category: 'curiosity_gap',
          evolution_generation: 0
        },
        viral_formula_applied: {
          formula_name: 'standard_insight',
          success_rate: 0.6
        },
        follower_magnet_score: content.follower_magnet_score,
        confidence_score: content.follower_magnet_score, // Use follower_magnet_score as confidence
        expected_outcomes: {
          engagement_rate_prediction: content.viral_potential * 0.5,
          viral_coefficient_prediction: content.viral_potential,
          followers_gained_prediction: Math.round(content.follower_magnet_score * 20)
        },
        content_characteristics: {
          has_statistics: content.credibility_signals.includes('statistics'),
          has_controversy: content.hook_strategy === 'controversy_magnet',
          credibility_signals: content.credibility_signals,
          follow_triggers: content.follow_triggers
        }
      };
    } catch (error: any) {
      console.error('[MASTER_GENERATOR] Error generating content:', error.message);
      
      // Fallback to basic content
      return {
        content: 'New research challenges common health assumptions. Here\'s what the data actually shows about optimizing your daily habits.',
        format: 'single',
        generation_method: 'fallback',
        hook_used: {
          hook_text: 'New research shows...',
          hook_category: 'evidence_based',
          evolution_generation: 0
        },
        viral_formula_applied: {
          formula_name: 'basic_insight',
          success_rate: 0.5
        },
        follower_magnet_score: 0.6,
        confidence_score: 0.7,
        expected_outcomes: {
          engagement_rate_prediction: 0.03,
          viral_coefficient_prediction: 0.08,
          followers_gained_prediction: 5
        },
        content_characteristics: {
          has_statistics: false,
          has_controversy: false,
          credibility_signals: ['research_reference'],
          follow_triggers: []
        }
      };
    }
  }
}

export const masterContentGenerator = new MasterContentGenerator();
