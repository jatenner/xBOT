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
  console.log(`[VISUAL_FORMATTER] 📋 Context: ${context.generator} | ${context.tone} | ${context.angle}`);
  
  const { content, generator, topic, angle, tone, formatStrategy } = context;
  
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
      .from('content_generation_metadata_comprehensive')
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
  
  // Build context-aware prompt with performance insights
  const systemPrompt = await buildSmartFormattingPrompt(
    generator,
    tone,
    topic,
    intelligence,
    content
  );

  const userPrompt = `Polish this tweet for maximum Twitter engagement:

"${content}"

Given the ${generator} personality, ${tone} tone, and ${angle} angle - how should this be formatted visually to perform BEST on Twitter?

Transform it!`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini', // Fast and cheap
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.75, // Creative but more focused on constraints
      max_tokens: 350,
      response_format: { type: 'json_object' }
    }, { purpose: 'ai_visual_formatting' });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No response from AI formatter');
    }

    const parsed = JSON.parse(aiResponse);
    
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
        
        trimmed = result || formatted.substring(0, 277) + '...';
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
    
    // Track for learning
    await trackFormatUsage(parsed.approach || 'unknown', context, transformations);
    
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

/**
 * Track what format was used (for learning loops)
 */
async function trackFormatUsage(
  approach: string, 
  context: VisualFormatContext,
  transformations: string[]
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Track in visual_format_usage table
    await supabase.from('visual_format_usage').insert([{
      approach,
      generator: context.generator,
      topic_snippet: context.topic.substring(0, 100),
      tone: context.tone,
      angle_snippet: context.angle.substring(0, 100),
      format_strategy: context.formatStrategy
    }]);
    
    console.log(`[VISUAL_FORMATTER] 📊 Tracked: "${approach}" for ${context.generator}`);
    
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
  intelligence: VisualFormatIntelligence,
  content: string
): Promise<string> {
  // Generator-specific guidance (personality-aware)
  const generatorGuidance: Record<string, string> = {
    'provocateur': 'Bold, direct statements. No fluff. Let controversy speak for itself. Skip formatting tricks.',
    'dataNerd': 'Clean data presentation. Use bullets for stats, but keep analytical not listy.',
    'mythBuster': 'Use 🚫/✅ format when debunking. Sharp contrast between myth and truth.',
    'storyteller': 'Pure narrative flow. NO bullets, NO numbers, NO lists. Story format only.',
    'coach': 'Conversational advice. Can use steps but make them feel helpful not clinical.',
    'philosopher': 'Thought-provoking questions. Minimal formatting. Let ideas breathe.',
    'contrarian': 'Controversial take first. No softening. Format should amplify the boldness.',
    'explorer': 'Curiosity-driven. Questions work great. Keep it open-ended and intriguing.',
    'thoughtLeader': 'Authoritative but accessible. Can use structure but must feel effortless.',
    'newsReporter': 'Factual and crisp. Lead with what happened. Data-first formatting.',
    'culturalBridge': 'Connecting perspectives. Compare/contrast format works well.',
    'interestingContent': 'Surprising facts. Hook first, then explain. Keep it punchy.'
  };
  
  const guidance = generatorGuidance[generator] || 'Clear, engaging formatting that serves the content.';
  
  // Performance insights from intelligence
  let performanceInsights = '';
  if (intelligence.contextualInsights && intelligence.contextualInsights.length > 0) {
    const topInsight = intelligence.contextualInsights[0];
    performanceInsights = `\nWhat's working for ${generator}:
• "${topInsight.approach}" format: ${Math.round(topInsight.avgViews).toLocaleString()} avg views (${topInsight.trend})
• Used ${topInsight.uses} times with consistent performance`;
  }
  
  // Recent variety check
  let varietyNote = '';
  if (intelligence.overallRecent.length > 0) {
    const recentFormats = intelligence.overallRecent.slice(0, 3);
    varietyNote = `\nRecent formats used: ${recentFormats.join(', ')}
→ Try something different to keep feed diverse.`;
  }
  
  // NEW: Build intelligent viral insights (context-aware)
  let viralInsights = '';
  try {
    const supabase = getSupabaseClient();
    
    // Get pattern statistics (understand the data)
    const { data: patternStats } = await supabase
      .from('viral_tweet_library')
      .select('hook_type, formatting_patterns, why_it_works, engagement_rate, pattern_strength')
      .gte('pattern_strength', 7)
      .not('why_it_works', 'is', null)
      .eq('is_active', true);
    
    if (patternStats && patternStats.length > 0) {
      // SMART APPROACH: Extract principles from patterns  
      console.log(`[VISUAL_FORMATTER] 🧠 Analyzing ${patternStats.length} viral patterns with AI...`);
      viralInsights = await buildIntelligentViralInsights(
        patternStats,
        generator,
        tone,
        content
      );
      console.log('[VISUAL_FORMATTER] ✅ AI viral analysis complete');
    } else {
      // No viral patterns in database yet - use fallback
      console.log('[VISUAL_FORMATTER] ℹ️ No viral patterns in database yet, using generic guidance');
      viralInsights = await generateFallbackViralInsights(generator, tone);
    }
  } catch (error: any) {
    console.warn('[VISUAL_FORMATTER] ⚠️ Could not load viral patterns:', error.message);
  }
  
  return `You're a Twitter formatting expert. Your job: make this tweet perform well.

GENERATOR PERSONALITY: ${generator}
→ ${guidance}

CONTENT CONTEXT:
• Topic: ${topic}
• Tone: ${tone}
• Raw content: "${content.substring(0, 100)}..."
${performanceInsights}
${varietyNote}
${viralInsights}

PROVEN TWITTER PRINCIPLES (evidence-based):
${viralInsights ? '(Extracted from your viral tweet database)' : '(Based on 100K+ analyzed tweets)'}

HOOKS (First 10 characters decide if people read):
• Questions: "What if..." → Creates curiosity gap (+40% engagement)
• Data leads: "43% of..." → Authority & intrigue (+35% engagement)
• Bold claims: "X changes everything" → Stops scrollers (+30% engagement)
• Controversy: "Everyone's wrong about..." → Sparks interest (+25% engagement)

STRUCTURE (How information flows):
• Line breaks: Separate key ideas → Mobile-friendly (+25% read completion)
• Short sentences: Under 15 words → Scannable (+20% retention)
• Bullets: For 3+ items → More saves/bookmarks (+30%)
• White space: Let ideas breathe → Professional look

EMPHASIS (What to highlight):
• CAPS: 1-2 KEY TERMS max → Draws eye without shouting
• Avoid: **asterisks**, _underscores_ → Twitter doesn't support markdown
• Emojis: 0-1 for science/data → Credibility. 1-2 for stories → Personality

LENGTH & PACING:
• Optimal: 180-240 chars → Full visibility in feed
• Max: 280 chars → Use every character wisely
• Pacing: Slow down with line breaks, speed up with compact text

YOUR DECISION FRAMEWORK:
1. Does this content NEED formatting or is plain better?
   → Short punchy insights: Usually better plain
   → Multi-point explanations: Formatting helps

2. What's the core message?
   → Format should clarify, not decorate

3. What would stop a scroller?
   → Hook clarity matters more than visual tricks

4. Does formatting match the ${generator} voice?
   → Provocateur shouldn't use cute bullets
   → Storyteller shouldn't use numbered lists

CRITICAL RULES:
• ≤280 characters (count carefully!)
• No hashtags ever
• NO markdown (**bold**, *italic*, __underline__) - Twitter doesn't support it!
• NO asterisks for emphasis - use CAPS sparingly instead
• If formatting doesn't improve it, don't format
• Preserve the substance and voice
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
