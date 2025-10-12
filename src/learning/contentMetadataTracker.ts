/**
 * Content Metadata Tracking System
 * Tracks viral content performance for learning and optimization
 */

import { ContentMetadata, ViralContentResult } from '../ai/viralContentStrategy';

export interface ContentPerformanceRecord {
  id: string;
  content_id: string;
  generated_at: Date;
  posted_at?: Date;
  
  // Generation metadata
  style: ContentMetadata['style'];
  fact_source: string;
  topic: string;
  hook_type: ContentMetadata['hook_type'];
  cta_type: ContentMetadata['cta_type'];
  predicted_engagement: string;
  quality_score: number;
  thread_length: number;
  fact_count: number;
  
  // Performance metrics (filled after posting)
  actual_likes?: number;
  actual_retweets?: number;
  actual_comments?: number;
  actual_impressions?: number;
  actual_engagement_rate?: number;
  
  // Learning scores
  prediction_accuracy?: number; // How close predicted vs actual engagement
  viral_score?: number; // Calculated viral performance
  style_effectiveness?: number; // How well this style performed
  
  // Metadata for evolution
  hook_effectiveness?: number;
  cta_effectiveness?: number;
  fact_resonance?: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface StylePerformanceStats {
  style: ContentMetadata['style'];
  total_posts: number;
  avg_engagement_rate: number;
  avg_viral_score: number;
  avg_quality_score: number;
  success_rate: number; // % of posts above threshold
  trending_direction: 'improving' | 'declining' | 'stable';
  recommended_weight: number; // 0-100, how often to use this style
}

export interface LearningInsights {
  best_performing_style: ContentMetadata['style'];
  optimal_hook_types: ContentMetadata['hook_type'][];
  most_effective_ctas: ContentMetadata['cta_type'][];
  top_fact_sources: string[];
  optimal_thread_length: number;
  style_performance: StylePerformanceStats[];
  recent_trends: {
    trending_up: string[];
    trending_down: string[];
  };
  recommendations: string[];
}

/**
 * Content Metadata Tracker
 */
export class ContentMetadataTracker {
  private static instance: ContentMetadataTracker;
  private performanceRecords: Map<string, ContentPerformanceRecord> = new Map();
  
  static getInstance(): ContentMetadataTracker {
    if (!this.instance) {
      this.instance = new ContentMetadataTracker();
    }
    return this.instance;
  }

  /**
   * Record new content generation with metadata
   */
  async recordContentGeneration(
    contentId: string,
    viralResult: ViralContentResult
  ): Promise<void> {
    const record: ContentPerformanceRecord = {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content_id: contentId,
      generated_at: new Date(),
      
      // Copy metadata
      style: viralResult.metadata.style,
      fact_source: viralResult.metadata.fact_source,
      topic: viralResult.metadata.topic,
      hook_type: viralResult.metadata.hook_type,
      cta_type: viralResult.metadata.cta_type,
      predicted_engagement: viralResult.metadata.predicted_engagement,
      quality_score: viralResult.metadata.quality_score,
      thread_length: viralResult.metadata.thread_length,
      fact_count: viralResult.metadata.fact_count,
      
      created_at: new Date(),
      updated_at: new Date()
    };

    this.performanceRecords.set(record.id, record);
    
    // Log for immediate visibility
    console.log(`📊 CONTENT_METADATA: Recorded ${record.style} style, topic=${record.topic}, predicted=${record.predicted_engagement}`);
    
    // Store in database for persistence
    await this.storeInDatabase(record);
  }

  /**
   * Update performance metrics after posting
   */
  async updatePerformanceMetrics(
    contentId: string,
    metrics: {
      likes: number;
      retweets: number;
      comments: number;
      impressions: number;
    }
  ): Promise<void> {
    const record = this.findRecordByContentId(contentId);
    if (!record) {
      console.warn(`⚠️ METADATA_TRACKER: No record found for content ${contentId}`);
      return;
    }

    // Update actual metrics
    record.actual_likes = metrics.likes;
    record.actual_retweets = metrics.retweets;
    record.actual_comments = metrics.comments;
    record.actual_impressions = metrics.impressions;
    record.actual_engagement_rate = this.calculateEngagementRate(metrics);
    
    // Calculate learning scores
    record.prediction_accuracy = this.calculatePredictionAccuracy(record);
    record.viral_score = this.calculateViralScore(metrics);
    record.style_effectiveness = this.calculateStyleEffectiveness(record);
    
    record.updated_at = new Date();
    
    console.log(`📈 PERFORMANCE_UPDATE: ${record.style} style, actual_engagement=${record.actual_engagement_rate}%, viral_score=${record.viral_score}`);
    
    // Update database
    await this.updateDatabase(record);
  }

