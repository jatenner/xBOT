/**
 * 🔍 EXPLORATION MODE MANAGER
 * Detects cold start state and switches between exploration/exploitation modes
 */

import { getSupabaseClient } from '../db/index';
import { getKVStore } from '../utils/kv';

export type SystemMode = 'exploration' | 'exploitation';

export interface ExplorationConfig {
  forceVariety: boolean;
  allowLowerQuality: boolean;
  controversyLevels: number[];
  qualityThreshold: number;
  diversityWeight: number;
}

export interface ModeStatus {
  mode: SystemMode;
  currentFollowers: number;
  avgEngagement: number;
  followerThreshold: number;
  engagementThreshold: number;
  reason: string;
  lastChecked: Date;
}

export class ExplorationModeManager {
  private static instance: ExplorationModeManager;
  private currentMode: SystemMode = 'exploration';
  private lastModeCheck: Date = new Date(0);
  private modeCheckInterval = 30 * 60 * 1000; // 30 minutes

  // Thresholds for switching modes
  private readonly FOLLOWER_THRESHOLD = parseInt(process.env.FOLLOWER_THRESHOLD_FOR_EXPLOITATION || '200');
  private readonly ENGAGEMENT_THRESHOLD = parseFloat(process.env.ENGAGEMENT_THRESHOLD_FOR_EXPLOITATION || '10');

  private constructor() {}

  public static getInstance(): ExplorationModeManager {
    if (!ExplorationModeManager.instance) {
      ExplorationModeManager.instance = new ExplorationModeManager();
    }
    return ExplorationModeManager.instance;
  }

  /**
   * Determine current mode based on system performance
   */
  public async determineMode(): Promise<SystemMode> {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastModeCheck.getTime();

    // Use cached mode if checked recently
    if (timeSinceLastCheck < this.modeCheckInterval) {
      return this.currentMode;
    }

    try {
      const kv = getKVStore();
      
      // Try to get from cache first
      const cachedMode = await kv.get('exploration:current_mode');
      if (cachedMode && timeSinceLastCheck < this.modeCheckInterval) {
        this.currentMode = cachedMode as SystemMode;
        return this.currentMode;
      }

      // Calculate current metrics
      const currentFollowers = await this.getCurrentFollowerCount();
      const avgEngagement = await this.getAverageEngagement();

      // Determine mode based on thresholds
      if (currentFollowers < this.FOLLOWER_THRESHOLD || avgEngagement < this.ENGAGEMENT_THRESHOLD) {
        this.currentMode = 'exploration';
        console.log(`[EXPLORATION] 🔍 Mode: EXPLORATION (${currentFollowers} followers, ${avgEngagement.toFixed(1)} avg engagement)`);
      } else {
        this.currentMode = 'exploitation';
        console.log(`[EXPLORATION] 🎯 Mode: EXPLOITATION (${currentFollowers} followers, ${avgEngagement.toFixed(1)} avg engagement)`);
      }

      // Cache the mode
      await kv.set('exploration:current_mode', this.currentMode, 1800); // 30 min TTL
      this.lastModeCheck = new Date();

      return this.currentMode;

    } catch (error: any) {
      console.warn(`[EXPLORATION] ⚠️ Mode detection failed:`, error.message);
      return 'exploration'; // Default to exploration on error
    }
  }

  /**
   * Get exploration configuration based on current mode
   */
  public async getExplorationConfig(): Promise<ExplorationConfig> {
    const mode = await this.determineMode();

    if (mode === 'exploration') {
      return {
        forceVariety: true,
        allowLowerQuality: true,
        controversyLevels: [3, 5, 7, 9], // Test range
        qualityThreshold: 6.0, // Lower threshold
        diversityWeight: 0.7 // High weight on diversity
      };
    } else {
      return {
        forceVariety: false,
        allowLowerQuality: false,
        controversyLevels: [5, 6, 7], // Moderate range
        qualityThreshold: 8.0, // Higher threshold
        diversityWeight: 0.3 // Lower weight on diversity
      };
    }
  }

