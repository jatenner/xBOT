/**
 * 🛡️ CONTENT SAFETY GUARD
 * 
 * PURPOSE: Multi-layer safety validation for content
 * STRATEGY: Profanity, PII, sentiment, and platform compliance checks
 */

export interface SafetyResult {
  ok: boolean;
  reasons: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestions?: string[];
}

export interface SafetyConfig {
  maxHashtags: number;
  minLength: number;
  maxLength: number;
  strictMode: boolean;
  sentimentThreshold: number; // -1 to 1
  allowControversial: boolean;
}

/**
 * Content safety validator
 */
export class ContentSafetyGuard {
  private config: SafetyConfig;
  private profanityWords: Set<string>;
  private piiPatterns: RegExp[];
  private toxicPatterns: RegExp[];

  constructor(config: Partial<SafetyConfig> = {}) {
    this.config = {
      maxHashtags: 3,
      minLength: 10,
      maxLength: 280,
      strictMode: false,
      sentimentThreshold: -0.5,
      allowControversial: true,
      ...config
    };

    this.initializeProfanityList();
    this.initializePiiPatterns();
    this.initializeToxicPatterns();
  }

  /**
   * Initialize profanity word list
   */
  private initializeProfanityList(): void {
    // Basic profanity list (would be expanded in production)
    const basicProfanity = [
      'spam', 'scam', 'fake', 'virus', 'hack', 'cheat', 'bot',
      'follow4follow', 'f4f', 'sub4sub', 's4s'
    ];

    // Gaming-specific toxic terms
    const gamingToxic = [
      'noob', 'scrub', 'trash', 'carried', 'hardstuck', 'bronze',
      'elo hell', 'boosted', 'griefing', 'inting'
    ];

    // Combine lists
    this.profanityWords = new Set([
      ...basicProfanity,
      ...(this.config.strictMode ? gamingToxic : [])
    ]);
  }

  /**
   * Initialize PII detection patterns
   */
  private initializePiiPatterns(): void {
    this.piiPatterns = [
      // Email addresses
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      
      // Phone numbers (various formats)
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      /\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g,
      
      // Credit card patterns (basic)
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      
      // Social security numbers
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      
      // API keys (basic patterns)
      /\b[A-Za-z0-9]{32,}\b/g,
      
      // URLs with potential secrets
      /https?:\/\/.*:.*@/g
    ];
  }

  /**
   * Initialize toxic pattern detection
   */
  private initializeToxicPatterns(): void {
    this.toxicPatterns = [
      // Hate speech indicators
      /\b(hate|kill|die|kys)\s+(all|every)\s+\w+/gi,
      
      // Excessive caps (screaming)
      /[A-Z]{10,}/g,
      
      // Repetitive characters (spam-like)
      /(.)\1{5,}/g,
      
      // Multiple exclamation/question marks
      /[!?]{4,}/g
    ];
  }

  /**
   * Check for profanity
   */
  private checkProfanity(text: string): { found: boolean; words: string[] } {
    const words = text.toLowerCase().split(/\s+/);
    const foundWords = words.filter(word => this.profanityWords.has(word));
    
    return {
      found: foundWords.length > 0,
      words: foundWords
    };
  }

  /**
   * Check for PII (Personally Identifiable Information)
   */
  private checkPii(text: string): { found: boolean; types: string[] } {
    const types: string[] = [];
    
    for (const pattern of this.piiPatterns) {
      if (pattern.test(text)) {
        if (pattern.source.includes('@')) types.push('email');
        else if (pattern.source.includes('\\d{3}')) types.push('phone');
        else if (pattern.source.includes('\\d{4}')) types.push('credit_card');
        else if (pattern.source.includes('{32,}')) types.push('api_key');
        else types.push('pii');
      }
    }
    
    return {
      found: types.length > 0,
      types: [...new Set(types)]
    };
  }

  /**
   * Check for toxic patterns
   */
  private checkToxicPatterns(text: string): { found: boolean; patterns: string[] } {
    const patterns: string[] = [];
    
    for (const pattern of this.toxicPatterns) {
      if (pattern.test(text)) {
        patterns.push(pattern.source.substring(0, 20) + '...');
      }
    }
    
    return {
      found: patterns.length > 0,
      patterns
    };
  }

  /**
   * Basic sentiment analysis
   */
  private analyzeSentiment(text: string): number {
    const positiveWords = [
      'good', 'great', 'amazing', 'awesome', 'love', 'best', 'excellent',
      'fantastic', 'perfect', 'incredible', 'outstanding', 'brilliant',
      'epic', 'legendary', 'clutch', 'poggers', 'pog', 'based', 'goated'
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'trash',
      'garbage', 'toxic', 'cringe', 'sus', 'yikes', 'rip', 'dead',
      'broken', 'ruined', 'destroyed', 'demolished', 'wrecked'
    ];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    }