  /**
   * Generate learning insights for prompt evolution
   */
  async generateLearningInsights(): Promise<LearningInsights> {
    const records = Array.from(this.performanceRecords.values())
      .filter(r => r.actual_engagement_rate !== undefined) // Only completed posts
      .filter(r => r.created_at > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days

    if (records.length < 5) {
      console.log('📊 LEARNING_INSIGHTS: Insufficient data for insights (need 5+ posts)');
      return this.getDefaultInsights();
    }

    // Analyze style performance
    const styleStats = this.analyzeStylePerformance(records);
    const bestStyle = styleStats.reduce((best, current) => 
      current.avg_engagement_rate > best.avg_engagement_rate ? current : best
    ).style;

    // Analyze hooks and CTAs
    const hookPerformance = this.analyzeHookPerformance(records);
    const ctaPerformance = this.analyzeCTAPerformance(records);

    // Generate recommendations
    const recommendations = this.generateRecommendations(styleStats, hookPerformance, ctaPerformance);

    const insights: LearningInsights = {
      best_performing_style: bestStyle,
      optimal_hook_types: hookPerformance.slice(0, 2).map(h => h.hook_type),
      most_effective_ctas: ctaPerformance.slice(0, 2).map(c => c.cta_type),
      top_fact_sources: this.getTopFactSources(records),
      optimal_thread_length: this.calculateOptimalThreadLength(records),
      style_performance: styleStats,
      recent_trends: this.analyzeTrends(records),
      recommendations
    };

    console.log(`🧠 LEARNING_INSIGHTS: Best style=${bestStyle}, optimal_length=${insights.optimal_thread_length}, ${recommendations.length} recommendations`);
    
    return insights;
  }

  /**
   * Get style weights for prompt evolution
   */
  getStyleWeights(): Record<ContentMetadata['style'], number> {
    const defaultWeights = { educational: 25, storytelling: 25, contrarian: 25, quick_tip: 25 };
    
    const records = Array.from(this.performanceRecords.values())
      .filter(r => r.actual_engagement_rate !== undefined)
      .filter(r => r.created_at > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)); // Last 14 days

    if (records.length < 8) return defaultWeights; // Need 2+ posts per style

    const stylePerformance = this.analyzeStylePerformance(records);
    const totalPerformance = stylePerformance.reduce((sum, s) => sum + s.avg_engagement_rate, 0);
    
    if (totalPerformance === 0) return defaultWeights;

    // Convert performance to weights (higher performance = higher weight)
    const weights: Record<ContentMetadata['style'], number> = {} as any;
    stylePerformance.forEach(style => {
      weights[style.style] = Math.round((style.avg_engagement_rate / totalPerformance) * 100);
    });

    console.log(`🎯 STYLE_WEIGHTS: ${Object.entries(weights).map(([k,v]) => `${k}=${v}%`).join(', ')}`);
    
    return weights;
  }

  // Private helper methods
  
  private findRecordByContentId(contentId: string): ContentPerformanceRecord | undefined {
    return Array.from(this.performanceRecords.values()).find(r => r.content_id === contentId);
  }

  private calculateEngagementRate(metrics: { likes: number; retweets: number; comments: number; impressions: number }): number {
    if (metrics.impressions === 0) return 0;
    const totalEngagements = metrics.likes + metrics.retweets + metrics.comments;
    return Number(((totalEngagements / metrics.impressions) * 100).toFixed(2));
  }

  private calculatePredictionAccuracy(record: ContentPerformanceRecord): number {
    if (!record.actual_engagement_rate) return 0;
    
    const predictedRate = parseFloat(record.predicted_engagement.split('%')[0]);
    const actualRate = record.actual_engagement_rate;
    const accuracy = 100 - Math.abs(predictedRate - actualRate);
    
    return Math.max(0, accuracy);
  }

  private calculateViralScore(metrics: { likes: number; retweets: number; comments: number; impressions: number }): number {
    // Viral score based on engagement distribution and reach
    let score = 0;
    
    // Base engagement score
    const engagementRate = this.calculateEngagementRate(metrics);
    score += engagementRate * 2; // 0-20 points
    
    // Retweet multiplier (virality indicator)
    if (metrics.impressions > 0) {
      const retweetRate = (metrics.retweets / metrics.impressions) * 100;
      score += retweetRate * 5; // 0-25 points
    }
    
    // Comment engagement (deep engagement)
    if (metrics.likes > 0) {
      const commentRatio = metrics.comments / metrics.likes;
      score += commentRatio * 20; // 0-20 points
    }
    
    // Reach bonus
    if (metrics.impressions > 10000) score += 10;
    if (metrics.impressions > 50000) score += 15;
    
    return Math.min(Math.round(score), 100);
  }

