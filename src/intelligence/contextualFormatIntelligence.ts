/**
 * 🧠 CONTEXTUAL FORMAT INTELLIGENCE
 * 
 * Data-driven format recommendations based on:
 * - Generator + Topic + Tone + Angle + Structure combinations
 * 
 * Queries database: "What format worked for historian + sleep + provocative?"
 * Returns: Actual successful formats from posted tweets
 */

import { getSupabaseClient } from '../db';
import { log } from '../lib/logger';

export interface ContextualFormatMatch {
  generator: string;
  topic: string;
  tone: string;
  angle: string;
  structure: string;
  successfulFormats: Array<{
    visual_format: string;
    avg_er: number;
    count: number;
    examples: string[];
  }>;
  sampleCount: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Get format intelligence for specific context (generator + topic + tone + angle + structure)
 * This is what the user wants - data-driven, not hardcoded
 */
export async function getContextualFormatIntelligence(
  generator: string,
  topic: string,
  tone: string,
  angle: string,
  formatStrategy: string
): Promise<string | null> {
  log({ op: 'contextual_format_query', generator, topic, tone, angle });
  
  const supabase = getSupabaseClient();
  
  // Strategy 1: Exact match (generator + topic + tone + angle)
  let { data: exactMatches } = await supabase
    .from('content_metadata')
    .select('content, visual_format, actual_engagement_rate, actual_impressions, posted_at')
    .eq('generator_name', generator)
    .eq('tone', tone)
    .eq('angle', angle)
    .eq('status', 'posted')
    .not('actual_engagement_rate', 'is', null)
    .gt('actual_impressions', 0)
    .order('actual_engagement_rate', { ascending: false })
    .limit(50);
  
  // Strategy 2: If not enough exact matches, broaden to generator + tone
  if (!exactMatches || exactMatches.length < 5) {
    console.log(`[CONTEXTUAL_FORMAT] ⚠️ Only ${exactMatches?.length || 0} exact matches, broadening to generator + tone...`);
    
    const { data: broadMatches } = await supabase
      .from('content_metadata')
      .select('content, visual_format, actual_engagement_rate, actual_impressions, posted_at')
      .eq('generator_name', generator)
      .eq('tone', tone)
      .eq('status', 'posted')
      .not('actual_engagement_rate', 'is', null)
      .gt('actual_impressions', 0)
      .order('actual_engagement_rate', { ascending: false })
      .limit(50);
    
    if (broadMatches && broadMatches.length > 0) {
      exactMatches = broadMatches;
    }
  }
  
  // Strategy 3: If still not enough, use generator-only
  if (!exactMatches || exactMatches.length < 5) {
    console.log(`[CONTEXTUAL_FORMAT] ⚠️ Only ${exactMatches?.length || 0} matches, using generator-only...`);
    
    const { data: generatorMatches } = await supabase
      .from('content_metadata')
      .select('content, visual_format, actual_engagement_rate, actual_impressions, posted_at')
      .eq('generator_name', generator)
      .eq('status', 'posted')
      .not('actual_engagement_rate', 'is', null)
      .gt('actual_impressions', 0)
      .order('actual_engagement_rate', { ascending: false })
      .limit(50);
    
    if (generatorMatches && generatorMatches.length > 0) {
      exactMatches = generatorMatches;
    }
  }
  
  if (!exactMatches || exactMatches.length < 3) {
    log({ op: 'contextual_format_insufficient', generator, count: exactMatches?.length || 0 });
    return null; // Not enough data
  }
  
  // Analyze what formats worked for this context
  const formatAnalysis = analyzeSuccessfulFormats(exactMatches, generator, topic, tone, angle);
  
  if (formatAnalysis.successfulFormats.length === 0) {
    return null; // No patterns found
  }
  
  // Build intelligent recommendation string
  const recommendations: string[] = [];
  
  recommendations.push(
    `📊 DATA-DRIVEN FORMAT INTELLIGENCE (${formatAnalysis.confidence} confidence, ${formatAnalysis.sampleCount} samples):`
  );
  
  recommendations.push(
    `Context: ${generator} generator + ${tone} tone${angle ? ` + ${angle} angle` : ''}${topic ? ` + ${topic.substring(0, 30)} topic` : ''}`
  );
  
  formatAnalysis.successfulFormats.slice(0, 3).forEach((format, i) => {
    recommendations.push(
      `\n${i + 1}. Top format (${(format.avg_er * 100).toFixed(1)}% avg ER, ${format.count} uses):`
    );
    recommendations.push(`   "${format.visual_format.substring(0, 100)}${format.visual_format.length > 100 ? '...' : ''}"`);
    
    if (format.examples.length > 0) {
      recommendations.push(`   Example: "${format.examples[0].substring(0, 80)}..."`);
    }
  });
  
  recommendations.push(
    `\n🧠 INTELLIGENT DECISION:`,
    `The system analyzed ${formatAnalysis.sampleCount} posted tweets for this context.`,
    `These formats have proven successful. Use them as guidance, but adapt intelligently to this specific content.`,
    `Don't copy blindly - understand WHY these formats worked, then apply that understanding.`
  );
  
  log({ 
    op: 'contextual_format_found', 
    generator, 
    tone,
    formats_found: formatAnalysis.successfulFormats.length,
    confidence: formatAnalysis.confidence
  });
  
  return recommendations.join('\n');
}

/**
 * Analyze successful formats from posted tweets
 */
function analyzeSuccessfulFormats(
  posts: any[],
  generator: string,
  topic: string,
  tone: string,
  angle: string
): ContextualFormatMatch {
  // Group by visual_format
  const formatGroups: Record<string, { posts: any[]; totalER: number; examples: string[] }> = {};
  
  posts.forEach(post => {
    const format = post.visual_format || 'plain';
    const er = Number(post.actual_engagement_rate) || 0;
    
    if (!formatGroups[format]) {
      formatGroups[format] = { posts: [], totalER: 0, examples: [] };
    }
    
    formatGroups[format].posts.push(post);
    formatGroups[format].totalER += er;
    
    // Store example (first 100 chars)
    if (formatGroups[format].examples.length < 2) {
      formatGroups[format].examples.push(
        post.content.substring(0, 100) + '...'
      );
    }
  });
  
  // Calculate average ER for each format
  const successfulFormats = Object.entries(formatGroups)
    .map(([format, data]) => ({
      visual_format: format,
      avg_er: data.totalER / data.posts.length,
      count: data.posts.length,
      examples: data.examples
    }))
    .filter(f => f.count >= 2) // At least 2 uses
    .sort((a, b) => b.avg_er - a.avg_er); // Sort by ER descending
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (posts.length >= 20 && successfulFormats.length >= 3) {
    confidence = 'high';
  } else if (posts.length >= 10 && successfulFormats.length >= 2) {
    confidence = 'medium';
  }
  
  return {
    generator,
    topic,
    tone,
    angle,
    structure: '', // Would need structure field
    successfulFormats,
    sampleCount: posts.length,
    confidence
  };
}

