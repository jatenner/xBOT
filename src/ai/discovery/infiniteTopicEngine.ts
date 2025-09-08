/**
 * 🌟 INFINITE TOPIC DISCOVERY ENGINE
 * Replaces hardcoded health topics with AI-driven infinite discovery
 */

import { OpenAIService } from '../../services/openAIService';
import { getRedisSafeClient } from '../../lib/redisSafe';
import { getSafeDatabase } from '../../lib/db';

export interface DiscoveredTopic {
  topic: string;
  domain: string;
  source: 'research' | 'news' | 'trends' | 'ai_generated' | 'hybrid' | 'successful_variation';
  relevanceScore: number;
  noveltyScore: number;
  credibilityScore: number;
  engagementPotential: number;
  timestamp: Date;
  sourceData?: any;
  reasoning?: string;
}

export interface TopicDiscoveryContext {
  recentTopics: string[];
  performanceData: Record<string, number>;
  timeContext: Date;
  audienceInterests: string[];
  trendingKeywords: string[];
  targetFormat: 'single' | 'thread';
}

export class InfiniteTopicEngine {
  private static instance: InfiniteTopicEngine;
  private openai = OpenAIService.getInstance();
  private redis = getRedisSafeClient();
  private db = getSafeDatabase();
  
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly UNIQUENESS_THRESHOLD = 0.7;

  public static getInstance(): InfiniteTopicEngine {
    if (!InfiniteTopicEngine.instance) {
      InfiniteTopicEngine.instance = new InfiniteTopicEngine();
    }
    return InfiniteTopicEngine.instance;
  }

  /**
   * 🎯 DISCOVER OPTIMAL TOPIC
   * Main entry point for intelligent topic selection
   */
  async discoverOptimalTopic(context: TopicDiscoveryContext): Promise<DiscoveredTopic> {
    console.log('🎯 INFINITE_TOPIC_ENGINE: Discovering optimal topic...');

    try {
      // 1. Get all available topics from multiple sources
      const availableTopics = await this.getAllAvailableTopics(context);
      
      // 2. Filter for uniqueness (avoid repetition)
      const uniqueTopics = await this.filterForUniqueness(availableTopics, context.recentTopics);
      
      // 3. Score topics using AI intelligence
      const scoredTopics = await this.scoreTopicsIntelligently(uniqueTopics, context);
      
      // 4. Select optimal topic using performance data
      const optimalTopic = await this.selectOptimalTopic(scoredTopics, context.performanceData);
      
      console.log(`✨ OPTIMAL_TOPIC_SELECTED: "${optimalTopic.topic}" (${optimalTopic.source})`);
      console.log(`📊 Scores: Relevance ${optimalTopic.relevanceScore.toFixed(2)}, Novelty ${optimalTopic.noveltyScore.toFixed(2)}, Engagement ${optimalTopic.engagementPotential.toFixed(2)}`);
      
      // 5. Cache selection for learning
      await this.cacheTopicSelection(optimalTopic, context);
      
      return optimalTopic;

    } catch (error) {
      console.warn('⚠️ Topic discovery failed, using fallback:', error);
      return this.getFallbackTopic();
    }
  }

  /**
   * 🔍 GET ALL AVAILABLE TOPICS FROM MULTIPLE SOURCES
   */
  private async getAllAvailableTopics(context: TopicDiscoveryContext): Promise<DiscoveredTopic[]> {
    console.log('🔍 GATHERING_TOPICS: From all sources...');
    
    // Check cache first
    const cacheKey = `topics_cache:${context.targetFormat}:${context.timeContext.getHours()}`;
    const cachedTopics = await this.getCachedTopics(cacheKey);
    if (cachedTopics.length > 0) {
      console.log(`💾 CACHE_HIT: Found ${cachedTopics.length} cached topics`);
      return cachedTopics;
    }

    // Gather from all sources in parallel
    const [
      aiGeneratedTopics,
      hybridTopics,
      successfulVariations,
      seasonalTopics,
      contrarianTopics
    ] = await Promise.all([
      this.generateAITopics(context),
      this.generateHybridTopics(context),
      this.generateSuccessfulVariations(context),
      this.generateSeasonalTopics(context),
      this.generateContrarianTopics(context)
    ]);

    const allTopics = [
      ...aiGeneratedTopics,
      ...hybridTopics,
      ...successfulVariations,
      ...seasonalTopics,
      ...contrarianTopics
    ];

    console.log(`📊 TOPICS_GATHERED: ${allTopics.length} total (AI: ${aiGeneratedTopics.length}, Hybrid: ${hybridTopics.length}, Variations: ${successfulVariations.length}, Seasonal: ${seasonalTopics.length}, Contrarian: ${contrarianTopics.length})`);
    
    // Cache for future use
    await this.cacheTopics(allTopics, cacheKey);
    
    return allTopics;
  }

