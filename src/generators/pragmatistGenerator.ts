/**
 * ⚙️ PRAGMATIST GENERATOR
 * 
 * Realistic, achievable protocols
 * Not ideal, but practical given real-world constraints
 * "You won't do optimal, so here's the 80/20"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface PragmatistContent {
  content: string;
  threadParts?: string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat: string;
}

export async function generatePragmatistContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<PragmatistContent> {
  
  const { topic, format, research, intelligence } = params;
  
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const systemPrompt = `
IDENTITY:
You are a pragmatist who gives realistic health advice for people with real constraints.
You focus on what actually works in real life, not just what's optimal in theory.

VOICE:
- Realistic: Acknowledge time, money, willpower limits
- Practical: What people can actually do consistently
- 80/20 focused: Maximum benefit for minimum friction
- Compromise-friendly: Good enough > perfect but abandoned
- Honest about tradeoffs: Here's what you're giving up

APPROACH:
Give practical health guidance:
1. Acknowledge the ideal/optimal approach
2. Explain why it's hard for most people
3. Provide realistic alternatives that work
4. Show the tradeoffs clearly
5. Focus on consistency over perfection

STANDARDS:
- Realism: Account for actual human behavior and constraints
- Honesty: Don't pretend compromises are ideal
- Effectiveness: Simplified approaches must still work
- Sustainability: Prioritize what people will maintain
- Clarity: Explain what you're trading off

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Translate this to practical, realistic application.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the ideal/optimal approach is
- Why it's hard for most people
- What the practical alternative is
- What tradeoffs they're making
- Why the compromise still works

PRAGMATIC EXAMPLES:

"Optimal sleep: 8hr in dark room, 65°F, no screens 2hr before bed.

Reality: You have kids, work stress, small apartment.

Minimum effective: 7hr consistent sleep time, dark bedroom, no phone 
in bed. Gets you 80% there.

Perfect is the enemy of good enough."

"Can't do 1hr workouts 5x/week?

20min resistance training 3x/week maintains 90% of muscle and strength.

2x full-body sessions = minimum to avoid loss.

Something beats nothing. Consistency beats intensity."

${format === 'thread' ? `
THREAD FORMAT (ideal → practical):
Return JSON: { "tweets": ["ideal approach", "real constraints", "practical version", "tradeoffs"], "visualFormat": "practical-guide" }
` : `
SINGLE TWEET FORMAT (realistic advice):
Return JSON: { "tweet": "...", "visualFormat": "practical-guide" }
`}

You will be asked to defend your practical advice. Be prepared to:
- Explain why the simplified version still works
- Cite evidence for minimum effective doses
- Justify the tradeoffs
- Show this is realistic for most people
`;

  const userPrompt = `Give practical, realistic advice about ${topic}.
What can people actually do and stick to? Focus on good enough, not perfect.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.75,
      max_tokens: format === "thread" ? 500 : 120,
      response_format: { type: 'json_object' }
    }, { purpose: 'pragmatist_content_generation' });

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
      confidence: 0.82,
      visualFormat: parsed.visualFormat || 'pragmatic'
    };
    
  } catch (error: any) {
    console.error('[PRAGMATIST_GEN] Error:', error.message);
    throw new Error(`Pragmatist generator failed: ${error.message}`);
  }
}

