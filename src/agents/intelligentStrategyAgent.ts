/**
 * 🧠 INTELLIGENT STRATEGY AGENT FOR @SignalAndSynapse
 * Advanced decision-making system that optimizes posting strategy based on learning data and real-time trends
 */

import { twitterDataCollector, TweetMetrics, AccountAnalysis, PerformanceRecord } from './twitterDataCollector';
import { enhancedContentGenerator } from './enhancedContentGenerator';

export interface StrategyDecision {
  optimal_format: 'short_tweet' | 'medium_thread' | 'full_thread';
  recommended_topic: string;
  topic_category: string;
  content_style: {
    tone: 'analytical' | 'conversational' | 'provocative' | 'educational' | 'storytelling';
    structure: 'facts' | 'listicle' | 'bold_take' | 'story' | 'cliffhanger' | 'question';
    personality: 'authoritative' | 'curious' | 'passionate' | 'balanced';
  };
  optimal_timing: {
    post_now: boolean;
    suggested_time?: Date;
    reasoning: string;
  };
  hashtags: string[];
  expected_engagement: number;
  confidence_score: number;
  strategy_reasoning: string[];
}

export interface MarketIntelligence {
  trending_topics: string[];
  successful_formats: { format: string; avg_engagement: number; }[];
  optimal_posting_times: { hour: number; day: string; engagement_rate: number; }[];
  top_performing_accounts: { handle: string; engagement_rate: number; }[];
  content_gaps: string[];
  competitive_opportunities: string[];
}

export interface PerformanceWeights {
  format_weights: Map<string, number>;
  topic_weights: Map<string, number>;
  style_weights: Map<string, number>;
  timing_weights: Map<string, number>;
  hashtag_weights: Map<string, number>;
}

export class IntelligentStrategyAgent {
  private marketIntelligence: MarketIntelligence | null = null;
  private performanceWeights: PerformanceWeights;
  private lastAnalysisTime: Date | null = null;
  private readonly ANALYSIS_INTERVAL_HOURS = 6; // Re-analyze every 6 hours
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;

  constructor() {
    this.performanceWeights = {
      format_weights: new Map([
        ['short_tweet', 1.0],
        ['medium_thread', 1.0],
        ['full_thread', 1.0]
      ]),
      topic_weights: new Map([
        ['longevity', 1.0],
        ['ai_health', 1.0],
        ['nutrition', 1.0],
        ['biohacking', 1.0],
        ['mental_health', 1.0],
        ['fitness', 1.0],
        ['sleep', 1.0],
        ['supplements', 1.0]
      ]),
      style_weights: new Map([
        ['analytical_facts', 1.0],
        ['conversational_story', 1.0],
        ['provocative_bold_take', 1.0],
        ['educational_listicle', 1.0],
        ['storytelling_cliffhanger', 1.0]
      ]),
      timing_weights: new Map(),
      hashtag_weights: new Map()
    };

    this.initializeStrategy();
  }

  /**
   * 🔧 INITIALIZE STRATEGY SYSTEM
   */
  private async initializeStrategy(): Promise<void> {
    try {
      console.log('🧠 Initializing Intelligent Strategy Agent...');
      await this.updateMarketIntelligence();
      console.log('✅ Strategy agent initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize strategy agent:', error);
    }
  }

