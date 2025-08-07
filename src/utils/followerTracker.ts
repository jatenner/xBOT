/**
 * 🔍 FOLLOWER TRACKER
 * Tracks follower changes before/after posts for precise reward calculation
 * Integrates with existing IntelligentGrowthMaster analytics
 */

import { supabaseClient } from './supabaseClient';
import { BrowserTweetPoster } from './browserTweetPoster';

export interface FollowerSnapshot {
  timestamp: Date;
  followerCount: number;
  followingCount: number;
  tweetsCount: number;
  accountHandle: string;
}

export interface FollowerDelta {
  beforeSnapshot: FollowerSnapshot;
  afterSnapshot: FollowerSnapshot;
  followerGain: number;
  timeWindow: number; // minutes
  associatedTweetId?: string;
  confidence: number; // 0-1 how confident this gain is from the tweet
}

export class FollowerTracker {
  private static instance: FollowerTracker;
  private browserPoster: BrowserTweetPoster;
  private recentSnapshots: Map<string, FollowerSnapshot> = new Map();

  private constructor() {
    this.browserPoster = new BrowserTweetPoster();
  }

  static getInstance(): FollowerTracker {
    if (!FollowerTracker.instance) {
      FollowerTracker.instance = new FollowerTracker();
    }
    return FollowerTracker.instance;
  }

