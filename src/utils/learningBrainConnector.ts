/**
 * 🧠 LEARNING BRAIN CONNECTOR
 * ===========================
 * Connects AI agents to the learning brain for autonomous intelligence
 * Provides easy interface for agents to learn and remember
 */

import { supabase } from './supabaseClient.js';

export interface AIDecision {
  agentName: string;
  decisionType: 'post_decision' | 'content_choice' | 'timing_decision' | 'style_choice';
  contextData: any;
  decisionMade: string;
  confidenceScore: number; // 0.00 to 1.00
  reasoning: string;
  outcomeSuccess?: boolean;
  performanceImpact?: number; // -1.00 to 1.00
}

export interface LearningInsight {
  insightType: 'content_pattern' | 'timing_pattern' | 'engagement_pattern' | 'viral_pattern';
  insightData: any;
  confidenceScore: number;
  performanceImpact: number;
  sourceAgent: string;
  sampleSize?: number;
}

export interface ContentThemeUpdate {
  themeName: string;
  engagementScore: number;
  isSuccess?: boolean;
}

export class LearningBrainConnector {
  private static instance: LearningBrainConnector;
  private isEnabled: boolean = true;

  private constructor() {}

  public static getInstance(): LearningBrainConnector {
    if (!LearningBrainConnector.instance) {
      LearningBrainConnector.instance = new LearningBrainConnector();
    }
    return LearningBrainConnector.instance;
  }

  /**
   * 🤖 Store AI Decision
   * Records every decision made by AI agents for learning
   */
  async storeDecision(decision: AIDecision): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await supabase.rpc('store_ai_decision', {
        p_agent_name: decision.agentName,
        p_decision_type: decision.decisionType,
        p_context_data: decision.contextData,
        p_decision_made: decision.decisionMade,
        p_confidence_score: decision.confidenceScore,
        p_reasoning: decision.reasoning
      });

      if (error) {
        console.warn('🧠 Learning Brain: Failed to store decision:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('🧠 Learning Brain: Error storing decision:', error);
      return null;
    }
  }

  /**
   * 📚 Record Learning Insight
   * Captures patterns and insights discovered by agents
   */
  async recordInsight(insight: LearningInsight): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await supabase.rpc('record_learning_insight', {
        p_insight_type: insight.insightType,
        p_insight_data: insight.insightData,
        p_confidence_score: insight.confidenceScore,
        p_performance_impact: insight.performanceImpact,
        p_source_agent: insight.sourceAgent
      });

      if (error) {
        console.warn('🧠 Learning Brain: Failed to record insight:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('🧠 Learning Brain: Error recording insight:', error);
      return null;
    }
  }

  /**
   * 🎯 Update Content Theme Performance
   * Updates theme performance based on tweet results
   */
  async updateThemePerformance(update: ContentThemeUpdate): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const { error } = await supabase.rpc('update_theme_performance', {
        p_theme_name: update.themeName,
        p_engagement_score: update.engagementScore,
        p_is_success: update.isSuccess
      });

