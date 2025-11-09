/**
 * 📡 VISUAL INTELLIGENCE: Intelligence Feed
 * 
 * Provides visual formatting recommendations to content generators
 * Query: "What visual format works for sleep + provocative?"
 * Returns: Tier-weighted patterns + examples
 * 
 * Used by planJob when generating content (feature flagged)
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

interface VisualIntelligence {
  recommended_format: any;
  tier_breakdown: any;
  example_tweet_ids: any;
  primary_tier: string;
  confidence_level: string;
  confidence_note: string;
  based_on_count: number;
  examples?: any[];
}

export class VIIntelligenceFeed {
  private supabase = getSupabaseClient();
  
  /**
   * Get visual intelligence for content parameters
   */
  async getIntelligence(params: {
    topic: string;
    angle?: string;
    tone?: string;
    structure?: string;
  }): Promise<VisualIntelligence | null> {
    log({ op: 'vi_intelligence_query', params });
    
    // Try exact match first
    let intelligence = await this.queryExact(params);
    
    // If low confidence or not found, broaden search
    if (!intelligence || intelligence.confidence_level === 'low') {
      intelligence = await this.queryBroad(params);
    }
    
    // If still not found, use topic only
    if (!intelligence) {
      intelligence = await this.queryTopicOnly(params.topic);
    }
    
    // If still nothing, return fallback
    if (!intelligence) {
      log({ op: 'vi_intelligence_fallback', params });
      return this.getFallback();
    }
    
    // Enrich with actual tweet examples
    const enriched = await this.enrichWithExamples(intelligence);
    
    log({ 
      op: 'vi_intelligence_found', 
      primary_tier: enriched.primary_tier,
      confidence: enriched.confidence_level,
      based_on: enriched.based_on_count
    });
    
    return enriched;
  }
  
  /**
   * Query for exact match (topic + angle + tone + structure)
   */
  private async queryExact(params: any): Promise<VisualIntelligence | null> {
    const queryKey = [params.topic, params.angle, params.tone, params.structure]
      .filter(v => v !== null && v !== undefined)
      .join('|');
    
    const { data } = await this.supabase
      .from('vi_format_intelligence')
      .select('*')
      .eq('query_key', queryKey)
      .single();
    
    return data as unknown as VisualIntelligence | null;
  }
  
  /**
   * Query with broader match (topic + angle + tone, drop structure)
   */
  private async queryBroad(params: any): Promise<VisualIntelligence | null> {
    const { data } = await this.supabase
      .from('vi_format_intelligence')
      .select('*')
      .eq('topic', params.topic)
      .order('based_on_count', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    return data as unknown as VisualIntelligence | null;
  }
  
  /**
   * Query with topic only
   */
  private async queryTopicOnly(topic: string): Promise<VisualIntelligence | null> {
    const { data } = await this.supabase
      .from('vi_format_intelligence')
      .select('*')
      .eq('topic', topic)
      .order('based_on_count', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    return data as unknown as VisualIntelligence | null;
  }
  
  /**
   * Enrich intelligence with actual tweet examples
   */
  private async enrichWithExamples(intelligence: VisualIntelligence): Promise<VisualIntelligence> {
    const examples: any[] = [];
    
    // Get viral unknown examples (highest priority)
    if (intelligence.example_tweet_ids?.viral_unknowns?.length > 0) {
      const { data } = await this.supabase
        .from('vi_viral_unknowns')
        .select('content, views, author_followers_at_viral')
        .in('tweet_id', intelligence.example_tweet_ids.viral_unknowns);
      
      if (data) {
        examples.push(...data.map(t => ({
          content: t.content,
          tier: 'viral_unknown',
          context: `${t.views?.toLocaleString()} views despite ${t.author_followers_at_viral?.toLocaleString()} followers`
        })));
      }
    }
    
    // Get micro examples
    if (intelligence.example_tweet_ids?.micro?.length > 0) {
      const { data } = await this.supabase
        .from('vi_collected_tweets')
        .select('content, views, author_followers')
        .in('tweet_id', intelligence.example_tweet_ids.micro);
      
      if (data) {
        examples.push(...data.map(t => ({
          content: t.content,
          tier: 'micro',
          context: `From ${t.author_followers?.toLocaleString()} follower account`
        })));
      }
    }
    
    return {
      ...intelligence,
      examples: examples.slice(0, 3) // Top 3 examples
    };
  }
  
  /**
   * Fallback intelligence (general Twitter best practices)
   */
  private getFallback(): VisualIntelligence {
    return {
      recommended_format: {
        char_count: { median: 180, range: [140, 240] },
        line_breaks: { median: 2, mode: 2 },
        emoji_count: { median: 1, range: [0, 2] },
        emoji_positions: ['end'],
        hook_pattern: 'question',
        cite_source_pct: 0.5,
        caps_usage: 'single_word',
        media_presence_pct: 0.45,
        top_media_types: ['image', 'card'],
        screenshot_pct: 0.1,
        callout_pct: 0.35
      },
      tier_breakdown: {},
      example_tweet_ids: {},
      primary_tier: 'unknown',
      confidence_level: 'fallback',
      confidence_note: 'Using general health Twitter patterns (insufficient specific data)',
      based_on_count: 0,
      examples: []
    };
  }
}

/**
 * Apply visual intelligence to generated content
 * Called by planJob when generating content
 */
export async function applyVisualFormatting(
  rawContent: string,
  params: {
    topic: string;
    angle?: string;
    tone?: string;
    structure?: string;
  }
): Promise<string> {
  const feed = new VIIntelligenceFeed();
  const intelligence = await feed.getIntelligence(params);
  
  if (!intelligence) {
    log({ op: 'vi_format_fallback' });
    return rawContent; // Fallback to unformatted
  }
  
  const rec = intelligence.recommended_format || {};
  const emojiPositions = Array.isArray(rec.emoji_positions) && rec.emoji_positions.length > 0
    ? rec.emoji_positions.join(', ')
    : 'none';
  const mediaLine = typeof rec.media_presence_pct === 'number'
    ? `- Media usage: ${Math.round((rec.media_presence_pct || 0) * 100)}% of high performers${Array.isArray(rec.top_media_types) && rec.top_media_types.length > 0 ? ` (common: ${rec.top_media_types.join(', ')})` : ''}`
    : null;
  const screenshotLine = typeof rec.screenshot_pct === 'number'
    ? `- Screenshot-style posts: ${Math.round((rec.screenshot_pct || 0) * 100)}%`
    : null;
  const calloutLine = typeof rec.callout_pct === 'number'
    ? `- Callouts/headers: ${Math.round((rec.callout_pct || 0) * 100)}% use bold callouts`
    : null;
  
  // Build AI prompt with tier-weighted intelligence
  const prompt = `You are a Twitter formatting expert for health/longevity content.

RAW CONTENT (preserve core message):
"${rawContent}"

VISUAL INTELLIGENCE:
${intelligence.confidence_note}

PROVEN PATTERNS (from ${intelligence.based_on_count} ${intelligence.primary_tier} tweets):
- Length: ${intelligence.recommended_format.char_count.median} chars (range: ${intelligence.recommended_format.char_count.range[0]}-${intelligence.recommended_format.char_count.range[1]})
- Line breaks: ${intelligence.recommended_format.line_breaks.median}
- Emojis: ${intelligence.recommended_format.emoji_count.median} (positions: ${intelligence.recommended_format.emoji_positions.join(', ')})
 - Emojis: ${intelligence.recommended_format.emoji_count.median} (positions: ${emojiPositions})
- Hook: ${intelligence.recommended_format.hook_pattern}
- Cite source: ${Math.round((intelligence.recommended_format.cite_source_pct || 0) * 100)}% cite research/sources
- Caps: ${intelligence.recommended_format.caps_usage}
${mediaLine ? `${mediaLine}\n` : ''}${screenshotLine ? `${screenshotLine}\n` : ''}${calloutLine ? `${calloutLine}\n` : ''}

${intelligence.examples && intelligence.examples.length > 0 ? `
SUCCESSFUL EXAMPLES (${intelligence.primary_tier} tier):
${intelligence.examples.map((ex, i) => `
Example ${i + 1} (${ex.context}):
${ex.content}
`).join('\n---\n')}
` : ''}

INSTRUCTIONS:
1. Reformat the raw content to match these proven visual patterns
2. DO NOT change the core message, facts, or credibility
3. DO NOT copy the examples - use them as style inspiration only
4. Focus on: line breaks, emoji placement, hook structure, credibility markers
5. Keep it professional (no childish emojis, no excessive formatting)
6. Output ONLY the formatted tweet, nothing else

Format now:`;

  try {
    const formatted = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Low for consistent formatting
      max_tokens: 400
    }, {
      purpose: 'vi_visual_formatting'
    });
    
    const result = formatted.choices[0]?.message?.content?.trim() || rawContent;
    
    log({ 
      op: 'vi_formatting_applied',
      intelligence_tier: intelligence.primary_tier,
      confidence: intelligence.confidence_level,
      char_before: rawContent.length,
      char_after: result.length
    });
    
    return result;
    
  } catch (error: any) {
    log({ op: 'vi_formatting_error', error: error.message });
    return rawContent; // Fallback on error
  }
}

