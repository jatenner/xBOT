import { supabaseClient } from './supabaseClient';
import { getConfigValue, setConfigValue } from './config';
import { runtimeConfig } from './supabaseConfig.js';

export interface QualityMetrics {
  readabilityScore: number;
  factCount: number;
  sourceCredibility: number;
  hasUrl: boolean;
  hasCitation: boolean;
  characterCount: number;
  hasHashtags: boolean;
  passesGate: boolean;
  failureReasons: string[];
}

export interface QualityGateRules {
  minReadabilityScore: number;
  minFactCount: number;
  minSourceCredibility: number;
  requireUrl: boolean;
  requireCitation: boolean;
  maxCharacterCount: number;
  prohibitHashtags: boolean;
}

export class QualityGate {
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;

  private get defaultRules(): QualityGateRules {
    return {
      minReadabilityScore: 35,
      minFactCount: 1,
      minSourceCredibility: 0.5,
      requireUrl: false,
      requireCitation: false,
      maxCharacterCount: 280,
      prohibitHashtags: false
    };
  }

  /**
   * 📊 GET DYNAMIC READABILITY THRESHOLD
   * Reads current threshold from bot_config with viral-optimized defaults
   */
  async getReadabilityThreshold(): Promise<number> {
    // Check for balanced quality rules first
    try {
      const { data } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'balanced_quality_rules')
        .single();
      
      if (data?.value?.quality_thresholds?.min_readability_score) {
        return data.value.quality_thresholds.min_readability_score;
      }

      // Check runtime config
      const { data: runtimeData } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'runtime_config')
        .single();
      
