/**
 * Thread Composer v2 - Narrative + utility focused thread generation
 * Creates coachy, evidence-aware threads with specific structure
 */

interface ThreadTemplate {
  hook: string;
  context: string;
  steps: string[];
  proof: string;
  pitfall: string;
  cta: string;
}

interface ThreadOptions {
  topic: string;
  targetLength: number;
  avoidMedicalClaims: boolean;
}

export class ThreadComposer {
  private readonly maxTweetLength = 260;
  private readonly recentThreads: string[] = [];
  private readonly maxRecentThreads = 10;

  /**
   * Generate a narrative-driven thread with practical value
   */
  async composeThread(options: ThreadOptions): Promise<string[]> {
    const template = await this.buildThreadTemplate(options);
    const tweets = this.formatThreadTweets(template);
    
    // Check originality against recent threads
    if (this.isOriginal(tweets.join(' '))) {
      this.storeRecentThread(tweets.join(' '));
      return tweets;
    }
    
    // Retry once with variation
    const alternateTemplate = await this.buildThreadTemplate({ 
      ...options, 
      topic: `alternative approach to ${options.topic}` 
    });
    const alternateTweets = this.formatThreadTweets(alternateTemplate);
    
    this.storeRecentThread(alternateTweets.join(' '));
    return alternateTweets;
  }

  /**
   * Build structured thread template
   */
  private async buildThreadTemplate(options: ThreadOptions): Promise<ThreadTemplate> {
    const hooks = this.generateHookVariations(options.topic);
    const contextFrames = this.generateContextFrames(options.topic);
    const ctaVariations = this.generateCTAVariations(options.topic);

    return {
      hook: this.selectRandom(hooks),
      context: this.selectRandom(contextFrames),
      steps: await this.generateActionableSteps(options.topic),
      proof: this.generateProofStatement(options.topic),
      pitfall: this.generatePitfallStatement(options.topic),
      cta: this.selectRandom(ctaVariations)
    };
  }

  /**
   * Generate counter-intuitive or specific hooks
   */
  private generateHookVariations(topic: string): string[] {
    const patterns = [
      `I fixed my [problem] by changing one [timeframe] habit.`,
      `The [number] mistake everyone makes with [topic]:`,
      `Why [conventional wisdom] about [topic] is backwards:`,
      `[Number] things I wish I knew about [topic] 5 years ago:`,
      `The [surprising thing] that transformed my [outcome]:`
    ];

    return patterns.map(pattern => 
      this.customizePattern(pattern, topic)
    ).slice(0, 3);
  }

  /**
   * Generate outcome-focused context statements
   */
  private generateContextFrames(topic: string): string[] {
    return [
      `This matters because your energy and focus depend on getting this right.`,
      `The difference between feeling drained vs energized often comes down to this.`,
      `Small changes here compound into massive improvements over time.`,
      `Most people overlook this, but it's the foundation of sustainable energy.`
    ];
  }

  /**
   * Generate 3-4 actionable steps with "how to do it today" bullets
   */
  private async generateActionableSteps(topic: string): Promise<string[]> {
    // This would integrate with your OpenAI client for dynamic generation
    // For now, providing template structure:
    
    const stepTemplates = [
      `Step 1: [Specific action] - do this [when/how] to [immediate benefit].`,
      `Step 2: [Measurement/tracking] - track [specific metric] for [timeframe].`,
      `Step 3: [Optimization] - adjust [specific variable] based on [signal/feedback].`,
      `Step 4: [Consistency habit] - link this to [existing habit] for sustainability.`
    ];

    return stepTemplates.map(template => 
      this.customizePattern(template, topic)
    ).slice(0, 4);
  }

  /**
   * Generate study reference or mini-result
   */
  private generateProofStatement(topic: string): string {
    const proofPatterns = [
      `Research from [Institution] shows [specific finding] in [timeframe].`,
      `A [duration] study found [percentage] improvement in [outcome metric].`,
      `Clinical data suggests [mechanism] leads to [measurable benefit].`,
      `Personal result: [specific improvement] in [timeframe] using this approach.`
    ];

    return this.customizePattern(this.selectRandom(proofPatterns), topic);
  }

