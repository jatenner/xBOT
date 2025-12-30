/**
 * 📊 MULTI-POINT FOLLOWER TRACKER
 * 
 * Tracks follower count at multiple points for accurate attribution:
 * - Before post (baseline)
 * - 2 hours after (early attribution)
 * - 24 hours after (short-term attribution)
 * - 48 hours after (long-term attribution)
 */

import { getSupabaseClient } from '../db';
import { getCurrentFollowerCount } from './followerCountTracker';

export interface FollowerSnapshot {
  post_id: string;
  phase: 'before' | '2h' | '24h' | '48h';
  follower_count: number;
  timestamp: Date;
  confidence: 'high' | 'medium' | 'low';
}

export interface FollowerAttribution {
  post_id: string;
  followers_before: number;
  followers_gained_2h: number;
  followers_gained_24h: number;
  followers_gained_48h: number;
  attribution_confidence: 'high' | 'medium' | 'low';
  snapshots: {
    before?: FollowerSnapshot;
    twoHour?: FollowerSnapshot;
    twentyFourHour?: FollowerSnapshot;
    fortyEightHour?: FollowerSnapshot;
  };
}

export class MultiPointFollowerTracker {
  private static instance: MultiPointFollowerTracker;

  public static getInstance(): MultiPointFollowerTracker {
    if (!MultiPointFollowerTracker.instance) {
      MultiPointFollowerTracker.instance = new MultiPointFollowerTracker();
    }
    return MultiPointFollowerTracker.instance;
  }

  /**
   * Capture baseline follower count before posting
   */
  async captureBaseline(postId: string): Promise<number> {
    try {
      console.log(`[FOLLOWER_TRACKER] 📸 Capturing baseline for post ${postId}...`);
      
      const followerCount = await getCurrentFollowerCount();
      
      // Store snapshot
      await this.storeSnapshot(postId, 'before', followerCount);
      
      // Update content_metadata
      const supabase = getSupabaseClient();
      await supabase
        .from('content_metadata')
        .update({ followers_before: followerCount })
        .eq('decision_id', postId);
      
      console.log(`[FOLLOWER_TRACKER] ✅ Baseline captured: ${followerCount} followers`);
      
      return followerCount;
    } catch (error: any) {
      console.error(`[FOLLOWER_TRACKER] ❌ Failed to capture baseline:`, error.message);
      throw error;
    }
  }

  /**
   * Capture 2-hour snapshot
   */
  async capture2HourSnapshot(postId: string): Promise<number> {
    try {
      console.log(`[FOLLOWER_TRACKER] 📸 Capturing 2h snapshot for post ${postId}...`);
      
      const followerCount = await getCurrentFollowerCount();
      const baseline = await this.getBaseline(postId);
      
      const followersGained = followerCount - (baseline || 0);
      
      // Store snapshot
      await this.storeSnapshot(postId, '2h', followerCount);
      
      // Update content_metadata
      const supabase = getSupabaseClient();
      await supabase
        .from('content_metadata')
        .update({ 
          followers_gained_2h: followersGained,
          attribution_confidence: followersGained > 0 ? 'high' : 'medium'
        })
        .eq('decision_id', postId);
      
      console.log(`[FOLLOWER_TRACKER] ✅ 2h snapshot: ${followerCount} followers (+${followersGained})`);
      
      return followerCount;
    } catch (error: any) {
      console.error(`[FOLLOWER_TRACKER] ❌ Failed to capture 2h snapshot:`, error.message);
      throw error;
    }
  }

  /**
   * Capture 24-hour snapshot
   */
  async capture24HourSnapshot(postId: string): Promise<number> {
    try {
      console.log(`[FOLLOWER_TRACKER] 📸 Capturing 24h snapshot for post ${postId}...`);
      
      const followerCount = await getCurrentFollowerCount();
      const baseline = await this.getBaseline(postId);
      
      const followersGained = followerCount - (baseline || 0);
      
      // Store snapshot
      await this.storeSnapshot(postId, '24h', followerCount);
      
      // Update content_metadata (use 24h as primary attribution)
      const supabase = getSupabaseClient();
      await supabase
        .from('content_metadata')
        .update({ 
          followers_gained: followersGained, // Primary attribution
          followers_gained_24h: followersGained,
          attribution_confidence: this.calculateConfidence(postId, followersGained)
        })
        .eq('decision_id', postId);
      
      console.log(`[FOLLOWER_TRACKER] ✅ 24h snapshot: ${followerCount} followers (+${followersGained})`);
      
      return followerCount;
    } catch (error: any) {
      console.error(`[FOLLOWER_TRACKER] ❌ Failed to capture 24h snapshot:`, error.message);
      throw error;
    }
  }

