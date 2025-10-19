/**
 * 📊 CONVERSION FUNNEL TRACKER
 * 
 * Tracks the full funnel: Impression → Engagement → Profile Click → Follow
 * Identifies what content actually converts to followers
 * 
 * Budget: ~$0.05/day (tracking only)
 */

import { getSupabaseClient } from '../db/index';

export interface FunnelMetrics {
  post_id: string;
  
  // Funnel stages
  impressions: number;
  engagements: number;          // likes + retweets + replies
  profile_clicks: number;
  follows: number;
  
  // Conversion rates
  engagement_rate: number;       // engagements / impressions
  click_rate: number;            // clicks / engagements
  follow_rate: number;           // follows / clicks
  overall_conversion: number;    // follows / impressions
  
  // Content attributes (for learning)
  content_type: string;
  topic: string;
  has_controversy: boolean;
  has_numbers: boolean;
  format: 'single' | 'thread';
  hook_type: string;
  
  // Performance classification
  performance_tier: 'excellent' | 'good' | 'poor';
}

export interface ConversionInsights {
  // Best performing content attributes
  best_content_types: Array<{ type: string; conversion_rate: number }>;
  best_topics: Array<{ topic: string; conversion_rate: number }>;
  best_formats: Array<{ format: string; conversion_rate: number }>;
  
  // Funnel bottlenecks
  avg_engagement_rate: number;
  avg_click_rate: number;
  avg_follow_rate: number;
  
  // Where people drop off
  biggest_dropoff: 'engagement' | 'click' | 'follow';
  
  recommendations: string[];
}

