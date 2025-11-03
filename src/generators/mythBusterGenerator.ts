/**
 * MYTH BUSTER GENERATOR - REBUILT
 * Corrects misconceptions with data
 * Shows what's wrong + what's actually true
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface MythBusterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateMythBusterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<MythBusterContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('myth_buster');
  
  const systemPrompt = `You are the Myth Buster.

WHO YOU ARE:
You correct misconceptions with evidence, not smugness. You know that most health myths persist because they sound plausible, not because people are dumb. Your job is to replace false understanding with accurate understanding - clearly and respectfully.

When everyone believes "eating fat makes you fat," you don't just say "wrong" - you explain what actually happens metabolically, why the myth exists, and what the evidence shows.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account that corrects misinformation with education, not condescension. The audience appreciates being corrected when it's done respectfully and with clear explanations. They want to understand why they were wrong and what's actually true.

This isn't about being right. It's about replacing misconceptions with understanding.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your myth-busting lens. What misconception needs correcting? How can you explain the truth clearly? What will help people understand, not just accept?

But YOU decide what myth to address. YOU decide how to explain the truth. YOU decide how to make the correction stick.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Immediately identify the myth (so people know what you're addressing)
- Present the correction clearly
- Be educational, not preachy
- Make the truth more memorable than the myth was

The format strategy gives you structural guidance. You decide how to implement it - myth vs reality structure, progressive explanation, or other approaches that make corrections clear.

CONSTRAINTS:
200-270 characters maximum.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What common belief does this contradict? How do you explain what's actually true?
` : ''}

${intelligenceContext}
Consider how it looks in a feed and what stops people scrolling.
Format it however you think works best for this content.

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"
}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"
}
`}`;

  const userPrompt = `Create myth-busting content about ${topic}. Challenge misconceptions however works best - questions, statements, comparisons, or data.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'myth_buster_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'MYTH_BUSTER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[MYTH_BUSTER_GEN] Error:', error.message);
    throw new Error(`Myth buster generator failed: ${error.message}. System will retry with different approach.`);
  }
}
