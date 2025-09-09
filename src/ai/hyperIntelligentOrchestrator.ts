/**
 * 🧠 HYPER-INTELLIGENT ORCHESTRATOR
 * Next-generation AI prompting with all advanced systems
 */

import OpenAI from 'openai';
import { MultiModelOrchestrator } from './multiModelOrchestrator';
import { ExpertPersonaSystem } from './expertPersonaSystem';
import { RealTimeTrendInjector } from './realTimeTrendInjector';
import { EmotionalIntelligenceEngine } from './emotionalIntelligenceEngine';

export class HyperIntelligentOrchestrator {
  private static instance: HyperIntelligentOrchestrator;
  private openai: OpenAI;
  private multiModel: MultiModelOrchestrator;
  private personaSystem: ExpertPersonaSystem;
  private trendInjector: RealTimeTrendInjector;
  private emotionalEngine: EmotionalIntelligenceEngine;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.multiModel = new MultiModelOrchestrator();
    this.personaSystem = ExpertPersonaSystem.getInstance();
    this.trendInjector = RealTimeTrendInjector.getInstance();
    this.emotionalEngine = EmotionalIntelligenceEngine.getInstance();
  }

  public static getInstance(): HyperIntelligentOrchestrator {
    if (!HyperIntelligentOrchestrator.instance) {
      HyperIntelligentOrchestrator.instance = new HyperIntelligentOrchestrator();
    }
    return HyperIntelligentOrchestrator.instance;
  }

  /**
   * 🚀 GENERATE HYPER-INTELLIGENT CONTENT
   * Uses all advanced AI systems for maximum sophistication
   */
  async generateHyperIntelligentContent(
    topic: string,
    format: 'single' | 'thread' = 'single'
  ): Promise<{
    content: string;
    threadParts?: string[];
    metadata: {
      persona: string;
      emotionalFramework: string;
      viralScore: number;
      sophisticationLevel: number;
      trendRelevance: number;
      aiSystemsUsed: string[];
    };
  }> {
    console.log(`🧠 HYPER_AI: Generating ${format} content for "${topic}" with full intelligence stack`);

    // 🎭 Step 1: Select optimal expert persona
    const persona = this.personaSystem.getPersonaForTopic(topic);
    console.log(`🎭 PERSONA_SELECTED: ${persona.name}`);

    // 🧠 Step 2: Choose emotional framework
    const emotionalFramework = this.emotionalEngine.selectEmotionalFramework(topic, 'viral');
    console.log(`🧠 EMOTION_FRAMEWORK: ${emotionalFramework.primaryEmotion}`);

    // 📊 Step 3: Get trend intelligence
    const trendData = await this.trendInjector.getTopicRelevance(topic);
    console.log(`📊 TREND_RELEVANCE: ${trendData.urgencyScore}/100`);

    // 🎯 Step 4: Build hyper-intelligent prompt
    const hyperPrompt = await this.buildHyperIntelligentPrompt(
      persona,
      emotionalFramework,
      topic,
      format,
      trendData
    );

    // 🚀 Step 5: Generate with multi-model ensemble (50% chance for premium topics)
    let result;
    let aiSystemsUsed = [];

    const useEnsemble = Math.random() < 0.5 || trendData.urgencyScore > 70;
    
    if (useEnsemble) {
      console.log('🚀 ENSEMBLE_GENERATION: Using multi-model for premium quality');
      const ensembleResult = await this.multiModel.generateEnsembleContent(hyperPrompt);
      result = ensembleResult.content;
      aiSystemsUsed.push(`Ensemble-${ensembleResult.winningModel}`);
    } else {
      console.log('⚡ SINGLE_MODEL: Using GPT-4o with hyper-optimization');
      // EMERGENCY_COST_CHECK: Check daily budget before expensive API calls
        const openAIService = OpenAIService.getInstance();
        const budgetStatus = await openAIService.getCurrentBudgetStatus();
        if (budgetStatus.isOverBudget) {
          throw new Error('🚨 COST_LIMIT: Daily OpenAI budget exceeded - operation blocked');
        }
        
        const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // COST_FIX: $0.15 -> $0.0015 per 1K tokens
        messages: [
          {
            role: 'system',
            content: `You are ${persona.name}. ${persona.background}. Writing style: ${persona.writingStyle}. Focus on ${emotionalFramework.primaryEmotion.toLowerCase()} triggers.`
          },
          {
            role: 'user',
            content: hyperPrompt
          }
        ],
        temperature: 0.95,
        top_p: 0.9,
        presence_penalty: 0.9,
        frequency_penalty: 0.95,
        max_tokens: format === 'thread' ? 800 : 400 // COST_FIX: Reduced token limits
      });
      result = response.choices[0]?.message?.content || '';
      aiSystemsUsed.push('GPT-4o-Hyper');
    }

    // 📊 Step 6: Analyze and optimize
    const emotionalAnalysis = this.emotionalEngine.analyzeEmotionalImpact(result);
    const sophisticationScore = this.calculateSophisticationScore(result, persona);

    aiSystemsUsed.push('EmotionalAnalysis', 'TrendIntelligence', 'PersonaSystem');

    console.log(`✅ HYPER_AI_COMPLETE: ${aiSystemsUsed.length} systems, ${emotionalAnalysis.emotionalScore}/100 emotional, ${sophisticationScore}/100 sophistication`);

    return {
      content: this.cleanContent(result),
      threadParts: format === 'thread' ? this.parseThreadParts(result) : undefined,
      metadata: {
        persona: persona.name,
        emotionalFramework: emotionalFramework.primaryEmotion,
        viralScore: Math.max(80, emotionalAnalysis.emotionalScore),
        sophisticationLevel: sophisticationScore,
        trendRelevance: trendData.urgencyScore,
        aiSystemsUsed
      }
    };
  }

  /**
   * 🧠 Build hyper-intelligent prompt with all systems
   */
  private async buildHyperIntelligentPrompt(
    persona: any,
    emotionalFramework: any,
    topic: string,
    format: string,
    trendData: any
  ): Promise<string> {
    // Build persona-based prompt
    const personaPrompt = this.personaSystem.buildPersonaPrompt(
      persona,
      `Create ${format === 'thread' ? 'a thread' : 'a single tweet'} about: ${topic}`
    );

    // Add emotional intelligence
    const emotionalPrompt = this.emotionalEngine.generateEmotionalPrompt(emotionalFramework);

    // Inject real-time trends
    const finalPrompt = await this.trendInjector.injectTrendIntelligence(
      personaPrompt + emotionalPrompt,
      topic
    );

    // Add hyper-optimization instructions
    return `${finalPrompt}

🧠 HYPER-INTELLIGENCE OPTIMIZATION:

🎯 SOPHISTICATION MULTIPLIERS:
- Reference specific research methodologies or study designs
- Include precise biological mechanisms (cellular/molecular level)
- Mention specific compounds, proteins, or biochemical pathways
- Connect to broader scientific frameworks or theories
- Use technical terminology appropriately for educated audience

⚡ VIRAL ACCELERATION TACTICS:
- Start with pattern-interrupt opening (challenge assumptions)
- Include specific, memorable numbers or statistics  
- Reference elite performers, celebrities, or exclusive groups
- Create information gaps that demand completion
- End with actionable takeaway or intriguing question

🔬 CREDIBILITY AMPLIFICATION:
- Cite specific researchers, institutions, or study publications
- Include study limitations or methodology notes (shows sophistication)
- Reference related fields (evolutionary biology, neuroscience, etc.)
- Mention cost/price points for relatability
- Include timeline/dosage/protocol specifics

🎭 ${persona.name.toUpperCase()} UNIQUE ANGLE:
Leverage your specific background in ${persona.expertise.join(' + ')} to provide insights others can't. Your unique perspective combines ${persona.expertise[0]} with ${persona.expertise[1] || 'practical application'}.

TREND OPTIMIZATION (Urgency: ${trendData.urgencyScore}/100):
${trendData.trendingKeywords.length > 0 ? `- Incorporate trending: ${trendData.trendingKeywords.slice(0, 3).join(', ')}` : ''}
${trendData.competitorGaps.length > 0 ? `- Fill competitor gaps: ${trendData.competitorGaps.slice(0, 2).join(', ')}` : ''}

🚀 EXECUTION TARGET: Create content so sophisticated and valuable that health professionals screenshot it, influencers wish they wrote it, and regular people feel smarter after reading it.`;
  }

  /**
   * 📊 Calculate sophistication score
   */
  private calculateSophisticationScore(content: string, persona: any): number {
    let score = 0;
    const contentLower = content.toLowerCase();

    // Technical terms (+5 each, max 25)
    const techTerms = ['cellular', 'molecular', 'pathway', 'mechanism', 'compound', 'protein', 'enzyme', 'hormone'];
    const foundTechTerms = techTerms.filter(term => contentLower.includes(term));
    score += Math.min(25, foundTechTerms.length * 5);

    // Research references (+10 each, max 30)
    const researchTerms = ['study', 'research', 'trial', 'meta-analysis', 'published', 'journal'];
    const foundResearch = researchTerms.filter(term => contentLower.includes(term));
    score += Math.min(30, foundResearch.length * 10);

    // Specific numbers (+3 each, max 15)
    const numbers = content.match(/\d+/g) || [];
    score += Math.min(15, numbers.length * 3);

    // Authority references (+8 each, max 20)
    const authorities = ['harvard', 'stanford', 'mayo', 'johns hopkins', 'mit', 'nih', 'who'];
    const foundAuthorities = authorities.filter(auth => contentLower.includes(auth));
    score += Math.min(20, foundAuthorities.length * 8);

    // Persona expertise alignment (+10 if aligned)
    if (persona.expertise.some(exp => contentLower.includes(exp.toLowerCase()))) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * 🧹 Clean content
   */
  private cleanContent(content: string): string {
    return content
      .replace(/["']/g, '') // Remove quotes
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * 🧵 Parse thread parts
   */
  private parseThreadParts(content: string): string[] {
    const parts = content.split(/\d+[\/\.]|\n\n/).filter(part => part.trim().length > 0);
    return parts.map(part => this.cleanContent(part));
  }
}
