/**
 * ❄️ COLD START OPTIMIZER
 * Specialized optimization strategy for 0-200 followers
 * Forces high variance and exploration
 */

import { getSupabaseClient } from '../db/index';
import { getKVStore } from '../utils/kv';

export interface VarietyRecommendation {
  recommendedType: string;
  controversyLevel: number;
  reason: string;
  shouldForceNew: boolean;
}

export class ColdStartOptimizer {
  private static instance: ColdStartOptimizer;

  private constructor() {}

  public static getInstance(): ColdStartOptimizer {
    if (!ColdStartOptimizer.instance) {
      ColdStartOptimizer.instance = new ColdStartOptimizer();
    }
    return ColdStartOptimizer.instance;
  }

  /**
   * Calculate variety score for recent content
   * Low score = too similar, high score = good diversity
   */
  public async calculateVarietyScore(recentPosts: Array<{type: string; controversyLevel?: number}>): Promise<number> {
    if (recentPosts.length === 0) return 1.0;

    // Count unique types
    const uniqueTypes = new Set(recentPosts.map(p => p.type)).size;
    const typeVariety = uniqueTypes / Math.min(recentPosts.length, 10);

    // Check controversy level variety
    const controversyLevels = recentPosts
      .map(p => p.controversyLevel)
      .filter(c => c !== undefined) as number[];
    
    const controversyVariety = controversyLevels.length > 0
      ? new Set(controversyLevels).size / controversyLevels.length
      : 0.5;

    // Combined score
    return (typeVariety * 0.6 + controversyVariety * 0.4);
  }

  /**
   * Recommend next content type to test
   * Prioritizes untested or underused types
   */
  public async recommendNextContentType(): Promise<VarietyRecommendation> {
    try {
      // Get recent posts (last 20)
      const recentPosts = await this.getRecentPostTypes();
      
      // All possible content types
      const allTypes = [
        'educational_thread',
        'case_study',
        'quick_fact',
        'research_breakdown',
        'controversial_take',
        'question',
        'study_breakdown',
        'myth_buster',
        'trend_analysis'
      ];

      // Count usage of each type
      const typeCounts = new Map<string, number>();
      allTypes.forEach(type => typeCounts.set(type, 0));
      recentPosts.forEach(post => {
        const count = typeCounts.get(post.type) || 0;
        typeCounts.set(post.type, count + 1);
      });

      // Find least used type
      let minCount = Infinity;
      let recommendedType = allTypes[0];
      for (const [type, count] of typeCounts.entries()) {
        if (count < minCount) {
          minCount = count;
          recommendedType = type;
        }
      }

      // Determine controversy level (rotate through range)
      const controversyLevel = await this.getNextControversyLevel();

      // Calculate variety score
      const varietyScore = await this.calculateVarietyScore(recentPosts);

      return {
        recommendedType,
        controversyLevel,
        reason: minCount === 0 
          ? `Not tested yet`
          : `Least used (${minCount}/${recentPosts.length} posts)`,
        shouldForceNew: varietyScore < 0.5 // Force if variety is low
      };

    } catch (error: any) {
      console.warn(`[COLD_START] ⚠️ Recommendation failed:`, error.message);
      
      // Fallback recommendation
      return {
        recommendedType: 'controversial_take',
        controversyLevel: 7,
        reason: 'Default fallback',
        shouldForceNew: true
      };
    }
  }

  /**
   * Get next controversy level to test (rotate through 3, 5, 7, 9)
   */
  private async getNextControversyLevel(): Promise<number> {
    try {
      const kv = getKVStore();
      
      // Get recent controversy levels
      const recent = await kv.get('exploration:recent_controversy_levels');
      const levels = recent ? JSON.parse(recent) : [];

      // Test range: 3, 5, 7, 9
      const testRange = [3, 5, 7, 9];
      
      // Find least tested level
      const counts = testRange.map(level => ({
        level,
        count: levels.filter((l: number) => l === level).length
      }));

      counts.sort((a, b) => a.count - b.count);
      const nextLevel = counts[0].level;

      // Store for next time
      levels.push(nextLevel);
      if (levels.length > 20) levels.shift(); // Keep last 20
      await kv.set('exploration:recent_controversy_levels', JSON.stringify(levels), 86400); // 24h TTL

      return nextLevel;

    } catch (error: any) {
      console.warn(`[COLD_START] ⚠️ Failed to get controversy level:`, error.message);
      return 7; // Default moderate-high
    }
  }

  /**
   * Determine if we should allow lower quality posts
   * In exploration, volume matters more than perfect quality
   */
  public shouldPostLowerQuality(qualityScore: number, diversityNeeded: boolean): boolean {
    if (diversityNeeded) {
      return qualityScore >= 6.0; // Lower threshold when exploring
    }
    return qualityScore >= 8.0; // Normal threshold
  }

  /**
   * Get recent post types from database
   */
  private async getRecentPostTypes(): Promise<Array<{type: string; controversyLevel?: number}>> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('content_metadata')
        .select('generator_type, metadata')
        .eq('status', 'posted')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        return data.map(post => ({
          type: String(post.generator_type || 'unknown'),
          controversyLevel: post.metadata ? (post.metadata as any).controversyLevel : undefined
        }));
      }

      return [];

    } catch (error: any) {
      console.warn(`[COLD_START] ⚠️ Failed to get recent posts:`, error.message);
      return [];
    }
  }

  /**
   * Adjust strategy based on what's working
   * If something gets engagement, do more of it
   */
  public async adjustStrategyBasedOnResults(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Find posts with engagement > 0 in last 7 days
      const { data, error } = await supabase
        .from('unified_outcomes')
        .select('decision_id, likes, retweets, replies')
        .gt('likes', 0)
        .gte('collected_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('likes', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        console.log(`[COLD_START] 📈 Found ${data.length} posts with engagement - analyzing patterns...`);
        
        // Get content metadata for these posts
        const postIds = data.map(p => p.decision_id);
        const { data: contentData } = await supabase
          .from('content_metadata')
          .select('decision_id, generator_type, metadata')
          .in('decision_id', postIds);

        if (contentData) {
          // Analyze patterns
          const typePerformance = new Map<string, number>();
          contentData.forEach(post => {
            const engagementData = data.find(d => d.decision_id === post.decision_id);
            if (engagementData) {
              const type = String(post.generator_type || 'unknown');
              const engagement = Number(engagementData.likes) + 
                                Number(engagementData.retweets) * 2 + 
                                Number(engagementData.replies) * 3;
              typePerformance.set(type, (typePerformance.get(type) || 0) + engagement);
            }
          });

          // Log insights
          const sortedTypes = Array.from(typePerformance.entries())
            .sort((a, b) => b[1] - a[1]);
          
          if (sortedTypes.length > 0) {
            console.log(`[COLD_START] 🎯 Best performing type: ${sortedTypes[0][0]} (${sortedTypes[0][1]} engagement)`);
            
            // Cache this insight
            const kv = getKVStore();
            await kv.set('exploration:best_performing_type', sortedTypes[0][0], 86400); // 24h TTL
          }
        }
      } else {
        console.log(`[COLD_START] 📊 No engagement yet - continuing high variance exploration`);
      }

    } catch (error: any) {
      console.warn(`[COLD_START] ⚠️ Strategy adjustment failed:`, error.message);
    }
  }
}

/**
 * Convenience function
 */
export async function getVarietyRecommendation(): Promise<VarietyRecommendation> {
  return ColdStartOptimizer.getInstance().recommendNextContentType();
}

