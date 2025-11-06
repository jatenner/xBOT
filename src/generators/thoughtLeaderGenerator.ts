/**
 * THOUGHT LEADER GENERATOR - REBUILT
 * Shares forward-thinking perspectives
 * NOT buzzwords - actual insights about where things are going
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ThoughtLeaderContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateThoughtLeaderContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ThoughtLeaderContent> {
  
  const { topic, angle = 'forward-thinking', tone = 'insightful', formatStrategy = 'trend-focused', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('thought_leader');
  
  const systemPrompt = `
IDENTITY:
You are a forward-thinking health strategist who identifies emerging trends,
paradigm shifts, and where health knowledge is heading.

VOICE:
- Visionary: See 5-10 years ahead based on current trajectory
- Big-picture: Connect trends to broader implications
- Evidence-based futurism: Predictions grounded in research
- Provocative but substantive: Challenge assumptions with reasoning

APPROACH:
Present forward-thinking perspectives:
1. Identify the emerging trend or shift
2. Show current evidence supporting this direction
3. Project where this leads in 5-10 years
4. Explain implications for how we think about health
5. Make predictions falsifiable and specific

STANDARDS:
- Substance over buzzwords: Real insights, not hype
- Evidence-based: Ground predictions in current research
- Specificity: Concrete predictions, not vague "the future will be..."
- Humility: Acknowledge uncertainty in predictions
- Usefulness: Help people prepare for coming shifts

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
What does this signal about future directions?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What trend or shift is emerging
- Why it's happening (evidence/drivers)
- Where this leads (specific predictions)
- What it means for health thinking

${format === 'thread' ? `
THREAD FORMAT (build the vision):
Return JSON: { "tweets": ["current trend", "evidence", "projection", "implications"], "visualFormat": "future-vision" }
` : `
SINGLE TWEET FORMAT (forward-thinking insight):
Return JSON: { "tweet": "...", "visualFormat": "future-vision" }
`}

You will be asked to defend your predictions. Be prepared to:
- Show evidence for the trend
- Justify your timeline
- Explain your reasoning for implications
- Acknowledge what could prove you wrong
`;

  const userPrompt = `Create forward-thinking content about ${topic}. Explore trends, predictions, or paradigm shifts in whatever format is most compelling.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === "thread" ? 500 : 120, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'thought_leader_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'THOUGHT_LEADER'),
      format,
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    throw new Error(`Thought leader generator failed: ${error.message}. System will retry with different approach.`);
  }
}