      if (error) {
        console.warn('🧠 Learning Brain: Failed to update theme performance:', error.message);
      }
    } catch (error) {
      console.warn('🧠 Learning Brain: Error updating theme performance:', error);
    }
  }

  /**
   * 📊 Get Content Themes
   * Retrieves learned content themes for decision making
   */
  async getContentThemes(limit: number = 10): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('content_themes')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('🧠 Learning Brain: Failed to get content themes:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('🧠 Learning Brain: Error getting content themes:', error);
      return [];
    }
  }

  /**
   * ⏰ Get Optimal Timing
   * Retrieves best posting times based on learned patterns
   */
  async getOptimalTiming(): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('timing_insights')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(5);

      if (error) {
        console.warn('🧠 Learning Brain: Failed to get timing insights:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('🧠 Learning Brain: Error getting timing insights:', error);
      return [];
    }
  }

  /**
   * 🎨 Get Style Performance
   * Retrieves writing style performance data
   */
  async getStylePerformance(): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('style_performance')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('🧠 Learning Brain: Failed to get style performance:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('🧠 Learning Brain: Error getting style performance:', error);
      return [];
    }
  }

  /**
   * 🔬 Get Active Experiments
   * Retrieves current autonomous experiments
   */
  async getActiveExperiments(): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('ai_experiments')
        .select('*')
        .in('experiment_status', ['planning', 'running'])
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('🧠 Learning Brain: Failed to get experiments:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('🧠 Learning Brain: Error getting experiments:', error);
      return [];
    }
  }

  /**
   * 🏆 Get Viral Patterns
   * Retrieves viral content patterns for replication
   */
  async getViralPatterns(limit: number = 5): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('viral_content_analysis')
        .select('*')
        .order('adaptation_potential', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('🧠 Learning Brain: Failed to get viral patterns:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('🧠 Learning Brain: Error getting viral patterns:', error);
      return [];
    }
  }

  /**
   * 📈 Learn from Tweet Performance
   * Comprehensive learning from tweet results
   */
  async learnFromTweetPerformance(tweetData: {
    content: string;
    contentType: string;
    timing: Date;
    engagement: number;
    success: boolean;
    agentName: string;
  }): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Store the decision that led to this tweet
      await this.storeDecision({
        agentName: tweetData.agentName,
        decisionType: 'post_decision',
        contextData: {
          content_type: tweetData.contentType,
          timing: tweetData.timing.toISOString(),
          content_length: tweetData.content.length
        },
        decisionMade: 'post_tweet',
        confidenceScore: 0.80,
        reasoning: `Posted ${tweetData.contentType} content`,
        outcomeSuccess: tweetData.success,
        performanceImpact: tweetData.success ? 0.5 : -0.2
      });

      // Update content theme performance
      await this.updateThemePerformance({
        themeName: tweetData.contentType,
        engagementScore: tweetData.engagement,
        isSuccess: tweetData.success
      });

      // Record timing insight
      const hour = tweetData.timing.getHours();
      const dayOfWeek = tweetData.timing.getDay();
      
      await this.recordInsight({
        insightType: 'timing_pattern',
        insightData: {
          hour_of_day: hour,
          day_of_week: dayOfWeek,
          engagement_score: tweetData.engagement,
          success: tweetData.success
        },
        confidenceScore: 0.75,
        performanceImpact: tweetData.success ? 0.3 : -0.1,
        sourceAgent: tweetData.agentName
      });

      // Record engagement pattern
      await this.recordInsight({
        insightType: 'engagement_pattern',
        insightData: {
          content_type: tweetData.contentType,
          engagement_score: tweetData.engagement,
          pattern_detected: tweetData.success ? 'high_engagement' : 'low_engagement'
        },
        confidenceScore: 0.85,
        performanceImpact: tweetData.engagement / 100, // Normalize engagement
        sourceAgent: tweetData.agentName
      });

    } catch (error) {
      console.warn('🧠 Learning Brain: Error learning from tweet performance:', error);
    }
  }

  /**
   * 🔧 Enable/Disable Learning
   * Control learning brain functionality
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🧠 Learning Brain: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * 📊 Get Learning Statistics
   * Get overview of learning progress
   */
  async getLearningStats(): Promise<any> {
    if (!this.isEnabled) return null;

    try {
      const [decisions, insights, themes, experiments] = await Promise.all([
        supabase.from('ai_decisions').select('count').single(),
        supabase.from('learning_insights').select('count').single(),
        supabase.from('content_themes').select('count').single(),
        supabase.from('ai_experiments').select('count').single()
      ]);

      return {
        total_decisions: decisions.data?.count || 0,
        total_insights: insights.data?.count || 0,
        content_themes: themes.data?.count || 0,
        experiments: experiments.data?.count || 0,
        learning_enabled: this.isEnabled
      };
    } catch (error) {
      console.warn('🧠 Learning Brain: Error getting stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const learningBrain = LearningBrainConnector.getInstance(); 