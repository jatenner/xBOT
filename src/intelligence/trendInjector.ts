/**
 * 📰 TREND INJECTOR
 * Captures trending health topics and intelligently weaves them into content
 * Integrates with existing Guardian News and IntelligentGrowthMaster
 */

import { supabaseClient } from '../utils/supabaseClient';

export interface TrendingTopic {
  keyword: string;
  source: 'twitter' | 'guardian' | 'manual';
  category: 'health' | 'nutrition' | 'fitness' | 'science';
  trendScore: number;
  volume: number;
  sentiment: number; // -1 to 1
  fetchedAt: Date;
  expiresAt: Date;
}

export interface ContentInjection {
  originalContent: string;
  enhancedContent: string;
  injectedKeywords: string[];
  injectionStrategy: 'hook_integration' | 'natural_weave' | 'supporting_point' | 'cta_addition';
  confidenceScore: number;
}

export class TrendInjector {
  private static instance: TrendInjector;
  private trendCache: Map<string, TrendingTopic> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  private cacheExpiryMinutes: number = 30;

  private constructor() {
    this.refreshTrendCache();
  }

  static getInstance(): TrendInjector {
    if (!TrendInjector.instance) {
      TrendInjector.instance = new TrendInjector();
    }
    return TrendInjector.instance;
  }

  /**
   * 🚀 Enhance content with trending topics
   */
  async enhanceWithTrends(content: string, contentType: 'hook' | 'thread' | 'single'): Promise<ContentInjection> {
    try {
      await this.ensureFreshTrends();
      
      const relevantTrends = await this.getRelevantTrends(content);
      
      if (relevantTrends.length === 0) {
        return {
          originalContent: content,
          enhancedContent: content,
          injectedKeywords: [],
          injectionStrategy: 'natural_weave',
          confidenceScore: 1.0
        };
      }

      // Select best trend for injection
      const selectedTrend = this.selectOptimalTrend(relevantTrends, contentType);
      
      // Inject trend into content
      const injection = await this.injectTrendIntoContent(content, selectedTrend, contentType);
      
      console.log(`📰 Injected trending topic "${selectedTrend.keyword}" into content (strategy: ${injection.injectionStrategy})`);
      
      return injection;
      
    } catch (error) {
      console.error('❌ Error enhancing content with trends:', error);
      return {
        originalContent: content,
        enhancedContent: content,
        injectedKeywords: [],
        injectionStrategy: 'natural_weave',
        confidenceScore: 0.0
      };
    }
  }

  /**
   * 📊 Refresh trend cache from multiple sources
   */
  async refreshTrendCache(): Promise<void> {
    try {
      console.log('📰 Refreshing trend cache...');
      
      const trends: TrendingTopic[] = [];
      
      // Get trends from Guardian API (existing integration)
      const guardianTrends = await this.fetchGuardianTrends();
      trends.push(...guardianTrends);
      
      // Get manual trending topics from database
      const manualTrends = await this.fetchManualTrends();
      trends.push(...manualTrends);
      
      // Update cache
      this.trendCache.clear();
      trends.forEach(trend => {
        this.trendCache.set(trend.keyword.toLowerCase(), trend);
      });
      
      // Store in database
      await this.storeTrendsInDatabase(trends);
      
      this.lastCacheUpdate = new Date();
      console.log(`📰 Refreshed ${trends.length} trending topics`);
      
    } catch (error) {
      console.error('❌ Error refreshing trend cache:', error);
    }
  }

  /**
   * 📰 Fetch trending topics from Guardian API
   */
  private async fetchGuardianTrends(): Promise<TrendingTopic[]> {
    try {
      // This integrates with your existing Guardian News system
      try {
        const { GuardianNewsIntegration } = await import('../utils/guardianNewsIntegration');
        const guardian = GuardianNewsIntegration.getInstance();
        const articles = await guardian.getHealthNews();
        return this.extractTrendsFromArticles(articles);
      } catch (error) {
        console.warn('⚠️ Guardian News Integration not available, using fallback trends');
        return this.getFallbackTrends();
      }
      
    } catch (error) {
      console.warn('⚠️ Could not fetch Guardian trends:', error);
      return [];
    }
  }

