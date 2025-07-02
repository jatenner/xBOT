import { supabase } from './supabaseClient';

export interface SemanticAnalysis {
  tweet_id: string;
  content: string;
  semantic_themes: string[];
  expertise_level: number;
  technical_depth: number;
  novelty_score: number;
  performance_metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    engagement_rate: number;
  };
}

export interface ExpertiseDomain {
  domain: string;
  expertise_level: number;
  confidence_interval: number;
  learning_rate: number;
  skill_trajectory: 'improving' | 'stable' | 'declining';
}

export interface ContentPattern {
  pattern_type: string;
  pattern_name: string;
  pattern_elements: any;
  success_rate: number;
  avg_performance_boost: number;
}

export class IntelligentLearningConnector {
  private static instance: IntelligentLearningConnector;

  static getInstance(): IntelligentLearningConnector {
    if (!IntelligentLearningConnector.instance) {
      IntelligentLearningConnector.instance = new IntelligentLearningConnector();
    }
    return IntelligentLearningConnector.instance;
  }

  /**
   * Analyze and store semantic content analysis for a tweet
   */
  async analyzeContentSemantically(analysis: SemanticAnalysis): Promise<boolean> {
    try {
      console.log('🧠 Starting semantic analysis:', {
        tweet_id: analysis.tweet_id,
        content_length: analysis.content.length,
        expertise_level: analysis.expertise_level
      });

      const { error } = await supabase.rpc('analyze_content_semantically', {
        p_tweet_id: analysis.tweet_id,
        p_content: analysis.content,
        p_performance_metrics: analysis.performance_metrics
      });

      if (error) {
        console.error('❌ Semantic analysis error:', error.message);
        return false;
      }

      console.log('✅ Semantic analysis success:', {
        tweet_id: analysis.tweet_id,
        semantic_themes: analysis.semantic_themes,
        expertise_level: analysis.expertise_level
      });

      return true;
    } catch (error) {
      console.error('💥 Semantic analysis exception:', error.message, analysis.tweet_id);
      return false;
    }
  }

  /**
   * Update expertise level for a domain based on performance
   */
  async updateExpertiseLevel(
    domain: string, 
    performanceData: any, 
    knowledgeDemonstration: any
  ): Promise<boolean> {
    try {
      console.log('🎓 Starting expertise update:', { domain, performance_data: performanceData });

      const { error } = await supabase.rpc('update_expertise_level', {
        p_domain: domain,
        p_performance_data: performanceData,
        p_knowledge_demonstration: knowledgeDemonstration
      });

      if (error) {
        console.error('❌ Expertise update error:', error.message);
        return false;
      }

      console.log('✅ Expertise update success:', { domain });
      return true;
    } catch (error) {
      console.error('💥 Expertise update exception:', error.message, domain);
      return false;
    }
  }

  /**
   * Detect and record content patterns from successful tweets
   */
  async detectContentPattern(
    contentAnalysis: any, 
    performanceMetrics: any
  ): Promise<boolean> {
    try {
      console.log('🔍 Starting pattern detection:', {
        engagement_rate: performanceMetrics.engagement_rate
      });

      const { error } = await supabase.rpc('detect_content_pattern', {
        p_content_analysis: contentAnalysis,
        p_performance_metrics: performanceMetrics
      });

      if (error) {
        console.error('❌ Pattern detection error:', error.message);
        return false;
      }

      console.log('✅ Pattern detection success:', {
        pattern_type: contentAnalysis.structure_type,
        engagement_rate: performanceMetrics.engagement_rate
      });

      return true;
    } catch (error) {
      console.error('💥 Pattern detection exception:', error.message);
      return false;
    }
  }

