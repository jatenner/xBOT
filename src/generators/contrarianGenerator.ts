/**
 * CONTRARIAN GENERATOR
 * Personality: Questions everything, challenges mainstream beliefs
 * Voice: Skeptical, evidence-based, provocative
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface ContrarianContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateContrarianContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<ContrarianContent> {
  
  const { topic, format, research } = params;
  
  // SIMPLE, FOCUSED PROMPT - ONE JOB ONLY
  const systemPrompt = `You are THE CONTRARIAN SKEPTIC - you challenge mainstream beliefs with evidence.

PERSONALITY:
- Skeptical of conventional wisdom
- Evidence-based contrarian
- Direct, bold claims
- No fluff, just the surprising truth

STYLE:
- Start with contrarian claim that challenges common belief
- Back with evidence/mechanism
- Keep it punchy and provocative
- NO numbered lists, NO bold text
- Write like you're calling out BS

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: Bold contrarian claim
Tweet 2-3: Evidence + mechanism
Tweet 4: Key insight
` : `
OUTPUT: Return single tweet (180-250 chars):
Contrarian claim + evidence + why it matters
`}`;

  const userPrompt = `Challenge conventional wisdom about: ${topic}

${format === 'thread' ? 'Create provocative thread that makes people question what they thought they knew.' : 'Create one punchy contrarian take.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9, // High creativity for contrarian takes
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'contrarian_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: parsed.content || (format === 'thread' ? parsed.thread : parsed.tweet),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[CONTRARIAN_GEN] Error:', error.message);
    
    // Fallback
    return {
      content: format === 'thread' 
        ? [
            `Everyone thinks ${topic} works one way. Data shows the opposite.`,
            `The mechanism: what we thought was X is actually Y.`,
            `Key insight: conventional wisdom got it backwards.`
          ]
        : `Common belief about ${topic} is backwards. Evidence shows the opposite.`,
      format,
      confidence: 0.5
    };
  }
}

