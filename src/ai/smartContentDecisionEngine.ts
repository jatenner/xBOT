/**
 * 🧠 SMART CONTENT DECISION ENGINE
 * AI-driven decisions on WHAT type of content to create and WHY
 * Analyzes performance data, audience preferences, and optimal content strategies
 */

import { revolutionaryContentSystem, RevolutionaryContent, ContentRequest } from './revolutionaryContentSystem';
import { intelligentTimingSystem, TimingDecision } from './intelligentTimingSystem';
import { getSafeDatabase } from '../lib/db';
import { getRedisSafeClient } from '../lib/redisSafe';

export interface ContentDecision {
  contentType: 'viral_insight' | 'educational_thread' | 'quick_tip' | 'controversial_take' | 'myth_buster' | 'shocking_fact';
  format: 'single' | 'thread';
  topic: string;
  angle: string;
  urgency: 'high' | 'medium' | 'low';
  confidence: number;
  reasoning: string;
  expectedEngagement: number;
  viralPotential: number;
  audienceMatch: number;
}

export interface ContentStrategy {
  primaryGoal: 'engagement' | 'followers' | 'authority' | 'viral_reach';
  toneStyle: 'shocking' | 'educational' | 'controversial' | 'friendly_expert';
  complexityLevel: 'simple' | 'moderate' | 'complex';
  timeInvestment: 'quick_read' | 'deep_dive' | 'comprehensive';
}

export interface PerformanceData {
  recentPosts: Array<{
    contentType: string;
    engagement: number;
    viralScore: number;
    timestamp: Date;
  }>;
  topPerformingTypes: string[];
  audiencePreferences: string[];
  currentTrends: string[];
}

export class SmartContentDecisionEngine {
  private static instance: SmartContentDecisionEngine;
  private db = getSafeDatabase();
  private redis = getRedisSafeClient();

  // Content type performance weights (updated based on data)
  private performanceWeights = {
    viral_insight: 0.25,
    shocking_fact: 0.20,
    controversial_take: 0.18,
    myth_buster: 0.15,
    educational_thread: 0.12,
    quick_tip: 0.10
  };

  // Health topics that perform well
  private highPerformanceTopics = [
    'sleep metabolism secrets',
    'brain energy consumption',
    'gut bacteria communication',
    'stress hormone cycles',
    'immune system mysteries',
    'cellular repair mechanisms',
    'neurotransmitter production',
    'inflammation resolution',
    'circadian rhythm hacks',
    'mitochondrial optimization',
    'hormonal balance tricks',
    'cognitive enhancement',
    'longevity pathways',
    'metabolic flexibility',
    'digestive system secrets'
  ];

  static getInstance(): SmartContentDecisionEngine {
    if (!this.instance) {
      this.instance = new SmartContentDecisionEngine();
    }
    return this.instance;
  }

  /**
   * 🎯 MAKE SMART CONTENT DECISION
   */
  async makeContentDecision(): Promise<ContentDecision> {
    console.log('🧠 SMART_CONTENT_DECISION: Analyzing optimal content strategy...');

    try {
      const [
        timingDecision,
        performanceData,
        currentStrategy,
        audienceState
      ] = await Promise.all([
        intelligentTimingSystem.makeTimingDecision(),
        this.getPerformanceData(),
        this.getCurrentStrategy(),
        this.analyzeAudienceState()
      ]);

      // Select optimal content type based on multiple factors
      const contentType = this.selectOptimalContentType(
        timingDecision,
        performanceData,
        currentStrategy
      );

      // Choose format based on content type and timing
      const format = this.selectOptimalFormat(contentType, timingDecision);

      // Select topic with viral potential
      const { topic, angle } = this.selectViralTopic(contentType, performanceData);

      // Calculate confidence and engagement predictions
      const confidence = this.calculateDecisionConfidence(
        contentType,
        format,
        topic,
        timingDecision,
        performanceData
      );

      const expectedEngagement = this.calculateExpectedEngagement(
        contentType,
        format,
        timingDecision.expectedEngagement
      );

      const viralPotential = this.calculateViralPotential(
        contentType,
        topic,
        angle
      );

      const audienceMatch = this.calculateAudienceMatch(
        contentType,
        audienceState,
        performanceData
      );

      // Build reasoning
      const reasoning = this.buildDecisionReasoning(
        contentType,
        format,
        topic,
        timingDecision,
        confidence
      );

      const decision: ContentDecision = {
        contentType,
        format,
        topic,
        angle,
        urgency: this.determineUrgency(confidence, timingDecision),
        confidence,
        reasoning,
        expectedEngagement,
        viralPotential,
        audienceMatch
      };

      console.log(`🎯 CONTENT_DECISION: ${contentType} (${format}) about "${topic}"`);
      console.log(`📊 CONFIDENCE: ${confidence}% | VIRAL: ${viralPotential}% | ENGAGEMENT: ${expectedEngagement}%`);

      return decision;

    } catch (error) {
      console.error('❌ CONTENT_DECISION_ERROR:', error);
      return this.getEmergencyContentDecision();
    }
  }

