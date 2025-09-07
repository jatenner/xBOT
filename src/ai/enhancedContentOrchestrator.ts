/**
 * 🎼 ENHANCED CONTENT ORCHESTRATOR
 * 
 * Orchestrates the new AI-driven content generation system
 * - Combines human voice, diverse content, and data-driven learning
 * - Eliminates hashtags and corporate language
 * - Creates authentic, varied, high-performing content
 * - Continuously learns and adapts from engagement data
 */

import { HumanVoiceEngine } from './humanVoiceEngine';
import { DiverseContentGenerator } from './diverseContentGenerator';
import { DataDrivenLearner } from './dataDrivenLearner';
import { OpenAI } from 'openai';

interface EnhancedContentRequest {
  format: 'single' | 'thread';
  topic?: string;
  target_engagement?: 'high' | 'medium' | 'steady';
  avoid_recent_patterns?: boolean;
  user_context?: string;
  preferred_content_type?: string;
  preferred_voice_style?: string;
}

interface EnhancedContentResult {
  content: string;
  metadata: {
    content_type: string;
    voice_style: string;
    topic_source: string;
    human_voice_score: number;
    diversity_score: number;
    learning_applied: string[];
    predicted_performance: {
      engagement_rate: number;
      follower_potential: number;
      viral_score: number;
      authenticity_score: number;
    };
  };
  recommendations: {
    optimal_posting_time: number;
    follow_up_content_suggestions: string[];
    performance_predictions: string[];
  };
  ai_prediction?: {
    expected_engagement: number;
    expected_followers: number;
    confidence_score: number;
  };
}

export class EnhancedContentOrchestrator {
  private static instance: EnhancedContentOrchestrator;
  private humanVoice: HumanVoiceEngine;
  private diverseContent: DiverseContentGenerator;
  private dataLearner: DataDrivenLearner;
  private openai: OpenAI;

  private constructor() {
    this.humanVoice = HumanVoiceEngine.getInstance();
    this.diverseContent = DiverseContentGenerator.getInstance();
    this.dataLearner = DataDrivenLearner.getInstance();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
  }

  public static getInstance(): EnhancedContentOrchestrator {
    if (!EnhancedContentOrchestrator.instance) {
      EnhancedContentOrchestrator.instance = new EnhancedContentOrchestrator();
    }
    return EnhancedContentOrchestrator.instance;
  }

  /**
   * 🎯 Generate enhanced content using all AI systems
   */
  public async generateEnhancedContent(request: EnhancedContentRequest): Promise<EnhancedContentResult> {
    console.log(`🎼 ENHANCED_ORCHESTRATOR: Generating ${request.format} content with advanced AI systems`);

    try {
      // Step 1: Get learning-based recommendations
      const learningRecommendations = await this.dataLearner.getLearningRecommendations();
      console.log(`🧠 Applied ${learningRecommendations.amplify_patterns.length} learning patterns`);

      // Step 2: Generate diverse content with human voice
      const diverseResult = await this.diverseContent.generateDiverseContent({
        format: request.format,
        avoid_recent_patterns: request.avoid_recent_patterns !== false,
        target_engagement: request.target_engagement || 'medium'
      });

      // Step 3: Apply learning insights to content
      const optimizedContent = await this.applyLearningInsights(
        diverseResult.content,
        learningRecommendations
      );

      // Step 4: Validate and enhance content quality
      const validatedContent = await this.validateAndEnhanceContent(optimizedContent);

      // Step 5: Generate recommendations
      const recommendations = this.generateContentRecommendations(
        diverseResult,
        learningRecommendations
      );

      const result: EnhancedContentResult = {
        content: validatedContent,
        metadata: {
          content_type: diverseResult.content_type,
          voice_style: 'human_authentic', // From human voice engine
          topic_source: diverseResult.topic_source,
          human_voice_score: diverseResult.human_voice_score,
          diversity_score: diverseResult.diversity_score,
          learning_applied: learningRecommendations.amplify_patterns.slice(0, 3),
          predicted_performance: {
            engagement_rate: diverseResult.predicted_performance.engagement_rate,
            follower_potential: diverseResult.predicted_performance.follower_potential,
            viral_score: diverseResult.predicted_performance.viral_score,
            authenticity_score: diverseResult.human_voice_score
          }
        },
        recommendations
      };

      console.log(`✅ ENHANCED_ORCHESTRATOR: Generated content with ${result.metadata.human_voice_score}% authenticity`);
      console.log(`🎯 Predicted: ${result.metadata.predicted_performance.engagement_rate}% engagement, +${result.metadata.predicted_performance.follower_potential} followers`);

      return result;

    } catch (error) {
      console.error('❌ ENHANCED_ORCHESTRATOR_ERROR:', error);
      throw new Error(`Enhanced content generation failed: ${error}`);
    }
  }

