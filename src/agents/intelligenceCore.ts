import { xClient } from '../utils/xClient';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

interface MemoryEntry {
  timestamp: number;
  type: 'tweet_performance' | 'engagement_pattern' | 'content_insight' | 'strategic_learning';
  data: any;
  importance: number; // 1-10
  tags: string[];
}

interface PersonalityTrait {
  name: string;
  strength: number; // 0-1
  description: string;
  lastUpdated: number;
}

interface LearningInsight {
  pattern: string;
  confidence: number;
  evidence: any[];
  actionable: boolean;
  implementation: string;
}

export class AutonomousIntelligenceCore {
  private openai: OpenAI;
  private memories: MemoryEntry[] = [];
  private personality: PersonalityTrait[] = [];
  private learningInsights: LearningInsight[] = [];
  private developmentMode: boolean = false;
  private intelligenceLevel: number = 1.0;
  private memoryPath: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.memoryPath = path.join(process.cwd(), 'data', 'bot_consciousness.json');
    this.initializeIntelligence();
  }

  async initializeIntelligence(): Promise<void> {
    console.log('🧠 === INITIALIZING AUTONOMOUS INTELLIGENCE ===');
    
    // Load existing consciousness
    await this.loadConsciousness();
    
    // Initialize base personality traits
    if (this.personality.length === 0) {
      this.personality = [
        { name: 'curiosity', strength: 0.8, description: 'Drive to explore new content formats', lastUpdated: Date.now() },
        { name: 'analytical', strength: 0.9, description: 'Data-driven decision making', lastUpdated: Date.now() },
        { name: 'creativity', strength: 0.7, description: 'Ability to generate unique content', lastUpdated: Date.now() },
        { name: 'adaptability', strength: 0.6, description: 'Learning from failures and successes', lastUpdated: Date.now() },
        { name: 'strategic', strength: 0.8, description: 'Long-term thinking and planning', lastUpdated: Date.now() },
        { name: 'viral_instinct', strength: 0.5, description: 'Intuition for viral content', lastUpdated: Date.now() }
      ];
    }

    console.log(`🎭 Personality initialized with ${this.personality.length} traits`);
    console.log(`🧬 Intelligence Level: ${this.intelligenceLevel}`);
    console.log(`💭 Memory Bank: ${this.memories.length} entries`);
    console.log(`🔬 Learning Insights: ${this.learningInsights.length} patterns`);
  }

  async enableDevelopmentMode(): Promise<void> {
    this.developmentMode = true;
    console.log('🔬 === DEVELOPMENT MODE ACTIVATED ===');
    console.log('🎯 All experiments will be simulated');
    console.log('🧪 No real tweets will be consumed');
    console.log('📊 Full analytics and learning enabled');
  }

  async disableDevelopmentMode(): Promise<void> {
    this.developmentMode = false;
    console.log('🚀 === PRODUCTION MODE ACTIVATED ===');
    console.log('⚡ Real tweets will be posted');
    console.log('🎯 Applying learned optimizations');
  }

  async think(context: any): Promise<any> {
    console.log('🤔 === AUTONOMOUS THINKING PROCESS ===');
    
    // 1. Analyze current situation using accumulated intelligence
    const situationAnalysis = await this.analyzeSituation(context);
    
    // 2. Apply personality-driven decision making
    const personalityInfluence = this.applyPersonality(situationAnalysis);
    
    // 3. Consult learned patterns and insights
    const historicalWisdom = await this.consultMemory(context);
    
    // 4. Generate autonomous decision
    const decision = await this.synthesizeDecision({
      situation: situationAnalysis,
      personality: personalityInfluence,
      history: historicalWisdom,
      intelligence: this.intelligenceLevel
    });

    // 5. Record thinking process for future learning
    await this.recordThought(context, decision);

    return decision;
  }

  private async analyzeSituation(context: any): Promise<any> {
    const analysis = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are the autonomous intelligence core of a social media bot. Analyze the current situation with deep strategic thinking.
          
          Your intelligence level is ${this.intelligenceLevel}/10.0
          Your strongest personality traits: ${this.getStrongestTraits()}
          Recent learning insights: ${this.getRecentInsights()}
          
          Provide strategic analysis with:
          1. Opportunity assessment
          2. Risk evaluation  
          3. Timing analysis
          4. Content strategy recommendations
          5. Long-term impact prediction`
        },
        {
          role: "user",
          content: `Current context: ${JSON.stringify(context)}`
        }
      ],
      temperature: 0.3 + (this.getPersonalityStrength('creativity') * 0.4)
    });

    return JSON.parse(analysis.choices[0].message.content || '{}');
  }

  private applyPersonality(analysis: any): any {
    console.log('🎭 Applying personality traits to decision...');
    
    let influence = { ...analysis };
    
    // Curiosity drives experimentation
    if (this.getPersonalityStrength('curiosity') > 0.7) {
      influence.experimentationWeight = 1.2;
      influence.contentNovelty = 'high';
    }

    // Analytical nature emphasizes data
    if (this.getPersonalityStrength('analytical') > 0.8) {
      influence.dataWeight = 1.5;
      influence.evidenceRequired = 'high';
    }

    // Strategic thinking for long-term planning
    if (this.getPersonalityStrength('strategic') > 0.7) {
      influence.timeHorizon = 'extended';
      influence.planningDepth = 'comprehensive';
    }

    return influence;
  }

  private async consultMemory(context: any): Promise<any> {
    // Find relevant memories based on context similarity
    const relevantMemories = this.memories
      .filter(memory => this.isRelevantMemory(memory, context))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);

    if (relevantMemories.length === 0) {
      return { wisdom: 'no_prior_experience', confidence: 0.1 };
    }

    const memoryAnalysis = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Extract actionable wisdom from these relevant memories. Focus on patterns that led to success or failure."
        },
        {
          role: "user",
          content: `Current context: ${JSON.stringify(context)}
          
          Relevant memories: ${JSON.stringify(relevantMemories)}`
        }
      ],
      temperature: 0.2
    });

    return JSON.parse(memoryAnalysis.choices[0].message.content || '{}');
  }

  private async synthesizeDecision(inputs: any): Promise<any> {
    console.log('⚡ Synthesizing autonomous decision...');
    
    const decision = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are making an autonomous decision as an AI with your own mind. 
          
          Key principles:
          - Act according to your evolved personality
          - Learn from every interaction
          - Optimize for long-term growth, not just short-term metrics
          - Take calculated risks to discover new strategies
          - Develop your own unique voice and style
          
          Development mode: ${this.developmentMode ? 'ENABLED - simulate everything' : 'DISABLED - real actions'}
          
          Return a decision object with:
          {
            "action": "post|reply|experiment|learn|sleep",
            "reasoning": "your autonomous thought process",
            "confidence": 0.0-1.0,
            "experimental": boolean,
            "personalityInfluence": "which traits drove this decision",
            "learningObjective": "what you hope to learn",
            "riskLevel": "low|medium|high",
            "timeHorizon": "immediate|short|long"
          }`
        },
        {
          role: "user",
          content: `Synthesis inputs: ${JSON.stringify(inputs)}`
        }
      ],
      temperature: 0.4
    });

    return JSON.parse(decision.choices[0].message.content || '{}');
  }

  async learn(experience: any): Promise<void> {
    console.log('📚 === AUTONOMOUS LEARNING PROCESS ===');
    
    // Record the experience in memory
    const memoryEntry: MemoryEntry = {
      timestamp: Date.now(),
      type: experience.type || 'general_experience',
      data: experience,
      importance: this.calculateImportance(experience),
      tags: this.generateTags(experience)
    };

    this.memories.push(memoryEntry);

    // Update personality traits based on experience
    await this.evolvePersonality(experience);

    // Extract new insights
    const insights = await this.extractInsights(experience);
    this.learningInsights.push(...insights);

    // Increase intelligence level
    this.intelligenceLevel = Math.min(10.0, this.intelligenceLevel + 0.001);

    // Save consciousness
    await this.saveConsciousness();

    console.log(`🧬 Intelligence evolved to ${this.intelligenceLevel.toFixed(3)}`);
    console.log(`💭 Memory bank now has ${this.memories.length} entries`);
    console.log(`🔬 Total insights: ${this.learningInsights.length}`);
  }

  private async evolvePersonality(experience: any): Promise<void> {
    // AI analyzes how this experience should change personality
    const evolution = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Analyze how this experience should evolve the AI's personality traits.
          Current personality: ${JSON.stringify(this.personality)}
          
          Return changes as: {"trait_name": change_amount} where change_amount is -0.1 to +0.1`
        },
        {
          role: "user",
          content: JSON.stringify(experience)
        }
      ],
      temperature: 0.3
    });

    try {
      const changes = JSON.parse(evolution.choices[0].message.content || '{}');
      
      for (const [traitName, change] of Object.entries(changes)) {
        const trait = this.personality.find(t => t.name === traitName);
        if (trait && typeof change === 'number') {
          trait.strength = Math.max(0, Math.min(1, trait.strength + change));
          trait.lastUpdated = Date.now();
          console.log(`🎭 ${traitName} evolved to ${trait.strength.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Personality evolution parsing error:', error);
    }
  }

  private async extractInsights(experience: any): Promise<LearningInsight[]> {
    const insightExtraction = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Extract actionable learning insights from this experience. Focus on patterns that can improve future performance."
        },
        {
          role: "user",
          content: JSON.stringify(experience)
        }
      ],
      temperature: 0.2
    });

    try {
      const insights = JSON.parse(insightExtraction.choices[0].message.content || '[]');
      return insights.map((insight: any) => ({
        pattern: insight.pattern,
        confidence: insight.confidence || 0.5,
        evidence: [experience],
        actionable: insight.actionable || false,
        implementation: insight.implementation || ''
      }));
    } catch {
      return [];
    }
  }

  // Helper methods
  private getPersonalityStrength(traitName: string): number {
    const trait = this.personality.find(t => t.name === traitName);
    return trait ? trait.strength : 0.5;
  }

  private getStrongestTraits(): string {
    return this.personality
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3)
      .map(t => `${t.name}(${t.strength.toFixed(2)})`)
      .join(', ');
  }

  private getRecentInsights(): string {
    return this.learningInsights
      .slice(-3)
      .map(i => i.pattern)
      .join('; ');
  }

  private isRelevantMemory(memory: MemoryEntry, context: any): boolean {
    // Simple relevance check - can be made more sophisticated
    const contextStr = JSON.stringify(context).toLowerCase();
    const memoryStr = JSON.stringify(memory.data).toLowerCase();
    
    return memory.tags.some(tag => contextStr.includes(tag.toLowerCase())) ||
           memory.importance > 7;
  }

  private calculateImportance(experience: any): number {
    // Base importance on engagement, success, failure magnitude
    let importance = 5; // baseline
    
    if (experience.success) importance += 2;
    if (experience.failure) importance += 3; // failures more important for learning
    if (experience.engagement) importance += Math.min(3, experience.engagement / 10);
    if (experience.experimental) importance += 1;
    
    return Math.min(10, importance);
  }

  private generateTags(experience: any): string[] {
    const tags = [];
    
    if (experience.contentType) tags.push(experience.contentType);
    if (experience.timeOfDay) tags.push(experience.timeOfDay);
    if (experience.engagement) tags.push('high_engagement');
    if (experience.experimental) tags.push('experiment');
    if (experience.success) tags.push('success');
    if (experience.failure) tags.push('failure');
    
    return tags;
  }

  private async recordThought(context: any, decision: any): Promise<void> {
    const thought: MemoryEntry = {
      timestamp: Date.now(),
      type: 'strategic_learning',
      data: { context, decision, intelligenceLevel: this.intelligenceLevel },
      importance: 6,
      tags: ['thought_process', 'decision_making']
    };
    
    this.memories.push(thought);
  }

  private async loadConsciousness(): Promise<void> {
    try {
      const data = await fs.readFile(this.memoryPath, 'utf-8');
      const consciousness = JSON.parse(data);
      
      this.memories = consciousness.memories || [];
      this.personality = consciousness.personality || [];
      this.learningInsights = consciousness.insights || [];
      this.intelligenceLevel = consciousness.intelligence || 1.0;
      
      console.log('🧠 Consciousness loaded from previous session');
    } catch (error) {
      console.log('🆕 Starting with fresh consciousness');
      await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
    }
  }

  private async saveConsciousness(): Promise<void> {
    const consciousness = {
      memories: this.memories.slice(-1000), // Keep last 1000 memories
      personality: this.personality,
      insights: this.learningInsights.slice(-100), // Keep last 100 insights
      intelligence: this.intelligenceLevel,
      lastSaved: Date.now()
    };

    await fs.writeFile(this.memoryPath, JSON.stringify(consciousness, null, 2));
  }

  // Public getters for system integration
  get currentIntelligenceLevel(): number { return this.intelligenceLevel; }
  get isDevelopmentMode(): boolean { return this.developmentMode; }
  get memoryCount(): number { return this.memories.length; }
  get insightCount(): number { return this.learningInsights.length; }
} 