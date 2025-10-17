/**
 * MYTH BUSTER GENERATOR
 * Personality: Debunks common health myths with evidence
 * Voice: Direct, myth-crushing, fact-focused
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

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

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with "Myth:" or "Everyone thinks [X] but..."
2. MUST include study citation debunking it: "[University] [Year] (n=[number])"
3. MUST include specific statistic proving it wrong
4. MUST include mechanism: "Actually works via [biological process]"
5. MUST include corrected action: "Instead: [specific protocol]"
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD MYTH HOOKS:
- "Myth: More sleep = better recovery. Harvard 2024 (n=8,932): Sleep continuity beats duration 3x"
- "Everyone thinks cardio burns fat. MIT 2023 (n=4,567): Resistance training increases RMR 23% more"
- "Myth: Fasted cardio burns more fat. Stanford debunked this with 2,847 participants"

GOOD DEBUNKING FORMATS:
- "Wrong. Oxford 2024 (n=12,456): Protein timing matters 4x more than fasting state"
- "False. Johns Hopkins meta-analysis: 89% of benefits come from sleep pressure, not hours"
- "Debunked. Yale 2023: Caloric deficit determines fat loss, timing contributes <3%"

GOOD TRUTH REVEALS:
- "Truth: GABA-A receptor density matters more than total sleep time"
- "Reality: Muscle protein synthesis peaks when glycogen is PRESENT, not depleted"
- "Actually: Cortisol awakening response needs morning light exposure, not suppression"

GOOD CORRECTIONS:
- "Instead: Optimize sleep continuity (wake count) not duration"
- "Try this: 30g protein within 30min of training beats fasted state"
- "Protocol: 15min morning sunlight > melatonin supplements"

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: State the myth
Tweet 2: Debunk with study + stat
Tweet 3: Explain true mechanism
Tweet 4: Give corrected protocol
Format your response as JSON.
` : `
OUTPUT: Return single tweet as JSON object (180-260 chars):
Myth + debunk + truth + correction
Format your response as JSON.
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
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
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

