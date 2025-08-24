/**
 * VIEW OPTIMIZATION ENGINE - Analyze why posts get low views
 * 
 * This identifies algorithmic penalties and optimizes for visibility
 */

import { logInfo, logError, logWarn } from '../utils/intelligentLogging';

export interface ViewAnalysis {
  estimatedViews: number;
  algorithmicPenalties: string[];
  optimizationSuggestions: string[];
  visibilityScore: number;
  riskFactors: string[];
}

export class ViewOptimizationEngine {
  private static instance: ViewOptimizationEngine;

  private constructor() {}

  public static getInstance(): ViewOptimizationEngine {
    if (!ViewOptimizationEngine.instance) {
      ViewOptimizationEngine.instance = new ViewOptimizationEngine();
    }
    return ViewOptimizationEngine.instance;
  }

  /**
   * Analyze why posts might be getting low views
   */
  public analyzeViewPotential(content: string, accountMetrics: {
    followerCount?: number;
    recentEngagement?: number;
    postingFrequency?: number;
  }): ViewAnalysis {
    
    logInfo('VIEW_OPTIMIZER', `Analyzing view potential for content: ${content.substring(0, 50)}...`);

    const penalties = this.detectAlgorithmicPenalties(content);
    const riskFactors = this.identifyRiskFactors(content, accountMetrics);
    const visibilityScore = this.calculateVisibilityScore(content, penalties, riskFactors);
    const estimatedViews = this.estimateViews(visibilityScore, accountMetrics);
    const suggestions = this.generateOptimizationSuggestions(penalties, riskFactors);

    return {
      estimatedViews,
      algorithmicPenalties: penalties,
      optimizationSuggestions: suggestions,
      visibilityScore,
      riskFactors
    };
  }

  /**
   * Detect potential algorithmic penalties
   */
  private detectAlgorithmicPenalties(content: string): string[] {
    const penalties: string[] = [];
    const lowerContent = content.toLowerCase();

    // Repetitive content patterns
    if (this.hasRepetitivePattern(content)) {
      penalties.push('REPETITIVE_CONTENT: Similar to recent posts');
    }

    // Generic engagement bait
    const engagementBaitPhrases = [
      'change my mind', 'thoughts?', 'agree or disagree',
      'what do you think', 'am i wrong', 'unpopular opinion'
    ];
    
    for (const phrase of engagementBaitPhrases) {
      if (lowerContent.includes(phrase)) {
        penalties.push(`ENGAGEMENT_BAIT: "${phrase}" is overused`);
      }
    }

    // Excessive claims without evidence
    const excessiveClaims = [
      /\d+%.*without/gi, // "90% improvement without evidence"
      /everyone.*wrong/gi,
      /nobody.*knows/gi,
      /secret.*they.*hide/gi
    ];

    for (const pattern of excessiveClaims) {
      if (pattern.test(content)) {
        penalties.push('EXCESSIVE_CLAIMS: Unsubstantiated bold claims');
      }
    }

    // Template overuse
    if (this.detectTemplateOveruse(content)) {
      penalties.push('TEMPLATE_OVERUSE: Using same content structure repeatedly');
    }

    // Spam-like characteristics
    if (this.hasSpamCharacteristics(content)) {
      penalties.push('SPAM_CHARACTERISTICS: Content appears algorithmic');
    }

    return penalties;
  }

