/**
 * 📊 CONTINUOUS ENGAGEMENT MONITOR
 * 
 * Tracks individual posts over time to capture engagement growth patterns
 * - Monitors posts at multiple intervals (1hr, 4hr, 12hr, 24hr, 48hr)
 * - Updates database with latest metrics for each post
 * - Captures engagement velocity and trending patterns
 * - Provides real-time learning data for posting optimization
 */

import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { createClient } from '@supabase/supabase-js';

interface EngagementSnapshot {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  timestamp: string;
  hours_since_post: number;
  engagement_velocity: number; // Change since last snapshot
  is_trending: boolean;
}

interface PostTrackingSchedule {
  tweet_id: string;
  post_time: string;
  check_intervals: number[]; // Hours after posting: [1, 4, 12, 24, 48]
  completed_checks: number[];
  next_check_at: string;
}

export class ContinuousEngagementMonitor {
  private static instance: ContinuousEngagementMonitor;
  private supabase: any;
  private isRunning = false;
  private checkInterval = 30 * 60 * 1000; // Check every 30 minutes
  private trackingSchedules: Map<string, PostTrackingSchedule> = new Map();

  private constructor() {
    this.initializeSupabase();
  }

  public static getInstance(): ContinuousEngagementMonitor {
    if (!ContinuousEngagementMonitor.instance) {
      ContinuousEngagementMonitor.instance = new ContinuousEngagementMonitor();
    }
    return ContinuousEngagementMonitor.instance;
  }

  private async initializeSupabase() {
    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
      log({ op: 'continuous_monitor_init', status: 'error', reason: 'missing_credentials' });
      return;
    }

