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
import { getExampleTweetsForGenerator, getAccountsForGenerator } from './viGeneratorAccountMapper';
import type { GeneratorType } from './generatorMatcher';

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
    generator?: GeneratorType; // ✅ NEW: Generator-specific examples
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
    
    // ✅ NEW: Get generator-specific accounts if generator provided
    let relevantAccounts: string[] | null = null;
    if (params.generator) {
      relevantAccounts = await getAccountsForGenerator(params.generator);
      log({ 
        op: 'vi_generator_accounts', 
        generator: params.generator, 
        account_count: relevantAccounts.length 
      });
    }
    
    // Enrich with actual tweet examples (including generator-specific if provided)
    const enriched = await this.enrichWithExamples(intelligence, params.generator);
    
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
   * ✅ ENHANCED: Adds generator-specific examples if generator provided
   */
  private async enrichWithExamples(
    intelligence: VisualIntelligence,
    generator?: GeneratorType
  ): Promise<VisualIntelligence> {
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
    generator?: GeneratorType; // ✅ NEW: Generator-specific examples
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
  
  // ✅ REFACTORED: Teach Twitter as a language, not statistics
  // Build principles-based teaching prompt
  const optimalLineBreaks = rec.line_breaks?.optimal ?? rec.line_breaks?.median;
  const optimalEmojiCount = rec.emoji_count?.optimal ?? rec.emoji_count?.median;
  const optimalCharCount = rec.char_count?.optimal ?? rec.char_count?.median;
  const optimalHook = rec.optimal_hook ?? rec.hook_pattern;
  
  // Build principles explanation (WHY patterns work, not just WHAT)
  const principles: string[] = [];
  
  // ✅ LANGUAGE TEACHING: Explain principles, not statistics
  if (optimalLineBreaks !== undefined) {
    principles.push(`SPACING: Successful posts use ${optimalLineBreaks} line breaks strategically. This is how Twitter works: Spacing improves readability. Readable content is easier to scan in a fast-scrolling feed. Notice how successful posts separate distinct ideas with breaks, creating visual flow and making content scannable. This is the visual language of Twitter.`);
  }
  
  if (optimalEmojiCount !== undefined) {
    principles.push(`EMOJIS: Successful posts use ${optimalEmojiCount} emoji strategically. This is how Twitter works: Emojis create visual breaks that stop scrollers mid-feed. They're not decoration - they're functional elements that guide the eye. Notice how successful posts use emojis to create visual pauses, separate sections, or emphasize key points. This is the visual language of Twitter.`);
  }
  
  if (optimalCharCount !== undefined) {
    principles.push(`LENGTH: Successful posts are around ${optimalCharCount} characters. This is how Twitter works: This length balances completeness with scannability. Twitter is a fast-scrolling platform - content that's too long gets skipped, content that's too short lacks value. This length is the sweet spot for Twitter's visual language.`);
  }
  
  if (optimalHook) {
    const hookExplanation = optimalHook === 'question' 
      ? 'Question hooks create curiosity gaps. People see a question and want to complete the thought - this is human psychology. The question interrupts scrolling and demands an answer.'
      : optimalHook === 'stat' 
      ? 'Stat hooks provide surprising data. Numbers and statistics create "need to know" urgency. They interrupt scrolling because people want to understand the data.'
      : 'Strong hooks interrupt scrolling patterns. They demand attention by challenging assumptions, providing surprises, or creating urgency. This is how Twitter works - you need to stop the scroll.';
    principles.push(`HOOKS: Successful posts use ${optimalHook} hooks. This is how Twitter works: ${hookExplanation} Notice how successful posts structure their hooks to interrupt the scroll and create engagement. This is the visual language of Twitter.`);
  }
  
  if (rec.cite_source_pct && rec.cite_source_pct > 0.3) {
    principles.push(`SOURCES: Successful posts cite sources. This is how Twitter works: Citations build credibility. Trust is essential on Twitter - people need to believe what you're saying. Notice how successful posts reference studies, experts, or data to support claims. This builds trust, which is fundamental to Twitter's culture.`);
  }
  
  const prompt = `You are learning the language of Twitter by studying ${intelligence.based_on_count} successful posts from ${intelligence.primary_tier} accounts.

RAW CONTENT (preserve core message and facts):
"${rawContent}"

🎓 WHAT TWITTER IS - Understanding the Platform:
Twitter is a visual, fast-scrolling platform where readability and visual structure matter. The algorithm favors content that's scannable, engaging, and complete. Successful posts understand this visual language.

📚 WHAT GOOD POSTS LOOK LIKE - Visual Language Patterns:

${principles.length > 0 ? principles.map(p => `- ${p}`).join('\n\n') : '- Study successful posts to understand the visual language of Twitter'}

${intelligence.examples && intelligence.examples.length > 0 ? `
🎯 SUCCESSFUL EXAMPLES - Learn from Real Posts:
Study these ${intelligence.primary_tier} tier posts. Notice the visual structure, spacing, and style:

${intelligence.examples.map((ex, i) => `
Example ${i + 1}:
${ex.content}

Notice: ${ex.context || 'How spacing, emojis, and structure create flow'}
`).join('\n---\n')}

DO NOT copy these examples. Instead, understand the patterns:
- How they use spacing to separate ideas
- How they use emojis for visual breaks
- How they structure hooks for engagement
- How they maintain readability
` : ''}

🎨 HOW TO APPLY THIS LANGUAGE:
When formatting the raw content, apply these principles:

1. SPACING: Use ${optimalLineBreaks || 2} line breaks strategically - separate distinct ideas, create visual flow, improve readability
2. EMOJIS: Use ${optimalEmojiCount ?? 1} emoji strategically - create visual breaks, not decoration
3. LENGTH: Aim for around ${optimalCharCount || 200} characters - balance completeness with scannability
4. HOOK: Structure the hook as ${optimalHook || 'question'} - create curiosity, interrupt scrolling, demand attention
5. STYLE: Match the style of successful posts - ${intelligence.primary_tier} accounts use this visual language

CRITICAL:
- DO NOT change the core message, facts, or credibility
- DO NOT copy examples - understand and apply the patterns
- DO NOT add excessive formatting - keep it professional
- DO preserve the visual language of successful Twitter posts

Format the raw content using this Twitter visual language:`;

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