  /**
   * Get current mode status for monitoring
   */
  public async getModeStatus(): Promise<ModeStatus> {
    const mode = await this.determineMode();
    const currentFollowers = await this.getCurrentFollowerCount();
    const avgEngagement = await this.getAverageEngagement();

    let reason = '';
    if (mode === 'exploration') {
      if (currentFollowers < this.FOLLOWER_THRESHOLD) {
        reason = `Followers (${currentFollowers}) below threshold (${this.FOLLOWER_THRESHOLD})`;
      } else if (avgEngagement < this.ENGAGEMENT_THRESHOLD) {
        reason = `Avg engagement (${avgEngagement.toFixed(1)}) below threshold (${this.ENGAGEMENT_THRESHOLD})`;
      } else {
        reason = 'Cold start optimization active';
      }
    } else {
      reason = 'Sufficient signal for optimization';
    }

    return {
      mode,
      currentFollowers,
      avgEngagement,
      followerThreshold: this.FOLLOWER_THRESHOLD,
      engagementThreshold: this.ENGAGEMENT_THRESHOLD,
      reason,
      lastChecked: this.lastModeCheck
    };
  }

  /**
   * Get current follower count
   */
  private async getCurrentFollowerCount(): Promise<number> {
    try {
      const kv = getKVStore();
      
      // Try cache first
      const cached = await kv.get('follower:current_count');
      if (cached) {
        return parseInt(cached);
      }

      // Get most recent baseline from tracking
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('post_follower_tracking')
        .select('follower_count')
        .eq('hours_after_post', 0)
        .order('check_time', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        const count = Number(data.follower_count) || 0;
        await kv.set('follower:current_count', String(count), 3600); // Cache 1h
        return count;
      }

      // Fallback to environment variable or default
      return parseInt(process.env.CURRENT_FOLLOWER_COUNT || '31');

    } catch (error: any) {
      console.warn(`[EXPLORATION] ⚠️ Failed to get follower count:`, error.message);
      return 31; // Fallback default
    }
  }

  /**
   * Get average engagement from recent posts
   */
  private async getAverageEngagement(): Promise<number> {
    try {
      const kv = getKVStore();
      
      // Try cache first
      const cached = await kv.get('engagement:avg_recent');
      if (cached) {
        return parseFloat(cached);
      }

      // Calculate from recent posts
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('unified_outcomes')
        .select('likes, retweets, replies')
        .order('collected_at', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        const totalEngagement = data.reduce((sum, post) => {
          return sum + (Number(post.likes) || 0) + 
                      (Number(post.retweets) || 0) * 2 + 
                      (Number(post.replies) || 0) * 3;
        }, 0);
        
        const avg = totalEngagement / data.length;
        await kv.set('engagement:avg_recent', String(avg), 1800); // Cache 30min
        return avg;
      }

      return 0; // No data yet

    } catch (error: any) {
      console.warn(`[EXPLORATION] ⚠️ Failed to get avg engagement:`, error.message);
      return 0;
    }
  }

  /**
   * Track exploration metrics for monitoring
   */
  public async updateModeMetrics(postId: string, metrics: { likes: number; followers_gained: number }): Promise<void> {
    try {
      const kv = getKVStore();
      const mode = await this.determineMode();

      // Store in Redis (if available)
      const metricData = JSON.stringify({
        postId,
        mode,
        likes: metrics.likes,
        followersGained: metrics.followers_gained,
        timestamp: Date.now()
      });

      try {
        await kv.set(`exploration:metric:${postId}`, metricData, 604800); // 7 days TTL
      } catch (error: any) {
        // Redis list operations may not be available, use simple set
      }

    } catch (error: any) {
      console.warn(`[EXPLORATION] ⚠️ Failed to update metrics:`, error.message);
    }
  }
}

/**
 * Convenience function to get current mode
 */
export async function getCurrentMode(): Promise<SystemMode> {
  return ExplorationModeManager.getInstance().determineMode();
}

/**
 * Convenience function to get mode status
 */
export async function getModeStatus(): Promise<ModeStatus> {
  return ExplorationModeManager.getInstance().getModeStatus();
}