export class ConversionFunnelTracker {
  private static instance: ConversionFunnelTracker;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): ConversionFunnelTracker {
    if (!ConversionFunnelTracker.instance) {
      ConversionFunnelTracker.instance = new ConversionFunnelTracker();
    }
    return ConversionFunnelTracker.instance;
  }

  /**
   * Track funnel metrics for a post
   */
  async trackFunnelMetrics(postId: string): Promise<FunnelMetrics | null> {
    try {
      const { data: post } = await this.supabase
        .from('outcomes')
        .select('*')
        .eq('decision_id', postId)
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();

      if (!post) return null;

      const perf = post.actual_performance as any || {};
      const metadata = post.generation_metadata as any || {};

      // Calculate funnel metrics
      const impressions = perf.views || perf.impressions || 0;
      const likes = perf.likes || 0;
      const retweets = perf.retweets || 0;
      const replies = perf.replies || 0;
      const engagements = likes + retweets + replies;
      const profileClicks = perf.profile_clicks || 0;
      const follows = perf.followers_gained || 0;

      // Conversion rates
      const engagementRate = impressions > 0 ? engagements / impressions : 0;
      const clickRate = engagements > 0 ? profileClicks / engagements : 0;
      const followRate = profileClicks > 0 ? follows / profileClicks : 0;
      const overallConversion = impressions > 0 ? follows / impressions : 0;

      // Content attributes
      const content = String(post.content || '');
      const contentType = String(post.decision_type || 'content');
      const topic = String(metadata.topic || 'unknown');
      const hasControversy = content.toLowerCase().includes('but') || 
                             content.toLowerCase().includes('wrong') ||
                             content.toLowerCase().includes('myth');
      const hasNumbers = /\d+/.test(content);
      const format = String(post.content_format) === 'thread' ? 'thread' as const : 'single' as const;
      const hookType = this.detectHookType(content);

      // Performance tier
      let performanceTier: 'excellent' | 'good' | 'poor' = 'poor';
      if (overallConversion >= 0.01) performanceTier = 'excellent';  // 1% or better
      else if (overallConversion >= 0.005) performanceTier = 'good'; // 0.5% or better

      const metrics: FunnelMetrics = {
        post_id: postId,
        impressions,
        engagements,
        profile_clicks: profileClicks,
        follows,
        engagement_rate: engagementRate,
        click_rate: clickRate,
        follow_rate: followRate,
        overall_conversion: overallConversion,
        content_type: contentType,
        topic,
        has_controversy: hasControversy,
        has_numbers: hasNumbers,
        format,
        hook_type: hookType,
        performance_tier: performanceTier
      };

      // Store funnel metrics
      await this.supabase
        .from('conversion_funnel_metrics')
        .upsert({
          post_id: postId,
          ...metrics,
          tracked_at: new Date().toISOString()
        }, {
          onConflict: 'post_id'
        });

      console.log(`[FUNNEL] 📊 Tracked metrics for ${postId}`);
      console.log(`[FUNNEL]    Conversion: ${(overallConversion * 100).toFixed(3)}%`);
      console.log(`[FUNNEL]    Tier: ${performanceTier.toUpperCase()}`);

      return metrics;

    } catch (error: any) {
      console.error('[FUNNEL] ❌ Error tracking metrics:', error.message);
      return null;
    }
  }

  /**
   * Detect hook type from content
   */
  private detectHookType(content: string): string {
    const lower = content.toLowerCase();
    
    if (lower.includes('most people think') || lower.includes('everyone thinks')) {
      return 'contrarian';
    } else if (/\d+%/.test(content) || /\$\d+/.test(content)) {
      return 'data_driven';
    } else if (lower.includes('my friend') || lower.includes('i tested')) {
      return 'story';
    } else if (lower.includes('here\'s why') || lower.includes('here\'s how')) {
      return 'explanatory';
    } else if (lower.includes('?')) {
      return 'question';
    } else {
      return 'standard';
    }
  }

  /**
   * Get conversion insights from historical data
   */
  async getConversionInsights(): Promise<ConversionInsights> {
    try {
      const { data: metrics } = await this.supabase
        .from('conversion_funnel_metrics')
        .select('*')
        .order('tracked_at', { ascending: false })
        .limit(100);

      if (!metrics || metrics.length < 5) {
        return this.getDefaultInsights();
      }

      // Analyze by content type
      const byContentType: Record<string, number[]> = {};
      const byTopic: Record<string, number[]> = {};
      const byFormat: Record<string, number[]> = {};

      let totalEngagementRate = 0;
      let totalClickRate = 0;
      let totalFollowRate = 0;

      metrics.forEach(m => {
        // Group by attributes
        const contentType = String(m.content_type);
        const topic = String(m.topic);
        const format = String(m.format);
        
        if (!byContentType[contentType]) byContentType[contentType] = [];
        byContentType[contentType].push(Number(m.overall_conversion) || 0);

        if (!byTopic[topic]) byTopic[topic] = [];
        byTopic[topic].push(Number(m.overall_conversion) || 0);

        if (!byFormat[format]) byFormat[format] = [];
        byFormat[format].push(Number(m.overall_conversion) || 0);

        // Aggregate rates
        totalEngagementRate += Number(m.engagement_rate) || 0;
        totalClickRate += Number(m.click_rate) || 0;
        totalFollowRate += Number(m.follow_rate) || 0;
      });

      // Calculate best performers
      const bestContentTypes = Object.entries(byContentType)
        .map(([type, conversions]) => ({
          type,
          conversion_rate: conversions.reduce((a, b) => a + b, 0) / conversions.length
        }))
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, 3);

      const bestTopics = Object.entries(byTopic)
        .map(([topic, conversions]) => ({
          topic,
          conversion_rate: conversions.reduce((a, b) => a + b, 0) / conversions.length
        }))
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, 3);

      const bestFormats = Object.entries(byFormat)
        .map(([format, conversions]) => ({
          format,
          conversion_rate: conversions.reduce((a, b) => a + b, 0) / conversions.length
        }))
        .sort((a, b) => b.conversion_rate - a.conversion_rate);

      // Calculate averages
      const avgEngagementRate = totalEngagementRate / metrics.length;
      const avgClickRate = totalClickRate / metrics.length;
      const avgFollowRate = totalFollowRate / metrics.length;

      // Identify biggest dropoff
      let biggestDropoff: 'engagement' | 'click' | 'follow' = 'engagement';
      
      if (avgEngagementRate < 0.03) {
        biggestDropoff = 'engagement'; // <3% engagement = problem getting initial engagement
      } else if (avgClickRate < 0.1) {
        biggestDropoff = 'click'; // <10% click rate = problem getting profile clicks
      } else {
        biggestDropoff = 'follow'; // Problem converting clicks to follows
      }

      const recommendations = this.generateRecommendations({
        avgEngagementRate,
        avgClickRate,
        avgFollowRate,
        biggestDropoff,
        bestContentTypes,
        bestFormats
      });

      return {
        best_content_types: bestContentTypes,
        best_topics: bestTopics,
        best_formats: bestFormats,
        avg_engagement_rate: avgEngagementRate,
        avg_click_rate: avgClickRate,
        avg_follow_rate: avgFollowRate,
        biggest_dropoff: biggestDropoff,
        recommendations
      };

    } catch (error: any) {
      console.error('[FUNNEL] ❌ Error getting insights:', error.message);
      return this.getDefaultInsights();
    }
  }

  /**
   * Generate recommendations based on funnel analysis
   */
  private generateRecommendations(data: {
    avgEngagementRate: number;
    avgClickRate: number;
    avgFollowRate: number;
    biggestDropoff: 'engagement' | 'click' | 'follow';
    bestContentTypes: Array<{ type: string; conversion_rate: number }>;
    bestFormats: Array<{ format: string; conversion_rate: number }>;
  }): string[] {
    const recommendations: string[] = [];

    // Engagement recommendations
    if (data.biggestDropoff === 'engagement' || data.avgEngagementRate < 0.03) {
      recommendations.push('🎯 Focus on stronger hooks to boost engagement');
      recommendations.push('🎯 Use more controversy to spark discussion');
      recommendations.push('🎯 Test different posting times for more impressions');
    }

    // Click recommendations
    if (data.biggestDropoff === 'click' || data.avgClickRate < 0.1) {
      recommendations.push('🎯 Add more curiosity gaps to drive profile clicks');
      recommendations.push('🎯 Tease expertise in your content');
      recommendations.push('🎯 Use "thread" format (increases clicks)');
    }

    // Follow recommendations
    if (data.biggestDropoff === 'follow' || data.avgFollowRate < 0.4) {
      recommendations.push('🎯 Optimize bio to clearly state value proposition');
      recommendations.push('🎯 Pin your best-performing tweet');
      recommendations.push('🎯 Ensure recent posts are high quality');
    }

    // Best performer recommendations
    if (data.bestContentTypes.length > 0) {
      const bestType = data.bestContentTypes[0];
      recommendations.push(`🔥 Generate more "${bestType.type}" content (${(bestType.conversion_rate * 100).toFixed(2)}% conversion)`);
    }

    if (data.bestFormats.length > 0 && data.bestFormats[0].format === 'thread') {
      recommendations.push('🔥 Threads convert better - use them more often');
    }

    return recommendations;
  }

  /**
   * Default insights when no data
   */
  private getDefaultInsights(): ConversionInsights {
    return {
      best_content_types: [
        { type: 'controversy', conversion_rate: 0.01 },
        { type: 'data', conversion_rate: 0.008 },
        { type: 'story', conversion_rate: 0.007 }
      ],
      best_topics: [
        { topic: 'health optimization', conversion_rate: 0.009 }
      ],
      best_formats: [
        { format: 'thread', conversion_rate: 0.01 },
        { format: 'single', conversion_rate: 0.006 }
      ],
      avg_engagement_rate: 0.03,
      avg_click_rate: 0.1,
      avg_follow_rate: 0.4,
      biggest_dropoff: 'engagement',
      recommendations: [
        'Start collecting funnel data to get personalized insights',
        'Focus on engagement first (hooks, controversy)',
        'Optimize bio for conversion',
        'Track what content drives profile clicks'
      ]
    };
  }

  /**
   * Predict conversion for new content BEFORE posting
   */
  async predictConversion(content: {
    content_type: string;
    topic: string;
    format: 'single' | 'thread';
    has_controversy: boolean;
    has_numbers: boolean;
  }): Promise<{
    predicted_follows: number;
    confidence: number;
    reasoning: string;
  }> {
    const insights = await this.getConversionInsights();

    let conversionRate = 0.005; // Base 0.5% conversion

    // Adjust based on best performers
    const bestType = insights.best_content_types.find(t => t.type === content.content_type);
    if (bestType) {
      conversionRate = bestType.conversion_rate;
    }

    const bestFormat = insights.best_formats.find(f => f.format === content.format);
    if (bestFormat && bestFormat.format === 'thread') {
      conversionRate *= 1.5; // Threads boost
    }

    if (content.has_controversy) conversionRate *= 1.3;
    if (content.has_numbers) conversionRate *= 1.2;

    // Assume 500 impressions on average
    const predictedFollows = Math.round(500 * conversionRate);

    const reasoning = `Based on ${insights.best_content_types.length} similar posts, ` +
      `${content.format} format with ${content.has_controversy ? 'controversy' : 'standard approach'} ` +
      `should convert at ${(conversionRate * 100).toFixed(2)}%`;

    return {
      predicted_follows: predictedFollows,
      confidence: insights.best_content_types.length > 10 ? 0.8 : 0.5,
      reasoning
    };
  }
}

export const getConversionFunnelTracker = () => ConversionFunnelTracker.getInstance();