  /**
   * 📊 Get current follower count via browser scraping
   */
  async getCurrentFollowerCount(): Promise<FollowerSnapshot | null> {
    try {
      console.log('🔍 Capturing follower snapshot...');
      
      // Navigate to profile to get follower count
      // Use browser automation similar to posting flow
      const browser = await require('playwright').chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('https://x.com/settings/profile', { waitUntil: 'networkidle' });
      
      // Try multiple selectors for follower count
      const followerSelectors = [
        '[data-testid="followers"] span',
        'a[href*="/followers"] span',
        'a[href$="/followers"] span',
        '.profile-stats .followers .number',
        '.ProfileNav-item--followers .ProfileNav-value'
      ];
      
      let followerCount = 0;
      for (const selector of followerSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await element.textContent();
            if (text) {
              // Parse follower count (handle K, M notation)
              followerCount = this.parseFollowerCount(text);
              if (followerCount > 0) break;
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Get additional profile stats
      let followingCount = 0;
      let tweetsCount = 0;
      
      try {
        const followingElement = await page.$('[data-testid="following"] span');
        if (followingElement) {
          const followingText = await followingElement.textContent();
          followingCount = this.parseFollowerCount(followingText || '0');
        }
      } catch (error) {
        console.warn('Could not get following count:', error);
      }

      const snapshot: FollowerSnapshot = {
        timestamp: new Date(),
        followerCount,
        followingCount,
        tweetsCount,
        accountHandle: process.env.TWITTER_USERNAME || 'unknown'
      };

      console.log(`📊 Follower snapshot: ${followerCount} followers, ${followingCount} following`);
      
      // Store in memory for quick access
      this.recentSnapshots.set('latest', snapshot);
      
      // Store in database
      await this.storeSnapshot(snapshot);
      
      // Clean up browser
      await browser.close();
      
      return snapshot;
      
    } catch (error) {
      console.error('❌ Error capturing follower snapshot:', error);
      return null;
    }
  }

  /**
   * 📈 Track follower change for a specific tweet
   */
  async trackFollowerChange(tweetId: string): Promise<FollowerDelta | null> {
    try {
      // Get snapshot from 90 minutes ago (before post)
      const beforeSnapshot = await this.getSnapshotBefore(90);
      if (!beforeSnapshot) {
        console.warn('⚠️ No before snapshot available for follower tracking');
        return null;
      }

      // Get current snapshot (after post)
      const afterSnapshot = await this.getCurrentFollowerCount();
      if (!afterSnapshot) {
        console.warn('⚠️ Could not get current follower snapshot');
        return null;
      }

      const followerGain = afterSnapshot.followerCount - beforeSnapshot.followerCount;
      const timeWindow = Math.abs(afterSnapshot.timestamp.getTime() - beforeSnapshot.timestamp.getTime()) / (1000 * 60);
      
      // Calculate confidence based on time window and other factors
      const confidence = this.calculateConfidence(timeWindow, followerGain);

      const delta: FollowerDelta = {
        beforeSnapshot,
        afterSnapshot,
        followerGain,
        timeWindow,
        associatedTweetId: tweetId,
        confidence
      };

      console.log(`📈 Follower delta for tweet ${tweetId}: ${followerGain > 0 ? '+' : ''}${followerGain} followers (confidence: ${Math.round(confidence * 100)}%)`);
      
      // Store the delta for analytics
      await this.storeFollowerDelta(delta);
      
      return delta;
      
    } catch (error) {
      console.error('❌ Error tracking follower change:', error);
      return null;
    }
  }

  /**
   * 🧮 Parse follower count from various text formats
   */
  private parseFollowerCount(text: string): number {
    if (!text) return 0;
    
    // Remove commas and whitespace
    const cleaned = text.replace(/[,\s]/g, '');
    
    // Handle K, M notation
    if (cleaned.toLowerCase().includes('k')) {
      return Math.round(parseFloat(cleaned) * 1000);
    } else if (cleaned.toLowerCase().includes('m')) {
      return Math.round(parseFloat(cleaned) * 1000000);
    } else {
      return parseInt(cleaned) || 0;
    }
  }

  /**
   * 🎯 Calculate confidence that follower gain is from this tweet
   */
  private calculateConfidence(timeWindow: number, followerGain: number): number {
    let confidence = 1.0;
    
    // Reduce confidence for longer time windows
    if (timeWindow > 120) confidence *= 0.7; // 2+ hours
    if (timeWindow > 180) confidence *= 0.5; // 3+ hours
    
    // Reduce confidence for very large gains (likely other factors)
    if (Math.abs(followerGain) > 50) confidence *= 0.6;
    if (Math.abs(followerGain) > 100) confidence *= 0.3;
    
    // Reduce confidence for losses (unlikely to be tweet-related)
    if (followerGain < 0) confidence *= 0.4;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * 📚 Get follower snapshot from X minutes ago
   */
  private async getSnapshotBefore(minutes: number): Promise<FollowerSnapshot | null> {
    try {
      const { data, error } = await supabaseClient.supabase!.from('follower_snapshots')
        .select('*')
        .gte('timestamp', new Date(Date.now() - minutes * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return {
        timestamp: new Date(data.timestamp),
        followerCount: data.follower_count,
        followingCount: data.following_count,
        tweetsCount: data.tweets_count,
        accountHandle: data.account_handle
      };
      
    } catch (error) {
      console.error('❌ Error getting previous snapshot:', error);
      return null;
    }
  }

  /**
   * 💾 Store follower snapshot in database
   */
  private async storeSnapshot(snapshot: FollowerSnapshot): Promise<void> {
    try {
      await supabaseClient.supabase!.from('follower_snapshots').insert({
        timestamp: snapshot.timestamp.toISOString(),
        follower_count: snapshot.followerCount,
        following_count: snapshot.followingCount,
        tweets_count: snapshot.tweetsCount,
        account_handle: snapshot.accountHandle
      });
    } catch (error) {
      console.error('❌ Error storing follower snapshot:', error);
    }
  }

  /**
   * 💾 Store follower delta analysis
   */
  private async storeFollowerDelta(delta: FollowerDelta): Promise<void> {
    try {
      await supabaseClient.supabase!.from('follower_deltas').insert({
        tweet_id: delta.associatedTweetId,
        before_count: delta.beforeSnapshot.followerCount,
        after_count: delta.afterSnapshot.followerCount,
        follower_gain: delta.followerGain,
        time_window_minutes: delta.timeWindow,
        confidence: delta.confidence,
        timestamp: delta.afterSnapshot.timestamp.toISOString()
      });
    } catch (error) {
      console.error('❌ Error storing follower delta:', error);
    }
  }

  /**
   * 📊 Get follower performance for a tweet (async - waits for data to settle)
   */
  async getFollowerPerformance(tweetId: string, waitMinutes: number = 90): Promise<FollowerDelta | null> {
    console.log(`⏰ Waiting ${waitMinutes} minutes for follower data to settle for tweet ${tweetId}...`);
    
    // In production, this would be called by a scheduled job
    // For now, we'll return existing data if available
    try {
      const { data, error } = await supabaseClient.supabase!.from('follower_deltas')
        .select('*')
        .eq('tweet_id', tweetId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return {
        beforeSnapshot: {
          timestamp: new Date(data.timestamp),
          followerCount: data.before_count,
          followingCount: 0,
          tweetsCount: 0,
          accountHandle: ''
        },
        afterSnapshot: {
          timestamp: new Date(data.timestamp),
          followerCount: data.after_count,
          followingCount: 0,
          tweetsCount: 0,
          accountHandle: ''
        },
        followerGain: data.follower_gain,
        timeWindow: data.time_window_minutes,
        associatedTweetId: data.tweet_id,
        confidence: data.confidence
      };
      
    } catch (error) {
      console.error('❌ Error getting follower performance:', error);
      return null;
    }
  }
}