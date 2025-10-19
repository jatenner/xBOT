/**
 * 📊 DATA COLLECTION ENGINE - FULL IMPLEMENTATION
 * Comprehensive data collection system for AI learning
 * 
 * Collects ALL metrics needed for sophisticated learning:
 * - Post performance metrics (likes, retweets, replies, saves, views)
 * - Follower attribution (before, 2h, 24h, 48h after posting)
 * - Timing effectiveness patterns
 * - Content quality indicators
 */

import { getSupabaseClient } from '../db/index';

interface PostMetrics {
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  bookmarks: number | null;
  views: number | null;
  impressions: number | null;
  profile_clicks: number | null;
}

interface ComprehensiveDataPoint {
  postId: string;
  timestamp: Date;
  content: string;
  contentType: 'single' | 'thread';
  
  // Performance metrics
  metrics: PostMetrics;
  
  // Follower data
  followerData: {
    followersAtPosting: number;
    followersAfter2Hours?: number;
    followersAfter24Hours?: number;
    followersAfter48Hours?: number;
    followersGained: number;
  };
  
  // Contextual factors
  context: {
    dayOfWeek: number;
    hour: number;
    isWeekend: boolean;
  };
}

export class DataCollectionEngine {
  private static instance: DataCollectionEngine;
  private supabase = getSupabaseClient();
  private dataPoints: ComprehensiveDataPoint[] = [];

  private constructor() {}

  public static getInstance(): DataCollectionEngine {
    if (!DataCollectionEngine.instance) {
      DataCollectionEngine.instance = new DataCollectionEngine();
    }
    return DataCollectionEngine.instance;
  }

  /**
   * Main entry point for comprehensive data collection (called by job manager)
   */
  public async collectComprehensiveData(): Promise<void> {
    console.log('[DATA_ENGINE] 🚀 Starting comprehensive data collection cycle...');
    
    try {
      // Collect metrics for recent posts
      await this.collectRecentPostMetrics();
      
      // Track follower growth
      await this.trackFollowerGrowth();
      
      console.log('[DATA_ENGINE] ✅ Data collection cycle completed');
    } catch (error: any) {
      console.error('[DATA_ENGINE] ❌ Error:', error.message);
    }
  }

