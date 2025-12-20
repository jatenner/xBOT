/**
 * 🎨 AI VISUAL FORMATTER - THE FINAL BRIDGE
 * 
 * This is the LAST step before posting - the "Twitter Polish Expert"
 * 
 * Role: Takes content + ALL context (generator, tone, angle, topic, strategy)
 *       and REWRITES it to look perfect on Twitter
 * 
 * Philosophy:
 * - Acts like a Twitter growth expert reviewing the content
 * - Transforms structure, spacing, emphasis to maximize engagement
 * - Uses ALL the intelligence gathered (generator personality, tone, angle)
 * - Learns from what formats it uses
 * - NO hardcoded rules - AI decides EVERYTHING
 * 
 * Think of it as: "The tweet is 90% done, now make it LOOK amazing on Twitter"
 */

import { getSupabaseClient } from '../db';
import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import type { VisualFormatIntelligence } from '../analytics/visualFormatAnalytics';
import { generateFallbackViralInsights } from './viralFallbackInsights';
import { getGeneratorVisualRecommendations } from '../intelligence/generatorVisualIntelligence';
import { getContextualFormatIntelligence } from '../intelligence/contextualFormatIntelligence';

const FORBIDDEN_OPENERS: RegExp[] = [
  /^did you know\b/i,
  /^who knew\b/i,
  /^turns out\b/i,
  /^here's the thing\b/i,
  /^the truth is\b/i
];

export interface VisualFormatContext {
  content: string;
  generator: string;
  topic: string;
  angle: string;
  tone: string;
  formatStrategy: string;
}

export interface VisualFormatResult {
  formatted: string;
  visualApproach: string; // What formatting approach the AI chose
  transformations: string[]; // What it changed
  confidence: number;
}

/**
 * 🎨 THE FINAL BRIDGE - Transform content into Twitter-perfect format
 */
