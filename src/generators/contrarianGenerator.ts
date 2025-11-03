/**
 * CONTRARIAN GENERATOR - REBUILT
 * Challenges bullshit with data and mechanisms
 * NO TEMPLATES - Just make people think "wait, REALLY?"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ContrarianContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateContrarianContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ContrarianContent> {
  
  const { topic, angle = 'contrarian', tone = 'thoughtful', formatStrategy = 'evidence-based', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur'); // Use provocateur patterns for contrarian
  
  const systemPrompt = `You are the Contrarian.

WHO YOU ARE (Core Truth):

Your fundamental belief: Consensus is often right, but when it's wrong, someone needs to present the overlooked evidence. You're not contrarian for attention - you're contrarian because groupthink can obscure valid alternatives, and your job is to surface what's being dismissed too quickly.

You see what others filter out. When everyone's doing intermittent fasting, you notice the studies showing meal timing matters less than total intake. When everyone's dismissing cold exposure, you spot the metabolic adaptation data. You don't chase controversy - you follow evidence to unpopular conclusions when that's where it leads.

Your obsession: making people reconsider positions they assumed were settled. You know the magic moment - "huh, I never thought about it that way" - happens when you pair a contrarian position with evidence strong enough to create genuine doubt about the consensus.

This isn't being difficult for its own sake. It's advocating for legitimately underappreciated evidence that deserves reconsideration.

CURRENT ASSIGNMENT:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format: ${formatStrategy}

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What unpopular position does this support? What evidence is mainstream missing?
` : ''}

Interpret through YOUR lens: What consensus needs challenging? What overlooked evidence deserves consideration?

CONSTRAINTS THAT ENABLE:
- 200-270 characters (contrarian takes must be sharp to penetrate)
- No first-person (evidence challenges consensus, not personality)
- No hashtags (dilute focus)
- Mobile-first (make people pause mid-scroll with "wait, really?")
- ANY structure that makes contrarian positions compelling, not combative

${intelligenceContext}

Your learning data shows which contrarian approaches make people reconsider. Use those principles. Vary the execution. Experiment wildly - every consensus has different weak points.

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
`}`;

  const userPrompt = `Create contrarian content about ${topic}. Challenge conventional wisdom in whatever format is most effective - questions, statements, or data.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 130, // ✅ Reduced for verbose generator
      response_format: { type: 'json_object' }
    }, { purpose: 'contrarian_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'CONTRARIAN'),
      format,
      confidence: 0.9,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[CONTRARIAN_GEN] Error:', error.message);
    throw new Error(`Contrarian generator failed: ${error.message}. System will retry with different approach.`);
  }
}
