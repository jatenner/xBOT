/**
 * OPTIMIZATION-AWARE CONTENT ENGINE
 * 
 * This engine ACTUALLY applies engagement optimization insights to content generation.
 * Unlike the old Social Operator, this directly uses algorithm feedback to improve posts.
 */

import { EngagementOptimizer, OptimizationInsight, ViralPrediction } from '../intelligence/engagementOptimizer';
import { SophisticatedContentEngine } from './sophisticatedContentEngine';
import { HumanAuthenticityEngine } from './humanAuthenticityEngine';

interface OptimizedContent {
  content: string;
  appliedInsights: string[];
  viralPrediction: ViralPrediction;
  optimizationScore: number;
  engagementPotential: number;
}

interface ViralHookTypes {
  money_confession: string[];
  insider_secrets: string[];
  controversy_starters: string[];
  personal_failures: string[];
  industry_callouts: string[];
}

export class OptimizationAwareContentEngine {
  private static instance: OptimizationAwareContentEngine;
  private engagementOptimizer: EngagementOptimizer;
  private sophisticatedEngine: SophisticatedContentEngine;
  private humanAuthenticityEngine: HumanAuthenticityEngine;
  private currentInsights: OptimizationInsight[] = [];
  
  // Viral content templates based on optimization insights
  private viralHooks: ViralHookTypes = {
    money_confession: [
      "I spent $5,000 learning this health secret...",
      "I wasted $2,000 on supplements before realizing...",
      "Rich people know this, poor people get told lies:",
      "I lost $3,000 believing this health myth:",
      "Former medical insider reveals the $X truth:"
    ],
    insider_secrets: [
      "Former pharmaceutical researcher here:",
      "Ex-supplement industry executive reveals:",
      "Medical insider confession:",
      "I worked in big pharma for 10 years. Here's what they don't want you to know:",
      "Plot twist: I used to design these scams..."
    ],
    controversy_starters: [
      "Unpopular opinion:",
      "Every doctor tells you X. They're wrong.",
      "Plot twist: Everything you know about X is backwards",
      "Hot take that will make you angry:",
      "This will destroy your worldview:"
    ],
    personal_failures: [
      "I destroyed my health for 5 years doing what doctors told me",
      "My biggest health mistake cost me $X and 2 years",
      "I was the poster child for healthy living. Then I crashed.",
      "I followed every health guru's advice. Here's what happened:",
      "I biohacked myself into a health disaster:"
    ],
    industry_callouts: [
      "The supplement industry is lying to you about:",
      "Big pharma profits from your confusion about:",
      "The fitness industry doesn't want you to know:",
      "Medical establishment hides this because:",
      "They make billions keeping you sick with:"
    ]
  };

  private constructor() {
    this.engagementOptimizer = EngagementOptimizer.getInstance();
    this.sophisticatedEngine = SophisticatedContentEngine.getInstance();
    this.humanAuthenticityEngine = HumanAuthenticityEngine.getInstance();
  }

  public static getInstance(): OptimizationAwareContentEngine {
    if (!OptimizationAwareContentEngine.instance) {
      OptimizationAwareContentEngine.instance = new OptimizationAwareContentEngine();
    }
    return OptimizationAwareContentEngine.instance;
  }

