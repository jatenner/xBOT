/**
 * INTELLIGENCE TYPES
 * Shared types for AI intelligence system
 */

export interface ResearchInsights {
  common_belief: string;
  scientific_reality: string;
  surprise_factor: string;
  expert_insight: string;
  controversy?: string;
}

export interface ContextInsights {
  current_narrative: string;
  gaps: string[];
  controversies: string[];
  trending_angle?: string;
}

export interface Perspective {
  angle: string;
  implication: string;
  action_hook: string;
  controversy_level: number; // 1-10
  uniqueness_score: number; // 1-10
}

export interface IntelligencePackage {
  topic: string;
  research: ResearchInsights;
  context: ContextInsights;
  perspectives: Perspective[];
  generated_at: Date;
  recentPosts?: string[]; // 🆕 Recent posts to avoid repetition
}

export interface IntelligenceScore {
  intelligence_score: number; // 0-100
  engagement_potential: number; // 0-100
  viral_potential: number; // 0-100
  actionability_score: number; // 0-100
  memorability_score: number; // 0-100
  overall_score: number; // Average of all
  passes_intelligence_threshold: boolean;
  improvement_suggestions: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface IntelligenceConfig {
  preGeneration: {
    enabled: boolean;
    skipIfBudgetLow: boolean;
    cacheResults: boolean;
    cacheDurationMinutes: number;
  };
  postGeneration: {
    enabled: boolean;
    minimumScore: number;
  };
  enhancement: {
    enabled: boolean;
    maxAttempts: number;
    minScoreToEnhance: number;
  };
}

