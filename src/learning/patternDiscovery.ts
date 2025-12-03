/**
 * 🔍 PATTERN DISCOVERY ENGINE
 * 
 * Finds COMBINATIONS that work (not individual elements)
 * Learns PATTERNS not TOPICS
 * Recommends applying patterns to NEW content
 * 
 * Core Principle: "Learn approaches, not specifics"
 */

import { getSupabaseClient } from '../db';

export interface DiscoveredPattern {
  pattern: string; // "Provocateur + Questions + Cultural angle"
  avgViews: number;
  sampleSize: number;
  confidence: number; // 0-1
  transferable: boolean;
  recommendation: string;
  components: {
    generator?: string;
    tone?: string;
    angle?: string;
    visualFormat?: string;
    formatStrategy?: string;
  };
}

/**
 * Discover transferable patterns from successful content
 */
export async function discoverPatterns(): Promise<DiscoveredPattern[]> {
  console.log('[PATTERN_DISCOVERY] 🔍 Finding transferable patterns...');
  
  const supabase = getSupabaseClient();
  
  // Get all posts with complete metadata
  const { data: posts, error } = await supabase
    .from('content_with_outcomes')
    .select('*')
    .in('decision_type', ['single', 'thread'])  // ✅ Filter out replies - only learn from posts
    .not('raw_topic', 'is', null)
    .not('generator_name', 'is', null)
    .not('actual_impressions', 'is', null);
  
  if (error || !posts || posts.length < 20) {
    console.log('[PATTERN_DISCOVERY] ⚠️ Insufficient data (need 20+ posts)');
    return [];
  }
  
  // Calculate baseline (overall average)
  const baseline = average(posts.map(p => Number(p.actual_impressions) || 0));
  console.log(`[PATTERN_DISCOVERY] Baseline: ${baseline.toFixed(0)} views`);
  
  const patterns: DiscoveredPattern[] = [];
  
  // PATTERN 1: Generator + Visual Format
  patterns.push(...await findCombinationPatterns(
    posts,
    ['generator_name', 'visual_format'],
    baseline,
    5 // Min uses
  ));
  
  // PATTERN 2: Generator + Tone
  patterns.push(...await findCombinationPatterns(
    posts,
    ['generator_name', 'tone'],
    baseline,
    5
  ));
  
  // PATTERN 3: Format Strategy + Angle Type
  patterns.push(...await findCombinationPatterns(
    posts,
    ['format_strategy', 'angle'],
    baseline,
    5
  ));
  
  // PATTERN 4: Tone + Visual Format
  patterns.push(...await findCombinationPatterns(
    posts,
    ['tone', 'visual_format'],
    baseline,
    5
  ));
  
  // PATTERN 5: Triple combinations (higher confidence)
  patterns.push(...await findCombinationPatterns(
    posts,
    ['generator_name', 'tone', 'visual_format'],
    baseline,
    3 // Lower min for triple combos
  ));
  
  // Sort by performance lift (how much better than baseline)
  const sortedPatterns = patterns.sort((a, b) => {
    const aLift = a.avgViews / baseline;
    const bLift = b.avgViews / baseline;
    return bLift - aLift;
  });
  
  // Take top 10
  const topPatterns = sortedPatterns.slice(0, 10);
  
  console.log(`[PATTERN_DISCOVERY] ✅ Found ${topPatterns.length} strong patterns`);
  
  return topPatterns;
}

/**
 * Generate recommendations for how to apply discovered patterns
 */
export function generatePatternRecommendations(patterns: DiscoveredPattern[]): string {
  if (patterns.length === 0) {
    return 'No patterns discovered yet - need more data!';
  }
  
  const topPattern = patterns[0];
  const components = Object.entries(topPattern.components)
    .filter(([_, value]) => value)
    .map(([key, value]) => value)
    .join(' + ');
  
  return `
🎯 TOP PATTERN DISCOVERED: ${topPattern.pattern}
Performance: ${topPattern.avgViews.toFixed(0)} views avg (${topPattern.sampleSize} posts)
Confidence: ${(topPattern.confidence * 100).toFixed(0)}%

✅ DO: Apply this pattern to NEW topics
Example: If pattern is "${components}"
└─ Try on NEW topics: peptides, sleep, microbiome, etc.
└─ Use same APPROACH on FRESH content

❌ DON'T: Repeat the same topics that worked
└─ Don't post about the same topic 10 times
└─ Pattern might work, topic will get stale!

🔬 TEST: Validate pattern on 5+ new topics
└─ If pattern still works → It's transferable!
└─ If pattern stops working → It was topic-specific, discard!
`;
}

/**
 * PRIVATE: Find patterns for specific combination of dimensions
 */
async function findCombinationPatterns(
  posts: any[],
  dimensions: string[],
  baseline: number,
  minUses: number
): Promise<DiscoveredPattern[]> {
  
  // Group by combination
  const combos = new Map<string, { views: number[]; posts: any[] }>();
  
  posts.forEach(post => {
    const values = dimensions.map(dim => String(post[dim] || '')).filter(v => v);
    
    // Skip if any dimension is missing
    if (values.length !== dimensions.length) return;
    
    const combo = values.join(' + ');
    
    if (!combos.has(combo)) {
      combos.set(combo, { views: [], posts: [] });
    }
    
    combos.get(combo)!.views.push(Number(post.actual_impressions) || 0);
    combos.get(combo)!.posts.push(post);
  });
  
  // Analyze each combination
  const patterns: DiscoveredPattern[] = [];
  
  combos.forEach((data, combo) => {
    if (data.views.length < minUses) return; // Skip if too few uses
    
    const avgViews = average(data.views);
    const lift = avgViews / baseline;
    
    // Only keep if performs 50%+ better than baseline
    if (lift < 1.5) return;
    
    // Extract components
    const components: any = {};
    const comboValues = combo.split(' + ');
    dimensions.forEach((dim, i) => {
      components[dim] = comboValues[i];
    });
    
    // Calculate confidence based on sample size and consistency
    const stdDev = standardDeviation(data.views);
    const coefficientOfVariation = avgViews > 0 ? stdDev / avgViews : 1;
    const sampleConfidence = Math.min(data.views.length / 10, 1); // Max at 10 uses
    const consistencyConfidence = Math.max(0, 1 - coefficientOfVariation / 2); // Lower variance = higher confidence
    const confidence = (sampleConfidence + consistencyConfidence) / 2;
    
    patterns.push({
      pattern: combo,
      avgViews,
      sampleSize: data.views.length,
      confidence,
      transferable: true, // Assume transferable until proven otherwise
      recommendation: `"${combo}" performs ${(lift * 100 - 100).toFixed(0)}% above avg - TEST on NEW topics!`,
      components
    });
  });
  
  return patterns;
}

/**
 * HELPER: Calculate average
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * HELPER: Calculate standard deviation
 */
function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const avg = average(numbers);
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
  const variance = average(squaredDiffs);
  
  return Math.sqrt(variance);
}