  /**
   * Capture detailed tweet metrics for learning
   */
  async captureTweetMetrics(
    tweetId: string,
    likes: number = 0,
    retweets: number = 0,
    replies: number = 0,
    impressions: number = 0
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('capture_tweet_metrics', {
        p_tweet_id: tweetId,
        p_likes: likes,
        p_retweets: retweets,
        p_replies: replies,
        p_impressions: impressions
      });

      if (error) {
        console.error('❌ Metrics capture error:', error.message);
        return false;
      }

      const engagementRate = impressions > 0 ? ((likes + retweets + replies) / impressions) * 100 : 0;
      
      console.log('📊 Metrics captured:', {
        tweet_id: tweetId,
        total_engagement: likes + retweets + replies,
        engagement_rate: engagementRate,
        impressions
      });

      return true;
    } catch (error) {
      console.error('💥 Metrics capture exception:', error.message, tweetId);
      return false;
    }
  }

  /**
   * Get current expertise levels for all domains
   */
  async getCurrentExpertise(): Promise<ExpertiseDomain[]> {
    try {
      const { data, error } = await supabase
        .from('expertise_evolution')
        .select('domain, expertise_level, confidence_interval, learning_rate, skill_trajectory')
        .order('measured_at', { ascending: false });

      if (error) {
        console.error('❌ Expertise fetch error:', error.message);
        return [];
      }

      // Get the latest expertise for each domain
      const latestExpertise: { [key: string]: ExpertiseDomain } = {};
      data?.forEach(record => {
        if (!latestExpertise[record.domain]) {
          latestExpertise[record.domain] = record;
        }
      });

      return Object.values(latestExpertise);
    } catch (error) {
      console.error('💥 Expertise fetch exception:', error.message);
      return [];
    }
  }

  /**
   * Get successful content patterns for content generation
   */
  async getSuccessfulPatterns(minSuccessRate: number = 0.7): Promise<ContentPattern[]> {
    try {
      const { data, error } = await supabase
        .from('content_patterns')
        .select('pattern_type, pattern_name, pattern_elements, success_rate, avg_performance_boost')
        .gte('success_rate', minSuccessRate)
        .order('avg_performance_boost', { ascending: false })
        .limit(10);

      if (error) {
        console.error('❌ Patterns fetch error:', error.message);
        return [];
      }

      console.log('🎯 Patterns fetched:', {
        pattern_count: data?.length || 0,
        min_success_rate: minSuccessRate
      });

      return data || [];
    } catch (error) {
      console.error('💥 Patterns fetch exception:', error.message);
      return [];
    }
  }

  /**
   * Record learning feedback loop event
   */
  async recordLearningFeedback(
    triggerType: string,
    triggerData: any,
    learningAction: any,
    actionType: string,
    feedbackMetrics: any
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('learning_feedback_loop')
        .insert({
          trigger_type: triggerType,
          trigger_data: triggerData,
          learning_opportunity: `${triggerType}_learning`,
          opportunity_type: 'pattern_reinforcement',
          learning_action: learningAction,
          action_type: actionType,
          feedback_metrics: feedbackMetrics,
          implementation_success: true
        });

      if (error) {
        console.error('❌ Learning feedback error:', error.message);
        return false;
      }

      console.log('✅ Learning feedback recorded:', {
        trigger_type: triggerType,
        action_type: actionType
      });

      return true;
    } catch (error) {
      console.error('💥 Learning feedback exception:', error.message);
      return false;
    }
  }

  /**
   * Check if learning is enabled in bot config
   */
  async isLearningEnabled(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'learning_enabled')
        .single();

      if (error || !data) {
        return false;
      }

      return data.value === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get learning sensitivity threshold
   */
  async getLearningThreshold(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'learning_sensitivity')
        .single();

      if (error || !data) {
        return 0.8; // Default threshold
      }

      return parseFloat(data.value) || 0.8;
    } catch (error) {
      return 0.8;
    }
  }

  /**
   * Comprehensive learning analysis for a posted tweet
   */
  async performComprehensiveLearning(
    tweetId: string,
    content: string,
    contentType: string,
    expertiseDomain: string,
    engagementMetrics: {
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
    }
  ): Promise<void> {
    try {
      if (!(await this.isLearningEnabled())) {
        return;
      }

      const engagementRate = engagementMetrics.impressions > 0 
        ? ((engagementMetrics.likes + engagementMetrics.retweets + engagementMetrics.replies) / engagementMetrics.impressions) * 100 
        : 0;

      // 1. Capture tweet metrics
      await this.captureTweetMetrics(
        tweetId,
        engagementMetrics.likes,
        engagementMetrics.retweets,
        engagementMetrics.replies,
        engagementMetrics.impressions
      );

      // 2. Perform semantic analysis
      await this.analyzeContentSemantically({
        tweet_id: tweetId,
        content,
        semantic_themes: [expertiseDomain, contentType],
        expertise_level: 5, // Will be determined by AI analysis later
        technical_depth: 5, // Will be determined by AI analysis later
        novelty_score: 0.5, // Will be determined by AI analysis later
        performance_metrics: {
          ...engagementMetrics,
          engagement_rate: engagementRate
        }
      });

      // 3. Update expertise if performance meets threshold
      const threshold = await this.getLearningThreshold();
      if (engagementRate > threshold) {
        await this.updateExpertiseLevel(
          expertiseDomain,
          { engagement_boost: engagementRate },
          { tweet_id: tweetId, content_type: contentType, depth_score: 5 }
        );
      }

      // 4. Detect patterns for high-performing content
      if (engagementRate > 5.0) { // 5% engagement rate
        await this.detectContentPattern(
          {
            structure_type: contentType,
            primary_theme: expertiseDomain,
            engagement_hook_type: 'unknown' // Will be analyzed later
          },
          {
            engagement_rate: engagementRate / 100, // Convert to decimal
            total_engagement: engagementMetrics.likes + engagementMetrics.retweets + engagementMetrics.replies
          }
        );
      }

      // 5. Record learning feedback
      await this.recordLearningFeedback(
        'tweet_posted',
        { tweet_id: tweetId, content_type: contentType, domain: expertiseDomain },
        { analysis_performed: true, metrics_captured: true },
        'content_analysis',
        { engagement_rate: engagementRate, learning_triggered: engagementRate > threshold }
      );

      console.log('🎓 Comprehensive learning complete:', {
        tweet_id: tweetId,
        domain: expertiseDomain,
        engagement_rate: engagementRate,
        learning_triggered: engagementRate > threshold
      });

    } catch (error) {
      console.error('💥 Comprehensive learning error:', error.message, tweetId);
    }
  }

  /**
   * Get intelligence summary for dashboard
   */
  async getIntelligenceSummary(): Promise<any> {
    try {
      const [expertise, patterns, recentLearning] = await Promise.all([
        this.getCurrentExpertise(),
        this.getSuccessfulPatterns(0.6),
        supabase
          .from('learning_feedback_loop')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      return {
        expertise_domains: expertise.length,
        avg_expertise_level: expertise.reduce((acc, e) => acc + e.expertise_level, 0) / Math.max(expertise.length, 1),
        successful_patterns: patterns.length,
        recent_learning_events: recentLearning.data?.length || 0,
        top_expertise: expertise.slice(0, 3),
        top_patterns: patterns.slice(0, 3),
        learning_enabled: await this.isLearningEnabled()
      };
    } catch (error) {
      console.error('💥 Intelligence summary error:', error.message);
      return {
        expertise_domains: 0,
        avg_expertise_level: 0,
        successful_patterns: 0,
        recent_learning_events: 0,
        learning_enabled: false,
        error: error.message
      };
    }
  }
}

export const intelligentLearning = IntelligentLearningConnector.getInstance(); 