  /**
   * 🚀 GENERATE CONTENT BASED ON DECISION
   */
  async generateOptimalContent(decision?: ContentDecision): Promise<RevolutionaryContent> {
    const contentDecision = decision || await this.makeContentDecision();

    console.log(`🚀 GENERATING: ${contentDecision.contentType} content about "${contentDecision.topic}"`);

    const request: ContentRequest = {
      topic: `${contentDecision.topic} - ${contentDecision.angle}`,
      format: contentDecision.format,
      targetAudience: 'health-conscious professionals seeking surprising insights',
      urgency: contentDecision.urgency === 'high' ? 'viral' : 'engaging'
    };

    const content = await revolutionaryContentSystem.generateRevolutionaryContent(request);

    // Add decision metadata to content
    (content as any).decisionMetadata = {
      contentType: contentDecision.contentType,
      confidence: contentDecision.confidence,
      reasoning: contentDecision.reasoning,
      expectedEngagement: contentDecision.expectedEngagement,
      viralPotential: contentDecision.viralPotential
    };

    return content;
  }

  /**
   * 🎯 SELECT OPTIMAL CONTENT TYPE
   */
  private selectOptimalContentType(
    timing: TimingDecision,
    performance: PerformanceData,
    strategy: ContentStrategy
  ): ContentDecision['contentType'] {
    // Weight different content types based on current conditions
    const weights = { ...this.performanceWeights };

    // Timing-based adjustments
    if (timing.urgency === 'immediate' && timing.confidence >= 80) {
      weights.viral_insight *= 1.3;
      weights.shocking_fact *= 1.2;
    }

    if (timing.contentType === 'controversial_take') {
      weights.controversial_take *= 1.4;
    }

    // Performance-based adjustments
    performance.topPerformingTypes.forEach(type => {
      if (weights[type as keyof typeof weights]) {
        weights[type as keyof typeof weights] *= 1.2;
      }
    });

    // Strategy-based adjustments
    if (strategy.primaryGoal === 'viral_reach') {
      weights.viral_insight *= 1.3;
      weights.shocking_fact *= 1.2;
      weights.controversial_take *= 1.1;
    } else if (strategy.primaryGoal === 'authority') {
      weights.educational_thread *= 1.3;
      weights.myth_buster *= 1.2;
    }

    // Select highest weighted type
    const selectedType = Object.entries(weights)
      .sort(([, a], [, b]) => b - a)[0][0] as ContentDecision['contentType'];

    return selectedType;
  }

  /**
   * 📝 SELECT OPTIMAL FORMAT
   */
  private selectOptimalFormat(
    contentType: ContentDecision['contentType'],
    timing: TimingDecision
  ): 'single' | 'thread' {
    // Content types that work better as threads
    const threadFriendlyTypes = ['educational_thread', 'myth_buster'];
    
    // Content types that work better as singles
    const singleFriendlyTypes = ['viral_insight', 'shocking_fact', 'quick_tip'];

    if (threadFriendlyTypes.includes(contentType)) {
      return 'thread';
    }
    
    if (singleFriendlyTypes.includes(contentType)) {
      return 'single';
    }

    // For controversial_take, decide based on timing confidence
    if (contentType === 'controversial_take') {
      return timing.confidence >= 85 ? 'thread' : 'single';
    }

    // Default decision based on timing
    return timing.expectedEngagement >= 80 ? 'thread' : 'single';
  }

