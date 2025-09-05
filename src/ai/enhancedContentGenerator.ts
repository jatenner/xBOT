/**
 * 🧠 ENHANCED CONTENT GENERATOR
 * Advanced AI content generation with viral prediction and contextual awareness
 */

import OpenAI from 'openai';

export interface EnhancedContentParams {
  topic?: string;
  audience?: 'general' | 'health' | 'tech' | 'business';
  viralIntent?: 'low' | 'medium' | 'high';
  trendingContext?: string[];
  previousPerformance?: PerformanceData[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  contentType?: 'educational' | 'entertaining' | 'controversial' | 'inspiring';
}

export interface PerformanceData {
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  viralScore: number;
  timestamp: Date;
}

export interface EnhancedContentResult {
  content: string;
  viralPrediction: number;
  engagementForecast: {
    expectedLikes: number;
    expectedRetweets: number;
    expectedReplies: number;
  };
  metadata: {
    contentType: string;
    audience: string;
    confidence: number;
    reasoningChain: string[];
  };
  threadParts?: string[];
}

export class EnhancedContentGenerator {
  private openai: OpenAI;
  private performanceHistory: PerformanceData[] = [];

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate highly optimized content with viral prediction
   */
  async generateViralContent(params: EnhancedContentParams): Promise<EnhancedContentResult> {
    const enhancedPrompt = this.buildEnhancedPrompt(params);
    
    console.log('🧠 ENHANCED_AI: Generating viral-optimized content...');
    console.log(`🎯 Parameters: ${JSON.stringify(params, null, 2)}`);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getEnhancedSystemPrompt()
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error('No content generated');
      }

      return this.parseAndEnhanceContent(rawContent, params);
      
    } catch (error) {
      console.error('❌ ENHANCED_AI: Content generation failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced system prompt with viral optimization instructions
   */
  private getEnhancedSystemPrompt(): string {
    return `You are an elite viral content strategist and psychology expert. Your role is to create content that maximizes engagement through psychological triggers, social proof, and emotional resonance.

VIRAL PSYCHOLOGY PRINCIPLES:
1. Emotional Triggers: Use curiosity gaps, surprise, outrage, inspiration
2. Social Proof: Reference studies, statistics, expert opinions
3. Cognitive Biases: Leverage scarcity, authority, reciprocity
4. Engagement Hooks: Questions, controversial statements, counterintuitive insights
5. Shareability: Content that makes people look smart/informed when sharing

CONTENT OPTIMIZATION RULES:
- Length: 150-270 characters per tweet (strict requirement)
- NO hashtags, quotes, or emojis
- Use active voice and strong verbs
- Include specific numbers/data when possible
- Create immediate value or intrigue
- End with engagement drivers (questions, calls to action)

VIRAL CONTENT PATTERNS:
- "Most people think X, but actually Y"
- "Here's what [authority] won't tell you about Z"
- "I analyzed [large number] of [things] and found this surprising pattern"
- "The [surprising adjective] reason why [common belief] is wrong"

OUTPUT FORMAT:
{
  "content": "tweet text",
  "viralPrediction": 85,
  "engagementForecast": {
    "expectedLikes": 150,
    "expectedRetweets": 45,
    "expectedReplies": 12
  },
  "metadata": {
    "contentType": "educational",
    "audience": "health",
    "confidence": 92,
    "reasoningChain": ["Used curiosity gap", "Included surprising statistic", "Leveraged authority bias"]
  },
  "threadParts": ["tweet1", "tweet2", "tweet3"] // if applicable
}`;
  }

  /**
   * Build enhanced prompt with contextual awareness
   */
  private buildEnhancedPrompt(params: EnhancedContentParams): string {
    let prompt = `Create viral-optimized content with these specifications:

CONTENT PARAMETERS:
- Topic: ${params.topic || 'health and wellness'}
- Target Audience: ${params.audience || 'general'}
- Viral Intent: ${params.viralIntent || 'high'}
- Content Type: ${params.contentType || 'educational'}
- Time of Day: ${params.timeOfDay || 'afternoon'}

`;

    if (params.trendingContext && params.trendingContext.length > 0) {
      prompt += `TRENDING CONTEXT (incorporate subtly):
${params.trendingContext.map(trend => `- ${trend}`).join('\n')}

`;
    }

    if (params.previousPerformance && params.previousPerformance.length > 0) {
      const topPerforming = params.previousPerformance
        .sort((a, b) => b.viralScore - a.viralScore)
        .slice(0, 3);
      
      prompt += `HIGH-PERFORMING CONTENT PATTERNS (learn from these):
${topPerforming.map(p => `- "${p.content}" (Viral Score: ${p.viralScore})`).join('\n')}

`;
    }

    prompt += `OPTIMIZATION REQUIREMENTS:
1. Maximize viral potential through psychological triggers
2. Predict engagement based on content psychology
3. Ensure 150-270 character limit compliance
4. Include reasoning chain for optimization decisions
5. Provide realistic engagement forecasts

Generate content that will achieve maximum reach and engagement.`;

    return prompt;
  }

  /**
   * Parse AI response and enhance with additional analysis
   */
  private parseAndEnhanceContent(rawContent: string, params: EnhancedContentParams): EnhancedContentResult {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(rawContent);
      
      // Validate and enhance the parsed content
      return {
        content: parsed.content,
        viralPrediction: Math.min(100, Math.max(0, parsed.viralPrediction || 50)),
        engagementForecast: {
          expectedLikes: parsed.engagementForecast?.expectedLikes || this.estimateEngagement(parsed.content, 'likes'),
          expectedRetweets: parsed.engagementForecast?.expectedRetweets || this.estimateEngagement(parsed.content, 'retweets'),
          expectedReplies: parsed.engagementForecast?.expectedReplies || this.estimateEngagement(parsed.content, 'replies')
        },
        metadata: {
          contentType: parsed.metadata?.contentType || params.contentType || 'educational',
          audience: parsed.metadata?.audience || params.audience || 'general',
          confidence: Math.min(100, Math.max(0, parsed.metadata?.confidence || 75)),
          reasoningChain: parsed.metadata?.reasoningChain || ['AI-generated optimization']
        },
        threadParts: parsed.threadParts
      };
      
    } catch (error) {
      // Fallback parsing if JSON fails
      console.warn('⚠️ ENHANCED_AI: JSON parsing failed, using fallback parsing');
      
      return {
        content: rawContent.substring(0, 270),
        viralPrediction: 60,
        engagementForecast: {
          expectedLikes: this.estimateEngagement(rawContent, 'likes'),
          expectedRetweets: this.estimateEngagement(rawContent, 'retweets'),
          expectedReplies: this.estimateEngagement(rawContent, 'replies')
        },
        metadata: {
          contentType: params.contentType || 'educational',
          audience: params.audience || 'general',
          confidence: 70,
          reasoningChain: ['Fallback parsing used']
        }
      };
    }
  }

  /**
   * Estimate engagement based on content analysis
   */
  private estimateEngagement(content: string, type: 'likes' | 'retweets' | 'replies'): number {
    const baseScores = {
      likes: 50,
      retweets: 15,
      replies: 5
    };

    let multiplier = 1;

    // Boost for engagement triggers
    if (content.includes('?')) multiplier += 0.3; // Questions drive replies
    if (/\d+/.test(content)) multiplier += 0.2; // Numbers drive credibility
    if (content.includes('study') || content.includes('research')) multiplier += 0.2;
    if (content.toLowerCase().includes('surprising') || content.toLowerCase().includes('shocking')) multiplier += 0.3;

    return Math.round(baseScores[type] * multiplier);
  }

  /**
   * Learn from performance data to improve future content
   */
  addPerformanceData(data: PerformanceData): void {
    this.performanceHistory.push(data);
    
    // Keep only the last 100 entries for efficiency
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-100);
    }
    
