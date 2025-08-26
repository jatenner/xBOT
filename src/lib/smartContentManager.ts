/**
 * SMART CONTENT MANAGER
 * 
 * Fixes content length issues by implementing intelligent truncation
 * that preserves meaning instead of cutting off mid-sentence
 */

export interface SmartTruncationResult {
  content: string;
  originalLength: number;
  finalLength: number;
  wasTruncated: boolean;
  truncationMethod: string;
  qualityScore: number;
}

export class SmartContentManager {
  private readonly MAX_TWEET_LENGTH = 250; // Conservative limit for reliability
  private readonly MIN_MEANINGFUL_LENGTH = 80;

  /**
   * Intelligently truncate content preserving meaning
   */
  public smartTruncate(content: string, maxLength: number = this.MAX_TWEET_LENGTH): SmartTruncationResult {
    const originalLength = content.length;
    
    if (originalLength <= maxLength) {
      return {
        content,
        originalLength,
        finalLength: originalLength,
        wasTruncated: false,
        truncationMethod: 'none',
        qualityScore: this.calculateQualityScore(content)
      };
    }

    console.log(`🔧 SMART_TRUNCATION: ${originalLength} → ${maxLength} chars`);

    // Method 1: Try to truncate at sentence boundaries
    const sentenceTruncated = this.truncateAtSentences(content, maxLength);
    if (sentenceTruncated.length >= this.MIN_MEANINGFUL_LENGTH) {
      return {
        content: sentenceTruncated,
        originalLength,
        finalLength: sentenceTruncated.length,
        wasTruncated: true,
        truncationMethod: 'sentence_boundary',
        qualityScore: this.calculateQualityScore(sentenceTruncated)
      };
    }

    // Method 2: Try to truncate at phrase boundaries
    const phraseTruncated = this.truncateAtPhrases(content, maxLength);
    if (phraseTruncated.length >= this.MIN_MEANINGFUL_LENGTH) {
      return {
        content: phraseTruncated,
        originalLength,
        finalLength: phraseTruncated.length,
        wasTruncated: true,
        truncationMethod: 'phrase_boundary',
        qualityScore: this.calculateQualityScore(phraseTruncated)
      };
    }

    // Method 3: Compress content by removing filler words
    const compressed = this.compressContent(content, maxLength);
    if (compressed.length <= maxLength && compressed.length >= this.MIN_MEANINGFUL_LENGTH) {
      return {
        content: compressed,
        originalLength,
        finalLength: compressed.length,
        wasTruncated: true,
        truncationMethod: 'compression',
        qualityScore: this.calculateQualityScore(compressed)
      };
    }

    // Method 4: Last resort - smart word truncation
    const wordTruncated = this.truncateAtWords(content, maxLength);
    return {
      content: wordTruncated,
      originalLength,
      finalLength: wordTruncated.length,
      wasTruncated: true,
      truncationMethod: 'word_boundary',
      qualityScore: this.calculateQualityScore(wordTruncated)
    };
  }

  /**
   * Truncate at sentence boundaries to preserve complete thoughts
   */
  private truncateAtSentences(content: string, maxLength: number): string {
    const sentences = content.split(/(?<=[.!?])\s+/);
    let result = '';
    
    for (const sentence of sentences) {
      const potential = result + (result ? ' ' : '') + sentence;
      if (potential.length <= maxLength) {
        result = potential;
      } else {
        break;
      }
    }
    
    return result || sentences[0].substring(0, maxLength - 3) + '...';
  }

