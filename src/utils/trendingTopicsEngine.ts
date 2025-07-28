/**
 * 🔥 REAL-TIME TRENDING TOPICS ENGINE
 * 
 * Fetches trending health topics, hashtags, and keywords to inject into prompts
 * for timely, reactive content generation that rides trending waves.
 */

import { supabaseClient } from './supabaseClient';
import { emergencyBudgetLockdown } from './emergencyBudgetLockdown';
import { OpenAI } from 'openai';

interface TrendingTopic {
  keyword: string;
  category: 'health' | 'wellness' | 'nutrition' | 'fitness' | 'mental_health';
  popularity_score: number;
  hashtag?: string;
  context?: string;
  source: 'twitter' | 'google' | 'news' | 'mock';
  last_updated: string;
}

interface TrendContext {
  primaryTrend: TrendingTopic;
  secondaryTrend?: TrendingTopic;
  hashtags: string[];
  contextualPrompt: string;
}

export class TrendingTopicsEngine {
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private static readonly MAX_TRENDS = 10;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private static trendCache: TrendingTopic[] = [];
  private static lastCacheUpdate = 0;

  /**
   * 🎯 GET TRENDING TOPICS FOR PROMPT INJECTION
   */
  static async getTrendingContext(): Promise<TrendContext> {
    try {
      const trends = await this.fetchTrendingTopics();
      
      if (trends.length === 0) {
        return this.getFallbackContext();
      }

      // Select primary and secondary trends
      const primaryTrend = trends[0];
      const secondaryTrend = trends.length > 1 ? trends[1] : undefined;

      // Extract hashtags
      const hashtags = trends
        .filter(t => t.hashtag)
        .map(t => t.hashtag!)
        .slice(0, 3);

      // Build contextual prompt
      const contextualPrompt = this.buildTrendingPrompt(primaryTrend, secondaryTrend);

      console.log(`🔥 Trending context: Primary "${primaryTrend.keyword}", Secondary "${secondaryTrend?.keyword || 'none'}"`);

      return {
        primaryTrend,
        secondaryTrend,
        hashtags,
        contextualPrompt
      };

    } catch (error) {
      console.error('❌ Failed to get trending context:', error);
      return this.getFallbackContext();
    }
  }

  /**
   * 📊 FETCH TRENDING TOPICS (With Mock Data)
   */
  private static async fetchTrendingTopics(): Promise<TrendingTopic[]> {
    // Check cache first
    if (this.isCacheValid()) {
      console.log('📋 Using cached trending topics');
      return this.trendCache;
    }

    try {
      // Try to fetch from database first
      const dbTrends = await this.fetchFromDatabase();
      if (dbTrends.length > 0) {
        this.updateCache(dbTrends);
        return dbTrends;
      }

      // Fallback to mock trending data (realistic health trends)
      const mockTrends = await this.generateMockTrends();
      this.updateCache(mockTrends);
      return mockTrends;

    } catch (error) {
      console.error('❌ Failed to fetch trends:', error);
      return this.generateBasicTrends();
    }
  }