export async function formatContentForTwitter(context: VisualFormatContext): Promise<VisualFormatResult> {
  console.log('[VISUAL_FORMATTER] 🎨 Final Twitter formatting pass...');
  console.log(`[VISUAL_FORMATTER] 📋 Context: ${context.generator} | ${context.tone} | ${context.angle} | ${context.topic}`);
  
  const { content, generator, topic, angle, tone, formatStrategy } = context;
  
  // ✅ VERIFY: All context is passed correctly
  if (!generator || !topic || !tone || !angle) {
    console.warn(`[VISUAL_FORMATTER] ⚠️ Missing context: generator=${generator}, topic=${topic}, tone=${tone}, angle=${angle}`);
  }
  
  // 🧠 BUILD COMPLETE VISUAL FORMAT INTELLIGENCE
  const { buildVisualFormatIntelligence } = await import('../analytics/visualFormatAnalytics');
  
  let intelligence;
  try {
    // Get comprehensive intelligence (contextual + growth + overall)
    intelligence = await buildVisualFormatIntelligence(generator, tone);
    console.log('[VISUAL_FORMATTER] ✅ Intelligence loaded:');
    console.log(`  • Context history: ${intelligence.contextualHistory.recentFormats.length} formats`);
    console.log(`  • Momentum signals: ${intelligence.momentumSignals.length} trending`);
    console.log(`  • Overall recent: ${intelligence.overallRecent.length} formats`);
  } catch (error: any) {
    console.warn('[VISUAL_FORMATTER] ⚠️ Intelligence unavailable, using basic variety');
    // Fallback to simple recent formats query
    const supabase = getSupabaseClient();
    const { data: recentFormats } = await supabase
      .from('content_metadata')
      .select('visual_format')
      .not('visual_format', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    intelligence = {
      contextualHistory: { recentFormats: [], totalUses: 0, variety: 0 },
      momentumSignals: [],
      contextualInsights: [],
      overallRecent: (recentFormats || []).map(f => String(f.visual_format))
    };
  }
  
  // 🆕 Get data-driven visual intelligence (generator + topic + tone + angle + structure)
  let generatorVisualIntelligence = '';
  try {
    // Query database: "What format worked for this generator + topic + tone combo?"
    const contextualFormatIntelligence = await getContextualFormatIntelligence(
      generator,
      topic,
      tone,
      angle,
      context.formatStrategy
    );
    
    if (contextualFormatIntelligence) {
      generatorVisualIntelligence = contextualFormatIntelligence;
      console.log(`[VISUAL_FORMATTER] ✅ Contextual format intelligence loaded (${generator} + ${topic} + ${tone})`);
    } else {
      // Fallback to generator-only if no contextual data
      generatorVisualIntelligence = await getGeneratorVisualRecommendations(generator);
      if (generatorVisualIntelligence) {
        console.log(`[VISUAL_FORMATTER] ✅ Generator-only VI loaded for ${generator}`);
      }
    }
  } catch (error: any) {
    console.warn(`[VISUAL_FORMATTER] ⚠️ Could not load format intelligence: ${error.message}`);
  }
  
  // Build context-aware prompt with performance insights
  const systemPrompt = await buildSmartFormattingPrompt(
    generator,
    tone,
    topic,
    angle, // ✅ Pass angle for context
    intelligence,
    content,
    generatorVisualIntelligence
  );

  const userPrompt = `Format this tweet for Twitter (visual formatting ONLY - do NOT rewrite):

"${content}"

Given: ${generator} personality, ${tone} tone, ${angle} angle

Your job: Make it look GREAT on Twitter feed while preserving the exact hook and message.

🚨 SPACING VARIETY IS CRITICAL:
- Check recent posts: Did they use compact spacing? → Use spacious (3+ breaks)
- Did they use spacious? → Use compact (0 breaks)
- NEVER repeat the same spacing pattern
- Rotate: tight → balanced → spacious → tight

ONLY adjust: line breaks (0, 1, 2, 3+ - VARY IT!), 0-1 emoji, CAPS for 1-2 words, spacing.
DO NOT change: the hook, opening, message, or substance.

Format it for Twitter with AGGRESSIVE spacing variety!`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini', // Fast and cheap
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4, // Lower temp = follows formatting rules strictly, less creative rewriting
      max_tokens: 350,
      response_format: { type: 'json_object' }
    }, { purpose: 'ai_visual_formatting' });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No response from AI formatter');
    }

    const parsed = JSON.parse(aiResponse);
    
    // 🔥 FIX: Handle array responses (AI sometimes returns arrays)
    if (Array.isArray(parsed.formatted)) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ AI returned array instead of string, taking first element`);
      parsed.formatted = parsed.formatted[0];
    }
    
    if (!parsed.formatted || typeof parsed.formatted !== 'string') {
      throw new Error('Invalid formatted content from AI');
    }
    
    let formatted = parsed.formatted.trim();
    
    // CRITICAL: Remove markdown formatting that Twitter doesn't support
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
    formatted = formatted.replace(/\*([^*]+)\*/g, '$1'); // Remove *italic*
    formatted = formatted.replace(/__([^_]+)__/g, '$1'); // Remove __underline__
    
    // CRITICAL: Remove hashtags (NEVER allowed!)
    formatted = formatted.replace(/#\w+/g, ''); // Remove all #hashtags
    formatted = formatted.replace(/\s+/g, ' ').trim(); // Clean up extra spaces
    
    // CRITICAL: Limit emojis to 0-2 max
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = formatted.match(emojiRegex) || [];
    if (emojis.length > 2) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ Too many emojis (${emojis.length}), limiting to 2...`);
      // Keep only first 2 emojis, remove the rest
      let emojiCount = 0;
      formatted = formatted.replace(emojiRegex, (match) => {
        emojiCount++;
        return emojiCount <= 2 ? match : '';
      });
      formatted = formatted.replace(/\s+/g, ' ').trim(); // Clean up spaces after emoji removal
    }
    
    const forbiddenOpener = detectForbiddenOpener(formatted);
    if (forbiddenOpener) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ Forbidden opener detected (${forbiddenOpener}), using original content`);
      return fallbackToOriginal(content, `forbidden opener ${forbiddenOpener}`);
    }

    // 🚫 VALIDATE: Check if ACTUAL visual patterns repeat recent posts (context-aware)
    const currentPatterns = detectVisualPatterns(formatted);
    
    // Check both contextual (this generator+tone) AND overall feed
    const contextualFormats = intelligence.contextualHistory.recentFormats || [];
    const overallFormats = intelligence.overallRecent || [];
    const combinedRecent = [...contextualFormats.slice(0, 5), ...overallFormats.slice(0, 5)];
    
    // Count how many recent posts used similar visual patterns
    const patternCounts: Record<string, number> = {};
    combinedRecent.forEach(approach => {
      const patterns = approach.split(',').map(p => p.trim().split('_')[0]);
      patterns.forEach(pattern => {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      });
    });
    
    // Check if current patterns are overused
    const overusedInCurrent = currentPatterns.filter(pattern => {
      const basePattern = pattern.split('_')[0];
      return patternCounts[basePattern] >= 3; // Used 3+ times recently
    });
    
    if (overusedInCurrent.length > 0) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ AI used overused visual patterns: ${overusedInCurrent.join(', ')}`);
      console.warn(`[VISUAL_FORMATTER] 📊 Context: ${contextualFormats.length} recent for ${context.generator}+${context.tone}`);
      console.warn(`[VISUAL_FORMATTER] 🔄 Using original content (formatter didn't vary styling)`);
      return fallbackToOriginal(content, `overused visual pattern: ${overusedInCurrent[0]}`);
    }

    // Validate length - CRITICAL: Must be under 280
    if (formatted.length > 280) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ AI formatted too long (${formatted.length} chars), trying to trim...`);
      
      // Try to intelligently trim while preserving structure
      let trimmed = formatted;
      
      // Remove extra spaces first
      trimmed = trimmed.replace(/\s+/g, ' ').trim();
      
      // If still too long, truncate at sentence boundaries
      if (trimmed.length > 280) {
        const sentences = trimmed.split(/[.!?]\s+/);
        let result = '';
        for (const sentence of sentences) {
          const testResult = result + (result ? '. ' : '') + sentence;
          if (testResult.length <= 275) { // Leave room for final punctuation
            result = testResult;
          } else {
            break;
          }
        }
        
        // Add final punctuation if needed
        if (result && !/[.!?]$/.test(result)) {
          result += '.';
        }
        
        if (result) {
          trimmed = result;
        } else {
          console.warn(`[VISUAL_FORMATTER] ❌ Unable to fit formatted content within 280 chars, reverting to original`);
          return fallbackToOriginal(content, 'formatting exceeded length limit');
        }
      }
      
      // Final check - if still too long, use original
      if (trimmed.length > 280) {
        console.warn(`[VISUAL_FORMATTER] ⚠️ Could not trim to 280 chars, using original`);
        return fallbackToOriginal(content, 'could not trim to fit');
      }
      
      console.log(`[VISUAL_FORMATTER] ✅ Trimmed from ${formatted.length} to ${trimmed.length} chars`);
      formatted = trimmed;
    }
    
    if (formatted.length < 50) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ AI formatted too short (${formatted.length} chars), using original`);
      return fallbackToOriginal(content, 'too short after formatting');
    }
    
    // Detect what changed
    const transformations = detectTransformations(content, formatted);
    
    console.log(`[VISUAL_FORMATTER] ✅ Applied: ${parsed.approach || 'formatting'}`);
    console.log(`[VISUAL_FORMATTER] 📊 Changes: ${transformations.join(', ')}`);
    console.log(`[VISUAL_FORMATTER] 💡 ${formatted.substring(0, 80)}...`);
    
    // Track for learning with ACTUAL formatted content
    await trackFormatUsage(parsed.approach || 'unknown', context, transformations, formatted);
    
    return {
      formatted,
      visualApproach: parsed.approach || 'unknown',
      transformations,
      confidence: parsed.confidence || 0.8
    };
    
  } catch (error: any) {
    console.error('[VISUAL_FORMATTER] ❌ Formatting failed:', error.message);
    return fallbackToOriginal(content, error.message);
  }
}