  /**
   * 🎯 MAKE STRATEGIC POSTING DECISION
   */
  async makeStrategyDecision(userTopic?: string, forceFormat?: string): Promise<StrategyDecision> {
    try {
      console.log('🎯 Making intelligent strategy decision...');

      // Update market intelligence if needed
      await this.ensureCurrentMarketIntelligence();

      // Analyze current context
      const currentContext = await this.analyzeCurrentContext();

      // Select optimal format
      const optimalFormat = forceFormat as any || await this.selectOptimalFormat(currentContext);

      // Select best topic
      const topicDecision = await this.selectOptimalTopic(userTopic, currentContext);

      // Select content style
      const contentStyle = await this.selectOptimalStyle(optimalFormat, topicDecision.category);

      // Determine optimal timing
      const timingDecision = await this.determineOptimalTiming(currentContext);

      // Select hashtags
      const hashtags = await this.selectOptimalHashtags(topicDecision.category, optimalFormat);

      // Calculate expected engagement
      const expectedEngagement = await this.calculateExpectedEngagement(
        optimalFormat, topicDecision.category, contentStyle, timingDecision
      );

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(currentContext);

      // Generate strategy reasoning
      const reasoning = this.generateStrategyReasoning(
        optimalFormat, topicDecision, contentStyle, timingDecision, expectedEngagement
      );

      const decision: StrategyDecision = {
        optimal_format: optimalFormat,
        recommended_topic: topicDecision.topic,
        topic_category: topicDecision.category,
        content_style: contentStyle,
        optimal_timing: timingDecision,
        hashtags,
        expected_engagement: expectedEngagement,
        confidence_score: confidenceScore,
        strategy_reasoning: reasoning
      };

      console.log(`🎯 Strategy decision: ${optimalFormat} about ${topicDecision.topic}`);
      console.log(`📊 Expected engagement: ${expectedEngagement.toFixed(2)}%`);
      console.log(`🎯 Confidence: ${(confidenceScore * 100).toFixed(1)}%`);

      return decision;

    } catch (error) {
      console.error('❌ Strategy decision failed:', error);
      return this.generateFallbackDecision(userTopic);
    }
  }

  /**
   * 📊 UPDATE MARKET INTELLIGENCE
   */
  async updateMarketIntelligence(): Promise<void> {
    try {
      console.log('📊 Updating market intelligence...');

      // Analyze successful accounts
      const accountAnalyses = await twitterDataCollector.analyzeSuccessfulAccounts();

      // Discover trending topics
      const trendingTopics = await twitterDataCollector.discoverTrendingTopics();

      // Extract successful formats
      const successfulFormats = this.extractSuccessfulFormats(accountAnalyses);

      // Analyze optimal posting times
      const optimalTimes = this.analyzeOptimalPostingTimes(accountAnalyses);

      // Identify top performing accounts
      const topAccounts = this.identifyTopPerformingAccounts(accountAnalyses);

      // Find content gaps and opportunities
      const contentGaps = this.identifyContentGaps(accountAnalyses, trendingTopics);
      const opportunities = this.identifyCompetitiveOpportunities(accountAnalyses);

      this.marketIntelligence = {
        trending_topics: trendingTopics,
        successful_formats: successfulFormats,
        optimal_posting_times: optimalTimes,
        top_performing_accounts: topAccounts,
        content_gaps: contentGaps,
        competitive_opportunities: opportunities
      };

      this.lastAnalysisTime = new Date();

      // Update performance weights based on new intelligence
      await this.updatePerformanceWeights();

      console.log('✅ Market intelligence updated successfully');
      console.log(`📈 Found ${trendingTopics.length} trending topics`);
      console.log(`🏆 Analyzed ${accountAnalyses.length} successful accounts`);

    } catch (error) {
      console.error('❌ Failed to update market intelligence:', error);
    }
  }

