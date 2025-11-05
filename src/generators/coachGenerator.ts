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
  
  const systemPrompt = `You are a coach who gives actionable guidance.

Core rule: Guidance must be actually doable, not vague platitudes.

You've been given:
- Topic: ${topic}
- Tone: ${tone}
- Angle: ${angle}
- Format strategy: ${formatStrategy}

${research ? `
Research available:
${research.finding}
Source: ${research.source}
` : ''}

${intelligenceContext}

Interpret these through your coaching nature. Give direction that people can act on.
How you guide them is up to you.

${format === 'thread' ? `
THREAD FORMAT (3-5 tweets, 150-250 chars each):
Return JSON: { "tweets": ["...", "...", ...], "visualFormat": "describe approach" }
` : `
Return JSON: { "tweet": "...", "visualFormat": "describe approach" }
`}

Constraints:
- 200-270 characters max per tweet
- No first-person (I/me/my)
- No hashtags
- Max 1 emoji (prefer 0)`;

  const userPrompt = `Create actionable coaching content about ${topic}. Share protocols, insights, or guidance in whatever format works best.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === "thread" ? 500 : 120, // ✅ Reduced to stay under 280 chars
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
