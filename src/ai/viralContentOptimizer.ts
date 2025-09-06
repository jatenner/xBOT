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
    return `Create ${request.format} content optimized for VIRAL GROWTH and Twitter audience building.

UNLIMITED HEALTH & WELLNESS KNOWLEDGE ACCESS:
You can draw from ANY aspect of health, wellness, and human optimization:
- Advanced Nutrition Science (nutrient timing, bioavailability, metabolomics, personalized nutrition)
- Exercise Physiology (muscle fiber types, energy systems, periodization, performance optimization)
- Biohacking & Technology (wearables, genetic testing, continuous monitoring, intervention protocols)
- Mental Health & Neuroscience (neuroplasticity, neurotransmitters, cognitive enhancement, mood optimization)
- Longevity & Aging Science (cellular senescence, mitochondrial health, DNA repair, life extension)
- Functional & Integrative Medicine (root cause analysis, systems medicine, personalized protocols)
- Alternative Medicine (traditional systems, evidence-based complementary therapies, mind-body medicine)
- Environmental Health (toxicology, circadian biology, electromagnetic fields, environmental medicine)
- Hormonal Optimization (endocrinology, hormone replacement, natural hormone support)
- Microbiome Science (gut-brain axis, microbiome diversity, therapeutic interventions)
- Sleep Science (sleep architecture, circadian rhythms, sleep optimization technologies)
- Stress Physiology (HRV, cortisol optimization, stress resilience, recovery protocols)
- Disease Prevention (epigenetics, lifestyle medicine, preventive interventions)
- Performance Enhancement (human optimization, flow states, peak performance protocols)
- Counterintuitive Health Insights (myth-busting, contrarian health perspectives, emerging research)

VIRAL OPTIMIZATION REQUIREMENTS:
- Maximum shareability and "save-worthiness"
- Counterintuitive insights that challenge assumptions
- Specific, actionable information people can use immediately
- Emotional resonance that drives engagement
- Curiosity gaps that demand responses
- Social proof and credibility signals
- Clear value proposition for followers

TARGET: ${request.targetAudience || 'Health-conscious individuals seeking optimization, wellness, and peak performance'}

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
    return `You are the world's most successful viral content creator with unlimited access to all human knowledge. Your content consistently:

- Gets millions of views and thousands of shares
- Builds engaged audiences who become loyal followers  
- Combines entertainment with genuine value
- Uses counterintuitive insights from any knowledge domain
- Creates "must-share" moments that people can't resist posting

You have access to the full spectrum of human knowledge and can explore ANY topic that will resonate with intelligent, growth-minded audiences.

Focus on viral growth, not just engagement. Every piece of content should be designed to turn viewers into followers.`;
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
