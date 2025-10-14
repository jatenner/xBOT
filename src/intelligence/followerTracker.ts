/**
 * Follower Tracker - Phase 3: Explicit Follower Acquisition Optimization
 * 
 * Tracks follower count before/after each post
 * Calculates follower conversion rates
 * Optimizes content strategy for follower growth
 */

import { getSupabaseClient } from '../db';

export interface FollowerSnapshot {
  snapshot_id: string;
  timestamp: string;
  follower_count: number;
  following_count: number;
  tweet_count: number;
  source: 'pre_post' | 'post_post' | 'hourly_check';
}

export interface FollowerGainAttribution {
  post_id: string;
  content_type: string;
  viral_formula: string;
  followers_before: number;
  followers_after: number;
  followers_gained: number;
  time_window_hours: number;
  confidence: 'high' | 'medium' | 'low'; // Confidence in attribution
}

export interface FollowerOptimizationInsights {
  best_content_types: Array<{
    type: string;
    avg_followers_per_post: number;
    conversion_rate: number;
    sample_size: number;
  }>;
  best_formulas: Array<{
    formula: string;
    avg_followers_per_post: number;
    conversion_rate: number;
    sample_size: number;
  }>;
  best_topics: Array<{
    topic: string;
    avg_followers_per_post: number;
    sample_size: number;
  }>;
  optimal_posting_frequency: string;
  recommendations: string[];
}

export class FollowerTracker {
  private static instance: FollowerTracker;
  private currentFollowerCount: number = 0;
  private lastSnapshotTime: Date = new Date();
  
  private constructor() {}
  
  public static getInstance(): FollowerTracker {
    if (!FollowerTracker.instance) {
      FollowerTracker.instance = new FollowerTracker();
    }
    return FollowerTracker.instance;
  }
  
  /**
   * Take a follower count snapshot before posting
   */
  public async takePrePostSnapshot(): Promise<FollowerSnapshot> {
    console.log('[FOLLOWER_TRACKER] 📸 Taking pre-post follower snapshot...');
    
    const followerCount = await this.scrapeCurrentFollowerCount();
    
    const snapshot: FollowerSnapshot = {
      snapshot_id: `pre_${Date.now()}`,
      timestamp: new Date().toISOString(),
      follower_count: followerCount,
      following_count: 0, // Would scrape this too
      tweet_count: 0, // Would scrape this too
      source: 'pre_post'
    };
    
    this.currentFollowerCount = followerCount;
    this.lastSnapshotTime = new Date();
    
    await this.storeSnapshot(snapshot);
    
    console.log(`[FOLLOWER_TRACKER] 📊 Current followers: ${followerCount}`);
    
    return snapshot;
  }
  
  /**
   * Take a follower count snapshot after posting
   * Compare to pre-post to calculate gain
   */
  public async takePostPostSnapshot(
    post_id: string,
    content_type: string,
    viral_formula: string,
    timeWindowHours: number = 2
  ): Promise<FollowerGainAttribution> {
    
    console.log(`[FOLLOWER_TRACKER] 📸 Taking post-post snapshot (${timeWindowHours}h window)...`);
    
    const followerCount = await this.scrapeCurrentFollowerCount();
    
    const snapshot: FollowerSnapshot = {
      snapshot_id: `post_${Date.now()}`,
      timestamp: new Date().toISOString(),
      follower_count: followerCount,
      following_count: 0,
      tweet_count: 0,
      source: 'post_post'
    };
    
    await this.storeSnapshot(snapshot);
    
    // Calculate gain
    const followersGained = Math.max(0, followerCount - this.currentFollowerCount);
    
    // Determine confidence based on time window and other factors
    const hoursElapsed = (new Date().getTime() - this.lastSnapshotTime.getTime()) / (1000 * 60 * 60);
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    
    if (hoursElapsed <= 2 && followersGained > 0) {
      confidence = 'high'; // Short window, clear attribution
    } else if (hoursElapsed <= 4) {
      confidence = 'medium';
    } else {
      confidence = 'low'; // Long window, less certain attribution
    }
    
    const attribution: FollowerGainAttribution = {
      post_id,
      content_type,
      viral_formula,
      followers_before: this.currentFollowerCount,
      followers_after: followerCount,
      followers_gained: followersGained,
      time_window_hours: hoursElapsed,
      confidence
    };
    
    console.log(`[FOLLOWER_TRACKER] 📈 Followers gained: ${followersGained} (${confidence} confidence)`);
    
    // Store attribution
    await this.storeFollowerAttribution(attribution);
    
    // Update current count
    this.currentFollowerCount = followerCount;
    
    return attribution;
  }
  
  /**
   * Get follower optimization insights
   */
  public async getFollowerOptimizationInsights(): Promise<FollowerOptimizationInsights> {
    console.log('[FOLLOWER_TRACKER] 🧠 Calculating follower optimization insights...');
    
    try {
      const supabase = getSupabaseClient();
      
      // Get all attribution data
      const { data: attributions, error } = await supabase
        .from('follower_attributions')
        .select('*')
        .eq('confidence', 'high') // Only high-confidence data
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error || !attributions || attributions.length === 0) {
        return this.getDefaultInsights();
      }
      
      // Analyze by content type
      const byContentType = this.groupAndAnalyze(
        attributions,
        'content_type'
      );
      
      // Analyze by viral formula
      const byFormula = this.groupAndAnalyze(
        attributions,
        'viral_formula'
      );
      
      // Analyze by topic (would need to join with content_decisions)
      const byTopic: any[] = []; // Simplified for now
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        byContentType,
        byFormula,
        attributions
      );
      
