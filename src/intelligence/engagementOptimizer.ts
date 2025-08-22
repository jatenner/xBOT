/**
 * Advanced Engagement Optimization Engine
 * Analyzes why posts fail and creates algorithms to optimize for:
 * - Followers gained
 * - Likes & engagement
 * - Comments & replies  
 * - Reposts & shares
 * - Views & impressions
 */

import { IntelligentLearningEngine } from './intelligentLearningEngine';

export interface EngagementMetrics {
  followers_gained: number;
  likes_count: number;
  replies_count: number;
  retweets_count: number;
  impressions_count: number;
  bookmarks_count: number;
  engagement_rate: number;
  viral_score: number;
}

export interface ContentAnalysis {
  hook_strength: number;
  controversy_level: number;
  emotional_impact: number;
  shareability_score: number;
  call_to_action_strength: number;
  relatability_score: number;
  urgency_level: number;
  social_proof_signals: number;
}

export interface OptimizationInsight {
  problem: string;
  solution: string;
  impact_score: number; // 1-10
  evidence: string[];
  recommended_action: string;
  success_probability: number;
}

export interface ViralPrediction {
  predicted_followers: number;
  predicted_likes: number;
  predicted_shares: number;
  viral_probability: number;
  optimization_suggestions: string[];
  engagement_multipliers: {
    hook_multiplier: number;
    timing_multiplier: number;
    format_multiplier: number;
    topic_multiplier: number;
  };
}

export class EngagementOptimizer {
  private static instance: EngagementOptimizer;
  private learningEngine: IntelligentLearningEngine;
  private benchmarkData: Map<string, EngagementMetrics> = new Map();

  private constructor() {
    this.learningEngine = IntelligentLearningEngine.getInstance();
  }

  public static getInstance(): EngagementOptimizer {
    if (!EngagementOptimizer.instance) {
      EngagementOptimizer.instance = new EngagementOptimizer();
    }
    return EngagementOptimizer.instance;
  }

  /**
   * Analyze why current posts are underperforming
   */
  async analyzeEngagementGaps(): Promise<OptimizationInsight[]> {
    console.log('🔍 ENGAGEMENT_OPTIMIZER: Analyzing why posts are not getting followers/engagement');

    try {
      // Get recent post performance data
      const recentPosts = await this.getRecentPostPerformance();
      
      // If no posts or all posts have zero engagement, provide basic optimization insights
      if (recentPosts.length === 0 || recentPosts.every(p => p.likes_count === 0 && p.retweets_count === 0)) {
        console.log('🚨 ZERO_ENGAGEMENT_DETECTED: Providing fundamental optimization insights');
        return this.getZeroEngagementInsights();
      }
      
      const viralBenchmarks = await this.getViralBenchmarks();
      const insights: OptimizationInsight[] = [];

      // Analyze follower conversion rate
      const followerInsights = await this.analyzeFollowerConversion(recentPosts, viralBenchmarks);
      insights.push(...followerInsights);

      // Analyze engagement patterns
      const engagementInsights = await this.analyzeEngagementPatterns(recentPosts);
      insights.push(...engagementInsights);

      // Analyze content quality issues
      const contentInsights = await this.analyzeContentQuality(recentPosts);
      insights.push(...contentInsights);

      // Analyze timing and frequency issues
      const timingInsights = await this.analyzeTimingOptimization(recentPosts);
      insights.push(...timingInsights);

      // Sort by impact score
      insights.sort((a, b) => b.impact_score - a.impact_score);

      console.log(`✅ ENGAGEMENT_OPTIMIZER: Found ${insights.length} optimization opportunities`);
      return insights.slice(0, 10); // Top 10 most impactful

    } catch (error: any) {
      console.error('❌ ENGAGEMENT_OPTIMIZER: Analysis failed:', error.message);
      return [];
    }
  }

