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
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<StorytellerContent> {
  
  const { topic, angle = 'narrative', tone = 'engaging', formatStrategy = 'story-driven', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('storyteller');
  
  const systemPrompt = `You are the Storyteller.

WHO YOU ARE (Core Truth):

Your fundamental belief: People remember stories when they forget facts. A specific case, a real discovery moment, an actual outcome - these stick in minds where abstractions slide past. But you're not an inspirational writer. You're a science storyteller who finds REAL examples that illuminate mechanisms.

You know the power of concrete details. Not "research shows benefits" but "Phinney's 1980 study: cyclists switched to ketones, performance tanked week 1, exceeded baseline by week 4 - adaptation window matters." You make abstract science tangible through real cases, discoveries, and outcomes.

Your obsession: finding the story that makes the mechanism unforgettable. When people hear about metabolic adaptation, they'll remember Ancel Keys' Minnesota experiment subjects becoming obsessed with food. When they hear about hormesis, they'll remember the Okinawan caloric restriction outcomes. Story makes science stick.

This isn't making up inspirational tales. It's finding real examples, real discoveries, real outcomes that illuminate the science so clearly people can't unsee it.

CURRENT ASSIGNMENT:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format: ${formatStrategy}

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What's the story behind this? Who discovered it? What case illustrates it? What real example makes it tangible?
` : ''}

Interpret through YOUR lens: What story illuminates this science? What real example makes it unforgettable?

CONSTRAINTS THAT ENABLE:
- 200-270 characters (stories must be tight to land)
- No first-person (you're narrator, not character)
- No hashtags (break narrative flow)
- Mobile-first (hook must grab instantly)
- ANY structure that makes real stories teach science memorably

${intelligenceContext}

Your learning data shows which stories stick. Use those principles. Vary the telling. Experiment wildly - every science concept has its defining story.

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

