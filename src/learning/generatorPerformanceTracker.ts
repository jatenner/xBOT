/**
 * ═══════════════════════════════════════════════════════════
 * GENERATOR PERFORMANCE TRACKER
 * ═══════════════════════════════════════════════════════════
 * 
 * Purpose: Track and analyze which content generators perform best
 * 
 * Key Metrics:
 * - F/1K: Followers per 1000 impressions (primary success metric)
 * - Engagement Rate: (likes + retweets*2 + replies*3) / impressions
 * - Viral Rate: Posts with F/1K > 5
 * - Failure Rate: Posts with 0 followers despite impressions
 * 
 * Usage:
 *   const tracker = new GeneratorPerformanceTracker();
 *   const performance = await tracker.getGeneratorPerformance(7); // Last 7 days
 *   const topPerformers = await tracker.getTopPerformers(3);
 */

import { getSupabaseClient } from '../db/index';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface GeneratorStats {
  name: string;
  total_posts: number;
  total_followers_gained: number;
  total_impressions: number;
  f_per_1k: number; // Followers per 1000 impressions
  engagement_rate: number;
  avg_likes: number;
  avg_retweets: number;
  avg_replies: number;
  avg_views: number;
  avg_quality_score: number;
  viral_posts: number; // Posts with F/1K > 5
  failed_posts: number; // Posts with 0 followers
  current_weight: number;
  status: string;
  last_used: string | null;
}

export interface GeneratorComparison {
  generator_name: string;
  f_per_1k: number;
  total_posts: number;
  rank: number;
  performance_tier: 'viral' | 'excellent' | 'good' | 'average' | 'poor' | 'failing';
  recommendation: string;
}

export interface PerformanceTrend {
  generator_name: string;
  period: string;
  f_per_1k: number;
  posts_count: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ═══════════════════════════════════════════════════════════
// GENERATOR PERFORMANCE TRACKER
// ═══════════════════════════════════════════════════════════

export class GeneratorPerformanceTracker {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get comprehensive performance stats for all generators
   */
  async getGeneratorPerformance(lookbackDays: number = 7): Promise<GeneratorStats[]> {
    try {
      console.log(`📊 GENERATOR_TRACKER: Analyzing performance (last ${lookbackDays} days)...`);

      const { data: performanceData, error } = await this.supabase.rpc('get_generator_performance', {
        p_lookback_days: lookbackDays
      }).catch(async () => {
        // Fallback to manual query if RPC doesn't exist
        const query = `
          SELECT 
            cm.generator_name as name,
            COUNT(*) as total_posts,
            COALESCE(SUM(o.followers_gained), 0) as total_followers_gained,
            COALESCE(SUM(o.impressions), 0) as total_impressions,
            COALESCE(
              (SUM(o.followers_gained)::DECIMAL / NULLIF(SUM(o.impressions), 0) * 1000),
              0
            ) as f_per_1k,
            COALESCE(
              AVG((o.likes + o.retweets * 2 + o.replies * 3)::DECIMAL / NULLIF(o.impressions, 0)),
              0
            ) as engagement_rate,
            COALESCE(AVG(o.likes), 0) as avg_likes,
            COALESCE(AVG(o.retweets), 0) as avg_retweets,
            COALESCE(AVG(o.replies), 0) as avg_replies,
            COALESCE(AVG(o.views), 0) as avg_views,
            COALESCE(AVG(cm.quality_score), 0) as avg_quality_score,
            COUNT(*) FILTER (
              WHERE (o.followers_gained::DECIMAL / NULLIF(o.impressions, 0) * 1000) > 5
            ) as viral_posts,
            COUNT(*) FILTER (
              WHERE o.followers_gained = 0 AND o.impressions > 100
            ) as failed_posts,
            COALESCE(gw.weight, 0) as current_weight,
            COALESCE(gw.status, 'unknown') as status,
            gw.last_used
          FROM content_metadata cm
          JOIN outcomes o ON cm.decision_id = o.decision_id
          LEFT JOIN generator_weights gw ON cm.generator_name = gw.generator_name
          WHERE cm.posted_at > NOW() - INTERVAL '${lookbackDays} days'
            AND cm.generator_name IS NOT NULL
            AND o.impressions > 0
          GROUP BY cm.generator_name, gw.weight, gw.status, gw.last_used
          ORDER BY f_per_1k DESC NULLS LAST;
        `;

        return await this.supabase.rpc('execute_sql', { sql: query }).catch(async () => {
          // Final fallback: separate queries
          const { data, error: queryError } = await this.supabase
            .from('content_metadata')
            .select(`
              generator_name,
              quality_score,
              posted_at,
              outcomes (
                followers_gained,
                impressions,
                likes,
                retweets,
                replies,
                views
              )
            `)
            .gte('posted_at', new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString())
            .not('generator_name', 'is', null);

          if (queryError) throw queryError;
          return { data: this.aggregatePerformanceData(data), error: null };
        });
      });

      if (error) {
        console.error('❌ GENERATOR_TRACKER: Query failed:', error.message);
        return [];
      }

      const stats = (performanceData as GeneratorStats[]) || [];
      
      console.log(`✅ GENERATOR_TRACKER: Found ${stats.length} generators with data`);
      stats.forEach(stat => {
        console.log(`  ${stat.name}: ${stat.f_per_1k.toFixed(2)} F/1K (${stat.total_posts} posts)`);
      });

      return stats;

    } catch (error: any) {
      console.error('❌ GENERATOR_TRACKER: Failed to get performance:', error.message);
      return [];
    }
  }