  /**
   * 🎲 SELECT VIRAL TOPIC
   */
  private selectViralTopic(
    contentType: ContentDecision['contentType'],
    performance: PerformanceData
  ): { topic: string; angle: string } {
    // Select topic based on content type
    let availableTopics = [...this.highPerformanceTopics];

    // Filter based on recent performance
    if (performance.currentTrends.length > 0) {
      const trendingTopics = availableTopics.filter(topic =>
        performance.currentTrends.some(trend => 
          topic.toLowerCase().includes(trend.toLowerCase())
        )
      );
      if (trendingTopics.length > 0) {
        availableTopics = trendingTopics;
      }
    }

    // Randomly select topic (can be enhanced with more sophisticated selection)
    const topic = availableTopics[Math.floor(Math.random() * availableTopics.length)];

    // Generate angle based on content type
    const angle = this.generateAngle(contentType, topic);

    return { topic, angle };
  }

  /**
   * 📐 GENERATE ANGLE
   */
  private generateAngle(
    contentType: ContentDecision['contentType'],
    topic: string
  ): string {
    const angles = {
      viral_insight: [
        'the shocking truth scientists just discovered',
        'what 99% of people get wrong',
        'the hidden mechanism nobody talks about',
        'why everything you know is backwards'
      ],
      shocking_fact: [
        'the disturbing reality researchers found',
        'what happens in your body that sounds fake',
        'the unexpected side effect nobody mentions',
        'the scary truth doctors don\'t tell you'
      ],
      controversial_take: [
        'why popular advice is actually harmful',
        'the industry secret they don\'t want known',
        'challenging the biggest health myth',
        'the unpopular opinion backed by science'
      ],
      myth_buster: [
        'debunking the most dangerous health myth',
        'why this "healthy" advice is wrong',
        'the truth behind popular health claims',
        'separating fact from marketing fiction'
      ],
      educational_thread: [
        'the complete science behind',
        'everything you need to know about',
        'the step-by-step breakdown of',
        'the comprehensive guide to understanding'
      ],
      quick_tip: [
        'the simple hack that changes everything',
        'the 30-second fix for',
        'the easy method to optimize',
        'the quick technique that works'
      ]
    };

    const typeAngles = angles[contentType] || angles.viral_insight;
    return typeAngles[Math.floor(Math.random() * typeAngles.length)];
  }

  /**
   * 📊 CALCULATE DECISION CONFIDENCE
   */
  private calculateDecisionConfidence(
    contentType: string,
    format: string,
    topic: string,
    timing: TimingDecision,
    performance: PerformanceData
  ): number {
    let confidence = 60; // Base confidence

    // Timing confidence contribution (30%)
    confidence += timing.confidence * 0.3;

    // Performance data contribution (25%)
    if (performance.topPerformingTypes.includes(contentType)) {
      confidence += 20;
    }

    // Topic relevance (20%)
    if (performance.currentTrends.some(trend => 
      topic.toLowerCase().includes(trend.toLowerCase())
    )) {
      confidence += 15;
    }

    // Format optimization (15%)
    if (format === 'thread' && timing.expectedEngagement >= 80) {
      confidence += 10;
    } else if (format === 'single' && timing.urgency === 'immediate') {
      confidence += 8;
    }

    // Content type strength (10%)
    const typeWeight = this.performanceWeights[contentType as keyof typeof this.performanceWeights] || 0.1;
    confidence += typeWeight * 50; // Convert weight to confidence points

    return Math.min(100, Math.max(0, Math.round(confidence)));
  }

  /**
   * 📈 CALCULATE EXPECTED ENGAGEMENT
   */
  private calculateExpectedEngagement(
    contentType: string,
    format: string,
    timingEngagement: number
  ): number {
    const baseEngagement = {
      viral_insight: 85,
      shocking_fact: 90,
      controversial_take: 95,
      myth_buster: 80,
      educational_thread: 75,
      quick_tip: 70
    };

    const base = baseEngagement[contentType as keyof typeof baseEngagement] || 75;
    const formatMultiplier = format === 'thread' ? 1.1 : 1.0;
    const timingMultiplier = timingEngagement / 100;

    return Math.round(base * formatMultiplier * timingMultiplier);
  }