  /**
   * 🧠 Apply learning insights to improve content
   */
  private async applyLearningInsights(
    content: string, 
    recommendations: any
  ): Promise<string> {
    const appliedContent = content;

    // Remove any patterns that should be avoided
    let optimizedContent = appliedContent;
    for (const avoidPattern of recommendations.avoid_patterns.slice(0, 5)) {
      // Simple pattern replacement - could be enhanced with more sophisticated NLP
      if (optimizedContent.toLowerCase().includes(avoidPattern.toLowerCase())) {
        console.log(`🚫 LEARNING: Detected avoid pattern "${avoidPattern}" - content needs revision`);
        // Trigger content regeneration if bad patterns detected
        return this.regenerateContentWithoutPattern(optimizedContent, avoidPattern);
      }
    }

    return optimizedContent;
  }

  /**
   * 🔄 Regenerate content without bad patterns
   */
  private async regenerateContentWithoutPattern(content: string, badPattern: string): Promise<string> {
    const improvementPrompt = `Improve this content by removing the pattern "${badPattern}" and making it more authentic and engaging:

Original content: "${content}"

Requirements:
- Remove any traces of the bad pattern: "${badPattern}"
- Keep the core message and value
- Make it sound more human and conversational
- NO hashtags, NO corporate language
- Maintain authenticity and personal touch

Return only the improved content:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at making content sound authentic and human. Remove corporate patterns while keeping the value.'
          },
          {
            role: 'user',
            content: improvementPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const improvedContent = response.choices[0]?.message?.content || content;
      console.log(`✅ LEARNING: Improved content by removing bad pattern`);
      return improvedContent;

    } catch (error) {
      console.warn('⚠️ LEARNING: Content improvement failed, using original');
      return content;
    }
  }

  /**
   * ✅ Validate and enhance content quality
   */
  private async validateAndEnhanceContent(content: string): Promise<string> {
    // Check for banned patterns
    const bannedPatterns = [
      /#\w+/, // hashtags
      /dive deep/i,
      /let's explore/i,
      /game.?changer/i,
      /life.?hack/i,
      /journey to/i,
      /boost.*energy.*focus/i,
      /many people struggle/i
    ];

    let validatedContent = content;
    let hasIssues = false;

    for (const pattern of bannedPatterns) {
      if (pattern.test(validatedContent)) {
        hasIssues = true;
        console.log(`🚫 VALIDATION: Found banned pattern: ${pattern}`);
      }
    }

    // If issues found, clean up the content
    if (hasIssues) {
      validatedContent = await this.cleanupContent(validatedContent);
    }

    // Ensure no hashtags
    validatedContent = validatedContent.replace(/#\w+/g, '').trim();

    // Clean up extra spaces
    validatedContent = validatedContent.replace(/\s+/g, ' ').trim();

    return validatedContent;
  }

  /**
   * 🧹 Clean up content to remove corporate/AI language
   */
  private async cleanupContent(content: string): Promise<string> {
    const cleanupPrompt = `Make this content sound more human and authentic by removing any corporate or AI-like language:

"${content}"

Remove:
- Any hashtags
- Corporate phrases like "dive deep", "game-changer", "boost energy"
- AI tells like "let's explore"
- Generic advice that sounds robotic

Keep:
- The core value and insight
- Personal, conversational tone
- Specific, actionable information
- Natural human voice

Return only the cleaned content:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at making content sound authentic and human, removing all corporate or AI language patterns.'
          },
          {
            role: 'user',
            content: cleanupPrompt
          }
        ],
        temperature: 0.6,
        max_tokens: 300
      });

      const cleanedContent = response.choices[0]?.message?.content || content;
      console.log(`🧹 VALIDATION: Cleaned up content for authenticity`);
      return cleanedContent;

    } catch (error) {
      console.warn('⚠️ VALIDATION: Content cleanup failed');
      return content.replace(/#\w+/g, '').trim(); // At minimum remove hashtags
    }
  }

  /**
   * 📊 Generate content recommendations
   */
  private generateContentRecommendations(
    diverseResult: any,
    learningRecommendations: any
  ): any {
    const currentHour = new Date().getHours();
    
    // Find optimal posting time from learning data
    const optimalTime = learningRecommendations.optimal_posting_strategy.best_times
      .find((hour: number) => hour > currentHour) || 
      learningRecommendations.optimal_posting_strategy.best_times[0];

    // Generate follow-up content suggestions
    const followUpSuggestions = [
      `Continue with ${diverseResult.content_type} style content`,
      `Try counterintuitive insights about related topics`,
      `Share personal experiments in this area`
    ];

    // Generate performance predictions
    const performancePredictions = [
      `Expected ${diverseResult.predicted_performance.engagement_rate}% engagement rate`,
      `Potential for ${diverseResult.predicted_performance.follower_potential} new followers`,
      `${diverseResult.predicted_performance.viral_score}% viral potential based on patterns`
    ];

    return {
      optimal_posting_time: optimalTime,
      follow_up_content_suggestions: followUpSuggestions,
      performance_predictions: performancePredictions
    };
  }

  /**
   * 📈 Record performance for continuous learning
   */
  public async recordContentPerformance(
    content: string,
    metadata: any,
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
      followers_gained: number;
    }
  ): Promise<void> {
    console.log('📈 ENHANCED_ORCHESTRATOR: Recording performance for learning systems...');

    try {
      // Record performance in all learning systems
      await Promise.all([
        this.humanVoice.recordPerformance(content, engagement),
        this.diverseContent.recordContentPerformance(
          metadata.content_type,
          metadata.topic_source,
          engagement
        ),
        this.dataLearner.analyzePerformanceAndLearn({
          content,
          engagement,
          post_time: new Date().toISOString(),
          content_type: metadata.content_type
        })
      ]);

      console.log('✅ ENHANCED_ORCHESTRATOR: Performance recorded across all learning systems');
    } catch (error) {
      console.warn('⚠️ ENHANCED_ORCHESTRATOR: Failed to record performance:', error);
    }
  }

  /**
   * 📊 Get comprehensive performance insights
   */
  public async getPerformanceInsights(): Promise<{
    voice_patterns: any;
    content_diversity: any;
    learning_recommendations: any;
  }> {
    try {
      const [diversityStats, learningRecommendations] = await Promise.all([
        this.diverseContent.getDiversityStats(),
        this.dataLearner.getLearningRecommendations()
      ]);

      return {
        voice_patterns: {
          authenticity_trend: 'improving', // Could be calculated from recent posts
          most_successful_styles: ['personal_discovery', 'counterintuitive_insight']
        },
        content_diversity: diversityStats,
        learning_recommendations: learningRecommendations
      };
    } catch (error) {
      console.warn('⚠️ ENHANCED_ORCHESTRATOR: Failed to get insights:', error);
      return {
        voice_patterns: { authenticity_trend: 'stable', most_successful_styles: [] },
        content_diversity: { total_content_types: 0, recent_diversity_score: 0, most_used_type: 'none', least_used_type: 'none' },
        learning_recommendations: { amplify_patterns: [], avoid_patterns: [], experiment_patterns: [], optimal_posting_strategy: {} }
      };
    }
  }

  /**
   * 🎯 Generate content with specific style override
   */
  public async generateTargetedContent(params: {
    style: 'personal_discovery' | 'counterintuitive_insight' | 'practical_experiment' | 'curious_observation';
    topic: string;
    format: 'single' | 'thread';
  }): Promise<string> {
    console.log(`🎯 ENHANCED_ORCHESTRATOR: Generating targeted ${params.style} content`);

    const targetedResult = await this.humanVoice.generateHumanContent({
      topic: params.topic,
      format: params.format,
      context: `Use ${params.style} style with authentic human voice`
    });

    const cleanedContent = await this.validateAndEnhanceContent(targetedResult.content);
    
    console.log(`✅ ENHANCED_ORCHESTRATOR: Generated targeted content with ${targetedResult.authenticity_score}% authenticity`);
    return cleanedContent;
  }
}