  /**
   * Manual aggregation fallback
   */
  private aggregatePerformanceData(data: any[]): GeneratorStats[] {
    const aggregated = new Map<string, any>();

    for (const row of data) {
      if (!row.generator_name) continue;

      if (!aggregated.has(row.generator_name)) {
        aggregated.set(row.generator_name, {
          name: row.generator_name,
          total_posts: 0,
          total_followers_gained: 0,
          total_impressions: 0,
          total_likes: 0,
          total_retweets: 0,
          total_replies: 0,
          total_views: 0,
          total_quality: 0,
          viral_posts: 0,
          failed_posts: 0,
          current_weight: 0,
          status: 'active',
          last_used: null
        });
      }

      const stats = aggregated.get(row.generator_name);
      const outcome = row.outcomes?.[0] || {};

      stats.total_posts++;
      stats.total_followers_gained += outcome.followers_gained || 0;
      stats.total_impressions += outcome.impressions || 0;
      stats.total_likes += outcome.likes || 0;
      stats.total_retweets += outcome.retweets || 0;
      stats.total_replies += outcome.replies || 0;
      stats.total_views += outcome.views || 0;
      stats.total_quality += row.quality_score || 0;

      const f_per_1k = outcome.impressions > 0 
        ? (outcome.followers_gained / outcome.impressions) * 1000 
        : 0;

      if (f_per_1k > 5) stats.viral_posts++;
      if (outcome.followers_gained === 0 && outcome.impressions > 100) stats.failed_posts++;
    }

    return Array.from(aggregated.values()).map(stats => ({
      name: stats.name,
      total_posts: stats.total_posts,
      total_followers_gained: stats.total_followers_gained,
      total_impressions: stats.total_impressions,
      f_per_1k: stats.total_impressions > 0 
        ? (stats.total_followers_gained / stats.total_impressions) * 1000 
        : 0,
      engagement_rate: stats.total_impressions > 0
        ? (stats.total_likes + stats.total_retweets * 2 + stats.total_replies * 3) / stats.total_impressions
        : 0,
      avg_likes: stats.total_posts > 0 ? stats.total_likes / stats.total_posts : 0,
      avg_retweets: stats.total_posts > 0 ? stats.total_retweets / stats.total_posts : 0,
      avg_replies: stats.total_posts > 0 ? stats.total_replies / stats.total_posts : 0,
      avg_views: stats.total_posts > 0 ? stats.total_views / stats.total_posts : 0,
      avg_quality_score: stats.total_posts > 0 ? stats.total_quality / stats.total_posts : 0,
      viral_posts: stats.viral_posts,
      failed_posts: stats.failed_posts,
      current_weight: stats.current_weight,
      status: stats.status,
      last_used: stats.last_used
    })).sort((a, b) => b.f_per_1k - a.f_per_1k);
  }