  /**
   * 🌟 CALCULATE VIRAL POTENTIAL
   */
  private calculateViralPotential(
    contentType: string,
    topic: string,
    angle: string
  ): number {
    const viralScores = {
      shocking_fact: 95,
      controversial_take: 90,
      viral_insight: 85,
      myth_buster: 75,
      educational_thread: 65,
      quick_tip: 60
    };

    let score = viralScores[contentType as keyof typeof viralScores] || 70;

    // Boost for viral keywords in topic/angle
    const viralKeywords = ['shocking', 'secret', 'hidden', 'surprising', 'unexpected', 'controversial'];
    if (viralKeywords.some(keyword => 
      topic.toLowerCase().includes(keyword) || angle.toLowerCase().includes(keyword)
    )) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * 👥 CALCULATE AUDIENCE MATCH
   */
  private calculateAudienceMatch(
    contentType: string,
    audienceState: any,
    performance: PerformanceData
  ): number {
    let match = 70; // Base match

    // Check against audience preferences
    if (performance.audiencePreferences.includes(contentType)) {
      match += 20;
    }

    // Adjust for audience engagement level
    match += (audienceState.currentEngagement - 50) * 0.5;

    return Math.min(100, Math.max(0, Math.round(match)));
  }

  /**
   * ⚡ DETERMINE URGENCY
   */
  private determineUrgency(
    confidence: number,
    timing: TimingDecision
  ): 'high' | 'medium' | 'low' {
    if (confidence >= 85 && timing.urgency === 'immediate') return 'high';
    if (confidence >= 70 && timing.urgency !== 'delay') return 'medium';
    return 'low';
  }

  /**
   * 🏗️ BUILD DECISION REASONING
   */
  private buildDecisionReasoning(
    contentType: string,
    format: string,
    topic: string,
    timing: TimingDecision,
    confidence: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`${contentType} selected for ${confidence}% confidence`);
    reasons.push(`${format} format optimal for timing`);
    reasons.push(`"${topic}" topic has high viral potential`);
    reasons.push(`timing analysis: ${timing.reasoning}`);

    if (confidence >= 85) {
      reasons.push('all factors strongly aligned');
    } else if (confidence >= 70) {
      reasons.push('good strategic fit');
    } else {
      reasons.push('reasonable opportunity');
    }

    return reasons.join(', ');
  }

  /**
   * 📊 GET PERFORMANCE DATA (Mock implementation)
   */
  private async getPerformanceData(): Promise<PerformanceData> {
    // TODO: Replace with real analytics data
    return {
      recentPosts: [
        { contentType: 'viral_insight', engagement: 85, viralScore: 90, timestamp: new Date() },
        { contentType: 'shocking_fact', engagement: 92, viralScore: 88, timestamp: new Date() }
      ],
      topPerformingTypes: ['viral_insight', 'shocking_fact', 'controversial_take'],
      audiencePreferences: ['viral_insight', 'myth_buster'],
      currentTrends: ['sleep', 'metabolism', 'brain health']
    };
  }

  /**
   * 🎯 GET CURRENT STRATEGY
   */
  private async getCurrentStrategy(): Promise<ContentStrategy> {
    // TODO: Make this dynamic based on current goals
    return {
      primaryGoal: 'viral_reach',
      toneStyle: 'shocking',
      complexityLevel: 'moderate',
      timeInvestment: 'quick_read'
    };
  }

  /**
   * 👥 ANALYZE AUDIENCE STATE (Mock implementation)
   */
  private async analyzeAudienceState(): Promise<any> {
    return {
      currentEngagement: 75,
      growthRate: 80,
      activityLevel: 85
    };
  }

  /**
   * 🆘 EMERGENCY CONTENT DECISION
   */
  private getEmergencyContentDecision(): ContentDecision {
    return {
      contentType: 'viral_insight',
      format: 'single',
      topic: 'sleep metabolism secrets',
      angle: 'the shocking truth scientists just discovered',
      urgency: 'medium',
      confidence: 70,
      reasoning: 'Emergency fallback decision with proven content type',
      expectedEngagement: 75,
      viralPotential: 80,
      audienceMatch: 75
    };
  }
}

// Export singleton instance
export const smartContentDecisionEngine = SmartContentDecisionEngine.getInstance();