  /**
   * Collect metrics for posts from the last 48 hours
   */
  private async collectRecentPostMetrics(): Promise<void> {
    try {
      console.log('[DATA_ENGINE] 📊 Collecting metrics for recent posts...');
      
      // Get posts from last 48 hours that need metrics
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const { data: recentPosts, error } = await this.supabase
        .from('posted_decisions')
        .select('decision_id, content, posted_at, tweet_id')
        .gte('posted_at', cutoffTime.toISOString())
        .order('posted_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[DATA_ENGINE] ❌ Error fetching recent posts:', error.message);
        return;
      }

      if (!recentPosts || recentPosts.length === 0) {
        console.log('[DATA_ENGINE] ℹ️ No recent posts to collect metrics for');
        return;
      }

      console.log(`[DATA_ENGINE] 📝 Found ${recentPosts.length} recent posts`);

      // Collect metrics for each post
      for (const post of recentPosts) {
        try {
          const postId = String(post.decision_id);
          const tweetId = String(post.tweet_id || '');
          if (tweetId) {
            await this.collectPostMetrics(postId, tweetId);
          }
        } catch (error: any) {
          console.error(`[DATA_ENGINE] ⚠️ Error collecting metrics for ${post.decision_id}:`, error.message);
          // Continue with next post
        }
      }

      console.log('[DATA_ENGINE] ✅ Recent post metrics collection completed');
    } catch (error: any) {
      console.error('[DATA_ENGINE] ❌ Error in collectRecentPostMetrics:', error.message);
    }
  }

  /**
   * Collect metrics for a specific post using bulletproof scraper
   */
  private async collectPostMetrics(postId: string, tweetId: string): Promise<void> {
    try {
      console.log(`[DATA_ENGINE] 📊 Collecting metrics for post ${postId}...`);

      // Use bulletproof scraper for metrics collection
      const { getBulletproofScraper } = await import('../scrapers/bulletproofTwitterScraper');
      const { BrowserManager } = await import('../browser/browserManager');
      
      const scraper = getBulletproofScraper();
      const manager = BrowserManager.getInstance();
      const page = await manager.getPage();
      
      let metrics: any = null;
      
      try {
        // Navigate to tweet
        const tweetUrl = `https://twitter.com/anyuser/status/${tweetId}`;
        await page.goto(tweetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Scrape metrics
        const result = await scraper.scrapeTweetMetrics(page, tweetId, 3);
        
        if (result.success && result.metrics) {
          metrics = {
            likes: result.metrics.likes,
            retweets: result.metrics.retweets,
            replies: result.metrics.replies,
            bookmarks: result.metrics.bookmarks,
            views: result.metrics.views,
            impressions: result.metrics.views || 0,
            profile_clicks: 0
          };
        }
      } finally {
        await manager.releasePage(page);
      }
      
      if (metrics) {
        // Store basic metrics in database
        await this.storePostMetrics(postId, tweetId, metrics);
        
        // 🚀 COLLECT COMPREHENSIVE METRICS (40+ data points)
        try {
          const { EnhancedMetricsCollector } = await import('./enhancedMetricsCollector');
          const collector = EnhancedMetricsCollector.getInstance();
          
          // Get content for analysis
          const { data: contentData } = await this.supabase
            .from('content_metadata')
            .select('content')
            .eq('decision_id', postId)
            .single();
          
          if (contentData && contentData.content && typeof contentData.content === 'string') {
            await collector.collectDetailedMetrics(postId, contentData.content, metrics);
            console.log(`[DATA_ENGINE] ✅ Comprehensive metrics collected for ${postId}`);
          }
        } catch (error: any) {
          console.error(`[DATA_ENGINE] ⚠️ Enhanced metrics collection failed for ${postId}:`, error.message);
          // Don't fail the whole process if enhanced metrics fail
        }
        
        console.log(`[DATA_ENGINE] ✅ Metrics collected for ${postId}`);
      } else {
        console.log(`[DATA_ENGINE] ⚠️ No metrics available for ${postId}`);
      }
    } catch (error: any) {
      console.error(`[DATA_ENGINE] ❌ Error collecting metrics for ${postId}:`, error.message);
    }
  }

  /**
   * Store collected metrics in database
   */
  private async storePostMetrics(postId: string, tweetId: string, metrics: any): Promise<void> {
    try {
      // PHASE 4 FIX: Store null instead of 0 when metrics unavailable
      // This prevents fake data from corrupting the learning system
      const { error } = await this.supabase
        .from('outcomes')
        .upsert({
          decision_id: postId,
          tweet_id: tweetId,
          likes: metrics.likes ?? null,          // Use null, not 0
          retweets: metrics.retweets ?? null,    // Use null, not 0
          replies: metrics.replies ?? null,      // Use null, not 0
          bookmarks: metrics.bookmarks ?? null,  // Use null, not 0
          views: metrics.views ?? null,          // Use null, not 0
          impressions: metrics.impressions ?? null,      // Use null, not 0
          profile_clicks: metrics.profile_clicks ?? null, // Use null, not 0
          collected_at: new Date().toISOString(),
          data_source: 'data_collection_engine',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'decision_id'
        });

      if (error) {
        console.error('[DATA_ENGINE] ❌ Error storing metrics:', error.message);
      }
    } catch (error: any) {
      console.error('[DATA_ENGINE] ❌ Error in storePostMetrics:', error.message);
    }
  }
  
  /**
   * Track follower growth and attribute to posts
   */
  private async trackFollowerGrowth(): Promise<void> {
    try {
      console.log('[DATA_ENGINE] 👥 Tracking follower growth...');

      // Get current follower count
      const { getCurrentFollowerCount } = await import('../tracking/followerCountTracker');
      const currentFollowers = await getCurrentFollowerCount();

      console.log(`[DATA_ENGINE] 📊 Current follower count: ${currentFollowers}`);

      // Get posts from last 48 hours for attribution
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
      
      const { data: recentPosts, error } = await this.supabase
        .from('posted_decisions')
        .select('decision_id, posted_at')
        .gte('posted_at', cutoffTime.toISOString())
        .order('posted_at', { ascending: false });

      if (error || !recentPosts || recentPosts.length === 0) {
        console.log('[DATA_ENGINE] ℹ️ No recent posts for follower attribution');
        return;
      }

      // Update follower attribution for each post based on timing
      for (const post of recentPosts) {
        try {
          const postId = String(post.decision_id);
          const postedAt = String(post.posted_at);
          await this.updateFollowerAttribution(postId, postedAt, currentFollowers);
        } catch (error: any) {
          console.error(`[DATA_ENGINE] ⚠️ Error updating attribution for ${post.decision_id}:`, error.message);
        }
      }

      console.log('[DATA_ENGINE] ✅ Follower growth tracking completed');
    } catch (error: any) {
      console.error('[DATA_ENGINE] ❌ Error in trackFollowerGrowth:', error.message);
    }
  }

  /**
   * Update follower attribution for a specific post
   */
  private async updateFollowerAttribution(
    postId: string, 
    postedAt: string, 
    currentFollowers: number
  ): Promise<void> {
    try {
      const postTime = new Date(postedAt);
      const now = new Date();
      const hoursSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);

      // Determine which attribution window to update
      let updateData: any = {};
      
      if (hoursSincePost >= 2 && hoursSincePost < 24) {
        // Update 2-hour mark
        updateData.followers_2h_after = currentFollowers;
      } else if (hoursSincePost >= 24 && hoursSincePost < 48) {
        // Update 24-hour mark
        updateData.followers_24h_after = currentFollowers;
      } else if (hoursSincePost >= 48) {
        // Update 48-hour mark (final)
        updateData.followers_48h_after = currentFollowers;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();

        const { error } = await this.supabase
          .from('post_attribution')
          .update(updateData)
          .eq('post_id', postId);

        if (error) {
          console.error(`[DATA_ENGINE] ⚠️ Error updating attribution for ${postId}:`, error.message);
      } else {
          console.log(`[DATA_ENGINE] ✅ Updated attribution for ${postId} (${hoursSincePost.toFixed(1)}h after post)`);
        }
      }
    } catch (error: any) {
      console.error('[DATA_ENGINE] ❌ Error in updateFollowerAttribution:', error.message);
    }
  }
  
  /**
   * Get data collection status
   */
  public getDataStatus(): {
    totalDataPoints: number;
    dataQuality: number;
  } {
    return {
      totalDataPoints: this.dataPoints.length,
      dataQuality: Math.min(this.dataPoints.length / 50, 1)
    };
  }
}

export const getDataCollectionEngine = () => DataCollectionEngine.getInstance();
