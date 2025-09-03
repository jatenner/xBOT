/**
 * Quality Gate - Enhanced rubric-based scoring system (0-100)
 * Ensures content meets standards for health, contextuality, and engagement
 */

interface QualityMetrics {
  hookClarity: number;        // 25 points
  bigIdea: number;           // 15 points
  actionability: number;     // 20 points
  novelty: number;           // 20 points
  readability: number;       // 10 points
  humanTone: number;         // 10 points
  overallScore: number;      // 0-100 total
}

interface QualityResult {
  passed: boolean;
  score: QualityMetrics;
  rationale: string;
  suggestions?: string[];
  autoRevised?: boolean;
  revisedContent?: string;
}

export class QualityGate {
  private readonly minThreshold = 80; // Require ≥80 to post
  private readonly revisionThreshold = 70; // Auto-revise if 70-79
  private readonly medicalClaims = [
    'cure', 'treat', 'diagnosis', 'prescribe', 'medical advice',
    'disease', 'disorder', 'syndrome', 'condition', 'therapy',
    'medication', 'drug', 'supplement dosage', 'clinical'
  ];

  /**
   * Evaluate thread quality using enhanced 0-100 rubric
   */
  async evaluateThread(tweets: string[]): Promise<QualityResult> {
    const content = tweets.join('\n');
    const metrics = this.calculateMetrics(content, 'thread');
    
    // Check if auto-revision needed (70-79 score)
    if (metrics.overallScore >= this.revisionThreshold && metrics.overallScore < this.minThreshold) {
      const revised = await this.autoReviseContent(content, metrics, 'thread');
      if (revised) {
        const revisedMetrics = this.calculateMetrics(revised, 'thread');
        return {
          passed: revisedMetrics.overallScore >= this.minThreshold,
          score: revisedMetrics,
          rationale: this.generateRationale(revisedMetrics, 'thread'),
          suggestions: revisedMetrics.overallScore >= this.minThreshold ? undefined : this.generateSuggestions(revisedMetrics, 'thread'),
          autoRevised: true,
          revisedContent: revised
        };
      }
    }
    
    const isSafe = this.checkSafety(content);
    const passed = metrics.overallScore >= this.minThreshold && isSafe;
    
    return {
      passed,
      score: metrics,
      rationale: this.generateRationale(metrics, 'thread') + (isSafe ? '' : ' Safety issues detected.'),
      suggestions: passed ? undefined : this.generateSuggestions(metrics, 'thread')
    };
  }

  /**
   * Evaluate reply quality with focus on contextuality
   */
  async evaluateReply(reply: string, originalTweet: string): Promise<QualityResult> {
    const metrics = this.calculateMetrics(reply, 'reply');
    const isSafe = this.checkSafety(reply);
    
    // For replies, we need safety + minimum score
    const passed = metrics.overallScore >= this.minThreshold && isSafe;
    
    return {
      passed,
      score: metrics,
      rationale: this.generateRationale(metrics, 'reply') + (isSafe ? '' : ' Safety issues detected.'),
      suggestions: passed ? undefined : this.generateSuggestions(metrics, 'reply')
    };
  }

  /**
   * Calculate quality metrics using 0-100 rubric with specific weights
   */
  private calculateMetrics(content: string, contentType: 'thread' | 'reply'): QualityMetrics {
    const hookClarity = this.evaluateHookClarity(content); // 25 points
    const bigIdea = this.evaluateBigIdea(content); // 15 points  
    const actionability = this.evaluateActionability(content); // 20 points
    const novelty = this.evaluateNovelty(content); // 20 points
    const readability = this.evaluateReadability(content); // 10 points
    const humanTone = this.evaluateHumanTone(content); // 10 points
    
    const overallScore = hookClarity + bigIdea + actionability + novelty + readability + humanTone;
    
    return {
      hookClarity,
      bigIdea,
      actionability,
      novelty,
      readability,
      humanTone,
      overallScore
    };
  }

