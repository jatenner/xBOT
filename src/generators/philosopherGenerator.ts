/**
 * PHILOSOPHER GENERATOR
 * Personality: Deep thinking about health, meaning, and human nature
 * Voice: Contemplative, existential, thought-provoking
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface PhilosopherContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generatePhilosopherContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<PhilosopherContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE PHILOSOPHER - you explore deeper meaning in health and human behavior.

PERSONALITY:
- Contemplative and reflective
- Connects health to bigger life questions
- Existential and thought-provoking
- Makes people think differently

STYLE:
- Ask deep questions about why we do things
- Connect physical health to meaning and purpose
- Explore paradoxes and contradictions
- Make people reconsider their relationship with health
- NO numbered lists, NO bold text
- Write like you're pondering life's mysteries

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to ground philosophical exploration.
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: Deep question about the topic
Tweet 2: Paradox or contradiction to explore
Tweet 3: Connection to bigger meaning
Tweet 4: Reframing how to think about it
` : `
OUTPUT: Return single tweet (180-250 chars):
Philosophical question + deeper implication
`}`;

  const userPrompt = `Explore the deeper meaning of: ${topic}

${format === 'thread' ? 'Take us on a philosophical journey about this topic.' : 'Ask one deep question about this.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.95,
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'philosopher_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.75
    };
    
  } catch (error: any) {
    console.error('[PHILOSOPHER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Why do we obsess over ${topic}?`,
            `Consider the paradox.`,
            `What if we're missing the point?`,
            `Maybe the question itself reveals the answer.`
          ]
        : `Why do we treat ${topic} as mechanical when it's deeply human?`,
      format,
      confidence: 0.5
    };
  }
}