    this.supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
    log({ op: 'continuous_monitor_init', status: 'success' });
  }

  /**
   * 🎯 Start monitoring a new post with defined check intervals
   */
  public async startTrackingPost(tweetId: string, postTime: Date = new Date()): Promise<void> {
    log({ op: 'continuous_monitor_track', tweet_id: tweetId });

    // Define check intervals: 1hr, 4hr, 12hr, 24hr, 48hr after posting
    const checkIntervals = [1, 4, 12, 24, 48];
    
    const schedule: PostTrackingSchedule = {
      tweet_id: tweetId,
      post_time: postTime.toISOString(),
      check_intervals: checkIntervals,
      completed_checks: [],
      next_check_at: new Date(postTime.getTime() + (1 * 60 * 60 * 1000)).toISOString() // First check in 1 hour
    };

    this.trackingSchedules.set(tweetId, schedule);

    // Store initial tracking record in database
    try {
      await this.supabase
        .from('engagement_tracking_schedule')
        .insert([{
          tweet_id: tweetId,
          post_time: postTime.toISOString(),
          check_intervals: checkIntervals,
          completed_checks: [],
          next_check_at: schedule.next_check_at,
          created_at: new Date().toISOString()
        }]);

      console.log(`✅ TRACKING_SCHEDULED: ${tweetId} will be monitored at ${checkIntervals.length} intervals`);
    } catch (error) {
      console.error('❌ Failed to store tracking schedule:', error);
    }

    // Start monitoring if not already running
    if (!this.isRunning) {
      this.startMonitoringLoop();
    }
  }

  /**
   * 🔄 Main monitoring loop - checks every 30 minutes for due posts
   */
  private async startMonitoringLoop(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 CONTINUOUS_MONITOR: Starting monitoring loop');

    const runCheck = async () => {
      try {
        await this.checkDuePosts();
      } catch (error) {
        console.error('❌ MONITOR_LOOP: Error in check cycle:', error);
      }
    };

    // Run initial check
    await runCheck();

    // Set up recurring checks
    setInterval(runCheck, this.checkInterval);
  }

  /**
   * 📋 Check which posts are due for engagement tracking
   */
  private async checkDuePosts(): Promise<void> {
    const now = new Date();
    console.log(`🔍 CONTINUOUS_MONITOR: Checking for due posts at ${now.toISOString()}`);

    try {
      // Load tracking schedules from database if not in memory
      if (this.trackingSchedules.size === 0) {
        await this.loadTrackingSchedules();
      }

      const dueSchedules: PostTrackingSchedule[] = [];

      // Check in-memory schedules
      for (const [tweetId, schedule] of this.trackingSchedules) {
        if (new Date(schedule.next_check_at) <= now && schedule.completed_checks.length < schedule.check_intervals.length) {
          dueSchedules.push(schedule);
        }
      }

      if (dueSchedules.length === 0) {
        console.log('📊 CONTINUOUS_MONITOR: No posts due for tracking');
        return;
      }

      console.log(`📊 TRACKING_DUE: ${dueSchedules.length} posts ready for engagement check`);

      // Process each due post
      for (const schedule of dueSchedules) {
        await this.trackPostEngagement(schedule);
      }

    } catch (error) {
      console.error('❌ CHECK_DUE_POSTS failed:', error);
    }
  }

  /**
   * 📊 Track engagement for a specific post and update database
   */
  private async trackPostEngagement(schedule: PostTrackingSchedule): Promise<void> {
    const { tweet_id, post_time, check_intervals, completed_checks } = schedule;
    
    try {
      console.log(`📊 TRACKING_ENGAGEMENT: ${tweet_id} (${completed_checks.length + 1}/${check_intervals.length})`);

      // Get current engagement metrics using browser automation
      const metrics = await this.scrapeEngagementMetrics(tweet_id);
      
      if (!metrics) {
        console.warn(`⚠️ Failed to get metrics for ${tweet_id}, will retry next cycle`);
        return;
      }

      // Calculate time since post
      const postTime = new Date(post_time);
      const now = new Date();
      const hoursSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);

      // Calculate engagement velocity (change since last snapshot)
      const previousSnapshot = await this.getLastSnapshot(tweet_id);
      const engagementVelocity = previousSnapshot 
        ? (metrics.likes + metrics.retweets + metrics.replies) - (previousSnapshot.likes + previousSnapshot.retweets + previousSnapshot.replies)
        : metrics.likes + metrics.retweets + metrics.replies;

      // Determine if trending (high velocity relative to time)
      const isTrending = engagementVelocity > (hoursSincePost * 2); // More than 2 engagements per hour

      // Create engagement snapshot
      const snapshot: EngagementSnapshot = {
        tweet_id,
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        impressions: metrics.impressions || 0,
        timestamp: now.toISOString(),
        hours_since_post: Math.round(hoursSincePost * 100) / 100,
        engagement_velocity: engagementVelocity,
        is_trending: isTrending
      };

      // Store snapshot in database
      await this.storeEngagementSnapshot(snapshot);

      // Update tracking schedule
      const currentInterval = check_intervals[completed_checks.length];
      const updatedCompletedChecks = [...completed_checks, currentInterval];
      const nextIntervalIndex = updatedCompletedChecks.length;
      
      let nextCheckAt: Date | null = null;
      if (nextIntervalIndex < check_intervals.length) {
        const nextInterval = check_intervals[nextIntervalIndex];
        nextCheckAt = new Date(postTime.getTime() + (nextInterval * 60 * 60 * 1000));
      }

      // Update schedule in memory and database
      schedule.completed_checks = updatedCompletedChecks;
      schedule.next_check_at = nextCheckAt ? nextCheckAt.toISOString() : '';

      await this.updateTrackingSchedule(tweet_id, schedule);

      console.log(`✅ ENGAGEMENT_TRACKED: ${tweet_id} - ${metrics.likes}❤️ ${metrics.retweets}🔄 ${metrics.replies}💬 (velocity: +${engagementVelocity})`);
      
      if (isTrending) {
        console.log(`🔥 TRENDING_DETECTED: ${tweet_id} is gaining momentum!`);
      }

      // Remove from tracking if all intervals completed
      if (updatedCompletedChecks.length >= check_intervals.length) {
        this.trackingSchedules.delete(tweet_id);
        console.log(`🏁 TRACKING_COMPLETE: ${tweet_id} finished all ${check_intervals.length} intervals`);
      }

    } catch (error) {
      console.error(`❌ Failed to track engagement for ${tweet_id}:`, error);
    }
  }

  /**
   * 🌐 Scrape engagement metrics using browser automation
   */
  private async scrapeEngagementMetrics(tweetId: string): Promise<{
    likes: number;
    retweets: number;
    replies: number;
    impressions?: number;
  } | null> {
    try {
      // Import browser automation
      const { TweetMetricsTracker } = await import('./trackTweet');
      const tracker = TweetMetricsTracker.getInstance();
      
      const result = await tracker.trackTweet(tweetId);
      
      if (result.success && result.metrics) {
        return {
          likes: result.metrics.likes,
          retweets: result.metrics.retweets,
          replies: result.metrics.replies,
          impressions: result.metrics.impressions
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Scraping failed for ${tweetId}:`, error);
      return null;
    }
  }

  /**
   * 📊 Store engagement snapshot in database
   */
  private async storeEngagementSnapshot(snapshot: EngagementSnapshot): Promise<void> {
    try {
      // Store in engagement_snapshots table
      await this.supabase
        .from('engagement_snapshots')
        .insert([snapshot]);

      // Also update the main tweet metrics with latest data
      await this.supabase
        .from('tweet_metrics')
        .upsert([{
          tweet_id: snapshot.tweet_id,
          likes: snapshot.likes,
          retweets: snapshot.retweets,
          replies: snapshot.replies,
          impressions: snapshot.impressions,
          created_at: snapshot.timestamp,
          updated_at: snapshot.timestamp
        }], {
          onConflict: 'tweet_id'
        });

      console.log(`💾 SNAPSHOT_STORED: ${snapshot.tweet_id} at ${snapshot.hours_since_post}h`);
    } catch (error) {
      console.error('❌ Failed to store engagement snapshot:', error);
    }
  }

  /**
   * 📋 Load tracking schedules from database
   */
  private async loadTrackingSchedules(): Promise<void> {
    try {
      const { data: schedules, error } = await this.supabase
        .from('engagement_tracking_schedule')
        .select('*')
        .gte('next_check_at', new Date().toISOString())
        .order('next_check_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to load tracking schedules:', error);
        return;
      }

      if (schedules) {
        for (const schedule of schedules) {
          this.trackingSchedules.set(schedule.tweet_id, {
            tweet_id: schedule.tweet_id,
            post_time: schedule.post_time,
            check_intervals: schedule.check_intervals,
            completed_checks: schedule.completed_checks || [],
            next_check_at: schedule.next_check_at
          });
        }

        console.log(`📋 SCHEDULES_LOADED: ${schedules.length} active tracking schedules`);
      }
    } catch (error) {
      console.error('❌ Failed to load tracking schedules:', error);
    }
  }

  /**
   * 🔄 Update tracking schedule in database
   */
  private async updateTrackingSchedule(tweetId: string, schedule: PostTrackingSchedule): Promise<void> {
    try {
      await this.supabase
        .from('engagement_tracking_schedule')
        .update({
          completed_checks: schedule.completed_checks,
          next_check_at: schedule.next_check_at,
          updated_at: new Date().toISOString()
        })
        .eq('tweet_id', tweetId);
    } catch (error) {
      console.error(`❌ Failed to update tracking schedule for ${tweetId}:`, error);
    }
  }

  /**
   * 📊 Get last engagement snapshot for comparison
   */
  private async getLastSnapshot(tweetId: string): Promise<EngagementSnapshot | null> {
    try {
      const { data, error } = await this.supabase
        .from('engagement_snapshots')
        .select('*')
        .eq('tweet_id', tweetId)
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0];
    } catch (error) {
      console.error(`❌ Failed to get last snapshot for ${tweetId}:`, error);
      return null;
    }
  }

  /**
   * 📈 Get engagement timeline for a specific post
   */
  public async getEngagementTimeline(tweetId: string): Promise<EngagementSnapshot[]> {
    try {
      const { data, error } = await this.supabase
        .from('engagement_snapshots')
        .select('*')
        .eq('tweet_id', tweetId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error(`❌ Failed to get timeline for ${tweetId}:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`❌ Timeline query failed for ${tweetId}:`, error);
      return [];
    }
  }

  /**
   * 📊 Generate engagement growth report
   */
  public async generateGrowthReport(tweetId: string): Promise<{
    total_snapshots: number;
    peak_velocity: number;
    peak_velocity_time: string;
    final_engagement: number;
    growth_pattern: 'viral' | 'steady' | 'slow' | 'declining';
    hourly_breakdown: { hour: number; total_engagement: number; velocity: number }[];
  } | null> {
    try {
      const timeline = await this.getEngagementTimeline(tweetId);
      
      if (timeline.length === 0) {
        return null;
      }

      const peakVelocity = Math.max(...timeline.map(s => s.engagement_velocity));
      const peakSnapshot = timeline.find(s => s.engagement_velocity === peakVelocity);
      const finalSnapshot = timeline[timeline.length - 1];
      const finalEngagement = finalSnapshot.likes + finalSnapshot.retweets + finalSnapshot.replies;

      // Determine growth pattern
      let growthPattern: 'viral' | 'steady' | 'slow' | 'declining' = 'slow';
      if (peakVelocity > 20) growthPattern = 'viral';
      else if (peakVelocity > 5) growthPattern = 'steady';
      else if (timeline.length > 2 && timeline[timeline.length - 1].engagement_velocity < timeline[0].engagement_velocity) {
        growthPattern = 'declining';
      }

      const hourlyBreakdown = timeline.map(snapshot => ({
        hour: snapshot.hours_since_post,
        total_engagement: snapshot.likes + snapshot.retweets + snapshot.replies,
        velocity: snapshot.engagement_velocity
      }));

      return {
        total_snapshots: timeline.length,
        peak_velocity: peakVelocity,
        peak_velocity_time: peakSnapshot?.timestamp || '',
        final_engagement: finalEngagement,
        growth_pattern: growthPattern,
        hourly_breakdown: hourlyBreakdown
      };
    } catch (error) {
      console.error(`❌ Growth report failed for ${tweetId}:`, error);
      return null;
    }
  }

  /**
   * 🎯 Get posts currently being tracked
   */
  public getActiveTracking(): PostTrackingSchedule[] {
    return Array.from(this.trackingSchedules.values());
  }

  /**
   * 🛑 Stop tracking a specific post
   */
  public async stopTracking(tweetId: string): Promise<void> {
    this.trackingSchedules.delete(tweetId);
    
    try {
      await this.supabase
        .from('engagement_tracking_schedule')
        .update({ next_check_at: null, updated_at: new Date().toISOString() })
        .eq('tweet_id', tweetId);
        
      console.log(`🛑 TRACKING_STOPPED: ${tweetId}`);
    } catch (error) {
      console.error(`❌ Failed to stop tracking ${tweetId}:`, error);
    }
  }
}
