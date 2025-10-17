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

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with "What if" or "Have you noticed" or "Why does"
2. MUST include study citation supporting the question: "[University] [Year] (n=[number])"
3. MUST include specific statistic or measurement
4. MUST include mechanism: "because [biological process]"
5. MUST include unexpected connection: "This connects to [surprising link]"
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD EXPLORATORY HOOKS:
- "What if chronic fatigue isn't energy depletion but energy misdirection?"
- "Have you noticed people who track everything sleep worse? There's data on this."
- "Why does optimizing sleep architecture beat optimizing duration by 3x?"

GOOD QUESTION FORMATS WITH DATA:
- "What if MIT 2023 (n=4,782) is right: Sleep pressure > sleep duration for recovery?"
- "Have you noticed: Stanford found 67% of 'burnout' is actually blood sugar dysregulation?"
- "Why does morning light (Oxford 2024, n=8,123) reset circadian rhythm better than melatonin?"

GOOD UNEXPECTED CONNECTIONS:
- "This connects to why meditation works: GABA-A receptor upregulation, not 'stress relief'"
- "Fascinating link: Same pathway as psychedelics → default mode network suppression"
- "Unexpected: Same mechanism drives addiction and optimization behavior"

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this as jumping-off point for exploration.
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: Intriguing question with data
Tweet 2: Study citation + finding
Tweet 3: Mechanism exploration
Tweet 4: Unexpected connection revealed
Format your response as JSON.
` : `
OUTPUT: Return single tweet as JSON object (180-260 chars):
Question + data + mechanism + surprising link
Format your response as JSON.
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

