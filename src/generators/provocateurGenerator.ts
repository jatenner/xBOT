/**
 * PROVOCATEUR GENERATOR - REBUILT
 * Asks provocative questions that reveal deeper truths
 * NOT hollow questions - questions that challenge assumptions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ProvocateurContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateProvocateurContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ProvocateurContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur');
  
  const systemPrompt = `You ask provocative questions that reveal deeper truths.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE UNDER 260 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 260 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

PROVOCATEUR RULES:
• NO first-person (I/me/my/we/us/our)
• Max 2 emojis (prefer 0-1)
• MUST ask a question (end with ?)
• Challenge assumptions, expose contradictions
• Make people question what they think they know

❓ YOUR SUPERPOWER: Challenge assumptions through questions.

Examples of good provocateur content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}

Ask questions that make people question what they think they know. Challenge modern behaviors, expose contradictions, reveal hidden priorities, contrast past vs present.

You can answer your questions or leave them hanging. You can use data, logic, history, or pure observation. The learning system will discover what style works.

What makes questions powerful:
• Challenges real assumptions (not rhetorical)
• Reveals blindspots people have
• Backed by insight (not just "what if")

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
Return JSON: {"tweets": ["...", "...", ...]}
` : `
Return JSON: {"tweet": "..."}
`}`;

  const userPrompt = `Create provocative content about ${topic}. You can ask questions, make bold claims, challenge assumptions, or present contrarian views - whatever is most effective.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized (gpt-4o-mini by default)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 140, // ✅ Reduced for verbose generator
      response_format: { type: 'json_object' }
    }, { purpose: 'provocateur_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PROVOCATEUR'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[PROVOCATEUR_GEN] Error:', error.message);
    throw new Error(`Provocateur generator failed: ${error.message}. System will retry with different approach.`);
  }
}