  /**
   * Get fundamental optimization insights when posts have zero engagement
   */
  private getZeroEngagementInsights(): OptimizationInsight[] {
    return [
      {
        problem: "Content hooks are not provocative enough to stop the scroll",
        solution: "Use shocking personal confessions, money stories, or contrarian takes",
        impact_score: 10,
        evidence: ["Zero engagement indicates content is being ignored", "Boring hooks = invisible content"],
        recommended_action: "Start every post with: 'I spent $X learning...', 'Former insider:', or 'Plot twist:'",
        success_probability: 0.8
      },
      {
        problem: "Content is too safe and doesn't create controversy",
        solution: "Challenge sacred health beliefs aggressively and call out industries",
        impact_score: 9,
        evidence: ["No comments means no debate", "Safe content doesn't spread"],
        recommended_action: "Attack popular health advice: 'Every doctor tells you X. They're wrong.'",
        success_probability: 0.7
      },
      {
        problem: "Missing emotional triggers and personal stakes",
        solution: "Add personal pain stories, money lost, and industry insider knowledge",
        impact_score: 9,
        evidence: ["Emotional content gets 3x more engagement", "Personal stories create connection"],
        recommended_action: "Include: failed experiments, wasted money, health disasters, insider secrets",
        success_probability: 0.75
      },
      {
        problem: "Weak call-to-actions that don't drive engagement",
        solution: "Use confrontational CTAs that demand responses",
        impact_score: 8,
        evidence: ["Generic CTAs get ignored", "Confrontational CTAs drive comments"],
        recommended_action: "End with: 'Fight me in the comments', 'Change my mind', 'Tell me I'm wrong'",
        success_probability: 0.7
      },
      {
        problem: "Content formula is too predictable and repetitive",
        solution: "Vary hook types and break established patterns",
        impact_score: 8,
        evidence: ["Algorithm punishes repetitive content", "Audience gets bored with patterns"],
        recommended_action: "Rotate between: money confessions, industry secrets, failure stories, class warfare",
        success_probability: 0.6
      },
      {
        problem: "Missing viral content elements: urgency, exclusivity, social proof",
        solution: "Add time pressure, insider knowledge, and authority destruction",
        impact_score: 7,
        evidence: ["Viral content has specific triggers", "Authority challenges spread faster"],
        recommended_action: "Use: 'Rich people know X, poor people get told Y', 'Industry doesn't want you to know'",
        success_probability: 0.65
      }
    ];
  }

  /**
   * Predict engagement for content before posting
   */
  async predictViralPotential(content: string): Promise<ViralPrediction> {
    console.log('🎯 ENGAGEMENT_OPTIMIZER: Predicting viral potential');

    try {
      // Analyze content characteristics
      const contentAnalysis = this.analyzeContentCharacteristics(content);
      
      // Get similar historical posts
      const similarPosts = await this.findSimilarPosts(content);
      
      // Calculate baseline predictions
      const baseline = this.calculateBaselinePrediction(similarPosts);
      
      // Apply content multipliers
      const multipliers = this.calculateEngagementMultipliers(contentAnalysis);
      
      // Generate final predictions
      const prediction: ViralPrediction = {
        predicted_followers: Math.round(baseline.followers * multipliers.hook_multiplier * multipliers.format_multiplier),
        predicted_likes: Math.round(baseline.likes * multipliers.topic_multiplier * multipliers.timing_multiplier),
        predicted_shares: Math.round(baseline.shares * multipliers.hook_multiplier),
        viral_probability: this.calculateViralProbability(contentAnalysis, multipliers),
        optimization_suggestions: this.generateOptimizationSuggestions(contentAnalysis),
        engagement_multipliers: multipliers
      };

      console.log(`📊 VIRAL_PREDICTION: ${prediction.predicted_followers} followers, ${prediction.predicted_likes} likes (${Math.round(prediction.viral_probability * 100)}% viral chance)`);
      
      return prediction;

    } catch (error: any) {
      console.error('❌ VIRAL_PREDICTION failed:', error.message);
      return this.getDefaultPrediction();
    }
  }