  /**
   * 📰 Extract trends from Guardian articles
   */
  private extractTrendsFromArticles(articles: any[]): TrendingTopic[] {
    const trends: TrendingTopic[] = [];
    
    articles.forEach(article => {
      // Extract keywords from headlines and content
      const keywords = this.extractKeywordsFromText(article.headline + ' ' + article.summary);
      
      keywords.forEach(keyword => {
        trends.push({
          keyword,
          source: 'guardian',
          category: this.categorizeKeyword(keyword),
          trendScore: 0.7, // Guardian articles are generally high quality
          volume: 1,
          sentiment: 0.1, // Slightly positive for health content
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
        });
      });
    });
    
    return trends;
  }

  /**
   * 📰 Fallback trends when Guardian not available
   */
  private getFallbackTrends(): TrendingTopic[] {
    const fallbackKeywords = [
      'vitamin d', 'omega-3', 'protein', 'sleep optimization',
      'gut health', 'inflammation', 'metabolism', 'mental health'
    ];
    
    return fallbackKeywords.map(keyword => ({
      keyword,
      source: 'manual' as const,
      category: this.categorizeKeyword(keyword),
      trendScore: 0.5,
      volume: 1,
      sentiment: 0.0,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
    }));
  }

  /**
   * 📊 Fetch manual trending topics from database
   */
  private async fetchManualTrends(): Promise<TrendingTopic[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('trending_topics')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('trend_score', { ascending: false });
      
      if (error) {
        console.warn('⚠️ Could not fetch manual trends:', error);
        return [];
      }
      
      return (data || []).map(row => ({
        keyword: row.keyword,
        source: row.source as any,
        category: row.category as any,
        trendScore: row.trend_score,
        volume: row.volume,
        sentiment: row.sentiment,
        fetchedAt: new Date(row.fetched_at),
        expiresAt: new Date(row.expires_at)
      }));
      
    } catch (error) {
      console.warn('⚠️ Error fetching manual trends:', error);
      return [];
    }
  }

  /**
   * 🎯 Get relevant trends for content
   */
  private async getRelevantTrends(content: string): Promise<TrendingTopic[]> {
    const contentLower = content.toLowerCase();
    const relevantTrends: TrendingTopic[] = [];
    
    for (const trend of this.trendCache.values()) {
      // Check if trend is relevant to content
      const relevanceScore = this.calculateRelevanceScore(contentLower, trend);
      
      if (relevanceScore > 0.3) {
        relevantTrends.push(trend);
      }
    }
    
    // Sort by trend score and relevance
    return relevantTrends.sort((a, b) => b.trendScore - a.trendScore);
  }

  /**
   * 🧮 Calculate relevance score between content and trend
   */
  private calculateRelevanceScore(content: string, trend: TrendingTopic): number {
    let score = 0;
    
    // Direct keyword match
    if (content.includes(trend.keyword.toLowerCase())) {
      score += 0.8;
    }
    
    // Related terms (simple semantic matching)
    const relatedTerms = this.getRelatedTerms(trend.keyword);
    for (const term of relatedTerms) {
      if (content.includes(term.toLowerCase())) {
        score += 0.3;
        break;
      }
    }
    
    // Category relevance
    const contentCategories = this.extractContentCategories(content);
    if (contentCategories.includes(trend.category)) {
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * 🎯 Select optimal trend for injection
   */
  private selectOptimalTrend(trends: TrendingTopic[], contentType: string): TrendingTopic {
    // Weight by trend score, recency, and content type fit
    return trends.reduce((best, current) => {
      const currentScore = current.trendScore + (current.volume / 1000) + 
                          (contentType === 'hook' ? 0.2 : 0.1);
      const bestScore = best.trendScore + (best.volume / 1000) + 
                       (contentType === 'hook' ? 0.2 : 0.1);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * 💉 Inject trend into content
   */
  private async injectTrendIntoContent(
    content: string, 
    trend: TrendingTopic, 
    contentType: string
  ): Promise<ContentInjection> {
    try {
      let enhancedContent = content;
      let injectionStrategy: ContentInjection['injectionStrategy'] = 'natural_weave';
      let confidenceScore = 0.7;
      
      if (contentType === 'hook' && !content.toLowerCase().includes(trend.keyword.toLowerCase())) {
        // Hook integration - weave trend into opening
        if (content.includes('?')) {
          // Question hook - add trending context
          enhancedContent = content.replace(/\?/, `? (${trend.keyword} is trending)`);
          injectionStrategy = 'hook_integration';
          confidenceScore = 0.8;
        } else {
          // Statement hook - add trending prefix
          enhancedContent = `🔥 ${trend.keyword}: ${content}`;
          injectionStrategy = 'hook_integration';
          confidenceScore = 0.9;
        }
      } else if (contentType === 'thread') {
        // Thread integration - add as supporting point
        enhancedContent = content + `\n\nThis aligns with the trending discussion around ${trend.keyword}.`;
        injectionStrategy = 'supporting_point';
        confidenceScore = 0.6;
      } else if (contentType === 'single') {
        // Single tweet - natural weave
        enhancedContent = content.replace(
          /\.$/, 
          ` - part of the growing ${trend.keyword} conversation.`
        );
        injectionStrategy = 'natural_weave';
        confidenceScore = 0.5;
      }
      
      return {
        originalContent: content,
        enhancedContent,
        injectedKeywords: [trend.keyword],
        injectionStrategy,
        confidenceScore
      };
      
    } catch (error) {
      console.error('❌ Error injecting trend:', error);
      return {
        originalContent: content,
        enhancedContent: content,
        injectedKeywords: [],
        injectionStrategy: 'natural_weave',
        confidenceScore: 0.0
      };
    }
  }

  /**
   * 🔄 Helper methods
   */
  private async ensureFreshTrends(): Promise<void> {
    const minutesSinceUpdate = (Date.now() - this.lastCacheUpdate.getTime()) / (1000 * 60);
    if (minutesSinceUpdate > this.cacheExpiryMinutes) {
      await this.refreshTrendCache();
    }
  }

  private extractKeywordsFromText(text: string): string[] {
    // Simple keyword extraction (could be enhanced with NLP)
    const healthKeywords = [
      'vitamin d', 'omega-3', 'protein', 'fiber', 'antioxidants',
      'meditation', 'sleep', 'exercise', 'hydration', 'stress',
      'gut health', 'immune system', 'metabolism', 'inflammation',
      'mental health', 'nutrition', 'wellness', 'biohacking'
    ];
    
    const textLower = text.toLowerCase();
    return healthKeywords.filter(keyword => textLower.includes(keyword));
  }

  private categorizeKeyword(keyword: string): TrendingTopic['category'] {
    const nutritionTerms = ['vitamin', 'protein', 'fiber', 'omega', 'antioxidant'];
    const fitnessTerms = ['exercise', 'workout', 'training', 'strength'];
    const scienceTerms = ['study', 'research', 'clinical', 'evidence'];
    
    if (nutritionTerms.some(term => keyword.includes(term))) return 'nutrition';
    if (fitnessTerms.some(term => keyword.includes(term))) return 'fitness';
    if (scienceTerms.some(term => keyword.includes(term))) return 'science';
    return 'health';
  }

  private getRelatedTerms(keyword: string): string[] {
    const relatedMap: Record<string, string[]> = {
      'vitamin d': ['sunlight', 'deficiency', 'immune', 'bone health'],
      'omega-3': ['fish oil', 'dha', 'epa', 'inflammation'],
      'protein': ['amino acids', 'muscle', 'recovery', 'synthesis'],
      'sleep': ['melatonin', 'circadian', 'rem', 'recovery'],
      'exercise': ['fitness', 'workout', 'movement', 'training']
    };
    
    return relatedMap[keyword.toLowerCase()] || [];
  }

  private extractContentCategories(content: string): string[] {
    const categories: string[] = [];
    const contentLower = content.toLowerCase();
    
    if (/nutrition|food|diet|vitamin|supplement/.test(contentLower)) categories.push('nutrition');
    if (/exercise|workout|fitness|training|strength/.test(contentLower)) categories.push('fitness');
    if (/study|research|science|clinical|evidence/.test(contentLower)) categories.push('science');
    if (/health|wellness|wellbeing/.test(contentLower)) categories.push('health');
    
    return categories.length > 0 ? categories : ['health'];
  }

  private async storeTrendsInDatabase(trends: TrendingTopic[]): Promise<void> {
    try {
      const records = trends.map(trend => ({
        keyword: trend.keyword,
        source: trend.source,
        category: trend.category,
        trend_score: trend.trendScore,
        volume: trend.volume,
        sentiment: trend.sentiment,
        fetched_at: trend.fetchedAt.toISOString(),
        expires_at: trend.expiresAt.toISOString()
      }));
      
      // Clear old trends first
      await supabaseClient.supabase
        .from('trending_topics')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      // Insert new trends
      if (records.length > 0) {
        await supabaseClient.supabase
          .from('trending_topics')
          .upsert(records, { onConflict: 'keyword,source' });
      }
      
    } catch (error) {
      console.error('❌ Error storing trends in database:', error);
    }
  }
}