  /**
   * Capture 48-hour snapshot
   */
  async capture48HourSnapshot(postId: string): Promise<number> {
    try {
      console.log(`[FOLLOWER_TRACKER] 📸 Capturing 48h snapshot for post ${postId}...`);
      
      const followerCount = await getCurrentFollowerCount();
      const baseline = await this.getBaseline(postId);
      
      const followersGained = followerCount - (baseline || 0);
      
      // Store snapshot
      await this.storeSnapshot(postId, '48h', followerCount);
      
      // Update content_metadata
      const supabase = getSupabaseClient();
      await supabase
        .from('content_metadata')
        .update({ 
          followers_gained_48h: followersGained
        })
        .eq('decision_id', postId);
      
      console.log(`[FOLLOWER_TRACKER] ✅ 48h snapshot: ${followerCount} followers (+${followersGained})`);
      
      return followerCount;
    } catch (error: any) {
      console.error(`[FOLLOWER_TRACKER] ❌ Failed to capture 48h snapshot:`, error.message);
      throw error;
    }
  }

  /**
   * Get all snapshots for a post and calculate attribution
   */
  async attributeFollowers(postId: string): Promise<FollowerAttribution> {
    try {
      const snapshots = await this.getSnapshotsForPost(postId);
      const baseline = snapshots.before?.follower_count || 0;
      
      const attribution: FollowerAttribution = {
        post_id: postId,
        followers_before: baseline,
        followers_gained_2h: (snapshots.twoHour?.follower_count || baseline) - baseline,
        followers_gained_24h: (snapshots.twentyFourHour?.follower_count || baseline) - baseline,
        followers_gained_48h: (snapshots.fortyEightHour?.follower_count || baseline) - baseline,
        attribution_confidence: this.calculateConfidence(postId, (snapshots.twentyFourHour?.follower_count || baseline) - baseline),
        snapshots
      };
      
      return attribution;
    } catch (error: any) {
      console.error(`[FOLLOWER_TRACKER] ❌ Failed to attribute followers:`, error.message);
      throw error;
    }
  }

  /**
   * Store snapshot in database
   */
  private async storeSnapshot(postId: string, phase: 'before' | '2h' | '24h' | '48h', followerCount: number): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Store in follower_snapshots table
    await supabase
      .from('follower_snapshots')
      .insert({
        timestamp: new Date().toISOString(),
        follower_count: followerCount,
        source: 'multi_point_tracker',
        phase: phase,
        post_id: postId
      });
  }

  /**
   * Get baseline follower count for a post
   */
  private async getBaseline(postId: string): Promise<number | null> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('content_metadata')
      .select('followers_before')
      .eq('decision_id', postId)
      .single();
    
    return data?.followers_before || null;
  }

  /**
   * Get all snapshots for a post
   */
  private async getSnapshotsForPost(postId: string): Promise<{
    before?: FollowerSnapshot;
    twoHour?: FollowerSnapshot;
    twentyFourHour?: FollowerSnapshot;
    fortyEightHour?: FollowerSnapshot;
  }> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('follower_snapshots')
      .select('*')
      .eq('post_id', postId)
      .order('timestamp', { ascending: true });
    
    const snapshots: any = {};
    
    data?.forEach((snapshot: any) => {
      const phase = snapshot.phase;
      if (phase === 'before') snapshots.before = snapshot;
      if (phase === '2h') snapshots.twoHour = snapshot;
      if (phase === '24h') snapshots.twentyFourHour = snapshot;
      if (phase === '48h') snapshots.fortyEightHour = snapshot;
    });
    
    return snapshots;
  }

  /**
   * Calculate attribution confidence
   */
  private calculateConfidence(postId: string, followersGained: number): 'high' | 'medium' | 'low' {
    // High: Followers gained within 2h window (clear attribution)
    // Medium: Followers gained within 24h window
    // Low: Followers gained within 48h window (uncertain)
    
    if (followersGained > 0) {
      // Check if we have 2h snapshot with gains
      // For now, use simple logic: if gained > 0, confidence based on timing
      return 'medium'; // Will be updated when we have 2h snapshot
    }
    
    return 'low';
  }
}



