/**
 * Intelligent Prompt Orchestrator - Sophisticated AI system with learning loops
 * Integrates all systems: learning data, engagement patterns, user behavior, trending topics
 */

import OpenAI from 'openai';
import AdvancedPromptEngine from './advancedPrompts';

export interface LearningContext {
  recentPosts: Array<{
    content: string;
    engagement: { likes: number; retweets: number; replies: number; impressions: number };
    posted_at: string;
    quality_score?: number;
  }>;
  topPerformingContent: Array<{
    content: string;
    engagement_rate: number;
    viral_score: number;
    why_it_worked: string;
  }>;
  failedContent: Array<{
    content: string;
    engagement_rate: number;
    why_it_failed: string;
  }>;
  audienceInsights: {
    peak_engagement_hours: number[];
    preferred_content_types: string[];
    response_patterns: string[];
    demographic_data?: any;
  };
  competitorAnalysis: {
    trending_topics: string[];
    viral_patterns: string[];
    content_gaps: string[];
  };
  currentTrends: {
    health_topics: string[];
    social_trends: string[];
    news_events: string[];
  };
}

export interface SystemContext {
  time_of_day: string;
  day_of_week: string;
  recent_system_performance: {
    posting_success_rate: number;
    thread_success_rate: number;
    reply_success_rate: number;
  };
  current_strategy: string;
  growth_metrics: {
    follower_growth_rate: number;
    engagement_trend: 'increasing' | 'stable' | 'decreasing';
    content_performance_trend: string;
  };
}

export class IntelligentPromptOrchestrator {
  private static instance: IntelligentPromptOrchestrator;
  private learningMemory: Map<string, any> = new Map();
  private contextualPatterns: Map<string, number> = new Map();

  static getInstance(): IntelligentPromptOrchestrator {
    if (!this.instance) {
      this.instance = new IntelligentPromptOrchestrator();
    }
    return this.instance;
  }

