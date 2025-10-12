/**
 * Enhanced Performance Tracking System
 * Collects comprehensive data for learning algorithms
 */

import { getSupabaseClient } from '../db/index';
// Removed conflicting imports - using local interfaces

export interface EnhancedPerformanceData {
  // Basic metrics (existing)
  post_id: string;
  engagement_rate: number;
  likes: number;
  retweets: number;
  replies: number;
  saves?: number;
  
  // Enhanced metrics (new)
  time_to_peak_engagement: number; // Minutes until max engagement
  engagement_decay_rate: number; // How fast engagement drops (per hour)
  audience_retention: number; // Followers retained after post
  viral_coefficient: number; // Spread beyond direct followers
  reply_sentiment: 'positive' | 'negative' | 'neutral';
  topic_saturation_effect: number; // Performance vs recent similar content
  
  // Content characteristics
  content_length: number;
  has_statistics: boolean;
  has_controversy: boolean;
  hook_type: string;
  evidence_type: string;
  topic: string;
  format: 'single' | 'thread';
  posting_time: string;
  day_of_week: number;
  
  // Prediction accuracy
  predicted_engagement: number;
  prediction_error: number;
  
  // Timestamps
  posted_at: string;
  last_updated: string;
}

export interface ContentPattern {
  pattern_id: string;
  pattern_type: 'hook' | 'topic' | 'format' | 'timing' | 'evidence';
  pattern_description: string;
  avg_performance: number;
  sample_size: number;
  confidence_score: number;
  discovered_at: string;
  last_validated: string;
}

export class EnhancedPerformanceTracker {
  private supabase = getSupabaseClient();
  
  /**
   * Track comprehensive performance data for a post
   */
  async trackPerformance(postData: EnhancedPerformanceData): Promise<void> {
    console.log(`[PERFORMANCE_TRACKER] 📊 Tracking enhanced metrics for post: ${postData.post_id}`);
    
    try {
      // Store in enhanced_performance table
      const { error } = await this.supabase
        .from('enhanced_performance')
        .upsert([{
          post_id: postData.post_id,
          timestamp: postData.timestamp,
          engagement_rate: postData.engagement_rate,
          likes: postData.likes,
          retweets: postData.retweets,
          replies: postData.replies,
          saves: postData.saves || 0,
          follower_growth: postData.follower_growth || 0,
          time_to_peak_engagement: postData.time_to_peak_engagement,
          engagement_decay_rate: postData.engagement_decay_rate,
          audience_retention: postData.audience_retention,
          viral_coefficient: postData.viral_coefficient,
          reply_sentiment: postData.reply_sentiment,
          topic_saturation_effect: postData.topic_saturation_effect
        }], { onConflict: 'post_id' });
      
      if (error) {
        console.error('[PERFORMANCE_TRACKER] ❌ Failed to store performance data:', error);
        return;
      }
      
      // Analyze patterns in real-time
      await this.analyzeRealTimePatterns(postData);
      
      console.log(`[PERFORMANCE_TRACKER] ✅ Enhanced metrics stored and analyzed`);
      
    } catch (error: any) {
      console.error('[PERFORMANCE_TRACKER] ❌ Error tracking performance:', error.message);
    }
  }
  
  /**
   * Calculate enhanced metrics from basic engagement data
   */
  async calculateEnhancedMetrics(
    postId: string, 
    basicMetrics: { likes: number; retweets: number; replies: number; saves?: number },
    contentData: { content: string; topic: string; format: 'single' | 'thread'; posted_at: string }
  ): Promise<Partial<EnhancedPerformanceData>> {
    
    const totalEngagement = basicMetrics.likes + basicMetrics.retweets + basicMetrics.replies + (basicMetrics.saves || 0);
    const engagementRate = totalEngagement / 1000; // Assuming follower count, should be dynamic
    
    // Calculate enhanced metrics
    const enhancedMetrics: Partial<EnhancedPerformanceData> = {
      post_id: postId,
      engagement_rate: engagementRate,
      likes: basicMetrics.likes,
      retweets: basicMetrics.retweets,
      replies: basicMetrics.replies,
      saves: basicMetrics.saves || 0,
      
      // Enhanced calculations
      viral_coefficient: this.calculateViralCoefficient(basicMetrics.retweets, basicMetrics.likes),
      topic_saturation_effect: await this.calculateTopicSaturation(contentData.topic),
      content_length: contentData.content.length,
      has_statistics: this.detectStatistics(contentData.content),
      has_controversy: this.detectControversy(contentData.content),
      hook_type: this.classifyHook(contentData.content),
      evidence_type: this.classifyEvidence(contentData.content),
      topic: contentData.topic,
      format: contentData.format,
      posting_time: contentData.posted_at,
      day_of_week: new Date(contentData.posted_at).getDay(),
      
      // Timestamps
      posted_at: contentData.posted_at,
      last_updated: new Date().toISOString()
    };
    
    return enhancedMetrics;
  }
  
