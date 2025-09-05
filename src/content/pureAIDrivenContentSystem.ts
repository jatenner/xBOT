/**
 * 🤖 PURE AI-DRIVEN CONTENT SYSTEM
 * 
 * ZERO hardcoded content, templates, or fixed patterns.
 * All content generated through sophisticated AI prompting only.
 */

import { OpenAI } from 'openai';
import { getSupabaseClient } from '../db/index';

export interface PureAIContentRequest {
  contentType: 'single_tweet' | 'thread' | 'reply';
  context?: {
    replyingTo?: string;
    currentTrends?: string[];
    recentTopics?: string[];
    audienceInsights?: string[];
  };
  constraints?: {
    maxLength?: number;
    mustAvoidTopics?: string[];
    targetEngagement?: 'viral' | 'educational' | 'conversational';
  };
}

export interface PureAIContentResult {
  content: string | string[];
  contentType: 'single' | 'thread';
  aiReasoning: string;
  uniquenessScore: number;
  expectedPerformance: {
    viralPotential: number;
    engagementPrediction: number;
    audienceMatch: number;
  };
}

export class PureAIDrivenContentSystem {
  private static instance: PureAIDrivenContentSystem;
  private openai: OpenAI;
  
  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public static getInstance(): PureAIDrivenContentSystem {
    if (!PureAIDrivenContentSystem.instance) {
      PureAIDrivenContentSystem.instance = new PureAIDrivenContentSystem();
    }
    return PureAIDrivenContentSystem.instance;
  }

