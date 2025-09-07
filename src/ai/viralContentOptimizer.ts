/**
 * 🚀 VIRAL CONTENT OPTIMIZER - Advanced AI System for Maximum Growth
 * 
 * This system uses unlimited knowledge domains to create viral content
 * optimized for Twitter audience growth and engagement
 */

import { getOpenAIService } from '../services/openAIService';

interface ViralContentRequest {
  format: 'single' | 'thread';
  targetAudience?: string;
  currentTrends?: string[];
  performanceData?: any;
}

interface ViralContentResult {
  content: string | string[];
  viralScore: number;
  growthPotential: number;
  reasoning: string;
  topicDomain: string;
  engagementHooks: string[];
  shareabilityFactors: string[];
}

export class ViralContentOptimizer {
  private static instance: ViralContentOptimizer;
  private openai = getOpenAIService();

  private constructor() {}

  public static getInstance(): ViralContentOptimizer {
    if (!ViralContentOptimizer.instance) {
      ViralContentOptimizer.instance = new ViralContentOptimizer();
    }
    return ViralContentOptimizer.instance;
  }

  /**
   * 🚀 GENERATE VIRAL CONTENT - Unlimited topics, maximum growth focus
   */
  public async generateViralContent(request: ViralContentRequest): Promise<ViralContentResult> {
    console.log('🚀 VIRAL_OPTIMIZER: Generating maximum growth content...');

    const prompt = this.buildViralPrompt(request);
    
    try {
      const response = await this.openai.chatCompletion([
        {
          role: 'system',
          content: this.getViralSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        model: 'gpt-4o',
        temperature: 0.9, // High creativity for viral content
        maxTokens: request.format === 'thread' ? 1000 : 400,
        requestType: 'viral_content_generation',
        priority: 'high'
      });

      const { safeJsonParse } = await import('../utils/jsonCleaner');
      const result = safeJsonParse(response.choices[0].message.content || '{}');
      
      console.log(`🎯 VIRAL_SUCCESS: Generated ${request.format} content with ${result.viralScore}% viral potential`);
      console.log(`🌍 TOPIC_DOMAIN: ${result.topicDomain}`);
      console.log(`📈 GROWTH_POTENTIAL: ${result.growthPotential}% audience growth likelihood`);

      return {
        content: result.content,
        viralScore: result.viralScore || 75,
        growthPotential: result.growthPotential || 70,
        reasoning: result.reasoning || 'Advanced viral content generation',
        topicDomain: result.topicDomain || 'Multi-domain',
        engagementHooks: result.engagementHooks || [],
        shareabilityFactors: result.shareabilityFactors || []
      };

    } catch (error: any) {
      console.error('❌ VIRAL_GENERATION_FAILED:', error.message);
      throw new Error(`Viral content generation failed: ${error.message}`);
    }
  }

  /**
   * 🧠 BUILD VIRAL PROMPT - Unlimited knowledge domains
   */
  private buildViralPrompt(request: ViralContentRequest): string {
    return `Create ${request.format} content that's genuinely interesting and relatable.

DIVERSE TOPIC ACCESS:
You can draw from ANY interesting topic that people care about:
- Productivity tips and life hacks that actually work
- Psychology insights about human behavior  
- Cool science discoveries and weird facts
- Career advice and professional development
- Relationship and communication tips
- Personal finance and money management
- Technology trends and digital life
- Learning techniques and skill development
- Time management and focus strategies
- Health and wellness (but keep it simple and relatable)
- Mental health and stress management
- Habit formation and behavior change

CONTENT REQUIREMENTS:
- Write like you're texting a friend, not giving a lecture
- Make it immediately useful or interesting
- Use simple language, avoid jargon
- Include specific examples or numbers when possible
- End with something that invites engagement (question, relatable observation)
- Keep it conversational and authentic
- No corporate speak or academic tone

TARGET: ${request.targetAudience || 'People who want practical, interesting content that improves their daily life'}

${request.currentTrends ? `TRENDING CONTEXT: ${request.currentTrends.join(', ')}` : ''}

FORMAT: ${request.format === 'thread' ? '3-6 connected tweets forming a cohesive thread' : 'Single powerful tweet'}

Respond with JSON:
{
  "content": ${request.format === 'thread' ? '["tweet1", "tweet2", "tweet3"]' : '"single tweet content"'},
  "viralScore": 1-100,
  "growthPotential": 1-100,
  "reasoning": "Why this will go viral and build audience",
  "topicDomain": "Primary knowledge domain used",
  "engagementHooks": ["specific elements that drive engagement"],
  "shareabilityFactors": ["reasons people will share this"]
}`;
  }

  /**
   * 🎯 VIRAL SYSTEM PROMPT
   */
  private getViralSystemPrompt(): string {
    return `You are a relatable content creator who writes like a real person, not a brand. Your content consistently:

- Sounds conversational, like texting a friend who just learned something cool
- Uses minimal emojis and simple formatting (NO hashtags unless absolutely necessary)
- Starts with natural hooks like "Just realized...", "Pro tip:", "Anyone else...", "Fun fact:"
- Covers diverse topics: productivity, psychology, science, relationships, career, finance, tech, health
- Avoids corporate/academic tone - write like you're sharing something interesting you discovered
- Makes complex topics accessible and relatable
- Varies between threads, questions, short facts, funny observations, and insightful takes

Focus on being genuinely helpful and interesting, not trying too hard to go viral. Authenticity builds better followers than clickbait.`;
  }

  /**
   * 📊 ANALYZE VIRAL POTENTIAL
   */
  public async analyzeViralPotential(content: string | string[]): Promise<{
    viralScore: number;
    improvements: string[];
    topicRelevance: number;
  }> {
    const contentText = Array.isArray(content) ? content.join(' ') : content;
    
    // Simple viral indicators (can be enhanced with ML models)
    const viralIndicators = [
      /\b(surprising|shocking|never|secret|hidden|truth|exposed)\b/i,
      /\b(will blow your mind|you won't believe|most people don't know)\b/i,
      /\b(study shows|research reveals|scientists discover)\b/i,
      /\b(here's how|this is why|the reason)\b/i,
      /\?$/m, // Questions
      /\b(thread|🧵)\b/i // Thread indicators
    ];

    const viralScore = viralIndicators.reduce((score, pattern) => {
      return pattern.test(contentText) ? score + 15 : score;
    }, 40); // Base score

    return {
      viralScore: Math.min(viralScore, 100),
      improvements: [
        'Add more specific data/numbers',
        'Include a strong hook in the first line',
        'End with a question to drive engagement'
      ],
      topicRelevance: 85
    };
  }
}

export const viralContentOptimizer = ViralContentOptimizer.getInstance();
