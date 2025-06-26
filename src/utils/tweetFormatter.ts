/**
 * Tweet Formatter - Makes complex health tech content more readable and human-like
 */

interface FormattedTweet {
  content: string;
  readabilityScore: number;
  improvements: string[];
}

interface TweetSection {
  type: 'headline' | 'fact' | 'insight' | 'statistic' | 'source';
  content: string;
  priority: number;
}

export class TweetFormatter {
  
  /**
   * Makes tweets more readable and digestible with human voice
   */
  formatForReadability(rawContent: string): FormattedTweet {
    console.log('📝 Formatting tweet for human-voice readability...');
    
    // STEP 1: Remove ALL hashtags first
    let content = this.removeAllHashtags(rawContent);
    
    // STEP 2: Apply human voice transformation
    content = this.applyHumanVoice(content);
    
    const sections = this.parseContentSections(content);
    const formatted = this.restructureContent(sections);
    const polished = this.applyReadabilityRules(formatted);
    
    const improvements = this.getImprovements(rawContent, polished);
    const readabilityScore = this.calculateReadabilityScore(polished);
    
    console.log(`✨ Human voice readability: ${readabilityScore}/100`);
    
    return {
      content: polished,
      readabilityScore,
      improvements
    };
  }

  /**
   * CRITICAL: Remove ALL hashtags from content
   */
  private removeAllHashtags(content: string): string {
    // Remove hashtags completely - no exceptions
    let cleaned = content.replace(/#\w+\b/g, '');
    
    // Clean up extra spaces left by hashtag removal
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove any remaining hashtag-like patterns
    cleaned = cleaned.replace(/#[^\s]*/g, '');
    
    console.log('🚫 Removed all hashtags from content');
    return cleaned;
  }

  /**
   * Transform content to human conversational voice
   */
  private applyHumanVoice(content: string): string {
    let humanized = content;

    // Convert to conversational tone
    humanized = humanized.replace(/\bThis study shows\b/gi, 'We just learned');
    humanized = humanized.replace(/\bResearch demonstrates\b/gi, 'Researchers found');
    humanized = humanized.replace(/\bData indicates\b/gi, 'The data shows');
    humanized = humanized.replace(/\bResults suggest\b/gi, 'Turns out');
    humanized = humanized.replace(/\bStudies reveal\b/gi, 'Studies are showing');
    
    // Add conversational connectors
    humanized = humanized.replace(/\. ([A-Z])/g, '. Here\'s the thing: $1');
    humanized = humanized.replace(/\. The implications/gi, '. What this means');
    humanized = humanized.replace(/\. However,/gi, '. But here\'s where it gets interesting:');
    
    // Use "you/we" language
    humanized = humanized.replace(/\bpatients\b/gi, 'you');
    humanized = humanized.replace(/\bOne can\b/gi, 'You can');
    humanized = humanized.replace(/\bIndividuals may\b/gi, 'You might');
    
    // Simplify academic language
    humanized = humanized.replace(/\butilize\b/gi, 'use');
    humanized = humanized.replace(/\bdemonstrate\b/gi, 'show');
    humanized = humanized.replace(/\bfacilitate\b/gi, 'help');
    humanized = humanized.replace(/\bsignificantly\b/gi, 'dramatically');
    humanized = humanized.replace(/\bsubstantially\b/gi, 'massively');
    
    console.log('🗣️ Applied human conversational voice');
    return humanized;
  }
  
  private parseContentSections(content: string): TweetSection[] {
    const sections: TweetSection[] = [];
    
    // Extract headline (first sentence or breaking news)
    const headlines = content.match(/^(🚨.*?:|BREAKING:.*?:|.*?breakthrough.*?[.:!])/i);
    if (headlines) {
      sections.push({
        type: 'headline',
        content: headlines[1].trim(),
        priority: 10
      });
    }
    
    // Extract statistics
    const stats = content.match(/\d+%|\d+x|[\d,]+\s*(patients|people|users|studies|trials)/g);
    if (stats) {
      stats.forEach(stat => {
        sections.push({
          type: 'statistic',
          content: stat,
          priority: 8
        });
      });
    }
    
    // Extract key facts
    const facts = content.match(/(?:shows?|reveals?|finds?|demonstrates?).*?[.!]/gi);
    if (facts) {
      facts.forEach(fact => {
        sections.push({
          type: 'fact',
          content: fact.trim(),
          priority: 7
        });
      });
    }
    
    // Extract sources
    const sources = content.match(/Source:.*?(?:\s|$)|(?:Study|Research|Report).*?(?:\s|$)/gi);
    if (sources) {
      sources.forEach(source => {
        sections.push({
          type: 'source',
          content: source.trim(),
          priority: 3
        });
      });
    }
    
    return sections;
  }
  
  private restructureContent(sections: TweetSection[]): string {
    // Sort sections by priority (highest first)
    const sorted = sections.sort((a, b) => b.priority - a.priority);
    
    let formatted = '';
    let usedTypes = new Set<string>();
    
    // Build the tweet structure
    for (const section of sorted) {
      if (usedTypes.has(section.type)) continue;
      
      switch (section.type) {
        case 'headline':
          formatted += this.formatHeadline(section.content) + '\n\n';
          break;
        case 'statistic':
          formatted += this.formatStatistic(section.content) + '\n\n';
          break;
        case 'fact':
          formatted += this.formatFact(section.content) + '\n\n';
          break;
        case 'insight':
          formatted += this.formatInsight(section.content) + '\n\n';
          break;
        case 'source':
          formatted += this.formatSource(section.content) + '\n\n';
          break;
      }
      
      usedTypes.add(section.type);
    }
    
    return formatted.trim();
  }
  
  private formatHeadline(content: string): string {
    // Make headlines punchy but human - limit emoji use
    let formatted = content;
    
    // Remove excessive emojis, keep max 1
    const emojiCount = (formatted.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 1) {
      // Keep only first emoji
      const firstEmoji = formatted.match(/[\u{1F300}-\u{1F9FF}]/u);
      formatted = formatted.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      if (firstEmoji) {
        formatted = firstEmoji[0] + ' ' + formatted.trim();
      }
    }
    
    // Human conversational starters
    if (formatted.toLowerCase().includes('breakthrough')) {
      formatted = 'Ever wonder why ' + formatted.toLowerCase().replace('breakthrough:', '').trim() + '?';
    } else if (formatted.toLowerCase().includes('breaking')) {
      formatted = 'We just crossed a line. ' + formatted.replace(/breaking:?\s*/gi, '').trim();
    }
    
    return formatted;
  }
  
  private formatStatistic(content: string): string {
    // Make statistics conversational
    return `Here's what caught my attention: ${content}`;
  }
  
  private formatFact(content: string): string {
    // Clean up fact presentation
    let formatted = content;
    
    // Remove redundant words
    formatted = formatted.replace(/^(The study |Research |This |The research )/i, '');
    
    // Make it conversational
    if (!formatted.startsWith('The part no one mentions')) {
      formatted = 'The part no one mentions: ' + formatted.toLowerCase();
    }
    
    return formatted;
  }
  
  private formatInsight(content: string): string {
    return `Here's what this really means: ${content}`;
  }
  
  private formatSource(content: string): string {
    // Clean up source formatting
    let formatted = content;
    
    // Standardize source format
    formatted = formatted.replace(/^Source:\s*/i, '');
    formatted = formatted.replace(/\s*$/, '');
    
    return `Source: ${formatted}`;
  }
  
  private applyReadabilityRules(content: string): string {
    let improved = content;
    
    // Rule 1: Break up long sentences
    improved = this.breakLongSentences(improved);
    
    // Rule 2: Simplify complex terms
    improved = this.simplifyTerms(improved);
    
    // Rule 3: Add breathing space
    improved = this.addBreathingSpace(improved);
    
    // Rule 4: Ensure proper flow
    improved = this.improveFlow(improved);
    
    // Rule 5: Character limit compliance
    improved = this.ensureCharacterLimit(improved);
    
    // Rule 6: FINAL hashtag removal check
    improved = this.removeAllHashtags(improved);
    
    return improved;
  }
  
  private breakLongSentences(content: string): string {
    // Split sentences longer than 40 words
    return content.replace(/([^.!?]{120,}?)(\s+)(and|but|however|moreover|furthermore|additionally)/gi, 
      '$1.\n\n$3');
  }
  
  private simplifyTerms(content: string): string {
    const simplifications = {
      'utilize': 'use',
      'demonstrate': 'show',
      'facilitate': 'help',
      'implement': 'use',
      'methodology': 'method',
      'optimization': 'improvement',
      'enhancement': 'improvement',
      'significantly': 'dramatically',
      'substantially': 'massively',
      'approximately': 'about',
      'individuals': 'people',
      'participants': 'people',
      'commence': 'start',
      'terminate': 'end',
      'sufficient': 'enough'
    };
    
    let simplified = content;
    for (const [complex, simple] of Object.entries(simplifications)) {
      const regex = new RegExp(`\\b${complex}\\b`, 'gi');
      simplified = simplified.replace(regex, simple);
    }
    
    return simplified;
  }
  
  private addBreathingSpace(content: string): string {
    // Add line breaks for readability
    return content.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');
  }
  
  private improveFlow(content: string): string {
    // Add conversational connectors
    let improved = content;
    
    // Add thread indicators for complex topics
    if (improved.length > 200 && !improved.includes('(1/')) {
      improved = improved + ' (1/🧵)';
    }
    
    return improved;
  }
  
  private ensureCharacterLimit(content: string): string {
    const maxLength = 270; // Leave room for potential additions
    
    if (content.length <= maxLength) {
      return content;
    }
    
    // Progressive trimming strategy - NO HASHTAGS TO PRESERVE
    let trimmed = content;
    
    // 1. Shorten source if still too long
    if (trimmed.length > maxLength) {
      trimmed = trimmed.replace(/Source:.*$/m, 'Source: Research study');
    }
    
    // 2. Trim content if still too long
    if (trimmed.length > maxLength) {
      const lines = trimmed.split('\n\n');
      while (lines.length > 1 && trimmed.length > maxLength) {
        lines.pop();
        trimmed = lines.join('\n\n');
      }
    }
    
    // 3. Hard truncate if necessary (preserve emojis)
    if (trimmed.length > maxLength) {
      trimmed = trimmed.substring(0, maxLength - 3) + '...';
    }
    
    return trimmed;
  }
  
  private calculateReadabilityScore(content: string): number {
    let score = 50; // Base score
    
    // Positive factors
    if (content.includes('you') || content.includes('we')) score += 15; // Conversational
    if (content.match(/\d+%/)) score += 10; // Concrete data
    if (content.split('\n\n').length >= 2) score += 10; // Good spacing
    if (content.length < 250) score += 10; // Appropriate length
    if (content.match(/^[🚨🔥⚡️💡🎯]/)) score += 5; // Good opening
    if (!content.includes('#')) score += 20; // No hashtags (HUMAN VOICE)
    
    // Negative factors
    if (content.length > 270) score -= 15; // Too long
    if (content.split(' ').some(word => word.length > 15)) score -= 10; // Complex words
    if (!content.match(/[.!]/)) score -= 10; // No clear ending
    if (content.includes('#')) score -= 30; // PENALTY for hashtags
    
    return Math.max(0, Math.min(100, score));
  }
  
  private getImprovements(original: string, formatted: string): string[] {
    const improvements: string[] = [];
    
    if (formatted.length < original.length) {
      improvements.push('Reduced length for better readability');
    }
    
    if (!formatted.includes('#') && original.includes('#')) {
      improvements.push('Removed hashtags for human voice');
    }
    
    if ((formatted.match(/\byou\b/gi) || []).length > (original.match(/\byou\b/gi) || []).length) {
      improvements.push('Added conversational "you" language');
    }
    
    if (formatted.includes('Here\'s') && !original.includes('Here\'s')) {
      improvements.push('Added conversational transitions');
    }
    
    if (formatted.split('\n\n').length > original.split('\n\n').length) {
      improvements.push('Added breathing space between concepts');
    }
    
    return improvements;
  }
}

export const tweetFormatter = new TweetFormatter(); 