/**
 * Fallback when AI formatting fails
 */
function fallbackToOriginal(content: string, reason: string): VisualFormatResult {
  console.log(`[VISUAL_FORMATTER] 🔄 Using original content: ${reason}`);
  return {
    formatted: content,
    visualApproach: `plain (${reason})`,
    transformations: ['none'],
    confidence: 0
  };
}

/**
 * Detect what transformations were applied
 */
function detectTransformations(original: string, formatted: string): string[] {
  if (formatted === original) return ['none'];
  
  const changes: string[] = [];
  
  // Structural changes
  if (formatted.includes('•') && !original.includes('•')) changes.push('bullets');
  if (formatted.match(/^\d+\./) && !original.match(/^\d+\./)) changes.push('numbered_list');
  if (formatted.includes('\n') && !original.includes('\n')) changes.push('line_breaks');
  
  // Emphasis
  const origCaps = (original.match(/[A-Z]{3,}/g) || []).length;
  const formCaps = (formatted.match(/[A-Z]{3,}/g) || []).length;
  if (formCaps > origCaps) changes.push('CAPS_emphasis');
  
  // Content type changes
  if (formatted.includes('?') && !original.includes('?')) changes.push('question_reformulation');
  if (formatted.includes('Myth:') || formatted.includes('Truth:')) changes.push('myth_truth_split');
  
  // Visual elements
  const hasEmoji = (text: string) => /[\uD83C-\uDBFF\uDC00-\uDFFF]+/.test(text);
  if (hasEmoji(formatted) && !hasEmoji(original)) changes.push('emoji');
  
  // Word count change (rewrite detection)
  const origWords = original.split(/\s+/).length;
  const formWords = formatted.split(/\s+/).length;
  const wordDiff = Math.abs(formWords - origWords) / origWords;
  if (wordDiff > 0.15) changes.push('structural_rewrite');
  
  if (changes.length === 0) changes.push('minor_polish');
  
  return changes;
}

function detectForbiddenOpener(text: string): string | null {
  const normalized = text.trim();
  for (const pattern of FORBIDDEN_OPENERS) {
    if (pattern.test(normalized)) {
      return pattern.source.replace('^', '').replace('\\b', '').replace('\\', '');
    }
  }
  return null;
}

/**
 * Detect ACTUAL visual patterns in the formatted content
 */
