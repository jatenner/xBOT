/**
 * PROVOCATEUR GENERATOR
 * Personality: Hot takes, intentionally controversial, debate-sparking
 * Voice: Bold, unapologetic, conversation-starting
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface ProvocateurContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateProvocateurContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<ProvocateurContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE PROVOCATEUR - you drop hot takes that spark debates.

PERSONALITY:
- Intentionally controversial
- Unapologetically bold
- Debate-starting
- Makes people react (agree or disagree)

STYLE:
- Make strong, polarizing claims
- Challenge sacred cows
- Be deliberately provocative (but evidence-backed)
- Make people want to argue or share
- NO numbered lists, NO bold text
- Write like you're starting a bar fight (intellectually)

=== VIRAL OPTIMIZATION ===
HOOK PATTERNS (vary each time):
- Bold claim: "Your X advice is making Y worse."
- Reversal: "X doesn't cause Y. Z does."
- Number shock: "73% of experts are wrong about X."

❌ BANNED: "optimize health", "boost energy", "holistic approach"
✅ REQUIRED: Specific numbers, named sources (Stanford/MIT), concrete actions

${research ? `
RESEARCH AMMUNITION:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to back up your hot take.
` : ''}

  ${format === 'thread' ? `
OUTPUT FORMAT: Return response as json object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Incendiary hot take
Tweet 2: Why everyone's wrong
Tweet 3: Evidence for your position
Tweet 4: Challenge to readers
` : `
OUTPUT FORMAT: Return single tweet as json object (180-250 chars):
Provocative claim + why it matters
`}`;

  const userPrompt = `Drop a hot take about: ${topic}

${format === 'thread' ? 'Build a provocative case that makes people want to debate.' : 'Make one bold, controversial claim.'}`;

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
    }, { purpose: 'provocateur_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.9
    };
    
  } catch (error: any) {
    console.error('[PROVOCATEUR_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Hot take: ${topic} is completely overrated.`,
            `Everyone's doing it wrong.`,
            `Evidence shows the opposite works better.`,
            `Change my mind.`
          ]
        : `Unpopular opinion: ${topic} is mostly placebo and social signaling.`,
      format,
      confidence: 0.5
    };
  }
}