  /**
   * Analyze patterns in real-time as new data comes in
   */
  private async analyzeRealTimePatterns(performanceData: EnhancedPerformanceData): Promise<void> {
    // Check if this performance data reveals new patterns
    const patterns = await this.discoverPatterns([performanceData]);
    
    for (const pattern of patterns) {
      await this.storePattern(pattern);
    }
  }
  
  /**
   * Calculate viral coefficient (how much content spreads beyond direct followers)
   */
  private calculateViralCoefficient(retweets: number, likes: number): number {
    if (likes === 0) return 0;
    return retweets / likes; // Higher ratio = more viral
  }
  
  /**
   * Calculate topic saturation effect
   */
  private async calculateTopicSaturation(topic: string): Promise<number> {
    try {
      // Get recent posts on same topic
      const { data: recentPosts, error } = await this.supabase
        .from('enhanced_performance')
        .select('engagement_rate')
        .eq('topic', topic)
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('posted_at', { ascending: false })
        .limit(10);
      
      if (error || !recentPosts || recentPosts.length === 0) {
        return 1.0; // No saturation effect
      }
      
      // Calculate trend (declining performance = higher saturation)
      const avgEngagement = recentPosts.reduce((sum, post) => sum + post.engagement_rate, 0) / recentPosts.length;
      const latestEngagement = recentPosts.slice(0, 3).reduce((sum, post) => sum + post.engagement_rate, 0) / Math.min(3, recentPosts.length);
      
      return latestEngagement / avgEngagement; // < 1.0 = saturated, > 1.0 = trending up
      
    } catch (error) {
      console.error('[PERFORMANCE_TRACKER] Error calculating topic saturation:', error);
      return 1.0;
    }
  }
  