function detectVisualPatterns(content: string): string[] {
  const patterns: string[] = [];
  
  // Check for bullets
  if (content.match(/[•\-]\s/)) patterns.push('bullets');
  
  // Check for numbered lists
  if (content.match(/\d\.\s/)) patterns.push('numbered_list');
  
  // Check for emojis
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (content.match(emojiRegex) || []).length;
  if (emojiCount > 0) patterns.push(`emojis_${emojiCount}`);
  
  // Check for line breaks
  const lineBreaks = (content.match(/\n/g) || []).length;
  if (lineBreaks > 0) patterns.push(`line_breaks_${lineBreaks}`);
  
  // Check for CAPS usage
  const capsWords = content.match(/\b[A-Z]{2,}\b/g) || [];
  if (capsWords.length > 0) patterns.push(`caps_${capsWords.length}`);
  
  // Check for questions
  if (content.includes('?')) patterns.push('question');
  
  // Check length pattern
  if (content.length < 100) patterns.push('short');
  else if (content.length < 200) patterns.push('medium');
  else patterns.push('long');
  
  // Check structure
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 1) patterns.push('single_line');
  else if (lines.length <= 3) patterns.push('multi_line');
  else patterns.push('multi_paragraph');
  
  return patterns;
}

/**
 * Track what format was used (for learning loops)
 */
async function trackFormatUsage(
  approach: string, 
  context: VisualFormatContext,
  transformations: string[],
  formattedContent: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Detect ACTUAL visual patterns in the formatted content
    const visualPatterns = detectVisualPatterns(formattedContent);
    const patternsString = visualPatterns.join(', ');
    
    // Track in visual_format_usage table with ACTUAL patterns
    await supabase.from('visual_format_usage').insert([{
      approach: patternsString, // Store ACTUAL patterns, not AI's explanation
      generator: context.generator,
      topic_snippet: context.topic.substring(0, 100),
      tone: context.tone,
      angle_snippet: context.angle.substring(0, 100),
      format_strategy: context.formatStrategy
    }]);
    
    console.log(`[VISUAL_FORMATTER] 📊 Tracked ACTUAL patterns: ${patternsString}`);
    console.log(`[VISUAL_FORMATTER] 🎨 For ${context.generator} + ${context.tone}`);
    
  } catch (error: any) {
    // Silently fail tracking - don't block posting
    console.warn('[VISUAL_FORMATTER] ⚠️ Tracking skipped:', error.message);
  }
}

/**
 * BUILD SMART PROMPT - Uses viral tweet data to guide AI decisions
 */
