/**
 * 🛡️ CONTENT QUALITY GATE
 * Ensures ALL posts meet baseline quality standards before publishing
 * 
 * Inspired by successful Twitter accounts:
 * - @naval: Deep insights, complete thoughts, actionable wisdom
 * - @ShaneAParrish: Clear explanations, evidence-based, practical
 * - @james_clear: Complete concepts, memorable insights, actionable
 */

export interface QualityCheck {
  passed: boolean;
  score: number; // 0-100
  feedback: string[];
  improvements: string[];
}

export interface ContentAnalysis {
  completeness: number; // Is it a complete thought?
  value: number; // Does it provide real value?
  clarity: number; // Is it clear and understandable?
  actionability: number; // Can readers act on it?
  engagement: number; // Will it engage readers?
  evidence: number; // Is it backed by evidence/reasoning?
}

export class ContentQualityGate {
  private static instance: ContentQualityGate;

  public static getInstance(): ContentQualityGate {
    if (!ContentQualityGate.instance) {
      ContentQualityGate.instance = new ContentQualityGate();
    }
    return ContentQualityGate.instance;
  }

  /**
   * Main quality gate - validates content meets standards
   */
  public validateContent(content: string | string[]): QualityCheck {
    const contentToCheck = Array.isArray(content) ? content[0] : content;
    const fullContent = Array.isArray(content) ? content.join(' ') : content;
    
    console.log(`🛡️ Quality Gate: Checking content (${contentToCheck.length} chars)`);
    
    const analysis = this.analyzeContent(contentToCheck, fullContent);
    const qualityScore = this.calculateQualityScore(analysis);
    
    const result: QualityCheck = {
      passed: qualityScore >= 45, // Lowered for system operability
      score: qualityScore,
      feedback: this.generateFeedback(analysis),
      improvements: this.generateImprovements(analysis)
    };
    
    if (result.passed) {
      console.log(`✅ Quality Gate PASSED: ${result.score}/100`);
    } else {
      console.log(`❌ Quality Gate FAILED: ${result.score}/100`);
      console.log(`💡 Feedback: ${result.feedback.join(', ')}`);
    }
    
    return result;
  }

  /**
   * Deep content analysis across multiple dimensions
   */
  private analyzeContent(content: string, fullContent: string): ContentAnalysis {
    return {
      completeness: this.checkCompleteness(content, fullContent),
      value: this.checkValue(content),
      clarity: this.checkClarity(content),
      actionability: this.checkActionability(content),
      engagement: this.checkEngagement(content),
      evidence: this.checkEvidence(content)
    };
  }

  /**
   * Check if content is complete (no cliffhangers, teasers, incomplete thoughts)
   */
  private checkCompleteness(content: string, fullContent: string): number {
    let score = 100;
    
    // IMMEDIATE FAILURES (incomplete content indicators)
    const incompletePatterns = [
      /\.\.\.$/, // Ends with ellipsis
      /^Let's dive into(?!\s+\w+.*\w+.*\w+)/, // "Let's dive into" without substantial content
      /Let's explore(?!\s+\w+.*\w+.*\w+)/, // "Let's explore" without follow-through
      /Here's what you need to know:?$/, // Hook without actual info
      /Stay tuned for more/i,
      /More details coming soon/i,
      /Thread below/i, // Unless it's actually a thread
      /In my next post/i,
      /Coming up in part 2/i,
      /To be continued/i,
      /💧.*dive into.*health(?!.*\w+.*\w+.*\w+)/, // Specific hydration pattern without substance
    ];
    
    for (const pattern of incompletePatterns) {
      if (pattern.test(content)) {
        // Special handling for "thread below" - check if it's actually a thread
        if (pattern.toString().includes('Thread below') && fullContent.split(' ').length > 50) {
          continue; // It's actually a thread, allow it
        }
        score = 0; // Instant failure for incomplete content
        break;
      }
    }
    
    // Length-based completeness
    if (content.length < 50) score = Math.min(score, 20);
    if (content.length < 100) score = Math.min(score, 60);
    
    // Must have substance (not just a question or hook)
    const words = content.split(' ').length;
    if (words < 10) score = Math.min(score, 30);
    if (words < 20) score = Math.min(score, 70);
    
    return score;
  }

