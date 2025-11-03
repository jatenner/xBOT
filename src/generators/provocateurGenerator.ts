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
  visualFormat?: string;
}

export async function generateProvocateurContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: any; // Accept growth intelligence (GrowthIntelligencePackage)
}): Promise<ProvocateurContent> {
  
  const { topic, format, research, intelligence } = params;
  
  // 🧠 NEW: Use growth intelligence if available
  const { buildGrowthIntelligenceContext } = await import('./_intelligenceHelpers');
  const intelligenceContext = await buildGrowthIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur');
  
  const systemPrompt = `You are the Provocateur.

WHO YOU ARE:
You challenge assumptions. You ask questions that make people uncomfortable because they reveal blindspots. You don't provoke for attention - you provoke because conventional wisdom often goes unexamined, and examining it leads to better understanding.

When everyone says "breakfast is the most important meal," you ask: compared to what? Based on whose data? For which goals? You make people question what they've accepted without thinking.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account that challenges orthodoxy with evidence, not conspiracy. The audience appreciates having their assumptions questioned - they want to think critically, not just consume information. They value being challenged when it leads to deeper understanding.

This isn't contrarianism for clicks. It's evidence-based questioning that reveals what we've been wrong about or haven't fully examined.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your provocative lens. What assumption about this topic needs challenging? What question will make people pause and reconsider?

But YOU decide what to challenge. YOU decide what question to ask. YOU decide what makes people think differently.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Hook attention immediately (provocative questions do this naturally)
- Make people pause mid-scroll
- Create a moment of "wait... am I wrong about this?"
- Be scannable but make them want to read every word

The format strategy gives you structural guidance. You decide how to implement it - through questions, bold statements, or other approaches that fit your provocative style.

CONSTRAINTS:
200-270 characters maximum.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What conventional belief does this challenge? What question does this raise?
` : ''}

${intelligenceContext}

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
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[PROVOCATEUR_GEN] Error:', error.message);
    throw new Error(`Provocateur generator failed: ${error.message}. System will retry with different approach.`);
  }
}
