import { openaiClient } from '../utils/openaiClient';

interface EngagementOptimization {
  optimizedContent: string;
  improvements: string[];
  expectedEngagementIncrease: number;
  hooks: string[];
  hashtags: string[];
}

export class EngagementOptimizer {
  
  async optimizeForEngagement(content: string): Promise<EngagementOptimization> {
    console.log('🎯 Optimizing content for maximum engagement...');
    
    try {
      // Analyze current content for engagement potential
      const analysis = await this.analyzeEngagementPotential(content);
      
      // Apply engagement optimization techniques
      const optimized = await this.applyEngagementTechniques(content, analysis);
      
      return optimized;
      
    } catch (error) {
      console.warn('Engagement optimization failed, using original content');
      return {
        optimizedContent: content,
        improvements: [],
        expectedEngagementIncrease: 0,
        hooks: [],
        hashtags: [] // HUMAN VOICE: No hashtags
      };
    }
  }
  
  private async analyzeEngagementPotential(content: string): Promise<any> {
    const hasStatistics = /\d+%|\d+\.\d+%|\d+x|\d+ years|\d+ million|\d+ billion/i.test(content);
    const hasEmotionalHook = /breakthrough|revolutionary|game-changer|unprecedented|amazing|incredible/i.test(content);
    const hasUrgency = /now|today|breaking|just|recently|latest/i.test(content);
    const hasCredibleSource = /nature|science|harvard|stanford|mit|fda|who|nih/i.test(content.toLowerCase());
    
    return {
      hasStatistics,
      hasEmotionalHook,
      hasUrgency,
      hasCredibleSource,
      currentScore: this.calculateEngagementScore(content)
    };
  }
  
  private async applyEngagementTechniques(content: string, analysis: any): Promise<EngagementOptimization> {
    let optimizedContent = content;
    const improvements = [];
    const hooks = [];
    
    // Add attention-grabbing hooks if missing
    if (!analysis.hasEmotionalHook) {
      const hook = this.addEngagementHook(content);
      if (hook !== content) {
        optimizedContent = hook;
        improvements.push('Added attention-grabbing hook');
        hooks.push('Emotional hook added');
      }
    }
    
    // Enhance with urgency if missing
    if (!analysis.hasUrgency) {
      optimizedContent = this.addUrgency(optimizedContent);
      improvements.push('Added urgency elements');
    }
    
    // HUMAN VOICE: No hashtag optimization - focus on conversational engagement
    
    // Calculate expected engagement increase
    const expectedIncrease = this.calculateExpectedIncrease(improvements.length, analysis.currentScore);
    
    return {
      optimizedContent,
      improvements,
      expectedEngagementIncrease: expectedIncrease,
      hooks,
      hashtags: [] // HUMAN VOICE: No hashtags
    };
  }
  
  private addEngagementHook(content: string): string {
    const hooks = [
      '🚨 BREAKTHROUGH:',
      '💡 JUST IN:',
      '🔥 GAME-CHANGER:',
      '⚡ REVOLUTIONARY:',
      '🎯 MAJOR UPDATE:',
      '🚀 BREAKTHROUGH:'
    ];
    
    // If content doesn't already start with a hook, add one
    if (!content.match(/^(🚨|💡|🔥|⚡|🎯|🚀)/)) {
      const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
      return `${randomHook} ${content}`;
    }
    
    return content;
  }
  
  private addUrgency(content: string): string {
    const urgencyWords = ['JUST RELEASED:', 'BREAKING:', 'NOW:', 'LATEST:', 'TODAY:'];
    
    // Add urgency if not present
    if (!urgencyWords.some(word => content.includes(word))) {
      // Insert urgency after the first sentence
      const sentences = content.split('. ');
      if (sentences.length > 1) {
        sentences[0] = sentences[0] + ' (JUST RELEASED)';
        return sentences.join('. ');
      }
    }
    
    return content;
  }
  
  private calculateEngagementScore(content: string): number {
    let score = 50; // Base score
    
    // Statistical data (+15)
    if (/\d+%/.test(content)) score += 15;
    
    // Credible source (+20)
    if (/nature|science|harvard|stanford|mit/i.test(content)) score += 20;
    
    // Emotional hook (+10)
    if (/breakthrough|revolutionary|game-changer/i.test(content)) score += 10;
    
    // Specific numbers (+10)
    if (/\d+\.\d+%|\d+ million|\d+ billion/.test(content)) score += 10;
    
    // Professional formatting (+5)
    if (content.includes(':')) score += 5;
    
    // HUMAN VOICE: Bonus for no hashtags (+20)
    if (!content.includes('#')) score += 20;
    
    return Math.min(score, 100);
  }
  
  private calculateExpectedIncrease(improvementCount: number, currentScore: number): number {
    // Each improvement adds 10-15% engagement increase
    const baseIncrease = improvementCount * 12;
    
    // Higher baseline scores get smaller relative increases
    const diminishingReturns = currentScore > 80 ? 0.7 : 1.0;
    
    return Math.round(baseIncrease * diminishingReturns);
  }
} 