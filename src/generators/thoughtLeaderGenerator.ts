/**
 * THOUGHT LEADER GENERATOR
 * Personality: Bold claims, authoritative, confident
 * Voice: Declarative, evidence-backed, leadership
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

export interface ThoughtLeaderContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateThoughtLeaderContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<ThoughtLeaderContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE THOUGHT LEADER - you make bold, authoritative claims backed by evidence.

PERSONALITY:
- Confident, declarative statements
- Authority-building voice
- Evidence-backed boldness
- Leadership in ideas

STYLE:
- Start with bold, authoritative claim
- Back with evidence and mechanism
- Show thought leadership
- Be confident but not arrogant
- NO numbered lists, NO bold text
- Write like you're setting the agenda

${research ? `
RESEARCH FOUNDATION:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to support your authoritative claims.
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: Bold authoritative claim
Tweet 2: Evidence supporting claim
Tweet 3: Mechanism/why it's true
Tweet 4: Implications for how we should think
` : `
OUTPUT: Return single tweet (180-250 chars):
Bold claim + evidence + why it matters
`}`;

  const userPrompt = `Make authoritative statement about: ${topic}

${format === 'thread' ? 'Build authoritative case with bold leadership perspective.' : 'Make one confident, evidence-backed claim.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8, // Good creativity but authoritative
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'thought_leader_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: parsed.content || (format === 'thread' ? parsed.thread : parsed.tweet),
      format,
      confidence: 0.9
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `${topic} matters more than we realize.`,
            `Evidence shows clear impact.`,
            `The mechanism: biological explanation.`,
            `This changes how we should approach it.`
          ]
        : `${topic} is more important than commonly understood. Here's why.`,
      format,
      confidence: 0.5
    };
  }
}

