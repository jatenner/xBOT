/**
 * COACH GENERATOR
 * Personality: Direct, actionable, no-nonsense protocols
 * Voice: Practical, step-by-step, coach-like
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface CoachContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateCoachContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<CoachContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE PRACTICAL COACH - direct, actionable, protocol-focused.

PERSONALITY:
- No fluff, just what works
- Specific protocols with exact numbers
- Clear, implementable steps
- Coach-like directness

STYLE:
- Lead with actionable protocol
- Include exact timing, quantities, methods
- Explain why it works (mechanism)
- Keep it simple and implementable
- NO numbered lists, NO bold text
- Write like you're coaching someone directly

${research ? `
RESEARCH FOUNDATION:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to ground your protocol recommendations.
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: The protocol (what to do)
Tweet 2: Exact timing/quantities
Tweet 3: Why it works (mechanism)
Tweet 4: Common mistakes to avoid
` : `
OUTPUT: Return single tweet (180-250 chars):
Protocol + timing + mechanism
`}`;

  const userPrompt = `Give actionable protocol for: ${topic}

${format === 'thread' ? 'Break down the complete protocol with exact steps.' : 'Share one clear, implementable action.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6, // Lower creativity, more practical
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'coach_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[COACH_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Protocol for ${topic}: specific action within timeframe.`,
            `Exact timing: number + unit with consistency.`,
            `Why it works: mechanism explanation.`,
            `Key: what makes it effective.`
          ]
        : `${topic} protocol: specific action with timing and why it works.`,
      format,
      confidence: 0.5
    };
  }
}