  /**
   * Generate content optimization recommendations
   */
  async optimizeContentForEngagement(content: string): Promise<{
    optimized_content: string;
    changes_made: string[];
    expected_improvement: number;
    optimization_score: number;
  }> {
    console.log('⚡ ENGAGEMENT_OPTIMIZER: Optimizing content for maximum engagement');

    try {
      const analysis = this.analyzeContentCharacteristics(content);
      const insights = await this.analyzeEngagementGaps();
      
      let optimizedContent = content;
      const changesMade: string[] = [];
      let improvementScore = 0;

      console.log(`📊 Found ${insights.length} optimization insights`);

      // Apply high-impact insights
      for (const insight of insights.slice(0, 3)) { // Apply top 3 insights
        if (insight.impact_score >= 7) {
          const { optimized, applied } = this.applyOptimizationInsight(optimizedContent, insight);
          if (applied) {
            optimizedContent = optimized;
            changesMade.push(insight.solution);
            improvementScore += insight.impact_score;
          }
        }
      }

      // Apply hook optimization if still weak
      if (analysis.hook_strength < 7) {
        const { optimized, improvement } = this.optimizeHook(optimizedContent);
        optimizedContent = optimized;
        changesMade.push('Enhanced engagement hook');
        improvementScore += improvement;
      }

      // Apply controversy optimization (if needed for engagement)
      if (analysis.controversy_level < 5 && insights.some(i => i.problem.includes('engagement'))) {
        const { optimized, improvement } = this.addControversialElements(optimizedContent);
        optimizedContent = optimized;
        changesMade.push('Added controversial elements');
        improvementScore += improvement;
      }

      // Apply emotional impact optimization
      if (analysis.emotional_impact < 6) {
        const { optimized, improvement } = this.enhanceEmotionalImpact(optimizedContent);
        optimizedContent = optimized;
        changesMade.push('Increased emotional impact');
        improvementScore += improvement;
      }

      // Apply call-to-action optimization
      if (analysis.call_to_action_strength < 5) {
        const { optimized, improvement } = this.addCallToAction(optimizedContent);
        optimizedContent = optimized;
        changesMade.push('Added engagement call-to-action');
        improvementScore += improvement;
      }

      return {
        optimized_content: optimizedContent,
        changes_made: changesMade,
        expected_improvement: Math.round(improvementScore * 10), // Percentage improvement
        optimization_score: Math.min(100, analysis.hook_strength * 10 + improvementScore)
      };

    } catch (error: any) {
      console.error('❌ CONTENT_OPTIMIZATION failed:', error.message);
      return {
        optimized_content: content,
        changes_made: [],
        expected_improvement: 0,
        optimization_score: 50
      };
    }
  }

  /**
   * Analyze content characteristics for engagement prediction
   */
  private analyzeContentCharacteristics(content: string): ContentAnalysis {
    const analysis: ContentAnalysis = {
      hook_strength: this.calculateHookStrength(content),
      controversy_level: this.calculateControversyLevel(content),
      emotional_impact: this.calculateEmotionalImpact(content),
      shareability_score: this.calculateShareabilityScore(content),
      call_to_action_strength: this.calculateCallToActionStrength(content),
      relatability_score: this.calculateRelatabilityScore(content),
      urgency_level: this.calculateUrgencyLevel(content),
      social_proof_signals: this.calculateSocialProofSignals(content)
    };

    return analysis;
  }

