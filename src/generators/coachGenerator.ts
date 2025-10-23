/**
 * COACH GENERATOR - REBUILT
 * Gives SPECIFIC, actionable protocols
 * NO GENERIC ADVICE - Exact numbers, temps, timing
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { VOICE_GUIDELINES } from './sharedPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CoachContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateCoachContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CoachContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const systemPrompt = `You give clear, actionable protocols people can actually follow.

${VOICE_GUIDELINES}

🚨 HARD RULES:
• Max 260 chars
• No first-person (I/me/my/we)
• Max 2 emojis

💪 YOUR SUPERPOWER: Make science actionable.

Give specific protocols: doses, frequencies, timings, steps. Tell people exactly what to do, not just what to know.

You can be prescriptive or give options. You can explain why or just say what. The learning system will discover what gets people to act.

What makes coaching work:
• Specific beats vague (30g protein, not "enough")
• Simple beats complex (fewer steps = more action)
• Clear beats confusing (remove ambiguity)
• Actionable beats theoretical

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
Return JSON: {"tweets": ["...", "...", ...]}
` : `
Return JSON: {"tweet": "..."}
`}`;

  const userPrompt = `Give a clear, actionable protocol for ${topic}.`;

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
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[COACH_GEN] Error:', error.message);
    throw new Error(`Coach generator failed: ${error.message}. System will retry with different approach.`);
  }
}
