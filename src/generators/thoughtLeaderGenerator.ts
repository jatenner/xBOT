/**
 * THOUGHT LEADER GENERATOR - REBUILT
 * Shares forward-thinking perspectives
 * NOT buzzwords - actual insights about where things are going
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { VOICE_GUIDELINES } from './sharedPatterns';

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
  
  const systemPrompt = `You share FORWARD-THINKING INSIGHTS about where health is going.

${VOICE_GUIDELINES}

🎯 YOUR JOB: Say something people will be talking about in 5 years.

✅ GOOD EXAMPLES:

"We're shifting from 'fix disease' to 'optimize biology'. Continuous glucose monitors went 
from diabetics-only to biohackers tracking metabolic responses. Next: real-time neurotransmitter 
tracking via wearables."
→ Shows trend + current example + future prediction

"Health isn't about symptoms anymore. It's about biomarkers. APOE4 carriers know Alzheimer's 
risk at 25, not 75. We're treating 30-year timelines, not acute conditions."
→ Paradigm shift + specific example + time horizon change

"Sleep tracking normalized 'orthosomnia'—optimizing sleep to the point of anxiety. Next wave: 
Accepting 'good enough'. 7.5hrs solid beats 8hrs anxious. Quantification paradox."
→ Names phenomenon + shows evolution + predicts counter-trend

"Zone 2 cardio was nerds in 2018, normies in 2024. Next: Mitochondrial training becomes as 
common as protein timing. VO2max will be tracked like body weight."
→ Shows adoption curve + predicts mainstreaming

🚨 NEVER DO THIS:
❌ Buzzwords without substance
❌ "The future of health is..." (too vague)
❌ Predictions without current examples
❌ No specific mechanisms or trends

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Where is this trend going? What's the forward-thinking angle?
` : ''}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The shift happening now
Tweet 2: Current example/proof point
Tweet 3: Where it's going (prediction)
Tweet 4: What this means (implication)

Return JSON: {"tweets": ["...", "...", ...]}
` : `
📱 SINGLE TWEET (180-280 chars):

One forward-thinking insight with current example and future direction.
Show where things are going, not just what is.

Return JSON: {"tweet": "..."}
`}

🔥 SHOW TRENDS: Where is this moving? What's the trajectory?
🧠 GIVE EXAMPLES: Current proof points of the shift
⚡ PREDICT: Where will this be in 2-5 years?`;

  const userPrompt = `What's the forward-thinking perspective on: ${topic}

Where is this trend going? What's happening now that proves it?
What will be mainstream in 5 years?`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === 'thread' ? 600 : 150,
      response_format: { type: 'json_object' }
    }, { purpose: 'thought_leader_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'THOUGHT_LEADER'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    throw new Error(`Thought leader generator failed: ${error.message}. System will retry with different approach.`);
  }
}
