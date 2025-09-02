/**
 * CONTENT LEARNING SYSTEM
 * Continuously learns from all posted content and performance data to improve future content
 */

import { OpenAI } from 'openai';

export interface ContentPattern {
  pattern_type: 'hook' | 'structure' | 'topic' | 'timing' | 'format';
  pattern: string;
  performance_score: number;
  frequency: number;
  examples: string[];
  confidence: number; // 0-100
}

export interface LearningInsight {
  insight_type: 'what_works' | 'what_fails' | 'timing' | 'audience' | 'format';
  insight: string;
  evidence_strength: number; // 0-100
  sample_size: number;
  recommendation: string;
  action_items: string[];
}

export interface ContentLearningData {
  total_posts_analyzed: number;
  top_patterns: ContentPattern[];
  key_insights: LearningInsight[];
  performance_trends: {
    best_times: string[];
    best_topics: string[];
    best_formats: string[];
    best_hooks: string[];
  };
  recommendations: {
    immediate_actions: string[];
    strategy_adjustments: string[];
    content_improvements: string[];
  };
}

export interface PostAnalysis {
  content: string;
  performance: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    followers_gained: number;
    engagement_rate: number;
  };
  metadata: {
    posted_at: Date;
    topic: string;
    format: 'single' | 'thread';
    hook_type: string;
    word_count: number;
  };
  analysis: {
    hook_effectiveness: number;
    topic_resonance: number;
    format_performance: number;
    timing_score: number;
    overall_score: number;
  };
}

export class ContentLearningSystem {
  private static instance: ContentLearningSystem;
  private openai: OpenAI;
  private postHistory: PostAnalysis[] = [];
  private patterns: ContentPattern[] = [];
  private insights: LearningInsight[] = [];

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  public static getInstance(): ContentLearningSystem {
    if (!ContentLearningSystem.instance) {
      ContentLearningSystem.instance = new ContentLearningSystem();
    }
    return ContentLearningSystem.instance;
  }

  /**
   * Learn from a new post's performance
   */
  public async learnFromPost(
    content: string,
    performance: PostAnalysis['performance'],
    metadata: Partial<PostAnalysis['metadata']>
  ): Promise<PostAnalysis> {
    console.log('🧠 LEARNING_SYSTEM: Analyzing new post performance...');

    // Analyze the post
    const analysis = await this.analyzePost(content, performance, metadata);
    
    // Add to history
    this.postHistory.push(analysis);
    
    // Update patterns
    await this.updatePatterns(analysis);
    
    // Generate new insights
    await this.generateInsights();
    
    // Log learning
    console.log(`📊 LEARNED: Overall score ${analysis.analysis.overall_score}/100`);
    console.log(`🎯 Hook effectiveness: ${analysis.analysis.hook_effectiveness}/100`);
    console.log(`📈 Topic resonance: ${analysis.analysis.topic_resonance}/100`);

    return analysis;
  }

  /**
   * Analyze a single post's performance
   */
  private async analyzePost(
    content: string,
    performance: PostAnalysis['performance'],
    metadata: Partial<PostAnalysis['metadata']>
  ): Promise<PostAnalysis> {
    
    // Complete metadata
    const completeMetadata: PostAnalysis['metadata'] = {
      posted_at: metadata.posted_at || new Date(),
      topic: metadata.topic || await this.extractTopic(content),
      format: metadata.format || (content.includes('/') ? 'thread' : 'single'),
      hook_type: metadata.hook_type || await this.classifyHook(content),
      word_count: content.split(' ').length
    };

    // Analyze performance factors
    const analysis = {
      hook_effectiveness: await this.scoreHookEffectiveness(content, performance),
      topic_resonance: await this.scoreTopicResonance(completeMetadata.topic, performance),
      format_performance: await this.scoreFormatPerformance(completeMetadata.format, performance),
      timing_score: await this.scoreTimingEffectiveness(completeMetadata.posted_at, performance),
      overall_score: 0 // Will be calculated
    };

    // Calculate overall score
    analysis.overall_score = Math.round(
      (analysis.hook_effectiveness * 0.3) +
      (analysis.topic_resonance * 0.25) +
      (analysis.format_performance * 0.25) +
      (analysis.timing_score * 0.2)
    );

    return {
      content,
      performance,
      metadata: completeMetadata,
      analysis
    };
  }