  private calculateStyleEffectiveness(record: ContentPerformanceRecord): number {
    if (!record.actual_engagement_rate) return 0;
    
    // Compare to average for this style
    const styleRecords = Array.from(this.performanceRecords.values())
      .filter(r => r.style === record.style && r.actual_engagement_rate !== undefined);
    
    if (styleRecords.length <= 1) return 50; // Default for first post
    
    const avgStyleEngagement = styleRecords.reduce((sum, r) => sum + (r.actual_engagement_rate || 0), 0) / styleRecords.length;
    
    if (avgStyleEngagement === 0) return 50;
    
    const effectiveness = (record.actual_engagement_rate / avgStyleEngagement) * 50;
    return Math.min(Math.round(effectiveness), 100);
  }

  private analyzeStylePerformance(records: ContentPerformanceRecord[]): StylePerformanceStats[] {
    const styles: ContentMetadata['style'][] = ['educational', 'storytelling', 'contrarian', 'quick_tip'];
    
    return styles.map(style => {
      const styleRecords = records.filter(r => r.style === style);
      const totalPosts = styleRecords.length;
      
      if (totalPosts === 0) {
        return {
          style,
          total_posts: 0,
          avg_engagement_rate: 0,
          avg_viral_score: 0,
          avg_quality_score: 0,
          success_rate: 0,
          trending_direction: 'stable' as const,
          recommended_weight: 25
        };
      }

      const avgEngagement = styleRecords.reduce((sum, r) => sum + (r.actual_engagement_rate || 0), 0) / totalPosts;
      const avgViral = styleRecords.reduce((sum, r) => sum + (r.viral_score || 0), 0) / totalPosts;
      const avgQuality = styleRecords.reduce((sum, r) => sum + r.quality_score, 0) / totalPosts;
      const successCount = styleRecords.filter(r => (r.actual_engagement_rate || 0) > 3).length; // >3% engagement = success
      const successRate = (successCount / totalPosts) * 100;
      
      return {
        style,
        total_posts: totalPosts,
        avg_engagement_rate: Number(avgEngagement.toFixed(2)),
        avg_viral_score: Number(avgViral.toFixed(1)),
        avg_quality_score: Number(avgQuality.toFixed(1)),
        success_rate: Number(successRate.toFixed(1)),
        trending_direction: 'stable' as const, // TODO: Calculate trend
        recommended_weight: Math.round(avgEngagement * 10) // Convert engagement to weight
      };
    });
  }

  private analyzeHookPerformance(records: ContentPerformanceRecord[]): Array<{hook_type: ContentMetadata['hook_type'], avg_engagement: number}> {
    const hookTypes: ContentMetadata['hook_type'][] = ['surprising_fact', 'myth_buster', 'story_opener', 'tip_promise'];
    
    return hookTypes.map(hookType => {
      const hookRecords = records.filter(r => r.hook_type === hookType);
      const avgEngagement = hookRecords.length > 0 
        ? hookRecords.reduce((sum, r) => sum + (r.actual_engagement_rate || 0), 0) / hookRecords.length
        : 0;
      
      return { hook_type: hookType, avg_engagement: Number(avgEngagement.toFixed(2)) };
    }).sort((a, b) => b.avg_engagement - a.avg_engagement);
  }

  private analyzeCTAPerformance(records: ContentPerformanceRecord[]): Array<{cta_type: ContentMetadata['cta_type'], avg_engagement: number}> {
    const ctaTypes: ContentMetadata['cta_type'][] = ['follow_for_more', 'engagement_question', 'share_prompt', 'thread_continuation'];
    
    return ctaTypes.map(ctaType => {
      const ctaRecords = records.filter(r => r.cta_type === ctaType);
      const avgEngagement = ctaRecords.length > 0 
        ? ctaRecords.reduce((sum, r) => sum + (r.actual_engagement_rate || 0), 0) / ctaRecords.length
        : 0;
      
      return { cta_type: ctaType, avg_engagement: Number(avgEngagement.toFixed(2)) };
    }).sort((a, b) => b.avg_engagement - a.avg_engagement);
  }

