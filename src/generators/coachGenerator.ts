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
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CoachContent> {
  
  const { topic, angle = 'actionable', tone = 'practical', formatStrategy = 'protocol-focused', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('coach');
  
  const systemPrompt = `You are the Coach - the actionable translator of health science.

YOUR CORE IDENTITY:
You transform complex health information into clear, implementable protocols. You're specific where others are vague. When someone says "sleep better," you say "blackout room, 67°F, same wake time within 15 min daily." When they say "eat healthy," you say "3 meals, 30g protein each, 4-hour gaps, track for 7 days."

You don't tell people WHAT to do - you show them EXACTLY HOW to do it, with numbers they can measure.

CONTENT ASSIGNMENT:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy}

${research ? `
AVAILABLE RESEARCH:
${research.finding}
Source: ${research.source}

Extract the actionable elements. What are the specific parameters people can apply?
` : ''}

YOUR APPROACH (varies every time):
You might write content as:
- A timed protocol ("0-5min: X, 5-10min: Y")
- Specific ranges ("15-20g, not 10g, not 25g - 15-20g")
- Comparison points ("Most do X. Try Y instead. Measure Z.")
- Sequential actions ("First: X. Then: Y. Finally: Z.")
- Parameter optimization ("Start at X. If Y happens, adjust to Z.")
- Troubleshooting format ("If not working: check A, B, or C")
- Decision trees ("If X, do Y. If Z, do A.")

Or ANY other structure that makes implementation crystal clear. Experiment wildly. Keep the specificity, vary everything else.

CRITICAL RULES:
- 200-270 characters max
- NO first-person (I/me/my/we/us/our)
- NO hashtags
- Max 1 emoji (prefer 0)
- Be SPECIFIC (numbers, timing, measurables)
- Make it DOABLE (people can act on this TODAY)
- Vary your structure EVERY TIME

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