  /**
   * 🎯 GENERATE PURE AI CONTENT - No templates, no hardcoded patterns
   */
  public async generatePureAIContent(request: PureAIContentRequest): Promise<PureAIContentResult> {
    console.log('🤖 PURE_AI_GENERATION: Starting 100% AI-driven content creation...');

    try {
      // Build dynamic, context-aware prompt
      const aiPrompt = await this.buildIntelligentPrompt(request);
      
      // Generate content using advanced AI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemInstructions()
          },
          {
            role: 'user', 
            content: aiPrompt
          }
        ],
        max_tokens: request.contentType === 'thread' ? 800 : 300,
        temperature: 0.85, // High creativity
        top_p: 0.9,
        frequency_penalty: 0.5, // Reduce repetition
        presence_penalty: 0.3, // Encourage novel content
        response_format: { type: "json_object" }
      });

      const rawResponse = response.choices?.[0]?.message?.content;
      if (!rawResponse) {
        throw new Error('Empty AI response');
      }

      const aiResult = JSON.parse(rawResponse);
      
      // Validate and process AI response
      const processedResult = await this.processAIResponse(aiResult, request);
      
      console.log(`✅ PURE_AI_SUCCESS: Generated ${processedResult.contentType} with ${processedResult.uniquenessScore}% uniqueness`);
      console.log(`🎯 AI_REASONING: ${processedResult.aiReasoning.substring(0, 100)}...`);
      
      return processedResult;

    } catch (error: any) {
      console.error('❌ PURE_AI_GENERATION_FAILED:', error.message);
      throw new Error(`Pure AI content generation failed: ${error.message}`);
    }
  }

  /**
   * 🧠 BUILD INTELLIGENT PROMPT - Dynamic, context-aware, no templates
   */
  private async buildIntelligentPrompt(request: PureAIContentRequest): Promise<string> {
    // Get real context data
    const contextData = await this.gatherRealContext(request.context);
    
    const prompt = `You are an expert health content creator with deep knowledge across nutrition, fitness, biohacking, longevity, and wellness science.

OBJECTIVE: Create ${request.contentType} content that is:
- 100% original and unique (no recycled ideas)
- Scientifically accurate and actionable
- Engaging and conversation-starting
- Authentic human voice (not AI-sounding)

REAL CONTEXT DATA:
${contextData.recentPerformance ? `Recent high-performing content patterns: ${contextData.recentPerformance}` : ''}
${contextData.trendingTopics ? `Current health trends: ${contextData.trendingTopics.join(', ')}` : ''}
${contextData.audienceInsights ? `Audience insights: ${contextData.audienceInsights.join(', ')}` : ''}
${contextData.avoidanceTopics ? `Must avoid (overused): ${contextData.avoidanceTopics.join(', ')}` : ''}

CONTENT REQUIREMENTS:
- ${request.contentType === 'thread' ? '3-6 tweets in a cohesive thread' : 'Single tweet, 150-280 characters'}
- Include specific, verifiable details (studies, numbers, mechanisms)
- Create curiosity without clickbait
- Encourage meaningful engagement
- Sound like a knowledgeable human, not an AI

TARGET ENGAGEMENT: ${request.constraints?.targetEngagement || 'educational'}

CRITICAL: Do not use any common health content formulas, templates, or repeated phrases. Generate completely fresh angles and perspectives.

Respond with JSON format:
{
  "content": ${request.contentType === 'thread' ? '["tweet1", "tweet2", "tweet3"]' : '"single tweet content"'},
  "reasoning": "Why this angle is unique and engaging",
  "topicCategory": "specific health domain",
  "uniquenessFactors": ["what makes this content different"],
  "expectedOutcomes": {
    "viralPotential": 1-100,
    "educationalValue": 1-100,
    "engagementLikelihood": 1-100
  }
}`;

    return prompt;
  }

  /**
   * 📊 GATHER REAL CONTEXT DATA - No fake data allowed
   */
  private async gatherRealContext(context?: PureAIContentRequest['context']): Promise<{
    recentPerformance?: string;
    trendingTopics?: string[];
    audienceInsights?: string[];
    avoidanceTopics?: string[];
  }> {
    try {
      const supabase = getSupabaseClient();
      
      // Get real performance data from recent posts
      const { data: recentPosts } = await supabase
        .from('unified_posts')
        .select('content, viralScore, engagementPrediction')
        .order('createdAt', { ascending: false })
        .limit(10);

      // Get real metrics from metrics table
      const { data: realMetrics } = await supabase
        .from('real_tweet_metrics')
        .select('content_preview, likes, retweets, engagement_rate')
        .order('collected_at', { ascending: false })
        .limit(5);

      // Analyze real performance patterns
      let recentPerformance;
      if (realMetrics && realMetrics.length > 0) {
        const topPerformer = realMetrics.reduce((best, current) => 
          (current.engagement_rate || 0) > (best.engagement_rate || 0) ? current : best
        );
        recentPerformance = `Top performer: "${topPerformer.content_preview}" (${((topPerformer.engagement_rate as number) * 100).toFixed(1)}% engagement)`;
      }

      // Extract topics to avoid (from recent posts)
      const avoidanceTopics: string[] = [];
      if (recentPosts && recentPosts.length > 0) {
        // Simple topic extraction from recent content
        const recentContent = recentPosts.map(p => p.content).join(' ').toLowerCase();
        const commonWords = ['health', 'nutrition', 'sleep', 'exercise', 'metabolism', 'vitamin', 'supplement'];
        
        for (const word of commonWords) {
          const occurrences = (recentContent.match(new RegExp(word, 'g')) || []).length;
          if (occurrences >= 3) {
            avoidanceTopics.push(word);
          }
        }
      }

      return {
        recentPerformance,
        trendingTopics: context?.currentTrends || [],
        audienceInsights: context?.audienceInsights || [],
        avoidanceTopics
      };

    } catch (error: any) {
      console.warn('⚠️ CONTEXT_GATHERING_FAILED:', error.message);
      return {};
    }
  }

  /**
   * 🤖 SYSTEM INSTRUCTIONS - Dynamic AI behavior
   */
  private getSystemInstructions(): string {
    return `You are a health content expert who creates original, engaging content.

NEVER use these overused patterns:
- "Most people don't know..."
- "Here's what actually works..."
- "The truth about..."
- "What [industry] doesn't want you to know..."
- Generic numbered lists without specific insights

ALWAYS:
- Create completely original angles and perspectives
- Include specific, actionable details
- Reference real science when relevant
- Sound conversational and authentic
- Avoid AI-like phrasing and structure

Your content should feel like it comes from a knowledgeable friend sharing genuinely useful insights, not a content marketing template.`;
  }

  /**
   * ⚗️ PROCESS AI RESPONSE - Validate and enhance
   */
  private async processAIResponse(aiResult: any, request: PureAIContentRequest): Promise<PureAIContentResult> {
    // Validate AI response structure
    if (!aiResult.content || !aiResult.reasoning) {
      throw new Error('Invalid AI response structure');
    }

    // Calculate uniqueness score
    const uniquenessScore = await this.calculateUniquenessScore(aiResult.content, aiResult.uniquenessFactors);

    // Process content based on type
    let processedContent: string | string[];
    let contentType: 'single' | 'thread';

    if (request.contentType === 'thread' && Array.isArray(aiResult.content)) {
      processedContent = aiResult.content;
      contentType = 'thread';
    } else {
      processedContent = Array.isArray(aiResult.content) ? aiResult.content[0] : aiResult.content;
      contentType = 'single';
    }

    return {
      content: processedContent,
      contentType,
      aiReasoning: aiResult.reasoning,
      uniquenessScore,
      expectedPerformance: {
        viralPotential: aiResult.expectedOutcomes?.viralPotential || 50,
        engagementPrediction: aiResult.expectedOutcomes?.engagementLikelihood || 50,
        audienceMatch: aiResult.expectedOutcomes?.educationalValue || 50
      }
    };
  }

  /**
   * 📊 CALCULATE UNIQUENESS SCORE - Ensure content is original
   */
  private async calculateUniquenessScore(content: string | string[], uniquenessFactors: string[]): Promise<number> {
    try {
      const supabase = getSupabaseClient();
      
      // Get recent content to compare against
      const { data: recentContent } = await supabase
        .from('unified_posts')
        .select('content')
        .order('createdAt', { ascending: false })
        .limit(50);

      if (!recentContent || recentContent.length === 0) {
        return 95; // High uniqueness if no comparison data
      }

      const contentString = Array.isArray(content) ? content.join(' ') : content;
      let uniquenessScore = 85; // Start with high baseline

      // Check against recent content for similarity
      for (const recent of recentContent) {
        const similarity = this.calculateSimilarity(contentString.toLowerCase(), (recent.content as string).toLowerCase());
        if (similarity > 0.7) {
          uniquenessScore -= 30; // Heavy penalty for high similarity
        } else if (similarity > 0.5) {
          uniquenessScore -= 15; // Moderate penalty
        } else if (similarity > 0.3) {
          uniquenessScore -= 5; // Small penalty
        }
      }

      // Bonus points for uniqueness factors
      if (uniquenessFactors && uniquenessFactors.length > 0) {
        uniquenessScore += Math.min(uniquenessFactors.length * 3, 15);
      }

      return Math.max(Math.min(uniquenessScore, 100), 0);

    } catch (error: any) {
      console.warn('⚠️ UNIQUENESS_CALCULATION_FAILED:', error.message);
      return 75; // Default moderate uniqueness
    }
  }

  /**
   * 🔍 CALCULATE SIMILARITY - Simple similarity check
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ').filter(w => w.length > 3);
    const words2 = str2.split(' ').filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * 📈 GET GENERATION STATS
   */
  public async getGenerationStats(): Promise<{
    totalGenerated: number;
    averageUniqueness: number;
    topPerformingPattern: string;
  }> {
    try {
      const supabase = getSupabaseClient();
      
      const { data: posts } = await supabase
        .from('unified_posts')
        .select('content, uniquenessScore, viralScore')
        .order('createdAt', { ascending: false })
        .limit(100);

      if (!posts || posts.length === 0) {
        return {
          totalGenerated: 0,
          averageUniqueness: 0,
          topPerformingPattern: 'Insufficient data'
        };
      }

      const avgUniqueness = posts.reduce((sum, p) => sum + ((p.uniquenessScore as number) || 0), 0) / posts.length;
      const topPerformer = posts.reduce((best, current) => 
        (current.viralScore || 0) > (best.viralScore || 0) ? current : best
      );

      return {
        totalGenerated: posts.length,
        averageUniqueness: Math.round(avgUniqueness),
        topPerformingPattern: (topPerformer.content as string).substring(0, 80) + '...'
      };

    } catch (error: any) {
      console.error('❌ STATS_RETRIEVAL_FAILED:', error.message);
      return {
        totalGenerated: 0,
        averageUniqueness: 0,
        topPerformingPattern: 'Error retrieving stats'
      };
    }
  }
}

// Export singleton
export const pureAIDrivenContentSystem = PureAIDrivenContentSystem.getInstance();