  /**
   * 🤖 GENERATE AI TOPICS
   */
  private async generateAITopics(context: TopicDiscoveryContext): Promise<DiscoveredTopic[]> {
    try {
      console.log('🤖 AI_TOPIC_GENERATION: Creating novel health topics...');
      
      const prompt = this.buildTopicGenerationPrompt(context);

      const response = await this.openai.chatCompletion([
        { role: 'system', content: 'You are an expert health content strategist focused on viral, evidence-based topics.' },
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.8,
        maxTokens: 1500,
        requestType: 'topic_generation',
        priority: 'medium'
      });

      const topicsData = this.parseAITopicsResponse(response.choices[0].message.content);

      return topicsData.map(topicData => ({
        topic: topicData.topic,
        domain: this.categorizeTopicDomain(topicData.topic),
        source: 'ai_generated' as const,
        relevanceScore: topicData.relevanceScore || 0.7,
        noveltyScore: topicData.noveltyScore || 0.8,
        credibilityScore: topicData.credibilityScore || 0.7,
        engagementPotential: topicData.engagementPotential || 0.6,
        timestamp: new Date(),
        reasoning: topicData.reasoning
      }));

    } catch (error) {
      console.warn('⚠️ AI topic generation failed:', error);
      return this.getFallbackAITopics();
    }
  }

  /**
   * 🔄 GENERATE HYBRID TOPICS
   */
  private async generateHybridTopics(context: TopicDiscoveryContext): Promise<DiscoveredTopic[]> {
    try {
      // Get successful topics from different domains
      const successfulTopics = await this.getSuccessfulTopics(5);
      
      if (successfulTopics.length < 2) {
        return [];
      }

      const hybridPrompt = `
      Create 5 innovative health topics by combining successful elements from these proven topics:
      ${successfulTopics.join('\n- ')}

      Generate hybrid topics that:
      - Combine 2 different health domains
      - Use successful engagement patterns
      - Maintain scientific credibility
      - Offer fresh perspectives

      Format: JSON array with topic, reasoning, and estimated scores.
      `;

      const response = await this.openai.chatCompletion([
        { role: 'system', content: 'You are a health content strategist specializing in cross-domain insights.' },
        { role: 'user', content: hybridPrompt }
      ], {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 800,
        requestType: 'hybrid_topic_generation',
        priority: 'low'
      });

      const hybridData = this.parseAITopicsResponse(response.choices[0].message.content);

      return hybridData.map(data => ({
        topic: data.topic,
        domain: 'hybrid',
        source: 'hybrid' as const,
        relevanceScore: 0.8,
        noveltyScore: 0.7,
        credibilityScore: 0.8,
        engagementPotential: 0.7,
        timestamp: new Date(),
        reasoning: data.reasoning
      }));

    } catch (error) {
      console.warn('⚠️ Hybrid topic generation failed:', error);
      return [];
    }
  }

  /**
   * 🎯 GENERATE SUCCESSFUL VARIATIONS
   */
  private async generateSuccessfulVariations(context: TopicDiscoveryContext): Promise<DiscoveredTopic[]> {
    try {
      // Get top performing topics from last 30 days
      const topPerformers = await this.getTopPerformingTopics(3);
      
      if (topPerformers.length === 0) {
        return [];
      }

      const variations: DiscoveredTopic[] = [];
      
      for (const performer of topPerformers) {
        const variationTopics = await this.generateTopicVariations(performer.topic, performer.performance);
        variations.push(...variationTopics);
      }

      return variations;

    } catch (error) {
      console.warn('⚠️ Successful variations generation failed:', error);
      return [];
    }
  }