  /**
   * 🏥 GENERATE REALISTIC MOCK TRENDS
   */
  private static async generateMockTrends(): Promise<TrendingTopic[]> {
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // Time-based trending topics
    const timeBasedTrends = {
      morning: ['intermittent fasting', 'morning routine', 'coffee benefits', 'workout motivation'],
      afternoon: ['productivity hacks', 'healthy lunch', 'stress management', 'hydration'],
      evening: ['sleep optimization', 'recovery', 'meal prep', 'wind down routine']
    };

    // Day-based trends
    const dayBasedTrends = {
      monday: ['motivation', 'goal setting', 'meal prep'],
      friday: ['weekend wellness', 'recovery', 'social health'],
      weekend: ['outdoor fitness', 'relaxation', 'family health']
    };

    const baseTrends: Omit<TrendingTopic, 'last_updated'>[] = [
      {
        keyword: 'ozempic alternatives',
        category: 'wellness',
        popularity_score: 95,
        hashtag: '#OzempicAlternatives',
        context: 'Natural weight loss solutions trending',
        source: 'mock'
      },
      {
        keyword: 'cold plunge therapy',
        category: 'wellness',
        popularity_score: 88,
        hashtag: '#ColdTherapy',
        context: 'Ice bath benefits and protocols',
        source: 'mock'
      },
      {
        keyword: 'microplastics detox',
        category: 'health',
        popularity_score: 82,
        hashtag: '#MicroplasticsDetox',
        context: 'Environmental health concerns',
        source: 'mock'
      },
      {
        keyword: 'glucose monitoring',
        category: 'health',
        popularity_score: 79,
        hashtag: '#GlucoseHealth',
        context: 'Continuous glucose monitoring for non-diabetics',
        source: 'mock'
      },
      {
        keyword: 'red light therapy',
        category: 'wellness',
        popularity_score: 76,
        hashtag: '#RedLightTherapy',
        context: 'Photobiomodulation benefits',
        source: 'mock'
      },
      {
        keyword: 'longevity supplements',
        category: 'nutrition',
        popularity_score: 74,
        hashtag: '#Longevity',
        context: 'Anti-aging supplement protocols',
        source: 'mock'
      },
      {
        keyword: 'breathwork techniques',
        category: 'mental_health',
        popularity_score: 71,
        hashtag: '#Breathwork',
        context: 'Breathing exercises for stress and performance',
        source: 'mock'
      },
      {
        keyword: 'functional medicine',
        category: 'health',
        popularity_score: 68,
        hashtag: '#FunctionalMedicine',
        context: 'Root cause approach to health',
        source: 'mock'
      }
    ];

    // Add time-based boost
    const timeCategory = currentHour < 10 ? 'morning' : currentHour < 16 ? 'afternoon' : 'evening';
    const boostedKeywords = timeBasedTrends[timeCategory];

    const trends = baseTrends.map(trend => ({
      ...trend,
      popularity_score: boostedKeywords.some(keyword => 
        trend.keyword.includes(keyword.toLowerCase())
      ) ? trend.popularity_score + 10 : trend.popularity_score,
      last_updated: new Date().toISOString()
    }));

    // Sort by popularity and return top trends
    return trends
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, this.MAX_TRENDS);
  }

  /**
   * 💾 FETCH FROM DATABASE
   */
  private static async fetchFromDatabase(): Promise<TrendingTopic[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('trending_topics')
        .select('*')
        .gte('last_updated', new Date(Date.now() - this.CACHE_DURATION).toISOString())
        .order('popularity_score', { ascending: false })
        .limit(this.MAX_TRENDS);

      if (error) {
        console.error('❌ Database fetch failed:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Database query failed:', error);
      return [];
    }
  }

  /**
   * 📝 BUILD TRENDING PROMPT
   */
  private static buildTrendingPrompt(
    primaryTrend: TrendingTopic, 
    secondaryTrend?: TrendingTopic
  ): string {
    let prompt = `TRENDING CONTEXT: "${primaryTrend.keyword}" is highly trending in ${primaryTrend.category}`;
    
    if (primaryTrend.context) {
      prompt += ` (${primaryTrend.context})`;
    }

    if (secondaryTrend) {
      prompt += `. Secondary trend: "${secondaryTrend.keyword}" in ${secondaryTrend.category}`;
    }

    prompt += '. Incorporate these trending topics naturally into your content to maximize relevance and engagement.';

    return prompt;
  }

  /**
   * 🔄 CACHE MANAGEMENT
   */
  private static isCacheValid(): boolean {
    return this.trendCache.length > 0 && 
           (Date.now() - this.lastCacheUpdate) < this.CACHE_DURATION;
  }

  private static updateCache(trends: TrendingTopic[]): void {
    this.trendCache = trends;
    this.lastCacheUpdate = Date.now();
  }

  /**
   * 🚨 FALLBACK CONTEXT
   */
  private static getFallbackContext(): TrendContext {
    const fallbackTrend: TrendingTopic = {
      keyword: 'evidence-based health',
      category: 'health',
      popularity_score: 50,
      hashtag: '#EvidenceBased',
      context: 'Science-backed health information',
      source: 'mock',
      last_updated: new Date().toISOString()
    };

    return {
      primaryTrend: fallbackTrend,
      hashtags: ['#Health', '#Wellness'],
      contextualPrompt: 'Focus on evidence-based, scientifically-backed health content that provides real value.'
    };
  }

  /**
   * 🔧 GENERATE BASIC TRENDS
   */
  private static generateBasicTrends(): TrendingTopic[] {
    return [
      {
        keyword: 'health optimization',
        category: 'health',
        popularity_score: 60,
        source: 'mock',
        last_updated: new Date().toISOString()
      },
      {
        keyword: 'wellness tips',
        category: 'wellness',
        popularity_score: 55,
        source: 'mock',
        last_updated: new Date().toISOString()
      }
    ];
  }

  /**
   * 💾 SAVE TRENDS TO DATABASE
   */
  static async saveTrendsToDatabase(trends: TrendingTopic[]): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('trending_topics')
        .upsert(trends, { 
          onConflict: 'keyword',
          ignoreDuplicates: false 
        });

      console.log(`💾 Saved ${trends.length} trending topics to database`);
    } catch (error) {
      console.error('❌ Failed to save trends:', error);
    }
  }

  /**
   * 📊 GET TREND ANALYTICS
   */
  static async getTrendAnalytics(): Promise<{
    totalTrends: number;
    topCategories: { category: string; count: number }[];
    averagePopularity: number;
    lastUpdate: string;
  }> {
    try {
      const trends = await this.fetchTrendingTopics();
      
      const categoryCount = trends.reduce((acc, trend) => {
        acc[trend.category] = (acc[trend.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      const averagePopularity = trends.reduce((sum, trend) => 
        sum + trend.popularity_score, 0) / trends.length;

      return {
        totalTrends: trends.length,
        topCategories,
        averagePopularity,
        lastUpdate: trends[0]?.last_updated || new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get trend analytics:', error);
      return {
        totalTrends: 0,
        topCategories: [],
        averagePopularity: 0,
        lastUpdate: new Date().toISOString()
      };
    }
  }
}

export const trendingTopicsEngine = TrendingTopicsEngine; 