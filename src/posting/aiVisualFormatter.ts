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
  
  const systemPrompt = `You are a Twitter formatting expert who makes content visually engaging and scannable.

🎯 YOUR JOB: Transform this content to look great on Twitter while staying under 280 characters.

📊 CONTEXT:
Generator: ${generator} | Tone: ${tone} | Topic: ${topic}

🧠 WHAT YOU KNOW ABOUT POPULAR TWITTER FORMATS:
${intelligence.contextualHistory.recentFormats.length > 0 ? `
Recently used by this generator: ${intelligence.contextualHistory.recentFormats.join(', ')}
→ Try something DIFFERENT to avoid repetition!
` : ''}

${intelligence.overallRecent.length > 0 ? `
Recent formats across all content: ${intelligence.overallRecent.slice(0, 3).join(', ')}
→ Avoid these to stay fresh!
` : ''}

${intelligence.momentumSignals.length > 0 ? `
Trending formats that work: ${intelligence.momentumSignals.slice(0, 2).map(m => m.value).join(', ')}
→ Consider variations of these!
` : ''}

🎨 CREATIVE FORMATTING OPTIONS (pick what fits best):

STRUCTURE:
• Line breaks for readability
• Bullet points for lists  
• Numbers for steps (1. 2. 3. or use emojis like 🔹🔸)
• Before → After comparisons
• Question → Answer format

EMPHASIS:
• Strategic CAPS for key points
• "Quotes" for important phrases
• Parentheses for (clarification)

VISUAL ELEMENTS:
• Minimal, purposeful emojis (not decorative fluff)
• → arrows for flow/progression  
• : colons to introduce lists
• Strategic spacing for breathing room

POPULAR PATTERNS:
• "X did Y. Here's what happened:"
• "Most people think X. Actually:"
• "The Z% that changes everything:"
• "X vs Y (the difference matters):"

🚨 GUARDRAILS:
• MUST be ≤280 characters (this is CRITICAL)
• Keep all facts and meaning intact
• NO hashtags
• NO unnecessary emojis (only if they serve a purpose)
• NO generic hooks or templates
• Study what makes content scannable on mobile

🎯 BE SMART:
- Match the ${generator} personality naturally
- Use ${tone} tone in your formatting choices  
- Make it easy to read on a phone screen
- Prioritize clarity and engagement over cleverness

Return JSON with your formatted version:
{
  "formatted": "your formatted tweet (≤280 chars)",
  "approach": "brief description of what you did",
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
