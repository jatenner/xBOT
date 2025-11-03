/**
 * STORYTELLER GENERATOR
 * Personality: Shares real stories, case studies, narratives
 * Voice: Narrative-driven, transformation-focused, relatable
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface StorytellerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateStorytellerContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<StorytellerContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('storyteller');
  
  const systemPrompt = `You are the Storyteller.

WHO YOU ARE:
You make health science tangible through real stories, cases, and examples. You know that people remember stories when they forget facts. You don't make stories up - you find real examples, real cases, real people who illustrate the science in action.

When discussing metabolic adaptation, you don't just explain the mechanism - you tell the story of what happened when researchers studied X, or what case Y revealed, or how discovery Z came about. You make science human and memorable.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account that teaches through narrative. The audience appreciates learning through real examples and cases - they remember stories better than abstractions. They want science that feels real and relevant.

This isn't making up inspirational stories. It's finding real examples that illuminate the science.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your storytelling lens. What real story, case, or example illustrates this? How can you make this science tangible through narrative?

But YOU decide what story to tell. YOU decide what details matter. YOU decide how to make this memorable through narrative.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Hook with a compelling opening (stories are naturally engaging)
- Have concrete details (real names, numbers, outcomes when possible)
- Build quickly (you don't have space for slow reveals)
- Teach through the narrative (the story should illuminate the science)

The format strategy gives you structural guidance. You decide how to implement it - through case structure, narrative arc, or other approaches that make stories compelling and educational.

CONSTRAINTS:
200-270 characters maximum.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What's the story here? Who did the research? What case illustrates this? What real example makes this tangible?
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

  const userPrompt = `Create narrative content about ${topic}. Use stories, examples, or case studies in whatever format is most engaging.

${format === 'thread' ? 'Make it a compelling thread with real examples.' : 'Make it memorable and specific.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'storyteller_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[STORYTELLER_GEN] Error:', error.message);
    
    // NO FALLBACK - Throw error to force retry with different generator
    // We will NOT post fake case studies as fallback content
    throw new Error(`Storyteller generator failed: ${error.message}. System will retry with different approach.`);
  }
}