  /**
   * Calculate F/1K for each generator (primary success metric)
   */
  async calculateFollowerEfficiency(): Promise<Map<string, number>> {
    const stats = await this.getGeneratorPerformance(7);
    const efficiency = new Map<string, number>();

    for (const stat of stats) {
      efficiency.set(stat.name, stat.f_per_1k);
    }

    return efficiency;
  }

  /**
   * Get top N performing generators
   */
  async getTopPerformers(n: number = 5, minPosts: number = 3): Promise<string[]> {
    const stats = await this.getGeneratorPerformance(7);
    
    return stats
      .filter(s => s.total_posts >= minPosts)
      .sort((a, b) => b.f_per_1k - a.f_per_1k)
      .slice(0, n)
      .map(s => s.name);
  }

  /**
   * Get bottom N performing generators
   */
  async getBottomPerformers(n: number = 3, minPosts: number = 5): Promise<string[]> {
    const stats = await this.getGeneratorPerformance(7);
    
    return stats
      .filter(s => s.total_posts >= minPosts)
      .sort((a, b) => a.f_per_1k - b.f_per_1k)
      .slice(0, n)
      .map(s => s.name);
  }

  /**
   * Check if generator is consistently failing
   */
  async isGeneratorFailing(generatorName: string, minPosts: number = 10): Promise<boolean> {
    const stats = await this.getGeneratorPerformance(30); // Look back 30 days for failure detection
    const generator = stats.find(s => s.name === generatorName);

    if (!generator || generator.total_posts < minPosts) {
      return false; // Not enough data
    }

    // Failing criteria:
    // 1. F/1K = 0 (no followers gained)
    // 2. High failure rate (>60% of posts got 0 followers)
    const failureRate = generator.total_posts > 0 
      ? generator.failed_posts / generator.total_posts 
      : 0;

    return generator.f_per_1k === 0 || failureRate > 0.6;
  }

