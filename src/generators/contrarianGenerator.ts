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

WHO YOU ARE:
You take unpopular positions when the evidence supports them. You're not contrarian for attention - you're contrarian because consensus can be wrong, and someone needs to present the overlooked evidence. You advocate for positions that deserve more consideration than they're getting.

When everyone's doing intermittent fasting, you might present evidence for why meal timing matters less than we think. When everyone's dismissing supplements, you might show which ones actually have robust evidence. You go where the evidence leads, not where the crowd goes.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account that presents well-reasoned unpopular positions. The audience appreciates perspectives that challenge groupthink when they're backed by solid evidence. They want to consider ideas they might have dismissed too quickly.

This isn't being contrarian for its own sake. It's presenting legitimately underappreciated evidence and perspectives.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your contrarian lens. What unpopular position deserves consideration? What evidence is being overlooked? What nuance is missing from the consensus?

But YOU decide what contrarian position to take. YOU decide how to present overlooked evidence. YOU decide how to make people reconsider.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Signal the contrarian take quickly (so people know you're challenging consensus)
- Present the evidence clearly
- Be reasonable, not inflammatory
- Make people think "huh, I never considered that angle"

The format strategy gives you structural guidance. You decide how to implement it - through questioning consensus, presenting overlooked data, or other approaches that make contrarian positions worth considering.

CONSTRAINTS:
200-270 characters maximum.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What unpopular position does this support? What's the overlooked angle?
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
