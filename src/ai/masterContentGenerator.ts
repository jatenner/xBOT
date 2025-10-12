/**
 * Enhanced Master Content Generator
 * Orchestrates follower acquisition generator with hook evolution
 */

import { followerAcquisitionGenerator } from './followerAcquisitionGenerator';
import { hookEvolutionEngine } from './hookEvolutionEngine';

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
   * Generate content using evolved hooks and follower optimization
   */
  async generateMasterContent(request: MasterContentRequest): Promise<MasterContentOutput> {
    console.log('[MASTER_GENERATOR] 🎯 Generating content with evolved hooks...');
    
    try {
      // Step 1: Get optimal hook from evolution engine
      const optimalHook = await hookEvolutionEngine.selectOptimalHook({
        goal: request.primary_goal === 'followers' ? 'followers' : request.primary_goal,
        topic: request.topic_preference,
        audience: request.target_audience
      });
      
      console.log(`[MASTER_GENERATOR] 🧬 Selected evolved hook: "${optimalHook.hook_text}" (Gen ${optimalHook.generation})`);

      // Step 2: Generate content with follower acquisition generator
      const content = await followerAcquisitionGenerator.generateFollowerMagnetContent({
        target_audience: request.target_audience,
        content_goal: 'value',
        topic_preference: request.topic_preference,
        format_preference: request.format_preference
      });

      // Step 3: Replace the hook with the evolved one
      let finalContent = content.content;
      if (typeof finalContent === 'string') {
        // Replace the opening with the evolved hook
        const sentences = finalContent.split('. ');
        sentences[0] = optimalHook.hook_text;
        finalContent = sentences.join('. ');
      } else if (Array.isArray(finalContent)) {
        // For threads, replace the first tweet's opening
        const firstTweet = finalContent[0];
        const sentences = firstTweet.split('. ');
        sentences[0] = optimalHook.hook_text;
        finalContent[0] = sentences.join('. ');
      }

      return {
        content: finalContent,
        format: content.format,
        generation_method: 'evolved_hook_master',
        hook_used: {
          hook_text: optimalHook.hook_text,
          hook_category: optimalHook.hook_category,
          evolution_generation: optimalHook.generation
        },
        viral_formula_applied: {
          formula_name: 'evolved_hook_formula',
          success_rate: optimalHook.success_rate
        },
        follower_magnet_score: Math.max(content.follower_magnet_score, optimalHook.follower_gene),
        confidence_score: (content.follower_magnet_score + optimalHook.success_rate) / 2,
        expected_outcomes: {
          engagement_rate_prediction: content.viral_potential * 0.5 * (1 + optimalHook.engagement_gene),
          viral_coefficient_prediction: content.viral_potential * (1 + optimalHook.viral_gene),
          followers_gained_prediction: Math.round(content.follower_magnet_score * 20 * (1 + optimalHook.follower_gene))
        },
        content_characteristics: {
          has_statistics: content.credibility_signals.includes('statistics') || optimalHook.has_statistics,
          has_controversy: content.hook_strategy === 'controversy_magnet' || optimalHook.has_controversy,
          credibility_signals: [...content.credibility_signals, 'evolved_hook'],
          follow_triggers: [...content.follow_triggers, 'genetic_optimization']
        }
      };
    } catch (error: any) {
      console.error('[MASTER_GENERATOR] ❌ Error generating content with evolved hooks:', error.message);
      
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
