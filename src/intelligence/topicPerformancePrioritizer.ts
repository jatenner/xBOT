/**
 * 📊 TOPIC PERFORMANCE PRIORITIZER
 * Analyzes engagement by topic and weights future content generation
 * towards top-performing themes for maximum follower growth
 */

import { supabaseClient } from '../utils/supabaseClient';
import { SmartModelSelector } from '../utils/smartModelSelector';

export interface TopicPerformance {
  topicName: string;
  category: string;
  totalPosts: number;
  avgLikes: number;
  avgImpressions: number;
  avgReplies: number;
  avgRetweets: number;
  engagementRate: number;
  followerGainCorrelation: number;
  viralPotentialScore: number;
  contentSaturationLevel: number;
  trendingMomentum: number;
  priorityWeight: number;
  confidence: number;
}

export interface TopicStrategy {
  priorityTopics: TopicPerformance[];
  emergingTopics: TopicPerformance[];
  saturatedTopics: TopicPerformance[];
  contentDistribution: { [category: string]: number };
  lastUpdated: Date;
  nextUpdate: Date;
}

export class TopicPerformancePrioritizer {
  private static instance: TopicPerformancePrioritizer;
  
  static getInstance(): TopicPerformancePrioritizer {
    if (!this.instance) {
      this.instance = new TopicPerformancePrioritizer();
    }
    return this.instance;
  }

  private static readonly MIN_POSTS_FOR_ANALYSIS = 2;
  private static readonly VIRAL_THRESHOLD = 100; // likes threshold for viral content
  private static readonly SATURATION_THRESHOLD = 0.8;
  private static readonly UPDATE_INTERVAL_HOURS = 24;

  /**
   * 📈 ANALYZE TOPIC PERFORMANCE FROM HISTORICAL DATA
   */
  static async analyzeTopicPerformance(): Promise<TopicPerformance[]> {
    try {
      console.log('📊 === ANALYZING TOPIC PERFORMANCE ===');

      if (!supabaseClient.supabase) {
        throw new Error('Supabase client not available');
      }

      // First, update topic analytics from recent tweets
      await this.updateTopicAnalytics();

      // Get analyzed topic data
      const { data: topicData, error } = await supabaseClient.supabase
        .from('topic_performance_analytics')
        .select('*')
        .gte('total_posts', this.MIN_POSTS_FOR_ANALYSIS)
        .order('priority_weight', { ascending: false });

      if (error) throw error;

      const topics: TopicPerformance[] = topicData?.map(topic => ({
        topicName: topic.topic_name,
        category: topic.topic_category,
        totalPosts: topic.total_posts || 0,
        avgLikes: topic.avg_likes || 0,
        avgImpressions: topic.avg_impressions || 0,
        avgReplies: topic.avg_replies || 0,
        avgRetweets: topic.avg_retweets || 0,
        engagementRate: topic.engagement_rate || 0,
        followerGainCorrelation: topic.follower_gain_correlation || 0,
        viralPotentialScore: topic.viral_potential_score || 0,
        contentSaturationLevel: topic.content_saturation_level || 0,
        trendingMomentum: topic.trending_momentum || 0,
        priorityWeight: topic.priority_weight || 0.5,
        confidence: Math.min(topic.total_posts / 10, 1.0)
      })) || [];

      console.log(`📈 Analyzed ${topics.length} topics with performance data`);
      return topics;

    } catch (error) {
      console.error('❌ Error analyzing topic performance:', error);
      return this.getDefaultTopics();
    }
  }

