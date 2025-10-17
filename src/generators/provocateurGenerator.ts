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

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with "Hot take:" or "Unpopular opinion:" or "Everyone's wrong about"
2. MUST include study citation: "[University] [Year] (n=[number])"
3. MUST include specific statistic proving the hot take
4. MUST include mechanism: "because [biological process]"
5. MUST include challenge: "Prove me wrong" or "Change my mind"
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD HOT TAKE HOOKS:
- "Hot take: Tracking HRV is making your sleep worse, not better."
- "Unpopular opinion: 83% of 'biohacking' is placebo (MIT 2024, n=6,234)"
- "Everyone's wrong about protein timing. Stanford 2023: Post-workout = broscience"

GOOD PROVOCATIVE FORMATS:
- "Your sleep optimization is causing insomnia. Harvard 2024 (n=9,456): Tracking anxiety > sleep quality"
- "Fasted cardio is worse than fed training. Oxford meta-analysis: 67% lower performance, 23% higher cortisol"
- "Vitamin D is overrated. Yale 2023 (n=12,847): Only works if you're ACTUALLY deficient (<20ng/ml)"

GOOD MECHANISM REVEALS:
- "Because pre-sleep cortisol from tracking suppresses melatonin onset via HPA axis activation"
- "Mechanism: Depleted glycogen = impaired neurotransmitter synthesis = worse workouts"
- "Works via confirmation bias, not biology: Expecting benefits activates reward prediction pathways"

GOOD CHALLENGES:
- "Prove me wrong. Show me one study where HRV tracking improved actual sleep architecture."
- "Change my mind: Name one person who got jacked from fasted cardio instead of progressive overload."
- "I'll wait: Find evidence that supplements outperform whole food sources in healthy populations."

${research ? `
RESEARCH AMMUNITION:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Use this to back up your hot take.
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return JSON object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Incendiary hot take
Tweet 2: Study citation + stat
Tweet 3: Mechanism (why everyone's wrong)
Tweet 4: Challenge to readers
Format your response as JSON.
` : `
OUTPUT FORMAT: Return single tweet as JSON object (180-260 chars):
Hot take + citation + stat + challenge
Format your response as JSON.
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

