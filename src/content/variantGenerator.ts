import OpenAI from 'openai';
import { NoveltyGuard } from './noveltyGuard';

interface ContentVariant {
  content: string;
  style: string;
  quality_score: number;
  specificity_score: number;
  novelty_score: number;
  predicted_engagement: number;
  total_score: number;
}

interface GenerationRequest {
  topic: string;
  style: string;
  temperature?: number;
  variant_count?: number;
}

export class VariantGenerator {
  private static instance: VariantGenerator;
  private openai: OpenAI;
  private noveltyGuard: NoveltyGuard;

  private constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    this.noveltyGuard = NoveltyGuard.getInstance();
  }

  public static getInstance(): VariantGenerator {
    if (!VariantGenerator.instance) {
      VariantGenerator.instance = new VariantGenerator();
    }
    return VariantGenerator.instance;
  }

  /**
   * Generate multiple content variants and return the best one
   */
  public async generateBestVariant(request: GenerationRequest): Promise<ContentVariant> {
    const variantCount = request.variant_count || 3;
    const temperature = request.temperature || 0.9;
    
    console.log(`🎲 VARIANT_GENERATION: Creating ${variantCount} variants for ${request.style} style...`);
    
    const variants: ContentVariant[] = [];
    
    // Generate multiple variants
    for (let i = 0; i < variantCount; i++) {
      try {
        const content = await this.generateSingleVariant(request, temperature + (i * 0.1));
        if (content) {
          const variant = await this.scoreVariant(content, request.style);
          variants.push(variant);
          console.log(`   Variant ${i+1}: Score=${variant.total_score.toFixed(2)} "${content.substring(0, 50)}..."`);
        }
      } catch (error: any) {
        console.warn(`⚠️ VARIANT_${i+1}_FAILED:`, error.message);
      }
    }
    
    if (variants.length === 0) {
      throw new Error('Failed to generate any variants');
    }
    
    // Return the highest scoring variant
    const bestVariant = variants.reduce((best, current) => 
      current.total_score > best.total_score ? current : best
    );
    
    console.log(`🏆 BEST_VARIANT: Score=${bestVariant.total_score.toFixed(2)} selected from ${variants.length} variants`);
    
    return bestVariant;
  }

  /**
   * Generate a single content variant
   */
  private async generateSingleVariant(request: GenerationRequest, temperature: number): Promise<string | null> {
    const prompt = this.buildPrompt(request);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.style)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: Math.min(temperature, 1.0),
        top_p: 0.8,
        presence_penalty: 0.5,
        frequency_penalty: 0.3,
        max_tokens: 300
      });

      return response.choices[0].message.content?.trim() || null;
    } catch (error: any) {
      console.error('❌ VARIANT_GENERATION_ERROR:', error.message);
      return null;
    }
  }

  /**
   * Score a content variant across multiple dimensions
   */
  private async scoreVariant(content: string, style: string): Promise<ContentVariant> {
    // Check novelty
    const noveltyCheck = await this.noveltyGuard.checkNovelty(content);
    const noveltyScore = noveltyCheck.is_novel ? 100 : Math.max(0, 100 - (noveltyCheck.jaccard_similarity * 200));
    
    // Score quality dimensions
    const qualityScore = this.scoreQuality(content);
    const specificityScore = this.scoreSpecificity(content);
    const engagementScore = this.predictEngagement(content, style);
    
    // Weighted total score
    const totalScore = (
      noveltyScore * 0.3 +        // 30% novelty
      qualityScore * 0.25 +       // 25% quality  
      specificityScore * 0.25 +   // 25% specificity
      engagementScore * 0.2       // 20% predicted engagement
    );
    
    return {
      content,
      style,
      quality_score: qualityScore,
      specificity_score: specificityScore,
      novelty_score: noveltyScore,
      predicted_engagement: engagementScore,
      total_score: totalScore
    };
  }

  /**
   * Score content quality (clarity, structure, actionability)
   */
  private scoreQuality(content: string): number {
    let score = 50; // Base score
    
    // Length check (optimal 150-280 chars)
    const length = content.length;
    if (length >= 150 && length <= 280) score += 20;
    else if (length < 100 || length > 300) score -= 20;
    
    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2 && sentences.length <= 4) score += 15;
    
    // Avoid AI-tells
    const aiTells = ['unlock', 'game-changer', 'optimize your life', 'try this', 'here\'s the thing'];
    const hasAiTells = aiTells.some(tell => content.toLowerCase().includes(tell));
    if (!hasAiTells) score += 15;
    
    // Readability (simple words vs complex)
    const words = content.split(' ');
    const complexWords = words.filter(w => w.length > 8).length;
    const complexRatio = complexWords / words.length;
    if (complexRatio < 0.15) score += 10; // Prefer simpler language
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score content specificity (numbers, mechanisms, outcomes)
   */
  private scoreSpecificity(content: string): number {
    let score = 30; // Base score
    
    // Numbers and percentages
    const hasNumbers = /\d+[%]?/.test(content);
    if (hasNumbers) score += 25;
    
    // Timeframes
    const timeframes = ['minutes?', 'hours?', 'days?', 'weeks?', 'months?'];
    const hasTimeframe = timeframes.some(tf => new RegExp(tf).test(content.toLowerCase()));
    if (hasTimeframe) score += 20;
    
    // Mechanisms (because, due to, activates, increases, etc.)
    const mechanisms = ['because', 'due to', 'activates', 'increases', 'decreases', 'boosts', 'lowers'];
    const hasMechanism = mechanisms.some(m => content.toLowerCase().includes(m));
    if (hasMechanism) score += 15;
    
    // Specific actions/protocols
    const actions = ['set', 'start', 'stop', 'avoid', 'take', 'eat', 'drink', 'sleep'];
    const hasAction = actions.some(a => content.toLowerCase().includes(a + ' '));
    if (hasAction) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Predict engagement potential
   */
  private predictEngagement(content: string, style: string): number {
    let score = 40; // Base score
    
    // Style bonuses
    const styleBonus = {
      'question_based': 20,  // Questions drive engagement
      'story_snippet': 15,   // Stories are engaging
      'myth_busting': 25,    // Controversial content
      'hooked_tip': 10,      // Hooks work but not as much
      'direct_fact': 5       // Least engaging but informative
    };
    
    score += styleBonus[style as keyof typeof styleBonus] || 0;
    
    // Emotional triggers
    const emotions = ['shocking', 'surprising', 'never', 'secret', 'hidden', 'wrong', 'mistake'];
    const hasEmotion = emotions.some(e => content.toLowerCase().includes(e));
    if (hasEmotion) score += 15;
    
    // Curiosity gaps
    const curiosity = ['why', 'how', 'what if', 'the reason', 'the truth'];
    const hasCuriosity = curiosity.some(c => content.toLowerCase().includes(c));
    if (hasCuriosity) score += 10;
    
    // Controversy/contrarian
    const contrarian = ['wrong', 'myth', 'lie', 'never tell you', 'don\'t want you to know'];
    const isContrarian = contrarian.some(c => content.toLowerCase().includes(c));
    if (isContrarian) score += 20;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Build generation prompt based on style
   */
  private buildPrompt(request: GenerationRequest): string {
    const basePrompts = {
      'hooked_tip': `Create health advice about ${request.topic}. Use a compelling hook + specific method + expected results. Include timeframe and mechanism.`,
      'direct_fact': `State a surprising health fact about ${request.topic}. Format: [Fact]. [Why it matters]. [What to do]. Be direct and specific.`,
      'question_based': `Start with an intriguing question about ${request.topic}. Answer with mechanism and practical application. Build curiosity.`,
      'story_snippet': `Share a brief health story about ${request.topic}. Format: [Scenario]. Result: [Outcome]. The reason: [Mechanism].`,
      'myth_busting': `Bust a common myth about ${request.topic}. Explain what people think vs reality + why the myth persists.`,
      'simple_statement': `Make a clean, informative statement about ${request.topic}. Include scientific reason and simple action step.`
    };
    
    const basePrompt = basePrompts[request.style as keyof typeof basePrompts] || basePrompts['direct_fact'];
    
    return `${basePrompt}

Requirements:
- 150-280 characters total
- Specific numbers/timeframes when relevant  
- Scientific mechanism when possible
- Actionable and engaging
- No generic advice or AI-tells
- Unique angle that hasn't been covered recently`;
  }

  /**
   * Get system prompt for style
   */
  private getSystemPrompt(style: string): string {
    return `You are a viral health influencer creating ${style} content. 

Key principles:
- Be specific with numbers, timeframes, and mechanisms
- Avoid generic advice and AI-tells (unlock, game-changer, optimize your life)
- Create curiosity and provide genuine value
- Write conversationally but authoritatively
- Focus on actionable insights people can implement immediately

Style: ${style}
Keep responses under 280 characters and make every word count.`;
  }

  /**
   * Get generation statistics
   */
  public getStats(): { total_generated: number; avg_score: number } {
    // This would track stats in a real implementation
    return {
      total_generated: 0,
      avg_score: 0
    };
  }
}
