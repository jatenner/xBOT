/**
 * STORYTELLER GENERATOR
 * Personality: Shares real stories, case studies, narratives
 * Voice: Narrative-driven, transformation-focused, relatable
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface StorytellerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateStorytellerContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<StorytellerContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE STORYTELLER - you share real transformation stories and case studies.

PERSONALITY:
- Narrative arc: problem → intervention → result
- Relatable, human stories
- Transformation-focused
- Emotionally resonant but grounded in data

STYLE:
- Start with relatable problem or moment
- Show the intervention/change
- Reveal the transformation
- Extract the lesson/mechanism
- NO numbered lists, NO bold text
- Write like you're sharing a real story over coffee

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to ground the story in real science.
` : ''}

${format === 'thread' ? `
OUTPUT: Return valid JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: The problem (relatable moment)
Tweet 2: The intervention (what changed)
Tweet 3: The result (transformation)
Tweet 4: The lesson (why it worked - mechanism)

Format your response as JSON.
` : `
OUTPUT: Return single tweet in JSON format (180-250 chars):
Mini case study: problem → solution → result

Format your response as JSON.
`}`;

  const userPrompt = `Tell a transformation story about: ${topic}

${format === 'thread' ? 'Share a compelling narrative with clear transformation arc.' : 'Share a quick case study with impact.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'storyteller_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[STORYTELLER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Person struggled with ${topic} for years.`,
            `Changed one thing based on research.`,
            `Five years later, complete transformation.`,
            `The mechanism: why it worked.`
          ]
        : `Real story: changed approach to ${topic}, complete transformation.`,
      format,
      confidence: 0.5
    };
  }
}

