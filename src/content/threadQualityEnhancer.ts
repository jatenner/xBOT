/**
 * 🧵 THREAD QUALITY ENHANCER
 * 
 * Fixes thread quality and organization issues:
 * - Proper visual formatting and structure
 * - Enhanced flow and readability
 * - Content quality validation
 * - Professional thread presentation
 * - Sequential organization optimization
 */

interface ThreadQualityResult {
  enhancedTweets: string[];
  qualityScore: number;
  improvements: string[];
  warnings: string[];
  metadata: {
    originalCount: number;
    finalCount: number;
    avgLength: number;
    structureType: 'single' | 'thread' | 'mini_thread';
  };
}

interface QualityMetrics {
  length: number;
  structure: number;
  readability: number;
  flow: number;
  engagement: number;
}

export class ThreadQualityEnhancer {
  private static instance: ThreadQualityEnhancer;
  
  private constructor() {}

  public static getInstance(): ThreadQualityEnhancer {
    if (!ThreadQualityEnhancer.instance) {
      ThreadQualityEnhancer.instance = new ThreadQualityEnhancer();
    }
    return ThreadQualityEnhancer.instance;
  }

  /**
   * 🎯 Main function: Enhance thread quality and organization
   */
  public enhanceThreadQuality(tweets: string[], topic?: string): ThreadQualityResult {
    console.log(`🧵 QUALITY_ENHANCER: Processing ${tweets.length} tweets`);

    if (tweets.length === 0) {
      return this.getEmptyResult();
    }

    // Clean and prepare tweets
    const cleanedTweets = this.cleanBasicIssues(tweets);
    
    // Enhance structure and formatting
    const structuredTweets = this.enhanceStructure(cleanedTweets, topic);
    
    // Optimize content flow
    const flowOptimized = this.optimizeFlow(structuredTweets);
    
    // Final quality validation and improvements
    const finalTweets = this.finalQualityPass(flowOptimized);
    
    // Calculate quality metrics
    const qualityScore = this.calculateQualityScore(finalTweets);
    const improvements = this.trackImprovements(tweets, finalTweets);
    const warnings = this.generateWarnings(finalTweets);

    console.log(`✅ QUALITY_ENHANCED: ${tweets.length} → ${finalTweets.length} tweets (score: ${qualityScore}/100)`);

    return {
      enhancedTweets: finalTweets,
      qualityScore,
      improvements,
      warnings,
      metadata: {
        originalCount: tweets.length,
        finalCount: finalTweets.length,
        avgLength: finalTweets.reduce((sum, tweet) => sum + tweet.length, 0) / finalTweets.length,
        structureType: this.determineStructureType(finalTweets.length)
      }
    };
  }

