/**
 * Quality Gate - LLM self-critique and safety validation
 * Ensures content meets standards for health, contextuality, and engagement
 */

interface QualityMetrics {
  hookStrength: number;
  specificity: number;
  jargonScore: number;
  contextuality: number;
  safetyScore: number;
  overallScore: number;
}

interface QualityResult {
  passed: boolean;
  score: QualityMetrics;
  rationale: string;
  suggestions?: string[];
}

export class QualityGate {
  private readonly minThreshold = 0.7; // 70% overall score required
  private readonly medicalClaims = [
    'cure', 'treat', 'diagnosis', 'prescribe', 'medical advice',
    'disease', 'disorder', 'syndrome', 'condition', 'therapy',
    'medication', 'drug', 'supplement dosage', 'clinical'
  ];

  /**
   * Evaluate thread quality using rubric-based scoring
   */
  async evaluateThread(tweets: string[]): Promise<QualityResult> {
    const content = tweets.join(' ');
    const metrics = await this.calculateMetrics(content, 'thread');
    
    const passed = metrics.overallScore >= this.minThreshold && metrics.safetyScore >= 0.8;
    
    return {
      passed,
      score: metrics,
      rationale: this.generateRationale(metrics, 'thread'),
      suggestions: passed ? undefined : this.generateSuggestions(metrics, 'thread')
    };
  }

  /**
   * Evaluate reply quality with focus on contextuality
   */
  async evaluateReply(reply: string, originalTweet: string): Promise<QualityResult> {
    const metrics = await this.calculateMetrics(reply, 'reply', originalTweet);
    
    const passed = metrics.overallScore >= this.minThreshold && 
                   metrics.contextuality >= 0.6 && 
                   metrics.safetyScore >= 0.8;
    
    return {
      passed,
      score: metrics,
      rationale: this.generateRationale(metrics, 'reply'),
      suggestions: passed ? undefined : this.generateSuggestions(metrics, 'reply')
    };
  }

  /**
   * Calculate quality metrics for content
   */
  private async calculateMetrics(
    content: string, 
    contentType: 'thread' | 'reply',
    originalTweet?: string
  ): Promise<QualityMetrics> {
    
    const hookStrength = this.evaluateHookStrength(content);
    const specificity = this.evaluateSpecificity(content);
    const jargonScore = this.evaluateJargon(content);
    const contextuality = contentType === 'reply' && originalTweet ? 
      this.evaluateContextuality(content, originalTweet) : 1.0;
    const safetyScore = this.evaluateSafety(content);
    
    // Weighted overall score
    const weights = contentType === 'reply' ? 
      { hook: 0.2, specificity: 0.2, jargon: 0.2, contextuality: 0.3, safety: 0.1 } :
      { hook: 0.3, specificity: 0.3, jargon: 0.2, contextuality: 0.1, safety: 0.1 };
    
    const overallScore = 
      hookStrength * weights.hook +
      specificity * weights.specificity +
      (1 - jargonScore) * weights.jargon + // Lower jargon is better
      contextuality * weights.contextuality +
      safetyScore * weights.safety;

    return {
      hookStrength,
      specificity,
      jargonScore,
      contextuality,
      safetyScore,
      overallScore
    };
  }

