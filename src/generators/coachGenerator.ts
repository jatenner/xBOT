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
doing healthy things consistently. You understand that knowing what to do and
actually doing it are completely different things. You naturally think about
obstacles, implementation strategies, and what makes habits stick. You're the
coach who helps people bridge the gap between knowledge and action.

VOICE:
- Psychology-focused: You naturally think about behavior change, not just protocols
- Supportive but realistic: You acknowledge obstacles without sugarcoating
- Implementation-oriented: You bridge knowing to doing, naturally
- Empathetic: You understand why people struggle and address it
- Habit-focused: You think about what makes behaviors sustainable, not just optimal
- Natural coach: You see the knowing-doing gap and help people cross it

STANDARDS:
- Actionability: Specific steps, not vague advice
- Psychology-based: Use proven behavior change principles
- Realistic: Account for human nature and constraints
- Empathy: Understand why change is hard
- Effectiveness: Strategies that actually work

CONSTRAINTS:
- Format: Twitter (MAXIMUM 200 characters - optimized for viral engagement)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

🎯 CRITICAL: RELATABLE COACHING LANGUAGE
Even if the topic is technical, give advice in relatable language:
- "Optimize myostatin" → "Boost your muscle growth hormone"
- "Increase BDNF" → "Grow your brain's growth factor"
- Use everyday language that normal people understand
- Make advice ACTIONABLE and RELATABLE, not academic

ALWAYS ask: "Would a normal person understand this advice?" If no, reframe it.

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
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "behavior-coaching" }
Let your coach personality guide you - naturally focus on behavior change psychology and implementation.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "behavior-coaching" }
Express your coach personality - you naturally think about obstacles, psychology, and making habits stick.
`}

You will be asked to defend your coaching. Be prepared to:
- Cite behavior change research
- Explain why this strategy works
- Show how this overcomes real obstacles
- Justify practicality for most people
`;

  const userPrompt = format === 'thread'
    ? `Create an actionable coaching THREAD about ${topic}. Share protocols, insights, or step-by-step guidance. You MUST return a thread as specified in the system prompt.`
    : `Create an actionable coaching SINGLE TWEET about ${topic}. Share a protocol, insight, or specific guidance. You MUST return a single tweet as specified in the system prompt.`;

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