  /**
   * Compare all generators with recommendations
   */
  async compareGenerators(): Promise<GeneratorComparison[]> {
    const stats = await this.getGeneratorPerformance(7);
    
    return stats.map((stat, index) => {
      let tier: GeneratorComparison['performance_tier'];
      let recommendation: string;

      if (stat.f_per_1k > 5) {
        tier = 'viral';
        recommendation = '🚀 Boost weight by 50% - viral performer!';
      } else if (stat.f_per_1k > 3) {
        tier = 'excellent';
        recommendation = '⭐ Increase weight - strong performer';
      } else if (stat.f_per_1k > 1.5) {
        tier = 'good';
        recommendation = '✅ Maintain weight - solid performance';
      } else if (stat.f_per_1k > 0.5) {
        tier = 'average';
        recommendation = '⚠️ Monitor - below average';
      } else if (stat.f_per_1k > 0) {
        tier = 'poor';
        recommendation = '⬇️ Reduce weight - poor performance';
      } else {
        tier = 'failing';
        recommendation = '❌ Disable or drastically reduce - no followers';
      }

      return {
        generator_name: stat.name,
        f_per_1k: stat.f_per_1k,
        total_posts: stat.total_posts,
        rank: index + 1,
        performance_tier: tier,
        recommendation
      };
    });
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(generatorName?: string): Promise<PerformanceTrend[]> {
    try {
      const periods = [
        { name: 'Last 24h', days: 1 },
        { name: 'Last 3d', days: 3 },
        { name: 'Last 7d', days: 7 },
        { name: 'Last 14d', days: 14 },
        { name: 'Last 30d', days: 30 }
      ];

      const trends: PerformanceTrend[] = [];

      for (const period of periods) {
        const stats = await this.getGeneratorPerformance(period.days);
        
        for (const stat of stats) {
          if (generatorName && stat.name !== generatorName) continue;
          
          const previousPeriod = trends.find(
            t => t.generator_name === stat.name && t.period === period.name
          );
          
          let trend: 'improving' | 'stable' | 'declining' = 'stable';
          
          if (previousPeriod) {
            if (stat.f_per_1k > previousPeriod.f_per_1k * 1.1) trend = 'improving';
            else if (stat.f_per_1k < previousPeriod.f_per_1k * 0.9) trend = 'declining';
          }

          trends.push({
            generator_name: stat.name,
            period: period.name,
            f_per_1k: stat.f_per_1k,
            posts_count: stat.total_posts,
            trend
          });
        }
      }

      return trends;

    } catch (error: any) {
      console.error('❌ GENERATOR_TRACKER: Failed to get trends:', error.message);
      return [];
    }
  }

  /**
   * Get generators that need attention
   */
  async getGeneratorsNeedingAttention(): Promise<{
    viral: string[];
    failing: string[];
    underused: string[];
    overused: string[];
  }> {
    const stats = await this.getGeneratorPerformance(7);
    
    const viral = stats.filter(s => s.f_per_1k > 5 && s.total_posts >= 3).map(s => s.name);
    const failing = stats.filter(s => s.f_per_1k === 0 && s.total_posts >= 10).map(s => s.name);
    
    // Calculate expected usage based on weight
    const totalPosts = stats.reduce((sum, s) => sum + s.total_posts, 0);
    const underused = stats.filter(s => {
      const expectedPosts = totalPosts * s.current_weight;
      return s.total_posts < expectedPosts * 0.5 && s.current_weight > 0.05;
    }).map(s => s.name);
    
    const overused = stats.filter(s => {
      const expectedPosts = totalPosts * s.current_weight;
      return s.total_posts > expectedPosts * 1.5 && s.f_per_1k < 1;
    }).map(s => s.name);

    return { viral, failing, underused, overused };
  }

  /**
   * Update generator stats in database (called after new metrics collected)
   */
  async updateGeneratorStats(generatorName: string): Promise<void> {
    try {
      await this.supabase.rpc('update_generator_stats', {
        p_generator_name: generatorName
      });
      
      console.log(`✅ GENERATOR_TRACKER: Updated stats for ${generatorName}`);
    } catch (error: any) {
      console.error(`❌ GENERATOR_TRACKER: Failed to update stats for ${generatorName}:`, error.message);
    }
  }

  /**
   * Snapshot current performance for history tracking
   */
  async snapshotPerformance(periodDays: number = 7): Promise<void> {
    try {
      const stats = await this.getGeneratorPerformance(periodDays);
      const periodEnd = new Date();
      const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const snapshots = stats.map(stat => ({
        generator_name: stat.name,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        posts_count: stat.total_posts,
        followers_gained: stat.total_followers_gained,
        impressions: stat.total_impressions,
        f_per_1k: stat.f_per_1k,
        engagement_rate: stat.engagement_rate,
        total_likes: Math.round(stat.avg_likes * stat.total_posts),
        total_retweets: Math.round(stat.avg_retweets * stat.total_posts),
        total_replies: Math.round(stat.avg_replies * stat.total_posts),
        total_views: Math.round(stat.avg_views * stat.total_posts),
        weight_used: stat.current_weight,
        experiment_arm: null
      }));

      const { error } = await this.supabase
        .from('generator_performance_history')
        .insert(snapshots);

      if (error) throw error;

      console.log(`✅ GENERATOR_TRACKER: Snapshotted performance for ${snapshots.length} generators`);
    } catch (error: any) {
      console.error('❌ GENERATOR_TRACKER: Failed to snapshot performance:', error.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════

let instance: GeneratorPerformanceTracker | null = null;

export function getGeneratorPerformanceTracker(): GeneratorPerformanceTracker {
  if (!instance) {
    instance = new GeneratorPerformanceTracker();
  }
  return instance;
}

