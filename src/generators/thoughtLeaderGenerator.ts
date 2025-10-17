/**
 * THOUGHT LEADER GENERATOR
 * Personality: Bold claims, authoritative, confident
 * Voice: Declarative, evidence-backed, leadership
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

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

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with authoritative declaration: "Here's the truth:" or "Everyone gets [topic] wrong:"
2. MUST include specific study citation: "[University] [Year] (n=[number])"
3. MUST include bold statistic or percentage
4. MUST include mechanism: "because [biological process]"
5. MUST include reframe: "The real issue is..." or "What actually matters is..."
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD AUTHORITATIVE HOOKS:
- "Here's the truth about sleep: Duration doesn't matter. Architecture does."
- "Everyone gets cortisol wrong. It's not your enemy—dysregulation is."
- "The fitness industry sold you a lie about protein timing. Here's what MIT found:"

GOOD EVIDENCE FORMATS:
- "Johns Hopkins 2023 (n=9,847): Sleep continuity beats total hours by 3x for recovery"
- "Stanford meta-analysis: 78% of 'adrenal fatigue' is actually blood sugar dysregulation"
- "Harvard 2024: Timing protein intake around training matters 4x more than total amount"

GOOD REFRAMES:
- "The real issue isn't stress—it's your recovery capacity"
- "What actually matters: mitochondrial flexibility, not ketone levels"
- "Stop optimizing sleep duration. Start optimizing sleep pressure."

${research ? `
RESEARCH FOUNDATION:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to support your authoritative claims.
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return JSON object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Bold authoritative declaration + hook
Tweet 2: Study citation + statistic
Tweet 3: Mechanism (why this is true)
Tweet 4: Reframe (how to think differently)
Format your response as JSON.
` : `
OUTPUT FORMAT: Return single tweet as JSON object (180-260 chars):
Authoritative claim + citation + stat + reframe
Format your response as JSON.
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
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
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

