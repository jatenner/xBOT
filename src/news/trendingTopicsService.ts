/**
 * 📈 TRENDING TOPICS SERVICE
 * 
 * Detects what's trending RIGHT NOW:
 * - Counts topic mentions over time
 * - Identifies surging topics
 * - Updates trending flags
 * - Provides real-time trend data
 */

import { getSupabaseClient } from '../db';

export interface TrendingTopic {
  topic: string;
  mention_count_today: number;
  mention_count_yesterday: number;
  trend_score: number;
  viral_posts: string[];
  last_updated: string;
}

export class TrendingTopicsService {
  private static instance: TrendingTopicsService;
  
  private constructor() {}
  
  static getInstance(): TrendingTopicsService {
    if (!TrendingTopicsService.instance) {
      TrendingTopicsService.instance = new TrendingTopicsService();
    }
    return TrendingTopicsService.instance;
  }

  /**
   * Update trending topics based on scraped data
   */
  async updateTrendingTopics(): Promise<void> {
    console.log('[TRENDING] 📈 Updating trending topics...');
    
    try {
      const supabase = getSupabaseClient();
      
      // Get topic counts for today
      const todayCounts = await this.getTopicCounts('today');
      
      // Get topic counts for yesterday
      const yesterdayCounts = await this.getTopicCounts('yesterday');
      
      // Calculate trend scores
      const trendingTopics: TrendingTopic[] = [];
      
      for (const topic of Object.keys(todayCounts)) {
        const todayCount = todayCounts[topic];
        const yesterdayCount = yesterdayCounts[topic] || 1; // Avoid division by zero
        
        const trendScore = todayCount / yesterdayCount;
        
        // Only track topics with significant mentions
        if (todayCount >= 3) {
          trendingTopics.push({
            topic,
            mention_count_today: todayCount,
            mention_count_yesterday: yesterdayCount,
            trend_score: trendScore,
            viral_posts: [], // Will be populated below
            last_updated: new Date().toISOString()
          });
        }
      }
      
      // Sort by trend score
      trendingTopics.sort((a, b) => b.trend_score - a.trend_score);
      
      console.log(`[TRENDING] 📊 Found ${trendingTopics.length} trending topics`);
      
      // Store in database
      for (const trending of trendingTopics) {
        await supabase
          .from('trending_topics')
          .upsert({
            topic: trending.topic,
            mention_count_today: trending.mention_count_today,
            mention_count_yesterday: trending.mention_count_yesterday,
            trend_score: trending.trend_score,
            last_updated: trending.last_updated
          }, {
            onConflict: 'topic'
          });
        
        // Mark curated news for this topic as trending
        if (trending.trend_score >= 2.0) {
          await supabase
            .from('health_news_curated')
            .update({ trending: true })
            .eq('topic', trending.topic)
            .gte('freshness_score', 60);
          
          console.log(`[TRENDING] 🔥 ${trending.topic} is trending ${trending.trend_score.toFixed(1)}x`);
        }
      }
      
      // Cleanup old trending topics
      await this.cleanupOldTrends();
      
      console.log('[TRENDING] ✅ Trending topics updated');
      
    } catch (error: any) {
      console.error('[TRENDING] ❌ Failed to update trending topics:', error.message);
      throw error;
    }
  }

  /**
   * Get topic counts for a time period
   */
  private async getTopicCounts(period: 'today' | 'yesterday'): Promise<Record<string, number>> {
    const supabase = getSupabaseClient();
    
    // Calculate time range
    const now = new Date();
    let startTime: Date;
    let endTime: Date;
    
    if (period === 'today') {
      startTime = new Date(now.setHours(0, 0, 0, 0));
      endTime = new Date();
    } else {
      endTime = new Date(now.setHours(0, 0, 0, 0));
      startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    }
    
    // Query curated news
    const { data: news } = await supabase
      .from('health_news_curated')
      .select('topic')
      .gte('created_at', startTime.toISOString())
      .lt('created_at', endTime.toISOString());
    
    if (!news) return {};
    
    // Count mentions per topic
    const counts: Record<string, number> = {};
    for (const item of news) {
      const topic = String(item.topic || '');
      if (topic) {
        counts[topic] = (counts[topic] || 0) + 1;
      }
    }
    
    return counts;
  }

  /**
   * Get current trending topics
   */
  async getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('trending_topics')
      .select('*')
      .gte('trend_score', 1.5) // At least 1.5x increase
      .order('trend_score', { ascending: false })
      .limit(limit);
    
    return (data || []) as unknown as TrendingTopic[];
  }

  /**
   * Check if a topic is trending
   */
  async isTopicTrending(topic: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('trending_topics')
      .select('trend_score')
      .eq('topic', topic)
      .gte('trend_score', 2.0) // 2x increase = trending
      .single();
    
    return !!data;
  }

  /**
   * Cleanup old trending topics (> 7 days)
   */
  private async cleanupOldTrends(): Promise<void> {
    const supabase = getSupabaseClient();
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('trending_topics')
      .delete()
      .lt('last_updated', sevenDaysAgo);
  }
}

export const trendingTopicsService = TrendingTopicsService.getInstance();

