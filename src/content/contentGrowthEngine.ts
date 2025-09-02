/**
 * CONTENT GROWTH ENGINE
 * Optimizes content specifically for follower acquisition and viral growth
 */

export interface GrowthMetrics {
  followers_before: number;
  followers_after: number;
  engagement_rate: number;
  viral_coefficient: number; // shares per view
  reach_expansion: number; // new audience reached
}

export interface ViralPrediction {
  probability: number; // 0-100
  factors: {
    hook_strength: number;
    controversy_level: number;
    actionability: number;
    shareability: number;
    timing_score: number;
  };
  recommendations: string[];
}

export interface GrowthOptimizedContent {
  content: string;
  viral_prediction: ViralPrediction;
  growth_score: number;
  target_audience: string[];
  distribution_strategy: string;
}

export class ContentGrowthEngine {
  private static instance: ContentGrowthEngine;

  public static getInstance(): ContentGrowthEngine {
    if (!ContentGrowthEngine.instance) {
      ContentGrowthEngine.instance = new ContentGrowthEngine();
    }
    return ContentGrowthEngine.instance;
  }

  /**
   * Optimize content for maximum follower growth
   */
  public async optimizeForGrowth(baseContent: string, topic: string): Promise<GrowthOptimizedContent> {
    console.log('🚀 GROWTH_ENGINE: Optimizing content for follower acquisition...');

    // Analyze viral potential
    const viralPrediction = await this.predictViralPotential(baseContent);
    
    // Optimize content for growth
    const optimizedContent = await this.enhanceForGrowth(baseContent, viralPrediction);
    
    // Calculate growth score
    const growthScore = await this.calculateGrowthScore(optimizedContent, viralPrediction);
    
    // Identify target audience
    const targetAudience = await this.identifyTargetAudience(topic, optimizedContent);
    
    // Recommend distribution strategy
    const distributionStrategy = await this.recommendDistribution(viralPrediction, growthScore);

    return {
      content: optimizedContent,
      viral_prediction: viralPrediction,
      growth_score: growthScore,
      target_audience: targetAudience,
      distribution_strategy: distributionStrategy
    };
  }

  /**
   * Predict viral potential of content
   */
  private async predictViralPotential(content: string): Promise<ViralPrediction> {
    const factors = {
      hook_strength: this.analyzeHookStrength(content),
      controversy_level: this.analyzeControversyLevel(content),
      actionability: this.analyzeActionability(content),
      shareability: this.analyzeShareability(content),
      timing_score: this.analyzeTimingScore()
    };

    const probability = this.calculateViralProbability(factors);
    const recommendations = this.generateViralRecommendations(factors);

    return {
      probability,
      factors,
      recommendations
    };
  }

