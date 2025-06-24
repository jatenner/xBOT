/**
 * Tweet Formatter - Makes complex health tech content more readable
 */

interface FormattedTweet {
  content: string;
  readabilityScore: number;
  improvements: string[];
}

interface TweetSection {
  type: 'headline' | 'fact' | 'insight' | 'statistic' | 'source' | 'hashtag';
  content: string;
  priority: number;
}

export class TweetFormatter {
  
  /**
   * Makes tweets more readable and digestible
   */
  formatForReadability(rawContent: string): FormattedTweet {
    console.log('📝 Formatting tweet for readability...');
    
    const sections = this.parseContentSections(rawContent);
    const formatted = this.restructureContent(sections);
    const polished = this.applyReadabilityRules(formatted);
    
    const improvements = this.getImprovements(rawContent, polished);
    const readabilityScore = this.calculateReadabilityScore(polished);
    
    console.log(`✨ Readability improved: ${readabilityScore}/100`);
    
    return {
      content: polished,
      readabilityScore,
      improvements
    };
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
    
    // Extract hashtags
    const hashtags = content.match(/#\w+/g);
    if (hashtags) {
      sections.push({
        type: 'hashtag',
        content: hashtags.join(' '),
        priority: 2
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
        case 'hashtag':
          formatted += section.content;
          break;
      }
      
      usedTypes.add(section.type);
    }
    
    return formatted.trim();
  }
  
  private formatHeadline(content: string): string {
    // Make headlines punchy and clear
    let formatted = content;
    
    // Add emoji if missing
    if (!formatted.match(/^[🚨🔥⚡️💡🎯]/)) {
      if (formatted.toLowerCase().includes('breakthrough')) {
        formatted = '🔥 ' + formatted;
      } else if (formatted.toLowerCase().includes('breaking')) {
        formatted = '🚨 ' + formatted;
      } else {
        formatted = '💡 ' + formatted;
      }
    }
    
    // Ensure proper punctuation
    if (!formatted.match(/[.!:]$/)) {
      formatted += ':';
    }
    
    return formatted;
  }
  
  private formatStatistic(content: string): string {
    // Make statistics stand out
    return `📊 Key finding: ${content}`;
  }
  
  private formatFact(content: string): string {
    // Clean up fact presentation
    let formatted = content;
    
    // Remove redundant words
    formatted = formatted.replace(/^(The study |Research |This |The research )/i, '');
    
    // Add bullet if it's a key point
    if (!formatted.startsWith('•') && !formatted.startsWith('→')) {
      formatted = '→ ' + formatted;
    }
    
    return formatted;
  }
  
  private formatInsight(content: string): string {
    return `🧠 ${content}`;
  }
  
  private formatSource(content: string): string {
    // Clean up source formatting
    let formatted = content;
    
    // Standardize source format
    formatted = formatted.replace(/^Source:\s*/i, '');
    formatted = formatted.replace(/\s*$/, '');
    
    return `📚 ${formatted}`;
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
      'significantly': 'greatly',
      'substantially': 'greatly',
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
    // Ensure proper spacing between sections
    return content
      .replace(/([.!:])\s*([🚨🔥⚡️💡🎯📊🧠📚→])/g, '$1\n\n$2')
      .replace(/\n{3,}/g, '\n\n');
  }
  
  private improveFlow(content: string): string {
    // Add transitions where needed
    let improved = content;
    
    // Add connectors for better flow
    improved = improved.replace(/\n\n(📊|→)/g, '\n\n$1');
    improved = improved.replace(/:\n\n→/g, ':\n→');
    
    return improved;
  }
  
  private ensureCharacterLimit(content: string): string {
    const maxLength = 270; // Leave room for potential additions
    
    if (content.length <= maxLength) {
      return content;
    }
    
    // Progressive trimming strategy
    let trimmed = content;
    
    // 1. Remove extra hashtags
    const hashtags = trimmed.match(/#\w+/g) || [];
    if (hashtags.length > 3) {
      const keepHashtags = hashtags.slice(0, 3).join(' ');
      trimmed = trimmed.replace(/#\w+(\s+#\w+)*/g, keepHashtags);
    }
    
    // 2. Shorten source if still too long
    if (trimmed.length > maxLength) {
      trimmed = trimmed.replace(/📚.*$/m, '📚 Source: Research study');
    }
    
    // 3. Trim content if still too long
    if (trimmed.length > maxLength) {
      const lines = trimmed.split('\n\n');
      while (lines.length > 1 && trimmed.length > maxLength) {
        lines.pop();
        trimmed = lines.join('\n\n');
      }
    }
    
    // 4. Hard truncate if necessary (preserve emojis)
    if (trimmed.length > maxLength) {
      trimmed = trimmed.substring(0, maxLength - 3) + '...';
    }
    
    return trimmed;
  }
  
  private calculateReadabilityScore(content: string): number {
    let score = 50; // Base score
    
    // Positive factors
    if (content.includes('📊') || content.includes('→')) score += 10; // Clear structure
    if (content.match(/\d+%/)) score += 10; // Concrete data
    if (content.split('\n\n').length >= 2) score += 10; // Good spacing
    if (content.length < 250) score += 10; // Appropriate length
    if (content.match(/^[🚨🔥⚡️💡🎯]/)) score += 5; // Good opening
    
    // Negative factors
    if (content.length > 270) score -= 15; // Too long
    if (content.split(' ').some(word => word.length > 15)) score -= 10; // Complex words
    if (!content.match(/[.!]/)) score -= 10; // No clear ending
    
    return Math.max(0, Math.min(100, score));
  }
  
  private getImprovements(original: string, formatted: string): string[] {
    const improvements: string[] = [];
    
    if (formatted.length < original.length) {
      improvements.push('Reduced length for better readability');
    }
    
    if (formatted.includes('📊') && !original.includes('📊')) {
      improvements.push('Added clear data presentation');
    }
    
    if (formatted.includes('→') && !original.includes('→')) {
      improvements.push('Improved information flow');
    }
    
    if (formatted.split('\n\n').length > original.split('\n\n').length) {
      improvements.push('Added breathing space between concepts');
    }
    
    return improvements;
  }
}

export const tweetFormatter = new TweetFormatter(); 