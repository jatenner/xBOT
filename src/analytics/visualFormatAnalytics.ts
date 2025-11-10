/**
 * 🎨 VISUAL FORMAT ANALYTICS
 * 
 * Analyzes visual formatting choices and performance
 * Feeds insights to AI Visual Formatter
 * 
 * Connects to: Growth Analytics (momentum signals)
 */

import { getSupabaseClient } from '../db';
import { findMomentumDimensions } from './growthAnalytics';

export interface ContextualFormatHistory {
  recentFormats: string[];
  totalUses: number;
  variety: number;
}

export interface FormatPerformanceInsight {
  approach: string;
  avgViews: number;
  uses: number;
  trend: 'improving' | 'stable' | 'declining';
  firstAvg: number;
  lastAvg: number;
}

export interface VisualFormatIntelligence {
  contextualHistory: ContextualFormatHistory;
  momentumSignals: any[]; // From growth analytics
  contextualInsights: FormatPerformanceInsight[];
  overallRecent: string[];
}

/**
 * PHASE 1: Get formats used for specific context (generator + tone)
 * Prevents "provocateur always uses questions"
 */
export async function getFormatsForContext(
  generator: string,
  tone: string
): Promise<ContextualFormatHistory> {
  const supabase = getSupabaseClient();
  
  const { data } = await supabase
    .from('visual_format_usage')
    .select('approach')
    .eq('generator', generator)
    .eq('tone', tone)
    .order('used_at', { ascending: false })
    .limit(10);
  
  if (!data || data.length === 0) {
    return {
      recentFormats: [],
      totalUses: 0,
      variety: 0
    };
  }
  
  const formats = data.map(d => String(d.approach));
  const uniqueFormats = new Set(formats);
  
  return {
    recentFormats: formats.slice(0, 5), // Last 5
    totalUses: formats.length,
    variety: uniqueFormats.size
  };
}

/**
 * PHASE 2: Analyze format performance for specific context
 * Shows what's IMPROVING (not just "best")
 */
export async function getContextualFormatInsights(
  generator: string,
  tone: string
): Promise<FormatPerformanceInsight[]> {
  const supabase = getSupabaseClient();
  
  // Get posts for this generator+tone with visual formats and metrics
  const { data: posts } = await supabase
    .from('content_with_outcomes')
    .select('visual_format, actual_impressions, posted_at')
    .eq('generator_name', generator)
    .eq('tone', tone)
    .not('visual_format', 'is', null)
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: true });
  
  if (!posts || posts.length < 5) {
    return []; // Not enough data for this context
  }
  
  // Group by format
  const formatGroups: Record<string, any[]> = {};
  posts.forEach(post => {
    const format = String(post.visual_format);
    if (!formatGroups[format]) formatGroups[format] = [];
    formatGroups[format].push(post);
  });
  
  const insights: FormatPerformanceInsight[] = [];
  
  for (const [format, formatPosts] of Object.entries(formatGroups)) {
    if (formatPosts.length < 2) continue; // Need at least 2 uses
    
    const views = formatPosts.map(p => Number(p.actual_impressions) || 0);
    const avgViews = average(views);
    
    // Trend detection: first use vs last use
    const firstAvg = average(views.slice(0, Math.ceil(formatPosts.length / 2)));
    const lastAvg = average(views.slice(Math.floor(formatPosts.length / 2)));
    
    let trend: 'improving' | 'stable' | 'declining';
    if (lastAvg > firstAvg * 1.2) trend = 'improving';
    else if (lastAvg < firstAvg * 0.8) trend = 'declining';
    else trend = 'stable';
    
    insights.push({
      approach: format,
      avgViews,
      uses: formatPosts.length,
      trend,
      firstAvg,
      lastAvg
    });
  }
  
  // Sort by average views
  return insights.sort((a, b) => b.avgViews - a.avgViews);
}

/**
 * MAIN FUNCTION: Build complete visual format intelligence
 * Combines contextual + growth + overall insights
 */
export async function buildVisualFormatIntelligence(
  generator: string,
  tone: string
): Promise<VisualFormatIntelligence> {
  console.log(`[VISUAL_ANALYTICS] 🧠 Building intelligence for ${generator} + ${tone}...`);
  
  try {
    // Get all intelligence in parallel
    const [contextHistory, momentum, contextInsights, overallRecent] = await Promise.all([
      // PHASE 1: Contextual history
      getFormatsForContext(generator, tone),
      
      // PHASE 2: Growth momentum signals
      (async () => {
        try {
          const allMomentum = await findMomentumDimensions();
          return allMomentum.visualFormats || [];
        } catch (error: any) {
          console.warn('[VISUAL_ANALYTICS] ⚠️ Momentum unavailable:', error.message);
          return [];
        }
      })(),
      
      // PHASE 2: Contextual performance insights
      getContextualFormatInsights(generator, tone),
      
      // Overall recent (for general variety)
      (async () => {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('content_metadata')
          .select('visual_format')
          .not('visual_format', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);
        return (data || []).map(d => String(d.visual_format));
      })()
    ]);
    
    console.log(`[VISUAL_ANALYTICS] ✅ Intelligence built:`);
    console.log(`  • Contextual history: ${contextHistory.recentFormats.length} recent`);
    console.log(`  • Momentum signals: ${momentum.length} trending`);
    console.log(`  • Context insights: ${contextInsights.length} patterns`);
    
    return {
      contextualHistory: contextHistory,
      momentumSignals: momentum,
      contextualInsights: contextInsights,
      overallRecent: overallRecent
    };
    
  } catch (error: any) {
    console.error('[VISUAL_ANALYTICS] ❌ Error building intelligence:', error.message);
    
    // Return minimal intelligence on error
    return {
      contextualHistory: { recentFormats: [], totalUses: 0, variety: 0 },
      momentumSignals: [],
      contextualInsights: [],
      overallRecent: []
    };
  }
}

/**
 * Helper: Calculate average
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