async function buildSmartFormattingPrompt(
  generator: string,
  tone: string,
  topic: string,
  angle: string,
  intelligence: VisualFormatIntelligence,
  content: string,
  generatorVisualIntelligence: string = ''
): Promise<string> {
  // 🆕 DATA-DRIVEN: No hardcoded guidance - let the data speak
  // The system will learn from posted tweets what works for each generator
  // We only provide basic personality context, not format rules
  
  const basicPersonality: Record<string, string> = {
    'historian': 'Historical perspective and context',
    'contrarian': 'Bold, controversial takes',
    'newsReporter': 'News and factual reporting',
    'storyteller': 'Narrative and storytelling',
    'coach': 'Actionable advice and guidance',
    'philosopher': 'Thought-provoking questions and ideas',
    'dataNerd': 'Data and statistics',
    'mythBuster': 'Debunking misconceptions',
    'provocateur': 'Provocative and challenging',
    'explorer': 'Curiosity and exploration',
    'thoughtLeader': 'Authoritative insights',
    'culturalBridge': 'Connecting perspectives',
    'interestingContent': 'Surprising facts',
    'teacher': 'Educational content',
    'investigator': 'Investigative discovery',
    'connector': 'Linking ideas',
    'pragmatist': 'Practical solutions',
    'translator': 'Simplifying complexity',
    'patternFinder': 'Identifying patterns',
    'experimenter': 'Experimental testing'
  };
  
  const personality = basicPersonality[generator] || 'Content creation';

  // Performance insights from intelligence  
  let performanceInsights = '';
  if (intelligence.contextualInsights && intelligence.contextualInsights.length > 0) {
    const topInsight = intelligence.contextualInsights[0];
    // Only show if it's different from recent patterns
    const recentApproaches = intelligence.overallRecent.slice(0, 5).join(' ').toLowerCase();
    const insightSnippet = topInsight.approach.toLowerCase().substring(0, 30);
    
    if (!recentApproaches.includes(insightSnippet)) {
      performanceInsights = `\nWhat's working for ${generator}:
• "${topInsight.approach.substring(0, 60)}..." format: ${Math.round(topInsight.avgViews).toLocaleString()} avg views (${topInsight.trend})
• Not used recently - good opportunity to revisit`;
    }
  }
  
  // 🚫 BLACKLIST RECENT VISUAL PATTERNS (Context-Aware + Strong Enforcement)
  let varietyNote = '';
  
  // Use CONTEXTUAL history (this generator+tone) for smart blacklisting
  const contextualFormats = intelligence.contextualHistory.recentFormats || [];
  const overallFormats = intelligence.overallRecent || [];
  
  // Combine: Prioritize contextual (last 5 for THIS combo) + overall (last 5 feed-wide)
  const combinedRecent = [...contextualFormats.slice(0, 5), ...overallFormats.slice(0, 5)];
  
  if (combinedRecent.length > 0) {
    // Extract ACTUAL visual patterns from recent posts
    const patternCounts: Record<string, number> = {};
    
    combinedRecent.forEach(approach => {
      // Parse actual patterns (e.g., "bullets, emojis_2, line_breaks_3")
      const patterns = approach.split(',').map(p => p.trim());
      patterns.forEach(pattern => {
        // Normalize patterns (e.g., "emojis_2" → "emojis", "line_breaks_3" → "line_breaks")
        const basePattern = pattern.split('_')[0];
        patternCounts[basePattern] = (patternCounts[basePattern] || 0) + 1;
      });
    });
    
    // Blacklist patterns used 3+ times in recent posts
    const overusedPatterns = Object.entries(patternCounts)
      .filter(([_, count]) => count >= 3)
      .map(([pattern, _]) => pattern);
    
    if (overusedPatterns.length > 0) {
      varietyNote = `\n
⚠️ VISUAL PATTERNS OVERUSED (avoid these):
${overusedPatterns.map(p => `❌ NO ${p.toUpperCase()} (used ${patternCounts[p]}x recently)`).join('\n')}

Try DIFFERENT visual styling:
${overusedPatterns.includes('bullets') || overusedPatterns.includes('numbered') ? '✅ No lists - use prose' : '✅ Try bullets or numbers'}
${overusedPatterns.includes('emojis') ? '✅ No emojis - clean text' : '✅ Add 1 relevant emoji'}
${overusedPatterns.includes('line') ? '✅ Single paragraph - compact' : '✅ Use line breaks for pacing'}
${overusedPatterns.includes('caps') ? '✅ No CAPS - natural emphasis' : '✅ Use CAPS for 1-2 key words'}
${overusedPatterns.includes('question') ? '✅ Statement format - no question' : '✅ End with engaging question'}`;
    } else {
      varietyNote = `\nRecent visual formats: Diverse. Keep varying!`;
    }
  }
  
  // NEW: Build intelligent viral insights (context-aware)
  // 🆕 INCREMENTAL LEARNING: Use whatever VI data we have, even if incomplete
  let viralInsights = '';
  try {
    const supabase = getSupabaseClient();
    
    // Strategy 1: Try fully processed viral_tweet_library (best quality)
    let { data: patternStats } = await supabase
      .from('viral_tweet_library')
      .select('hook_type, formatting_patterns, why_it_works, engagement_rate, pattern_strength')
      .gte('pattern_strength', 7)
      .not('why_it_works', 'is', null)
      .eq('is_active', true)
      .limit(50);
    
    // Strategy 2: If no processed data, use raw collected tweets (incremental learning)
    if (!patternStats || patternStats.length === 0) {
      console.log('[VISUAL_FORMATTER] ℹ️ No processed viral patterns, checking raw collected tweets...');
      
      // Get high-engagement tweets from vi_collected_tweets (even if not fully classified)
      const { data: rawTweets } = await supabase
        .from('vi_collected_tweets')
        .select('content, views, likes, engagement_rate')
        .gt('engagement_rate', 0.05) // Only high-performing tweets
        .order('engagement_rate', { ascending: false })
        .limit(20); // Use top 20 for now
      
      if (rawTweets && rawTweets.length > 0) {
        console.log(`[VISUAL_FORMATTER] 📊 Using ${rawTweets.length} high-performing tweets from VI collection (incremental learning)`);
        // Convert raw tweets to pattern format for analysis
        patternStats = rawTweets.map(t => ({
          hook_type: 'unknown',
          formatting_patterns: extractFormattingPatterns(t.content),
          why_it_works: `High engagement rate: ${(t.engagement_rate * 100).toFixed(1)}%`,
          engagement_rate: t.engagement_rate,
          pattern_strength: Math.min(10, t.engagement_rate * 100) // Estimate strength from ER
        }));
      }
    }
    
    if (patternStats && patternStats.length > 0) {
      // SMART APPROACH: Extract principles from patterns  
      console.log(`[VISUAL_FORMATTER] 🧠 Analyzing ${patternStats.length} patterns (${patternStats.length >= 10 ? 'good dataset' : 'small but growing dataset'})...`);
      viralInsights = await buildIntelligentViralInsights(
        patternStats,
        generator,
        tone,
        content
      );
      console.log('[VISUAL_FORMATTER] ✅ VI analysis complete');
    } else {
      // No VI data at all - use fallback but note it's building
      console.log('[VISUAL_FORMATTER] ℹ️ No VI data yet - system will learn as database grows');
      viralInsights = await generateFallbackViralInsights(generator, tone);
    }
  } catch (error: any) {
    console.warn('[VISUAL_FORMATTER] ⚠️ Could not load viral patterns:', error.message);
  }
  
  // Helper function to extract formatting patterns from raw content
  function extractFormattingPatterns(content: string): string {
    const patterns: string[] = [];
    const lineBreaks = (content.match(/\n\n/g) || []).length;
    const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    
    if (lineBreaks > 0) patterns.push(`line_breaks_${lineBreaks}`);
    if (emojiCount > 0) patterns.push(`emojis_${emojiCount}`);
    if (content.match(/^\d+\./)) patterns.push('numbered_list');
    if (content.match(/^["'"]/)) patterns.push('quote_opener');
    if (content.match(/\?/)) patterns.push('question_hook');
    
    return patterns.join(', ') || 'plain';
  }
  
  return `You're a Twitter formatting expert who understands Twitter as a platform. Your job: make this tweet perform well by understanding HOW Twitter works.

🧠 UNDERSTANDING TWITTER AS A PLATFORM:
Twitter is a fast-scrolling, mobile-first feed where people consume content in seconds.
- Content competes with thousands of other tweets
- Algorithm favors: engagement velocity, scannability, visual structure
- Mobile users scroll fast - you have 2-3 seconds to stop them
- Readability = engagement. Scannable = shareable.
- Visual structure matters more than perfect grammar
- The feed is visual - spacing, breaks, emphasis create "stopping power"

GENERATOR: ${generator} (${personality})
${generatorVisualIntelligence}

CONTENT CONTEXT:
• Topic: ${topic}
• Tone: ${tone}
• Raw content: "${content.substring(0, 100)}..."
${performanceInsights}
${varietyNote}
${viralInsights}

🎓 DUAL INTELLIGENCE SYSTEM - COMBINING TWO SOURCES:

1. VI SYSTEM (What Works on Twitter - from 10k+ scraped tweets):
${viralInsights ? `✅ Loaded: Patterns from viral tweets across Twitter showing what Twitter's algorithm rewards.\n${viralInsights}` : '⚠️ Not loaded: VI system data unavailable. This shows what works on Twitter in general.'}

2. YOUR GENERATOR DATA (What Works for THIS Generator - from your posted tweets):
${generatorVisualIntelligence ? `✅ Loaded: Patterns from your posted tweets showing what works for THIS generator.\n${generatorVisualIntelligence}` : '⚠️ Not loaded: Generator-specific data unavailable. This shows what works for YOUR generators specifically.'}

🧠 INTELLIGENT COMBINATION APPROACH:
You have TWO sources of intelligence:
- VI System: "Here's what works on Twitter in general (from analyzing thousands of tweets)"
- Your Data: "Here's what works for THIS generator specifically (from your posted tweets)"

COMBINE THEM INTELLIGENTLY:
1. Start with Twitter fundamentals (fast-scrolling, visual, mobile-first)
2. Apply VI System patterns (what works on Twitter in general)
3. Apply generator-specific patterns (what works for THIS generator)
4. Adapt to this specific content (topic + tone + context)
5. Make intelligent decisions that combine all three

The goal: Use Twitter best practices (VI) + generator-specific patterns (your data) to format this content optimally.

NOTE: The generator already created the hook. These are for your understanding of Twitter best practices, NOT for you to add:

STRUCTURE (How information flows):
• Line breaks: Separate key ideas → Mobile-friendly (+25% read completion)
• Short sentences: Under 15 words → Scannable (+20% retention)
• Bullets: For 3+ items → More saves/bookmarks (+30%)
• White space: Let ideas breathe → Professional look

🚨 CRITICAL SPACING VARIETY MANDATE:
You MUST vary spacing patterns dramatically. Never use the same spacing twice in a row.

SPACING PATTERNS (rotate aggressively):
1. TIGHT/COMPACT (no line breaks): "Sentence one. Sentence two. Sentence three." → Dense, fast-paced
2. SINGLE BREAK (one strategic break): "Hook sentence.\n\nSupporting detail." → Balanced
3. MULTI-BREAK (2-3 breaks): "Hook.\n\nPoint one.\n\nPoint two." → Spacious, breathable
4. MINIMALIST (extreme spacing): "Short.\n\nPunchy.\n\nImpact." → Maximum white space
5. PARAGRAPH BLOCKS (grouped ideas): "First idea with multiple sentences.\n\nSecond idea block." → Structured
6. STACCATO (many short breaks): "One.\n\nTwo.\n\nThree." → Rhythmic, punchy

⚠️ NEVER REPEAT THE SAME SPACING PATTERN:
- If last post was "compact", use "multi-break" or "minimalist"
- If last post had 2 line breaks, use 0 or 4+ breaks
- Rotate between tight, balanced, and spacious
- Match spacing to content energy: urgent = tight, thoughtful = spacious

EMPHASIS (What to highlight):
• CAPS: 1-2 KEY TERMS max → Draws eye without shouting
• Avoid: **asterisks**, _underscores_ → Twitter doesn't support markdown
• Emojis: 0-1 for science/data → Credibility. 1-2 for stories → Personality

LENGTH & PACING:
• Optimal: 180-240 chars → Full visibility in feed
• Max: 280 chars → Use every character wisely
• Pacing: Slow down with line breaks, speed up with compact text
• VARIETY: Alternate between fast (compact) and slow (spacious) pacing

YOUR DECISION FRAMEWORK:
1. Does this content NEED formatting or is plain better?
   → Short punchy insights: Usually better plain
   → Multi-point explanations: Formatting helps

2. What's the core message?
   → Format should clarify, not decorate

3. What would stop a scroller?
   → Hook clarity matters more than visual tricks

4. What format works for THIS combination (${generator} + ${tone} + ${angle || 'informative'})?
   → Use the data-driven intelligence above (from ${generatorVisualIntelligence ? 'your posted tweets' : 'VI system'})
   → Analyze what formats succeeded for similar contexts
   → Apply intelligently - understand WHY they worked, don't copy blindly
   → Consider: Does this content need formatting, or is plain better?
   → Match format to content energy: urgent = compact, thoughtful = spacious

⚠️ CRITICAL: YOUR JOB IS FORMATTING ONLY
You are NOT rewriting content. The generator already created the hook, message, and flow.

❌ DO NOT:
• Change the opening hook or first sentence
• Rewrite or rephrase the core message
• Add new hooks like "Did you know", "Here's the thing", etc.
• Change the substance or facts
• Alter the tone or personality

✅ DO (Twitter Formatting Only):
• VARY SPACING AGGRESSIVELY - never use same pattern twice
• Add line breaks strategically (0, 1, 2, 3+ - rotate!)
• Add 0-1 relevant emoji (if it fits the tone)
• Use CAPS for 1-2 KEY WORDS for emphasis
• Adjust spacing/pacing for Twitter feed (tight ↔ spacious)
• Remove markdown Twitter doesn't support
• Match spacing to content energy (urgent = compact, thoughtful = spacious)

CRITICAL RULES:
• ≤280 characters (count carefully!)
• No hashtags ever
• NO markdown (**bold**, *italic*, __underline__) - Twitter doesn't support it!
• NO asterisks for emphasis - use CAPS sparingly instead
• If formatting doesn't improve it, don't format
• Preserve the hook and message EXACTLY
• Mobile-first thinking

Return JSON:
{
  "formatted": "your optimized tweet",
  "approach": "what you did and why",
  "confidence": 0.85
}`;
}

/**
 * BUILD INTELLIGENT VIRAL INSIGHTS
 * 
 * Instead of just showing random examples, this:
 * 1. Analyzes ALL patterns to extract principles
 * 2. Matches patterns to current context (generator/tone)
 * 3. Teaches WHY patterns work
 * 4. Provides actionable guidance
 */
async function buildIntelligentViralInsights(
  patterns: any[],
  generator: string,
  tone: string,
  content: string
): Promise<string> {
  
  console.log(`[VISUAL_FORMATTER] 🧠 Analyzing ${patterns.length} viral patterns...`);
  
  // STEP 1: Extract pattern statistics
  const hookStats = analyzeHookTypes(patterns);
  const structureStats = analyzeStructures(patterns);
  const topPrinciples = extractPrinciples(patterns);
  
  // STEP 2: Find context-relevant patterns
  const relevantPatterns = findRelevantPatterns(patterns, generator, tone, content);
  
  // STEP 3: Build intelligent guidance
  let insights = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  insights += '📊 VIRAL PATTERN INTELLIGENCE\n';
  insights += `(Analyzed from ${patterns.length} high-performing tweets)\n`;
  insights += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  // Most effective hooks
  insights += '🎯 HOOKS THAT WORK (by success rate):\n';
  hookStats.slice(0, 3).forEach(stat => {
    insights += `• ${stat.type}: ${(stat.avgEngagement * 100).toFixed(1)}% avg engagement (${stat.count} examples)\n`;
    insights += `  Why: ${stat.topReason}\n\n`;
  });
  
  // Most effective structures
  insights += '📐 STRUCTURES THAT WORK:\n';
  structureStats.slice(0, 3).forEach(stat => {
    insights += `• ${stat.pattern}: ${(stat.avgEngagement * 100).toFixed(1)}% avg engagement\n`;
    insights += `  When: ${stat.useCase}\n\n`;
  });
  
  // Top principles (extracted wisdom)
  insights += '💡 KEY PRINCIPLES (extracted from data):\n';
  topPrinciples.forEach((principle, i) => {
    insights += `${i + 1}. ${principle}\n`;
  });
  
  // Context-specific recommendation
  if (relevantPatterns.length > 0) {
    insights += `\n🎯 FOR YOUR ${generator.toUpperCase()} + ${tone.toUpperCase()} CONTENT:\n`;
    relevantPatterns.forEach(pattern => {
      insights += `• Try "${pattern.suggestion}" → ${(pattern.successRate * 100).toFixed(0)}% success rate\n`;
    });
  }
  
  insights += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  
  return insights;
}

/**
 * Analyze hook type performance
 */
function analyzeHookTypes(patterns: any[]): any[] {
  const hookGroups: Record<string, any[]> = {};
  
  patterns.forEach(p => {
    const hook = p.hook_type || 'statement';
    if (!hookGroups[hook]) hookGroups[hook] = [];
    hookGroups[hook].push(p);
  });
  
  return Object.entries(hookGroups)
    .map(([type, group]) => ({
      type,
      count: group.length,
      avgEngagement: group.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / group.length,
      topReason: getMostCommonReason(group)
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

/**
 * Analyze structure performance
 */
function analyzeStructures(patterns: any[]): any[] {
  const structureGroups: Record<string, any[]> = {};
  
  patterns.forEach(p => {
    const structures = Array.isArray(p.formatting_patterns) ? p.formatting_patterns : [];
    structures.forEach(s => {
      if (!structureGroups[s]) structureGroups[s] = [];
      structureGroups[s].push(p);
    });
  });
  
  return Object.entries(structureGroups)
    .map(([pattern, group]) => ({
      pattern,
      count: group.length,
      avgEngagement: group.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / group.length,
      useCase: inferUseCase(pattern)
    }))
    .filter(s => s.count >= 3) // Only patterns with 3+ examples
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}

/**
 * Extract top principles from why_it_works explanations
 */
function extractPrinciples(patterns: any[]): string[] {
  const allReasons = patterns
    .map(p => p.why_it_works || '')
    .filter(r => r.length > 20);
  
  // Simple principle extraction (could use NLP here)
  const principles: string[] = [];
  
  if (allReasons.some(r => r.toLowerCase().includes('curiosity'))) {
    principles.push('Curiosity gaps stop scrollers → Make readers want to know more');
  }
  if (allReasons.some(r => r.toLowerCase().includes('clean') || r.toLowerCase().includes('simple'))) {
    principles.push('Clean formatting = professional credibility → Less is more');
  }
  if (allReasons.some(r => r.toLowerCase().includes('line break') || r.toLowerCase().includes('spacing'))) {
    principles.push('White space improves readability → Let ideas breathe');
  }
  if (allReasons.some(r => r.toLowerCase().includes('data') || r.toLowerCase().includes('stat'))) {
    principles.push('Numbers grab attention → Lead with concrete data when possible');
  }
  if (allReasons.some(r => r.toLowerCase().includes('question'))) {
    principles.push('Questions engage readers → They mentally answer before scrolling');
  }
  
  return principles.slice(0, 5);
}

/**
 * Find patterns relevant to current context
 */
function findRelevantPatterns(
  patterns: any[],
  generator: string,
  tone: string,
  content: string
): any[] {
  const relevant: any[] = [];
  
  // Match by generator personality
  if (generator === 'provocateur' || generator === 'contrarian') {
    const controversial = patterns.filter(p => 
      p.hook_type === 'controversy' || p.hook_type === 'bold_statement'
    );
    if (controversial.length > 0) {
      const best = controversial.sort((a, b) => 
        (b.engagement_rate || 0) - (a.engagement_rate || 0)
      )[0];
      relevant.push({
        suggestion: `${best.hook_type} hook + direct statement`,
        successRate: best.engagement_rate || 0
      });
    }
  }
  
  if (generator === 'dataNerd' || tone.includes('scientific')) {
    const dataLed = patterns.filter(p => p.hook_type === 'data');
    if (dataLed.length > 0) {
      const avg = dataLed.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / dataLed.length;
      relevant.push({
        suggestion: 'data_lead hook + clean structure',
        successRate: avg
      });
    }
  }
  
  if (generator === 'storyteller') {
    const stories = patterns.filter(p => p.hook_type === 'story');
    if (stories.length > 0) {
      const avg = stories.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / stories.length;
      relevant.push({
        suggestion: 'story hook + narrative flow (no bullets)',
        successRate: avg
      });
    }
  }
  
  // Match by content type
  if (content.includes('?')) {
    const questions = patterns.filter(p => p.hook_type === 'question');
    if (questions.length > 0 && !relevant.some(r => r.suggestion.includes('question'))) {
      const avg = questions.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / questions.length;
      relevant.push({
        suggestion: 'question hook (already in content)',
        successRate: avg
      });
    }
  }
  
  return relevant.slice(0, 3);
}

/**
 * Get most common reason from why_it_works
 */
function getMostCommonReason(patterns: any[]): string {
  const reasons = patterns.map(p => p.why_it_works || '').filter(r => r.length > 20);
  
  if (reasons.length === 0) return 'Creates engagement';
  
  // Return first substantial reason (could be smarter)
  return reasons[0].split('.')[0] + '.' || 'Creates engagement';
}

/**
 * Infer use case for structure pattern
 */
function inferUseCase(pattern: string): string {
  const useCases: Record<string, string> = {
    'line_breaks': 'Separate key ideas, mobile readability',
    'bullets': 'Lists, multiple points, scannable info',
    'emoji_free': 'Professional/scientific content, credibility',
    'caps_emphasis': 'Highlight 1-2 key terms, draw attention',
    'clean': 'Simple content, let message speak',
    'question': 'Engage reader, create curiosity',
    'data_lead': 'Authority building, attention grabbing',
    'bold_statement': 'Controversial takes, stop scrollers',
    'teaser': 'Thread starters, multi-part content'
  };
  
  return useCases[pattern] || 'Enhance engagement';
}
