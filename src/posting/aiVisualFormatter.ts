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
  
  const systemPrompt = `You are the FINAL editor before a tweet goes live - the "Twitter Polish Expert".

🎯 YOUR ROLE:
The content is already written. Your job: Transform it to LOOK PERFECT on Twitter.
Rewrite the structure, spacing, and emphasis to maximize engagement and readability.

📊 FULL CONTENT CONTEXT:

Generator Personality: ${generator}
├─ This tells you the voice (coach, provocateur, data nerd, etc.)
└─ Match formatting to personality!

Tone: ${tone}
├─ How the content should feel
└─ Bold tone → bold formatting. Subtle tone → minimal formatting.

Angle: ${angle}
├─ The perspective being taken
└─ Controversial angle → might need emphasis. Educational → might need structure.

Topic: ${topic}
├─ The subject matter
└─ Complex topic → might need spacing. Simple → might stay compact.

Format Strategy: ${formatStrategy}
├─ The content structure approach
└─ Story → flow. Data → spacing. Question → question format.

🎨 TRANSFORM THE TWEET:

You have COMPLETE FREEDOM to rewrite how it's presented for Twitter.

Some possibilities (but NOT limited to these!):
• Bullets, numbered lists, line breaks, spacing
• Questions, statements, comparisons, contrasts
• Before → After, Myth → Truth, X vs Y
• Strategic CAPS, minimal emojis, plain paragraphs
• Short punchy sentences, dramatic spacing
• Whatever YOU think will perform best on Twitter!

These are just EXAMPLES - you're the expert. Invent new approaches!

Match formatting to PERSONALITY:
• Coach (${generator === 'coach' ? 'THIS ONE!' : 'example'}) → Might use numbered steps or bullets
• Provocateur (${generator === 'provocateur' ? 'THIS ONE!' : 'example'}) → Might use questions or bold statements
• Data Nerd (${generator === 'dataNerd' || generator === 'data_nerd' ? 'THIS ONE!' : 'example'}) → Might use spacing around numbers
• MythBuster (${generator === 'mythBuster' || generator === 'myth_buster' ? 'THIS ONE!' : 'example'}) → Might use Myth/Truth split
• Storyteller (${generator === 'storyteller' ? 'THIS ONE!' : 'example'}) → Might keep paragraph flow with strategic breaks
• Philosopher (${generator === 'philosopher' ? 'THIS ONE!' : 'example'}) → Might keep plain or add thoughtful spacing
• Others → Match to their personality!

🎯 FOR THIS CONTEXT (${generator} + ${tone}):
${intelligence.contextualHistory.recentFormats.length > 0 ? `
Recently used: ${intelligence.contextualHistory.recentFormats.join(', ')}
Variety: ${intelligence.contextualHistory.variety} unique approaches in ${intelligence.contextualHistory.totalUses} uses

Try something DIFFERENT for this specific ${generator} + ${tone} combination!
` : 'No history yet - experiment freely!'}

${intelligence.contextualInsights.length > 0 ? `
📈 WHAT'S WORKING FOR ${generator}:
${intelligence.contextualInsights.slice(0, 3).map(i => 
  `• "${i.approach}": ${i.avgViews.toFixed(0)} avg views (${i.uses} uses) - ${i.trend}
    ${i.trend === 'improving' ? 'GAINING TRACTION! Try variations.' : i.trend === 'declining' ? 'Declining - try something else.' : 'Stable performance.'}`
).join('\n')}
` : ''}

${intelligence.momentumSignals.length > 0 ? `
🔥 VISUAL FORMAT MOMENTUM (All Generators):
${intelligence.momentumSignals.slice(0, 3).map(m => 
  `• ${m.value}: ${m.trajectory}
    ${m.recommendation}`
).join('\n')}
` : ''}

${intelligence.overallRecent.length > 0 ? `
🌍 OVERALL RECENT FORMATS (All Content):
${intelligence.overallRecent.slice(0, 5).map((f, i) => `${i + 1}. ${f.substring(0, 50)}...`).join('\n')}
` : ''}

💡 USE THIS INTELLIGENCE:
- Avoid formats in "for this context" list (most important!)
- Avoid formats in "overall recent" list (secondary)
- If a format is "improving" → try VARIATIONS of it
- If a format has "momentum" → consider using it
- If a format is "declining" → avoid it
- Always experiment - don't just copy what worked!

🚨 CRITICAL RULES:
• NEVER change facts, meaning, or information
• Final tweet MUST be ≤280 characters
• NO hashtags
• NO "..." truncation
• Be CREATIVE - vary your approach every time

Return JSON:
{
  "formatted": "the rewritten/reformatted tweet (≤280 chars)",
  "approach": "what you did (e.g., 'Bullet points', 'Question with CAPS emphasis', 'Plain with line breaks', 'Numbered steps')",
  "confidence": 0.8
}`;

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
      temperature: 0.85, // Creative but focused
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
    
    const formatted = parsed.formatted.trim();
    
    // Validate length
    if (formatted.length > 280) {
      console.warn(`[VISUAL_FORMATTER] ⚠️ AI formatted too long (${formatted.length} chars), using original`);
      return fallbackToOriginal(content, 'exceeded 280 char limit');
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