      if (runtimeData?.value?.quality?.readabilityMin) {
        return runtimeData.value.quality.readabilityMin;
      }
    } catch (error) {
      console.warn('Could not read quality rules from database:', error);
    }
    
    // Fallback to viral-optimized threshold
    return await getConfigValue('min_readability', 45);
  }

  /**
   * 🎛️ ADJUST READABILITY THRESHOLD
   * Auto-adjusts based on consecutive successes/failures
   */
  async adjustReadabilityThreshold(passed: boolean): Promise<void> {
    const isEnabled = await getConfigValue('auto_adjust_enabled', true);
    if (!isEnabled) return;

    const threshold = await getConfigValue('quality_gate_consecutive_threshold', 3);
    
    if (passed) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
      
      if (this.consecutiveSuccesses >= threshold) {
        const current = await this.getReadabilityThreshold();
        const maxThreshold = await getConfigValue('max_readability', 60);
        const newThreshold = Math.min(maxThreshold, current + 5);
        
        await setConfigValue('min_readability', newThreshold);
        console.log(`📈 Raised readability threshold to ${newThreshold} (${this.consecutiveSuccesses} consecutive passes)`);
        this.consecutiveSuccesses = 0;
      }
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      
      if (this.consecutiveFailures >= threshold) {
        const current = await this.getReadabilityThreshold();
        const newThreshold = Math.max(25, current - 5);
        
        await setConfigValue('min_readability', newThreshold);
        console.log(`📉 Lowered readability threshold to ${newThreshold} (${this.consecutiveFailures} consecutive failures)`);
        this.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Main quality gate check with autonomous adjustment
   */
  async checkQuality(content: string, url?: string, source?: string, customRules?: Partial<QualityGateRules>): Promise<QualityMetrics> {
    // Get dynamic readability threshold
    const dynamicReadability = await this.getReadabilityThreshold();
    const rules = { 
      ...this.defaultRules, 
      minReadabilityScore: dynamicReadability,
      ...customRules 
    };

    // NEW: First check content coherence and specificity (early rejection)
    const coherenceCheck = this.validateContentCoherence(content);
    if (!coherenceCheck.isValid) {
      return {
        readabilityScore: 0,
        factCount: 0,
        sourceCredibility: 0,
        hasUrl: false,
        hasCitation: false,
        characterCount: content.length,
        hasHashtags: false,
        passesGate: false,
        failureReasons: [coherenceCheck.reason!]
      };
    }

    const specificityCheck = this.validateContentSpecificity(content);
    if (!specificityCheck.isValid) {
      return {
        readabilityScore: 0,
        factCount: 0,
        sourceCredibility: 0,
        hasUrl: false,
        hasCitation: false,
        characterCount: content.length,
        hasHashtags: false,
        passesGate: false,
        failureReasons: [specificityCheck.reason!]
      };
    }

    const metrics: QualityMetrics = {
      readabilityScore: this.calculateReadabilityScore(content),
      factCount: this.countFacts(content),
      sourceCredibility: this.calculateSourceCredibility(url, source),
      hasUrl: this.hasValidUrl(content, url),
      hasCitation: this.hasCitation(content, source),
      characterCount: content.length,
      hasHashtags: this.containsHashtags(content),
      passesGate: false,
      failureReasons: []
    };

    // Check each rule
    const checks = [
      {
        condition: metrics.readabilityScore >= rules.minReadabilityScore,
        reason: `Readability score ${metrics.readabilityScore} below minimum ${rules.minReadabilityScore}`
      },
      {
        condition: metrics.factCount >= rules.minFactCount,
        reason: `Fact count ${metrics.factCount} below minimum ${rules.minFactCount}`
      },
      {
        condition: metrics.sourceCredibility >= rules.minSourceCredibility,
        reason: `Source credibility ${metrics.sourceCredibility.toFixed(2)} below minimum ${rules.minSourceCredibility}`
      },
      {
        condition: !rules.requireUrl || metrics.hasUrl,
        reason: 'URL required but not found'
      },
      {
        condition: !rules.requireCitation || metrics.hasCitation,
        reason: 'Citation required but not found'
      },
      {
        condition: metrics.characterCount <= rules.maxCharacterCount,
        reason: `Character count ${metrics.characterCount} exceeds maximum ${rules.maxCharacterCount}`
      },
      {
        condition: !rules.prohibitHashtags || !metrics.hasHashtags,
        reason: 'Hashtags prohibited for human voice - content must be hashtag-free'
      }
    ];

    // Collect failures
    checks.forEach(check => {
      if (!check.condition) {
        metrics.failureReasons.push(check.reason);
      }
    });

    metrics.passesGate = metrics.failureReasons.length === 0;

    // Auto-adjust threshold based on result
    await this.adjustReadabilityThreshold(metrics.passesGate);

    console.log(`🚪 Quality Gate: ${metrics.passesGate ? '✅ PASSED' : '❌ FAILED'}`);
    if (!metrics.passesGate) {
      console.log(`   Failures: ${metrics.failureReasons.join(', ')}`);
    }
    console.log(`   📊 Readability: ${metrics.readabilityScore}, Facts: ${metrics.factCount}, Credibility: ${metrics.sourceCredibility.toFixed(2)}`);
    if (metrics.hasHashtags) {
      console.log(`   🚫 HASHTAGS DETECTED - Human voice requires hashtag-free content`);
    }

    return metrics;
  }

  /**
   * Check if content contains hashtags (NUCLEAR PROHIBITION for human voice)
   */
  private containsHashtags(content: string): boolean {
    // Multiple hashtag detection patterns for NUCLEAR enforcement
    const hashtagPatterns = [
      /#\w+/g,                    // Standard hashtags
      /#[A-Za-z0-9_]+/g,         // Alphanumeric hashtags
      /\bhash\s*tags?\b/gi,      // "hashtag" or "hashtags" 
      /\btags?\s*:/gi,           // "tags:" or "tag:"
      /\btrending\s+tags?\b/gi,  // "trending tags"
      /\bpopular\s+hashtags?\b/gi // "popular hashtags"
    ];
    
    let hasHashtags = false;
    let hashtagCount = 0;
    
    for (const pattern of hashtagPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        hasHashtags = true;
        hashtagCount += matches.length;
        console.log(`🚫 NUCLEAR HASHTAG REJECTION: Found ${matches.length} hashtag(s) with pattern ${pattern}: ${matches.join(', ')}`);
      }
    }
    
    if (hasHashtags) {
      console.log(`🚫 TOTAL HASHTAG VIOLATIONS: ${hashtagCount} - CONTENT REJECTED`);
      console.log('🗣️ HUMAN VOICE REQUIREMENT: Content must use natural language, not hashtags');
    }
    
    return hasHashtags;
  }

  /**
   * NEW: Validate content coherence and reject nonsensical tweets
   */
  private validateContentCoherence(content: string): { isValid: boolean; reason?: string } {
    // Check minimum content standards
    if (content.length < 30) {
      return { isValid: false, reason: 'Content too short - minimum 30 characters required' };
    }

    // Check for complete sentences
    const hasCompleteSentence = /[.!?]/.test(content);
    if (!hasCompleteSentence) {
      return { isValid: false, reason: 'Content lacks proper sentence structure' };
    }

    // Check for health/tech relevance
    const healthTechKeywords = [
      'ai', 'health', 'medical', 'technology', 'diagnostic', 'treatment', 'patient', 'clinical',
      'research', 'study', 'disease', 'therapy', 'drug', 'hospital', 'doctor', 'medicine',
      'biotech', 'pharma', 'digital', 'data', 'algorithm', 'innovation', 'breakthrough',
      'telemedicine', 'wearable', 'sensor', 'genomic', 'precision', 'personalized'
    ];
    
    const contentLower = content.toLowerCase();
    const hasRelevantKeywords = healthTechKeywords.some(keyword => 
      contentLower.includes(keyword)
    );
    
    if (!hasRelevantKeywords) {
      return { isValid: false, reason: 'Content lacks health/technology focus' };
    }

    // Check for random or nonsensical patterns
    const nonsensicalPatterns = [
      /\b[a-z]{1,2}\b.*\b[a-z]{1,2}\b.*\b[a-z]{1,2}\b/i, // Too many very short words
      /^[^a-zA-Z]*$/, // Only special characters or numbers
      /(.)\1{4,}/, // Repeated characters (5+ times)
      /\b\w{15,}\b/, // Extremely long words (likely gibberish)
      /[^\w\s.,!?()%-]{3,}/, // Multiple special characters in sequence
    ];

    for (const pattern of nonsensicalPatterns) {
      if (pattern.test(content)) {
        return { isValid: false, reason: 'Content contains nonsensical patterns' };
      }
    }

    // Check for proper professional tone
    const unprofessionalWords = [
      'lol', 'omg', 'wtf', 'lmao', 'rofl', 'tbh', 'imo', 'fyi', 'asap',
      'gonna', 'wanna', 'kinda', 'sorta', 'dunno'
    ];
    
    const hasUnprofessionalWords = unprofessionalWords.some(word => 
      contentLower.includes(word.toLowerCase())
    );
    
    if (hasUnprofessionalWords) {
      return { isValid: false, reason: 'Content contains unprofessional language' };
    }

    // Check for excessive repetition within content
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 3) { // Only check meaningful words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    // Find if any word appears more than 25% of the time
    const totalMeaningfulWords = Array.from(wordCounts.values()).reduce((sum, count) => sum + count, 0);
    const hasExcessiveRepetition = Array.from(wordCounts.values()).some(count => 
      count / totalMeaningfulWords > 0.25
    );
    
    if (hasExcessiveRepetition) {
      return { isValid: false, reason: 'Content has excessive word repetition' };
    }

    return { isValid: true };
  }

  /**
   * NEW: Check for generic template language that lacks specificity
   */
  private validateContentSpecificity(content: string): { isValid: boolean; reason?: string } {
    const genericPhrases = [
      'thoughts?', 'what do you think?', 'agree or disagree?', 'comment below',
      'share your thoughts', 'let me know', 'your opinion?', 'discuss',
      'interesting development', 'exciting news', 'amazing breakthrough',
      'revolutionary technology', 'game-changing', 'unprecedented',
      'cutting-edge', 'state-of-the-art', 'next-generation'
    ];

    const contentLower = content.toLowerCase();
    const genericCount = genericPhrases.filter(phrase => 
      contentLower.includes(phrase)
    ).length;

    if (genericCount >= 2) {
      return { isValid: false, reason: 'Content is too generic - uses multiple template phrases' };
    }

    // Require specific data or facts
    const hasSpecificData = /\d+%|\d+\.\d+%|\d+x|\d+ years|\d+ million|\d+ billion|\d+ patients|\d+ trials/i.test(content);
    const hasSpecificSource = /(stanford|harvard|mit|mayo|nature|nejm|lancet|who|fda|nih)/i.test(content);
    
    if (!hasSpecificData && !hasSpecificSource) {
      return { isValid: false, reason: 'Content lacks specific data or credible source references' };
    }

    return { isValid: true };
  }

  /**
   * Calculate Flesch Reading Ease score
   */
  private calculateReadabilityScore(text: string): number {
    const sentences = this.countSentences(text);
    const words = this.countWords(text);
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 0;

    // Flesch Reading Ease formula
    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    let score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    // Boost score for conversational language
    const conversationalWords = (text.match(/\b(you|we|your|our|let's|here's|what|why|how)\b/gi) || []).length;
    if (conversationalWords > 0) {
      score += (conversationalWords * 2); // Reward conversational tone
    }
    
    // Penalty for hashtags
    if (this.containsHashtags(text)) {
      score -= 25; // Heavy penalty for hashtags
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Count factual elements in content
   */
  private countFacts(content: string): number {
    let factCount = 0;

    // Numbers and percentages
    const numbers = content.match(/\d+\.?\d*%|\d+\.?\d*x|\d+\.?\d* times|\d+\.?\d* million|\d+\.?\d* billion/gi);
    if (numbers) factCount += numbers.length;

    // Study references
    const studies = content.match(/study|trial|research|analysis|report|survey/gi);
    if (studies) factCount += Math.min(studies.length, 2); // Cap at 2

    // Specific claims
    const claims = content.match(/found|discovered|revealed|showed|demonstrated|proven/gi);
    if (claims) factCount += Math.min(claims.length, 1); // Cap at 1

    // Institution names
    const institutions = content.match(/stanford|harvard|mit|mayo|fda|nih|who|cdc|nature|nejm/gi);
    if (institutions) factCount += Math.min(institutions.length, 1); // Cap at 1

    return factCount;
  }

  /**
   * Calculate source credibility based on URL and source name
   */
  private calculateSourceCredibility(url?: string, source?: string): number {
    let credibility = 0.6; // Base credibility

    const domain = url ? this.extractDomain(url) : '';
    const sourceLower = source?.toLowerCase() || '';

    // High credibility sources
    const highCredSources = [
      'nature.com', 'science.org', 'nejm.org', 'thelancet.com', 'jamanetwork.com',
      'nih.gov', 'who.int', 'cdc.gov', 'fda.gov', 'stanford.edu', 'harvard.edu', 'mit.edu'
    ];

    // Medium credibility sources
    const medCredSources = [
      'statnews.com', 'medscape.com', 'healthline.com', 'webmd.com', 'mayo.edu'
    ];

    if (highCredSources.some(source => domain.includes(source) || sourceLower.includes(source))) {
      credibility = 0.95;
    } else if (medCredSources.some(source => domain.includes(source) || sourceLower.includes(source))) {
      credibility = 0.85;
    } else if (domain.includes('.edu')) {
      credibility = 0.80;
    } else if (domain.includes('.gov')) {
      credibility = 0.85;
    } else if (domain.includes('.org')) {
      credibility = 0.75;
    }

    // Boost for source mentions in content
    if (sourceLower.includes('nature') || sourceLower.includes('stanford') || sourceLower.includes('harvard')) {
      credibility = Math.min(0.98, credibility + 0.1);
    }

    return credibility;
  }

  /**
   * Check if content has a valid URL
   */
  private hasValidUrl(content: string, url?: string): boolean {
    const urlPattern = /https?:\/\/[^\s]+/g;
    const contentUrls = content.match(urlPattern);
    
    return Boolean(contentUrls?.length > 0 || url);
  }

  /**
   * Check if content has a proper citation
   */
  private hasCitation(content: string, source?: string): boolean {
    // Look for citation patterns
    const citationPatterns = [
      /\([^)]*20\d{2}[^)]*\)/g, // (Year) format
      /\([^)]*nature[^)]*\)/gi, // (Nature, 2024)
      /\([^)]*nejm[^)]*\)/gi, // (NEJM, 2024)
      /\([^)]*stanford[^)]*\)/gi, // (Stanford, 2024)
      /\([^)]*study[^)]*\)/gi, // (Study, 2024)
      /\([^)]*who[^)]*\)/gi, // (WHO, 2024)
      /\([^)]*fda[^)]*\)/gi // (FDA, 2024)
    ];

    const hasCitationFormat = citationPatterns.some(pattern => pattern.test(content));
    const hasSource = Boolean(source);
    
    return hasCitationFormat || hasSource;
  }

  /**
   * Log rejected content to database
   */
  async logRejectedDraft(content: string, metrics: QualityMetrics, reason: string): Promise<void> {
    try {
      const { error } = await supabaseClient.supabase
        .from('rejected_drafts')
        .insert({
          content,
          rejection_reason: reason,
          quality_metrics: metrics,
          rejected_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Failed to log rejected draft:', error);
      } else {
        console.log('📝 Logged rejected draft to database');
      }
    } catch (error) {
      console.error('❌ Error logging rejected draft:', error);
    }
  }

  /**
   * Helper methods
   */
  private countSentences(text: string): number {
    return (text.match(/[.!?]+/g) || []).length || 1;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private countSyllables(text: string): number {
    const words: string[] = text.toLowerCase().match(/\b\w+\b/g) || [];
    let totalSyllables = 0;
    
    for (const word of words) {
      // Simple syllable counting (vowel groups)
      const syllableMatches = word.match(/[aeiouy]+/g) || [];
      let syllables = syllableMatches.length;
      
      // Adjust for silent e
      if (word.endsWith('e') && syllables > 1) syllables--;
      
      totalSyllables += Math.max(1, syllables);
    }
    
    return totalSyllables;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Get quality statistics
   */
  async getQualityStats(): Promise<{
    totalChecked: number;
    passRate: number;
    commonFailures: string[];
    avgReadability: number;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('rejected_drafts')
        .select('quality_metrics, rejection_reason')
        .order('rejected_at', { ascending: false })
        .limit(100);

      if (error || !data) {
        return {
          totalChecked: 0,
          passRate: 0,
          commonFailures: [],
          avgReadability: 0
        };
      }

      const totalRejected = data.length;
      const failureReasons = data.map(d => d.rejection_reason).filter(Boolean);
      const readabilityScores = data
        .map(d => d.quality_metrics?.readabilityScore)
        .filter(score => typeof score === 'number');

      return {
        totalChecked: totalRejected,
        passRate: 0, // Would need total tweets to calculate
        commonFailures: this.getTopFailures(failureReasons),
        avgReadability: readabilityScores.length > 0 
          ? readabilityScores.reduce((sum, score) => sum + score, 0) / readabilityScores.length
          : 0
      };

    } catch (error) {
      console.error('❌ Error getting quality stats:', error);
      return { totalChecked: 0, passRate: 0, commonFailures: [], avgReadability: 0 };
    }
  }

  private getTopFailures(reasons: string[]): string[] {
    const counts = reasons.reduce((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([reason]) => reason);
  }
} 