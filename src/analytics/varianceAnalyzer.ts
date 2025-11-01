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

  /**
   * 🎯 GROWTH-BASED: Find dimensions with HIGH POTENTIAL
   * High variance = high ceiling (some posts do VERY well)
   */
  async findHighPotentialDimensions(): Promise<{
    dimension: string;
    avgViews: number;
    maxViews: number;
    minViews: number;
    variance: number;
    potential: 'massive' | 'high' | 'moderate' | 'low';
    recommendation: string;
  }[]> {
    console.log('[VARIANCE] 🎯 Finding high-potential dimensions...');

    const dimensions = ['raw_topic', 'generator_name', 'format_strategy', 'visual_format'];
    const results = [];

    for (const dim of dimensions) {
      const analysis = await this.analyzeDimensionVariance(dim);
      if (analysis) results.push(analysis);
    }

    return results.sort((a, b) => b.variance - a.variance);
  }

  /**
   * 🔥 GROWTH-BASED: Analyze BREAKTHROUGH posts (outliers)
   * Study what made them special
   */
  async analyzeBreakthroughs(multiplier: number = 5): Promise<{
    post: any;
    whatMadeItSpecial: string[];
    recommendation: string;
  }[]> {
    console.log(`[VARIANCE] 🔥 Finding breakthrough posts (${multiplier}x average)...`);

    // Get all posts
    const { data: allPosts } = await this.supabase
      .from('content_with_outcomes')
      .select('actual_impressions')
      .not('actual_impressions', 'is', null);

    if (!allPosts || allPosts.length === 0) {
      return [{
        post: null,
        whatMadeItSpecial: ['No data available yet'],
        recommendation: 'Need more posts to analyze breakthroughs'
      }];
    }

    const avgViews = this.avg(allPosts.map(p => Number(p.actual_impressions) || 0));
    const threshold = avgViews * multiplier;

    console.log(`[VARIANCE] Average: ${avgViews.toFixed(0)}, Threshold: ${threshold.toFixed(0)}`);

    // Find breakthroughs
    const { data: breakthroughs } = await this.supabase
      .from('content_with_outcomes')
      .select('*')
      .gte('actual_impressions', threshold);

    if (!breakthroughs || breakthroughs.length === 0) {
      console.log(`[VARIANCE] No breakthroughs found at ${multiplier}x threshold`);
      return [{
        post: null,
        whatMadeItSpecial: [`No posts exceed ${multiplier}x average (${threshold.toFixed(0)} views)`],
        recommendation: `Lower threshold or wait for more viral posts. Current best: ${Math.max(...allPosts.map(p => Number(p.actual_impressions) || 0))} views`
      }];
    }

    console.log(`[VARIANCE] ✅ Found ${breakthroughs.length} breakthrough posts!`);

    // Analyze what makes them special
    return breakthroughs.map(post => {
      const special: string[] = [];

      // Analyze generator
      if (post.generator_name) {
        special.push(`Used ${post.generator_name} generator`);
      }

      // Analyze visual format
      if (post.visual_format && post.visual_format !== 'plain') {
        special.push(`Visual format: ${post.visual_format}`);
      }

      // Analyze format strategy
      if (post.format_strategy) {
        special.push(`Format: ${post.format_strategy}`);
      }

      // Analyze tone
      if (post.tone) {
        special.push(`Tone: ${post.tone}`);
      }

      // Analyze angle
      if (post.angle) {
        special.push(`Angle: ${post.angle}`);
      }

      return {
        post,
        whatMadeItSpecial: special.length > 0 ? special : ['Analyze manually - no obvious pattern'],
        recommendation: special.length > 0 
          ? `Test ${special.slice(0, 2).join(' + ')} combination on NEW topics!`
          : 'Study this post to identify success factors'
      };
    });
  }

  /**
   * PRIVATE: Analyze variance for a specific dimension
   */
  private async analyzeDimensionVariance(dimension: string): Promise<{
    dimension: string;
    avgViews: number;
    maxViews: number;
    minViews: number;
    variance: number;
    potential: 'massive' | 'high' | 'moderate' | 'low';
    recommendation: string;
  } | null> {
    const { data } = await this.supabase
      .from('content_with_outcomes')
      .select(`${dimension}, actual_impressions`)
      .not(dimension, 'is', null)
      .not('actual_impressions', 'is', null);

    if (!data || data.length < 10) return null;

    // Group by dimension value
    const groups = new Map<string, number[]>();

    data.forEach((post: any) => {
      const value = String(post[dimension]);
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value)!.push(Number(post.actual_impressions) || 0);
    });

    // Calculate variance for each value
    const variances: number[] = [];
    const maxValues: number[] = [];
    const avgValues: number[] = [];

    groups.forEach(views => {
      if (views.length < 2) return;
      const avg = this.avg(views);
      const max = Math.max(...views);
      const stdDeviation = this.stdDev(views);
      const coefficientOfVariation = avg > 0 ? stdDeviation / avg : 0;

      variances.push(coefficientOfVariation);
      maxValues.push(max);
      avgValues.push(avg);
    });

    if (variances.length === 0) return null;

    const avgVariance = this.avg(variances);
    const maxPossible = Math.max(...maxValues);
    const typicalAvg = this.avg(avgValues);
    const allViews = Array.from(groups.values()).flat();
    const minViews = Math.min(...allViews);

    // Determine potential based on variance AND max ceiling
    let potential: 'massive' | 'high' | 'moderate' | 'low';
    let recommendation: string;

    if (avgVariance > 1.5 && maxPossible > typicalAvg * 10) {
      potential = 'massive';
      recommendation = `🎯 ${dimension} has 10x+ potential! Study the outliers - what made them work?`;
    } else if (avgVariance > 1.0 && maxPossible > typicalAvg * 5) {
      potential = 'high';
      recommendation = `🔍 ${dimension} can 5x performance! Analyze top performers for patterns.`;
    } else if (avgVariance > 0.5) {
      potential = 'moderate';
      recommendation = `📊 ${dimension} has some variance. Test more variations.`;
    } else {
      potential = 'low';
      recommendation = `⚖️ ${dimension} is consistent but limited. May not be key lever.`;
    }

    return {
      dimension,
      avgViews: typicalAvg,
      maxViews: maxPossible,
      minViews,
      variance: avgVariance,
      potential,
      recommendation
    };
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