  /**
   * Identify risk factors for low visibility
   */
  private identifyRiskFactors(content: string, accountMetrics: any): string[] {
    const risks: string[] = [];

    // Account-level risks
    if (accountMetrics.followerCount && accountMetrics.followerCount < 1000) {
      risks.push('SMALL_ACCOUNT: Accounts under 1K followers get limited reach');
    }

    if (accountMetrics.recentEngagement && accountMetrics.recentEngagement < 0.02) {
      risks.push('LOW_ENGAGEMENT_HISTORY: Poor recent engagement affects future visibility');
    }

    if (accountMetrics.postingFrequency && accountMetrics.postingFrequency > 10) {
      risks.push('HIGH_FREQUENCY: Posting too often can trigger spam filters');
    }

    // Content-level risks
    const contentLength = content.length;
    if (contentLength < 50) {
      risks.push('TOO_SHORT: Very short posts get less algorithmic promotion');
    }

    if (contentLength > 270) {
      risks.push('TOO_LONG: May be truncated, affecting readability');
    }

    // Timing and context risks
    const hasTimeSensitive = /today|now|currently|this week/gi.test(content);
    if (hasTimeSensitive) {
      risks.push('TIME_SENSITIVE: Content may become irrelevant quickly');
    }

    // Hashtag risks
    const hashtagCount = (content.match(/#\w+/g) || []).length;
    if (hashtagCount > 3) {
      risks.push('HASHTAG_SPAM: Too many hashtags can appear spammy');
    }

    return risks;
  }

  /**
   * Calculate visibility score (0-100)
   */
  private calculateVisibilityScore(content: string, penalties: string[], risks: string[]): number {
    let score = 70; // Base score for health content

    // Penalty deductions
    score -= penalties.length * 15; // Major penalty per algorithmic issue
    score -= risks.length * 5; // Minor penalty per risk factor

    // Positive factors
    if (this.hasEngagementTriggers(content)) score += 10;
    if (this.hasActionableAdvice(content)) score += 8;
    if (this.hasSpecificNumbers(content)) score += 6;
    if (this.hasQuestionHook(content)) score += 5;

    // Content quality bonuses
    if (content.length >= 140 && content.length <= 240) score += 8; // Optimal length
    if (this.hasPersonalTouch(content)) score += 7;
    if (this.hasNovelAngle(content)) score += 12;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate view count based on visibility score
   */
  private estimateViews(visibilityScore: number, accountMetrics: any): number {
    const followerCount = accountMetrics.followerCount || 25; // Your current follower count
    
    // Base reach calculation
    let baseReach = followerCount * 0.1; // 10% of followers see organic posts typically
    
    // Adjust based on visibility score
    const scoreMultiplier = visibilityScore / 70; // Normalize to expected performance
    baseReach *= scoreMultiplier;

    // Algorithm boost for high-quality content
    if (visibilityScore > 80) {
      baseReach *= 2.5; // High-quality content gets algorithmic boost
    } else if (visibilityScore > 60) {
      baseReach *= 1.2; // Decent content gets slight boost
    } else if (visibilityScore < 40) {
      baseReach *= 0.3; // Poor content gets suppressed
    }

    // Minimum views (even with penalties, some views occur)
    const minimumViews = Math.max(1, followerCount * 0.02);
    
    return Math.round(Math.max(minimumViews, baseReach));
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(penalties: string[], risks: string[]): string[] {
    const suggestions: string[] = [];

    // Address penalties
    if (penalties.some(p => p.includes('REPETITIVE_CONTENT'))) {
      suggestions.push('🔄 Wait 24-48 hours before posting on similar topics');
      suggestions.push('📝 Find a completely different angle on the same topic');
    }

    if (penalties.some(p => p.includes('ENGAGEMENT_BAIT'))) {
      suggestions.push('🎯 Replace generic CTAs with specific questions');
      suggestions.push('💡 End with actionable insight instead of asking for opinions');
    }

    if (penalties.some(p => p.includes('TEMPLATE_OVERUSE'))) {
      suggestions.push('🎨 Vary your content structure and opening hooks');
      suggestions.push('📖 Tell personal stories instead of using templates');
    }

    // Address risks
    if (risks.some(r => r.includes('SMALL_ACCOUNT'))) {
      suggestions.push('🤝 Engage with larger accounts to increase visibility');
      suggestions.push('🧵 Use threads to increase time-on-content');
    }

    if (risks.some(r => r.includes('LOW_ENGAGEMENT_HISTORY'))) {
      suggestions.push('⏰ Post when your audience is most active');
      suggestions.push('🎯 Focus on highly engaging topics initially');
    }

    // General optimization
    suggestions.push('🔥 Add specific numbers and statistics for credibility');
    suggestions.push('❓ Start with a compelling question or surprising fact');
    suggestions.push('📱 Test different posting times to find optimal engagement windows');

    return suggestions;
  }

  /**
   * Check for repetitive patterns
   */
  private hasRepetitivePattern(content: string): boolean {
    // This would ideally check against recent posts
    // For now, detect common repetitive patterns
    const commonPatterns = [
      /every.*tells you.*wrong/gi,
      /spent.*testing.*results/gi,
      /simple.*boosts.*by \d+%/gi
    ];

    return commonPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect template overuse
   */
  private detectTemplateOveruse(content: string): boolean {
    const templates = [
      /.*tells you.*wrong.*spent.*testing/gi,
      /why are we still.*change my mind/gi,
      /.*bullshit.*focusing on.*instead/gi
    ];

    return templates.some(template => template.test(content));
  }

  /**
   * Check for spam characteristics
   */
  private hasSpamCharacteristics(content: string): boolean {
    const spamIndicators = [
      content.split('!').length > 3, // Too many exclamation marks
      /(.)\1{3,}/g.test(content), // Repeated characters
      content.toUpperCase() === content && content.length > 20 // All caps
    ];

    return spamIndicators.some(indicator => indicator);
  }

  /**
   * Check for engagement triggers
   */
  private hasEngagementTriggers(content: string): boolean {
    const triggers = [
      /\?$/g, // Ends with question
      /surprising|shocking|unexpected/gi,
      /\d+%|\d+ (times|x)/gi, // Specific percentages or multipliers
      /because|why|how/gi // Explanatory content
    ];

    return triggers.some(trigger => trigger.test(content));
  }

  /**
   * Check for actionable advice
   */
  private hasActionableAdvice(content: string): boolean {
    const actionableWords = [
      'try this', 'do this', 'start with', 'first step',
      'here\'s how', 'simple way', 'practical'
    ];

    return actionableWords.some(word => 
      content.toLowerCase().includes(word)
    );
  }

  /**
   * Check for specific numbers
   */
  private hasSpecificNumbers(content: string): boolean {
    return /\d+(%|x|hours?|minutes?|days?|weeks?|\$)/.test(content);
  }

  /**
   * Check for question hook
   */
  private hasQuestionHook(content: string): boolean {
    const questionStarters = [
      'what if', 'why do', 'how many', 'what would',
      'have you ever', 'did you know'
    ];

    return questionStarters.some(starter => 
      content.toLowerCase().startsWith(starter)
    );
  }

  /**
   * Check for personal touch
   */
  private hasPersonalTouch(content: string): boolean {
    const personalWords = [
      'i spent', 'i tested', 'my experience', 'i discovered',
      'after trying', 'when i', 'i learned'
    ];

    return personalWords.some(word => 
      content.toLowerCase().includes(word)
    );
  }

  /**
   * Check for novel angle
   */
  private hasNovelAngle(content: string): boolean {
    const novelIndicators = [
      'nobody talks about', 'overlooked', 'hidden',
      'counterintuitive', 'opposite approach', 'different way'
    ];

    return novelIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    );
  }
}
