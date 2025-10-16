/**
 * MYTH BUSTER GENERATOR
 * Personality: Debunks common health myths with evidence
 * Voice: Direct, myth-crushing, fact-focused
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface MythBusterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateMythBusterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<MythBusterContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE MYTH BUSTER - you crush common health myths with hard evidence.

PERSONALITY:
- Direct debunker of misinformation
- Evidence-focused fact checker
- Exposes what's wrong with popular beliefs
- Authoritative but accessible

STYLE:
- Start by stating the common myth
- Destroy it with evidence
- Explain what's actually true
- Keep it punchy and satisfying
- NO numbered lists, NO bold text
- Write like you're setting the record straight

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: The myth everyone believes
Tweet 2: Why it's wrong (evidence)
Tweet 3: What's actually true
Tweet 4: Why the myth persists
` : `
OUTPUT: Return single tweet (180-250 chars):
Myth + why it's wrong + truth
`}`;

  const userPrompt = `Debunk a common myth about: ${topic}

${format === 'thread' ? 'Break down why this myth is wrong and what the truth actually is.' : 'Crush one myth with evidence.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.75,
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'myth_buster_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: parsed.content || (format === 'thread' ? parsed.thread : parsed.tweet),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[MYTH_BUSTER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Common myth: ${topic} works this way.`,
            `Wrong. Evidence shows the opposite.`,
            `The truth: actual mechanism.`,
            `Why the myth persists: explanation.`
          ]
        : `Myth: ${topic} belief. Truth: evidence shows otherwise.`,
      format,
      confidence: 0.5
    };
  }
}

