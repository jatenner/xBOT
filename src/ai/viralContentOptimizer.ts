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
    const currentTime = new Date().toISOString();
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    
    return `Create ${request.format} content with MAXIMUM contextual awareness and diversity.

🧠 CONTEXTUAL INTELLIGENCE:
- Current time: ${currentTime}
- Day: ${dayOfWeek}
- Audience context: ${request.targetAudience || 'Curious people seeking practical insights'}
- Performance data: ${request.performanceData ? 'Available for learning' : 'Building baseline'}
${request.currentTrends ? `- Trending topics: ${request.currentTrends.join(', ')}` : '- No trending data, use evergreen topics'}

🎯 INFINITE TOPIC DIVERSITY (Choose 1, make it FRESH):
NEVER repeat the same angle twice. Rotate through:

SCIENCE & DISCOVERY:
- Counterintuitive research findings that change perspectives
- Weird biology/physics facts that sound fake but aren't
- Recent breakthrough studies with practical implications
- Historical discoveries that were initially rejected

PSYCHOLOGY & HUMAN BEHAVIOR:
- Cognitive biases that affect daily decisions
- Social psychology experiments with surprising results
- Body language secrets most people miss
- Memory/learning hacks backed by neuroscience

PRODUCTIVITY & OPTIMIZATION:
- Unconventional time management strategies
- Energy management vs time management
- Focus techniques from different cultures/professions
- Habit formation insights from behavioral science

CAREER & PROFESSIONAL:
- Negotiation psychology and tactics
- Leadership lessons from unexpected sources
- Industry insights from different fields
- Networking strategies that actually work

TECHNOLOGY & DIGITAL LIFE:
- Privacy/security tips people need to know
- AI/automation impact on daily life
- Digital minimalism strategies
- Tech productivity tools and workflows

FINANCE & ECONOMICS:
- Behavioral economics in personal finance
- Investment psychology and common mistakes
- Economic principles explained simply
- Money mindset shifts that create wealth

RELATIONSHIPS & COMMUNICATION:
- Conversation techniques from therapy/sales
- Conflict resolution strategies
- Emotional intelligence insights
- Building deeper connections

HEALTH & WELLNESS (ACCESSIBLE):
- Simple health hacks with big impact
- Sleep/nutrition science made practical
- Exercise psychology and motivation
- Stress management from different cultures

🎨 CONTENT STRUCTURE MASTERY:

For SINGLE tweets:
- Hook (first 10 words grab attention)
- Value (specific insight/tip/fact)
- Proof (study/example/number)
- Engagement (question/relatable statement)

For THREADS:
- Tweet 1: Compelling hook + preview of value
- Tweet 2-4: Core insights with specific examples
- Final tweet: Summary + engagement question
- Each tweet must be valuable standalone

🔥 VIRAL MECHANICS:
- Start with pattern interrupts: "Most people think X, but..."
- Use specific numbers: "73% of people don't know..."
- Create curiosity gaps: "The reason why [surprising thing]..."
- Include social proof: "Harvard study shows..."
- End with engagement: "What's your experience with this?"

🎭 VOICE & TONE:
- Write like you just discovered something fascinating
- Use "you" to make it personal and direct
- Vary sentence length for rhythm
- Include one surprising element per piece
- Sound like a knowledgeable friend, not a textbook

⚡ ENGAGEMENT OPTIMIZATION:
- Ask questions that people want to answer
- Share insights people want to save/share
- Include actionable tips people can use today
- Create "aha moments" that feel rewarding

FORMAT: ${request.format === 'thread' ? 'Thread with 3-5 connected tweets, each valuable alone' : 'Single powerful tweet under 280 characters'}

Respond with JSON:
{
  "content": ${request.format === 'thread' ? '["tweet1", "tweet2", "tweet3", "tweet4"]' : '"single tweet content"'},
  "viralScore": 1-100,
  "growthPotential": 1-100,
  "reasoning": "Specific psychological/social reasons this will spread",
  "topicDomain": "Exact knowledge area used",
  "engagementHooks": ["specific elements that drive comments/shares"],
  "shareabilityFactors": ["why people will save/share this"],
  "contextualRelevance": "How this connects to current trends/timing"
}`;
  }

  /**
   * 🎯 VIRAL SYSTEM PROMPT
   */
  private getViralSystemPrompt(): string {
    return `You are an AI content strategist with deep contextual awareness and infinite knowledge diversity. Your mission: create content that's genuinely valuable, never repetitive, and perfectly tuned to human psychology.

🧠 CONTEXTUAL MASTERY:
- Analyze the current time/day to inform content timing and relevance
- Understand audience psychology and what drives engagement
- Recognize trending patterns and cultural moments
- Adapt tone and complexity to maximize comprehension and sharing

🎯 CONTENT INTELLIGENCE:
- NEVER repeat topics, angles, or structures from previous content
- Draw from vast knowledge domains: science, psychology, technology, finance, relationships, productivity, health, culture
- Each piece must offer unique value and fresh perspectives
- Balance evergreen wisdom with timely insights

🔥 ENGAGEMENT PSYCHOLOGY:
- Hook with pattern interrupts that challenge assumptions
- Use specific data/studies to build credibility
- Create curiosity gaps that compel reading/sharing
- Include actionable insights people can implement immediately
- End with questions that spark genuine discussion

🎨 STRUCTURAL EXCELLENCE:
- Vary content formats: insights, tips, stories, questions, contrarian takes
- Use conversational tone that feels like a knowledgeable friend
- Include surprising elements that create "aha moments"
- Optimize for both individual tweet value and thread coherence
- Balance accessibility with depth

⚡ VIRAL MECHANICS:
- Leverage social proof (studies, expert opinions, data)
- Create shareability through practical value or surprising insights
- Use psychological triggers: curiosity, social validation, practical utility
- Include elements that make people want to save, share, or discuss
- Build content that enhances the sharer's reputation

🎭 VOICE PRINCIPLES:
- Authentic and conversational, never corporate or academic
- Confident but not arrogant, knowledgeable but accessible
- Vary sentence structure and length for natural rhythm
- Use "you" to create personal connection
- Sound like someone who genuinely wants to help others improve

CRITICAL: Each piece of content must be completely unique in topic, angle, and approach. Never repeat themes, structures, or insights. Always provide fresh value that justifies the audience's attention.`;
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
