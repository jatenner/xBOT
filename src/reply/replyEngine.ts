/**
 * Reply Engine v2 - Contextual and tailored reply generation
 * Reads target tweets and crafts specific, value-adding responses
 */

interface TweetContext {
  text: string;
  authorHandle: string;
  authorBio?: string;
  followerCount?: number;
  topicCategory?: string;
}

interface ReplyCandidate {
  text: string;
  contextualityScore: number;
  reasoning: string;
}

interface ReplyAnalysis {
  summary: string;
  intent: 'share' | 'claim' | 'question' | 'brag' | 'vent' | 'joke';
  accountType: 'health' | 'non-health' | 'brand' | 'individual';
  credibilityLevel: 'high' | 'medium' | 'low';
}

export class ReplyEngine {
  private readonly maxReplyLength = 240;
  private readonly replyTemplates = {
    health: {
      acknowledgment: [
        "This aligns with what we see in [mechanism]",
        "Great point about [key_concept]",
        "The [specific_aspect] you mentioned is crucial"
      ],
      insight: [
        "Another angle: [related_mechanism] also affects [outcome]",
        "Building on this: [complementary_insight]",
        "What's interesting is how [connection] ties into this"
      ],
      question: [
        "Have you noticed [specific_pattern] in your experience?",
        "What's your take on [related_aspect]?",
        "Curious about your thoughts on [mechanism_question]?"
      ]
    },
    general: {
      acknowledgment: [
        "This resonates with [relatable_concept]",
        "You're onto something with [key_point]",
        "The [specific_part] really stands out"
      ],
      insight: [
        "Another way to think about it: [simple_reframe]",
        "This reminds me of [analogous_situation]",
        "What helps is [practical_tip]"
      ],
      question: [
        "What's been your experience with [specific_element]?",
        "How do you handle [related_challenge]?",
        "Have you tried [alternative_approach]?"
      ]
    }
  };

  /**
   * Generate contextual reply to a target tweet
   */
  async generateReply(context: TweetContext): Promise<string> {
    const analysis = await this.analyzeTweet(context);
    const candidates = await this.generateReplyCandidates(context, analysis);
    
    // Select best candidate based on contextuality score
    const bestCandidate = candidates.reduce((best, current) => 
      current.contextualityScore > best.contextualityScore ? current : best
    );

    return bestCandidate.text;
  }

  /**
   * Analyze the target tweet to understand intent and context
   */
  private async analyzeTweet(context: TweetContext): Promise<ReplyAnalysis> {
    const text = context.text.toLowerCase();
    
    // Intent detection using keyword patterns
    let intent: ReplyAnalysis['intent'] = 'share';
    if (text.includes('?') || text.startsWith('how') || text.startsWith('what') || text.startsWith('why')) {
      intent = 'question';
    } else if (text.includes('achieved') || text.includes('results') || text.includes('success')) {
      intent = 'brag';
    } else if (text.includes('should') || text.includes('must') || text.includes('proven')) {
      intent = 'claim';
    } else if (text.includes('struggle') || text.includes('difficult') || text.includes('hard')) {
      intent = 'vent';
    } else if (text.includes('😂') || text.includes('lol') || text.includes('funny')) {
      intent = 'joke';
    }

    // Account type detection
    const isHealthAccount = this.isHealthRelated(context.authorBio || context.text);
    const accountType: ReplyAnalysis['accountType'] = isHealthAccount ? 'health' : 
      (context.followerCount && context.followerCount > 10000) ? 'brand' : 'individual';

    // Credibility assessment
    const credibilityLevel: ReplyAnalysis['credibilityLevel'] = 
      (context.followerCount && context.followerCount > 50000) ? 'high' :
      (context.followerCount && context.followerCount > 5000) ? 'medium' : 'low';

    return {
      summary: this.summarizeTweet(context.text),
      intent,
      accountType,
      credibilityLevel
    };
  }

  /**
   * Generate multiple reply candidates
   */
  private async generateReplyCandidates(context: TweetContext, analysis: ReplyAnalysis): Promise<ReplyCandidate[]> {
    const candidates: ReplyCandidate[] = [];
    const templateSet = analysis.accountType === 'health' ? this.replyTemplates.health : this.replyTemplates.general;

    // Generate 2 different approaches
    for (let i = 0; i < 2; i++) {
      const acknowledgment = this.selectRandomTemplate(templateSet.acknowledgment);
      const insight = this.selectRandomTemplate(templateSet.insight);
      const question = this.selectRandomTemplate(templateSet.question);

      const reply = this.buildReply(context, analysis, {
        acknowledgment,
        insight,
        question
      });

      const contextualityScore = this.calculateContextuality(reply, context.text);
      
      candidates.push({
        text: reply,
        contextualityScore,
        reasoning: `Approach ${i + 1}: ${analysis.intent} response to ${analysis.accountType} account`
      });
    }

    return candidates;
  }

