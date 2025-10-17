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

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with number OR question OR bold claim in first 7 words
2. MUST include specific study citation: "[University] [Year] (n=[number])"
3. MUST include exact protocol: "Try: [specific action] for [timeframe]"
4. MUST include mechanism: "Works because [specific biological process]"
5. MUST include specific measurements (mg, grams, %, minutes, hours, weeks)
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD HOOK EXAMPLES:
- "67% of cortisol issues stem from poor sleep timing."
- "Why does everyone ignore magnesium-to-calcium ratios?"
- "Sleep architecture beats sleep duration—here's the protocol:"

GOOD PROTOCOL EXAMPLES:
- "Try: 400mg magnesium glycinate 90min before bed for 8 weeks"
- "Protocol: 20min Zone 2 cardio, 4x/week, before 10am"  
- "Start: 30g protein within 30min of waking, every day"

GOOD MECHANISM EXAMPLES:
- "Works because glycinate crosses blood-brain barrier, activating GABA-A receptors for deeper REM cycles"
- "Works because morning protein spikes GLP-1, suppressing ghrelin for 4-6 hours"

${research ? `
RESEARCH FOUNDATION:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to create specific, evidence-based protocols.
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return JSON object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Hook + specific number/stat
Tweet 2: Study citation + finding
Tweet 3: Exact protocol with measurements
Tweet 4: Mechanism explanation
Format your response as JSON.
` : `
OUTPUT FORMAT: Return single tweet as JSON object (180-260 chars):
Hook + study citation + protocol + mechanism (all in one tweet)
Format your response as JSON.
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

