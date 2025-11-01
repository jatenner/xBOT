/**
 * 🎨 AI-POWERED VISUAL FORMATTER
 * 
 * A specialized AI that transforms raw content into Twitter-optimized formats
 * 
 * Philosophy:
 * - NO hardcoded rules or patterns
 * - AI decides best visual presentation based on content + context
 * - Learns from what formats it uses (tracked in database)
 * - Understands tone, generator, angle to make contextual formatting decisions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getSupabaseClient } from '../db';

export interface FormatContext {
  content: string;
  generator: string;
  tone: string;
  angle: string;
  topic: string;
  formatStrategy?: string;
}

export interface FormattedResult {
  formatted: string;
  visualApproach: string; // What the AI chose to use (for tracking)
  transformations: string[]; // List of changes made
  reasoning: string;
}

/**
 * Transform content using AI Twitter formatting expert
 */
export async function formatForTwitter(context: FormatContext): Promise<FormattedResult> {
  console.log('[AI_FORMATTER] 🎨 Transforming content for Twitter...');
  console.log(`[AI_FORMATTER] 📋 Context: ${context.generator} | ${context.tone} | ${context.angle}`);
  
  const supabase = getSupabaseClient();
  
  // Get recent formatting choices to avoid repetition
  const { data: recentFormats } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('visual_format')
    .not('visual_format', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  const recentChoices = (recentFormats || [])
    .map(f => String(f.visual_format))
    .filter(f => f && f.length > 0);
  
  const systemPrompt = `You are a Twitter formatting expert. Transform raw text into visually engaging Twitter content.

⚠️ CRITICAL RULES:
• NEVER change the meaning or facts
• NEVER add or remove information  
• NEVER exceed 280 characters total
• ONLY transform HOW it looks visually

🎨 YOUR TOOLKIT - Twitter Visual Formats:

1. BULLETS (• or numbered lists)
2. LINE BREAKS (spacing between ideas for readability)
3. EMOJIS (1-2 max, contextually relevant)
4. CAPS (emphasize 1-2 KEY TERMS only)
5. QUESTIONS (reformulate as question if it fits)
6. SPLIT FORMAT (Myth: X → Truth: Y for contrasts)
7. PLAIN PARAGRAPH (sometimes simple is best!)

🧠 CONTEXT AWARENESS:

Generator Personality: ${context.generator}
Tone: ${context.tone}
Angle: ${context.angle}
Topic: ${context.topic}
${context.formatStrategy ? `Strategy: ${context.formatStrategy}` : ''}

Use this context to make smart formatting decisions:
• Data-heavy (data_nerd) → might use numbers, spacing, minimal emoji
• Provocative (provocateur) → might use questions, emphasis, dramatic spacing
• Story (storyteller) → might use paragraph flow with strategic breaks
• Myth-busting (mythBuster) → might use split format (Myth/Truth)
• Coach-style → might use bullets or numbered steps
• Cultural → might use quotes or cultural references with spacing

🚫 AVOID REPETITION:
Recent formats used:
${recentChoices.slice(0, 5).map((f, i) => `${i + 1}. ${f.substring(0, 60)}...`).join('\n')}

Pick something DIFFERENT from recent choices!

🎯 YOUR GOAL:
Make the content STOP people scrolling on Twitter.
Format it to maximize engagement.
Be creative. Experiment. Vary your approach each time.

Return JSON:
{
  "formatted": "the visually transformed content (max 280 chars)",
  "format_used": "concise description of what you used (e.g., 'Bullet points', 'Question with line breaks', 'Plain paragraph with emoji')",
  "reasoning": "one sentence why this format works for this content"
}`;

  const userPrompt = `Transform this content for maximum Twitter engagement:

"${context.content}"

Based on the ${context.generator} personality and ${context.tone} tone, how should this be visually formatted?`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini', // Fast and cheap for formatting
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8, // Creative but consistent
      max_tokens: 300,
      response_format: { type: 'json_object' }
    }, { purpose: 'visual_formatting' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate formatted content doesn't exceed 280 chars
    const formatted = String(parsed.formatted || context.content);
    
    if (formatted.length > 280) {
      console.warn(`[AI_FORMATTER] ⚠️ Formatted too long (${formatted.length} chars), using original`);
      return {
        formatted: context.content,
        visualApproach: 'plain (exceeded limit)',
        transformations: ['none'],
        reasoning: 'Formatting would exceed 280 chars'
      };
    }
    
    // Detect what actually changed
    const transformations = detectTransformations(context.content, formatted);
    
    console.log(`[AI_FORMATTER] ✅ Format used: ${parsed.format_used}`);
    console.log(`[AI_FORMATTER] 📊 Transformations: ${transformations.join(', ')}`);
    console.log(`[AI_FORMATTER] 💡 Reasoning: ${parsed.reasoning}`);
    
    return {
      formatted,
      visualApproach: String(parsed.format_used || 'unknown'),
      transformations,
      reasoning: String(parsed.reasoning || 'no reasoning provided')
    };
    
  } catch (error: any) {
    console.error('[AI_FORMATTER] ❌ Formatting failed:', error.message);
    
    // Fallback: return original content
    return {
      formatted: context.content,
      visualApproach: 'plain (error)',
      transformations: ['none'],
      reasoning: `Formatting failed: ${error.message}`
    };
  }
}

/**
 * Detect what transformations were applied by comparing original vs formatted
 */
function detectTransformations(original: string, formatted: string): string[] {
  const changes: string[] = [];
  
  if (original === formatted) {
    return ['none'];
  }
  
  // Check for bullets
  if (formatted.includes('•') && !original.includes('•')) {
    changes.push('bullets');
  }
  
  // Check for numbered lists
  if (/\d+\)/.test(formatted) && !/\d+\)/.test(original)) {
    changes.push('numbered_list');
  }
  
  // Check for line breaks
  if (formatted.includes('\n\n') && !original.includes('\n\n')) {
    changes.push('line_breaks');
  }
  
  // Check for emojis
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(formatted) && !emojiRegex.test(original)) {
    changes.push('emoji');
  }
  
  // Check for CAPS emphasis
  const originalCaps = (original.match(/[A-Z]{3,}/g) || []).length;
  const formattedCaps = (formatted.match(/[A-Z]{3,}/g) || []).length;
  if (formattedCaps > originalCaps) {
    changes.push('emphasis_caps');
  }
  
  // Check for questions
  if (formatted.includes('?') && !original.includes('?')) {
    changes.push('question_reformulation');
  }
  
  // Check for myth/truth
  if ((formatted.includes('Myth:') || formatted.includes('Truth:')) && 
      (!original.includes('Myth:') && !original.includes('Truth:'))) {
    changes.push('myth_truth_split');
  }
  
  // Check for structural changes
  const originalWords = original.split(/\s+/).length;
  const formattedWords = formatted.split(/\s+/).length;
  if (Math.abs(originalWords - formattedWords) > originalWords * 0.1) {
    changes.push('structural_rewrite');
  }
  
  if (changes.length === 0) {
    changes.push('minor_adjustments');
  }
  
  return changes;
}
