/**
 * Shared TypeScript interfaces for the enhanced learning system
 */

export interface EnhancedPerformanceData {
  post_id: string;
  timestamp?: string;
  engagement_rate: number;
  likes: number;
  retweets: number;
  replies: number;
  saves?: number;
  follower_growth?: number;
  time_to_peak_engagement?: number;
  engagement_decay_rate?: number;
  audience_retention?: number;
  click_through_rate?: number;
  save_to_engagement_ratio?: number;
  reply_sentiment?: 'positive' | 'negative' | 'neutral';
  viral_coefficient?: number;
  topic_saturation_effect?: number;
}

export interface ContentPattern {
  pattern_id: string;
  pattern_type: string;
  pattern_description: string;
  avg_performance: number;
  sample_size: number;
  confidence_score: number;
  discovered_at: string;
  last_validated: string;
}

export interface DiscoveredPattern {
  id: string;
  type: string;
  description: string;
  confidence: number;
  impact_score: number;
  sample_size: number;
  discovered_at: string;
  validation_status: string;
  conditions: any;
  outcomes: any;
  recommendations: any;
}

export interface PredictionError {
  id: string;
  post_id: string;
  prediction_type: string;
  predicted_value: number;
  actual_value: number;
  error_magnitude: number;
  error_direction: 'over' | 'under';
  prediction_context: any;
  error_analysis: any;
  created_at: string;
  learned_from: boolean;
}

export interface LearningAdjustment {
  id: string;
  adjustment_type: string;
  target_component: string;
  adjustment_description: string;
  expected_improvement: number;
  confidence: number;
  source_errors: any;
  implementation: any;
}

export interface HookDNA {
  hook_id: string;
  hook_text: string;
  hook_category: 'statistical' | 'contrarian' | 'authority' | 'curiosity' | 'social_proof' | 'value_bomb';
  
  // Performance genetics
  engagement_gene: number; // 0-1 score for engagement potential
  viral_gene: number; // 0-1 score for viral potential  
  follower_gene: number; // 0-1 score for follower conversion
  authority_gene: number; // 0-1 score for authority building
  
  // Hook characteristics
  word_count: number;
  has_statistics: boolean;
  has_controversy: boolean;
  has_question: boolean;
  has_emotional_trigger: boolean;
  
  // Evolution data
  generation: number; // Which generation of evolution this is
  parent_hooks: string[]; // Hook IDs that contributed to this hook
  mutation_rate: number; // How much this hook changes when evolved
  
  // Performance tracking
  times_used: number;
  avg_engagement_rate: number;
  avg_viral_coefficient: number;
  avg_followers_gained: number;
  success_rate: number; // Overall success rate (0-1)
  
  // Learning data
  best_topics: string[]; // Topics this hook works best with
  best_audiences: string[]; // Audiences this hook resonates with
  optimal_timing: any; // Best times to use this hook
  
  // Timestamps
  created_at: string;
  last_used?: string;
  last_evolved?: string;
}

export interface ViralPattern {
  pattern_id: string;
  name: string;
  description?: string;
  hook_template: string;
  content_flow: string[];
  evidence_requirements?: string[];
  engagement_triggers?: string[];
  viral_success_rate: number;
  avg_follower_conversion: number;
  avg_engagement_multiplier: number;
  avg_viral_coefficient: number;
  sample_size: number;
  confidence_score: number;
  last_updated: string;
  discovery_method: string;
  best_topics?: string[];
  optimal_timing?: any;
  target_audiences?: string[];
  avoid_conditions?: string[];
}
