/**
 * Reply Engine v2 - Context-aware and tailored replies
 * Processes target tweet and crafts contextual responses
 */

export interface TweetAnalysis {
  content: string;
  author: string;
  postType: 'question' | 'claim' | 'story' | 'data' | 'hot_take' | 'misconception';
  intent: 'seeking_help' | 'sharing_info' | 'debating' | 'celebrating' | 'complaining';
  healthRelevance: number; // 0-1 score
  keyTopics: string[];
  tonality: 'neutral' | 'positive' | 'negative' | 'confused' | 'confident';
}

export interface ReplyCandidate {
  text: string;
  style: 'short_nudge' | 'helpful_pointer' | 'mini_framework' | 'ask_then_answer';
  contextualityScore: number; // 0-1, how well it references the original
  confidence: number; // 0-1, how confident we are in this reply
}

export interface ReplyResult {
  selectedReply: string;
  alternatives: string[];
  analysis: TweetAnalysis;
  reasoning: string;
}

export class ReplyEngine {
  private readonly maxLength = 220; // Leave room for handles/mentions
  private readonly healthTopics = [
    'sleep', 'nutrition', 'exercise', 'stress', 'hydration', 'habits', 
    'metabolism', 'recovery', 'focus', 'energy', 'inflammation'
  ];

  private readonly replyTemplates = {
    short_nudge: [
      "This resonates. {specific_detail} especially.",
      "Great point about {specific_detail}. Also worth considering {add_on}.",
      "Building on {specific_detail} - have you tried {suggestion}?",
      "{specific_detail} is key. Small addition: {micro_tip}.",
    ],
    helpful_pointer: [
      "Re: {specific_detail} - research shows {insight}. Might help with {their_goal}.",
      "Good observation on {specific_detail}. One thing that helps: {actionable_tip}.",
      "Your point about {specific_detail} reminds me of {framework}. Applies here because {reason}.",
    ],
    mini_framework: [
      "Love this. For {their_topic}, I use: 1) {step1} 2) {step2} 3) {step3}. Thoughts?",
      "Building on {specific_detail}: {principle} → {method} → {outcome}. Has worked for {context}.",
    ],
    ask_then_answer: [
      "Quick question on {specific_detail}: {question}? Reason I ask: {insight}.",
      "Curious about {specific_detail} - are you tracking {metric}? Game-changer if not.",
    ]
  };

  /**
   * Generate contextual reply to a tweet
   */
  async generateReply(targetTweet: string, authorInfo?: { handle: string; type?: string }): Promise<ReplyResult> {
    // Step 1: Analyze the target tweet
    const analysis = this.analyzeTweet(targetTweet, authorInfo?.handle || 'user');
    
    // Step 2: Check health relevance threshold
    if (analysis.healthRelevance < 0.4) {
      throw new Error('Tweet not health-relevant enough for reply');
    }
    
    // Step 3: Generate multiple reply candidates
    const candidates = await this.generateCandidates(analysis);
    
    // Step 4: Select best candidate based on contextuality score
    const selectedCandidate = this.selectBestCandidate(candidates);
    
    // Step 5: Apply guardrails and final polish
    const finalReply = this.applyGuardrails(selectedCandidate.text, analysis);
    
    return {
      selectedReply: finalReply,
      alternatives: candidates.filter(c => c !== selectedCandidate).map(c => c.text),
      analysis,
      reasoning: `Selected ${selectedCandidate.style} style (contextuality: ${Math.round(selectedCandidate.contextualityScore * 100)}%)`
    };
  }

