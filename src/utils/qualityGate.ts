import { supabaseClient } from './supabaseClient';

export interface QualityMetrics {
  readabilityScore: number;
  factCount: number;
  sourceCredibility: number;
  hasUrl: boolean;
  hasCitation: boolean;
  characterCount: number;
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
}

export class QualityGate {
  private readonly defaultRules: QualityGateRules = {
    minReadabilityScore: 45,
    minFactCount: 2,
    minSourceCredibility: 0.8,
    requireUrl: true,
    requireCitation: true,
    maxCharacterCount: 280
  };

  /**
   * Main quality gate check
   */
  async checkQuality(content: string, url?: string, source?: string, customRules?: Partial<QualityGateRules>): Promise<QualityMetrics> {
    const rules = { ...this.defaultRules, ...customRules };
    const metrics: QualityMetrics = {
      readabilityScore: this.calculateReadabilityScore(content),
      factCount: this.countFacts(content),
      sourceCredibility: this.calculateSourceCredibility(url, source),
      hasUrl: this.hasValidUrl(content, url),
      hasCitation: this.hasCitation(content, source),
      characterCount: content.length,
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
      }
    ];

    // Collect failures
    checks.forEach(check => {
      if (!check.condition) {
        metrics.failureReasons.push(check.reason);
      }
    });

    metrics.passesGate = metrics.failureReasons.length === 0;

    console.log(`🚪 Quality Gate: ${metrics.passesGate ? '✅ PASSED' : '❌ FAILED'}`);
    if (!metrics.passesGate) {
      console.log(`   Failures: ${metrics.failureReasons.join(', ')}`);
    }
    console.log(`   📊 Readability: ${metrics.readabilityScore}, Facts: ${metrics.factCount}, Credibility: ${metrics.sourceCredibility.toFixed(2)}`);

    return metrics;
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
    
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
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