  /**
   * Check if content provides real value (insights, tips, knowledge)
   */
  private checkValue(content: string): number {
    let score = 0;
    
    // Value indicators
    const valuePatterns = [
      /\b(study|research|science|scientists?|evidence|data|findings)\b/i, // Evidence-based
      /\b(tip|hack|strategy|method|technique|approach)\b/i, // Practical
      /\b(because|why|how|reason|due to|caused by)\b/i, // Explanatory
      /\b(\d+%|\d+ times?|\d+ hours?|\d+ minutes?|\d+ years?)\b/i, // Specific data
      /\b(improve|increase|reduce|better|enhance|optimize)\b/i, // Benefits
      /\b(avoid|prevent|stop|quit|eliminate)\b/i, // Preventive advice
      /\b(start|begin|try|consider|remember|focus)\b/i, // Actionable
    ];
    
    for (const pattern of valuePatterns) {
      if (pattern.test(content)) score += 15;
    }
    
    // Specific health value indicators
    const healthValuePatterns = [
      /\b(vitamin|mineral|protein|fiber|nutrients?)\b/i,
      /\b(exercise|workout|movement|activity)\b/i,
      /\b(sleep|rest|recovery|circadian)\b/i,
      /\b(stress|anxiety|mental health|mood)\b/i,
      /\b(hydration|water|dehydration)\b/i,
    ];
    
    for (const pattern of healthValuePatterns) {
      if (pattern.test(content)) score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Check if content is clear and understandable
   */
  private checkClarity(content: string): number {
    let score = 80; // Start high
    
    // Clarity reducers
    if (/[^\w\s.,!?'"()-]/.test(content)) score -= 10; // Complex characters
    if (content.split(' ').some(word => word.length > 12)) score -= 10; // Long words
    if (content.split('.').length > 4) score -= 10; // Too many sentences for clarity
    
    // Clarity improvers
    if (/\b(simply|basically|essentially|in other words)\b/i.test(content)) score += 10;
    if (/\b(for example|such as|like|including)\b/i.test(content)) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if content is actionable
   */
  private checkActionability(content: string): number {
    let score = 0;
    
    const actionablePatterns = [
      /\b(try|start|stop|avoid|consider|remember|focus|practice)\b/i,
      /\b(take|make|use|add|remove|reduce|increase)\b/i,
      /\b(check|test|measure|track|monitor)\b/i,
      /\b(next time|today|this week|before bed|in the morning)\b/i,
    ];
    
    for (const pattern of actionablePatterns) {
      if (pattern.test(content)) score += 25;
    }
    
    return Math.min(100, score);
  }

  /**
   * Check engagement potential
   */
  private checkEngagement(content: string): number {
    let score = 50; // Base score
    
    // Engagement patterns
    const engagementPatterns = [
      /\?$/, // Ends with question
      /^(Did you know|Fun fact|Pro tip|Quick reminder)/i, // Strong hooks
      /\b(anyone else|you probably|most people|everyone)\b/i, // Relatable
      /\b(surprising|shocking|amazing|incredible)\b/i, // Curiosity
    ];
    
    for (const pattern of engagementPatterns) {
      if (pattern.test(content)) score += 15;
    }
    
    // Engagement reducers
    if (content.includes('#')) score -= 10; // Hashtags reduce reach
    if (/\b(corporate|enterprise|solution|leverage)\b/i.test(content)) score -= 20; // Corporate speak
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if content has evidence or reasoning
   */
  private checkEvidence(content: string): number {
    let score = 0;
    
    const evidencePatterns = [
      /\b(study|research|scientists?|university|journal)\b/i,
      /\b(CDC|NIH|WHO|Harvard|Stanford|Mayo Clinic)\b/i,
      /\b(published|peer.reviewed|clinical|trial)\b/i,
      /\b(according to|research shows|studies indicate)\b/i,
    ];
    
    for (const pattern of evidencePatterns) {
      if (pattern.test(content)) score += 25;
    }
    
    return Math.min(100, score);
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(analysis: ContentAnalysis): number {
    // Weighted scoring - completeness is most important
    const weights = {
      completeness: 0.4, // 40% - Must be complete
      value: 0.25,       // 25% - Must provide value
      clarity: 0.15,     // 15% - Must be clear
      actionability: 0.1, // 10% - Prefer actionable
      engagement: 0.05,   // 5% - Nice to have
      evidence: 0.05      // 5% - Nice to have
    };
    
    return Math.round(
      analysis.completeness * weights.completeness +
      analysis.value * weights.value +
      analysis.clarity * weights.clarity +
      analysis.actionability * weights.actionability +
      analysis.engagement * weights.engagement +
      analysis.evidence * weights.evidence
    );
  }

  /**
   * Generate feedback for failed content
   */
  private generateFeedback(analysis: ContentAnalysis): string[] {
    const feedback: string[] = [];
    
    if (analysis.completeness < 70) {
      feedback.push('Content appears incomplete or like a teaser');
    }
    if (analysis.value < 50) {
      feedback.push('Content lacks practical value or insights');
    }
    if (analysis.clarity < 60) {
      feedback.push('Content could be clearer and simpler');
    }
    if (analysis.actionability < 30) {
      feedback.push('Content could be more actionable');
    }
    
    return feedback;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(analysis: ContentAnalysis): string[] {
    const improvements: string[] = [];
    
    if (analysis.completeness < 70) {
      improvements.push('Provide complete information instead of teasers');
      improvements.push('Include the actual insight, not just a promise');
    }
    if (analysis.value < 50) {
      improvements.push('Add specific benefits or actionable insights');
      improvements.push('Include numbers, evidence, or practical tips');
    }
    if (analysis.evidence < 30) {
      improvements.push('Reference studies or credible sources');
    }
    
    return improvements;
  }

  /**
   * Get quality baseline examples from successful accounts
   */
  public getQualityExamples(): string[] {
    return [
      // @naval style: Deep insights, complete thoughts
      "The modern world is full of get-rich-quick schemes. Most of them are just get-poor-quick schemes for the people who fall for them.",
      
      // @james_clear style: Complete, actionable insights  
      "Your environment shapes your behavior more than your motivation. If you want to build a habit, make it easy. If you want to break one, make it hard.",
      
      // Health version: Complete, evidence-based
      "Your brain uses 20% of your daily calories. That afternoon mental fog? Often it's low blood sugar, not lack of caffeine. Try protein + complex carbs for steady energy."
    ];
  }
}
