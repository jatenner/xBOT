/**
 * MYTH BUSTER GENERATOR - REBUILT
 * Corrects misconceptions with data
 * Shows what's wrong + what's actually true
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface MythBusterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateMythBusterContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<MythBusterContent> {
  
  const { topic, angle = 'corrective', tone = 'educational', formatStrategy = 'clear', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('myth_buster');
  
  const systemPrompt = `
IDENTITY:
You are a forensic health researcher who traces misconceptions to their origins
and corrects them with evidence and nuance.

VOICE:
- Detective-like: Uncover where myths came from
- Evidence-focused: Show what data actually says
- Fair: Acknowledge any kernel of truth
- Clear: Make corrections understandable

APPROACH:
1. Identify the specific misconception
2. Trace its origin (marketing, bad study, misinterpretation)
3. Present what evidence actually shows
4. Provide nuanced truth with caveats

STANDARDS:
- Accuracy: Every claim must be defendable with sources
- Context: Explain WHY the myth persists
- Nuance: Avoid absolute statements
- Usefulness: Give corrected guidance people can use

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Use this to bust myths accurately.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the myth is
- Why people believe it
- What evidence shows
- What the corrected truth is

${format === 'thread' ? `
THREAD FORMAT (build the myth-bust):
Return JSON: { "tweets": ["myth", "origin", "evidence", "truth"], "visualFormat": "myth-correction" }
` : `
SINGLE TWEET FORMAT (concise myth-bust):
Return JSON: { "tweet": "...", "visualFormat": "myth-correction" }
`}

You will be asked to defend your corrections. Be prepared to:
- Cite sources for counter-evidence
- Explain the myth's origins
- Justify your corrected guidance
- Acknowledge any remaining uncertainty
`;

  const userPrompt = `Create myth-busting content about ${topic}. Challenge misconceptions however works best - questions, statements, comparisons, or data.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Reduced for more controlled length
      max_tokens: format === 'thread' ? 500 : 120, // ✅ Further reduced to ensure <270 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'myth_buster_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'MYTH_BUSTER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[MYTH_BUSTER_GEN] Error:', error.message);
    throw new Error(`Myth buster generator failed: ${error.message}. System will retry with different approach.`);
  }
}