  private async scoreHookEffectiveness(content: string, performance: PostAnalysis['performance']): Promise<number> {
    const firstSentence = content.split('.')[0];
    let score = 50; // Base score

    // High-performing hook patterns
    const strongHooks = [
      /^I noticed something weird/i,
      /^Anyone else/i,
      /^I tried .* for \d+/i,
      /^Most people get .* wrong/i,
      /^I used to believe/i
    ];

    for (const hook of strongHooks) {
      if (hook.test(firstSentence)) {
        score += 20;
        break;
      }
    }

    // Performance boost for engagement
    if (performance.replies > 5) score += 15;
    if (performance.retweets > 2) score += 10;
    if (performance.engagement_rate > 3) score += 10;

    return Math.min(100, score);
  }

  private async scoreTopicResonance(topic: string, performance: PostAnalysis['performance']): Promise<number> {
    let score = 50; // Base score

    // Boost score based on performance metrics
    score += Math.min(30, performance.likes * 2);
    score += Math.min(20, performance.retweets * 5);
    score += Math.min(20, performance.replies * 3);

    return Math.min(100, score);
  }

  private async scoreFormatPerformance(format: 'single' | 'thread', performance: PostAnalysis['performance']): Promise<number> {
    let score = 50;

    if (format === 'thread') {
      // Threads typically should get higher engagement
      if (performance.likes > 5) score += 20;
      if (performance.retweets > 1) score += 15;
      if (performance.replies > 3) score += 15;
    } else {
      // Single tweets
      if (performance.likes > 3) score += 20;
      if (performance.replies > 2) score += 20;
      if (performance.retweets > 0) score += 10;
    }

    return Math.min(100, score);
  }

  private async scoreTimingEffectiveness(postedAt: Date, performance: PostAnalysis['performance']): Promise<number> {
    const hour = postedAt.getHours();
    let score = 50;

    // Peak hours get bonus if performance is good
    const isPeakHour = (hour >= 6 && hour <= 9) || (hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 20);
    
    if (isPeakHour && performance.engagement_rate > 2) {
      score += 25;
    } else if (!isPeakHour && performance.engagement_rate > 2) {
      score += 35; // Even better if non-peak time performed well
    }

    return Math.min(100, score);
  }

  /**
   * Update patterns based on new post
   */
  private async updatePatterns(analysis: PostAnalysis): Promise<void> {
    // Extract patterns from high-performing content
    if (analysis.analysis.overall_score >= 70) {
      const hook = await this.extractHookPattern(analysis.content);
      const topic = analysis.metadata.topic;
      const timing = analysis.metadata.posted_at.getHours();

      // Update hook patterns
      this.updatePattern('hook', hook, analysis.analysis.hook_effectiveness);
      
      // Update topic patterns
      this.updatePattern('topic', topic, analysis.analysis.topic_resonance);
      
      // Update timing patterns
      this.updatePattern('timing', `${timing}:00`, analysis.analysis.timing_score);
    }
  }

  private updatePattern(type: ContentPattern['pattern_type'], pattern: string, score: number): void {
    const existing = this.patterns.find(p => p.pattern_type === type && p.pattern === pattern);
    
    if (existing) {
      // Update existing pattern
      existing.frequency += 1;
      existing.performance_score = (existing.performance_score + score) / 2; // Average
      existing.confidence = Math.min(100, existing.confidence + 5);
    } else {
      // Create new pattern
      this.patterns.push({
        pattern_type: type,
        pattern,
        performance_score: score,
        frequency: 1,
        examples: [],
        confidence: 30 // Start with low confidence
      });
    }
  }

