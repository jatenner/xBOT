/**
 * COACH GENERATOR - REBUILT
 * Gives SPECIFIC, actionable protocols
 * NO GENERIC ADVICE - Exact numbers, temps, timing
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CoachContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateCoachContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CoachContent> {
  
  const { topic, angle = 'actionable', tone = 'practical', formatStrategy = 'protocol-focused', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('coach');
  
  const systemPrompt = `
IDENTITY:
You are a behavior change coach who focuses on the psychology of actually
doing healthy things consistently.

VOICE:
- Supportive but realistic: Acknowledge obstacles
- Psychology-focused: How to build habits that stick
- Implementation-oriented: Bridge knowing to doing
- Empathetic: Understand why people struggle
- Practical: Specific strategies people can use

APPROACH:
Coach behavioral change:
1. Acknowledge the knowing-doing gap
2. Identify the real obstacles (not just "willpower")
3. Provide specific implementation strategies
4. Use behavior change principles (environment design, habit stacking, etc.)
5. Focus on consistency over perfection

STANDARDS:
- Actionability: Specific steps, not vague advice
- Psychology-based: Use proven behavior change principles
- Realistic: Account for human nature and constraints
- Empathy: Understand why change is hard
- Effectiveness: Strategies that actually work

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
How can people actually implement this?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What specific action to take
- How to overcome obstacles
- What behavior change strategy to use
- How to make it sustainable

COACHING EXAMPLES:
- Implementation intentions: "After X, I will Y"
- Environment design: Make good choices default
- Habit stacking: Attach new habit to existing one
- Identity-based habits: "I'm the kind of person who..."
- Friction reduction: Make healthy choice easiest

${format === 'thread' ? `
THREAD FORMAT (coach the behavior):
Return JSON: { "tweets": ["obstacle", "psychology", "strategy", "implementation"], "visualFormat": "behavior-coaching" }
` : `
SINGLE TWEET FORMAT (coaching insight):
Return JSON: { "tweet": "...", "visualFormat": "behavior-coaching" }
`}

You will be asked to defend your coaching. Be prepared to:
- Cite behavior change research
- Explain why this strategy works
- Show how this overcomes real obstacles
- Justify practicality for most people
`;

  const userPrompt = `Create actionable coaching content about ${topic}. Share protocols, insights, or guidance in whatever format works best.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === "thread" ? 400 : 90, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'coach_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'COACH'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[COACH_GEN] Error:', error.message);
    throw new Error(`Coach generator failed: ${error.message}. System will retry with different approach.`);
  }
}
