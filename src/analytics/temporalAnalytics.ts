/**
 * 📈 TEMPORAL ANALYTICS ENGINE
 * 
 * Analyzes content performance over time to detect:
 * - What's GAINING traction (rising patterns)
 * - What's LOSING effectiveness (declining patterns)
 * - Overall account growth trajectory
 * - Emerging winners and fading losers
 */

import { getSupabaseClient } from '../db';

export interface WeeklyData {
  week: string;
  avgViews: number;
  avgLikes: number;
  avgRetweets: number;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
}

export interface FactorMomentum {
  value: string;
  trajectory: number[];
  weeklyAvg: number[];
  growth: number;
  status: 'ACCELERATING' | 'GROWING' | 'STABLE' | 'DECLINING' | 'DEAD';
  uses: number;
}

export interface AccountGrowth {
  weekly: WeeklyData[];
  trend: 'GROWING' | 'DECLINING' | 'FLAT';
  growthRate: number;
  weekOverWeekChange: number;
  totalPosts: number;
}

export class TemporalAnalytics {
  private static instance: TemporalAnalytics;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): TemporalAnalytics {
    if (!TemporalAnalytics.instance) {
      TemporalAnalytics.instance = new TemporalAnalytics();
    }
    return TemporalAnalytics.instance;
  }

  /**
   * Analyze overall account growth trajectory
   */
  async analyzeAccountGrowth(): Promise<AccountGrowth> {
    console.log('[TEMPORAL] 📈 Analyzing overall account growth...');

    const { data, error } = await this.supabase
      .from('content_metadata')
      .select('posted_at, actual_impressions, actual_likes, actual_retweets')
      .not('posted_at', 'is', null)
      .not('actual_impressions', 'is', null)
      .order('posted_at', { ascending: true });

    if (error || !data || data.length === 0) {
      console.error('[TEMPORAL] Error fetching data:', error);
      return {
        weekly: [],
        trend: 'FLAT',
        growthRate: 0,
        weekOverWeekChange: 0,
        totalPosts: 0
      };
    }

    // Group by week
    const weeklyMap = new Map<string, { views: number[], likes: number[], retweets: number[] }>();
    
    data.forEach((post: any) => {
      const weekStart = this.getWeekStart(new Date(post.posted_at as string));
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { views: [], likes: [], retweets: [] });
      }
      
      const week = weeklyMap.get(weekKey)!;
      const impressions = Number(post.actual_impressions) || 0;
      if (impressions > 0) week.views.push(impressions);
      if (post.actual_likes) week.likes.push(post.actual_likes as number);
      if (post.actual_retweets) week.retweets.push(post.actual_retweets as number);
    });

    // Calculate weekly averages
    const weekly: WeeklyData[] = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        week,
        avgViews: this.avg(data.views),
        avgLikes: this.avg(data.likes),
        avgRetweets: this.avg(data.retweets),
        totalPosts: data.views.length,
        totalViews: this.sum(data.views),
        totalLikes: this.sum(data.likes)
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Calculate overall trend
    const firstWeek = weekly[0];
    const lastWeek = weekly[weekly.length - 1];
    const growthRate = firstWeek && firstWeek.avgViews > 0
      ? ((lastWeek.avgViews - firstWeek.avgViews) / firstWeek.avgViews) * 100
      : 0;

    const weekOverWeekChange = weekly.length >= 2
      ? ((lastWeek.avgViews - weekly[weekly.length - 2].avgViews) / weekly[weekly.length - 2].avgViews) * 100
      : 0;

    const trend = growthRate > 20 ? 'GROWING' : growthRate < -20 ? 'DECLINING' : 'FLAT';

    console.log(`[TEMPORAL] ✅ Account trend: ${trend} (${growthRate.toFixed(1)}% growth)`);

    return {
      weekly,
      trend,
      growthRate,
      weekOverWeekChange,
      totalPosts: data.length
    };
  }

  /**
   * Analyze momentum for a specific factor (visual_format, tone, generator, topic)
   */
  async analyzeFactorMomentum(
    factor: 'visual_format' | 'tone' | 'generator_name' | 'raw_topic'
  ): Promise<FactorMomentum[]> {
    console.log(`[TEMPORAL] 🔍 Analyzing momentum for: ${factor}...`);

    const columnMap = {
      visual_format: 'visual_format',
      tone: 'tone',
      generator_name: 'generator_name',
      raw_topic: 'raw_topic'
    };

    const column = columnMap[factor];

    const { data, error } = await this.supabase
      .from('content_metadata')
      .select(`posted_at, ${column}, actual_impressions`)
      .not('posted_at', 'is', null)
      .not(column, 'is', null)
      .not('actual_impressions', 'is', null)
      .order('posted_at', { ascending: true });

    if (error || !data || data.length === 0) {
      console.error(`[TEMPORAL] Error fetching ${factor} data:`, error);
      return [];
    }

    // Group by factor value and week
    const factorWeeklyMap = new Map<string, Map<string, number[]>>();

    data.forEach((post: any) => {
      const factorValue = post[column] as string;
      const weekStart = this.getWeekStart(new Date(post.posted_at));
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!factorWeeklyMap.has(factorValue)) {
        factorWeeklyMap.set(factorValue, new Map());
      }

      const weeklyData = factorWeeklyMap.get(factorValue)!;
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, []);
      }

      weeklyData.get(weekKey)!.push(Number(post.actual_impressions) || 0);
    });

    // Calculate momentum for each factor value
    const momentum: FactorMomentum[] = [];

    factorWeeklyMap.forEach((weeklyData, factorValue) => {
      // Need at least 2 weeks and 5 total uses
      const totalUses = Array.from(weeklyData.values()).reduce((sum, views) => sum + views.length, 0);
      
      if (weeklyData.size < 2 || totalUses < 5) {
        return; // Skip - insufficient data
      }

      // Sort weeks and calculate averages
      const sortedWeeks = Array.from(weeklyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

      const weeklyAvg = sortedWeeks.map(([week, views]) => this.avg(views));
      const trajectory = sortedWeeks.map(([week, views]) => this.sum(views));

      // Calculate growth
      const firstWeek = weeklyAvg[0];
      const lastWeek = weeklyAvg[weeklyAvg.length - 1];
      const growth = firstWeek > 0 ? ((lastWeek - firstWeek) / firstWeek) * 100 : 0;

      // Determine status
      let status: FactorMomentum['status'];
      if (growth > 100) status = 'ACCELERATING';
      else if (growth > 20) status = 'GROWING';
      else if (growth > -20) status = 'STABLE';
      else if (growth > -50) status = 'DECLINING';
      else status = 'DEAD';

      momentum.push({
        value: factorValue,
        trajectory,
        weeklyAvg,
        growth,
        status,
        uses: totalUses
      });
    });

    // Sort by growth rate
    momentum.sort((a, b) => b.growth - a.growth);

    console.log(`[TEMPORAL] ✅ Found ${momentum.length} patterns for ${factor}`);
    
    return momentum;
  }

  /**
   * Compare this week vs last week for all factors
   */
  async compareWeeks(): Promise<{
    thisWeek: any;
    lastWeek: any;
    changes: any;
  }> {
    console.log('[TEMPORAL] 📊 Comparing this week vs last week...');

    const now = new Date();
    const thisWeekStart = this.getWeekStart(now);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [thisWeekData, lastWeekData] = await Promise.all([
      this.getWeekData(thisWeekStart),
      this.getWeekData(lastWeekStart)
    ]);

    const changes = {
      viewsChange: thisWeekData.avgViews - lastWeekData.avgViews,
      viewsChangePercent: lastWeekData.avgViews > 0
        ? ((thisWeekData.avgViews - lastWeekData.avgViews) / lastWeekData.avgViews) * 100
        : 0,
      likesChange: thisWeekData.avgLikes - lastWeekData.avgLikes,
      postsChange: thisWeekData.totalPosts - lastWeekData.totalPosts
    };

    console.log(`[TEMPORAL] Week change: ${changes.viewsChangePercent > 0 ? '+' : ''}${changes.viewsChangePercent.toFixed(1)}%`);

    return {
      thisWeek: thisWeekData,
      lastWeek: lastWeekData,
      changes
    };
  }

  /**
   * Detect emerging patterns (new winners appearing)
   */
  async detectEmergingPatterns(): Promise<{
    risingStars: string[];
    fadingPatterns: string[];
    newEntrants: string[];
  }> {
    console.log('[TEMPORAL] 🔍 Detecting emerging patterns...');

    // Get momentum for all factors
    const [visualMomentum, toneMomentum, generatorMomentum] = await Promise.all([
      this.analyzeFactorMomentum('visual_format'),
      this.analyzeFactorMomentum('tone'),
      this.analyzeFactorMomentum('generator_name')
    ]);

    const risingStars = [
      ...visualMomentum.filter(m => m.status === 'ACCELERATING').map(m => `${m.value} (visual)`),
      ...toneMomentum.filter(m => m.status === 'ACCELERATING').map(m => `${m.value} (tone)`),
      ...generatorMomentum.filter(m => m.status === 'ACCELERATING').map(m => `${m.value} (generator)`)
    ];

    const fadingPatterns = [
      ...visualMomentum.filter(m => m.status === 'DECLINING' || m.status === 'DEAD').map(m => `${m.value} (visual)`),
      ...toneMomentum.filter(m => m.status === 'DECLINING' || m.status === 'DEAD').map(m => `${m.value} (tone)`),
      ...generatorMomentum.filter(m => m.status === 'DECLINING' || m.status === 'DEAD').map(m => `${m.value} (generator)`)
    ];

    // New entrants are patterns with <10 uses but showing promise
    const newEntrants = [
      ...visualMomentum.filter(m => m.uses < 10 && m.growth > 50).map(m => `${m.value} (visual)`),
      ...toneMomentum.filter(m => m.uses < 10 && m.growth > 50).map(m => `${m.value} (tone)`)
    ];

    console.log(`[TEMPORAL] ✅ Rising: ${risingStars.length}, Fading: ${fadingPatterns.length}, New: ${newEntrants.length}`);

    return {
      risingStars,
      fadingPatterns,
      newEntrants
    };
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  private async getWeekData(weekStart: Date): Promise<{
    avgViews: number;
    avgLikes: number;
    avgRetweets: number;
    totalPosts: number;
  }> {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data } = await this.supabase
      .from('content_metadata')
      .select('actual_impressions, actual_likes, actual_retweets')
      .gte('posted_at', weekStart.toISOString())
      .lt('posted_at', weekEnd.toISOString())
      .not('actual_impressions', 'is', null);

    if (!data || data.length === 0) {
      return { avgViews: 0, avgLikes: 0, avgRetweets: 0, totalPosts: 0 };
    }

    return {
      avgViews: this.avg(data.map((d: any) => Number(d.actual_impressions) || 0)),
      avgLikes: this.avg(data.map((d: any) => (d.actual_likes || 0) as number)),
      avgRetweets: this.avg(data.map((d: any) => (d.actual_retweets || 0) as number)),
      totalPosts: data.length
    };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    return new Date(d.setDate(diff));
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private sum(numbers: number[]): number {
    return numbers.reduce((sum, n) => sum + n, 0);
  }
}

/**
 * Singleton getter
 */
export function getTemporalAnalytics(): TemporalAnalytics {
  return TemporalAnalytics.getInstance();
}