  /**
   * Truncate at phrase boundaries (commas, semicolons)
   */
  private truncateAtPhrases(content: string, maxLength: number): string {
    const phrases = content.split(/(?<=[,;])\s+/);
    let result = '';
    
    for (const phrase of phrases) {
      const potential = result + (result ? ' ' : '') + phrase;
      if (potential.length <= maxLength) {
        result = potential;
      } else {
        break;
      }
    }
    
    return result || content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Compress content by removing filler words and unnecessary elements
   */
  private compressContent(content: string, maxLength: number): string {
    let compressed = content;

    // Remove filler words
    const fillers = [
      /\b(actually|basically|literally|really|very|quite|rather|somewhat|pretty|fairly)\s+/gi,
      /\b(you know|I mean|like|um|uh|well)\s*,?\s*/gi,
      /\s+(and|or|but)\s+/g, // Reduce conjunctions
      /\s{2,}/g, // Multiple spaces
    ];

    fillers.forEach(filler => {
      compressed = compressed.replace(filler, match => {
        if (match.includes('and') || match.includes('or') || match.includes('but')) {
          return ' ';
        }
        return '';
      });
    });

    // Replace long phrases with shorter alternatives
    const replacements = [
      { from: /in order to/gi, to: 'to' },
      { from: /due to the fact that/gi, to: 'because' },
      { from: /at this point in time/gi, to: 'now' },
      { from: /for the purpose of/gi, to: 'to' },
      { from: /a number of/gi, to: 'several' },
      { from: /in the event that/gi, to: 'if' },
      { from: /prior to/gi, to: 'before' },
      { from: /subsequent to/gi, to: 'after' },
    ];

    replacements.forEach(({ from, to }) => {
      compressed = compressed.replace(from, to);
    });

    // If still too long, truncate at word boundary
    if (compressed.length > maxLength) {
      compressed = this.truncateAtWords(compressed, maxLength);
    }

    return compressed.trim();
  }

  /**
   * Truncate at word boundaries as last resort
   */
  private truncateAtWords(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    
    const words = content.split(' ');
    let result = '';
    
    for (const word of words) {
      const potential = result + (result ? ' ' : '') + word;
      if (potential.length <= maxLength - 3) { // Leave space for ellipsis
        result = potential;
      } else {
        break;
      }
    }
    
    return result + '...';
  }

  /**
   * Calculate content quality score after truncation
   */
  private calculateQualityScore(content: string): number {
    let score = 50; // Base score

    // Length scoring
    if (content.length >= 100 && content.length <= 250) score += 20;
    if (content.length < 80) score -= 20; // Too short penalty

    // Completeness scoring
    const endsWithPunctuation = /[.!?]$/.test(content.trim());
    if (endsWithPunctuation) score += 15;
    if (content.endsWith('...')) score -= 5; // Truncation penalty

    // Content quality indicators
    if (content.includes('study') || content.includes('research')) score += 10;
    if (/\d+/.test(content)) score += 10; // Contains numbers
    if (content.split(' ').length >= 8) score += 5; // Sufficient word count

    // Readability
    const avgWordLength = content.split(' ').reduce((sum, word) => sum + word.length, 0) / content.split(' ').length;
    if (avgWordLength >= 4 && avgWordLength <= 6) score += 5; // Good readability

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Process a thread to ensure all tweets are within limits
   */
  public processThread(tweets: string[]): SmartTruncationResult[] {
    console.log(`🧵 SMART_THREAD_PROCESSING: ${tweets.length} tweets`);
    
    return tweets.map((tweet, index) => {
      const result = this.smartTruncate(tweet);
      
      if (result.wasTruncated) {
        console.log(`📝 Tweet ${index + 1}: ${result.truncationMethod} (${result.originalLength} → ${result.finalLength})`);
      }
      
      return result;
    });
  }

  /**
   * Validate content meets quality standards
   */
  public validateContent(content: string): { isValid: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (content.length < this.MIN_MEANINGFUL_LENGTH) {
      issues.push(`Content too short (${content.length} chars, minimum ${this.MIN_MEANINGFUL_LENGTH})`);
      suggestions.push('Add more specific details or examples');
    }

    if (content.length > this.MAX_TWEET_LENGTH) {
      issues.push(`Content too long (${content.length} chars, maximum ${this.MAX_TWEET_LENGTH})`);
      suggestions.push('Use smart truncation or split into thread');
    }

    if (!content.includes('.') && !content.includes('!') && !content.includes('?')) {
      issues.push('No punctuation found');
      suggestions.push('Add proper sentence structure');
    }

    const wordCount = content.split(' ').length;
    if (wordCount < 8) {
      issues.push('Very few words - may lack substance');
      suggestions.push('Expand with more details');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
}

export const smartContentManager = new SmartContentManager();