  /**
   * 📅 GENERATE SEASONAL TOPICS
   */
  private async generateSeasonalTopics(context: TopicDiscoveryContext): Promise<DiscoveredTopic[]> {
    const month = context.timeContext.getMonth();
    const seasonalKeywords = this.getSeasonalKeywords(month);
    
    const seasonalTopics = [
      `How ${seasonalKeywords.primary} affects your metabolism differently`,
      `The hidden ${seasonalKeywords.secondary} health benefits nobody talks about`,
      `Why ${seasonalKeywords.primary} timing matters for optimization`,
      `${seasonalKeywords.tertiary} research that changes everything we know`
    ];

    return seasonalTopics.map(topic => ({
      topic,
      domain: 'seasonal_health',
      source: 'ai_generated' as const,
      relevanceScore: 0.8,
      noveltyScore: 0.6,
      credibilityScore: 0.7,
      engagementPotential: 0.8, // Seasonal content often performs well
      timestamp: new Date(),
      reasoning: `Seasonal relevance for ${seasonalKeywords.primary}`
    }));
  }

  /**
   * 🔥 GENERATE CONTRARIAN TOPICS
   */
  private async generateContrarianTopics(context: TopicDiscoveryContext): Promise<DiscoveredTopic[]> {
    const commonBeliefs = [
      'breakfast is the most important meal',
      'cardio is best for fat loss',
      '8 glasses of water daily',
      'stretching prevents injury',
      'more sleep is always better',
      'supplements are necessary',
      'counting calories works',
      'stress is always bad'
    ];

    const contrarianTopics = commonBeliefs.slice(0, 3).map(belief => ({
      topic: `Why "${belief}" might be wrong for you`,
      domain: 'contrarian_health',
      source: 'ai_generated' as const,
      relevanceScore: 0.9, // Contrarian content is highly relevant
      noveltyScore: 0.9,   // Very novel
      credibilityScore: 0.6, // Needs careful evidence
      engagementPotential: 0.8, // High engagement potential
      timestamp: new Date(),
      reasoning: `Challenges common belief: ${belief}`
    }));

    return contrarianTopics;
  }

  /**
   * ✨ FILTER FOR UNIQUENESS
   */
  private async filterForUniqueness(
    topics: DiscoveredTopic[], 
    recentTopics: string[]
  ): Promise<DiscoveredTopic[]> {
    if (recentTopics.length === 0) {
      return topics;
    }

    const uniqueTopics: DiscoveredTopic[] = [];
    
    for (const topic of topics) {
      const similarity = await this.calculateTopicSimilarity(topic.topic, recentTopics);
      
      if (similarity < this.UNIQUENESS_THRESHOLD) {
        uniqueTopics.push(topic);
      } else {
        console.log(`🚫 TOPIC_FILTERED: "${topic.topic}" (similarity: ${similarity.toFixed(2)})`);
      }
    }
    
    console.log(`✨ UNIQUENESS_FILTER: ${uniqueTopics.length}/${topics.length} topics passed`);
    return uniqueTopics;
  }

  /**
   * 🧠 SCORE TOPICS INTELLIGENTLY
   */
  private async scoreTopicsIntelligently(
    topics: DiscoveredTopic[],
    context: TopicDiscoveryContext
  ): Promise<DiscoveredTopic[]> {
    console.log('🧠 INTELLIGENT_SCORING: Analyzing topic potential...');
    
    // Use AI to enhance scores based on context
    for (const topic of topics) {
      const enhancedScores = await this.enhanceTopicScores(topic, context);
      Object.assign(topic, enhancedScores);
    }
    
    // Sort by overall potential
    return topics.sort((a, b) => {
      const scoreA = (a.relevanceScore * 0.3) + (a.noveltyScore * 0.25) + 
                     (a.engagementPotential * 0.25) + (a.credibilityScore * 0.2);
      const scoreB = (b.relevanceScore * 0.3) + (b.noveltyScore * 0.25) + 
                     (b.engagementPotential * 0.25) + (b.credibilityScore * 0.2);
      return scoreB - scoreA;
    });
  }