  /**
   * Analyze target tweet for context and intent
   */
  private analyzeTweet(content: string, author: string): TweetAnalysis {
    const lowerContent = content.toLowerCase();
    
    // Detect post type
    let postType: TweetAnalysis['postType'] = 'claim';
    if (content.includes('?')) postType = 'question';
    else if (/I (tried|did|experienced|found)/i.test(content)) postType = 'story';
    else if (/\d+%|\d+ (people|studies|research)/i.test(content)) postType = 'data';
    else if (/wrong|myth|fake|scam/i.test(content)) postType = 'hot_take';
    else if (/(confused|help|how)/i.test(content)) postType = 'misconception';
    
    // Detect intent
    let intent: TweetAnalysis['intent'] = 'sharing_info';
    if (/(how|help|advice|tips)/i.test(content)) intent = 'seeking_help';
    else if (/(wrong|disagree|false)/i.test(content)) intent = 'debating';
    else if (/(amazing|great|love|worked)/i.test(content)) intent = 'celebrating';
    else if (/(struggling|tired|failed|can't)/i.test(content)) intent = 'complaining';
    
    // Calculate health relevance
    const healthRelevance = this.calculateHealthRelevance(content);
    
    // Extract key topics
    const keyTopics = this.extractKeyTopics(content);
    
    // Detect tonality
    let tonality: TweetAnalysis['tonality'] = 'neutral';
    if (/(love|great|amazing|excited)/i.test(content)) tonality = 'positive';
    else if (/(hate|terrible|awful|frustrated)/i.test(content)) tonality = 'negative';
    else if (/(confused|unsure|maybe|think)/i.test(content)) tonality = 'confused';
    else if (/(definitely|absolutely|proven|fact)/i.test(content)) tonality = 'confident';
    
    return {
      content,
      author,
      postType,
      intent,
      healthRelevance,
      keyTopics,
      tonality
    };
  }

  /**
   * Calculate how health-relevant the tweet is (0-1)
   */
  private calculateHealthRelevance(content: string): number {
    const lowerContent = content.toLowerCase();
    let score = 0;
    
    // Direct health topic mentions
    this.healthTopics.forEach(topic => {
      if (lowerContent.includes(topic)) {
        score += 0.2;
      }
    });
    
    // Health-related patterns
    const healthPatterns = [
      /\b(health|wellness|fitness|diet|weight|energy|tired|sleep|stress)\b/gi,
      /\b(exercise|workout|gym|running|walking)\b/gi,
      /\b(food|eating|meal|breakfast|lunch|dinner)\b/gi,
      /\b(supplement|vitamin|protein|water|hydration)\b/gi,
      /\b(mental health|anxiety|depression|mood)\b/gi
    ];
    
    healthPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        score += matches.length * 0.1;
      }
    });
    