  /**
   * Detect if content contains statistics
   */
  private detectStatistics(content: string): boolean {
    const statisticPatterns = [
      /\d+%/g, // Percentages
      /\d+x/g, // Multipliers
      /\d+,\d+/g, // Large numbers with commas
      /study of \d+/gi, // Study sample sizes
      /\d+ people/gi, // People counts
    ];
    
    return statisticPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Detect controversial content
   */
  private detectControversy(content: string): boolean {
    const controversyIndicators = [
      /most people think/gi,
      /everyone believes/gi,
      /contrary to/gi,
      /myth/gi,
      /wrong/gi,
      /actually/gi,
      /but/gi,
      /however/gi,
    ];
    
    return controversyIndicators.some(indicator => indicator.test(content));
  }
  
  /**
   * Classify hook type
   */
  private classifyHook(content: string): string {
    const hookPatterns = [
      { pattern: /\d+% of people/gi, type: 'statistic_hook' },
      { pattern: /most people think/gi, type: 'contrarian_hook' },
      { pattern: /new study/gi, type: 'research_hook' },
      { pattern: /here's why/gi, type: 'explanation_hook' },
      { pattern: /\?$/m, type: 'question_hook' },
    ];
    
    for (const { pattern, type } of hookPatterns) {
      if (pattern.test(content)) {
        return type;
      }
    }
    
    return 'generic_hook';
  }
  
  /**
   * Classify evidence type
   */
  private classifyEvidence(content: string): string {
    const evidencePatterns = [
      { pattern: /study|research|RCT/gi, type: 'scientific_study' },
      { pattern: /mechanism|pathway|process/gi, type: 'biological_mechanism' },
      { pattern: /\d+%|\d+x|\d+ people/gi, type: 'statistical_evidence' },
      { pattern: /expert|doctor|professor/gi, type: 'expert_opinion' },
    ];
    
    for (const { pattern, type } of evidencePatterns) {
      if (pattern.test(content)) {
        return type;
      }
    }
    
    return 'anecdotal_evidence';
  }
  
  /**
   * Discover patterns from performance data
   */
  private async discoverPatterns(performanceData: EnhancedPerformanceData[]): Promise<ContentPattern[]> {
    const patterns: ContentPattern[] = [];
    
    // Group by hook type and analyze performance
    const hookPerformance = this.groupByField(performanceData, 'hook_type');
    for (const [hookType, posts] of Object.entries(hookPerformance)) {
      if (posts.length >= 3) { // Need minimum sample size
        const avgPerformance = posts.reduce((sum, post) => sum + post.engagement_rate, 0) / posts.length;
        
        patterns.push({
          pattern_id: `hook_${hookType}_${Date.now()}`,
          pattern_type: 'hook',
          pattern_description: `Hook type "${hookType}" averages ${avgPerformance.toFixed(3)} engagement rate`,
          avg_performance: avgPerformance,
          sample_size: posts.length,
          confidence_score: Math.min(0.95, posts.length / 10), // Higher confidence with more samples
          discovered_at: new Date().toISOString(),
          last_validated: new Date().toISOString()
        });
      }
    }
    
    // Similar analysis for topics, formats, timing, etc.
    // ... (additional pattern discovery logic)
    
    return patterns;
  }
  
  /**
   * Group performance data by a specific field
   */
  private groupByField(data: EnhancedPerformanceData[], field: keyof EnhancedPerformanceData): Record<string, EnhancedPerformanceData[]> {
    return data.reduce((groups, item) => {
      const key = String(item[field]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, EnhancedPerformanceData[]>);
  }
  
  /**
   * Store discovered pattern
   */
  private async storePattern(pattern: ContentPattern): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('content_patterns')
        .upsert([{
          pattern_id: pattern.pattern_id,
          pattern_type: pattern.pattern_type,
          pattern_description: pattern.pattern_description,
          avg_performance: pattern.avg_performance,
          sample_size: pattern.sample_size,
          confidence_score: pattern.confidence_score,
          discovered_at: pattern.discovered_at,
          last_validated: pattern.last_validated
        }], { onConflict: 'pattern_id' });
      
      if (error) {
        console.error('[PERFORMANCE_TRACKER] Error storing pattern:', error);
        return;
      }
      
      console.log(`[PERFORMANCE_TRACKER] 🔍 Pattern discovered: ${pattern.pattern_description}`);
      
    } catch (error: any) {
      console.error('[PERFORMANCE_TRACKER] Error storing pattern:', error.message);
    }
  }
  
  /**
   * Get top performing patterns
   */
  async getTopPatterns(patternType?: string, limit: number = 10): Promise<ContentPattern[]> {
    try {
      let query = this.supabase
        .from('content_patterns')
        .select('*')
        .gte('confidence_score', 0.6) // Only high-confidence patterns
        .order('avg_performance', { ascending: false })
        .limit(limit);
      
      if (patternType) {
        query = query.eq('pattern_type', patternType);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[PERFORMANCE_TRACKER] Error fetching patterns:', error);
        return [];
      }
      
      return data || [];
      
    } catch (error: any) {
      console.error('[PERFORMANCE_TRACKER] Error fetching patterns:', error.message);
      return [];
    }
  }
  
  /**
   * Get performance insights for content optimization
   */
  async getPerformanceInsights(): Promise<{
    topHooks: ContentPattern[];
    topTopics: ContentPattern[];
    optimalTiming: ContentPattern[];
    bestFormats: ContentPattern[];
  }> {
    const [topHooks, topTopics, optimalTiming, bestFormats] = await Promise.all([
      this.getTopPatterns('hook', 5),
      this.getTopPatterns('topic', 5),
      this.getTopPatterns('timing', 5),
      this.getTopPatterns('format', 5)
    ]);
    
    return {
      topHooks,
      topTopics,
      optimalTiming,
      bestFormats
    };
  }
}

// Export singleton instance
export const performanceTracker = new EnhancedPerformanceTracker();