  /**
   * Generate sophisticated prompts with full system integration
   */
  async generateIntelligentPrompt(
    openai: OpenAI,
    intent: 'viral_post' | 'strategic_reply' | 'thread_starter' | 'follow_up',
    learningContext: LearningContext,
    systemContext: SystemContext,
    specificContext?: any
  ): Promise<string> {
    console.log(`🧠 INTELLIGENT_ORCHESTRATOR: Generating ${intent} with full system integration`);

    // Analyze learning patterns
    const learningInsights = this.analyzeLearningPatterns(learningContext);
    
    // Generate context-aware system prompt
    const systemPrompt = this.buildSophisticatedSystemPrompt(learningInsights, systemContext);
    
    // Generate content-specific prompt
    const contentPrompt = this.buildContentSpecificPrompt(intent, learningContext, specificContext);
    
    // Add real-time optimization instructions
    const optimizationPrompt = this.buildOptimizationInstructions(learningContext, systemContext);

    const fullPrompt = `${systemPrompt}\n\n${contentPrompt}\n\n${optimizationPrompt}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an elite AI content strategist with access to real-time learning data and audience insights. Use this data to create viral, high-performing content.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 400,
        temperature: this.calculateOptimalTemperature(learningContext),
        top_p: 0.92,
        frequency_penalty: this.calculateFrequencyPenalty(learningContext),
        presence_penalty: this.calculatePresencePenalty(systemContext),
        // Add reasoning for better quality
        response_format: { type: "text" }
      });

      const content = response.choices?.[0]?.message?.content?.trim() || '';
      
      if (content) {
        // Store learning data for future optimization
        this.updateLearningMemory(intent, content, learningContext);
        
        console.log(`🎯 INTELLIGENT_SUCCESS: Generated ${intent} with learning integration`);
        console.log(`📊 LEARNING_FACTORS: ${learningInsights.key_insights.slice(0, 2).join(', ')}`);
        return content;
      }

      throw new Error('Empty intelligent response');
      
    } catch (error: any) {
      console.error(`❌ INTELLIGENT_GENERATION_FAILED (${intent}):`, error.message);
      throw error;
    }
  }

  /**
   * Analyze learning patterns from historical data
   */
  private analyzeLearningPatterns(context: LearningContext): any {
    const insights: any = {
      key_insights: [],
      content_patterns: [],
      engagement_drivers: [],
      failure_patterns: [],
      optimal_timing: [],
      audience_preferences: []
    };

    // Analyze top-performing content
    if (context.topPerformingContent.length > 0) {
      const avgEngagement = context.topPerformingContent.reduce((sum, post) => sum + post.engagement_rate, 0) / context.topPerformingContent.length;
      const topTopics = context.topPerformingContent.map(post => this.extractTopics(post.content)).flat();
      const commonWords = this.findCommonWords(context.topPerformingContent.map(post => post.content));

      insights.key_insights.push(`Top content averages ${(avgEngagement * 100).toFixed(1)}% engagement`);
      insights.content_patterns.push(`Successful topics: ${[...new Set(topTopics)].slice(0, 3).join(', ')}`);
      insights.engagement_drivers.push(`High-performing words: ${commonWords.slice(0, 5).join(', ')}`);
    }

    // Analyze failed content patterns
    if (context.failedContent.length > 0) {
      const failureReasons = context.failedContent.map(post => post.why_it_failed);
      const commonFailures = this.findCommonPatterns(failureReasons);
      insights.failure_patterns.push(`Avoid: ${commonFailures.slice(0, 3).join(', ')}`);
    }

    // Analyze audience insights
    if (context.audienceInsights.peak_engagement_hours.length > 0) {
      insights.optimal_timing.push(`Peak hours: ${context.audienceInsights.peak_engagement_hours.join(', ')}`);
    }

    if (context.audienceInsights.preferred_content_types.length > 0) {
      insights.audience_preferences.push(`Prefers: ${context.audienceInsights.preferred_content_types.join(', ')}`);
    }

    // Analyze competitor trends
    if (context.competitorAnalysis.trending_topics.length > 0) {
      insights.key_insights.push(`Trending: ${context.competitorAnalysis.trending_topics.slice(0, 3).join(', ')}`);
    }

    return insights;
  }

  /**
   * Build sophisticated system prompt with learning integration
   */
  private buildSophisticatedSystemPrompt(learningInsights: any, systemContext: SystemContext): string {
    return `🧠 ADVANCED AI SYSTEM PROMPT - LEARNING INTEGRATION ACTIVE

IDENTITY: You are Dr. Sarah Chen, elite biohacker and content strategist with access to:
- Real-time audience engagement data
- Historical content performance analytics  
- Competitor intelligence
- Trending topic analysis
- Behavioral learning patterns

CURRENT SYSTEM STATUS:
- Time: ${systemContext.time_of_day}, ${systemContext.day_of_week}
- Posting Success Rate: ${(systemContext.recent_system_performance.posting_success_rate * 100).toFixed(1)}%
- Growth Trend: ${systemContext.growth_metrics.engagement_trend}
- Current Strategy: ${systemContext.current_strategy}

LEARNING INSIGHTS FROM YOUR DATA:
${learningInsights.key_insights.map((insight: string, i: number) => `${i + 1}. ${insight}`).join('\n')}

PROVEN ENGAGEMENT DRIVERS:
${learningInsights.engagement_drivers.join('\n')}

PATTERNS TO AVOID (Based on Failed Content):
${learningInsights.failure_patterns.join('\n')}

AUDIENCE INTELLIGENCE:
${learningInsights.audience_preferences.join('\n')}
${learningInsights.optimal_timing.join('\n')}`;
  }

  /**
   * Build content-specific prompt based on intent
   */
  private buildContentSpecificPrompt(intent: string, context: LearningContext, specificContext?: any): string {
    const basePrompts = {
      viral_post: `VIRAL POST GENERATION:
Using your learning data, create a post optimized for maximum engagement.

VIRAL FORMULA (Based on Your Top Performers):
- Hook: Use patterns that worked in your best content
- Content: Apply insights from high-engagement posts
- CTA: Based on audience response patterns

AVOID: Patterns that led to low engagement in your failed posts`,

      strategic_reply: `STRATEGIC REPLY GENERATION:
Replying to: "${specificContext?.originalPost || 'N/A'}"

REPLY STRATEGY (Based on Your Data):
- Add unique value using your proven content patterns
- Use language patterns from your top-performing content
- Apply insights about what your audience responds to best`,

      thread_starter: `THREAD STARTER GENERATION:
Topic: ${specificContext?.topic || 'Health optimization'}

THREAD STRATEGY (Learning-Optimized):
- Hook: Use your most successful attention-grabbing patterns
- Promise: Based on content types your audience prefers most
- Structure: Apply proven thread formats from your data`,

      follow_up: `FOLLOW-UP CONTENT GENERATION:
Previous post: "${specificContext?.previousPost || 'N/A'}"

FOLLOW-UP STRATEGY:
- Build on successful content patterns
- Extend topics that performed well
- Use engagement-driven continuation techniques`
    };

    return basePrompts[intent as keyof typeof basePrompts] || basePrompts.viral_post;
  }

  /**
   * Build optimization instructions based on real-time data
   */
  private buildOptimizationInstructions(context: LearningContext, systemContext: SystemContext): string {
    let instructions = `🎯 REAL-TIME OPTIMIZATION INSTRUCTIONS:

CURRENT TRENDS TO LEVERAGE:
${context.currentTrends.health_topics.slice(0, 3).map(topic => `- ${topic}`).join('\n')}

COMPETITOR ANALYSIS:
- Content Gaps to Fill: ${context.competitorAnalysis.content_gaps.slice(0, 2).join(', ')}
- Viral Patterns to Adapt: ${context.competitorAnalysis.viral_patterns.slice(0, 2).join(', ')}

PERFORMANCE OPTIMIZATION:
- Follower Growth Rate: ${(systemContext.growth_metrics.follower_growth_rate * 100).toFixed(2)}%/day
- Engagement Trend: ${systemContext.growth_metrics.engagement_trend}

OUTPUT REQUIREMENTS:
1. Apply ALL learning insights in your content
2. Use proven patterns from top-performing content
3. Avoid patterns that led to poor engagement
4. Optimize for current trending topics
5. Ensure content is 240 characters or less for posts
6. Include specific, actionable advice with numbers/protocols

LEARNING FEEDBACK LOOP:
This content will be analyzed for performance and fed back into the learning system. Generate content that will improve our overall performance metrics.`;

    return instructions;
  }

  /**
   * Calculate optimal temperature based on learning data
   */
  private calculateOptimalTemperature(context: LearningContext): number {
    // Higher creativity for low-performing periods, more focused for high-performing
    const recentPerformance = context.recentPosts.slice(-5);
    if (recentPerformance.length === 0) return 0.8;

    const avgEngagement = recentPerformance.reduce((sum, post) => {
      const total = post.engagement.likes + post.engagement.retweets + post.engagement.replies;
      return sum + (total / Math.max(post.engagement.impressions, 1));
    }, 0) / recentPerformance.length;

    // Lower temperature (more focused) for high engagement, higher for low engagement
    return avgEngagement > 0.05 ? 0.7 : 0.9;
  }

  /**
   * Calculate frequency penalty based on recent content patterns
   */
  private calculateFrequencyPenalty(context: LearningContext): number {
    // Higher penalty if recent content is repetitive
    const recentContent = context.recentPosts.slice(-10).map(post => post.content).join(' ');
    const words = recentContent.toLowerCase().split(/\s+/);
    const wordCounts = new Map();
    
    words.forEach(word => {
      if (word.length > 4) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });

    const repetitiveWords = Array.from(wordCounts.values()).filter(count => count > 3).length;
    return Math.min(0.8, 0.2 + (repetitiveWords * 0.1));
  }

  /**
   * Calculate presence penalty based on system context
   */
  private calculatePresencePenalty(context: SystemContext): number {
    // Higher penalty for exploration during low-performing periods
    return context.growth_metrics.engagement_trend === 'decreasing' ? 0.4 : 0.2;
  }

  /**
   * Update learning memory for future optimization
   */
  private updateLearningMemory(intent: string, content: string, context: LearningContext): void {
    const memoryKey = `${intent}_${Date.now()}`;
    this.learningMemory.set(memoryKey, {
      content,
      context_snapshot: {
        recent_performance: context.recentPosts.slice(-3),
        trending_topics: context.currentTrends.health_topics.slice(0, 3),
        timestamp: new Date().toISOString()
      }
    });

    // Keep only recent 100 entries
    if (this.learningMemory.size > 100) {
      const oldestKey = Array.from(this.learningMemory.keys())[0];
      this.learningMemory.delete(oldestKey);
    }

    console.log(`📚 LEARNING_MEMORY: Stored ${intent} content for future optimization`);
  }

  /**
   * Helper methods for analysis
   */
  private extractTopics(content: string): string[] {
    const healthTopics = ['sleep', 'diet', 'exercise', 'stress', 'hormone', 'gut', 'brain', 'energy', 'metabolism', 'inflammation'];
    return healthTopics.filter(topic => content.toLowerCase().includes(topic));
  }

  private findCommonWords(contents: string[]): string[] {
    const allWords = contents.join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 4);
    const wordCounts = new Map();
    
    allWords.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private findCommonPatterns(texts: string[]): string[] {
    // Simple pattern detection - could be enhanced with NLP
    const patterns = texts.filter(text => text.length > 10);
    return [...new Set(patterns)].slice(0, 5);
  }
}

export default IntelligentPromptOrchestrator;