  private calculateHookStrength(content: string): number {
    const hooks = [
      /^(Unpopular opinion:|Hot take:|Controversial:|Plot twist:|Breaking:|THREAD:)/i,
      /^(What if|Imagine if|Here's why|The truth about|Everyone thinks)/i,
      /^(\d+% of|Most people|Nobody talks about|The secret to)/i,
      /\?(.*)(What|How|Why|When|Where)/i, // Question format
      /^(I spent \$\d+|I tracked|I tested|Day \d+ of)/i, // Personal investment stories
    ];

    const urgentWords = ['now', 'today', 'immediately', 'urgent', 'breaking', 'just discovered'];
    const controversialWords = ['wrong', 'lie', 'myth', 'scam', 'truth', 'exposed'];
    const personalWords = ['I', 'my', 'me', 'personal', 'confession', 'secret'];

    let score = 0;
    const lowerContent = content.toLowerCase();

    // Check for hook patterns
    hooks.forEach(pattern => {
      if (pattern.test(content)) score += 2;
    });

    // Check for urgent language
    urgentWords.forEach(word => {
      if (lowerContent.includes(word)) score += 1;
    });

    // Check for controversial language
    controversialWords.forEach(word => {
      if (lowerContent.includes(word)) score += 1.5;
    });

    // Check for personal elements
    personalWords.forEach(word => {
      if (lowerContent.includes(word)) score += 1;
    });

    // Bonus for numbers and specificity
    if (/\d+%|\$\d+|\d+ times|\d+ hours|\d+ days/.test(content)) score += 1;

    return Math.min(10, score);
  }

  private calculateControversyLevel(content: string): number {
    const controversialPatterns = [
      /unpopular opinion|hot take|controversial/i,
      /(wrong|lie|myth|scam|fraud|fake)/i,
      /(everyone thinks|most people believe).*but/i,
      /(doctors|experts|studies).*wrong/i,
      /(\$\d+).*waste|scam/i,
      /(industry|government|media).*lie/i,
    ];

    const lowerContent = content.toLowerCase();
    let score = 0;

    controversialPatterns.forEach(pattern => {
      if (pattern.test(content)) score += 2;
    });

    // Controversial health topics
    const controversialTopics = ['vaccine', 'covid', 'medicine', 'pharmaceutical', 'diet industry', 'fitness industry'];
    controversialTopics.forEach(topic => {
      if (lowerContent.includes(topic)) score += 1.5;
    });

    return Math.min(10, score);
  }

  private calculateEmotionalImpact(content: string): number {
    const emotionalWords = {
      anger: ['furious', 'angry', 'outrageous', 'disgusting', 'sick', 'tired'],
      fear: ['scary', 'dangerous', 'warning', 'careful', 'avoid', 'never'],
      surprise: ['shocking', 'unbelievable', 'amazing', 'incredible', 'wow', 'mind-blown'],
      joy: ['excited', 'thrilled', 'amazing', 'awesome', 'love', 'fantastic'],
      urgency: ['now', 'immediate', 'urgent', 'quick', 'fast', 'today']
    };

    const lowerContent = content.toLowerCase();
    let score = 0;

    Object.values(emotionalWords).flat().forEach(word => {
      if (lowerContent.includes(word)) score += 0.5;
    });

    // Personal stakes increase emotional impact
    if (/I (lost|gained|spent|saved|learned)/.test(content)) score += 2;

    // Extreme language
    if (/(completely|totally|absolutely|never|always|everything|nothing)/.test(lowerContent)) score += 1;

    return Math.min(10, score);
  }

  private calculateShareabilityScore(content: string): number {
    let score = 0;

    // Shareable content patterns
    if (/tip|hack|secret|trick|method/.test(content.toLowerCase())) score += 2;
    if (/\d+ (ways|tips|secrets|hacks)/.test(content.toLowerCase())) score += 3;
    if (/(save|bookmark|share) this/.test(content.toLowerCase())) score += 2;
    if (/worth knowing|everyone should|needs to see/.test(content.toLowerCase())) score += 2;

    // Educational value
    if (/learn|understand|explain|how to|why/.test(content.toLowerCase())) score += 1;

    // Actionable content
    if (/(try|start|stop|avoid|use|do)/.test(content.toLowerCase())) score += 1;

    return Math.min(10, score);
  }

  private calculateCallToActionStrength(content: string): number {
    const ctas = [
      /what.*think|thoughts|agree|disagree/i,
      /comment|reply|share|retweet|thoughts/i,
      /tag someone|share this|bookmark/i,
      /\?$/, // Ends with question
      /follow for more|more tips/i
    ];

    let score = 0;
    ctas.forEach(pattern => {
      if (pattern.test(content)) score += 2;
    });

    return Math.min(10, score);
  }

  private calculateRelatabilityScore(content: string): number {
    const relatableElements = [
      /we|us|everyone|most people|you/i,
      /struggle|difficult|hard|challenge/i,
      /everyday|daily|routine|habit/i,
      /work|job|life|family|health/i,
      /money|time|energy|stress/i
    ];

    let score = 0;
    relatableElements.forEach(pattern => {
      if (pattern.test(content)) score += 1;
    });

    return Math.min(10, score);
  }

  private calculateUrgencyLevel(content: string): number {
    const urgencyIndicators = [
      /now|today|immediate|urgent|asap/i,
      /breaking|just|new|latest/i,
      /before.*too late|while.*still/i,
      /limited time|don't wait/i
    ];

    let score = 0;
    urgencyIndicators.forEach(pattern => {
      if (pattern.test(content)) score += 2;
    });

    return Math.min(10, score);
  }

  private calculateSocialProofSignals(content: string): number {
    let score = 0;

    // Numbers and statistics
    if (/\d+%|\d+ million|\d+ thousand|\d+ people/.test(content)) score += 2;

    // Authority figures
    if (/(study|research|scientist|doctor|expert|harvard|mit)/.test(content.toLowerCase())) score += 2;

    // Personal experience
    if (/(I tested|I tried|I spent|my experience)/.test(content.toLowerCase())) score += 1;

    // Social validation
    if (/(thousands of|millions of|everyone|most people)/.test(content.toLowerCase())) score += 1;

    return Math.min(10, score);
  }

  private calculateEngagementMultipliers(analysis: ContentAnalysis): {
    hook_multiplier: number;
    timing_multiplier: number;
    format_multiplier: number;
    topic_multiplier: number;
  } {
    return {
      hook_multiplier: 1 + (analysis.hook_strength / 10),
      timing_multiplier: 1.2, // Assume optimal timing for now
      format_multiplier: 1.1, // Single post multiplier
      topic_multiplier: 1 + (analysis.controversy_level / 20)
    };
  }

  private calculateViralProbability(analysis: ContentAnalysis, multipliers: any): number {
    const base = (
      analysis.hook_strength +
      analysis.controversy_level +
      analysis.emotional_impact +
      analysis.shareability_score
    ) / 40;

    const values = Object.values(multipliers) as number[];
    const multiplierBoost = values.reduce((acc: number, val: number) => acc * val, 1) - 1;
    
    return Math.min(1, base + multiplierBoost);
  }

  private generateOptimizationSuggestions(analysis: ContentAnalysis): string[] {
    const suggestions: string[] = [];

    if (analysis.hook_strength < 7) {
      suggestions.push('Add a stronger hook (use "Unpopular opinion:" or "Hot take:")');
    }

    if (analysis.controversy_level < 5) {
      suggestions.push('Add controversial element (challenge common belief)');
    }

    if (analysis.emotional_impact < 6) {
      suggestions.push('Increase emotional impact (add urgency or surprise)');
    }

    if (analysis.call_to_action_strength < 5) {
      suggestions.push('Add engagement CTA (ask question or request thoughts)');
    }

    if (analysis.shareability_score < 6) {
      suggestions.push('Make more shareable (add practical tip or insight)');
    }

    return suggestions;
  }

  /**
   * Apply specific optimization insight to content
   */
  private applyOptimizationInsight(content: string, insight: OptimizationInsight): { optimized: string; applied: boolean } {
    let optimized = content;
    let applied = false;

    try {
      // Apply different optimizations based on the insight type
      if (insight.problem.includes('hooks') || insight.problem.includes('provocative')) {
        // Add provocative hooks
        const viralHooks = [
          "I spent $2,000 learning",
          "Former industry insider:",
          "Plot twist:",
          "Uncomfortable truth:",
          "Every expert tells you X. They're wrong:"
        ];
        
        if (!viralHooks.some(hook => optimized.toLowerCase().includes(hook.toLowerCase()))) {
          const hook = viralHooks[Math.floor(Math.random() * viralHooks.length)];
          optimized = `${hook} ${optimized}`;
          applied = true;
        }
      }

      if (insight.problem.includes('controversy') || insight.problem.includes('safe')) {
        // Add controversial elements
        const controversialPhrases = [
          "They don't want you to know",
          "The industry is lying",
          "This will piss people off",
          "Complete bullshit"
        ];
        
        if (!controversialPhrases.some(phrase => optimized.toLowerCase().includes(phrase.toLowerCase()))) {
          const phrase = controversialPhrases[Math.floor(Math.random() * controversialPhrases.length)];
          optimized = optimized.replace(/\. /, `. ${phrase}: `);
          applied = true;
        }
      }

      if (insight.problem.includes('emotional') || insight.problem.includes('personal')) {
        // Add emotional triggers
        const emotionalTriggers = [
          "This scared the hell out of me",
          "I was furious when I discovered",
          "Almost destroyed my health",
          "Wasted thousands of dollars"
        ];
        
        if (!emotionalTriggers.some(trigger => optimized.toLowerCase().includes(trigger.toLowerCase()))) {
          const trigger = emotionalTriggers[Math.floor(Math.random() * emotionalTriggers.length)];
          optimized = optimized.replace(/I /, `I ${trigger.toLowerCase()} - `);
          applied = true;
        }
      }

      if (insight.problem.includes('call-to-action') || insight.problem.includes('engagement')) {
        // Add confrontational CTAs
        const ctaOptions = [
          "Fight me in the comments.",
          "Change my mind.",
          "Tell me I'm wrong.",
          "This will trigger people."
        ];
        
        // Replace weak CTAs with strong ones
        optimized = optimized.replace(/Let's discuss!?|What's your take\?|Thoughts\?/gi, '');
        const cta = ctaOptions[Math.floor(Math.random() * ctaOptions.length)];
        optimized = `${optimized.trim()} ${cta}`;
        applied = true;
      }

      return { optimized: optimized.trim(), applied };
    } catch (error) {
      console.warn('Failed to apply optimization insight:', error);
      return { optimized: content, applied: false };
    }
  }

  // Optimization methods
  private optimizeHook(content: string): { optimized: string; improvement: number } {
    const hooks = [
      'Unpopular opinion: ',
      'Hot take: ',
      'Controversial: ',
      'Plot twist: ',
      'Truth bomb: '
    ];

    // If no strong hook exists, add one
    if (!/^(Unpopular opinion|Hot take|Controversial|Plot twist|Truth bomb):/i.test(content)) {
      const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
      return {
        optimized: randomHook + content,
        improvement: 3
      };
    }

    return { optimized: content, improvement: 0 };
  }

  private addControversialElements(content: string): { optimized: string; improvement: number } {
    // Add controversial framing if content is too safe
    if (!/(wrong|lie|myth|scam|truth|exposed)/i.test(content)) {
      // Transform safe statements into controversial ones
      let optimized = content;
      
      // Add controversy to health advice
      if (/sleep|exercise|diet|health/.test(content.toLowerCase())) {
        optimized = content.replace(/^/, 'Most health advice is wrong. ');
        return { optimized, improvement: 2 };
      }
    }

    return { optimized: content, improvement: 0 };
  }

  private enhanceEmotionalImpact(content: string): { optimized: string; improvement: number } {
    // Add emotional language if content is too clinical
    const emotionalBoosts = [
      { from: /study shows/gi, to: 'Shocking study reveals' },
      { from: /research found/gi, to: 'Groundbreaking research discovered' },
      { from: /can help/gi, to: 'will transform' },
      { from: /may reduce/gi, to: 'dramatically cuts' },
      { from: /is important/gi, to: 'is absolutely critical' }
    ];

    let optimized = content;
    let improvement = 0;

    emotionalBoosts.forEach(boost => {
      if (boost.from.test(optimized)) {
        optimized = optimized.replace(boost.from, boost.to);
        improvement += 1;
      }
    });

    return { optimized, improvement };
  }

  private addCallToAction(content: string): { optimized: string; improvement: number } {
    // Add CTA if none exists
    if (!/\?$|thoughts|agree|comment|share/.test(content.toLowerCase())) {
      const ctas = [
        ' What\'s your experience?',
        ' Thoughts?',
        ' Agree or disagree?',
        ' Have you tried this?',
        ' What would you add?'
      ];

      const randomCTA = ctas[Math.floor(Math.random() * ctas.length)];
      return {
        optimized: content + randomCTA,
        improvement: 2
      };
    }

    return { optimized: content, improvement: 0 };
  }

  // Helper methods for data analysis
  private async getRecentPostPerformance(): Promise<any[]> {
    // Implementation to get recent posts from database
    return [];
  }

  private async getViralBenchmarks(): Promise<any> {
    // Implementation to get viral benchmarks
    return { followers: 10, likes: 50, shares: 10 };
  }

  private async analyzeFollowerConversion(posts: any[], benchmarks: any): Promise<OptimizationInsight[]> {
    // Implementation to analyze follower conversion
    return [];
  }

  private async analyzeEngagementPatterns(posts: any[]): Promise<OptimizationInsight[]> {
    // Implementation to analyze engagement patterns
    return [];
  }

  private async analyzeContentQuality(posts: any[]): Promise<OptimizationInsight[]> {
    // Implementation to analyze content quality
    return [];
  }

  private async analyzeTimingOptimization(posts: any[]): Promise<OptimizationInsight[]> {
    // Implementation to analyze timing
    return [];
  }

  private async findSimilarPosts(content: string): Promise<any[]> {
    // Implementation to find similar historical posts
    return [];
  }

  private calculateBaselinePrediction(posts: any[]): { followers: number; likes: number; shares: number } {
    return { followers: 2, likes: 10, shares: 2 };
  }

  private getDefaultPrediction(): ViralPrediction {
    return {
      predicted_followers: 1,
      predicted_likes: 5,
      predicted_shares: 1,
      viral_probability: 0.1,
      optimization_suggestions: ['Add engagement hook', 'Include call to action'],
      engagement_multipliers: {
        hook_multiplier: 1.0,
        timing_multiplier: 1.0,
        format_multiplier: 1.0,
        topic_multiplier: 1.0
      }
    };
  }
}

/**
 * Singleton instance
 */
let optimizerInstance: EngagementOptimizer | null = null;

export function getEngagementOptimizer(): EngagementOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = EngagementOptimizer.getInstance();
  }
  return optimizerInstance;
}