  /**
   * 🎯 SELECT OPTIMAL TOPIC
   */
  private async selectOptimalTopic(
    scoredTopics: DiscoveredTopic[],
    performanceData: Record<string, number>
  ): Promise<DiscoveredTopic> {
    if (scoredTopics.length === 0) {
      return this.getFallbackTopic();
    }

    // Epsilon-greedy selection with performance weighting
    const epsilon = 0.2; // 20% exploration
    
    if (Math.random() < epsilon) {
      // Exploration: select randomly from top 25%
      const topQuartile = scoredTopics.slice(0, Math.max(1, Math.floor(scoredTopics.length * 0.25)));
      return topQuartile[Math.floor(Math.random() * topQuartile.length)];
    } else {
      // Exploitation: select based on scores + performance history
      const topicWithHistory = scoredTopics.map(topic => {
        const historicalPerformance = performanceData[topic.topic] || 0;
        const currentScore = (topic.relevanceScore + topic.noveltyScore + 
                            topic.engagementPotential + topic.credibilityScore) / 4;
        const adjustedScore = currentScore * 0.7 + historicalPerformance * 0.3;
        
        return { ...topic, adjustedScore };
      });
      
      return topicWithHistory.sort((a, b) => b.adjustedScore - a.adjustedScore)[0];
    }
  }

  // Helper methods
  private buildTopicGenerationPrompt(context: TopicDiscoveryContext): string {
    return `
    Generate 15 innovative health topics for ${context.targetFormat} content that will engage a health optimization audience.

    CONTEXT:
    - Target Format: ${context.targetFormat}
    - Time: ${context.timeContext.toLocaleDateString()}
    - Recent Topics to Avoid: ${context.recentTopics.slice(0, 5).join(', ')}
    - Trending Keywords: ${context.trendingKeywords.join(', ')}

    REQUIREMENTS:
    - Each topic must be specific and actionable
    - Focus on surprising research findings or contrarian angles
    - Include mechanisms, timing, or optimization aspects
    - Avoid obvious health advice
    - Mix domains: metabolism, sleep, exercise, nutrition, hormones, cognition
    - ${context.targetFormat === 'thread' ? 'Create topics suitable for detailed explanations (3-5 tweets)' : 'Create topics for concise, impactful single tweets'}

    FORMAT: Return JSON array:
    [
      {
        "topic": "Topic statement (max 60 chars)",
        "reasoning": "Why this will engage audience",
        "relevanceScore": 0.8,
        "noveltyScore": 0.9,
        "credibilityScore": 0.7,
        "engagementPotential": 0.8
      }
    ]

    Generate 15 topics that would trend and get high engagement:
    `;
  }