  /**
   * 🧹 Clean basic formatting and structure issues
   */
  private cleanBasicIssues(tweets: string[]): string[] {
    return tweets.map((tweet, index) => {
      let cleaned = tweet.trim();

      // Remove redundant numbering and formatting
      cleaned = cleaned.replace(/^\d+[\.)]\s*/g, ''); // Remove "1. " or "1) "
      cleaned = cleaned.replace(/^\(\d+\/\d+\)\s*/g, ''); // Remove "(1/5) "
      cleaned = cleaned.replace(/^🧵\s*/g, ''); // Remove thread emoji from non-root tweets
      cleaned = cleaned.replace(/^Thread:\s*/gi, ''); // Remove "Thread: " prefix
      
      // Fix spacing issues
      cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces → single space
      cleaned = cleaned.replace(/\s+([.!?])/g, '$1'); // "word ." → "word."
      cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // "word.Word" → "word. Word"
      
      // Remove trailing/leading whitespace
      cleaned = cleaned.trim();

      return cleaned;
    }).filter(tweet => tweet.length > 0); // Remove empty tweets
  }

  /**
   * 🏗️ Enhance thread structure and visual organization
   */
  private enhanceStructure(tweets: string[], topic?: string): string[] {
    if (tweets.length === 0) return [];

    const enhanced: string[] = [];

    for (let i = 0; i < tweets.length; i++) {
      let tweet = tweets[i];
      const isRoot = i === 0;
      const isLast = i === tweets.length - 1;

      if (isRoot) {
        // ROOT TWEET: Strong opener with thread indication
        tweet = this.enhanceRootTweet(tweet, topic, tweets.length);
      } else {
        // REPLY TWEETS: Clear continuation with proper flow
        tweet = this.enhanceReplyTweet(tweet, i, tweets.length, isLast);
      }

      // Ensure proper length constraints
      if (tweet.length > 270) {
        console.warn(`⚠️ Tweet ${i + 1} too long (${tweet.length} chars), truncating`);
        tweet = this.smartTruncate(tweet, 265);
      }

      // Ensure minimum quality
      if (tweet.length < 15 && tweets.length > 1) {
        console.warn(`⚠️ Tweet ${i + 1} too short (${tweet.length} chars), enhancing`);
        tweet = this.enhanceShortTweet(tweet, i, topic);
      }

      enhanced.push(tweet);
    }

    return enhanced;
  }

  /**
   * 🌟 Enhance root tweet with strong opener
   */
  private enhanceRootTweet(tweet: string, topic?: string, totalTweets?: number): string {
    let enhanced = tweet;

    // Add thread indicator for multi-tweet threads
    if (totalTweets && totalTweets > 1) {
      const hasThreadIndicator = enhanced.includes('🧵') || 
                                 enhanced.toLowerCase().includes('thread') ||
                                 enhanced.includes('👇');

      if (!hasThreadIndicator) {
        // Add subtle thread emoji at the end
        if (enhanced.match(/[.!?]$/)) {
          enhanced = enhanced + ' 🧵';
        } else {
          enhanced = enhanced + '. 🧵';
        }
      }
    }

    // Ensure strong opening
    if (enhanced.length < 50 && topic) {
      // Enhance short root tweets with topic context
      enhanced = this.expandRootWithContext(enhanced, topic);
    }

    return enhanced;
  }

  /**
   * 💬 Enhance reply tweet with proper continuation
   */
  private enhanceReplyTweet(tweet: string, index: number, totalTweets: number, isLast: boolean): string {
    let enhanced = tweet;

    // Ensure proper punctuation
    if (!enhanced.match(/[.!?]$/)) {
      if (enhanced.includes('?') || enhanced.toLowerCase().includes('how') || 
          enhanced.toLowerCase().includes('what') || enhanced.toLowerCase().includes('why')) {
        enhanced += '?';
      } else if (enhanced.toLowerCase().includes('important') || 
                 enhanced.toLowerCase().includes('critical') || 
                 enhanced.toLowerCase().includes('remember') ||
                 enhanced.toLowerCase().includes('key') ||
                 enhanced.toLowerCase().includes('must')) {
        enhanced += '!';
      } else {
        enhanced += '.';
      }
    }

    // Add emphasis for important points
    if (isLast && totalTweets > 2) {
      // Final tweet should have conclusive tone
      if (!enhanced.toLowerCase().includes('finally') && 
          !enhanced.toLowerCase().includes('conclusion') &&
          !enhanced.toLowerCase().includes('remember') &&
          enhanced.length < 200) {
        // Don't add if already conclusive
      }
    }

    return enhanced;
  }

  /**
   * 🌊 Optimize content flow between tweets
   */
  private optimizeFlow(tweets: string[]): string[] {
    if (tweets.length <= 1) return tweets;

    const optimized = [...tweets];

    for (let i = 1; i < optimized.length; i++) {
      const currentTweet = optimized[i];
      const previousTweet = optimized[i - 1];

      // Check for repetitive openings
      const repetitiveStarters = ['Also,', 'Additionally,', 'Furthermore,', 'Moreover,'];
      
      for (const starter of repetitiveStarters) {
        if (currentTweet.startsWith(starter) && previousTweet.includes(starter.slice(0, -1))) {
          // Remove repetitive starter
          optimized[i] = currentTweet.substring(starter.length).trim();
          // Capitalize first letter
          optimized[i] = optimized[i].charAt(0).toUpperCase() + optimized[i].slice(1);
        }
      }

      // Ensure logical flow
      if (currentTweet.length < 30 && i < optimized.length - 1) {
        // Short tweet in middle of thread - might need expansion
        optimized[i] = this.expandMidThreadTweet(currentTweet, i);
      }
    }

    return optimized;
  }

  /**
   * ✨ Final quality pass with comprehensive improvements
   */
  private finalQualityPass(tweets: string[]): string[] {
    return tweets.map((tweet, index) => {
      let final = tweet;

      // Ensure readability
      final = this.improveReadability(final);
      
      // Fix common issues
      final = this.fixCommonIssues(final);
      
      // Validate engagement potential
      if (this.calculateEngagementPotential(final) < 30 && tweets.length > 1) {
        final = this.enhanceEngagement(final, index);
      }

      return final;
    });
  }

  /**
   * 📖 Improve readability and flow
   */
  private improveReadability(tweet: string): string {
    let improved = tweet;

    // Fix run-on sentences
    if (improved.length > 200 && improved.split('.').length === 1) {
      // Long sentence without periods - add breaks
      const words = improved.split(' ');
      if (words.length > 20) {
        const midPoint = Math.floor(words.length / 2);
        // Find a logical break point near the middle
        for (let i = midPoint - 3; i <= midPoint + 3; i++) {
          if (words[i] && (words[i].includes('and') || words[i].includes('but') || words[i].includes('because'))) {
            words[i] = words[i] + '.';
            words[i + 1] = words[i + 1].charAt(0).toUpperCase() + words[i + 1].slice(1);
            break;
          }
        }
        improved = words.join(' ');
      }
    }

    return improved;
  }

  /**
   * 🔧 Fix common content issues
   */
  private fixCommonIssues(tweet: string): string {
    let fixed = tweet;

    // Fix double punctuation
    fixed = fixed.replace(/[.!?]{2,}/g, '.');
    
    // Fix spacing around punctuation
    fixed = fixed.replace(/\s+([.!?])/g, '$1');
    fixed = fixed.replace(/([.!?])([A-Z])/g, '$1 $2');
    
    // Fix capitalization after periods
    fixed = fixed.replace(/\. ([a-z])/g, (match, letter) => `. ${letter.toUpperCase()}`);
    
    // Remove redundant words
    fixed = fixed.replace(/\b(very very|really really|quite quite)\b/gi, 'very');
    
    return fixed;
  }

  /**
   * 🚀 Smart truncation that preserves meaning
   */
  private smartTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Try to cut at sentence boundary
    const sentences = text.split(/[.!?]/);
    if (sentences.length > 1) {
      let truncated = '';
      for (const sentence of sentences) {
        if ((truncated + sentence).length <= maxLength - 1) {
          truncated += sentence + '.';
        } else {
          break;
        }
      }
      if (truncated.length > 20) return truncated.trim();
    }

    // Cut at word boundary
    const words = text.split(' ');
    let truncated = '';
    for (const word of words) {
      if ((truncated + ' ' + word).length <= maxLength - 3) {
        truncated += (truncated ? ' ' : '') + word;
      } else {
        break;
      }
    }

    return truncated + '...';
  }

  /**
   * 📊 Calculate overall quality score
   */
  private calculateQualityScore(tweets: string[]): number {
    if (tweets.length === 0) return 0;

    const metrics: QualityMetrics = {
      length: this.scoreLengthQuality(tweets),
      structure: this.scoreStructureQuality(tweets),
      readability: this.scoreReadability(tweets),
      flow: this.scoreFlow(tweets),
      engagement: this.scoreEngagementPotential(tweets)
    };

    // Weighted average
    const score = (
      metrics.length * 0.2 +
      metrics.structure * 0.25 +
      metrics.readability * 0.25 +
      metrics.flow * 0.15 +
      metrics.engagement * 0.15
    );

    return Math.round(score);
  }

  /**
   * Helper methods for quality scoring
   */
  private scoreLengthQuality(tweets: string[]): number {
    const avgLength = tweets.reduce((sum, tweet) => sum + tweet.length, 0) / tweets.length;
    if (avgLength >= 80 && avgLength <= 250) return 100;
    if (avgLength >= 50 && avgLength <= 270) return 80;
    if (avgLength >= 30) return 60;
    return 30;
  }

  private scoreStructureQuality(tweets: string[]): number {
    let score = 80; // Base score
    
    // Check for proper thread indicators
    if (tweets.length > 1 && tweets[0].includes('🧵')) score += 10;
    
    // Check for proper punctuation
    const properlyPunctuated = tweets.filter(tweet => tweet.match(/[.!?]$/)).length;
    score += (properlyPunctuated / tweets.length) * 10;
    
    return Math.min(100, score);
  }

  private scoreReadability(tweets: string[]): number {
    let score = 70; // Base score
    
    for (const tweet of tweets) {
      // Penalty for overly long sentences
      if (tweet.length > 200 && tweet.split('.').length === 1) score -= 10;
      
      // Bonus for good sentence structure
      if (tweet.split(' ').length >= 8 && tweet.split(' ').length <= 30) score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private scoreFlow(tweets: string[]): number {
    if (tweets.length <= 1) return 100;
    
    let score = 80;
    
    // Check for repetitive openings
    const starters = tweets.map(tweet => tweet.split(' ')[0].toLowerCase());
    const uniqueStarters = new Set(starters);
    if (uniqueStarters.size / starters.length > 0.7) score += 20;
    
    return Math.min(100, score);
  }

  private scoreEngagementPotential(tweets: string[]): number {
    let score = 50; // Base score
    
    for (const tweet of tweets) {
      // Bonus for questions
      if (tweet.includes('?')) score += 10;
      
      // Bonus for actionable content
      if (tweet.toLowerCase().includes('try') || tweet.toLowerCase().includes('do')) score += 5;
      
      // Bonus for specific numbers
      if (/\d+/.test(tweet)) score += 5;
    }
    
    return Math.min(100, score / tweets.length);
  }

  private calculateEngagementPotential(tweet: string): number {
    let score = 50;
    if (tweet.includes('?')) score += 20;
    if (/\d+/.test(tweet)) score += 15;
    if (tweet.toLowerCase().includes('you')) score += 10;
    return Math.min(100, score);
  }

  /**
   * Helper methods for content enhancement
   */
  private expandRootWithContext(tweet: string, topic: string): string {
    const topicContext = this.getTopicContext(topic);
    return `${tweet} ${topicContext}`;
  }

  private enhanceShortTweet(tweet: string, index: number, topic?: string): string {
    if (tweet.length < 20) {
      return `${tweet} This is an important point for ${topic || 'better health'}.`;
    }
    return tweet;
  }

  private expandMidThreadTweet(tweet: string, index: number): string {
    if (tweet.length < 40) {
      return `${tweet} This builds on the previous point and leads to our next insight.`;
    }
    return tweet;
  }

  private enhanceEngagement(tweet: string, index: number): string {
    if (!tweet.includes('you') && tweet.length < 200) {
      return tweet.replace(/\.$/, '. What is your experience with this?');
    }
    return tweet;
  }

  private getTopicContext(topic: string): string {
    const contexts = {
      'nutrition': 'for optimal nutrition',
      'exercise': 'for better fitness',
      'sleep': 'for quality sleep',
      'stress': 'for stress management',
      'health': 'for better health'
    };
    
    const lowerTopic = topic.toLowerCase();
    for (const [key, context] of Object.entries(contexts)) {
      if (lowerTopic.includes(key)) {
        return context;
      }
    }
    
    return 'for better health';
  }

  /**
   * Utility methods
   */
  private trackImprovements(original: string[], enhanced: string[]): string[] {
    const improvements: string[] = [];
    
    if (enhanced.length !== original.length) {
      improvements.push(`Tweet count optimized: ${original.length} → ${enhanced.length}`);
    }
    
    const avgOriginal = original.reduce((sum, tweet) => sum + tweet.length, 0) / original.length;
    const avgEnhanced = enhanced.reduce((sum, tweet) => sum + tweet.length, 0) / enhanced.length;
    
    if (Math.abs(avgEnhanced - avgOriginal) > 10) {
      improvements.push(`Average length optimized: ${Math.round(avgOriginal)} → ${Math.round(avgEnhanced)} chars`);
    }
    
    return improvements;
  }

  private generateWarnings(tweets: string[]): string[] {
    const warnings: string[] = [];
    
    tweets.forEach((tweet, i) => {
      if (tweet.length > 260) {
        warnings.push(`Tweet ${i + 1} near character limit (${tweet.length} chars)`);
      }
      if (tweet.length < 30) {
        warnings.push(`Tweet ${i + 1} quite short (${tweet.length} chars)`);
      }
    });
    
    return warnings;
  }

  private determineStructureType(count: number): 'single' | 'thread' | 'mini_thread' {
    if (count === 1) return 'single';
    if (count <= 3) return 'mini_thread';
    return 'thread';
  }

  private getEmptyResult(): ThreadQualityResult {
    return {
      enhancedTweets: [],
      qualityScore: 0,
      improvements: [],
      warnings: ['No tweets provided'],
      metadata: {
        originalCount: 0,
        finalCount: 0,
        avgLength: 0,
        structureType: 'single'
      }
    };
  }
}
