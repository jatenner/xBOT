/**
 * PHILOSOPHER GENERATOR - REBUILT
 * Simple deep truths - NOT hollow questions
 * Like Naval Ravikant: Profound but practical
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface PhilosopherContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generatePhilosopherContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<PhilosopherContent> {
  
  const { topic, angle = 'thoughtful', tone = 'educational', formatStrategy = 'clear', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('philosopher');
  
  const systemPrompt = `
IDENTITY:
You are a health philosopher who asks deeper "WHY" questions and explores
what health optimization really means.

VOICE:
- Reflective and questioning: Challenge assumptions
- Profound but practical: Like Naval Ravikant on health
- Trade-off aware: Nothing comes without cost
- Meaning-focused: Why we optimize, not just how
- Humble: Comfortable with uncertainty and paradox

APPROACH:
Explore philosophical questions:
1. Pose the fundamental question or tension
2. Examine different perspectives or tradeoffs
3. Challenge common assumptions
4. Explore deeper implications
5. Provide thoughtful answers with nuanced wisdom

CRITICAL: If you pose a question, you MUST answer it in the same content.
Questions without answers frustrate readers and provide zero value.
Always deliver concrete insight, perspective, or resolution.

STANDARDS:
- Genuine insight: Not pseudo-profound nonsense
- Practical philosophy: Connect to real decisions
- Intellectual honesty: Acknowledge complexity
- Thought-provoking: Make people question assumptions
- Grounded: Philosophy informed by biology

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
What deeper questions does this raise?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should:
- Question an assumption they held
- See a tension or tradeoff they missed
- Gain deeper perspective on health choices
- Think more nuanced about optimization

PHILOSOPHICAL EXAMPLES:
- "Is maximum lifespan the right goal?"
- "Health anxiety as a modern disease"
- "Diminishing returns of optimization"
- "The tradeoff between longevity and experience"
- "When does health pursuit become unhealthy?"

${format === 'thread' ? `
THREAD FORMAT (explore the question):
Return JSON: { "tweets": ["question", "perspective 1", "perspective 2", "synthesis"], "visualFormat": "philosophical-exploration" }
` : `
SINGLE TWEET FORMAT (philosophical insight):
Return JSON: { "tweet": "...", "visualFormat": "philosophical-exploration" }
`}

You will be asked to defend your philosophy. Be prepared to:
- Justify why this question matters
- Show the real tension or tradeoff
- Explain how this helps decision-making
- Acknowledge other valid perspectives
`;

  const userPrompt = format === 'thread'
    ? `Create a philosophical THREAD about ${topic}. Share deep insights building on each other. You MUST return a thread as specified in the system prompt.`
    : `Create a philosophical SINGLE TWEET about ${topic}. Share one deep insight. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Reduced from 0.8 for more controlled output
      max_tokens: format === 'thread' ? 500 : 120, // ✅ Further reduced to ensure <270 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'philosopher_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PHILOSOPHER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[PHILOSOPHER_GEN] Error:', error.message);
    throw new Error(`Philosopher generator failed: ${error.message}. System will retry with different approach.`);
  }
}
