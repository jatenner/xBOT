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
  // CONTENT TYPE DIVERSITY - Pass selected type details
  content_type_name?: string;
  content_type_structure?: string;
  content_type_hook_style?: string;
  content_type_length?: string;
  content_type_value_prop?: string;
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
   * Fill hook template with real health content
   */
  private fillHookTemplate(hookText: string, topicContext: string): string {
    // If hook has template variables, fill them with real content
    if (hookText.includes('X') && hookText.includes('Y')) {
      const healthMisconceptions = {
        'X': [
          'cold showers boost immunity',
          'breakfast is the most important meal',
          'fat makes you fat',
          'cardio is best for fat loss',
          '8 hours of sleep is mandatory',
          'stretching prevents injuries',
          'protein shakes are necessary',
          'intermittent fasting works for everyone'
        ],
        'Y': [
          'cold exposure can suppress your immune system without proper adaptation',
          'meal timing matters less than total nutrition quality',
          'insulin resistance and inflammation are the real culprits',
          'strength training burns more fat long-term through metabolic adaptation',
          'sleep quality and consistency matter more than arbitrary hour targets',
          'proper warm-ups and progressive loading prevent injuries better',
          'whole food protein sources provide better nutrient density',
          'metabolic flexibility requires personalized carb tolerance testing'
        ]
      };
      
      const xIndex = Math.floor(Math.random() * healthMisconceptions.X.length);
      const yIndex = Math.floor(Math.random() * healthMisconceptions.Y.length);
      
      return hookText
        .replace('X', healthMisconceptions.X[xIndex])
        .replace('Y', healthMisconceptions.Y[yIndex]);
    }
    
    // If hook has X% pattern, fill it
    if (hookText.includes('X%')) {
      const percentage = Math.floor(Math.random() * 30) + 70; // 70-99%
      return hookText.replace('X%', `${percentage}%`);
    }
    
    // Otherwise return as-is
    return hookText;
  }

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
        format_preference: request.format_preference,
        // PASS CONTENT TYPE DETAILS FOR DIVERSITY
        content_type_name: request.content_type_name,
        content_type_structure: request.content_type_structure,
        content_type_hook_style: request.content_type_hook_style,
        content_type_length: request.content_type_length,
        content_type_value_prop: request.content_type_value_prop
      });

      // Step 3: Fill hook template with real content
      const filledHook = this.fillHookTemplate(optimalHook.hook_text, request.topic_preference || 'health');
      console.log(`[MASTER_GENERATOR] ✨ Filled hook: "${filledHook}"`);

      // Step 4: Replace the hook in content
      let finalContent = content.content;
      if (typeof finalContent === 'string') {
        // Replace the opening with the filled hook
        const sentences = finalContent.split('. ');
        sentences[0] = filledHook;
        finalContent = sentences.join('. ');
      } else if (Array.isArray(finalContent)) {
        // For threads, replace the first tweet's opening
        const firstTweet = finalContent[0];
        const sentences = firstTweet.split('. ');
        sentences[0] = filledHook;
        finalContent[0] = sentences.join('. ');
      }

      return {
        content: finalContent,
        format: content.format,
        generation_method: 'evolved_hook_master',
        hook_used: {
          hook_text: filledHook, // Use filled hook, not template
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