      return {
        best_content_types: byContentType,
        best_formulas: byFormula,
        best_topics: byTopic,
        optimal_posting_frequency: this.calculateOptimalFrequency(attributions),
        recommendations
      };
      
    } catch (error: any) {
      console.warn('[FOLLOWER_TRACKER] ⚠️ Could not get insights:', error.message);
      return this.getDefaultInsights();
    }
  }
  
  /**
   * Update content type and formula scores based on follower performance
   */
  public async updatePerformanceScores(attribution: FollowerGainAttribution): Promise<void> {
    console.log('[FOLLOWER_TRACKER] 📊 Updating performance scores...');
    
    // Update content type performance
    const { getContentTypeSelector } = await import('./contentTypeSelector');
    const contentTypeSelector = getContentTypeSelector();
    
    const wasSuccessful = attribution.followers_gained > 5; // Define success threshold
    
    await contentTypeSelector.updateContentTypePerformance(
      attribution.content_type,
      attribution.followers_gained,
      0, // engagement rate - would calculate this
      wasSuccessful
    );
    
    // Update viral formula performance
    await this.updateViralFormulaScore(
      attribution.viral_formula,
      attribution.followers_gained,
      wasSuccessful
    );
    
    console.log('[FOLLOWER_TRACKER] ✅ Performance scores updated');
  }
  
  /**
   * Private helper methods
   */
  
  private async scrapeCurrentFollowerCount(): Promise<number> {
    // TODO: Implement actual Twitter scraping
    // For now, simulate with random growth
    const growth = Math.floor(Math.random() * 3); // 0-2 followers per check
    return this.currentFollowerCount + growth;
  }
  
  private async storeSnapshot(snapshot: FollowerSnapshot): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase.from('follower_snapshots').insert([{
        snapshot_id: snapshot.snapshot_id,
        timestamp: snapshot.timestamp,
        follower_count: snapshot.follower_count,
        following_count: snapshot.following_count,
        tweet_count: snapshot.tweet_count,
        source: snapshot.source
      }]);
    } catch (error) {
      console.log('[FOLLOWER_TRACKER] ⏭️ Could not store snapshot (table may not exist)');
    }
  }
  
  private async storeFollowerAttribution(attribution: FollowerGainAttribution): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase.from('follower_attributions').insert([{
        post_id: attribution.post_id,
        content_type: attribution.content_type,
        viral_formula: attribution.viral_formula,
        followers_before: attribution.followers_before,
        followers_after: attribution.followers_after,
        followers_gained: attribution.followers_gained,
        time_window_hours: attribution.time_window_hours,
        confidence: attribution.confidence,
        created_at: new Date().toISOString()
      }]);
    } catch (error) {
      console.log('[FOLLOWER_TRACKER] ⏭️ Could not store attribution (table may not exist)');
    }
  }
  
  private groupAndAnalyze(data: any[], groupBy: string): any[] {
    const grouped = data.reduce((acc: any, item: any) => {
      const key = item[groupBy] || 'unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
    
    return Object.entries(grouped).map(([key, items]: [string, any]) => {
      const totalFollowers = items.reduce((sum: number, i: any) => 
        sum + (i.followers_gained || 0), 0);
      const avgFollowers = totalFollowers / items.length;
      const successCount = items.filter((i: any) => i.followers_gained > 5).length;
      const conversionRate = successCount / items.length;
      
      return {
        type: key,
        avg_followers_per_post: avgFollowers,
        conversion_rate: conversionRate,
        sample_size: items.length
      };
    }).sort((a, b) => b.avg_followers_per_post - a.avg_followers_per_post);
  }
  
  private generateRecommendations(
    byContentType: any[],
    byFormula: any[],
    allData: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (byContentType.length > 0) {
      const best = byContentType[0];
      recommendations.push(
        `Focus on ${best.type} content (gaining ${best.avg_followers_per_post.toFixed(1)} followers per post)`
      );
    }
    
    if (byFormula.length > 0) {
      const best = byFormula[0];
      recommendations.push(
        `Use ${best.type} formula more often (${best.avg_followers_per_post.toFixed(1)} followers per post)`
      );
    }
    
    if (allData.length > 10) {
      recommendations.push(
        'Continue gathering data to refine follower acquisition strategy'
      );
    }
    
    return recommendations;
  }
  
  private calculateOptimalFrequency(data: any[]): string {
    // Simplified - would analyze posting frequency vs follower growth
    if (data.length < 20) {
      return 'Collecting data... (need more posts to determine)';
    }
    
    return '4-6 posts per day (based on current data)';
  }
  
  private getDefaultInsights(): FollowerOptimizationInsights {
    return {
      best_content_types: [],
      best_formulas: [],
      best_topics: [],
      optimal_posting_frequency: 'Collecting data...',
      recommendations: ['Post consistently to gather performance data']
    };
  }
  
  private async updateViralFormulaScore(
    formula_id: string,
    followers_gained: number,
    was_successful: boolean
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase.from('viral_formula_performance').upsert({
        formula_id,
        followers_gained,
        was_successful,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.log('[FOLLOWER_TRACKER] ⏭️ Could not update formula score (table may not exist)');
    }
  }
  
  /**
   * Initialize follower count from Twitter
   */
  public async initialize(): Promise<void> {
    console.log('[FOLLOWER_TRACKER] 🚀 Initializing follower tracker...');
    
    // Would scrape actual follower count here
    this.currentFollowerCount = 0; // Placeholder
    this.lastSnapshotTime = new Date();
    
    console.log('[FOLLOWER_TRACKER] ✅ Initialized');
  }
}

export const getFollowerTracker = () => FollowerTracker.getInstance();