  /**
   * 🔄 UPDATE TOPIC ANALYTICS FROM RECENT TWEETS
   */
  static async updateTopicAnalytics(): Promise<void> {
    try {
      console.log('🔄 === UPDATING TOPIC ANALYTICS ===');

      if (!supabaseClient.supabase) {
        throw new Error('Supabase client not available');
      }

      // Get recent tweets with performance data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: tweets, error: tweetsError } = await supabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('likes', 'is', null)
        .not('impressions', 'is', null);

      if (tweetsError) throw tweetsError;

      if (!tweets || tweets.length === 0) {
        console.log('⚠️ No recent tweets found for topic analysis');
        return;
      }

      console.log(`📊 Processing ${tweets.length} tweets for topic analysis`);

      // Extract topics using AI-based categorization
      const topicMap = new Map<string, {
        category: string;
        tweets: any[];
        totalLikes: number;
        totalImpressions: number;
        totalReplies: number;
        totalRetweets: number;
        viralCount: number;
      }>();

      // Process each tweet to extract topics
      for (const tweet of tweets) {
        // Skip tweets with missing or invalid text
        if (!tweet?.text || typeof tweet.text !== 'string') {
          console.warn('⚠️ Skipping tweet with invalid text:', tweet?.id || 'unknown');
          continue;
        }

        const topics = await this.extractTopicsFromTweet(tweet.text);
        
        for (const topicData of topics) {
          const key = topicData.topic.toLowerCase();
          
          if (!topicMap.has(key)) {
            topicMap.set(key, {
              category: topicData.category,
              tweets: [],
              totalLikes: 0,
              totalImpressions: 0,
              totalReplies: 0,
              totalRetweets: 0,
              viralCount: 0
            });
          }

          const topic = topicMap.get(key)!;
          topic.tweets.push(tweet);
          topic.totalLikes += tweet.likes || 0;
          topic.totalImpressions += tweet.impressions || 0;
          topic.totalReplies += tweet.replies || 0;
          topic.totalRetweets += tweet.retweets || 0;
          
          if ((tweet.likes || 0) >= this.VIRAL_THRESHOLD) {
            topic.viralCount++;
          }
        }
      }

      // Update analytics for each topic
      for (const [topicName, data] of topicMap) {
        const avgLikes = data.totalLikes / data.tweets.length;
        const avgImpressions = data.totalImpressions / data.tweets.length;
        const avgReplies = data.totalReplies / data.tweets.length;
        const avgRetweets = data.totalRetweets / data.tweets.length;
        
        // Calculate engagement rate
        const engagementRate = avgImpressions > 0 
          ? (avgLikes + avgReplies + avgRetweets) / avgImpressions 
          : 0;

        // Calculate viral potential score
        const viralPotentialScore = (data.viralCount / data.tweets.length) * 10;

        // Calculate content saturation (how often we post about this topic)
        const totalRecentTweets = tweets.length;
        const contentSaturationLevel = data.tweets.length / totalRecentTweets;

        // Calculate trending momentum (recent performance vs historical)
        const trendingMomentum = await this.calculateTrendingMomentum(topicName, engagementRate);

        // Calculate priority weight (composite score)
        const priorityWeight = this.calculatePriorityWeight({
          engagementRate,
          viralPotentialScore,
          contentSaturationLevel,
          trendingMomentum,
          avgLikes
        });

        // Upsert the analytics
        const { error: upsertError } = await supabaseClient.supabase
          .from('topic_performance_analytics')
          .upsert({
            topic_name: topicName,
            topic_category: data.category,
            total_posts: data.tweets.length,
            avg_likes: avgLikes,
            avg_impressions: avgImpressions,
            avg_replies: avgReplies,
            avg_retweets: avgRetweets,
            engagement_rate: engagementRate,
            viral_potential_score: viralPotentialScore,
            content_saturation_level: contentSaturationLevel,
            trending_momentum: trendingMomentum,
            priority_weight: priorityWeight,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'topic_name'
          });

        if (upsertError) {
          console.error(`❌ Error updating topic ${topicName}:`, upsertError);
        } else {
          console.log(`✅ Updated topic "${topicName}" - Priority: ${priorityWeight.toFixed(3)}, Viral: ${viralPotentialScore.toFixed(1)}`);
        }
      }

      console.log('✅ Topic analytics updated successfully');

    } catch (error) {
      console.error('❌ Error updating topic analytics:', error);
    }
  }

