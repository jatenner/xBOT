/**
 * Reply Relevance Classifier
 * Filters off-topic replies and prioritizes high-signal responses
 * Uses keyword matching, context analysis, and engagement scoring
 */

interface ReplyCandidate {
  postId: string;
  author: string;
  handle: string;
  content: string;
  followerCount?: number;
  isVerified?: boolean;
  engagement?: {
    likes: number;
    replies: number;
    retweets: number;
  };
  timestamp: string;
}

interface RelevanceScore {
  overall: number; // 0-100
  topical: number; // How well it relates to our health focus
  engagement: number; // Likelihood to generate meaningful discussion  
  authority: number; // Author credibility and reach
  safety: number; // Safe to engage with (no trolls/spam)
  reasoning: string[];
  recommended: boolean;
}

interface RelevanceFilters {
  minTopicalScore: number;
  minEngagementScore: number;
  minSafetyScore: number;
  blockList: string[]; // Blocked keywords/phrases
  allowList: string[]; // Always-allowed topics
  requireHealthRelevance: boolean;
}

export class ReplyRelevanceClassifier {
  private filters: RelevanceFilters;
  
  // Health-related keywords and topics
  private healthKeywords = [
    'sleep', 'energy', 'nutrition', 'exercise', 'wellness', 'health', 'fitness',
    'diet', 'meditation', 'stress', 'mental health', 'anxiety', 'depression',
    'vitamin', 'supplement', 'protein', 'carbs', 'fat', 'calories', 'metabolism',
    'workout', 'running', 'strength', 'cardio', 'yoga', 'mindfulness',
    'recovery', 'rest', 'hydration', 'immune', 'inflammation', 'gut health',
    'circadian', 'melatonin', 'cortisol', 'dopamine', 'serotonin',
    'habit', 'routine', 'morning', 'evening', 'bedtime', 'wake up'
  ];

  private relevantPhrases = [
    'how to', 'what helps', 'any tips', 'experience with', 'thoughts on',
    'recommend', 'suggestion', 'advice', 'struggling with', 'problem with',
    'best way', 'most effective', 'does this work', 'is this true',
    'what about', 'have you tried', 'anyone else', 'similar experience'
  ];

  private redFlags = [
    // Politics & controversial topics
    'trump', 'biden', 'republican', 'democrat', 'liberal', 'conservative',
    'vaccine mandate', 'covid conspiracy', 'political', 'election',
    
    // Spam indicators
    'buy now', 'limited time', 'click here', 'free money', 'get rich',
    'miracle cure', 'doctors hate', 'secret method', 'lose weight fast',
    
    // Toxic behavior
    'you\'re wrong', 'stupid', 'idiot', 'scam', 'fake', 'lies',
    'misinformation', 'pseudoscience', 'bullshit', 'shut up',
    
    // Off-topic
    'crypto', 'bitcoin', 'nft', 'stock market', 'investment',
    'real estate', 'business opportunity', 'mlm', 'affiliate'
  ];

  constructor() {
    this.filters = {
      minTopicalScore: parseInt(process.env.REPLY_MIN_TOPICAL_SCORE || '60', 10),
      minEngagementScore: parseInt(process.env.REPLY_MIN_ENGAGEMENT_SCORE || '40', 10),
      minSafetyScore: parseInt(process.env.REPLY_MIN_SAFETY_SCORE || '70', 10),
      blockList: (process.env.REPLY_BLOCKLIST || '').split(',').filter(Boolean),
      allowList: (process.env.REPLY_ALLOWLIST || '').split(',').filter(Boolean),
      requireHealthRelevance: process.env.REPLY_REQUIRE_HEALTH_RELEVANCE !== 'false'
    };
  }

  /**
   * Classify a single reply candidate
   */
  async classifyReply(candidate: ReplyCandidate): Promise<RelevanceScore> {
    const content = candidate.content.toLowerCase();
    const reasoning: string[] = [];

    // Calculate individual scores
    const topical = this.calculateTopicalScore(content, reasoning);
    const engagement = this.calculateEngagementScore(candidate, reasoning);
    const authority = this.calculateAuthorityScore(candidate, reasoning);
    const safety = this.calculateSafetyScore(content, candidate, reasoning);

    // Weighted overall score
    const overall = Math.round(
      topical * 0.4 +
      engagement * 0.25 +
      authority * 0.2 + 
      safety * 0.15
    );

    const recommended = this.isRecommended(topical, engagement, authority, safety);

    return {
      overall,
      topical,
      engagement,
      authority,
      safety,
      reasoning,
      recommended
    };
  }