    return Math.min(1, score);
  }

  /**
   * Extract key topics from tweet content
   */
  private extractKeyTopics(content: string): string[] {
    const topics: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Find mentioned health topics
    this.healthTopics.forEach(topic => {
      if (lowerContent.includes(topic)) {
        topics.push(topic);
      }
    });
    
    // Extract other significant words (nouns, action words)
    const significantWords = content.match(/\b[A-Z][a-z]+\b/g) || [];
    topics.push(...significantWords.slice(0, 3)); // Top 3 capitalized words
    
    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Generate multiple reply candidates
   */
  private async generateCandidates(analysis: TweetAnalysis): Promise<ReplyCandidate[]> {
    const candidates: ReplyCandidate[] = [];
    
    // Extract a specific detail to reference
    const specificDetail = this.extractSpecificDetail(analysis.content);
    
    // Generate candidates using different styles
    const styles: ReplyCandidate['style'][] = ['short_nudge', 'helpful_pointer'];
    
    if (analysis.intent === 'seeking_help') {
      styles.push('mini_framework', 'ask_then_answer');
    }
    
    for (const style of styles) {
      const template = this.selectTemplate(style, analysis);
      const replyText = this.fillTemplate(template, analysis, specificDetail);
      
      if (replyText && replyText.length <= this.maxLength) {
        candidates.push({
          text: replyText,
          style,
          contextualityScore: this.calculateContextuality(replyText, analysis.content),
          confidence: this.calculateConfidence(style, analysis)
        });
      }
    }
    
    return candidates;
  }

  /**
   * Extract a specific detail to reference in reply
   */
  private extractSpecificDetail(content: string): string {
    // Extract first meaningful phrase or key claim
    const sentences = content.split(/[.!?]+/);
    const firstSentence = sentences[0] || content;
    
    // Try to find a specific claim or detail
    const patterns = [
      /I (tried|found|discovered|learned) (.{10,40})/i,
      /the (.{10,30}) (is|was|helps|works)/i,
      /(.{10,30}) (really|actually|definitely) (helps|works|matters)/i
    ];
    
    for (const pattern of patterns) {
      const match = firstSentence.match(pattern);
      if (match) {
        return match[2] || match[1];
      }
    }
    
    // Fallback: first 30 characters
    return firstSentence.substring(0, 30) + (firstSentence.length > 30 ? '...' : '');
  }

  /**
   * Select appropriate template for style and context
   */
  private selectTemplate(style: ReplyCandidate['style'], analysis: TweetAnalysis): string {
    const templates = this.replyTemplates[style];
    
    // Smart template selection based on analysis
    if (analysis.intent === 'seeking_help' && style === 'helpful_pointer') {
      return templates[1]; // More actionable template
    }
    
    // Default: random selection
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Fill template with context-specific content
   */
  private fillTemplate(template: string, analysis: TweetAnalysis, specificDetail: string): string {
    let filled = template;
    
    // Replace placeholders
    filled = filled.replace(/{specific_detail}/g, specificDetail);
    filled = filled.replace(/{their_topic}/g, analysis.keyTopics[0] || 'this');
    filled = filled.replace(/{their_goal}/g, this.inferGoal(analysis));
    
    // Simple placeholder replacements (in real implementation, would use AI)
    filled = filled.replace(/{add_on}/g, 'timing matters too');
    filled = filled.replace(/{suggestion}/g, 'tracking it?');
    filled = filled.replace(/{micro_tip}/g, 'start small');
    filled = filled.replace(/{insight}/g, 'consistency beats intensity');
    filled = filled.replace(/{actionable_tip}/g, 'track for 3 days first');
    filled = filled.replace(/{framework}/g, 'the 2-minute rule');
    filled = filled.replace(/{reason}/g, 'it builds momentum');
    
    return filled.length <= this.maxLength ? filled : null;
  }

  /**
   * Infer user's goal from their tweet
   */
  private inferGoal(analysis: TweetAnalysis): string {
    const content = analysis.content.toLowerCase();
    
    if (content.includes('sleep')) return 'better sleep';
    if (content.includes('energy')) return 'more energy';
    if (content.includes('weight')) return 'healthy weight';
    if (content.includes('stress')) return 'stress management';
    if (content.includes('focus')) return 'better focus';
    
    return 'your health goals';
  }

  /**
   * Calculate contextuality score (how well reply references original)
   */
  private calculateContextuality(reply: string, originalTweet: string): number {
    const replyWords = new Set(reply.toLowerCase().split(/\s+/));
    const tweetWords = new Set(originalTweet.toLowerCase().split(/\s+/));
    
    // Remove common words
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that']);
    const meaningfulReplyWords = new Set([...replyWords].filter(word => !commonWords.has(word) && word.length > 2));
    const meaningfulTweetWords = new Set([...tweetWords].filter(word => !commonWords.has(word) && word.length > 2));
    
    if (meaningfulTweetWords.size === 0) return 0;
    
    const intersection = new Set([...meaningfulReplyWords].filter(word => meaningfulTweetWords.has(word)));
    return intersection.size / meaningfulTweetWords.size;
  }

  /**
   * Calculate confidence score for style choice
   */
  private calculateConfidence(style: ReplyCandidate['style'], analysis: TweetAnalysis): number {
    let confidence = 0.5; // Base confidence
    
    // Adjust based on intent matching
    if (analysis.intent === 'seeking_help' && style === 'helpful_pointer') confidence += 0.3;
    if (analysis.intent === 'sharing_info' && style === 'short_nudge') confidence += 0.2;
    if (analysis.postType === 'question' && style === 'ask_then_answer') confidence += 0.3;
    
    // Adjust based on health relevance
    confidence += analysis.healthRelevance * 0.2;
    
    return Math.min(1, confidence);
  }

  /**
   * Select best candidate based on combined scoring
   */
  private selectBestCandidate(candidates: ReplyCandidate[]): ReplyCandidate {
    if (candidates.length === 0) {
      throw new Error('No valid reply candidates generated');
    }
    
    // Score candidates: contextuality (60%) + confidence (40%)
    const scored = candidates.map(candidate => ({
      ...candidate,
      finalScore: candidate.contextualityScore * 0.6 + candidate.confidence * 0.4
    }));
    
    // Return highest scoring candidate
    return scored.reduce((best, current) => 
      current.finalScore > best.finalScore ? current : best
    );
  }

  /**
   * Apply guardrails and final polish
   */
  private applyGuardrails(replyText: string, analysis: TweetAnalysis): string {
    let polished = replyText;
    
    // Ensure no medical advice
    const medicalTerms = ['cure', 'treat', 'diagnose', 'prescribe', 'medical advice'];
    medicalTerms.forEach(term => {
      if (polished.toLowerCase().includes(term)) {
        polished = polished.replace(new RegExp(term, 'gi'), 'help with');
      }
    });
    
    // Ensure curious, non-prescriptive tone
    polished = polished.replace(/you should/gi, 'you might try');
    polished = polished.replace(/you must/gi, 'consider');
    polished = polished.replace(/always/gi, 'often');
    polished = polished.replace(/never/gi, 'rarely');
    
    // Ensure character limit
    if (polished.length > this.maxLength) {
      polished = polished.substring(0, this.maxLength - 3) + '...';
    }
    
    return polished;
  }
}