/**
 * 🎯 CONTENT QUALITY ENHANCER
 * Improves content quality based on recent tweet analysis
 * 
 * Addresses specific issues seen in @SignalAndSynapse recent posts:
 * - Overuse of "BREAKING"
 * - Generic statistics
 * - Weak CTAs
 * - Missing personality
 */

import { IMPROVED_CONTENT_STRATEGY, VIRAL_HEALTH_FORMULAS } from './improvedContentStrategy';

interface QualityMetrics {
  hookVariety: number; // 0-1 score for hook diversity
  authorityLevel: number; // 0-1 score for credibility
  engagementPotential: number; // 0-1 score for engagement
  uniqueVoice: number; // 0-1 score for personality
  overallQuality: number; // Combined score
}

export class ContentQualityEnhancer {
  private static instance: ContentQualityEnhancer;
  private recentHooks: string[] = [];
  private bannedPhrases = ['🚨 BREAKING', 'Did you know that', 'Are you getting enough'];

  public static getInstance(): ContentQualityEnhancer {
    if (!ContentQualityEnhancer.instance) {
      ContentQualityEnhancer.instance = new ContentQualityEnhancer();
    }
    return ContentQualityEnhancer.instance;
  }

  /**
   * 🎯 ENHANCE CONTENT QUALITY
   * Main method to improve any generated content
   */
  public async enhanceContent(originalContent: string, topic: string): Promise<{
    enhancedContent: string;
    qualityScore: QualityMetrics;
    improvements: string[];
  }> {
    console.log('🎯 QUALITY_ENHANCER: Analyzing and improving content...');

    // Analyze current quality
    const currentQuality = this.analyzeQuality(originalContent);
    
    // Apply improvements
    const enhancedContent = await this.applyQualityImprovements(originalContent, topic, currentQuality);
    
    // Re-analyze improved quality
    const improvedQuality = this.analyzeQuality(enhancedContent);
    
    // Track improvements made
    const improvements = this.getImprovementsList(currentQuality, improvedQuality);

    return {
      enhancedContent,
      qualityScore: improvedQuality,
      improvements
    };
  }

  /**
   * 📊 ANALYZE CONTENT QUALITY
   */
  private analyzeQuality(content: string): QualityMetrics {
    const hookVariety = this.scoreHookVariety(content);
    const authorityLevel = this.scoreAuthority(content);
    const engagementPotential = this.scoreEngagement(content);
    const uniqueVoice = this.scoreVoice(content);
    
    const overallQuality = (hookVariety + authorityLevel + engagementPotential + uniqueVoice) / 4;

    return {
      hookVariety,
      authorityLevel,
      engagementPotential,
      uniqueVoice,
      overallQuality
    };
  }

  /**
   * 🔧 APPLY QUALITY IMPROVEMENTS
   */
  private async applyQualityImprovements(
    content: string, 
    topic: string, 
    currentQuality: QualityMetrics
  ): Promise<string> {
    let improved = content;

    // 1. Fix overused hooks
    if (currentQuality.hookVariety < 0.6) {
      improved = this.improveHook(improved);
    }

    // 2. Add authority/sources
    if (currentQuality.authorityLevel < 0.7) {
      improved = this.addAuthority(improved, topic);
    }

    // 3. Enhance engagement
    if (currentQuality.engagementPotential < 0.7) {
      improved = this.improveEngagement(improved);
    }

    // 4. Add unique voice
    if (currentQuality.uniqueVoice < 0.6) {
      improved = this.addPersonality(improved, topic);
    }

    // 5. Final polish
    improved = this.finalPolish(improved);

    return improved;
  }

  /**
   * 🎪 IMPROVE HOOK VARIETY
   */
  private improveHook(content: string): string {
    // Remove overused patterns
    let improved = content;

    // Replace "🚨 BREAKING:" with varied hooks
    if (improved.includes('🚨 BREAKING:')) {
      const availableHooks = IMPROVED_CONTENT_STRATEGY.hookVariations.filter(
        hook => !this.recentHooks.includes(hook)
      );
      
      if (availableHooks.length > 0) {
        const selectedHook = availableHooks[Math.floor(Math.random() * availableHooks.length)];
        improved = improved.replace('🚨 BREAKING:', selectedHook);
        this.recentHooks.push(selectedHook);
        
        // Keep only last 10 hooks to prevent repetition
        if (this.recentHooks.length > 10) {
          this.recentHooks.shift();
        }
      }
    }

    // Replace "Did you know that" with more engaging alternatives
    if (improved.includes('Did you know that')) {
      const alternatives = [
        'New research reveals:',
        'Scientists discovered:',
        'Here\'s what surprised researchers:',
        'Plot twist:',
        'The data shows:'
      ];
      const selected = alternatives[Math.floor(Math.random() * alternatives.length)];
      improved = improved.replace('Did you know that', selected);
    }

    return improved;
  }

