/**
 * Engagement Tracker
 * Monitors tweet performance and buckets engagement levels
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/environment';

export interface EngagementMetrics {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  followers_gained: number;
  collected_at: string;
}

export interface EngagementBucket {
  bucket: 'dead' | 'low' | 'medium' | 'high';
  score: number;
  follow_through_rate: number;
  save_rate_proxy: number;
  hook_keeper_score: number;
}

export class EngagementTracker {
  private static instance: EngagementTracker;
  private supabase: any;

  private constructor() {
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  }

  public static getInstance(): EngagementTracker {
    if (!EngagementTracker.instance) {
      EngagementTracker.instance = new EngagementTracker();
    }
    return EngagementTracker.instance;
  }

  /**
   * Evaluate thread performance 2 hours after posting
   */
  async evaluateThreadPerformance(rootTweetId: string): Promise<EngagementBucket> {
    try {
      console.log(`📊 Evaluating thread performance: ${rootTweetId}`);

      // Get thread metrics
      const metrics = await this.getThreadMetrics(rootTweetId);
      if (!metrics) {
        return { bucket: 'dead', score: 0, follow_through_rate: 0, save_rate_proxy: 0, hook_keeper_score: 0 };
      }

      // Get follower count for normalization
      const followerCount = await this.getCurrentFollowerCount();
      
      // Calculate engagement bucket
      const bucket = this.calculateEngagementBucket(metrics, followerCount);
      
      // Store the evaluation
      await this.storeBucketEvaluation(rootTweetId, bucket, metrics);
      
      console.log(`✅ Thread ${rootTweetId} bucketed as: ${bucket.bucket} (score: ${bucket.score.toFixed(2)})`);
      
      return bucket;

    } catch (error) {
      console.error(`❌ Failed to evaluate thread ${rootTweetId}:`, error);
      return { bucket: 'dead', score: 0, follow_through_rate: 0, save_rate_proxy: 0, hook_keeper_score: 0 };
    }
  }

  private async getThreadMetrics(rootTweetId: string): Promise<EngagementMetrics | null> {
    // Try to get from existing metrics table
    const { data, error } = await this.supabase
      .from('tweet_metrics')
      .select('*')
      .eq('tweet_id', rootTweetId)
      .order('collected_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Could not fetch tweet metrics:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.log(`No metrics found for ${rootTweetId}, returning zero metrics`);
      return {
        tweet_id: rootTweetId,
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        followers_gained: 0,
        collected_at: new Date().toISOString()
      };
    }

    const metrics = data[0];
    return {
      tweet_id: rootTweetId,
      likes: metrics.likes || 0,
      retweets: metrics.retweets || 0,
      replies: metrics.replies || 0,
      impressions: metrics.impressions || 0,
      followers_gained: metrics.followers_gained || 0,
      collected_at: metrics.collected_at
    };
  }

  private async getCurrentFollowerCount(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('follower_snapshots')
        .select('follower_count')
        .order('snapshot_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        console.warn('Could not get follower count, using 1000 as default');
        return 1000; // Default fallback
      }

      return data[0].follower_count || 1000;
    } catch (error) {
      console.warn('Error getting follower count:', error);
      return 1000;
    }
  }

  private calculateEngagementBucket(metrics: EngagementMetrics, followerCount: number): EngagementBucket {
    // Calculate engagement per 1000 followers
    const normalizedImpressions = (metrics.impressions / followerCount) * 1000;
    const totalEngagement = metrics.likes + (metrics.retweets * 2) + (metrics.replies * 3);
    const engagementPer1k = (totalEngagement / followerCount) * 1000;
    
    // Calculate follow-through rate (new followers / impressions)
    const followThroughRate = metrics.impressions > 0 ? 
      (metrics.followers_gained / metrics.impressions) * 100 : 0;
    
    // Calculate save rate proxy (likes + replies per 1k followers)
    const saveRateProxy = ((metrics.likes + metrics.replies) / followerCount) * 1000;
    
    // Calculate hook keeper score (early engagement within first hour)
    // For now, use reply ratio as proxy
    const hookKeeperScore = totalEngagement > 0 ? 
      (metrics.replies / totalEngagement) * 100 : 0;

    // Calculate overall score
    const score = engagementPer1k + (followThroughRate * 2) + (saveRateProxy * 0.5);

    // Determine bucket based on thresholds
    let bucket: 'dead' | 'low' | 'medium' | 'high';
    
    if (score < 0.4) {
      bucket = 'dead';
    } else if (score < 1.0) {
      bucket = 'low';
    } else if (score < 2.5) {
      bucket = 'medium';
    } else {
      bucket = 'high';
    }

    console.log(`📊 Metrics for ${metrics.tweet_id}:`);
    console.log(`   Engagement per 1k: ${engagementPer1k.toFixed(2)}`);
    console.log(`   Follow-through rate: ${followThroughRate.toFixed(2)}%`);
    console.log(`   Save rate proxy: ${saveRateProxy.toFixed(2)}`);
    console.log(`   Overall score: ${score.toFixed(2)} → ${bucket}`);

    return {
      bucket,
      score,
      follow_through_rate: followThroughRate,
      save_rate_proxy: saveRateProxy,
      hook_keeper_score: hookKeeperScore
    };
  }

  private async storeBucketEvaluation(
    rootTweetId: string, 
    bucket: EngagementBucket, 
    metrics: EngagementMetrics
  ): Promise<void> {
    try {
      // Update the posted_threads table with engagement data
      const { error: updateError } = await this.supabase
        .from('posted_threads')
        .update({
          engagement_bucket: bucket.bucket,
          engagement_score: bucket.score,
          follow_through_rate: bucket.follow_through_rate,
          save_rate_proxy: bucket.save_rate_proxy,
          hook_keeper_score: bucket.hook_keeper_score,
          final_likes: metrics.likes,
          final_retweets: metrics.retweets,
          final_replies: metrics.replies,
          final_impressions: metrics.impressions,
          evaluated_at: new Date().toISOString()
        })
        .eq('root_tweet_id', rootTweetId);

      if (updateError) {
        console.error('Failed to update thread with engagement data:', updateError);
      }

      // Also store in a dedicated evaluation table for detailed tracking
      const { error: insertError } = await this.supabase
        .from('engagement_evaluations')
        .insert({
          root_tweet_id: rootTweetId,
          engagement_bucket: bucket.bucket,
          engagement_score: bucket.score,
          follow_through_rate: bucket.follow_through_rate,
          save_rate_proxy: bucket.save_rate_proxy,
          hook_keeper_score: bucket.hook_keeper_score,
          total_likes: metrics.likes,
          total_retweets: metrics.retweets,
          total_replies: metrics.replies,
          total_impressions: metrics.impressions,
          followers_gained: metrics.followers_gained,
          evaluated_at: new Date().toISOString()
        });

      if (insertError) {
        console.warn('Could not store detailed evaluation:', insertError);
      }

    } catch (error) {
      console.error('Error storing bucket evaluation:', error);
    }
  }

  /**
   * Schedule evaluation for 2 hours after posting
   */
  scheduleEvaluation(rootTweetId: string): void {
    const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    
    setTimeout(async () => {
      console.log(`⏰ Running scheduled evaluation for ${rootTweetId}`);
      await this.evaluateThreadPerformance(rootTweetId);
    }, twoHours);
    
    console.log(`⏰ Scheduled evaluation for ${rootTweetId} in 2 hours`);
  }

  /**
   * Get performance trends for learning
   */
  async getPerformanceTrends(days: number = 14): Promise<any[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await this.supabase
      .from('posted_threads')
      .select(`
        root_tweet_id,
        topic,
        quality_score,
        engagement_bucket,
        engagement_score,
        follow_through_rate,
        metadata,
        posted_at
      `)
      .gte('posted_at', since)
      .not('engagement_bucket', 'is', null)
      .order('posted_at', { ascending: false });

    if (error) {
      console.error('Failed to get performance trends:', error);
      return [];
    }

    return data || [];
  }
}