  /**
   * Calculate how topically relevant the content is
   */
  private calculateTopicalScore(content: string, reasoning: string[]): number {
    let score = 0;

    // Check for health keywords
    const healthMatches = this.healthKeywords.filter(keyword => 
      content.includes(keyword)
    );
    
    if (healthMatches.length > 0) {
      score += Math.min(40, healthMatches.length * 8);
      reasoning.push(`Health keywords: ${healthMatches.slice(0, 3).join(', ')}`);
    }

    // Check for relevant conversation phrases
    const phraseMatches = this.relevantPhrases.filter(phrase =>
      content.includes(phrase)
    );
    
    if (phraseMatches.length > 0) {
      score += Math.min(30, phraseMatches.length * 10);
      reasoning.push('Contains question/discussion phrases');
    }

    // Boost for specific health topics
    if (content.includes('sleep') && (content.includes('better') || content.includes('improve'))) {
      score += 15;
      reasoning.push('Sleep improvement topic');
    }

    if (content.includes('energy') && (content.includes('low') || content.includes('tired'))) {
      score += 15;
      reasoning.push('Energy/fatigue topic');
    }

    // Check allow list
    const allowMatches = this.filters.allowList.filter(item =>
      content.includes(item.toLowerCase())
    );
    
    if (allowMatches.length > 0) {
      score += 20;
      reasoning.push('Allowlisted topic');
    }

    return Math.min(100, score);
  }