  /**
   * 🎯 SELECT OPTIMAL FORMAT
   */
  private async selectOptimalFormat(context: any): Promise<'short_tweet' | 'medium_thread' | 'full_thread'> {
    try {
      const now = new Date();
      const hourOfDay = now.getHours();
      const dayOfWeek = now.getDay();

      // Get base performance weights
      const formatScores = new Map<string, number>();

      // Apply learned weights
      this.performanceWeights.format_weights.forEach((weight, format) => {
        formatScores.set(format, weight);
      });

      // Apply time-based modifiers
      if (hourOfDay >= 18 && hourOfDay <= 22) {
        // Evening: threads perform better
        formatScores.set('full_thread', (formatScores.get('full_thread') || 1) * 1.3);
        formatScores.set('medium_thread', (formatScores.get('medium_thread') || 1) * 1.2);
      } else if (hourOfDay >= 9 && hourOfDay <= 12) {
        // Morning: short content preferred
        formatScores.set('short_tweet', (formatScores.get('short_tweet') || 1) * 1.25);
      }

      // Weekend modifier
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        formatScores.set('full_thread', (formatScores.get('full_thread') || 1) * 1.15);
      }

      // Market intelligence modifier
      if (this.marketIntelligence?.successful_formats) {
        this.marketIntelligence.successful_formats.forEach(format => {
          const currentScore = formatScores.get(format.format) || 1;
          formatScores.set(format.format, currentScore * (1 + format.avg_engagement / 100));
        });
      }

      // Add randomness to prevent predictability
      const randomizedScores = Array.from(formatScores.entries()).map(([format, score]) => ({
        format,
        score: score * (0.8 + Math.random() * 0.4)
      }));

      const bestFormat = randomizedScores.reduce((best, current) => 
        current.score > best.score ? current : best
      ).format;

      console.log(`🎯 Selected format: ${bestFormat} (score: ${randomizedScores.find(s => s.format === bestFormat)?.score.toFixed(2)})`);

      return bestFormat as 'short_tweet' | 'medium_thread' | 'full_thread';

    } catch (error) {
      console.error('❌ Format selection failed:', error);
      return 'short_tweet';
    }
  }

  /**
   * 📚 SELECT OPTIMAL TOPIC
   */
  private async selectOptimalTopic(userTopic?: string, context?: any): Promise<{ topic: string; category: string }> {
    try {
      if (userTopic) {
        return {
          topic: userTopic,
          category: this.categorizeUserTopic(userTopic)
        };
      }

      // Analyze trending topics for health/AI relevance
      const trendingHealthTopics = this.marketIntelligence?.trending_topics.filter(topic => 
        this.isHealthOrAIRelated(topic)
      ) || [];

      // Get high-performing topic categories
      const topCategories = Array.from(this.performanceWeights.topic_weights.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Combine trending topics with performance data
      let selectedTopic: string;
      let selectedCategory: string;

      if (trendingHealthTopics.length > 0 && Math.random() > 0.3) {
        // 70% chance to use trending topic
        const trendingTopic = trendingHealthTopics[Math.floor(Math.random() * trendingHealthTopics.length)];
        selectedTopic = this.expandTopicToContent(trendingTopic);
        selectedCategory = this.categorizeUserTopic(selectedTopic);
      } else {
        // Use top-performing category
        const topCategory = topCategories[0][0];
        selectedTopic = this.generateTopicFromCategory(topCategory);
        selectedCategory = topCategory;
      }

      console.log(`📚 Selected topic: ${selectedTopic} (category: ${selectedCategory})`);

      return { topic: selectedTopic, category: selectedCategory };

    } catch (error) {
      console.error('❌ Topic selection failed:', error);
      return {
        topic: 'Latest breakthrough in longevity research',
        category: 'longevity'
      };
    }
  }

  /**
   * 🎨 SELECT OPTIMAL CONTENT STYLE
   */
  private async selectOptimalStyle(format: string, topicCategory: string): Promise<{
    tone: 'analytical' | 'conversational' | 'provocative' | 'educational' | 'storytelling';
    structure: 'facts' | 'listicle' | 'bold_take' | 'story' | 'cliffhanger' | 'question';
    personality: 'authoritative' | 'curious' | 'passionate' | 'balanced';
  }> {
    try {
      const now = new Date();
      const hourOfDay = now.getHours();

      // Base style options optimized for health/AI content
      const styleOptions = [
        { tone: 'analytical', structure: 'facts', personality: 'authoritative' },
        { tone: 'conversational', structure: 'story', personality: 'curious' },
        { tone: 'provocative', structure: 'bold_take', personality: 'passionate' },
        { tone: 'educational', structure: 'listicle', personality: 'balanced' },
        { tone: 'storytelling', structure: 'cliffhanger', personality: 'curious' }
      ];

      // Score each style based on performance weights
      const styleScores = styleOptions.map(style => {
        const styleKey = `${style.tone}_${style.structure}`;
        let baseScore = this.performanceWeights.style_weights.get(styleKey) || 1.0;

        // Time-based adjustments
        if (hourOfDay >= 6 && hourOfDay <= 9 && style.structure === 'facts') {
          baseScore *= 1.2; // Facts for morning
        } else if (hourOfDay >= 17 && hourOfDay <= 21 && style.structure === 'story') {
          baseScore *= 1.3; // Stories for evening
        } else if (style.structure === 'bold_take' && hourOfDay >= 12 && hourOfDay <= 14) {
          baseScore *= 1.25; // Bold takes for lunch engagement
        }

        // Topic-based adjustments
        if (topicCategory === 'ai_health' && style.tone === 'analytical') {
          baseScore *= 1.2; // Analytical tone for AI topics
        } else if (topicCategory === 'mental_health' && style.tone === 'conversational') {
          baseScore *= 1.25; // Conversational for mental health
        } else if (topicCategory === 'biohacking' && style.tone === 'provocative') {
          baseScore *= 1.3; // Provocative for biohacking
        }

        // Format-based adjustments
        if (format === 'full_thread' && style.structure === 'story') {
          baseScore *= 1.2; // Stories work well in threads
        } else if (format === 'short_tweet' && style.structure === 'facts') {
          baseScore *= 1.15; // Facts good for short tweets
        }

        return {
          style,
          score: baseScore * (0.85 + Math.random() * 0.3) // Add randomness
        };
      });

      const bestStyle = styleScores.reduce((best, current) => 
        current.score > best.score ? current : best
      ).style;

      console.log(`🎨 Selected style: ${bestStyle.tone}/${bestStyle.structure}/${bestStyle.personality}`);

      return bestStyle as any;

    } catch (error) {
      console.error('❌ Style selection failed:', error);
      return {
        tone: 'conversational',
        structure: 'facts',
        personality: 'balanced'
      };
    }
  }

  /**
   * ⏰ DETERMINE OPTIMAL TIMING
   */
  private async determineOptimalTiming(context: any): Promise<{
    post_now: boolean;
    suggested_time?: Date;
    reasoning: string;
  }> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

      // Get optimal times from market intelligence
      const optimalTimes = this.marketIntelligence?.optimal_posting_times || [];

      // Check if current time is optimal
      const currentTimeOptimal = optimalTimes.find(time => 
        time.hour === currentHour && time.day === currentDay
      );

      if (currentTimeOptimal && currentTimeOptimal.engagement_rate > 3.5) {
        return {
          post_now: true,
          reasoning: `Current time is optimal: ${currentTimeOptimal.engagement_rate.toFixed(2)}% avg engagement`
        };
      }

      // Find next optimal time
      const todayOptimalTimes = optimalTimes.filter(time => time.day === currentDay);
      const nextOptimalTime = todayOptimalTimes.find(time => time.hour > currentHour);

      if (nextOptimalTime) {
        const suggestedTime = new Date(now);
        suggestedTime.setHours(nextOptimalTime.hour, 0, 0, 0);

        return {
          post_now: false,
          suggested_time: suggestedTime,
          reasoning: `Next optimal time: ${nextOptimalTime.hour}:00 (${nextOptimalTime.engagement_rate.toFixed(2)}% avg engagement)`
        };
      }

      // If no optimal time found, check general good times
      const generalGoodTimes = [9, 12, 18, 20]; // 9 AM, 12 PM, 6 PM, 8 PM
      const nextGoodTime = generalGoodTimes.find(hour => hour > currentHour);

      if (nextGoodTime) {
        const suggestedTime = new Date(now);
        suggestedTime.setHours(nextGoodTime, 0, 0, 0);

        return {
          post_now: false,
          suggested_time: suggestedTime,
          reasoning: `Next general optimal time: ${nextGoodTime}:00`
        };
      }

      // Post now if no better time found
      return {
        post_now: true,
        reasoning: 'No significantly better time found - post now'
      };

    } catch (error) {
      console.error('❌ Timing analysis failed:', error);
      return {
        post_now: true,
        reasoning: 'Timing analysis failed - posting immediately'
      };
    }
  }

  /**
   * 🏷️ SELECT OPTIMAL HASHTAGS
   */
  private async selectOptimalHashtags(topicCategory: string, format: string): Promise<string[]> {
    try {
      // Health/AI focused hashtag pools
      const hashtagPools = {
        longevity: ['#longevity', '#healthspan', '#aging', '#antiaging', '#biohacking'],
        ai_health: ['#AIhealth', '#healthtech', '#digitalhealth', '#AI', '#machinelearning'],
        nutrition: ['#nutrition', '#diet', '#wellness', '#healthyeating', '#supplements'],
        biohacking: ['#biohacking', '#optimization', '#performance', '#selfimprovement', '#wellness'],
        mental_health: ['#mentalhealth', '#mindfulness', '#stress', '#wellness', '#selfcare'],
        fitness: ['#fitness', '#exercise', '#training', '#health', '#wellness'],
        sleep: ['#sleep', '#sleephealth', '#recovery', '#wellness', '#biohacking'],
        supplements: ['#supplements', '#nutrition', '#health', '#wellness', '#biohacking']
      };

      // Get category-specific hashtags
      const categoryHashtags = hashtagPools[topicCategory as keyof typeof hashtagPools] || hashtagPools.longevity;

      // Always include these popular health hashtags
      const popularHealthHashtags = ['#health', '#wellness', '#science', '#research'];

      // Trending hashtags from market intelligence
      const trendingHashtags = this.marketIntelligence?.trending_topics.filter(topic => 
        topic.startsWith('#')
      ) || [];

      // Combine and select optimal hashtags
      const allHashtags = [...categoryHashtags, ...popularHealthHashtags, ...trendingHashtags];
      
      // Remove duplicates and select based on format
      const uniqueHashtags = [...new Set(allHashtags)];
      
      let hashtagCount: number;
      if (format === 'short_tweet') {
        hashtagCount = Math.min(3, uniqueHashtags.length);
      } else if (format === 'medium_thread') {
        hashtagCount = Math.min(5, uniqueHashtags.length);
      } else {
        hashtagCount = Math.min(7, uniqueHashtags.length);
      }

      // Weight hashtags by performance if available
      const weightedHashtags = uniqueHashtags.map(hashtag => ({
        hashtag,
        weight: this.performanceWeights.hashtag_weights.get(hashtag) || 1.0
      })).sort((a, b) => b.weight - a.weight);

      const selectedHashtags = weightedHashtags.slice(0, hashtagCount).map(h => h.hashtag);

      console.log(`🏷️ Selected hashtags: ${selectedHashtags.join(', ')}`);

      return selectedHashtags;

    } catch (error) {
      console.error('❌ Hashtag selection failed:', error);
      return ['#health', '#wellness', '#science'];
    }
  }

  /**
   * 📊 CALCULATE EXPECTED ENGAGEMENT
   */
  private async calculateExpectedEngagement(
    format: string, 
    topicCategory: string, 
    style: any, 
    timing: any
  ): Promise<number> {
    try {
      let baseEngagement = 2.5; // Base 2.5% engagement rate

      // Format modifier
      const formatWeight = this.performanceWeights.format_weights.get(format) || 1.0;
      baseEngagement *= formatWeight;

      // Topic modifier
      const topicWeight = this.performanceWeights.topic_weights.get(topicCategory) || 1.0;
      baseEngagement *= topicWeight;

      // Style modifier
      const styleKey = `${style.tone}_${style.structure}`;
      const styleWeight = this.performanceWeights.style_weights.get(styleKey) || 1.0;
      baseEngagement *= styleWeight;

      // Timing modifier
      if (timing.post_now && timing.reasoning.includes('optimal')) {
        baseEngagement *= 1.2; // Boost for optimal timing
      }

      // Market conditions modifier
      if (this.marketIntelligence?.trending_topics.some(topic => 
        this.isHealthOrAIRelated(topic)
      )) {
        baseEngagement *= 1.1; // Boost for favorable market conditions
      }

      return Math.min(baseEngagement, 8.0); // Cap at 8% engagement

    } catch (error) {
      console.error('❌ Engagement calculation failed:', error);
      return 2.5;
    }
  }

  /**
   * 🎯 CALCULATE CONFIDENCE SCORE
   */
  private calculateConfidenceScore(context: any): number {
    try {
      let confidence = 0.5; // Base 50% confidence

      // Data availability boost
      if (this.marketIntelligence) {
        confidence += 0.2;
      }

      // Recent analysis boost
      if (this.lastAnalysisTime && 
          (Date.now() - this.lastAnalysisTime.getTime()) < this.ANALYSIS_INTERVAL_HOURS * 60 * 60 * 1000) {
        confidence += 0.15;
      }

      // Performance data boost
      const hasPerformanceData = Array.from(this.performanceWeights.format_weights.values()).some(weight => weight !== 1.0);
      if (hasPerformanceData) {
        confidence += 0.15;
      }

      return Math.min(confidence, 1.0);

    } catch (error) {
      console.error('❌ Confidence calculation failed:', error);
      return 0.5;
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private async ensureCurrentMarketIntelligence(): Promise<void> {
    if (!this.lastAnalysisTime || 
        (Date.now() - this.lastAnalysisTime.getTime()) > this.ANALYSIS_INTERVAL_HOURS * 60 * 60 * 1000) {
      await this.updateMarketIntelligence();
    }
  }

  private async analyzeCurrentContext(): Promise<any> {
    const now = new Date();
    return {
      hour: now.getHours(),
      day: now.getDay(),
      dayName: now.toLocaleDateString('en-US', { weekday: 'long' }),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      timestamp: now.toISOString()
    };
  }

  private extractSuccessfulFormats(analyses: AccountAnalysis[]): { format: string; avg_engagement: number; }[] {
    // Mock implementation - in real version, would analyze content formats
    return [
      { format: 'medium_thread', avg_engagement: 4.2 },
      { format: 'short_tweet', avg_engagement: 3.8 },
      { format: 'full_thread', avg_engagement: 3.5 }
    ];
  }

  private analyzeOptimalPostingTimes(analyses: AccountAnalysis[]): { hour: number; day: string; engagement_rate: number; }[] {
    const optimalTimes: { hour: number; day: string; engagement_rate: number; }[] = [];
    
    analyses.forEach(analysis => {
      analysis.best_posting_times.forEach(timeStr => {
        const hour = parseInt(timeStr.split(':')[0]);
        optimalTimes.push({
          hour,
          day: 'All',
          engagement_rate: analysis.avg_engagement_rate
        });
      });
    });

    return optimalTimes.slice(0, 10);
  }

  private identifyTopPerformingAccounts(analyses: AccountAnalysis[]): { handle: string; engagement_rate: number; }[] {
    return analyses
      .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
      .slice(0, 5)
      .map(analysis => ({
        handle: analysis.handle,
        engagement_rate: analysis.avg_engagement_rate
      }));
  }

  private identifyContentGaps(analyses: AccountAnalysis[], trendingTopics: string[]): string[] {
    // Identify topics that are trending but not well covered by successful accounts
    const coveredTopics = new Set<string>();
    analyses.forEach(analysis => {
      analysis.top_performing_topics.forEach(topic => coveredTopics.add(topic));
    });

    return trendingTopics.filter(topic => 
      this.isHealthOrAIRelated(topic) && !coveredTopics.has(topic.toLowerCase())
    ).slice(0, 5);
  }

  private identifyCompetitiveOpportunities(analyses: AccountAnalysis[]): string[] {
    // Mock implementation
    return [
      'AI-powered longevity research',
      'Personalized nutrition insights',
      'Mental health biohacking',
      'Sleep optimization technology',
      'Microbiome health analysis'
    ];
  }

  private async updatePerformanceWeights(): Promise<void> {
    // Mock implementation - would integrate with performance tracking
    console.log('📊 Performance weights updated based on market intelligence');
  }

  private categorizeUserTopic(topic: string): string {
    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('longevity') || topicLower.includes('aging') || topicLower.includes('lifespan')) {
      return 'longevity';
    } else if (topicLower.includes('ai') || topicLower.includes('artificial intelligence') || topicLower.includes('machine learning')) {
      return 'ai_health';
    } else if (topicLower.includes('nutrition') || topicLower.includes('diet') || topicLower.includes('food')) {
      return 'nutrition';
    } else if (topicLower.includes('biohack') || topicLower.includes('optimization') || topicLower.includes('performance')) {
      return 'biohacking';
    } else if (topicLower.includes('mental') || topicLower.includes('stress') || topicLower.includes('anxiety')) {
      return 'mental_health';
    } else if (topicLower.includes('fitness') || topicLower.includes('exercise') || topicLower.includes('workout')) {
      return 'fitness';
    } else if (topicLower.includes('sleep') || topicLower.includes('recovery') || topicLower.includes('rest')) {
      return 'sleep';
    } else if (topicLower.includes('supplement') || topicLower.includes('vitamin') || topicLower.includes('mineral')) {
      return 'supplements';
    }
    
    return 'longevity'; // Default category
  }

  private isHealthOrAIRelated(text: string): boolean {
    const keywords = [
      'health', 'ai', 'wellness', 'fitness', 'nutrition', 'longevity',
      'biohacking', 'technology', 'science', 'research', 'brain',
      'mental', 'sleep', 'diet', 'exercise', 'medical', 'supplements'
    ];

    return keywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  private expandTopicToContent(trendingTopic: string): string {
    const topicExpansions = {
      '#longevity': 'Latest breakthrough in longevity research and anti-aging science',
      '#biohacking': 'Cutting-edge biohacking techniques for optimal health performance',
      '#AI': 'How AI is revolutionizing personalized healthcare and wellness',
      '#nutrition': 'Science-backed nutrition strategies for optimal health',
      '#sleep': 'Advanced sleep optimization techniques backed by research',
      '#mentalhealth': 'Evidence-based approaches to mental wellness and cognitive health'
    };

    return topicExpansions[trendingTopic as keyof typeof topicExpansions] || 
           `Latest insights on ${trendingTopic.replace('#', '')} and health optimization`;
  }

  private generateTopicFromCategory(category: string): string {
    const categoryTopics = {
      'longevity': [
        'Latest breakthrough in longevity research',
        'Anti-aging strategies that actually work',
        'Science of extending healthy lifespan',
        'Cellular regeneration and repair mechanisms'
      ],
      'ai_health': [
        'AI revolutionizing personalized medicine',
        'Machine learning in health diagnostics',
        'AI-powered wellness optimization',
        'Future of AI in healthcare'
      ],
      'nutrition': [
        'Optimal nutrition for peak performance',
        'Micronutrient optimization strategies',
        'Personalized nutrition science',
        'Metabolic health optimization'
      ],
      'biohacking': [
        'Advanced biohacking techniques',
        'Optimizing human performance naturally',
        'Data-driven health optimization',
        'Cutting-edge wellness technology'
      ],
      'mental_health': [
        'Science-backed mental wellness strategies',
        'Cognitive optimization techniques',
        'Stress management breakthroughs',
        'Brain health and performance'
      ],
      'fitness': [
        'Optimal exercise for longevity',
        'Science of movement and health',
        'Performance optimization training',
        'Recovery and adaptation strategies'
      ],
      'sleep': [
        'Sleep optimization for peak performance',
        'Circadian rhythm optimization',
        'Recovery and regeneration science',
        'Sleep quality enhancement techniques'
      ],
      'supplements': [
        'Evidence-based supplementation',
        'Optimal nutrient timing and dosing',
        'Supplement science and research',
        'Targeted nutritional interventions'
      ]
    };

    const topics = categoryTopics[category as keyof typeof categoryTopics] || categoryTopics.longevity;
    return topics[Math.floor(Math.random() * topics.length)];
  }

  private generateStrategyReasoning(
    format: string, 
    topic: any, 
    style: any, 
    timing: any, 
    engagement: number
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Selected ${format} format based on current performance weights and timing`);
    reasoning.push(`Topic "${topic.topic}" chosen from ${topic.category} category for optimal engagement`);
    reasoning.push(`${style.tone} tone with ${style.structure} structure optimized for target audience`);
    reasoning.push(timing.reasoning);
    reasoning.push(`Expected ${engagement.toFixed(2)}% engagement based on historical data`);

    if (this.marketIntelligence?.trending_topics.length) {
      reasoning.push(`Market conditions favorable with ${this.marketIntelligence.trending_topics.length} relevant trending topics`);
    }

    return reasoning;
  }

  private generateFallbackDecision(userTopic?: string): StrategyDecision {
    return {
      optimal_format: 'short_tweet',
      recommended_topic: userTopic || 'Latest breakthrough in health and longevity research',
      topic_category: 'longevity',
      content_style: {
        tone: 'conversational',
        structure: 'facts',
        personality: 'balanced'
      },
      optimal_timing: {
        post_now: true,
        reasoning: 'Fallback decision - posting immediately'
      },
      hashtags: ['#health', '#wellness', '#science'],
      expected_engagement: 2.5,
      confidence_score: 0.5,
      strategy_reasoning: ['Fallback strategy due to analysis error']
    };
  }

  /**
   * 📈 UPDATE STRATEGY BASED ON PERFORMANCE
   */
  async updateStrategyFromPerformance(performanceRecords: PerformanceRecord[]): Promise<void> {
    try {
      console.log(`📈 Updating strategy from ${performanceRecords.length} performance records...`);

      // Update format weights
      const formatPerformance = new Map<string, number[]>();
      performanceRecords.forEach(record => {
        if (!formatPerformance.has(record.format_type)) {
          formatPerformance.set(record.format_type, []);
        }
        formatPerformance.get(record.format_type)!.push(record.engagement_rate);
      });

      formatPerformance.forEach((rates, format) => {
        const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        const currentWeight = this.performanceWeights.format_weights.get(format) || 1.0;
        const newWeight = (currentWeight * 0.8) + (avgRate / 5.0) * 0.2; // Gradual adjustment
        this.performanceWeights.format_weights.set(format, newWeight);
      });

      // Update topic weights
      const topicPerformance = new Map<string, number[]>();
      performanceRecords.forEach(record => {
        if (!topicPerformance.has(record.topic_category)) {
          topicPerformance.set(record.topic_category, []);
        }
        topicPerformance.get(record.topic_category)!.push(record.engagement_rate);
      });

      topicPerformance.forEach((rates, topic) => {
        const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        const currentWeight = this.performanceWeights.topic_weights.get(topic) || 1.0;
        const newWeight = (currentWeight * 0.8) + (avgRate / 5.0) * 0.2;
        this.performanceWeights.topic_weights.set(topic, newWeight);
      });

      console.log('✅ Strategy weights updated based on performance data');

    } catch (error) {
      console.error('❌ Failed to update strategy from performance:', error);
    }
  }
}

// Export singleton instance
export const intelligentStrategyAgent = new IntelligentStrategyAgent();