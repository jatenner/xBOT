/**
 * META-LEARNING ENGINE
 * Discovers cross-pattern insights from all performance data
 */

import { getSupabaseClient } from '../db/index';

export interface MetaInsight {
  insight_id: string;
  insight_type: string;
  pattern: string;
  confidence: number;
  sample_size: number;
  avg_followers_gained: number;
  recommendations: string;
  examples: string[];
}

/**
 * Run weekly meta-learning analysis
 */
export async function runMetaLearningAnalysis(): Promise<void> {
  console.log('[META_LEARNING] 🧠 Starting weekly analysis...');
  
  const supabase = getSupabaseClient();
  
  // Get all post attribution data from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const { data: posts, error } = await supabase
    .from('content_with_outcomes')  // ✅ ROOT CAUSE FIX: Use table with actual data
    .select('*')
    .gte('posted_at', thirtyDaysAgo.toISOString())
    .not('followers_gained', 'is', null);
  
  if (error || !posts || posts.length === 0) {
    console.log('[META_LEARNING] ℹ️ Insufficient data for analysis');
    return;
  }
  
  console.log(`[META_LEARNING] 📊 Analyzing ${posts.length} posts...`);
  
  const insights: MetaInsight[] = [];
  
  // INSIGHT 1: Hook + Topic Combinations
  const hookTopicCombos = analyzeHookTopicCombos(posts);
  insights.push(...hookTopicCombos);
  
  // INSIGHT 2: Format + Generator Performance
  const formatGeneratorInsights = analyzeFormatGenerator(posts);
  insights.push(...formatGeneratorInsights);
  
  // INSIGHT 3: Viral Score Thresholds
  const viralThresholds = analyzeViralThresholds(posts);
  insights.push(...viralThresholds);
  
  // INSIGHT 4: Time-based Patterns
  const timePatterns = analyzeTimePatterns(posts);
  insights.push(...timePatterns);
  
  // Store high-confidence insights
  for (const insight of insights) {
    if (insight.confidence > 0.7 && insight.sample_size >= 5) {
      try {
        await supabase.from('meta_insights').upsert({
          insight_id: insight.insight_id,
          insight_type: insight.insight_type,
          pattern: insight.pattern,
          confidence: insight.confidence,
          sample_size: insight.sample_size,
          avg_followers_gained: insight.avg_followers_gained,
          recommendations: insight.recommendations,
          examples: insight.examples,
          is_active: true,
          last_validated: new Date().toISOString()
        }, {
          onConflict: 'insight_id'
        });
        
        console.log(`[META_LEARNING] ✅ Insight: ${insight.pattern} (confidence: ${(insight.confidence * 100).toFixed(0)}%)`);
      } catch (err: any) {
        console.error(`[META_LEARNING] ❌ Failed to store insight:`, err.message);
      }
    }
  }
  
  console.log(`[META_LEARNING] ✅ Analysis complete - ${insights.length} insights discovered`);
}

/**
 * Analyze hook + topic combinations
 */
function analyzeHookTopicCombos(posts: any[]): MetaInsight[] {
  const insights: MetaInsight[] = [];
  const combos: { [key: string]: { count: number; totalFollowers: number; examples: string[] } } = {};
  
  for (const post of posts) {
    const key = `${post.hook_pattern}__${post.topic}`;
    if (!combos[key]) {
      combos[key] = { count: 0, totalFollowers: 0, examples: [] };
    }
    combos[key].count++;
    combos[key].totalFollowers += Number(post.followers_gained) || 0;
    if (combos[key].examples.length < 3) {
      combos[key].examples.push(post.post_id);
    }
  }
  
  // Find high-performing combinations
  for (const [key, data] of Object.entries(combos)) {
    if (data.count >= 3) {
      const [hook, topic] = key.split('__');
      const avgFollowers = data.totalFollowers / data.count;
      
      if (avgFollowers > 8) {
        insights.push({
          insight_id: `hook_topic_${hook}_${topic}`,
          insight_type: 'hook_topic_combo',
          pattern: `${hook} hooks on ${topic} topics`,
          confidence: Math.min(data.count / 10, 0.95),
          sample_size: data.count,
          avg_followers_gained: avgFollowers,
          recommendations: `Use ${hook} style hooks for ${topic} content`,
          examples: data.examples
        });
      }
    }
  }
  
  return insights;
}