    console.log(`📊 ENHANCED_AI: Performance data added. History: ${this.performanceHistory.length} entries`);
  }

  /**
   * Get performance insights for optimization
   */
  getPerformanceInsights(): any {
    if (this.performanceHistory.length < 10) {
      return { status: 'insufficient_data', message: 'Need at least 10 performance entries' };
    }

    const avgViralScore = this.performanceHistory.reduce((sum, p) => sum + p.viralScore, 0) / this.performanceHistory.length;
    const topPerformers = this.performanceHistory.filter(p => p.viralScore > avgViralScore);
    
    return {
      averageViralScore: Math.round(avgViralScore),
      topPerformersCount: topPerformers.length,
      insights: this.analyzePatterns(topPerformers),
      recommendations: this.generateRecommendations(topPerformers)
    };
  }

  /**
   * Analyze patterns in high-performing content
   */
  private analyzePatterns(topPerformers: PerformanceData[]): string[] {
    const insights: string[] = [];
    
    // Analyze common words/phrases
    const commonWords = this.extractCommonWords(topPerformers.map(p => p.content));
    if (commonWords.length > 0) {
      insights.push(`High-performing content often includes: ${commonWords.slice(0, 3).join(', ')}`);
    }
    
    // Analyze timing patterns
    const timeAnalysis = this.analyzeTimingPatterns(topPerformers);
    if (timeAnalysis) {
      insights.push(timeAnalysis);
    }
    
    return insights;
  }

  /**
   * Extract common words from high-performing content
   */
  private extractCommonWords(contents: string[]): string[] {
    const wordCounts: { [key: string]: number } = {};
    
    contents.forEach(content => {
      const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });
    
    return Object.entries(wordCounts)
      .filter(([_, count]) => count >= 2)
      .sort(([_, a], [__, b]) => b - a)
      .map(([word, _]) => word);
  }

  /**
   * Analyze timing patterns for optimal posting
   */
  private analyzeTimingPatterns(topPerformers: PerformanceData[]): string | null {
    const hourCounts: { [key: number]: number } = {};
    
    topPerformers.forEach(p => {
      const hour = p.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const bestHour = Object.entries(hourCounts)
      .sort(([_, a], [__, b]) => b - a)[0];
    
    if (bestHour && parseInt(bestHour[1].toString()) >= 2) {
      return `Best posting time appears to be around ${bestHour[0]}:00`;
    }
    
    return null;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(topPerformers: PerformanceData[]): string[] {
    const recommendations: string[] = [];
    
    if (topPerformers.length > 0) {
      const avgLength = topPerformers.reduce((sum, p) => sum + p.content.length, 0) / topPerformers.length;
      recommendations.push(`Optimal content length: ${Math.round(avgLength)} characters`);
      
      const questionCount = topPerformers.filter(p => p.content.includes('?')).length;
      if (questionCount > topPerformers.length * 0.6) {
        recommendations.push('Questions drive higher engagement - use them more often');
      }
      
      const numberCount = topPerformers.filter(p => /\d+/.test(p.content)).length;
      if (numberCount > topPerformers.length * 0.5) {
        recommendations.push('Include specific numbers/statistics for better performance');
      }
    }
    
    return recommendations;
  }
}