  /**
   * Generate common mistake warning
   */
  private generatePitfallStatement(topic: string): string {
    const pitfallPatterns = [
      `Common mistake: [specific wrong approach] - this actually [negative outcome].`,
      `Avoid [specific behavior] because it [mechanism of harm].`,
      `Don't [common action] until you've [prerequisite step].`,
      `The biggest trap: [specific mistake] that sabotages [desired outcome].`
    ];

    return this.customizePattern(this.selectRandom(pitfallPatterns), topic);
  }

  /**
   * Generate specific CTAs that invite replies
   */
  private generateCTAVariations(topic: string): string[] {
    return [
      `What's your biggest challenge with [topic aspect]?`,
      `Want a 7-day protocol for this?`,
      `Which step are you going to try first?`,
      `What questions do you have about [specific step]?`,
      `Have you noticed [specific pattern] in your experience?`
    ].map(cta => this.customizePattern(cta, topic));
  }

  /**
   * Format template into tweet-sized chunks
   */
  private formatThreadTweets(template: ThreadTemplate): string[] {
    const tweets: string[] = [];
    
    // Tweet 1: Hook
    tweets.push(this.truncateToLimit(template.hook));
    
    // Tweet 2: Context
    tweets.push(this.truncateToLimit(template.context));
    
    // Tweets 3-6: Steps
    template.steps.forEach(step => {
      tweets.push(this.truncateToLimit(step));
    });
    
    // Tweet 7: Proof
    tweets.push(this.truncateToLimit(template.proof));
    
    // Tweet 8: Pitfall
    tweets.push(this.truncateToLimit(template.pitfall));
    
    // Tweet 9: CTA
    tweets.push(this.truncateToLimit(template.cta));
    
    return tweets.filter(tweet => tweet.length > 0);
  }

  /**
   * Check originality against recent threads using simple n-gram overlap
   */
  private isOriginal(content: string): boolean {
    if (this.recentThreads.length === 0) return true;
    
    const newNgrams = this.extractNgrams(content, 3);
    
    for (const recentThread of this.recentThreads) {
      const recentNgrams = this.extractNgrams(recentThread, 3);
      const overlap = this.calculateOverlap(newNgrams, recentNgrams);
      
      if (overlap > 0.3) { // 30% overlap threshold
        return false;
      }
    }
    
    return true;
  }

  /**
   * Extract n-grams from text for similarity comparison
   */
  private extractNgrams(text: string, n: number): Set<string> {
    const words = text.toLowerCase().split(/\s+/);
    const ngrams = new Set<string>();
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  /**
   * Calculate overlap between two n-gram sets
   */
  private calculateOverlap(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  /**
   * Store recent thread for originality checking
   */
  private storeRecentThread(content: string): void {
    this.recentThreads.push(content);
    if (this.recentThreads.length > this.maxRecentThreads) {
      this.recentThreads.shift();
    }
  }

  /**
   * Customize pattern with topic-specific content
   */
  private customizePattern(pattern: string, topic: string): string {
    // Simple placeholder replacement - in production this would use LLM
    return pattern
      .replace(/\[topic\]/g, topic)
      .replace(/\[timeframe\]/g, 'morning')
      .replace(/\[number\]/g, '3')
      .replace(/\[outcome\]/g, 'energy')
      .replace(/\[problem\]/g, '2pm crash');
  }

  /**
   * Truncate tweet to character limit while preserving readability
   */
  private truncateToLimit(text: string): string {
    if (text.length <= this.maxTweetLength) {
      return text;
    }
    
    // Try to truncate at a sentence boundary
    const sentences = text.split(/[.!?]+/);
    let result = '';
    
    for (const sentence of sentences) {
      const candidate = result + sentence + '.';
      if (candidate.length <= this.maxTweetLength) {
        result = candidate;
      } else {
        break;
      }
    }
    
    // If no good sentence break, truncate with ellipsis
    if (result.length === 0) {
      result = text.substring(0, this.maxTweetLength - 3) + '...';
    }
    
    return result.trim();
  }

  /**
   * Select random item from array
   */
  private selectRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }
}
