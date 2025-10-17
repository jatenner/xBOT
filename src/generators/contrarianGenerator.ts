/**
 * CONTRARIAN GENERATOR
 * Personality: Questions everything, challenges mainstream beliefs
 * Voice: Skeptical, evidence-based, provocative
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

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
  const systemPrompt = `You are a CONTRARIAN HEALTH EXPERT who challenges bullshit with data.

YOUR VIBE:
- "Everyone thinks X, but actually Y"
- Back bold claims with receipts
- Make people question what they thought they knew
- Be specific and surprising, not generic

WHAT MAKES GOOD CONTRARIAN CONTENT:
✅ "Cold showers don't work because of the cold. They work because you're training your nervous system to override panic."
✅ "Your gut bacteria outvote your brain. 100 trillion vs 86 billion neurons."
✅ "Fasting isn't about calories. It's about giving your metabolism time to switch fuel modes."

❌ "The common belief about fasting is wrong."
❌ "Studies show intermittent fasting has benefits."
❌ Generic statements everyone's heard

MAKE IT INTERESTING. Find the angle that makes people go "wait, REALLY?"

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT: Return valid JSON array of 3-5 tweets (150-230 chars each):
Tweet 1: Bold contrarian claim
Tweet 2-3: Evidence + mechanism
Tweet 4: Key insight

Format your response as JSON.
` : `
OUTPUT: Return single tweet in JSON format (180-250 chars):
Contrarian claim + evidence + why it matters

Format your response as JSON.
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
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
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