    // Normalize to -1 to 1 range
    const maxWords = Math.max(positiveWords.length, negativeWords.length);
    return Math.max(-1, Math.min(1, score / Math.max(words.length / 10, 1)));
  }

  /**
   * Check hashtag limits
   */
  private checkHashtags(text: string, additionalTags: string[] = []): { 
    ok: boolean; 
    count: number; 
    limit: number 
  } {
    const textHashtags = (text.match(/#\w+/g) || []).length;
    const totalHashtags = textHashtags + additionalTags.length;
    
    return {
      ok: totalHashtags <= this.config.maxHashtags,
      count: totalHashtags,
      limit: this.config.maxHashtags
    };
  }

  /**
   * Check content length
   */
  private checkLength(text: string): { 
    ok: boolean; 
    length: number; 
    min: number; 
    max: number 
  } {
    const length = text.length;
    
    return {
      ok: length >= this.config.minLength && length <= this.config.maxLength,
      length,
      min: this.config.minLength,
      max: this.config.maxLength
    };
  }

  /**
   * Check for controversial content
   */
  private checkControversial(text: string): { found: boolean; indicators: string[] } {
    const controversialKeywords = [
      'hot take', 'unpopular opinion', 'controversial', 'debate',
      'fight me', 'change my mind', 'am i wrong', 'disagree'
    ];

    const indicators = controversialKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword)
    );

    return {
      found: indicators.length > 0,
      indicators
    };
  }

  /**
   * Main safety validation
   */
  validate(content: {
    text: string;
    tags?: string[];
    topic?: string;
  }): SafetyResult {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let confidence = 0.9;

    // Check length
    const lengthCheck = this.checkLength(content.text);
    if (!lengthCheck.ok) {
      if (lengthCheck.length < lengthCheck.min) {
        reasons.push(`Too short: ${lengthCheck.length} < ${lengthCheck.min} characters`);
        suggestions.push('Add more content to meet minimum length');
      } else {
        reasons.push(`Too long: ${lengthCheck.length} > ${lengthCheck.max} characters`);
        suggestions.push('Shorten content to fit platform limits');
      }
      riskLevel = 'medium';
    }

    // Check hashtags
    const hashtagCheck = this.checkHashtags(content.text, content.tags);
    if (!hashtagCheck.ok) {
      reasons.push(`Too many hashtags: ${hashtagCheck.count} > ${hashtagCheck.limit}`);
      suggestions.push('Reduce number of hashtags');
      riskLevel = 'medium';
    }

    // Check profanity
    const profanityCheck = this.checkProfanity(content.text);
    if (profanityCheck.found) {
      reasons.push(`Profanity detected: ${profanityCheck.words.join(', ')}`);
      suggestions.push('Remove or replace flagged words');
      riskLevel = 'high';
    }

    // Check PII
    const piiCheck = this.checkPii(content.text);
    if (piiCheck.found) {
      reasons.push(`PII detected: ${piiCheck.types.join(', ')}`);
      suggestions.push('Remove personal information');
      riskLevel = 'high';
      confidence = 0.95; // High confidence in PII detection
    }

    // Check toxic patterns
    const toxicCheck = this.checkToxicPatterns(content.text);
    if (toxicCheck.found) {
      reasons.push(`Toxic patterns detected`);
      suggestions.push('Revise content to be more positive');
      riskLevel = 'high';
    }

    // Check sentiment
    const sentiment = this.analyzeSentiment(content.text);
    if (sentiment < this.config.sentimentThreshold) {
      reasons.push(`Negative sentiment: ${sentiment.toFixed(2)} < ${this.config.sentimentThreshold}`);
      suggestions.push('Consider more positive framing');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check controversial content
    const controversialCheck = this.checkControversial(content.text);
    if (controversialCheck.found && !this.config.allowControversial) {
      reasons.push(`Controversial content: ${controversialCheck.indicators.join(', ')}`);
      suggestions.push('Consider less polarizing language');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Check for promotion/spam patterns
    const promotionPatterns = [
      /follow.*for.*follow/i,
      /check.*out.*my/i,
      /dm.*me/i,
      /link.*in.*bio/i,
      /subscribe/i
    ];

    for (const pattern of promotionPatterns) {
      if (pattern.test(content.text)) {
        reasons.push('Promotional content detected');
        suggestions.push('Focus on engaging content rather than promotion');
        if (riskLevel === 'low') riskLevel = 'medium';
        break;
      }
    }

    const ok = reasons.length === 0;

    return {
      ok,
      reasons,
      confidence,
      riskLevel,
      suggestions: ok ? undefined : suggestions
    };
  }

  /**
   * Batch validate multiple content pieces
   */
  validateBatch(contents: Array<{
    text: string;
    tags?: string[];
    topic?: string;
  }>): Array<SafetyResult & { index: number }> {
    return contents.map((content, index) => ({
      ...this.validate(content),
      index
    }));
  }

  /**
   * Get safety statistics for batch
   */
  getBatchStats(results: SafetyResult[]): {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    riskDistribution: Record<string, number>;
    commonReasons: Array<{ reason: string; count: number }>;
  } {
    const total = results.length;
    const passed = results.filter(r => r.ok).length;
    const failed = total - passed;
    const passRate = total > 0 ? passed / total : 0;

    // Risk distribution
    const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0 };
    results.forEach(r => riskDistribution[r.riskLevel]++);

    // Common reasons
    const reasonCounts: Record<string, number> = {};
    results.forEach(r => {
      r.reasons.forEach(reason => {
        const key = reason.split(':')[0]; // Get reason type
        reasonCounts[key] = (reasonCounts[key] || 0) + 1;
      });
    });

    const commonReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      passed,
      failed,
      passRate,
      riskDistribution,
      commonReasons
    };
  }

  /**
   * Update safety configuration
   */
  updateConfig(newConfig: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize if strictMode changed
    if ('strictMode' in newConfig) {
      this.initializeProfanityList();
    }
    
    console.log(`🛡️  Updated safety config: ${JSON.stringify(newConfig)}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): SafetyConfig {
    return { ...this.config };
  }
}