  /**
   * Evaluate hook clarity/specificity (25 points)
   */
  private evaluateHookClarity(content: string): number {
    const firstSentence = content.split(/[.!?\n]/)[0] || content;
    let score = 16; // Base score
    
    // Strong hook indicators (+points)
    const strongPatterns = [
      { pattern: /\d+/, points: 7 }, // Contains numbers
      { pattern: /I (fixed|discovered|learned|found)/i, points: 6 }, // Personal experience
      { pattern: /why .+ (is|are) wrong/i, points: 8 }, // Contrarian
      { pattern: /the .+ (mistake|secret|truth)/i, points: 7 }, // Intrigue
      { pattern: /what .+ don't tell you/i, points: 6 }, // Insider knowledge
      { pattern: /(counterintuitive|surprising|myth)/i, points: 6 }, // Surprise
      { pattern: /before.*after/i, points: 5 }, // Transformation
      { pattern: /80\/20|pareto/i, points: 5 } // Focus principle
    ];
    
    strongPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(firstSentence)) score += points;
    });
    
    // Combo bonuses for multiple strong elements
    const hasNumbers = /\d+/.test(firstSentence);
    const hasPersonal = /I (fixed|discovered|learned|found)/i.test(firstSentence);
    const hasCounterIntuitive = /(counterintuitive|surprising|myth|secret)/i.test(firstSentence);
    
    if (hasNumbers && hasPersonal) score += 5; // Numbers + personal experience
    if (hasCounterIntuitive && (hasNumbers || hasPersonal)) score += 5; // Counter-intuitive + evidence
    
    // Weak hook indicators (-points)
    const weakPatterns = [
      { pattern: /^(hey|hi|hello)/i, points: -7 }, // Generic greeting
      { pattern: /let's talk about/i, points: -6 }, // Vague opening
      { pattern: /today I want to/i, points: -5 }, // Announcement style
      { pattern: /^(tips|advice) (for|about)/i, points: -5 }, // Generic tips
      { pattern: /^here are/i, points: -5 }, // List dump
      { pattern: /is good and important/i, points: -6 }, // Bland statements
      { pattern: /you should generally/i, points: -5 }, // Weak advice
      { pattern: /there are many things/i, points: -5 }, // Vague content
      { pattern: /health.*everyone/i, points: -4 } // Generic health advice
    ];
    
    weakPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(firstSentence)) score += points;
    });
    
    return Math.max(0, Math.min(25, score));
  }

  /**
   * Evaluate big idea focus (15 points)
   */
  private evaluateBigIdea(content: string): number {
    let score = 10; // Base score
    
    // Single clear concept indicators
    const focusPatterns = [
      { pattern: /one (key|simple|big|main)/i, points: 4 },
      { pattern: /the (single|only) thing/i, points: 5 },
      { pattern: /here's what (matters|works)/i, points: 3 },
      { pattern: /bottom line/i, points: 3 },
      { pattern: /the real (reason|problem|solution)/i, points: 4 }
    ];
    
    focusPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) score += points;
    });
    
    // Multiple ideas penalty
    const scatteringPenalties = [
      { pattern: /(first|second|third).+(fourth|fifth)/i, points: -4 },
      { pattern: /and also|plus|additionally/g, points: -2 }, // Per instance
      { pattern: /meanwhile|however|but also/i, points: -3 },
      { pattern: /many things.*can do/i, points: -3 }, // Generic advice
      { pattern: /wellness.*journey/i, points: -2 } // Cliche phrasing
    ];
    
    scatteringPenalties.forEach(({ pattern, points }) => {
      const matches = content.match(pattern);
      if (matches) {
        score += points * matches.length;
      }
    });
    
    return Math.max(0, Math.min(15, score));
  }

  /**
   * Evaluate actionability/micro-steps (20 points)
   */
  private evaluateActionability(content: string): number {
    let score = 13; // Base score
    
    // Actionable language
    const actionPatterns = [
      { pattern: /(try|do|start|stop) this/i, points: 5 },
      { pattern: /(step \d+|first|next|then)/gi, points: 3 }, // Per step
      { pattern: /\d+\s*(minutes?|hours?|days?|weeks?)/gi, points: 3 }, // Time specifics
      { pattern: /(exactly|specifically|precisely)/gi, points: 2 }, // Precision
      { pattern: /set (a|an|your)/i, points: 3 },
      { pattern: /write (down|it)/i, points: 3 },
      { pattern: /(measure|track|count)/i, points: 3 }
    ];
    
    actionPatterns.forEach(({ pattern, points }) => {
      const matches = content.match(pattern);
      if (matches) {
        score += points * Math.min(matches.length, 3); // Cap at 3 instances
      }
    });
    
    // Vague language penalties
    const vaguePenalties = [
      { pattern: /generally|usually|often|sometimes|might/gi, points: -2 },
      { pattern: /some people|many experts|studies show/gi, points: -3 },
      { pattern: /hopefully this helps/gi, points: -3 },
      { pattern: /try to be|should be/gi, points: -2 }
    ];
    
    vaguePenalties.forEach(({ pattern, points }) => {
      const matches = content.match(pattern);
      if (matches) {
        score += points * matches.length;
      }
    });
    
    return Math.max(0, Math.min(20, score));
  }

  /**
   * Evaluate novelty/insight (20 points)
   */
  private evaluateNovelty(content: string): number {
    let score = 10; // Base score
    
    // Novel insight patterns
    const noveltyPatterns = [
      { pattern: /turns out|it turns out/i, points: 5 },
      { pattern: /counterintuitive/i, points: 6 },
      { pattern: /(myth|misconception|wrong about)/i, points: 5 },
      { pattern: /most people (think|believe|assume)/i, points: 4 },
      { pattern: /hidden|secret|behind the scenes/i, points: 4 },
      { pattern: /plot twist|surprising/i, points: 4 },
      { pattern: /new research|recent study/i, points: 3 }
    ];
    
    noveltyPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) score += points;
    });
    
    // Cliche penalties
    const clichePenalties = [
      { pattern: /at the end of the day/i, points: -3 },
      { pattern: /it's all about|everything is/i, points: -2 },
      { pattern: /just (do|be|think)/i, points: -2 },
      { pattern: /common sense|obvious/i, points: -2 }
    ];
    
    clichePenalties.forEach(({ pattern, points }) => {
      if (pattern.test(content)) score += points;
    });
    
    return Math.max(0, Math.min(20, score));
  }

  /**
   * Evaluate readability (10 points)
   */
  private evaluateReadability(content: string): number {
    let score = 8; // Base score
    
    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((acc, s) => acc + s.trim().split(/\s+/).length, 0) / sentences.length;
    
    if (avgSentenceLength <= 15) score += 2; // Short sentences
    else if (avgSentenceLength > 25) score -= 2; // Too long
    
    // Formatting bonuses
    const formatPatterns = [
      { pattern: /^\s*[-•*]/m, points: 1 }, // Bullet points
      { pattern: /\n\n/g, points: 1 }, // Paragraph breaks
      { pattern: /\d+\./g, points: 1 } // Numbered lists
    ];
    
    formatPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) score += points;
    });
    
    // Readability penalties
    if (content.includes('(')) score -= 1; // Parenthetical asides
    if (/[;:]/.test(content)) score -= 1; // Complex punctuation
    
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Evaluate human tone (10 points)
   */
  private evaluateHumanTone(content: string): number {
    let score = 4; // Base score
    
    // Conversational patterns
    const humanPatterns = [
      { pattern: /I (learned|discovered|found|tried)/i, points: 3 },
      { pattern: /you (might|could|can)/i, points: 2 },
      { pattern: /here's (what|why|how)/i, points: 2 },
      { pattern: /(honestly|frankly|real talk)/i, points: 3 },
      { pattern: /this (changed|helped|worked)/i, points: 2 },
      { pattern: /for me/i, points: 2 }, // Personal reference
      { pattern: /hard way/i, points: 2 }, // Conversational phrase
      { pattern: /dealing with/i, points: 1 } // Empathetic language
    ];
    
    humanPatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) score += points;
    });
    
    // Lecture-y penalties
    const lecturePatterns = [
      { pattern: /one must|one should/i, points: -2 },
      { pattern: /it is (important|crucial|essential)/i, points: -1 },
      { pattern: /furthermore|moreover|therefore/i, points: -1 },
      { pattern: /in conclusion|to summarize/i, points: -2 },
      { pattern: /hopefully this helps/i, points: -3 }, // Generic sign-off
      { pattern: /your.*journey/i, points: -2 } // Cliche phrasing
    ];
    
    lecturePatterns.forEach(({ pattern, points }) => {
      if (pattern.test(content)) score += points;
    });
    
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Auto-revise content that scores 70-79
   */
  private async autoReviseContent(content: string, metrics: QualityMetrics, contentType: string): Promise<string | null> {
    // Simple auto-revision rules
    let revised = content;
    
    // Shorten sentences if readability is low
    if (metrics.readability < 5) {
      revised = revised.replace(/([.!?])\s+/g, '$1\n\n'); // Add breaks
      revised = revised.replace(/,\s+and\s+/g, '.\n'); // Break compound sentences
    }
    
    // Add micro-actions if actionability is low
    if (metrics.actionability < 10) {
      // 🚫 REMOVED AUTOMATIC "Try this:" INJECTION
      // This was causing repetitive content patterns
      // Hook diversity should be handled by HookDiversificationEngine instead
    }
    
    // Only return if we made meaningful changes
    if (revised.length > content.length + 10) {
      return revised;
    }
    
    return null;
  }

  /**
   * Check for safety issues (medical claims, harmful advice)
   */
  private checkSafety(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Check for medical claims
    const hasMedicalClaims = this.medicalClaims.some(claim => 
      lowerContent.includes(claim.toLowerCase())
    );
    
    // Check for dangerous absolute statements
    const dangerousPatterns = [
      /this will (cure|fix|eliminate)/i,
      /always (do|take|avoid)/i,
      /never (eat|take|do)/i,
      /guaranteed (to|results)/i,
      /proven (to|cure|treatment)/i
    ];
    
    const hasDangerousStatements = dangerousPatterns.some(pattern => 
      pattern.test(content)
    );
    
    return !hasMedicalClaims && !hasDangerousStatements;
  }

  /**
   * Generate human-readable rationale for scoring
   */
  private generateRationale(metrics: QualityMetrics, contentType: string): string {
    const parts = [];
    
    // Hook analysis
    if (metrics.hookClarity >= 20) parts.push('Strong hook');
    else if (metrics.hookClarity <= 10) parts.push('Weak hook');
    
    // Big idea analysis  
    if (metrics.bigIdea >= 12) parts.push('Clear focus');
    else if (metrics.bigIdea <= 6) parts.push('Scattered ideas');
    
    // Actionability analysis
    if (metrics.actionability >= 15) parts.push('Highly actionable');
    else if (metrics.actionability <= 8) parts.push('Too vague');
    
    // Novelty analysis
    if (metrics.novelty >= 15) parts.push('Novel insights');
    else if (metrics.novelty <= 8) parts.push('Predictable content');
    
    // Readability analysis
    if (metrics.readability >= 8) parts.push('Easy to read');
    else if (metrics.readability <= 5) parts.push('Hard to follow');
    
    // Tone analysis
    if (metrics.humanTone >= 8) parts.push('Conversational tone');
    else if (metrics.humanTone <= 5) parts.push('Too lecture-y');
    
    const overall = metrics.overallScore >= 90 ? 'Excellent' :
                   metrics.overallScore >= 80 ? 'Good' :
                   metrics.overallScore >= 70 ? 'Fair' : 'Poor';
    
    return `${overall} (${Math.round(metrics.overallScore)}/100). ${parts.join(', ')}.`;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(metrics: QualityMetrics, contentType: string): string[] {
    const suggestions = [];
    
    if (metrics.hookClarity < 18) {
      suggestions.push('Strengthen opening with specific numbers, personal results, or contrarian insights');
    }
    
    if (metrics.bigIdea < 12) {
      suggestions.push('Focus on one clear concept instead of multiple ideas');
    }
    
    if (metrics.actionability < 15) {
      suggestions.push('Add specific micro-steps, timeframes, or concrete actions');
    }
    
    if (metrics.novelty < 15) {
      suggestions.push('Include surprising insights, counterintuitive points, or myth-busting');
    }
    
    if (metrics.readability < 6) {
      suggestions.push('Use shorter sentences, bullet points, and simpler structure');
    }
    
    if (metrics.humanTone < 6) {
      suggestions.push('Write more conversationally, avoid lecture-style language');
    }
    
    return suggestions;
  }
}