  /**
   * 🏛️ ADD AUTHORITY
   */
  private addAuthority(content: string, topic: string): string {
    // Add specific sources where generic stats appear
    let improved = content;

    // Replace vague percentages with sourced ones
    const vaguePatterns = [
      /(\d+)% of (health enthusiasts|people)/g,
      /most people/gi,
      /studies show/gi,
      /research indicates/gi
    ];

    const authorities = IMPROVED_CONTENT_STRATEGY.authorityBuilders;
    
    vaguePatterns.forEach(pattern => {
      if (pattern.test(improved)) {
        const authority = authorities[Math.floor(Math.random() * authorities.length)];
        improved = improved.replace(pattern, authority);
      }
    });

    return improved;
  }

  /**
   * 🎯 IMPROVE ENGAGEMENT
   */
  private improveEngagement(content: string): string {
    let improved = content;

    // Add engaging CTAs instead of generic endings
    const genericEndings = [
      /optimize your health.*/gi,
      /check your diet.*/gi,
      /are you getting enough.*/gi
    ];

    const engagementTactics = IMPROVED_CONTENT_STRATEGY.engagementTactics;

    genericEndings.forEach(pattern => {
      if (pattern.test(improved)) {
        const tactic = engagementTactics[Math.floor(Math.random() * engagementTactics.length)];
        improved = improved.replace(pattern, tactic);
      }
    });

    return improved;
  }

  /**
   * 🎭 ADD PERSONALITY
   */
  private addPersonality(content: string, topic: string): string {
    let improved = content;

    // Add voice elements to make content more personal
    const voiceElements = IMPROVED_CONTENT_STRATEGY.voiceElements;
    
    // Insert personality at strategic points
    if (improved.length > 100 && !this.hasPersonalTouch(improved)) {
      const voiceElement = voiceElements[Math.floor(Math.random() * voiceElements.length)];
      
      // Insert after the first sentence
      const sentences = improved.split('. ');
      if (sentences.length > 1) {
        sentences.splice(1, 0, voiceElement);
        improved = sentences.join('. ');
      }
    }

    return improved;
  }

  /**
   * ✨ FINAL POLISH
   */
  private finalPolish(content: string): string {
    let improved = content;

    // Remove redundant emojis
    improved = improved.replace(/🔥+/g, '🔥');
    improved = improved.replace(/✅+/g, '✅');
    
    // Fix spacing
    improved = improved.replace(/\s+/g, ' ').trim();
    
    // Ensure proper punctuation
    if (!improved.match(/[.!?]$/)) {
      improved += '.';
    }

    return improved;
  }

  // Scoring methods
  private scoreHookVariety(content: string): number {
    const bannedPhraseCount = this.bannedPhrases.filter(phrase => 
      content.toLowerCase().includes(phrase.toLowerCase())
    ).length;
    
    return Math.max(0, 1 - (bannedPhraseCount * 0.3));
  }

  private scoreAuthority(content: string): number {
    const authorityIndicators = [
      /study/gi, /research/gi, /university/gi, /journal/gi, 
      /scientists/gi, /clinical/gi, /peer.?reviewed/gi,
      /harvard/gi, /stanford/gi, /mayo clinic/gi
    ];
    
    const matches = authorityIndicators.filter(pattern => pattern.test(content)).length;
    return Math.min(1, matches * 0.25);
  }

  private scoreEngagement(content: string): number {
    const engagementElements = [
      /\?/g, // Questions
      /comment/gi, /share/gi, /thoughts/gi, /experience/gi,
      /try this/gi, /rate/gi, /tag someone/gi
    ];
    
    const matches = engagementElements.filter(pattern => pattern.test(content)).length;
    return Math.min(1, matches * 0.2);
  }

  private scoreVoice(content: string): number {
    const personalElements = [
      /I('ve|'d|'m| )/gi, /my /gi, /here's what/gi, /what I/gi,
      /uncomfortable truth/gi, /won't tell you/gi, /changed my mind/gi
    ];
    
    const matches = personalElements.filter(pattern => pattern.test(content)).length;
    return Math.min(1, matches * 0.3);
  }

  private hasPersonalTouch(content: string): boolean {
    return this.scoreVoice(content) > 0.3;
  }

  private getImprovementsList(before: QualityMetrics, after: QualityMetrics): string[] {
    const improvements: string[] = [];

    if (after.hookVariety > before.hookVariety) improvements.push('Improved hook variety');
    if (after.authorityLevel > before.authorityLevel) improvements.push('Added authority/sources');
    if (after.engagementPotential > before.engagementPotential) improvements.push('Enhanced engagement');
    if (after.uniqueVoice > before.uniqueVoice) improvements.push('Added personality');

    return improvements;
  }

  /**
   * 📊 GET QUALITY REPORT
   */
  public getQualityReport(): {
    recentHookUsage: string[];
    bannedPhrasesDetected: number;
    averageQualityScore: number;
  } {
    return {
      recentHookUsage: [...this.recentHooks],
      bannedPhrasesDetected: 0, // Would track over time
      averageQualityScore: 0.8 // Would calculate from recent posts
    };
  }
}

export const getContentQualityEnhancer = () => ContentQualityEnhancer.getInstance();