  /**
   * Generate insights from accumulated data
   */
  private async generateInsights(): Promise<void> {
    if (this.postHistory.length < 5) return; // Need minimum data

    console.log('🔍 GENERATING_INSIGHTS: Analyzing patterns from all posts...');

    // Analyze what works
    const highPerformers = this.postHistory.filter(p => p.analysis.overall_score >= 70);
    const lowPerformers = this.postHistory.filter(p => p.analysis.overall_score < 50);

    // Generate hook insights
    if (highPerformers.length > 0) {
      const successfulHooks = highPerformers.map(p => this.extractHookType(p.content));
      const mostSuccessfulHook = this.getMostFrequent(successfulHooks);
      
      this.addInsight({
        insight_type: 'what_works',
        insight: `${mostSuccessfulHook} hooks are most effective`,
        evidence_strength: Math.min(100, highPerformers.length * 15),
        sample_size: highPerformers.length,
        recommendation: `Use more ${mostSuccessfulHook}-style openings`,
        action_items: [`Start content with "${mostSuccessfulHook}" pattern`, 'Test variations of this hook style']
      });
    }

    // Generate timing insights
    const bestTimes = highPerformers.map(p => p.metadata.posted_at.getHours());
    const optimalHour = this.getMostFrequent(bestTimes);
    
    this.addInsight({
      insight_type: 'timing',
      insight: `${optimalHour}:00 is the optimal posting time`,
      evidence_strength: Math.min(100, bestTimes.length * 10),
      sample_size: bestTimes.length,
      recommendation: `Schedule more posts around ${optimalHour}:00`,
      action_items: [`Target ${optimalHour}:00 for high-priority content`, 'Test adjacent hours for optimization']
    });

    // Generate format insights
    const threadPerformance = this.postHistory.filter(p => p.metadata.format === 'thread').map(p => p.analysis.overall_score);
    const singlePerformance = this.postHistory.filter(p => p.metadata.format === 'single').map(p => p.analysis.overall_score);
    
    const avgThreadScore = threadPerformance.reduce((a, b) => a + b, 0) / threadPerformance.length || 0;
    const avgSingleScore = singlePerformance.reduce((a, b) => a + b, 0) / singlePerformance.length || 0;
    
    const betterFormat = avgThreadScore > avgSingleScore ? 'threads' : 'single tweets';
    const difference = Math.abs(avgThreadScore - avgSingleScore);
    
    if (difference > 10) {
      this.addInsight({
        insight_type: 'format',
        insight: `${betterFormat} perform ${difference.toFixed(0)} points better on average`,
        evidence_strength: Math.min(100, this.postHistory.length * 8),
        sample_size: this.postHistory.length,
        recommendation: `Increase ${betterFormat} ratio in content mix`,
        action_items: [`Post more ${betterFormat}`, `Optimize ${betterFormat} format`, 'A/B test format variations']
      });
    }
  }

  private addInsight(insight: LearningInsight): void {
    // Remove old insights of same type
    this.insights = this.insights.filter(i => i.insight_type !== insight.insight_type);
    
    // Add new insight
    this.insights.push(insight);
  }

  /**
   * Get comprehensive learning data
   */
  public async getLearningData(): Promise<ContentLearningData> {
    const topPatterns = this.patterns
      .filter(p => p.confidence > 50)
      .sort((a, b) => b.performance_score - a.performance_score)
      .slice(0, 10);

    const performanceTrends = this.calculatePerformanceTrends();
    const recommendations = this.generateRecommendations();

    return {
      total_posts_analyzed: this.postHistory.length,
      top_patterns: topPatterns,
      key_insights: this.insights,
      performance_trends: performanceTrends,
      recommendations
    };
  }

  private calculatePerformanceTrends(): ContentLearningData['performance_trends'] {
    const highPerformers = this.postHistory.filter(p => p.analysis.overall_score >= 70);
    
    return {
      best_times: this.getTopItems(highPerformers.map(p => `${p.metadata.posted_at.getHours()}:00`)),
      best_topics: this.getTopItems(highPerformers.map(p => p.metadata.topic)),
      best_formats: this.getTopItems(highPerformers.map(p => p.metadata.format)),
      best_hooks: this.getTopItems(highPerformers.map(p => this.extractHookType(p.content)))
    };
  }

