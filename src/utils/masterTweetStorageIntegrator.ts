#!/usr/bin/env node

/**
 * 🎯 MASTER TWEET STORAGE INTEGRATOR
 * 
 * Replaces ALL existing tweet storage systems with the Ultimate Architecture
 * Provides backward compatibility while upgrading to bulletproof storage
 */

import { UltimateTweetStorageArchitecture } from './ultimateTweetStorageArchitecture';

// Legacy interfaces for backward compatibility
interface LegacyTweetData {
  tweet_id: string;
  content: string;
  tweet_type?: string;
  content_type?: string;
  source_attribution?: string;
  engagement_score?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
  has_snap2health_cta?: boolean;
  viral_score?: number;
  ai_growth_prediction?: number;
  ai_optimized?: boolean;
  generation_method?: string;
}

export class MasterTweetStorageIntegrator {
  
  /**
   * 🔄 UNIVERSAL STORAGE METHOD
   * Replaces ALL existing storage methods across the codebase
   */
  static async storeTweet(tweetData: LegacyTweetData, xResponse?: any): Promise<{
    success: boolean;
    database_id?: string;
    error?: string;
    performance_metrics?: any;
  }> {
    console.log('🎯 === MASTER STORAGE INTEGRATOR ===');
    console.log('🔄 Converting legacy data to Ultimate Architecture format...');
    
    // Convert legacy data to Ultimate Architecture format
    const ultimateData = this.convertToUltimateFormat(tweetData, xResponse);
    
    // Use Ultimate Architecture for storage
    const result = await UltimateTweetStorageArchitecture.storeTweetWithFullValidation(ultimateData);
    
    console.log(`📊 Storage result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.performance_metrics) {
      console.log(`⚡ Performance: ${result.performance_metrics.storage_time_ms}ms`);
    }
    
    return {
      success: result.success,
      database_id: result.database_id,
      error: result.error,
      performance_metrics: result.performance_metrics
    };
  }
  
  /**
   * 🔧 LEGACY COMPATIBILITY METHODS
   * These replace all the old storage methods throughout the codebase
   */
  
  // Replaces: FixedTweetStorage.storeTweet()
  static async fixedStoreTweet(tweetData: LegacyTweetData): Promise<string | null> {
    const result = await this.storeTweet(tweetData);
    return result.success ? result.database_id || null : null;
  }
  
  // Replaces: RobustTweetStorage.storeTweet()
  static async robustStoreTweet(tweetData: any): Promise<{
    success: boolean;
    error?: string;
    tweet_count_today?: number;
    limit_reached?: boolean;
  }> {
    const result = await this.storeTweet(tweetData);
    return {
      success: result.success,
      error: result.error,
      tweet_count_today: 0, // Will be calculated by Ultimate Architecture
      limit_reached: result.error?.includes('limit') || false
    };
  }
  
  // Replaces: SecureSupabaseClient.storeTweet()
  static async secureStoreTweet(tweetData: any): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.storeTweet(tweetData);
    return {
      success: result.success,
      error: result.error
    };
  }
  
  // Replaces: SupabaseService.saveTweetToDatabase()
  static async saveTweetToDatabase(tweetData: any, xResponse?: any): Promise<any> {
    const result = await this.storeTweet(tweetData, xResponse);
    
    if (result.success) {
      return {
        id: result.database_id,
        tweet_id: tweetData.tweet_id,
        content: tweetData.content,
        created_at: new Date().toISOString()
      };
    } else {
      throw new Error(result.error || 'Storage failed');
    }
  }
  
  // Replaces: FixedSupabaseClient.saveTweetToDatabase()
  static async fixedSaveTweetToDatabase(tweetData: any, twitterResult?: any): Promise<string | null> {
    const result = await this.storeTweet(tweetData, twitterResult);
    return result.success ? result.database_id || null : null;
  }
  
  /**
   * 🔄 DATA CONVERSION
   * Converts legacy formats to Ultimate Architecture format
   */
  private static convertToUltimateFormat(tweetData: LegacyTweetData, xResponse?: any): any {
    const ultimateData = {
      // Core fields
      tweet_id: tweetData.tweet_id,
      content: tweetData.content,
      
      // Content classification
      tweet_type: tweetData.tweet_type || 'original',
      content_type: tweetData.content_type || 'health_content',
      content_category: this.categorizeContent(tweetData.content),
      content_keywords: this.extractKeywords(tweetData.content),
      content_themes: this.extractThemes(tweetData.content),
      
      // AI Enhancement fields
      viral_score: tweetData.viral_score || this.predictViralScore(tweetData.content),
      ai_growth_prediction: tweetData.ai_growth_prediction || this.predictGrowth(tweetData.content),
      ai_optimized: tweetData.ai_optimized !== undefined ? tweetData.ai_optimized : true,
      generation_method: tweetData.generation_method || 'ai_enhanced',
      ai_confidence_score: 0.85,
      predicted_engagement_rate: this.predictEngagement(tweetData.content),
      content_quality_score: this.calculateQuality(tweetData.content),
      audience_targeting_score: 0.8,
      
      // Engagement metrics
      likes: tweetData.likes || 0,
      retweets: tweetData.retweets || 0,
      replies: tweetData.replies || 0,
      impressions: tweetData.impressions || 0,
      engagement_score: tweetData.engagement_score || 0,
      
      // Content analysis (will be auto-calculated)
      sentiment_score: this.analyzeSentiment(tweetData.content),
      readability_score: this.calculateReadability(tweetData.content),
      topic_relevance_score: 0.9,
      trend_alignment_score: 0.7,
      
      // Metadata
      source_attribution: tweetData.source_attribution || 'AI Generated',
      posting_strategy: 'intelligent_growth',
      timing_optimization_score: 0.8,
      
      // Performance tracking
      success: true,
      error_count: 0,
      retry_attempts: 0,
      validation_passed: false, // Will be set during validation
      
      // External references
      has_snap2health_cta: tweetData.has_snap2health_cta || false,
      hashtags: this.extractHashtags(tweetData.content),
      mentions: this.extractMentions(tweetData.content),
      
      // Learning data
      learning_feedback: xResponse ? this.extractLearningData(xResponse) : null,
      performance_insights: {},
      optimization_suggestions: []
    };
    
    console.log('🔄 Converted legacy data to Ultimate format');
    console.log(`📊 Viral score: ${ultimateData.viral_score}/10`);
    console.log(`🧠 AI optimized: ${ultimateData.ai_optimized}`);
    console.log(`📈 Predicted engagement: ${(ultimateData.predicted_engagement_rate * 100).toFixed(1)}%`);
    
    return ultimateData;
  }
  
  // Utility methods for data enhancement
  private static categorizeContent(content: string): string {
    const healthKeywords = ['health', 'nutrition', 'fitness', 'supplement', 'diet', 'exercise'];
    const scienceKeywords = ['study', 'research', 'science', 'data', 'clinical'];
    const biohackingKeywords = ['biohack', 'optimize', 'performance', 'longevity'];
    
    const lowerContent = content.toLowerCase();
    
    if (scienceKeywords.some(kw => lowerContent.includes(kw))) return 'science_research';
    if (biohackingKeywords.some(kw => lowerContent.includes(kw))) return 'biohacking';
    if (healthKeywords.some(kw => lowerContent.includes(kw))) return 'health_wellness';
    
    return 'general_health';
  }
  
  private static extractKeywords(content: string): string[] {
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const healthKeywords = ['health', 'nutrition', 'fitness', 'supplement', 'diet', 'exercise', 
                            'study', 'research', 'science', 'clinical', 'breakthrough'];
    
    return words.filter(word => healthKeywords.includes(word));
  }
  
  private static extractThemes(content: string): string[] {
    const themes = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('study') || lowerContent.includes('research')) themes.push('scientific');
    if (lowerContent.includes('breakthrough') || lowerContent.includes('discovery')) themes.push('innovative');
    if (lowerContent.includes('shocking') || lowerContent.includes('surprising')) themes.push('controversial');
    if (lowerContent.includes('optimize') || lowerContent.includes('improve')) themes.push('optimization');
    
    return themes;
  }
  
  private static predictViralScore(content: string): number {
    let score = 5; // Base score
    
    if (content.includes('shocking') || content.includes('breakthrough')) score += 2;
    if (content.includes('study') || content.includes('research')) score += 1;
    if (content.length > 200) score += 1;
    if (/\d+%/.test(content)) score += 1;
    
    return Math.min(score, 10);
  }
  
  private static predictGrowth(content: string): number {
    return Math.round(this.predictViralScore(content) * 0.7);
  }
  
  private static predictEngagement(content: string): number {
    let engagement = 0.3; // Base 30%
    
    if (content.includes('?')) engagement += 0.1;
    if (content.includes('!')) engagement += 0.05;
    if (content.includes('shocking') || content.includes('secret')) engagement += 0.15;
    if (content.length > 180 && content.length < 250) engagement += 0.1;
    
    return Math.min(engagement, 1.0);
  }
  
  private static calculateQuality(content: string): number {
    let quality = 0.5;
    
    if (content.length >= 150 && content.length <= 280) quality += 0.2;
    if (/[A-Z]/.test(content) && /[a-z]/.test(content)) quality += 0.1; // Mixed case
    if (content.includes(':') || content.includes('-')) quality += 0.1; // Structure
    if (!/(.)\1{2,}/.test(content)) quality += 0.1; // No repeated chars
    
    return Math.min(quality, 1.0);
  }
  
  private static analyzeSentiment(content: string): number {
    const positiveWords = ['amazing', 'breakthrough', 'incredible', 'game-changing', 'revolutionary'];
    const negativeWords = ['terrible', 'horrible', 'awful', 'dangerous', 'harmful'];
    
    let sentiment = 0;
    const words = content.toLowerCase().split(/\W+/);
    
    for (const word of words) {
      if (positiveWords.includes(word)) sentiment += 0.2;
      if (negativeWords.includes(word)) sentiment -= 0.2;
    }
    
    return Math.max(-1, Math.min(1, sentiment));
  }
  
  private static calculateReadability(content: string): number {
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    // Optimal: 15-20 words per sentence for social media
    if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) return 0.9;
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) return 0.7;
    return 0.5;
  }
  
  private static extractHashtags(content: string): string[] {
    return content.match(/#\w+/g) || [];
  }
  
  private static extractMentions(content: string): string[] {
    return content.match(/@\w+/g) || [];
  }
  
  private static extractLearningData(xResponse: any): any {
    return {
      twitter_response_time: Date.now(),
      api_rate_limit: xResponse?.rateLimit || null,
      response_headers: xResponse?.headers || null
    };
  }
}

// Export for easy importing
export const masterTweetStorage = MasterTweetStorageIntegrator; 