  /**
   * Evaluate hook strength (first impression impact)
   */
  private evaluateHookStrength(content: string): number {
    const firstSentence = content.split(/[.!?]/)[0] || content;
    let score = 0.5; // Base score
    
    // Strong hook indicators
    const strongPatterns = [
      /\d+/g, // Contains numbers
      /I (fixed|discovered|learned)/i, // Personal experience
      /why .+ (is|are) wrong/i, // Contrarian
      /the .+ (mistake|secret|truth)/i, // Intrigue
      /what .+ don't tell you/i // Insider knowledge
    ];
    
    strongPatterns.forEach(pattern => {
      if (pattern.test(firstSentence)) score += 0.15;
    });
    
    // Weak hook indicators (penalties)
    const weakPatterns = [
      /^(hey|hi|hello)/i, // Generic greeting
      /let's talk about/i, // Vague opening
      /today I want to/i, // Announcement style
      /^(tips|advice) (for|about)/i // Generic tips format
    ];
    
    weakPatterns.forEach(pattern => {
      if (pattern.test(firstSentence)) score -= 0.2;
    });
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate specificity and actionability
   */
  private evaluateSpecificity(content: string): number {
    let score = 0.3; // Base score
    
    // Specific indicators
    const specificPatterns = [
      /\d+\s*(minutes?|hours?|days?|weeks?)/gi, // Time specifics
      /\d+\s*(mg|grams?|cups?|servings?)/gi, // Quantity specifics
      /(step \d+|first|second|third|next)/gi, // Process steps
      /(exactly|specifically|precisely)/gi, // Precision words
      /\d+%/g // Percentages
    ];
    
    specificPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) score += matches.length * 0.1;
    });
    
    // Vague language (penalties)
    const vaguePhrases = [
      'some people', 'many experts', 'studies show', 'it is said',
      'generally', 'usually', 'often', 'sometimes', 'might'
    ];
    
    vaguePhrases.forEach(phrase => {
      if (content.toLowerCase().includes(phrase)) score -= 0.1;
    });
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate jargon level (lower is better for accessibility)
   */
  private evaluateJargon(content: string): number {
    const jargonTerms = [
      'circadian', 'mitochondrial', 'metabolic', 'endocrine', 'neurological',
      'biomarker', 'micronutrient', 'macronutrient', 'inflammatory', 'oxidative',
      'homeostasis', 'hypothalamic', 'cortisol', 'insulin', 'dopamine'
    ];
    
    const words = content.toLowerCase().split(/\s+/);
    const jargonCount = jargonTerms.filter(term => 
      words.some(word => word.includes(term))
    ).length;
    
    // Normalize by content length
    const jargonDensity = jargonCount / Math.max(words.length, 1) * 100;
    
    // Higher density = higher jargon score (which is penalized)
    return Math.min(1, jargonDensity / 5); // 5% density = max jargon score
  }

  /**
   * Evaluate contextuality for replies
   */
  private evaluateContextuality(reply: string, originalTweet: string): number {
    const replyWords = new Set(reply.toLowerCase().split(/\s+/));
    const tweetWords = new Set(originalTweet.toLowerCase().split(/\s+/));
    
    // Remove common words
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const meaningfulReplyWords = new Set([...replyWords].filter(word => !commonWords.has(word) && word.length > 2));
    const meaningfulTweetWords = new Set([...tweetWords].filter(word => !commonWords.has(word) && word.length > 2));
    
    const intersection = new Set([...meaningfulReplyWords].filter(word => meaningfulTweetWords.has(word)));
    
    // Base contextuality on meaningful word overlap
    const overlapScore = intersection.size / Math.max(meaningfulTweetWords.size, 1);
    
    // Bonus for specific acknowledgment patterns
    const acknowledgmentPatterns = [
      /you('re| are) right/i,
      /great point/i,
      /this aligns/i,
      /building on/i,
      /your .+ about/i
    ];
    
    let acknowledgmentBonus = 0;
    acknowledgmentPatterns.forEach(pattern => {
      if (pattern.test(reply)) acknowledgmentBonus += 0.1;
    });
    
    return Math.min(1, overlapScore + acknowledgmentBonus);
  }

  /**
   * Evaluate safety (no medical claims or harmful advice)
   */
  private evaluateSafety(content: string): number {
    const lowerContent = content.toLowerCase();
    let safetyScore = 1.0;
    
    // Check for medical claims
    this.medicalClaims.forEach(claim => {
      if (lowerContent.includes(claim.toLowerCase())) {
        safetyScore -= 0.2;
      }
    });
    
    // Check for absolute statements that could be harmful
    const dangerousPatterns = [
      /this will (cure|fix|eliminate)/i,
      /always (do|take|avoid)/i,
      /never (eat|take|do)/i,
      /guaranteed (to|results)/i,
      /proven (to|cure|treatment)/i
    ];
    
    dangerousPatterns.forEach(pattern => {
      if (pattern.test(content)) safetyScore -= 0.3;
    });
    
    return Math.max(0, safetyScore);
  }

  /**
   * Generate human-readable rationale for scoring
   */
  private generateRationale(metrics: QualityMetrics, contentType: string): string {
    const parts = [];
    
    if (metrics.hookStrength > 0.7) {
      parts.push('Strong hook');
    } else if (metrics.hookStrength < 0.4) {
      parts.push('Weak hook');
    }
    
    if (metrics.specificity > 0.7) {
      parts.push('Good specificity');
    } else if (metrics.specificity < 0.4) {
      parts.push('Too vague');
    }
    
    if (metrics.jargonScore > 0.6) {
      parts.push('Too technical');
    } else if (metrics.jargonScore < 0.2) {
      parts.push('Accessible language');
    }
    
    if (contentType === 'reply' && metrics.contextuality > 0.6) {
      parts.push('Contextually relevant');
    } else if (contentType === 'reply' && metrics.contextuality < 0.3) {
      parts.push('Poor contextuality');
    }
    
    if (metrics.safetyScore < 0.8) {
      parts.push('Safety concerns');
    }
    
    const overall = metrics.overallScore > 0.8 ? 'Excellent' :
                   metrics.overallScore > 0.6 ? 'Good' :
                   metrics.overallScore > 0.4 ? 'Fair' : 'Poor';
    
    return `${overall} (${Math.round(metrics.overallScore * 100)}%). ${parts.join(', ')}.`;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(metrics: QualityMetrics, contentType: string): string[] {
    const suggestions = [];
    
    if (metrics.hookStrength < 0.5) {
      suggestions.push('Strengthen opening with specific numbers, personal results, or contrarian insights');
    }
    
    if (metrics.specificity < 0.5) {
      suggestions.push('Add specific timeframes, quantities, or step-by-step instructions');
    }
    
    if (metrics.jargonScore > 0.6) {
      suggestions.push('Replace technical terms with simpler language');
    }
    
    if (contentType === 'reply' && metrics.contextuality < 0.4) {
      suggestions.push('Better acknowledge the original tweet\'s specific points');
    }
    
    if (metrics.safetyScore < 0.8) {
      suggestions.push('Remove medical claims and absolute statements');
    }
    
    return suggestions;
  }
}
