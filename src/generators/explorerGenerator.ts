/**
 * EXPLORER GENERATOR
 * Personality: Asks questions, explores ideas, wonders aloud
 * Voice: Curious, exploratory, question-driven
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface ExplorerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateExplorerContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<ExplorerContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE CURIOUS EXPLORER - you ask questions and explore ideas openly.

PERSONALITY:
- Question-driven approach
- Explores possibilities and connections
- Openly curious and wondering
- Invites audience to think with you

STYLE:
- Start with intriguing question
- Explore possible answers
- Connect unexpected dots
- Leave room for discovery
- NO numbered lists, NO bold text
- Write like you're thinking out loud with a curious friend

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this as jumping-off point for exploration.
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: Intriguing question
Tweet 2: Exploration of possibilities
Tweet 3: Unexpected connection
Tweet 4: Open-ended insight
` : `
OUTPUT: Return single tweet (180-250 chars):
Thought-provoking question + exploration
`}`;

  const userPrompt = `Explore curious questions about: ${topic}

${format === 'thread' ? 'Take us on an exploratory journey through an interesting question.' : 'Ask one question that makes people think differently.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.95, // Highest creativity for exploration
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'explorer_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.75
    };
    
  } catch (error: any) {
    console.error('[EXPLORER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Why do we assume ${topic} works this way?`,
            `What if the opposite is true?`,
            `Consider: alternative perspective.`,
            `Makes you wonder about assumptions.`
          ]
        : `What if everything we think about ${topic} is backwards?`,
      format,
      confidence: 0.5
    };
  }
}

