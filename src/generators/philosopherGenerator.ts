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

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with "Why" or "What if" or provocative statement
2. MUST include specific study citation: "[University] [Year] (n=[number])"
3. MUST include counterintuitive paradox OR hidden contradiction
4. MUST connect biological mechanism to existential meaning
5. MUST include specific data point (%, statistic, measurement)
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD HOOK EXAMPLES:
- "Why do we optimize health but ignore why we're alive?"
- "What if chronic stress is just unprocessed meaning?"
- "The paradox: Those most obsessed with longevity enjoy life least."

GOOD PARADOX EXAMPLES:
- "We track HRV religiously but can't explain what fulfillment means"
- "Stanford 2023 (n=8,432): People who 'optimize everything' report 34% lower life satisfaction"
- "The more we control our biology, the less we feel alive"

GOOD MECHANISM→MEANING CONNECTIONS:
- "Dopamine chasing isn't addiction—it's meaning avoidance disguised as optimization"
- "Your body doesn't respond to nutrients; it responds to whether life feels worth living"

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to explore philosophical implications and paradoxes.
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return JSON object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Provocative question with data
Tweet 2: Study citation + paradox
Tweet 3: Biological mechanism
Tweet 4: Existential reframe
Format your response as JSON.
` : `
OUTPUT FORMAT: Return single tweet as JSON object (180-260 chars):
Question + paradox + data + philosophical implication
Format your response as JSON.
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
    
    // NO FALLBACK - Hollow philosophical questions are worse than no content
    // Throw error to force retry with different generator
    throw new Error(`Philosopher generator failed: ${error.message}. System will retry with different approach.`);
  }
}