  private analyzeHookStrength(content: string): number {
    let score = 50; // Base score

    // Strong hooks
    const strongHooks = [
      'I noticed something weird',
      'Anyone else',
      'tried .* for .* days',
      'might be backwards',
      'most people miss',
      'I used to believe',
      'stopped doing',
      'started doing'
    ];

    for (const hook of strongHooks) {
      if (new RegExp(hook, 'i').test(content)) {
        score += 20;
        break;
      }
    }

    // Weak hooks (deduct points)
    const weakHooks = [
      'here\'s why',
      'let me tell you',
      'did you know',
      'fun fact',
      'shocking truth'
    ];

    for (const hook of weakHooks) {
      if (new RegExp(hook, 'i').test(content)) {
        score -= 15;
      }
    }

    // Questions boost engagement
    if (content.includes('?')) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private analyzeControversyLevel(content: string): number {
    let score = 30; // Base score

    // Controversial words/phrases
    const controversialTerms = [
      'wrong', 'backwards', 'myth', 'lie', 'don\'t want you to know',
      'opposite', 'counterintuitive', 'everyone gets .* wrong',
      'industry secret', 'hidden truth', 'actually harmful'
    ];

    for (const term of controversialTerms) {
      if (new RegExp(term, 'i').test(content)) {
        score += 25;
        break;
      }
    }

    // Challenging conventional wisdom
    if (/might be backwards|everyone gets .* wrong|opposite of what/i.test(content)) {
      score += 30;
    }

    return Math.min(100, score);
  }

  private analyzeActionability(content: string): number {
    let score = 40; // Base score

    // Specific actions
    if (/try .* for \d+ days|do this|here's how|step \d/i.test(content)) {
      score += 25;
    }

    // Specific numbers/timeframes
    if (/\d+ (minutes?|hours?|days?|weeks?)/i.test(content)) {
      score += 20;
    }

    // Immediate actions
    if (/tonight|today|right now|immediately/i.test(content)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  private analyzeShareability(content: string): number {
    let score = 45; // Base score

    // Share triggers
    if (/anyone else|share your|tag a friend|try this/i.test(content)) {
      score += 20;
    }

    // Relatable content
    if (/I used to|I thought|we all/i.test(content)) {
      score += 15;
    }

    // Surprising facts
    if (/turns out|actually|surprisingly/i.test(content)) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private analyzeTimingScore(): number {
    const hour = new Date().getHours();
    
    // Peak engagement hours (6-9 AM, 12-2 PM, 5-8 PM)
    if ((hour >= 6 && hour <= 9) || (hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 20)) {
      return 85;
    }
    
    // Good hours
    if ((hour >= 10 && hour <= 11) || (hour >= 15 && hour <= 16) || (hour >= 21 && hour <= 22)) {
      return 70;
    }
    
    // Okay hours
    return 50;
  }

  private calculateViralProbability(factors: ViralPrediction['factors']): number {
    // Weighted average of factors
    const weights = {
      hook_strength: 0.3,
      controversy_level: 0.25,
      actionability: 0.2,
      shareability: 0.15,
      timing_score: 0.1
    };

    let probability = 0;
    for (const [factor, score] of Object.entries(factors)) {
      probability += score * weights[factor as keyof typeof weights];
    }

    return Math.round(probability);
  }

  private generateViralRecommendations(factors: ViralPrediction['factors']): string[] {
    const recommendations: string[] = [];

    if (factors.hook_strength < 70) {
      recommendations.push('Strengthen opening hook with "I noticed something weird" or "Anyone else..." format');
    }

    if (factors.controversy_level < 60) {
      recommendations.push('Add contrarian angle - challenge conventional wisdom or common assumptions');
    }

    if (factors.actionability < 65) {
      recommendations.push('Include specific action with timeframe (e.g., "try this for 7 days")');
    }

    if (factors.shareability < 60) {
      recommendations.push('Add question or "anyone else" to encourage replies and shares');
    }

    if (factors.timing_score < 70) {
      recommendations.push('Consider posting during peak hours: 6-9 AM, 12-2 PM, or 5-8 PM');
    }

    return recommendations;
  }

  /**
   * Enhance content for growth
   */
  private async enhanceForGrowth(content: string, viralPrediction: ViralPrediction): Promise<string> {
    let enhanced = content;

    // Apply top recommendations
    if (viralPrediction.recommendations.length > 0) {
      const topRec = viralPrediction.recommendations[0];
      
      if (topRec.includes('hook')) {
        enhanced = this.enhanceHook(enhanced);
      }
      
      if (topRec.includes('contrarian')) {
        enhanced = this.addControversialAngle(enhanced);
      }
      
      if (topRec.includes('question')) {
        enhanced = this.addEngagementTrigger(enhanced);
      }
    }

    return enhanced;
  }

  private enhanceHook(content: string): string {
    // If content doesn't start with strong hook, add one
    const strongHooks = [
      'I noticed something weird about',
      'Anyone else find it weird that',
      'I used to believe',
      'Most people get this backwards:'
    ];

    if (!this.hasStrongHook(content)) {
      const randomHook = strongHooks[Math.floor(Math.random() * strongHooks.length)];
      return `${randomHook} ${content.toLowerCase()}`;
    }

    return content;
  }

  private hasStrongHook(content: string): boolean {
    const strongPatterns = [
      /^I noticed/i,
      /^Anyone else/i,
      /^I tried/i,
      /^Most people/i,
      /^I used to/i
    ];

    return strongPatterns.some(pattern => pattern.test(content));
  }

  private addControversialAngle(content: string): string {
    const controversialFrames = [
      'might be backwards',
      'actually harmful',
      'opposite of what most people think',
      'counterintuitive but true'
    ];

    if (!/backwards|wrong|myth|opposite/i.test(content)) {
      const frame = controversialFrames[Math.floor(Math.random() * controversialFrames.length)];
      return `${content} This ${frame}.`;
    }

    return content;
  }

  private addEngagementTrigger(content: string): string {
    if (!content.includes('?') && !content.includes('Anyone else')) {
      return `${content} Anyone else experienced this?`;
    }
    return content;
  }

  /**
   * Calculate growth score
   */
  private async calculateGrowthScore(content: string, viralPrediction: ViralPrediction): Promise<number> {
    let score = viralPrediction.probability * 0.6; // Viral potential is 60% of score

    // Additional growth factors
    if (content.includes('I tried') || content.includes('I noticed')) score += 15; // Personal credibility
    if (content.includes('?')) score += 10; // Engagement trigger
    if (/\d+ (days?|weeks?)/.test(content)) score += 10; // Specific timeframes
    if (content.length > 100 && content.length < 250) score += 5; // Optimal length

    return Math.round(Math.min(100, score));
  }

  /**
   * Identify target audience
   */
  private async identifyTargetAudience(topic: string, content: string): Promise<string[]> {
    const audiences = {
      'sleep': ['biohackers', 'productivity enthusiasts', 'health optimizers', 'busy professionals'],
      'nutrition': ['fitness enthusiasts', 'health coaches', 'weight loss seekers', 'wellness community'],
      'productivity': ['entrepreneurs', 'remote workers', 'students', 'career climbers'],
      'exercise': ['fitness beginners', 'gym enthusiasts', 'athletes', 'health transformation'],
      'wellness': ['holistic health seekers', 'stress management', 'mental health advocates', 'life optimizers']
    };

    // Find matching topic
    for (const [key, audience] of Object.entries(audiences)) {
      if (topic.toLowerCase().includes(key) || content.toLowerCase().includes(key)) {
        return audience;
      }
    }

    return ['health enthusiasts', 'life optimizers', 'productivity seekers'];
  }

  /**
   * Recommend distribution strategy
   */
  private async recommendDistribution(viralPrediction: ViralPrediction, growthScore: number): Promise<string> {
    if (growthScore >= 80) {
      return 'Prime time posting + engage with replies + cross-promote on other platforms';
    } else if (growthScore >= 60) {
      return 'Peak hours posting + active reply engagement + strategic hashtag research';
    } else {
      return 'Test timing + gather feedback + iterate based on engagement patterns';
    }
  }

  /**
   * Track growth metrics from posted content
   */
  public async trackGrowthMetrics(contentId: string, beforeMetrics: any, afterMetrics: any): Promise<GrowthMetrics> {
    const followers_before = beforeMetrics.followers_count || 0;
    const followers_after = afterMetrics.followers_count || 0;
    
    const total_engagement = (afterMetrics.likes_count || 0) + (afterMetrics.retweets_count || 0) + (afterMetrics.replies_count || 0);
    const engagement_rate = (afterMetrics.impressions_count || 1) > 0 ? (total_engagement / afterMetrics.impressions_count) * 100 : 0;
    
    const viral_coefficient = (afterMetrics.retweets_count || 0) / Math.max(1, afterMetrics.impressions_count || 1);
    const reach_expansion = Math.max(0, followers_after - followers_before);

    console.log(`📊 GROWTH_METRICS: +${reach_expansion} followers, ${engagement_rate.toFixed(2)}% engagement rate`);

    return {
      followers_before,
      followers_after,
      engagement_rate,
      viral_coefficient,
      reach_expansion
    };
  }
}