  private generateRecommendations(): ContentLearningData['recommendations'] {
    const immediate_actions: string[] = [];
    const strategy_adjustments: string[] = [];
    const content_improvements: string[] = [];

    // Analyze recent performance
    const recentPosts = this.postHistory.slice(-5);
    const avgRecentScore = recentPosts.reduce((sum, p) => sum + p.analysis.overall_score, 0) / recentPosts.length;

    if (avgRecentScore < 60) {
      immediate_actions.push('Improve content quality - recent posts underperforming');
      content_improvements.push('Focus on stronger hooks and more engaging openings');
    }

    // Add insights-based recommendations
    for (const insight of this.insights) {
      if (insight.evidence_strength > 70) {
        immediate_actions.push(...insight.action_items.slice(0, 1));
        strategy_adjustments.push(insight.recommendation);
      }
    }

    return {
      immediate_actions: immediate_actions.slice(0, 5),
      strategy_adjustments: strategy_adjustments.slice(0, 3),
      content_improvements: content_improvements.slice(0, 4)
    };
  }

  // Helper methods
  private async extractTopic(content: string): Promise<string> {
    const words = content.toLowerCase().split(' ');
    const healthTerms = ['sleep', 'diet', 'exercise', 'nutrition', 'productivity', 'wellness', 'health'];
    
    for (const term of healthTerms) {
      if (words.includes(term)) {
        return term;
      }
    }
    
    return 'general health';
  }

  private async classifyHook(content: string): Promise<string> {
    const firstSentence = content.split('.')[0].toLowerCase();
    
    if (firstSentence.includes('i noticed')) return 'personal observation';
    if (firstSentence.includes('anyone else')) return 'community question';
    if (firstSentence.includes('i tried')) return 'personal experiment';
    if (firstSentence.includes('most people')) return 'contrarian insight';
    if (firstSentence.includes('?')) return 'question hook';
    
    return 'direct statement';
  }

  private extractHookPattern(content: string): string {
    const firstSentence = content.split('.')[0];
    
    // Extract pattern template
    return firstSentence
      .replace(/\d+/g, '[NUMBER]')
      .replace(/[A-Z][a-z]+ [A-Z][a-z]+/g, '[SPECIFIC_TERM]')
      .substring(0, 50);
  }

  private extractHookType(content: string): string {
    return this.classifyHook(content);
  }

  private getMostFrequent<T>(items: T[]): T {
    const frequency: Record<string, number> = {};
    
    for (const item of items) {
      const key = String(item);
      frequency[key] = (frequency[key] || 0) + 1;
    }
    
    const mostFrequent = Object.entries(frequency).sort(([,a], [,b]) => b - a)[0];
    return mostFrequent ? items.find(item => String(item) === mostFrequent[0])! : items[0];
  }

  private getTopItems(items: string[]): string[] {
    const frequency: Record<string, number> = {};
    
    for (const item of items) {
      frequency[item] = (frequency[item] || 0) + 1;
    }
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([item]) => item);
  }

  /**
   * Get actionable recommendations for next content
   */
  public async getNextContentRecommendations(): Promise<{
    suggested_hooks: string[];
    suggested_topics: string[];
    suggested_timing: string;
    suggested_format: 'single' | 'thread';
    confidence: number;
  }> {
    const learningData = await this.getLearningData();
    
    return {
      suggested_hooks: learningData.performance_trends.best_hooks,
      suggested_topics: learningData.performance_trends.best_topics,
      suggested_timing: learningData.performance_trends.best_times[0] || '8:00',
      suggested_format: learningData.performance_trends.best_formats.includes('thread') ? 'thread' : 'single',
      confidence: Math.min(100, this.postHistory.length * 10)
    };
  }
}
