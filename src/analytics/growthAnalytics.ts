/**
 * 🚀 GROWTH ANALYTICS ENGINE
 * 
 * Tracks week-over-week growth, momentum, and trends
 * Focus on IMPROVEMENT RATE not absolute numbers
 * 
 * Core Principle: "10→50→200 views is better than stuck at 200"
 */

import { getSupabaseClient } from '../db';

export interface MomentumSignal {
  value: string;
  trajectory: string;
  momentum: 'building' | 'stable' | 'fading';
  recommendation: string;
  confidence: number;
  firstAvg: number;
  secondAvg: number;
  growthRate: number;
}

export interface WeeklyGrowth {
  trend: 'accelerating' | 'growing' | 'flat' | 'declining';
  weeklyGrowthRate: number; // % per week
  baselineProgression: number[]; // [week1_avg, week2_avg, ...]
  momentum: 'gaining' | 'stable' | 'losing';
  recommendation: string;
  weeklyGrowthRates: number[]; // Individual week-over-week rates
}

export interface SystemHealth {
  overallTrend: 'accelerating' | 'growing' | 'flat' | 'declining';
  explorationRecommendation: number; // 0.3-0.7
  pivotRecommendation: string;
  currentBaseline: number;
  weeklyGrowthRate: number;
}

/**
 * Analyze week-over-week growth trends
 */
export async function analyzeWeeklyGrowth(): Promise<WeeklyGrowth> {
  console.log('[GROWTH_ANALYTICS] 📊 Analyzing week-over-week trends...');
  
  const supabase = getSupabaseClient();
  
  // Get last 8 weeks of posts
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
  
  const { data: posts, error } = await supabase
    .from('content_with_outcomes')
    .select('actual_impressions, posted_at')
    .gte('posted_at', eightWeeksAgo.toISOString())
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: true });
  
  if (error || !posts || posts.length < 10) {
    console.log('[GROWTH_ANALYTICS] ⚠️ Insufficient data for weekly analysis');
    return {
      trend: 'flat',
      weeklyGrowthRate: 0,
      baselineProgression: [],
      momentum: 'stable',
      recommendation: 'Need more data (at least 2 weeks of posts)',
      weeklyGrowthRates: []
    };
  }
  
  // Group posts by week
  const weeks = groupPostsByWeek(posts);
  
  if (weeks.length < 2) {
    console.log('[GROWTH_ANALYTICS] ⚠️ Need at least 2 weeks of data');
    return {
      trend: 'flat',
      weeklyGrowthRate: 0,
      baselineProgression: weeks.map(w => w.avgViews),
      momentum: 'stable',
      recommendation: 'Need at least 2 weeks of posts to detect trends',
      weeklyGrowthRates: []
    };
  }
  
  // Calculate week-over-week growth rates
  const growthRates: number[] = [];
  for (let i = 1; i < weeks.length; i++) {
    const rate = (weeks[i].avgViews - weeks[i-1].avgViews) / weeks[i-1].avgViews;
    growthRates.push(rate);
  }
  
  // Calculate average weekly growth rate
  const avgWeeklyGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
  
  // Analyze momentum (is growth rate ITSELF increasing?)
  const earlyGrowth = growthRates.slice(0, Math.floor(growthRates.length / 2));
  const recentGrowth = growthRates.slice(Math.floor(growthRates.length / 2));
  
  const earlyAvg = earlyGrowth.reduce((a, b) => a + b, 0) / earlyGrowth.length;
  const recentAvg = recentGrowth.reduce((a, b) => a + b, 0) / recentGrowth.length;
  
  const momentum = recentAvg > earlyAvg ? 'gaining' : recentAvg < earlyAvg ? 'losing' : 'stable';
  
  // Determine overall trend
  let trend: 'accelerating' | 'growing' | 'flat' | 'declining';
  let recommendation: string;
  
  if (avgWeeklyGrowth > 0.3 && momentum === 'gaining') {
    trend = 'accelerating';
    recommendation = '🚀 KEEP EXPERIMENTING! Growth is accelerating. Try bold new approaches.';
  } else if (avgWeeklyGrowth > 0.1) {
    trend = 'growing';
    recommendation = '📈 Growing steadily. Push harder - test wilder variations.';
  } else if (avgWeeklyGrowth > -0.05) {
    trend = 'flat';
    recommendation = '⚠️ PLATEAU! Need NEW approaches. Current content hit ceiling.';
  } else {
    trend = 'declining';
    recommendation = '🚨 PIVOT! Current approach declining. Try completely different content.';
  }
  
  console.log(`[GROWTH_ANALYTICS] Trend: ${trend}, Growth: ${(avgWeeklyGrowth * 100).toFixed(1)}%/week, Momentum: ${momentum}`);
  
  return {
    trend,
    weeklyGrowthRate: avgWeeklyGrowth,
    baselineProgression: weeks.map(w => w.avgViews),
    momentum,
    recommendation,
    weeklyGrowthRates: growthRates
  };
}

/**
 * Find dimensions (topics, formats, generators) showing MOMENTUM
 */