  /**
   * Calculate engagement potential score
   */
  private calculateEngagementScore(candidate: ReplyCandidate, reasoning: string[]): number {
    let score = 50; // Base score
    const content = candidate.content.toLowerCase();

    // Question-based posts tend to generate replies
    if (content.includes('?')) {
      score += 15;
      reasoning.push('Contains question');
    }

    // Personal experience sharing
    if (content.includes('i ') && (content.includes('tried') || content.includes('experienced'))) {
      score += 10;
      reasoning.push('Shares personal experience');
    }

    // Asking for help/advice
    if (content.includes('help') || content.includes('advice') || content.includes('tips')) {
      score += 15;
      reasoning.push('Seeking help/advice');
    }

    // Length consideration (not too short, not too long)
    const wordCount = content.split(' ').length;
    if (wordCount >= 10 && wordCount <= 50) {
      score += 10;
      reasoning.push('Good length for discussion');
    } else if (wordCount < 5) {
      score -= 20;
      reasoning.push('Too short for meaningful reply');
    }

    // Existing engagement
    if (candidate.engagement) {
      const totalEng = candidate.engagement.likes + candidate.engagement.replies + candidate.engagement.retweets;
      if (totalEng > 10) {
        score += Math.min(20, totalEng / 2);
        reasoning.push(`Already has ${totalEng} engagements`);
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate author authority/credibility score
   */
  private calculateAuthorityScore(candidate: ReplyCandidate, reasoning: string[]): number {
    let score = 30; // Base score

    // Verified account bonus
    if (candidate.isVerified) {
      score += 25;
      reasoning.push('Verified account');
    }

    // Follower count consideration
    if (candidate.followerCount) {
      if (candidate.followerCount > 10000) {
        score += 20;
        reasoning.push('High follower count');
      } else if (candidate.followerCount > 1000) {
        score += 10;
        reasoning.push('Moderate follower count');
      } else if (candidate.followerCount < 50) {
        score -= 15;
        reasoning.push('Very low follower count');
      }
    }

    // Handle patterns that suggest authority
    const handle = candidate.handle.toLowerCase();
    if (handle.includes('dr') || handle.includes('md') || handle.includes('phd')) {
      score += 20;
      reasoning.push('Medical/academic credentials in handle');
    }

    if (handle.includes('coach') || handle.includes('trainer') || handle.includes('nutritionist')) {
      score += 15;
      reasoning.push('Health professional credentials');
    }

    return Math.min(100, score);
  }

  /**
   * Calculate safety score (avoid trolls, spam, toxic content)
   */
  private calculateSafetyScore(content: string, candidate: ReplyCandidate, reasoning: string[]): number {
    let score = 80; // Start high, deduct for red flags

    // Check for red flag content
    const redFlagMatches = this.redFlags.filter(flag => content.includes(flag));
    if (redFlagMatches.length > 0) {
      score -= redFlagMatches.length * 20;
      reasoning.push(`Red flags: ${redFlagMatches.slice(0, 2).join(', ')}`);
    }

    // Check block list
    const blockMatches = this.filters.blockList.filter(item => 
      content.includes(item.toLowerCase())
    );
    if (blockMatches.length > 0) {
      score -= 40;
      reasoning.push('Contains blocked terms');
    }

    // Excessive caps or exclamation marks
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.3) {
      score -= 15;
      reasoning.push('Excessive caps (shouting)');
    }

    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      score -= 10;
      reasoning.push('Excessive exclamation marks');
    }

    // Very new account with aggressive content
    if (candidate.followerCount && candidate.followerCount < 10) {
      if (content.includes('wrong') || content.includes('stupid') || content.includes('fake')) {
        score -= 25;
        reasoning.push('New account with aggressive content');
      }
    }

    return Math.max(0, score);
  }

  /**
   * Determine if reply meets recommendation thresholds
   */
  private isRecommended(topical: number, engagement: number, authority: number, safety: number): boolean {
    return topical >= this.filters.minTopicalScore &&
           engagement >= this.filters.minEngagementScore &&
           safety >= this.filters.minSafetyScore;
  }

  /**
   * Filter and rank a batch of reply candidates
   */
  async filterAndRankReplies(
    candidates: ReplyCandidate[], 
    limit: number = 10
  ): Promise<Array<ReplyCandidate & { relevanceScore: RelevanceScore }>> {
    const results = [];

    for (const candidate of candidates) {
      const score = await this.classifyReply(candidate);
      
      if (score.recommended) {
        results.push({
          ...candidate,
          relevanceScore: score
        });
      }
    }

    // Sort by overall score, then by engagement potential
    results.sort((a, b) => {
      if (a.relevanceScore.overall !== b.relevanceScore.overall) {
        return b.relevanceScore.overall - a.relevanceScore.overall;
      }
      return b.relevanceScore.engagement - a.relevanceScore.engagement;
    });

    return results.slice(0, limit);
  }

  /**
   * Get classification statistics
   */
  getClassificationStats(scores: RelevanceScore[]): {
    totalClassified: number;
    recommended: number;
    recommendationRate: number;
    averageScores: {
      overall: number;
      topical: number;
      engagement: number;
      authority: number;
      safety: number;
    };
    commonReasons: string[];
  } {
    const recommended = scores.filter(s => s.recommended);
    
    const avgScores = scores.reduce((acc, score) => ({
      overall: acc.overall + score.overall,
      topical: acc.topical + score.topical,
      engagement: acc.engagement + score.engagement,
      authority: acc.authority + score.authority,
      safety: acc.safety + score.safety
    }), { overall: 0, topical: 0, engagement: 0, authority: 0, safety: 0 });

    Object.keys(avgScores).forEach(key => {
      avgScores[key as keyof typeof avgScores] /= scores.length;
    });

    // Extract common reasoning patterns
    const allReasons = scores.flatMap(s => s.reasoning);
    const reasonCounts = allReasons.reduce((acc: Record<string, number>, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    const commonReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason]) => reason);

    return {
      totalClassified: scores.length,
      recommended: recommended.length,
      recommendationRate: recommended.length / scores.length,
      averageScores: avgScores,
      commonReasons
    };
  }

  /**
   * Update filters/configuration
   */
  updateFilters(updates: Partial<RelevanceFilters>) {
    this.filters = { ...this.filters, ...updates };
  }

  /**
   * Add to block list
   */
  addToBlockList(terms: string[]) {
    this.filters.blockList.push(...terms);
  }

  /**
   * Add to allow list  
   */
  addToAllowList(terms: string[]) {
    this.filters.allowList.push(...terms);
  }
}

export const replyClassifier = new ReplyRelevanceClassifier();