  /**
   * 🤖 EXTRACT TOPICS FROM TWEET USING AI
   */
  private static async extractTopicsFromTweet(tweetText: string): Promise<Array<{topic: string, category: string}>> {
    try {
      // Check if tweetText is valid
      if (!tweetText || typeof tweetText !== 'string') {
        console.warn('⚠️ Invalid tweet text provided for topic extraction:', tweetText);
        return [{ topic: 'general_health', category: 'health' }];
      }

      // Simplified topic extraction based on health keywords
      const healthKeywords = {
        'gut_health': ['gut', 'microbiome', 'digestive', 'probiotics', 'fiber'],
        'immune_system': ['immune', 'immunity', 'defense', 'antibodies', 'vitamin d'],
        'nutrition_myths': ['myth', 'truth', 'fact', 'believe', 'actually'],
        'exercise_science': ['exercise', 'workout', 'fitness', 'muscle', 'cardio'],
        'mental_health': ['mental', 'stress', 'anxiety', 'depression', 'mood'],
        'sleep_optimization': ['sleep', 'rest', 'recovery', 'insomnia', 'circadian'],
        'supplements': ['supplement', 'vitamin', 'mineral', 'pill', 'dose'],
        'longevity': ['longevity', 'aging', 'lifespan', 'telomeres', 'senescence'],
        'biohacking': ['biohack', 'optimization', 'performance', 'enhancement'],
        'hydration': ['water', 'hydration', 'dehydration', 'electrolytes']
      };

      const text = tweetText.toLowerCase();
      const foundTopics: Array<{topic: string, category: string}> = [];

      for (const [topic, keywords] of Object.entries(healthKeywords)) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            const category = this.getCategoryForTopic(topic);
            foundTopics.push({ topic, category });
            break; // One match per topic is enough
          }
        }
      }

      // If no topics found, classify as general health
      if (foundTopics.length === 0) {
        foundTopics.push({ topic: 'general_health', category: 'health' });
      }

      return foundTopics;

    } catch (error) {
      console.error('❌ Error extracting topics:', error);
      return [{ topic: 'general_health', category: 'health' }];
    }
  }

  /**
   * 📈 CALCULATE TRENDING MOMENTUM
   */
  private static async calculateTrendingMomentum(topicName: string, currentEngagementRate: number): Promise<number> {
    try {
      if (!supabaseClient.supabase) return 0;

      // Get historical engagement rate for this topic
      const { data: historical, error } = await supabaseClient.supabase
        .from('topic_performance_analytics')
        .select('engagement_rate')
        .eq('topic_name', topicName)
        .single();

      if (error || !historical) return 5.0; // Neutral momentum for new topics

      const historicalRate = historical.engagement_rate || 0;
      
      // Calculate momentum as percentage change
      if (historicalRate === 0) return 5.0;
      
      const momentum = ((currentEngagementRate - historicalRate) / historicalRate) * 10 + 5;
      return Math.max(0, Math.min(10, momentum)); // Clamp between 0-10

    } catch (error) {
      console.error('❌ Error calculating trending momentum:', error);
      return 5.0; // Neutral momentum
    }
  }

  /**
   * 🎯 CALCULATE PRIORITY WEIGHT
   */
  private static calculatePriorityWeight(metrics: {
    engagementRate: number;
    viralPotentialScore: number;
    contentSaturationLevel: number;
    trendingMomentum: number;
    avgLikes: number;
  }): number {
    const {
      engagementRate,
      viralPotentialScore,
      contentSaturationLevel,
      trendingMomentum,
      avgLikes
    } = metrics;

    // Normalize metrics to 0-1 scale
    const normalizedEngagement = Math.min(engagementRate * 20, 1); // 5% engagement = 1.0
    const normalizedViral = viralPotentialScore / 10;
    const saturationPenalty = Math.max(0, 1 - (contentSaturationLevel * 2)); // Penalty for oversaturation
    const normalizedMomentum = trendingMomentum / 10;
    const normalizedLikes = Math.min(avgLikes / 100, 1); // 100 likes = 1.0

    // Weighted combination
    const priorityWeight = (
      normalizedEngagement * 0.3 +
      normalizedViral * 0.25 +
      saturationPenalty * 0.2 +
      normalizedMomentum * 0.15 +
      normalizedLikes * 0.1
    );

    return Math.max(0.1, Math.min(1.0, priorityWeight));
  }

  /**
   * 🎯 GENERATE TOPIC STRATEGY
   */
  static async generateTopicStrategy(): Promise<TopicStrategy> {
    try {
      console.log('🧠 === GENERATING TOPIC STRATEGY ===');

      const topics = await this.analyzeTopicPerformance();

      if (topics.length === 0) {
        return this.getDefaultStrategy();
      }

      // Sort by priority weight
      const sortedTopics = topics.sort((a, b) => b.priorityWeight - a.priorityWeight);

      // Categorize topics
      const priorityTopics = sortedTopics
        .filter(t => t.priorityWeight >= 0.7 && t.contentSaturationLevel < this.SATURATION_THRESHOLD)
        .slice(0, 8);

      const emergingTopics = sortedTopics
        .filter(t => t.trendingMomentum >= 6.0 && t.totalPosts < 5)
        .slice(0, 5);

      const saturatedTopics = sortedTopics
        .filter(t => t.contentSaturationLevel >= this.SATURATION_THRESHOLD)
        .slice(0, 3);

      // Calculate content distribution by category
      const contentDistribution: { [category: string]: number } = {};
      const totalWeight = priorityTopics.reduce((sum, t) => sum + t.priorityWeight, 0);
      
      priorityTopics.forEach(topic => {
        const category = topic.category;
        if (!contentDistribution[category]) {
          contentDistribution[category] = 0;
        }
        contentDistribution[category] += topic.priorityWeight / totalWeight;
      });

      const strategy: TopicStrategy = {
        priorityTopics,
        emergingTopics,
        saturatedTopics,
        contentDistribution,
        lastUpdated: new Date(),
        nextUpdate: new Date(Date.now() + (this.UPDATE_INTERVAL_HOURS * 60 * 60 * 1000))
      };

      console.log(`✅ Generated strategy with ${priorityTopics.length} priority topics`);
      console.log(`🏆 Top topic: "${priorityTopics[0]?.topicName}" (weight: ${priorityTopics[0]?.priorityWeight.toFixed(3)})`);

      return strategy;

    } catch (error) {
      console.error('❌ Error generating topic strategy:', error);
      return this.getDefaultStrategy();
    }
  }

  /**
   * 🎲 GET WEIGHTED RANDOM TOPIC
   */
  static async getWeightedRandomTopic(): Promise<TopicPerformance | null> {
    try {
      const strategy = await this.generateTopicStrategy();
      
      if (strategy.priorityTopics.length === 0) {
        return null;
      }

      // Weighted random selection
      const totalWeight = strategy.priorityTopics.reduce((sum, topic) => sum + topic.priorityWeight, 0);
      let random = Math.random() * totalWeight;

      for (const topic of strategy.priorityTopics) {
        random -= topic.priorityWeight;
        if (random <= 0) {
          return topic;
        }
      }

      // Fallback to first topic
      return strategy.priorityTopics[0];

    } catch (error) {
      console.error('❌ Error getting weighted random topic:', error);
      return null;
    }
  }

  /**
   * 📊 GET CONTENT DISTRIBUTION RECOMMENDATIONS
   */
  static async getContentDistribution(): Promise<{ [category: string]: number }> {
    try {
      const strategy = await this.generateTopicStrategy();
      return strategy.contentDistribution;
    } catch (error) {
      console.error('❌ Error getting content distribution:', error);
      return this.getDefaultDistribution();
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static getCategoryForTopic(topic: string): string {
    const categoryMap: { [key: string]: string } = {
      'gut_health': 'health',
      'immune_system': 'health',
      'nutrition_myths': 'health',
      'exercise_science': 'fitness',
      'mental_health': 'wellness',
      'sleep_optimization': 'wellness',
      'supplements': 'health',
      'longevity': 'health',
      'biohacking': 'wellness',
      'hydration': 'health'
    };
    return categoryMap[topic] || 'health';
  }

  private static getDefaultTopics(): TopicPerformance[] {
    return [
      {
        topicName: 'gut_health',
        category: 'health',
        totalPosts: 5,
        avgLikes: 45,
        avgImpressions: 1200,
        avgReplies: 3,
        avgRetweets: 8,
        engagementRate: 0.048,
        followerGainCorrelation: 0.75,
        viralPotentialScore: 7.5,
        contentSaturationLevel: 0.2,
        trendingMomentum: 6.8,
        priorityWeight: 0.8,
        confidence: 0.5
      },
      {
        topicName: 'immune_system',
        category: 'health',
        totalPosts: 4,
        avgLikes: 38,
        avgImpressions: 1100,
        avgReplies: 2,
        avgRetweets: 6,
        engagementRate: 0.042,
        followerGainCorrelation: 0.68,
        viralPotentialScore: 6.8,
        contentSaturationLevel: 0.15,
        trendingMomentum: 6.2,
        priorityWeight: 0.75,
        confidence: 0.4
      }
    ];
  }

  private static getDefaultStrategy(): TopicStrategy {
    const defaultTopics = this.getDefaultTopics();
    return {
      priorityTopics: defaultTopics,
      emergingTopics: [],
      saturatedTopics: [],
      contentDistribution: { health: 0.8, wellness: 0.2 },
      lastUpdated: new Date(),
      nextUpdate: new Date(Date.now() + (this.UPDATE_INTERVAL_HOURS * 60 * 60 * 1000))
    };
  }

  private static getDefaultDistribution(): { [category: string]: number } {
    return { health: 0.7, wellness: 0.2, fitness: 0.1 };
  }
} 