/**
 * Analyze format + generator combinations
 */
function analyzeFormatGenerator(posts: any[]): MetaInsight[] {
  const insights: MetaInsight[] = [];
  const combos: { [key: string]: { count: number; totalFollowers: number } } = {};
  
  for (const post of posts) {
    const key = `${post.format}__${post.generator_used}`;
    if (!combos[key]) {
      combos[key] = { count: 0, totalFollowers: 0 };
    }
    combos[key].count++;
    combos[key].totalFollowers += Number(post.followers_gained) || 0;
  }
  
  for (const [key, data] of Object.entries(combos)) {
    if (data.count >= 5) {
      const [format, generator] = key.split('__');
      const avgFollowers = data.totalFollowers / data.count;
      
      if (avgFollowers > 10) {
        insights.push({
          insight_id: `format_gen_${format}_${generator}`,
          insight_type: 'format_generator',
          pattern: `${generator} performs best as ${format}`,
          confidence: Math.min(data.count / 15, 0.9),
          sample_size: data.count,
          avg_followers_gained: avgFollowers,
          recommendations: `Use ${format} format for ${generator} generator`,
          examples: []
        });
      }
    }
  }
  
  return insights;
}

/**
 * Analyze viral score thresholds
 */
function analyzeViralThresholds(posts: any[]): MetaInsight[] {
  const insights: MetaInsight[] = [];
  
  // Group by viral score ranges
  const ranges = [
    { min: 70, max: 100, label: 'high' },
    { min: 50, max: 69, label: 'medium' },
    { min: 0, max: 49, label: 'low' }
  ];
  
  for (const range of ranges) {
    const postsInRange = posts.filter(p => 
      Number(p.viral_score) >= range.min && Number(p.viral_score) <= range.max
    );
    
    if (postsInRange.length >= 5) {
      const avgFollowers = postsInRange.reduce((sum, p) => 
        sum + (Number(p.followers_gained) || 0), 0) / postsInRange.length;
      
      insights.push({
        insight_id: `viral_threshold_${range.label}`,
        insight_type: 'viral_threshold',
        pattern: `Viral score ${range.min}-${range.max} → ${avgFollowers.toFixed(1)} followers/post`,
        confidence: 0.85,
        sample_size: postsInRange.length,
        avg_followers_gained: avgFollowers,
        recommendations: range.label === 'high' 
          ? 'Prioritize posting high-scoring content'
          : 'Regenerate low-scoring content',
        examples: []
      });
    }
  }
  
  return insights;
}

/**
 * Analyze time-based patterns
 */
function analyzeTimePatterns(posts: any[]): MetaInsight[] {
  const insights: MetaInsight[] = [];
  
  // Group by day of week
  const dayGroups: { [key: string]: any[] } = {};
  
  for (const post of posts) {
    const day = new Date(post.posted_at).getDay();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
    if (!dayGroups[dayName]) {
      dayGroups[dayName] = [];
    }
    dayGroups[dayName].push(post);
  }
  
  // Find best performing days
  const dayPerformance = Object.entries(dayGroups).map(([day, posts]) => ({
    day,
    avgFollowers: posts.reduce((sum, p) => sum + (Number(p.followers_gained) || 0), 0) / posts.length,
    count: posts.length
  }));
  
  const bestDay = dayPerformance.sort((a, b) => b.avgFollowers - a.avgFollowers)[0];
  
  if (bestDay && bestDay.count >= 3) {
    insights.push({
      insight_id: `best_day_${bestDay.day}`,
      insight_type: 'timing',
      pattern: `${bestDay.day} posts perform ${(bestDay.avgFollowers / 10 * 100).toFixed(0)}% better`,
      confidence: 0.75,
      sample_size: bestDay.count,
      avg_followers_gained: bestDay.avgFollowers,
      recommendations: `Post more on ${bestDay.day}`,
      examples: []
    });
  }
  
  return insights;
}

/**
 * Get active meta-insights for application
 */
export async function getActiveMetaInsights(): Promise<MetaInsight[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('meta_insights')
    .select('*')
    .eq('is_active', true)
    .gte('confidence', 0.7)
    .order('confidence', { ascending: false })
    .limit(10);
  
  if (error || !data) {
    return [];
  }
  
  return data as MetaInsight[];
}

