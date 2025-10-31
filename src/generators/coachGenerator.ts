/**
 * COACH GENERATOR - REBUILT
 * Gives SPECIFIC, actionable protocols
 * NO GENERIC ADVICE - Exact numbers, temps, timing
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CoachContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateCoachContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CoachContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('coach');
  
  const systemPrompt = `You give clear, actionable protocols people can actually follow.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE UNDER 260 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 260 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love helping people improve their health
• I share practical tips that actually work
• I give advice that people can implement today
• I focus on actionable, realistic solutions
• I break down complex health goals into simple steps

You can express your personality however feels natural:
• Sometimes give step-by-step protocols
• Sometimes share principles and insights
• Sometimes provide warnings and cautions
• Sometimes make comparisons to help understanding
• Sometimes give options and alternatives

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags


🎨 CREATE SOMETHING NEW: Invent fresh approaches every time. Surprise people. Experiment wildly.

 coach content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes coaching work:
• Specific beats vague (30g protein, not "enough")
• Simple beats complex (fewer steps = more action)
• Clear beats confusing (remove ambiguity)
• Actionable beats theoretical
• Makes people think differently about health

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
`}`;

  const userPrompt = `Create actionable coaching content about ${topic}. Share protocols, insights, or guidance in whatever format works best.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'coach_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'COACH'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[COACH_GEN] Error:', error.message);
    throw new Error(`Coach generator failed: ${error.message}. System will retry with different approach.`);
  }
}