  /**
   * Build contextual reply using templates
   */
  private buildReply(
    context: TweetContext, 
    analysis: ReplyAnalysis, 
    templates: { acknowledgment: string; insight: string; question: string }
  ): string {
    const keyNouns = this.extractKeyNouns(context.text);
    const keyVerbs = this.extractKeyVerbs(context.text);
    
    // Customize templates with context
    const acknowledgment = this.customizeTemplate(templates.acknowledgment, context, keyNouns);
    const insight = this.customizeTemplate(templates.insight, context, keyNouns);
    const question = this.customizeTemplate(templates.question, context, keyNouns);

    // Combine based on intent and space constraints
    let reply = '';
    
    if (analysis.intent === 'question') {
      reply = `${acknowledgment} ${insight}`;
    } else if (analysis.intent === 'claim') {
      reply = `${acknowledgment} ${question}`;
    } else {
      reply = `${acknowledgment} ${insight} ${question}`;
    }

    return this.truncateToLimit(reply.trim());
  }

  /**
   * Customize template with specific context from the tweet
   */
  private customizeTemplate(template: string, context: TweetContext, keyNouns: string[]): string {
    const mainNoun = keyNouns[0] || 'approach';
    const secondaryNoun = keyNouns[1] || 'method';
    
    return template
      .replace(/\[key_concept\]/g, mainNoun)
      .replace(/\[specific_aspect\]/g, secondaryNoun)
      .replace(/\[mechanism\]/g, 'the science')
      .replace(/\[outcome\]/g, 'results')
      .replace(/\[related_aspect\]/g, `${mainNoun} optimization`)
      .replace(/\[specific_element\]/g, mainNoun)
      .replace(/\[key_point\]/g, mainNoun);
  }

  /**
   * Extract key nouns from tweet text for contextual mirroring
   */
  private extractKeyNouns(text: string): string[] {
    // Simple noun extraction - in production would use NLP
    const healthNouns = ['sleep', 'energy', 'nutrition', 'exercise', 'stress', 'focus', 'recovery', 'metabolism', 'hormones', 'inflammation'];
    const words = text.toLowerCase().split(/\s+/);
    
    return healthNouns.filter(noun => 
      words.some(word => word.includes(noun))
    ).slice(0, 3);
  }

  /**
   * Extract key verbs for understanding action context
   */
  private extractKeyVerbs(text: string): string[] {
    const actionVerbs = ['improve', 'optimize', 'reduce', 'increase', 'track', 'measure', 'change', 'fix'];
    const words = text.toLowerCase().split(/\s+/);
    
    return actionVerbs.filter(verb => 
      words.some(word => word.includes(verb))
    ).slice(0, 2);
  }

  /**
   * Calculate how contextual the reply is to the original tweet
   */
  private calculateContextuality(reply: string, originalTweet: string): number {
    const replyWords = new Set(reply.toLowerCase().split(/\s+/));
    const tweetWords = new Set(originalTweet.toLowerCase().split(/\s+/));
    
    // Count meaningful word overlaps (exclude common words)
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those']);
    
    const meaningfulReplyWords = new Set([...replyWords].filter(word => !commonWords.has(word) && word.length > 2));
    const meaningfulTweetWords = new Set([...tweetWords].filter(word => !commonWords.has(word) && word.length > 2));
    
    const intersection = new Set([...meaningfulReplyWords].filter(word => meaningfulTweetWords.has(word)));
    
    // Score based on meaningful word overlap
    const overlapScore = intersection.size / Math.max(meaningfulTweetWords.size, 1);
    
    // Bonus for length appropriateness
    const lengthScore = reply.length > 50 && reply.length <= this.maxReplyLength ? 0.2 : 0;
    
    return Math.min(overlapScore + lengthScore, 1.0);
  }

  /**
   * Check if content is health-related
   */
  private isHealthRelated(text: string): boolean {
    const healthKeywords = ['health', 'nutrition', 'fitness', 'wellness', 'sleep', 'energy', 'diet', 'exercise', 'medical', 'doctor', 'research', 'study', 'metabolism', 'hormone', 'supplement'];
    const lowerText = text.toLowerCase();
    return healthKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Summarize tweet to one sentence
   */
  private summarizeTweet(text: string): string {
    // Simple summarization - extract first sentence or key claim
    const sentences = text.split(/[.!?]+/);
    return sentences[0]?.trim() || text.substring(0, 50) + '...';
  }

  /**
   * Select random template from array
   */
  private selectRandomTemplate(templates: string[]): string {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Truncate reply to character limit
   */
  private truncateToLimit(text: string): string {
    if (text.length <= this.maxReplyLength) {
      return text;
    }
    
    // Try to truncate at word boundary
    const words = text.split(' ');
    let result = '';
    
    for (const word of words) {
      const candidate = result + (result ? ' ' : '') + word;
      if (candidate.length <= this.maxReplyLength - 3) {
        result = candidate;
      } else {
        break;
      }
    }
    
    return result + '...';
  }
}
