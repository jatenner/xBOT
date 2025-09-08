/**
 * Content Strategist for xBOT
 * Chooses format, topics, and timing using data-driven strategies
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { HEALTH_VERTICALS, CONTENT_FORMATS, selectOptimalFormat } from '../content/policies';

export interface ContentStrategy {
  topic: string;
  format: 'single' | 'thread';
  contentType: string;
  pillar: string;
  complexity: 'low' | 'medium' | 'high';
  predictedLength: number;
  reasoning: string;
}

export interface StrategyContext {
  recentTopics: string[];
  trendingEntities: string[];
  performanceData: Record<string, number>;
  timeOfDay: string;
  dayOfWeek: string;
}

export class ContentStrategist {
  private supabase: any;
  private redis: Redis;
  private epsilon: number = 0.2; // Exploration rate for epsilon-greedy

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  /**
   * Choose optimal content strategy based on context and performance data
   */
  async chooseStrategy(): Promise<ContentStrategy> {
    console.log('📊 CONTENT_STRATEGIST: Analyzing optimal strategy...');
    
    // Gather context
    const context = await this.gatherStrategyContext();
    
    // Get topic using epsilon-greedy approach
    const topic = await this.selectTopicEpsilonGreedy(context);
    
    // Predict content characteristics
    const predictedLength = await this.predictContentLength(topic);
    const complexity = this.assessTopicComplexity(topic);
    
    // Choose format based on predicted characteristics
    const format = this.chooseFormat(topic, complexity, predictedLength);
    const contentType = this.mapFormatToContentType(format, topic);
    
    // Get topic pillar
    const pillar = this.getTopicPillar(topic);
    
    const reasoning = this.generateReasoning(topic, format, complexity, predictedLength, context);
    
    console.log(`🎯 STRATEGY_SELECTED: ${topic} → ${format} (${contentType})`);
    console.log(`📊 Reasoning: ${reasoning}`);
    
    return {
      topic,
      format,
      contentType,
      pillar,
      complexity,
      predictedLength,
      reasoning
    };
  }

  /**
   * Gather context for strategy decisions
   */
  private async gatherStrategyContext(): Promise<StrategyContext> {
    // Get recent topics to avoid repetition
    const recentTopics = await this.getRecentTopics();
    
    // Get trending entities from Redis
    const trendingEntities = await this.getTrendingEntities();
    
    // Get performance data
    const performanceData = await this.getPerformanceData();
    
    // Time context
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(now);
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    return {
      recentTopics,
      trendingEntities,
      performanceData,
      timeOfDay,
      dayOfWeek
    };
  }

  /**
   * Select topic using epsilon-greedy exploration/exploitation
   */
  private async selectTopicEpsilonGreedy(context: StrategyContext): Promise<string> {
    const shouldExplore = Math.random() < this.epsilon;
    
    if (shouldExplore) {
      console.log('🔍 EXPLORATION: Trying less-used topic');
      return this.selectExplorationTopic(context);
    } else {
      console.log('💎 EXPLOITATION: Using high-performing topic');
      return this.selectExploitationTopic(context);
    }
  }

  /**
   * Select topic for exploration (diverse content)
   */
  private selectExplorationTopic(context: StrategyContext): string {
    // Filter out recent topics
    const availableVerticals = HEALTH_VERTICALS.filter(vertical => 
      vertical.enabled && !context.recentTopics.includes(vertical.name)
    );
    
    if (availableVerticals.length === 0) {
      // If all topics were recent, pick from enabled verticals
      const enabledVerticals = HEALTH_VERTICALS.filter(v => v.enabled);
      const randomVertical = enabledVerticals[Math.floor(Math.random() * enabledVerticals.length)];
      return randomVertical.name;
    }
    
    // Prioritize underused topics
    const randomVertical = availableVerticals[Math.floor(Math.random() * availableVerticals.length)];
    return randomVertical.name;
  }

  /**
   * Select topic for exploitation (proven performers)
   */
  private selectExploitationTopic(context: StrategyContext): string {
    // Get topics with performance data
    const topicsWithPerformance = Object.entries(context.performanceData)
      .filter(([topic]) => !context.recentTopics.includes(topic))
      .sort(([,a], [,b]) => b - a); // Sort by performance desc
    
    if (topicsWithPerformance.length > 0) {
      // Use top 3 performers with some randomization
      const topPerformers = topicsWithPerformance.slice(0, 3);
      const weights = [0.5, 0.3, 0.2]; // Bias toward best performer
      
      const random = Math.random();
      let cumulative = 0;
      
      for (let i = 0; i < topPerformers.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
          return topPerformers[i][0];
        }
      }
      
      return topPerformers[0][0];
    }
    
    // Fallback to trending or core topics
    if (context.trendingEntities.length > 0) {
      return context.trendingEntities[0];
    }
    
    // Final fallback to core topics
    const coreTopics = HEALTH_VERTICALS.filter(v => v.pillar === 'core' && v.enabled);
    const randomCore = coreTopics[Math.floor(Math.random() * coreTopics.length)];
    return randomCore.name;
  }

  /**
   * Predict content length based on topic
   */
  private async predictContentLength(topic: string): Promise<number> {
    try {
      // Get average length for this topic from historical data
      const { data } = await this.supabase
        .from('posts')
        .select('text')
        .eq('topic', topic)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        const avgLength = data.reduce((sum: number, post: any) => 
          sum + post.text.length, 0) / data.length;
        return Math.round(avgLength);
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch historical length data');
    }
    
    // Fallback predictions based on topic complexity
    const complexTopics = ['longevity_research', 'hormonal_health', 'exercise_science'];
    const mediumTopics = ['nutrition_myths', 'stress_management'];
    
    if (complexTopics.includes(topic)) {
      return 800; // Thread territory
    } else if (mediumTopics.includes(topic)) {
      return 400; // Could go either way
    } else {
      return 200; // Single tweet
    }
  }

  /**
   * Assess topic complexity
   */
  private assessTopicComplexity(topic: string): 'low' | 'medium' | 'high' {
    const lowComplexity = ['sleep_optimization', 'stress_management'];
    const highComplexity = ['longevity_research', 'hormonal_health', 'exercise_science'];
    
    if (lowComplexity.includes(topic)) return 'low';
    if (highComplexity.includes(topic)) return 'high';
    return 'medium';
  }

  /**
   * Choose format based on topic and predicted characteristics
   */
  private chooseFormat(
    topic: string, 
    complexity: 'low' | 'medium' | 'high',
    predictedLength: number
  ): 'single' | 'thread' {
    
    // Force thread for complex topics or long content
    if (complexity === 'high' || predictedLength > 600) {
      return 'thread';
    }
    
    // Force thread if predicted length suggests multiple claims
    if (predictedLength > 280) {
      return 'thread';
    }
    
    // Use format selection from policies
    const optimalFormat = selectOptimalFormat(topic, complexity, predictedLength);
    
    // Map content types to single/thread
    const threadFormats = ['thread_deep_dive', 'case_study', 'how_to'];
    
    return threadFormats.includes(optimalFormat) ? 'thread' : 'single';
  }

  /**
   * Map format to specific content type
   */
  private mapFormatToContentType(format: 'single' | 'thread', topic: string): string {
    if (format === 'single') {
      // Choose single tweet content type
      const singleTypes = ['short_tip', 'myth_buster', 'stat_of_day'];
      
      if (topic.includes('myth') || topic.includes('nutrition')) {
        return 'myth_buster';
      }
      
      return singleTypes[Math.floor(Math.random() * singleTypes.length)];
    } else {
      // Choose thread content type
      const threadTypes = ['thread_deep_dive', 'how_to', 'case_study'];
      
      if (topic.includes('research') || topic.includes('longevity')) {
        return 'case_study';
      }
      
      if (topic.includes('how') || topic.includes('optimization')) {
        return 'how_to';
      }
      
      return 'thread_deep_dive';
    }
  }

  /**
   * Get topic pillar
   */
  private getTopicPillar(topic: string): string {
    const vertical = HEALTH_VERTICALS.find(v => v.name === topic);
    return vertical?.pillar || 'core';
  }

  /**
   * Generate reasoning for strategy choice
   */
  private generateReasoning(
    topic: string,
    format: 'single' | 'thread',
    complexity: 'low' | 'medium' | 'high',
    predictedLength: number,
    context: StrategyContext
  ): string {
    const reasons = [];
    
    if (context.recentTopics.includes(topic)) {
      reasons.push('exploring less-used topic');
    } else if (context.performanceData[topic]) {
      reasons.push(`proven performer (${context.performanceData[topic].toFixed(1)} avg engagement)`);
    }
    
    if (format === 'thread') {
      if (complexity === 'high') {
        reasons.push('complex topic requires detailed explanation');
      } else if (predictedLength > 280) {
        reasons.push('content too long for single tweet');
      }
    }
    
    if (context.trendingEntities.includes(topic)) {
      reasons.push('trending topic');
    }
    
    reasons.push(`${context.timeOfDay} timing`);
    
    return reasons.join(', ');
  }

  /**
   * Get recent topics to avoid repetition
   */
  private async getRecentTopics(): Promise<string[]> {
    try {
      const { data } = await this.supabase
        .from('posts')
        .select('topic')
        .order('created_at', { ascending: false })
        .limit(10);

      return data ? data.map((post: any) => post.topic).filter(Boolean) : [];
    } catch (error) {
      console.warn('⚠️ Could not fetch recent topics');
      return [];
    }
  }

  /**
   * Get trending entities from Redis
   */
  private async getTrendingEntities(): Promise<string[]> {
    try {
      const trendingKeys = await this.redis.keys('topic:ctr:*');
      
      if (trendingKeys.length === 0) return [];
      
      // Get CTRs for trending topics
      const pipeline = this.redis.pipeline();
      trendingKeys.forEach(key => pipeline.get(key));
      const results = await pipeline.exec();
      
      if (!results) return [];
      
      // Extract topics with CTR data
      const topicsWithCTR = trendingKeys.map((key, index) => ({
        topic: key.replace('topic:ctr:', ''),
        ctr: parseFloat(results[index][1] as string) || 0
      }));
      
      // Sort by CTR and return top performers
      return topicsWithCTR
        .sort((a, b) => b.ctr - a.ctr)
        .slice(0, 5)
        .map(item => item.topic);
        
    } catch (error) {
      console.warn('⚠️ Could not fetch trending entities from Redis');
      return [];
    }
  }

  /**
   * Get performance data for topics
   */
  private async getPerformanceData(): Promise<Record<string, number>> {
    try {
      const { data } = await this.supabase
        .from('posts')
        .select('topic, likes, reposts, replies')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data) return {};
      
      // Calculate average engagement by topic
      const topicPerformance: Record<string, { total: number; count: number }> = {};
      
      data.forEach((post: any) => {
        if (!post.topic) return;
        
        const engagement = (post.likes || 0) + (post.reposts || 0) + (post.replies || 0);
        
        if (!topicPerformance[post.topic]) {
          topicPerformance[post.topic] = { total: 0, count: 0 };
        }
        
        topicPerformance[post.topic].total += engagement;
        topicPerformance[post.topic].count += 1;
      });
      
      // Calculate averages
      const averages: Record<string, number> = {};
      Object.entries(topicPerformance).forEach(([topic, stats]) => {
        averages[topic] = stats.total / stats.count;
      });
      
      return averages;
      
    } catch (error) {
      console.warn('⚠️ Could not fetch performance data');
      return {};
    }
  }

  /**
   * Get time of day category
   */
  private getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Update strategy performance after posting
   */
  async updateStrategyPerformance(
    strategy: ContentStrategy,
    engagement: { likes: number; reposts: number; replies: number }
  ): Promise<void> {
    try {
      const totalEngagement = engagement.likes + engagement.reposts + engagement.replies;
      
      // Update topic CTR in Redis
      const topicKey = `topic:ctr:${strategy.topic}`;
      await this.updateMovingAverage(topicKey, totalEngagement);
      
      // Update format CTR
      const formatKey = `format:ctr:${strategy.format}`;
      await this.updateMovingAverage(formatKey, totalEngagement);
      
      // Update pillar performance
      const pillarKey = `pillar:ctr:${strategy.pillar}`;
      await this.updateMovingAverage(pillarKey, totalEngagement);
      
      console.log(`📊 STRATEGY_PERFORMANCE: Updated ${strategy.topic} with ${totalEngagement} engagement`);
      
    } catch (error) {
      console.warn('⚠️ Could not update strategy performance:', error);
    }
  }

  /**
   * Update exponentially weighted moving average in Redis
   */
  private async updateMovingAverage(key: string, newValue: number): Promise<void> {
    const alpha = 0.1; // Learning rate
    
    const currentValue = await this.redis.get(key);
    const current = currentValue ? parseFloat(currentValue) : newValue;
    
    const updated = current * (1 - alpha) + newValue * alpha;
    
    await this.redis.setex(key, 7 * 24 * 60 * 60, updated.toString()); // 7 day expiry
  }
}

export default ContentStrategist;