  /**
   * Generate content that ACTUALLY applies optimization insights
   */
  async generateOptimizedContent(topic: string): Promise<OptimizedContent> {
    console.log('🎯 OPTIMIZATION_ENGINE: Generating content with applied insights');
    
    try {
      // 1. Get current optimization insights
      this.currentInsights = await this.engagementOptimizer.analyzeEngagementGaps();
      console.log(`📊 Found ${this.currentInsights.length} optimization insights to apply`);

      // 2. Apply top 3 insights to content generation
      const topInsights = this.currentInsights.slice(0, 3);
      let content = await this.generateContentWithInsights(topic, topInsights);
      
      // 3. Test viral prediction
      const viralPrediction = await this.engagementOptimizer.predictViralPotential(content);
      
      // 4. Humanize the content for authenticity
      console.log('🎭 Humanizing content for authenticity...');
      const humanizedContent = this.humanAuthenticityEngine.humanizeContent(content, topic);
      content = humanizedContent.content;
      
      // 5. Optimize further if prediction is low
      if (viralPrediction.viral_probability < 0.7) {
        console.log('🔄 Low viral prediction, applying additional optimization...');
        content = await this.enhanceContentForViral(content, viralPrediction);
      }
      
      // 6. Final viral prediction
      const finalPrediction = await this.engagementOptimizer.predictViralPotential(content);
      
      const result: OptimizedContent = {
        content,
        appliedInsights: topInsights.map(i => i.recommended_action),
        viralPrediction: finalPrediction,
        optimizationScore: this.calculateOptimizationScore(topInsights),
        engagementPotential: Math.round(finalPrediction.viral_probability * 100)
      };

      console.log(`✅ Generated optimized content with ${result.engagementPotential}% engagement potential`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error generating optimized content:', error);
      
      // Fallback to sophisticated engine
      const fallbackContent = await this.sophisticatedEngine.generateUniqueContent(topic, 'medium', 'single');
      
      return {
        content: fallbackContent.content,
        appliedInsights: ['Fallback: Used sophisticated engine'],
        viralPrediction: {
          predicted_followers: 1,
          predicted_likes: 5,
          predicted_shares: 1,
          viral_probability: 0.3,
          optimization_suggestions: ['Add controversy', 'Strengthen hook'],
          engagement_multipliers: {
            hook_multiplier: 1.0,
            timing_multiplier: 1.0,
            format_multiplier: 1.0,
            topic_multiplier: 1.0
          }
        },
        optimizationScore: 50,
        engagementPotential: 30
      };
    }
  }

  /**
   * Generate content applying specific optimization insights
   */
  private async generateContentWithInsights(topic: string, insights: OptimizationInsight[]): Promise<string> {
    let content = '';
    const appliedStrategies: string[] = [];

    // Apply insight #1: Provocative hooks
    const hookInsight = insights.find(i => i.problem.includes('hooks are not provocative'));
    if (hookInsight) {
      const hook = this.selectViralHook(topic);
      content += hook + '\n\n';
      appliedStrategies.push('Provocative hook');
    }

    // Apply insight #2: Controversy
    const controversyInsight = insights.find(i => i.problem.includes('too safe'));
    if (controversyInsight) {
      const controversialTake = this.generateControversialTake(topic);
      content += controversialTake + '\n\n';
      appliedStrategies.push('Controversial take');
    }

    // Apply insight #3: Emotional triggers
    const emotionalInsight = insights.find(i => i.problem.includes('emotional triggers'));
    if (emotionalInsight) {
      const emotionalTrigger = this.generateEmotionalTrigger(topic);
      content += emotionalTrigger + '\n\n';
      appliedStrategies.push('Emotional trigger');
    }

    // Apply insight #4: Strong CTA
    const ctaInsight = insights.find(i => i.problem.includes('call-to-action'));
    if (ctaInsight) {
      const cta = this.generateConfrontationalCTA();
      content += cta;
      appliedStrategies.push('Confrontational CTA');
    }

    console.log(`🎯 Applied strategies: ${appliedStrategies.join(', ')}`);
    
    return content.trim();
  }

  /**
   * Select viral hook based on topic and insights
   */
  private selectViralHook(topic: string): string {
    const hookTypes = Object.keys(this.viralHooks) as (keyof ViralHookTypes)[];
    
    // Choose hook type based on topic
    let selectedType: keyof ViralHookTypes = 'money_confession';
    
    if (topic.includes('supplement') || topic.includes('industry')) {
      selectedType = 'insider_secrets';
    } else if (topic.includes('myth') || topic.includes('belief')) {
      selectedType = 'controversy_starters';
    } else if (topic.includes('mistake') || topic.includes('failure')) {
      selectedType = 'personal_failures';
    } else if (topic.includes('pharma') || topic.includes('medical')) {
      selectedType = 'industry_callouts';
    }

    const hooks = this.viralHooks[selectedType];
    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  /**
   * Generate controversial take that challenges common beliefs
   */
  private generateControversialTake(topic: string): string {
    const controversialTakes = [
      `Most people believe ${topic} is simple. They're wrong.`,
      `Everything doctors tell you about ${topic} is backwards.`,
      `The ${topic} industry profits from your confusion.`,
      `${topic} advice is designed to keep you dependent, not healthy.`,
      `Your problems with ${topic} aren't your fault - you've been lied to.`,
      `The science on ${topic} has been corrupted by money.`,
      `${topic} marketing preys on desperate people.`,
      `Medical schools don't teach the truth about ${topic}.`
    ];

    return controversialTakes[Math.floor(Math.random() * controversialTakes.length)];
  }

  /**
   * Generate emotional trigger with personal stakes
   */
  private generateEmotionalTrigger(topic: string): string {
    const emotionalTriggers = [
      `Most people are suffering because they don't understand ${topic}.`,
      `Your struggles with ${topic} could have been avoided if someone told you the truth.`,
      `I've seen too many people destroy their health following mainstream ${topic} advice.`,
      `The emotional cost of bad ${topic} advice is devastating families.`,
      `${topic} misinformation is stealing years from people's lives.`,
      `I can't stay silent about what ${topic} industries are doing to people.`,
      `Every day you follow conventional ${topic} wisdom, you're moving backwards.`
    ];

    return emotionalTriggers[Math.floor(Math.random() * emotionalTriggers.length)];
  }

  /**
   * Generate confrontational call-to-action
   */
  private generateConfrontationalCTA(): string {
    const ctas = [
      "Fight me in the comments.",
      "Change my mind.",
      "Tell me I'm wrong.",
      "Prove me wrong below.",
      "Come at me with your disagreements.",
      "I dare you to defend the status quo.",
      "Ready to argue? Let's go.",
      "Bring your strongest counterargument."
    ];

    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  /**
   * Enhance content for viral potential
   */
  private async enhanceContentForViral(content: string, prediction: ViralPrediction): Promise<string> {
    let enhanced = content;

    // Apply optimization suggestions
    for (const suggestion of prediction.optimization_suggestions) {
      if (suggestion.includes('stronger hook') && !enhanced.includes('Plot twist')) {
        enhanced = 'Plot twist: ' + enhanced;
      }
      
      if (suggestion.includes('controversial') && !enhanced.includes('wrong')) {
        enhanced = enhanced.replace(/\./g, '. Everyone tells you the opposite - they\'re wrong.');
      }
      
      if (suggestion.includes('emotional') && !enhanced.includes('devastat')) {
        enhanced += '\n\nThis misinformation is devastating people.';
      }
    }

    return enhanced;
  }

  /**
   * Calculate optimization score based on applied insights
   */
  private calculateOptimizationScore(insights: OptimizationInsight[]): number {
    const totalImpact = insights.reduce((sum, insight) => sum + insight.impact_score, 0);
    const avgSuccessProb = insights.reduce((sum, insight) => sum + insight.success_probability, 0) / insights.length;
    
    return Math.round((totalImpact / 30) * 50 + avgSuccessProb * 50);
  }

  /**
   * Get current optimization insights for monitoring
   */
  async getCurrentInsights(): Promise<OptimizationInsight[]> {
    if (this.currentInsights.length === 0) {
      this.currentInsights = await this.engagementOptimizer.analyzeEngagementGaps();
    }
    return this.currentInsights;
  }
}
