/**
 * 🔬 VARIANCE ANALYZER
 * 
 * Discovers which factors matter MOST by analyzing:
 * - How much each factor explains performance variance
 * - Aggregate performance across all combinations
 * - Synergies (what works together)
 * - Anti-synergies (what cancels out)
 */

import { getSupabaseClient } from '../db';

export interface FactorAggregate {
  value: string;
  uses: number;
  avgViews: number;
  avgLikes: number;
  avgRetweets: number;
  topicsDiversity: number;
  tonesDiversity: number;
  generatorsDiversity: number;
  formatsDiversity: number;
  consistency: number; // Standard deviation
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface FactorImportance {
  factor: string;
  variance: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  percentExplained: number;
}

export interface Synergy {
  combo: string;
  multiplier: number;
  avgViews: number;
  uses: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class VarianceAnalyzer {
  private static instance: VarianceAnalyzer;
  private supabase = getSupabaseClient();

  private constructor() {}

  public static getInstance(): VarianceAnalyzer {
    if (!VarianceAnalyzer.instance) {
      VarianceAnalyzer.instance = new VarianceAnalyzer();
    }
    return VarianceAnalyzer.instance;
  }

  /**
   * Calculate which factors explain the most variance in performance
   * This tells us what ACTUALLY matters!
   */
  async calculateFactorImportance(): Promise<FactorImportance[]> {
    console.log('[VARIANCE] 🔬 Calculating factor importance...');

    const factors = [
      { name: 'visual_format', column: 'visual_format' },
      { name: 'tone', column: 'tone' },
      { name: 'generator', column: 'generator_name' },
      { name: 'topic', column: 'raw_topic' }
    ];

    const importance: FactorImportance[] = [];

    for (const factor of factors) {
      const variance = await this.calculateVarianceForFactor(factor.column);
      
      importance.push({
        factor: factor.name,
        variance,
        impact: variance > 5000 ? 'HIGH' : variance > 2000 ? 'MEDIUM' : 'LOW',
        percentExplained: 0 // Will be calculated relative to total
      });
    }

    // Calculate percent explained (relative to total variance)
    const totalVariance = importance.reduce((sum, f) => sum + f.variance, 0);
    importance.forEach(f => {
      f.percentExplained = (f.variance / totalVariance) * 100;
    });

    // Sort by variance (highest impact first)
    importance.sort((a, b) => b.variance - a.variance);

    console.log(`[VARIANCE] ✅ Top factor: ${importance[0].factor} (${importance[0].percentExplained.toFixed(0)}% explained)`);

    return importance;
  }

  /**
   * Analyze aggregate performance for a specific factor
   * KEY INSIGHT: "Minimal spacing: 102 avg across 17 uses with 12 different topics"
   */
  async analyzeFactorAggregates(
    factor: 'visual_format' | 'tone' | 'generator_name' | 'raw_topic'
  ): Promise<FactorAggregate[]> {
    console.log(`[VARIANCE] 📊 Analyzing aggregates for: ${factor}...`);

    const { data, error } = await this.supabase
      .from('content_generation_metadata_comprehensive')
      .select('visual_format, tone, generator_name, raw_topic, actual_views, actual_likes, actual_retweets')
      .not(factor, 'is', null)
      .not('actual_views', 'is', null);

    if (error || !data || data.length === 0) {
      console.error(`[VARIANCE] Error fetching ${factor} data:`, error);
      return [];
    }

    // Group by factor value
    const aggregateMap = new Map<string, {
      views: number[],
      likes: number[],
      retweets: number[],
      topics: Set<string>,
      tones: Set<string>,
      generators: Set<string>,
      formats: Set<string>
    }>();

    data.forEach((post: any) => {
      const value = post[factor] as string;
      
      if (!aggregateMap.has(value)) {
        aggregateMap.set(value, {
          views: [],
          likes: [],
          retweets: [],
          topics: new Set(),
          tones: new Set(),
          generators: new Set(),
          formats: new Set()
        });
      }

      const agg = aggregateMap.get(value)!;
      if (post.actual_views) agg.views.push(post.actual_views as number);
      if (post.actual_likes) agg.likes.push(post.actual_likes as number);
      if (post.actual_retweets) agg.retweets.push(post.actual_retweets as number);
      if (post.raw_topic) agg.topics.add(post.raw_topic as string);
      if (post.tone) agg.tones.add(post.tone as string);
      if (post.generator_name) agg.generators.add(post.generator_name as string);
      if (post.visual_format) agg.formats.add(post.visual_format as string);
    });

    // Calculate aggregates
    const aggregates: FactorAggregate[] = [];

    aggregateMap.forEach((agg, value) => {
      if (agg.views.length < 5) return; // Skip if less than 5 uses

      const avgViews = this.avg(agg.views);
      const consistency = this.stdDev(agg.views);

      aggregates.push({
        value,
        uses: agg.views.length,
        avgViews,
        avgLikes: this.avg(agg.likes),
        avgRetweets: this.avg(agg.retweets),
        topicsDiversity: agg.topics.size,
        tonesDiversity: agg.tones.size,
        generatorsDiversity: agg.generators.size,
        formatsDiversity: agg.formats.size,
        consistency,
        reliability: consistency < 20 ? 'HIGH' : consistency < 40 ? 'MEDIUM' : 'LOW'
      });
    });

    // Sort by average views
    aggregates.sort((a, b) => b.avgViews - a.avgViews);

    console.log(`[VARIANCE] ✅ Analyzed ${aggregates.length} values for ${factor}`);

    return aggregates;
  }

  /**
   * Find synergies - combinations that multiply effect
   */
  async findSynergies(minUses: number = 5): Promise<Synergy[]> {
    console.log('[VARIANCE] 🔗 Finding synergies...');

    const { data } = await this.supabase
      .from('content_generation_metadata_comprehensive')
      .select('generator_name, tone, visual_format, actual_views')
      .not('generator_name', 'is', null)
      .not('tone', 'is', null)
      .not('visual_format', 'is', null)
      .not('actual_views', 'is', null);

    if (!data || data.length === 0) return [];

    // Calculate baseline (overall average)
    const baseline = this.avg(data.map((d: any) => d.actual_views as number));

    // Group by combinations
    const comboMap = new Map<string, number[]>();

    data.forEach((post: any) => {
      const combo = `${post.generator_name} + ${post.tone} + ${post.visual_format}`;
      if (!comboMap.has(combo)) {
        comboMap.set(combo, []);
      }
      comboMap.get(combo)!.push(post.actual_views as number);
    });

    // Calculate multipliers
    const synergies: Synergy[] = [];

    comboMap.forEach((views, combo) => {
      if (views.length < minUses) return;

      const avgViews = this.avg(views);
      const multiplier = avgViews / baseline;

      synergies.push({
        combo,
        multiplier,
        avgViews,
        uses: views.length,
        confidence: views.length >= 10 ? 'HIGH' : views.length >= 5 ? 'MEDIUM' : 'LOW'
      });
    });

    // Sort by multiplier
    synergies.sort((a, b) => b.multiplier - a.multiplier);

    console.log(`[VARIANCE] ✅ Found ${synergies.length} synergies`);

    return synergies;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  private async calculateVarianceForFactor(column: string): Promise<number> {
    const { data } = await this.supabase
      .from('content_generation_metadata_comprehensive')
      .select(`${column}, actual_views`)
      .not(column, 'is', null)
      .not('actual_views', 'is', null);

    if (!data || data.length === 0) return 0;

    // Group by factor value and calculate average views per value
    const groupMap = new Map<string, number[]>();
    
    data.forEach((post: any) => {
      const value = post[column] as string;
      if (!groupMap.has(value)) {
        groupMap.set(value, []);
      }
      groupMap.get(value)!.push(post.actual_views as number);
    });

    // Calculate average views for each value
    const groupAverages = Array.from(groupMap.values()).map(views => this.avg(views));

    // Calculate variance of these averages
    return this.variance(groupAverages);
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private variance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = this.avg(numbers);
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return this.avg(squaredDiffs);
  }

  private stdDev(numbers: number[]): number {
    return Math.sqrt(this.variance(numbers));
  }
}

/**
 * Singleton getter
 */
export function getVarianceAnalyzer(): VarianceAnalyzer {
  return VarianceAnalyzer.getInstance();
}

