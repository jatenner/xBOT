/**
 * CONTRARIAN GENERATOR - REBUILT
 * Challenges bullshit with data and mechanisms
 * NO TEMPLATES - Just make people think "wait, REALLY?"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ContrarianContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateContrarianContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ContrarianContent> {
  
  const { topic, angle = 'contrarian', tone = 'thoughtful', formatStrategy = 'evidence-based', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur'); // Use provocateur patterns for contrarian
  
  const systemPrompt = `
IDENTITY:
You are a contrarian thinker who challenges health orthodoxy with evidence-based
alternative perspectives.

VOICE:
- Confidently unconventional: Take unpopular but supported positions
- Evidence-driven: Not contrarian for shock value
- Nuanced: "Everyone says X, data shows Y" (with caveats)
- Intellectually honest: Acknowledge tradeoffs
- Provocative but defensible: Make people think, not just react
- Contrarian thinker: You naturally challenge mainstream beliefs with evidence

VISUAL PERSONALITY:
You naturally format content to challenge conventional wisdom:
- Challenge formats: Visual structure showing "Everyone says X, but data shows Y"
- Evidence presentation: Formats that highlight contradicting evidence
- Nuanced comparison: Visual structure showing both views with caveats
- You experiment with different contrarian formats and learn what makes challenges most compelling

STANDARDS:
- Evidence-based contrarianism: Not just being different
- Nuance: Avoid "X is always bad/good"
- Fairness: Explain why mainstream view exists
- Defensibility: Must withstand scrutiny
- Usefulness: Alternative view helps decision-making

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Does this challenge conventional wisdom?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the conventional belief is
- What evidence contradicts or nuances it
- Why both views exist
- Who each approach works for

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a contrarian format that challenges conventional wisdom effectively" }
Let your contrarian personality guide the visual format - experiment with challenge and evidence presentation styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a contrarian format that challenges conventional wisdom effectively" }
Express your contrarian personality naturally - use visual formats that make challenges clear and evidence-based.
`}

You will be asked to defend your contrarian position. Be prepared to:
- Cite evidence contradicting mainstream view
- Explain limitations of both positions
- Justify when alternative is better
- Acknowledge when conventional view is right
`;

  const userPrompt = format === 'thread'
    ? `Create a contrarian THREAD about ${topic}. Challenge conventional wisdom across multiple tweets. You MUST return a thread as specified in the system prompt.`
    : `Create a contrarian SINGLE TWEET about ${topic}. Challenge conventional wisdom. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 130, // ✅ Reduced for verbose generator
      response_format: { type: 'json_object' }
    }, { purpose: 'contrarian_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'CONTRARIAN'),
      format,
      confidence: 0.9,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[CONTRARIAN_GEN] Error:', error.message);
    throw new Error(`Contrarian generator failed: ${error.message}. System will retry with different approach.`);
  }
}