export async function findMomentumDimensions(): Promise<{
  topics: MomentumSignal[];
  formats: MomentumSignal[];
  generators: MomentumSignal[];
  visualFormats: MomentumSignal[];
}> {
  console.log('[GROWTH_ANALYTICS] 🔥 Finding momentum signals...');
  
  return {
    topics: await analyzeDimensionMomentum('raw_topic'),
    formats: await analyzeDimensionMomentum('format_strategy'),
    generators: await analyzeDimensionMomentum('generator_name'),
    visualFormats: await analyzeDimensionMomentum('visual_format')
  };
}

/**
 * Get overall system health and exploration recommendation
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const growth = await analyzeWeeklyGrowth();
  
  // Calculate exploration recommendation based on trend
  let explorationRate = 0.3; // Default 30%
  let pivotRecommendation: string;
  
  if (growth.trend === 'declining') {
    explorationRate = 0.7; // 70% exploration when declining
    pivotRecommendation = 'PIVOT: Try completely new topics, formats, and generators';
  } else if (growth.trend === 'flat') {
    explorationRate = 0.5; // 50% exploration when flat
    pivotRecommendation = 'EXPLORE: Current approach plateaued, need fresh ideas';
  } else if (growth.trend === 'accelerating') {
    explorationRate = 0.4; // 40% exploration when accelerating (still high!)
    pivotRecommendation = 'BALANCE: Keep experimenting while building on success';
  } else {
    explorationRate = 0.3; // 30% exploration when growing
    pivotRecommendation = 'STEADY: Continue current mix with some experimentation';
  }
  
  const currentBaseline = growth.baselineProgression.length > 0 
    ? growth.baselineProgression[growth.baselineProgression.length - 1] 
    : 0;
  
  console.log(`[GROWTH_ANALYTICS] System Health: ${growth.trend}, Exploration: ${(explorationRate * 100).toFixed(0)}%`);
  
  return {
    overallTrend: growth.trend,
    explorationRecommendation: explorationRate,
    pivotRecommendation,
    currentBaseline,
    weeklyGrowthRate: growth.weeklyGrowthRate
  };
}

/**
 * PRIVATE: Analyze momentum for a specific dimension
 */
async function analyzeDimensionMomentum(dimension: string): Promise<MomentumSignal[]> {
  const supabase = getSupabaseClient();
  
  // Get all posts with this dimension
  const { data: posts } = await supabase
    .from('content_with_outcomes')
    .select(`${dimension}, actual_impressions, posted_at`)
    .not(dimension, 'is', null)
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: true });
  
  if (!posts || posts.length < 10) {
    return [];
  }
  
  // Group by dimension value
  const groups = groupByDimension(posts, dimension);
  
  // Analyze each group for momentum
  const signals: MomentumSignal[] = [];
  
  for (const [value, dimPosts] of Object.entries(groups)) {
    if (dimPosts.length < 3) continue; // Need at least 3 data points
    
    // Split into first half and second half
    const midpoint = Math.floor(dimPosts.length / 2);
    const firstHalf = dimPosts.slice(0, midpoint);
    const secondHalf = dimPosts.slice(midpoint);
    
    const firstAvg = average(firstHalf.map(p => Number(p.actual_impressions) || 0));
    const secondAvg = average(secondHalf.map(p => Number(p.actual_impressions) || 0));
    
    const growthRate = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
    const latestPost = dimPosts[dimPosts.length - 1];
    const latestViews = Number(latestPost.actual_impressions) || 0;
    
    // Momentum signal: Growing AND recent performance good
    if (growthRate > 0.5 || (growthRate > 0.2 && latestViews > secondAvg * 1.5)) {
      const momentum = growthRate > 0.5 ? 'building' : 'stable';
      
      signals.push({
        value: String(value),
        trajectory: `${firstAvg.toFixed(0)} → ${secondAvg.toFixed(0)} (${(growthRate * 100).toFixed(0)}% growth)`,
        momentum,
        recommendation: growthRate > 0.5 
          ? `🔥 EXPLORE MORE! "${value}" is gaining strong momentum!`
          : `📈 PROMISING! "${value}" showing improvement - test variations.`,
        confidence: dimPosts.length > 5 ? 0.8 : 0.5,
        firstAvg,
        secondAvg,
        growthRate
      });
    }
  }
  
  // Sort by growth rate (highest momentum first)
  return signals.sort((a, b) => b.growthRate - a.growthRate);
}

/**
 * HELPER: Group posts by week
 */
function groupPostsByWeek(posts: any[]): Array<{ weekStart: Date; avgViews: number; postCount: number }> {
  const weeks = new Map<string, number[]>();
  
  posts.forEach(post => {
    const date = new Date(String(post.posted_at));
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, []);
    }
    
    weeks.get(weekKey)!.push(Number(post.actual_impressions) || 0);
  });
  
  // Convert to array and calculate averages
  return Array.from(weeks.entries())
    .map(([weekKey, views]) => ({
      weekStart: new Date(weekKey),
      avgViews: average(views),
      postCount: views.length
    }))
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

/**
 * HELPER: Group posts by dimension value
 */
function groupByDimension(posts: any[], dimension: string): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  posts.forEach(post => {
    const value = String(post[dimension] || 'unknown');
    if (!groups[value]) {
      groups[value] = [];
    }
    groups[value].push(post);
  });
  
  return groups;
}

/**
 * HELPER: Calculate average
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

