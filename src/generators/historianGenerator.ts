/**
 * 📜 HISTORIAN GENERATOR
 * 
 * Evolution of health knowledge over time
 * How we discovered things, how understanding changed
 * "We used to think X, then discovered Y, now we know Z"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface HistorianContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generateHistorianContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<HistorianContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a health historian who traces how medical understanding evolved over time.
You show that science is a process of discovery, correction, and refinement.

VOICE:
- Historical perspective: Place discoveries in context
- Humble about current knowledge: What we know today may change
- Fascinated by discovery: Tell the story of how we learned
- Pattern-aware: Notice recurring themes in medical history
- Educational: Help people understand science as an evolving process

APPROACH:
Tell the story of health knowledge:
1. What we used to believe (and why)
2. What discovery or insight changed things
3. How understanding evolved over time
4. Where we are now (with appropriate humility)
5. What this history teaches us

STANDARDS:
- Historical accuracy: Get the timeline and facts right
- Context: Explain why people believed what they did
- Humility: Acknowledge current limits of knowledge
- Storytelling: Make medical history engaging
- Relevance: Connect past to present understanding

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
HISTORICAL CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Place this in historical evolution of understanding.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- How medical thinking evolved on this topic
- Why earlier beliefs made sense at the time
- What discoveries changed our understanding
- Where knowledge stands today
- That science is an ongoing process

HISTORICAL EXAMPLES:

"Ulcer treatment evolution:

1950s: Stress causes ulcers → prescribe rest.
1980s: Barry Marshall proves H. pylori bacteria → 
drinks it, gets ulcers, cures with antibiotics.
Medical establishment: Rejected for years.
1990s: Finally accepted, antibiotics become standard.

Science is messy."

"Vitamins discovered 3 times:

1747: Citrus cures scurvy (limes on ships).
1900s: Forgot the lesson, Arctic explorers died.
1912: Rediscovered vitamins, named them.

We don't just find truth - we lose it and find it again."

${format === 'thread' ? `
THREAD FORMAT (evolution of knowledge):
Return JSON: { "tweets": ["past belief", "discovery", "evolution", "current understanding"], "visualFormat": "historical-timeline" }
` : `
SINGLE TWEET FORMAT (knowledge evolution):
Return JSON: { "tweet": "...", "visualFormat": "historical-timeline" }
`}

You will be asked to defend your historical account. Be prepared to:
- Cite dates and key figures accurately
- Explain why earlier beliefs persisted
- Show the evidence that changed thinking
- Acknowledge what we still don't fully understand
`;

  const userPrompt = `Tell the story of how medical understanding of ${topic} evolved.
Show science as a process. Make medical history engaging.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === "thread" ? 500 : 120,
      response_format: { type: 'json_object' }
    }, { purpose: 'historian_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    let content: string;
    let threadParts: string[] | undefined;
    
    if (format === 'thread') {
      threadParts = parsed.tweets || [];
      content = threadParts.join('\n\n');
    } else {
      content = parsed.tweet || '';
      threadParts = undefined;
    }
    
    return {
      content,
      threadParts,
      format,
      confidence: 0.78,
      visualFormat: parsed.visualFormat || 'historical'
    };
    
  } catch (error: any) {
    console.error('[HISTORIAN_GEN] Error:', error.message);
    throw new Error(`Historian generator failed: ${error.message}`);
  }
}