  private getTopFactSources(records: ContentPerformanceRecord[]): string[] {
    const sourcePerformance = new Map<string, number[]>();
    
    records.forEach(record => {
      if (!sourcePerformance.has(record.fact_source)) {
        sourcePerformance.set(record.fact_source, []);
      }
      sourcePerformance.get(record.fact_source)!.push(record.actual_engagement_rate || 0);
    });

    return Array.from(sourcePerformance.entries())
      .map(([source, rates]) => ({
        source,
        avgEngagement: rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map(item => item.source);
  }

  private calculateOptimalThreadLength(records: ContentPerformanceRecord[]): number {
    const lengthPerformance = new Map<number, number[]>();
    
    records.forEach(record => {
      if (!lengthPerformance.has(record.thread_length)) {
        lengthPerformance.set(record.thread_length, []);
      }
      lengthPerformance.get(record.thread_length)!.push(record.actual_engagement_rate || 0);
    });

    let bestLength = 4;
    let bestAvgEngagement = 0;

    lengthPerformance.forEach((rates, length) => {
      const avgEngagement = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      if (avgEngagement > bestAvgEngagement) {
        bestAvgEngagement = avgEngagement;
        bestLength = length;
      }
    });

    return bestLength;
  }

  private analyzeTrends(records: ContentPerformanceRecord[]): { trending_up: string[]; trending_down: string[] } {
    // Simple trend analysis - compare last 7 days vs previous 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentRecords = records.filter(r => r.created_at > sevenDaysAgo);
    const previousRecords = records.filter(r => r.created_at > fourteenDaysAgo && r.created_at <= sevenDaysAgo);

    const trending_up: string[] = [];
    const trending_down: string[] = [];

    // Simple implementation - can be enhanced
    if (recentRecords.length > 0 && previousRecords.length > 0) {
      const recentAvg = recentRecords.reduce((sum, r) => sum + (r.actual_engagement_rate || 0), 0) / recentRecords.length;
      const previousAvg = previousRecords.reduce((sum, r) => sum + (r.actual_engagement_rate || 0), 0) / previousRecords.length;

      if (recentAvg > previousAvg * 1.1) {
        trending_up.push('overall_engagement');
      } else if (recentAvg < previousAvg * 0.9) {
        trending_down.push('overall_engagement');
      }
    }

    return { trending_up, trending_down };
  }

  private generateRecommendations(
    styleStats: StylePerformanceStats[],
    hookPerformance: Array<{hook_type: ContentMetadata['hook_type'], avg_engagement: number}>,
    ctaPerformance: Array<{cta_type: ContentMetadata['cta_type'], avg_engagement: number}>
  ): string[] {
    const recommendations: string[] = [];

    // Style recommendations
    const bestStyle = styleStats.reduce((best, current) => 
      current.avg_engagement_rate > best.avg_engagement_rate ? current : best
    );
    
    if (bestStyle.avg_engagement_rate > 0) {
      recommendations.push(`Increase ${bestStyle.style} content (${bestStyle.avg_engagement_rate}% avg engagement)`);
    }

    // Hook recommendations
    if (hookPerformance[0]?.avg_engagement > 0) {
      recommendations.push(`Use more ${hookPerformance[0].hook_type} hooks (${hookPerformance[0].avg_engagement}% engagement)`);
    }

    // CTA recommendations
    if (ctaPerformance[0]?.avg_engagement > 0) {
      recommendations.push(`Optimize CTAs with ${ctaPerformance[0].cta_type} style (${ctaPerformance[0].avg_engagement}% engagement)`);
    }

    return recommendations;
  }

  private getDefaultInsights(): LearningInsights {
    return {
      best_performing_style: 'educational',
      optimal_hook_types: ['surprising_fact', 'myth_buster'],
      most_effective_ctas: ['follow_for_more', 'engagement_question'],
      top_fact_sources: ['NIH', 'Harvard', 'Mayo Clinic'],
      optimal_thread_length: 4,
      style_performance: [],
      recent_trends: { trending_up: [], trending_down: [] },
      recommendations: ['Generate more content to enable learning insights']
    };
  }

  private async storeInDatabase(record: ContentPerformanceRecord): Promise<void> {
    try {
      // Store in Supabase for persistence
      const { supaService } = await import('../db/supabaseService');
      
      await supaService.from('content_metadata').insert({
        id: record.id,
        content_id: record.content_id,
        style: record.style,
        fact_source: record.fact_source,
        topic: record.topic,
        hook_type: record.hook_type,
        cta_type: record.cta_type,
        predicted_engagement: record.predicted_engagement,
        quality_score: record.quality_score,
        thread_length: record.thread_length,
        fact_count: record.fact_count,
        generated_at: record.generated_at.toISOString(),
        created_at: record.created_at.toISOString()
      });
      
    } catch (error) {
      console.error('💾 METADATA_STORE_ERROR:', error);
    }
  }

  private async updateDatabase(record: ContentPerformanceRecord): Promise<void> {
    try {
      const { supaService } = await import('../db/supabaseService');
      
      await supaService.from('content_metadata')
        .update({
          actual_likes: record.actual_likes,
          actual_retweets: record.actual_retweets,
          actual_comments: record.actual_comments,
          actual_impressions: record.actual_impressions,
          actual_engagement_rate: record.actual_engagement_rate,
          prediction_accuracy: record.prediction_accuracy,
          viral_score: record.viral_score,
          style_effectiveness: record.style_effectiveness,
          updated_at: record.updated_at.toISOString()
        })
        .eq('id', record.id);
        
    } catch (error) {
      console.error('💾 METADATA_UPDATE_ERROR:', error);
    }
  }
}
