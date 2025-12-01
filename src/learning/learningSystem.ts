/**
 * Follower-Optimized Learning System
 * Learns what content ACTUALLY grows followers, not just engagement
 */

import { getSupabaseClient } from '../db';
import { followerGrowthEngine } from '../growth/followerGrowthEngine';

export interface LearningSystemStatus {
  initialized: boolean;
  total_posts_tracked: number;
  total_patterns_discovered: number;
  total_prediction_errors: number;
  avg_followers_per_post: number;
  best_performing_strategy: string;
}

export interface FollowerPattern {
  content_type: string;
  hook_strategy: string;
  topic_category: string;
  avg_followers_gained: number;
  sample_size: number;
  confidence: number;
}

export class LearningSystem {
  private isInitialized = false;
  private followerPatterns: Map<string, FollowerPattern> = new Map();
  private generatorPatterns: Map<string, { avg_followers: number; sample_size: number }> = new Map();
  private hookPatterns: Map<string, { avg_followers: number; sample_size: number }> = new Map();
  private topicPatterns: Map<string, { avg_followers: number; sample_size: number }> = new Map();
  private postTracking: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    this.isInitialized = true;
    console.log('[LEARNING_SYSTEM] 🧠 Follower-optimized learning system initialized');
    
    // Load existing patterns from database
    await this.loadFollowerPatterns();
  }

  /**
   * Process new post - track for follower learning
   */
  async processNewPost(
    post_id: string,
    content: string,
    predictedMetrics: any,
    contentMetadata: any
  ): Promise<void> {
    console.log(`[LEARNING_SYSTEM] 📝 Tracking post ${post_id} for follower growth`);
    
    // Store for later performance comparison
    this.postTracking.set(post_id, {
      content_type: contentMetadata.content_type_name || 'unknown',
      hook_strategy: contentMetadata.hook_used || 'unknown',
      topic_category: contentMetadata.topic || 'unknown',
      predicted_followers: predictedMetrics.followers_gained_prediction || 0,
      posted_at: new Date().toISOString(),
    });
  }

  /**
   * Update with ACTUAL performance - CRITICAL for learning
   */
  async updatePostPerformance(post_id: string, actualPerformance: {
    followers_gained?: number;
    follower_growth?: number; // Alternative name for followers_gained
    engagement_rate?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
    saves?: number; // Twitter bookmarks
    impressions?: number;
    profile_clicks?: number;
    [key: string]: any; // Allow additional metrics
  }): Promise<void> {
    
    const tracked = this.postTracking.get(post_id);
    if (!tracked) {
      console.log(`[LEARNING_SYSTEM] ⚠️ Post ${post_id} not tracked`);
      return;
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🚨 LEARNING GATE: Don't learn from low-engagement posts
    // ═══════════════════════════════════════════════════════════
    const views = actualPerformance.impressions || 0;
    const likes = actualPerformance.likes || 0;
    
    // USER REQUIREMENT: Don't learn from posts with <100 views or <5 likes
    if (views < 100 || likes < 5) {
      console.log(`[LEARNING_SYSTEM] ⏭️ SKIP LEARNING: Post has only ${views} views, ${likes} likes (below learning threshold)`);
      console.log(`[LEARNING_SYSTEM] ℹ️ Minimum: 100 views + 5 likes to be considered meaningful data`);
      this.postTracking.delete(post_id); // Remove from tracking
      return; // Don't learn from noise
    }
    
    console.log(`[LEARNING_SYSTEM] ✅ LEARNING GATE PASSED: ${views} views, ${likes} likes (above threshold)`);
    
    // Support both naming conventions
    const followers_gained = actualPerformance.followers_gained || actualPerformance.follower_growth || 0;
    
    console.log(`[LEARNING_SYSTEM] 📊 Post ${post_id} gained ${followers_gained} followers`);
    
    // Update pattern learning (content_type + hook_strategy)
    const patternKey = `${tracked.content_type}_${tracked.hook_strategy}`;
    const existing = this.followerPatterns.get(patternKey);
    
    if (existing) {
      // Update running average
      const newSampleSize = existing.sample_size + 1;
      const newAvg = (existing.avg_followers_gained * existing.sample_size + followers_gained) / newSampleSize;
      
      this.followerPatterns.set(patternKey, {
        ...existing,
        avg_followers_gained: newAvg,
        sample_size: newSampleSize,
        confidence: Math.min(0.95, newSampleSize / 20), // Confidence grows with sample size
      });
      
      console.log(`[LEARNING_SYSTEM] 📈 Pattern ${patternKey}: ${newAvg.toFixed(1)} avg followers (n=${newSampleSize})`);
    } else {
      // Create new pattern
      this.followerPatterns.set(patternKey, {
        content_type: tracked.content_type,
        hook_strategy: tracked.hook_strategy,
        topic_category: tracked.topic_category,
        avg_followers_gained: followers_gained,
        sample_size: 1,
        confidence: 0.05,
      });
    }
    
    // 🚀 NEW: Track generator performance for follower growth
    const generatorName = tracked.generator_name || 'unknown';
    const generatorKey = `${generatorName}_${tracked.topic_category || 'general'}`;
    const generatorPattern = this.generatorPatterns.get(generatorKey);
    
    if (generatorPattern) {
      const newSampleSize = generatorPattern.sample_size + 1;
      const newAvg = (generatorPattern.avg_followers * generatorPattern.sample_size + followers_gained) / newSampleSize;
      this.generatorPatterns.set(generatorKey, {
        avg_followers: newAvg,
        sample_size: newSampleSize
      });
      console.log(`[LEARNING_SYSTEM] 🎨 Generator ${generatorName}: ${newAvg.toFixed(1)} avg followers (n=${newSampleSize})`);
    } else {
      this.generatorPatterns.set(generatorKey, {
        avg_followers: followers_gained,
        sample_size: 1
      });
    }
    
    // 🚀 NEW: Track hook pattern performance
    const hookPattern = tracked.hook_pattern || tracked.hook_strategy || 'unknown';
    const hookKey = `${hookPattern}_${tracked.content_type || 'single'}`;
    const hookPatternData = this.hookPatterns.get(hookKey);
    
    if (hookPatternData) {
      const newSampleSize = hookPatternData.sample_size + 1;
      const newAvg = (hookPatternData.avg_followers * hookPatternData.sample_size + followers_gained) / newSampleSize;
      this.hookPatterns.set(hookKey, {
        avg_followers: newAvg,
        sample_size: newSampleSize
      });
      console.log(`[LEARNING_SYSTEM] 🎣 Hook ${hookPattern}: ${newAvg.toFixed(1)} avg followers (n=${newSampleSize})`);
    } else {
      this.hookPatterns.set(hookKey, {
        avg_followers: followers_gained,
        sample_size: 1
      });
    }
    
    // 🚀 NEW: Track topic performance
    const topic = tracked.topic_category || tracked.raw_topic || 'unknown';
    const topicKey = `${topic}`;
    const topicPattern = this.topicPatterns.get(topicKey);
    
    if (topicPattern) {
      const newSampleSize = topicPattern.sample_size + 1;
      const newAvg = (topicPattern.avg_followers * topicPattern.sample_size + followers_gained) / newSampleSize;
      this.topicPatterns.set(topicKey, {
        avg_followers: newAvg,
        sample_size: newSampleSize
      });
      console.log(`[LEARNING_SYSTEM] 📚 Topic ${topic}: ${newAvg.toFixed(1)} avg followers (n=${newSampleSize})`);
    } else {
      this.topicPatterns.set(topicKey, {
        avg_followers: followers_gained,
        sample_size: 1
      });
    }
    
    // Also track in growth engine
    await followerGrowthEngine.trackFollowerGrowth({
      post_id,
      content_type: tracked.content_type,
      hook_strategy: tracked.hook_strategy,
      followers_before: 0, // Will be set by actual system
      followers_after: followers_gained,
      engagement_rate: actualPerformance.engagement_rate || 0,
      posted_at: tracked.posted_at,
    });
    
    // Persist to database
    await this.persistLearning(post_id, tracked, actualPerformance);
  }

  /**
   * Get best performing strategy for follower growth
   */
  async getBestStrategy(): Promise<FollowerPattern | null> {
    const patterns = Array.from(this.followerPatterns.values())
      .filter(p => p.sample_size >= 2) // Need at least 2 samples
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained);
    
    return patterns[0] || null;
  }

  /**
   * Get learning insights for content generation
   */
  async getLearningInsights(): Promise<{
    top_strategies: FollowerPattern[];
    avoid_strategies: FollowerPattern[];
    recommended_focus: string;
  }> {
    
    const allPatterns = Array.from(this.followerPatterns.values());
    
    // Top 3 strategies
    const top = allPatterns
      .filter(p => p.sample_size >= 2)
      .sort((a, b) => b.avg_followers_gained - a.avg_followers_gained)
      .slice(0, 3);
    
    // Bottom 3 (avoid these)
    const avoid = allPatterns
      .filter(p => p.sample_size >= 2)
      .sort((a, b) => a.avg_followers_gained - b.avg_followers_gained)
      .slice(0, 3);
    
    // Recommendation
    let recommended = 'threads_curiosity_gap'; // Default
    if (top.length > 0) {
      recommended = `${top[0].content_type}_${top[0].hook_strategy}`;
    }
    
    return {
      top_strategies: top,
      avoid_strategies: avoid,
      recommended_focus: recommended,
    };
  }

  async getStatus(): Promise<LearningSystemStatus> {
    const patterns = Array.from(this.followerPatterns.values());
    const totalFollowers = patterns.reduce((sum, p) => sum + (p.avg_followers_gained * p.sample_size), 0);
    const totalPosts = patterns.reduce((sum, p) => sum + p.sample_size, 0);
    
    const best = await this.getBestStrategy();
    
    return {
      initialized: this.isInitialized,
      total_posts_tracked: totalPosts,
      total_patterns_discovered: patterns.length,
      total_prediction_errors: 0,
      avg_followers_per_post: totalPosts > 0 ? totalFollowers / totalPosts : 0,
      best_performing_strategy: best ? `${best.content_type}_${best.hook_strategy}` : 'none',
    };
  }
  
  /**
   * Load existing follower patterns from database
   */
  private async loadFollowerPatterns(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('follower_growth_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (data && data.length > 0) {
        // Aggregate patterns
        const aggregated = new Map<string, {followers: number[]; topics: string[]}>();
        
        data.forEach((row: any) => {
          const key = `${row.content_type}_${row.hook_strategy}`;
          const existing = aggregated.get(key) || { followers: [], topics: [] };
          
          existing.followers.push(row.followers_gained || 0);
          existing.topics.push(row.topic_category || 'unknown');
          
          aggregated.set(key, existing);
        });
        
        // Convert to patterns
        aggregated.forEach((data, key) => {
          const [content_type, hook_strategy] = key.split('_');
          const avg = data.followers.reduce((a, b) => a + b, 0) / data.followers.length;
          
          this.followerPatterns.set(key, {
            content_type,
            hook_strategy,
            topic_category: data.topics[0] || 'unknown',
            avg_followers_gained: avg,
            sample_size: data.followers.length,
            confidence: Math.min(0.95, data.followers.length / 20),
          });
        });
        
        console.log(`[LEARNING_SYSTEM] ✅ Loaded ${this.followerPatterns.size} follower patterns from history`);
      }
    } catch (error) {
      console.warn('[LEARNING_SYSTEM] ⚠️ Could not load patterns from DB');
    }
  }
  
  /**
   * Persist learning to database
   */
  private async persistLearning(post_id: string, tracked: any, performance: any): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase
        .from('learning_insights')
        .insert({
          post_id,
          content_type: tracked.content_type,
          hook_strategy: tracked.hook_strategy,
          topic_category: tracked.topic_category,
          followers_gained: performance.followers_gained || performance.follower_growth || 0,
          engagement_rate: performance.engagement_rate || 0,
          likes: performance.likes || 0,
          retweets: performance.retweets || 0,
          replies: performance.replies || 0,
          saves: performance.saves || 0,
          impressions: performance.impressions || 0,
          profile_clicks: performance.profile_clicks || 0,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.warn('[LEARNING_SYSTEM] ⚠️ Could not persist to DB (table may not exist)');
    }
  }
}

export const learningSystem = new LearningSystem();