  private parseAITopicsResponse(content: string): Array<{
    topic: string;
    reasoning?: string;
    relevanceScore?: number;
    noveltyScore?: number;
    credibilityScore?: number;
    engagementPotential?: number;
  }> {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Fallback: extract topics from text
      const lines = content.split('\n').filter(line => line.trim().length > 10);
      return lines.map(line => ({
        topic: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim().substring(0, 60),
        reasoning: 'AI generated topic'
      })).slice(0, 15);
    }
  }

  private categorizeTopicDomain(topic: string): string {
    const lowerTopic = topic.toLowerCase();
    
    if (lowerTopic.includes('sleep') || lowerTopic.includes('circadian')) return 'sleep';
    if (lowerTopic.includes('exercise') || lowerTopic.includes('workout')) return 'exercise';
    if (lowerTopic.includes('nutrition') || lowerTopic.includes('diet')) return 'nutrition';
    if (lowerTopic.includes('metabolism') || lowerTopic.includes('insulin')) return 'metabolism';
    if (lowerTopic.includes('hormone') || lowerTopic.includes('cortisol')) return 'hormones';
    if (lowerTopic.includes('brain') || lowerTopic.includes('cognitive')) return 'cognition';
    if (lowerTopic.includes('stress') || lowerTopic.includes('mental')) return 'mental_health';
    
    return 'general_health';
  }

  private async calculateTopicSimilarity(newTopic: string, recentTopics: string[]): Promise<number> {
    if (recentTopics.length === 0) return 0;
    
    // Simple word-based similarity
    const newWords = new Set(newTopic.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    let maxSimilarity = 0;
    for (const recentTopic of recentTopics) {
      const recentWords = new Set(recentTopic.toLowerCase().split(/\W+/).filter(w => w.length > 3));
      const intersection = new Set([...newWords].filter(word => recentWords.has(word)));
      const union = new Set([...newWords, ...recentWords]);
      
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    return maxSimilarity;
  }

  private async enhanceTopicScores(topic: DiscoveredTopic, context: TopicDiscoveryContext): Promise<Partial<DiscoveredTopic>> {
    // Time-based relevance boost
    const hour = context.timeContext.getHours();
    let timingBoost = 0;
    
    if (topic.domain === 'sleep' && (hour >= 21 || hour <= 7)) timingBoost = 0.1;
    if (topic.domain === 'exercise' && hour >= 6 && hour <= 10) timingBoost = 0.1;
    if (topic.domain === 'nutrition' && (hour >= 11 && hour <= 13)) timingBoost = 0.1;
    
    return {
      relevanceScore: Math.min(1, topic.relevanceScore + timingBoost),
      engagementPotential: Math.min(1, topic.engagementPotential + timingBoost)
    };
  }

  private getSeasonalKeywords(month: number): { primary: string; secondary: string; tertiary: string } {
    const seasonal: Record<number, { primary: string; secondary: string; tertiary: string }> = {
      0: { primary: 'winter', secondary: 'immune system', tertiary: 'vitamin D' }, // January
      1: { primary: 'winter', secondary: 'seasonal depression', tertiary: 'light therapy' }, // February
      2: { primary: 'spring', secondary: 'detox', tertiary: 'energy renewal' }, // March
      3: { primary: 'spring', secondary: 'allergy', tertiary: 'immune support' }, // April
      4: { primary: 'spring', secondary: 'energy', tertiary: 'metabolism boost' }, // May
      5: { primary: 'summer', secondary: 'hydration', tertiary: 'heat adaptation' }, // June
      6: { primary: 'summer', secondary: 'sun exposure', tertiary: 'vitamin D synthesis' }, // July
      7: { primary: 'summer', secondary: 'heat stress', tertiary: 'cooling strategies' }, // August
      8: { primary: 'fall', secondary: 'immune preparation', tertiary: 'seasonal transition' }, // September
      9: { primary: 'fall', secondary: 'circadian adjustment', tertiary: 'sleep optimization' }, // October
      10: { primary: 'fall', secondary: 'immune boosting', tertiary: 'winter preparation' }, // November
      11: { primary: 'winter', secondary: 'holiday stress', tertiary: 'stress management' } // December
    };
    
    return seasonal[month] || seasonal[0];
  }

  private async generateTopicVariations(baseTopic: string, performance: number): Promise<DiscoveredTopic[]> {
    const variations = [
      `How ${baseTopic} timing affects results`,
      `The ${baseTopic} mistake everyone makes`,
      `Why ${baseTopic} works differently for men vs women`,
      `${baseTopic}: what research really shows`
    ];

    return variations.map(topic => ({
      topic,
      domain: this.categorizeTopicDomain(topic),
      source: 'successful_variation' as const,
      relevanceScore: performance * 0.8,
      noveltyScore: 0.6,
      credibilityScore: performance * 0.9,
      engagementPotential: performance * 0.85,
      timestamp: new Date(),
      reasoning: `Variation of successful topic (${performance.toFixed(2)} performance)`
    }));
  }

  // Data retrieval methods
  private async getSuccessfulTopics(limit: number): Promise<string[]> {
    try {
      const { data } = await this.db.safeSelect(
        'posts',
        'content, engagement_metrics',
        { approved: true },
        { limit: limit * 3, orderBy: 'created_at', ascending: false }
      );
      
      if (data) {
        return data
          .filter(post => post.engagement_metrics?.likes > 5)
          .map(post => this.extractTopicFromContent(post.content))
          .slice(0, limit);
      }
      
      return [];
    } catch {
      return ['metabolic flexibility', 'sleep optimization', 'hormone balance'];
    }
  }

  private async getTopPerformingTopics(limit: number): Promise<Array<{topic: string, performance: number}>> {
    try {
      const { data } = await this.db.safeSelect(
        'posts',
        'content, engagement_metrics',
        { approved: true },
        { limit: limit * 2, orderBy: 'created_at', ascending: false }
      );
      
      if (data) {
        return data
          .map(post => ({
            topic: this.extractTopicFromContent(post.content),
            performance: (post.engagement_metrics?.likes || 0) / 100 // Normalize to 0-1
          }))
          .filter(item => item.performance > 0.05)
          .sort((a, b) => b.performance - a.performance)
          .slice(0, limit);
      }
      
      return [];
    } catch {
      return [
        { topic: 'intermittent fasting', performance: 0.8 },
        { topic: 'cold exposure', performance: 0.7 },
        { topic: 'sleep optimization', performance: 0.6 }
      ];
    }
  }

  private extractTopicFromContent(content: string): string {
    return content.split(/[.!?]+/)[0]?.substring(0, 50) || content.substring(0, 50);
  }

  // Cache management
  private async getCachedTopics(cacheKey: string): Promise<DiscoveredTopic[]> {
    try {
      const cached = await this.redis.getJSON(cacheKey);
      return cached ? JSON.parse(cached as string) : [];
    } catch {
      return [];
    }
  }

  private async cacheTopics(topics: DiscoveredTopic[], cacheKey: string): Promise<void> {
    try {
      await this.redis.setJSON(cacheKey, JSON.stringify(topics), this.CACHE_TTL);
    } catch (error) {
      console.warn('⚠️ Topic caching failed:', error);
    }
  }

  private async cacheTopicSelection(topic: DiscoveredTopic, context: TopicDiscoveryContext): Promise<void> {
    try {
      const selection = {
        topic: topic.topic,
        source: topic.source,
        domain: topic.domain,
        timestamp: new Date(),
        context: {
          format: context.targetFormat,
          hour: context.timeContext.getHours(),
          recentTopicsCount: context.recentTopics.length
        },
        scores: {
          relevance: topic.relevanceScore,
          novelty: topic.noveltyScore,
          credibility: topic.credibilityScore,
          engagement: topic.engagementPotential
        }
      };
      
      await this.redis.setJSON(`topic_selection:${Date.now()}`, JSON.stringify(selection), 86400);
    } catch (error) {
      console.warn('⚠️ Topic selection caching failed:', error);
    }
  }

  // Fallback methods
  private getFallbackAITopics(): DiscoveredTopic[] {
    const fallbackTopics = [
      'Why morning exercise may harm night owls',
      'The hidden cost of chronic dehydration',
      'How meal timing affects metabolism more than calories',
      'Why cold showers boost immunity differently than heat',
      'The surprising link between breathing and longevity'
    ];
    
    return fallbackTopics.map(topic => ({
      topic,
      domain: 'general_health',
      source: 'ai_generated' as const,
      relevanceScore: 0.6,
      noveltyScore: 0.7,
      credibilityScore: 0.6,
      engagementPotential: 0.5,
      timestamp: new Date(),
      reasoning: 'Fallback topic due to generation failure'
    }));
  }

  private getFallbackTopic(): DiscoveredTopic {
    return {
      topic: 'Evidence-based health optimization strategies',
      domain: 'general_health',
      source: 'ai_generated',
      relevanceScore: 0.5,
      noveltyScore: 0.4,
      credibilityScore: 0.7,
      engagementPotential: 0.5,
      timestamp: new Date(),
      reasoning: 'Fallback topic for system reliability'
    };
  }
}

export default InfiniteTopicEngine;
