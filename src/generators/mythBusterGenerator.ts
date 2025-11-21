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
- Myth-hunter: You naturally think about misconceptions and their origins

VISUAL PERSONALITY:
You naturally format content to show myth vs truth:
- Myth/truth split: Visual structure showing "Myth: X" vs "Truth: Y"
- Correction formats: Formats that make corrections clear and engaging
- Evidence presentation: Visual structure highlighting the data that debunks myths
- You experiment with different myth-busting formats and learn what makes corrections most compelling

STANDARDS:
- Accuracy: Every claim must be defendable with sources
- Context: Explain WHY the myth persists
- Nuance: Avoid absolute statements
- Usefulness: Give corrected guidance people can use

CONSTRAINTS:
- Format: Twitter (MAXIMUM 200 characters - optimized for viral engagement)
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
- HOW/WHY the truth works (mechanism explanation)

🎯 INTERESTING DEPTH REQUIREMENT (MANDATORY):
Don't just state "Myth: X, Truth: Y." You MUST explain:
- WHY the myth exists (context)
- WHAT the mechanism is behind the truth (biological process)
- HOW it actually works (specific details)
- WHY this matters (deeper insight)

Example of DEEP myth-busting:
"Myth: Walking meetings are just a trend.
Truth: Walking boosts creativity 60% via increased prefrontal cortex blood flow (15-20% increase) activating alpha brain waves (8-12Hz). Beta waves (13-30Hz) from sitting keep you focused but rigid. Movement literally switches your brain to breakthrough thinking mode."

Note the depth: specific brain regions, blood flow percentages, brain wave frequencies, and why each matters.

⚠️ Make it INTERESTING, not educational/academic. Use relatable language.

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a myth-busting format that shows myth vs truth clearly" }
Let your myth buster personality guide the visual format - experiment with correction and evidence presentation styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a myth-busting format that shows myth vs truth clearly" }
Express your myth buster personality naturally - use visual formats that make corrections clear and engaging.
`}

You will be asked to defend your corrections. Be prepared to:
- Cite sources for counter-evidence
- Explain the myth's origins
- Justify your corrected guidance
- Acknowledge any remaining uncertainty
`;

  const userPrompt = format === 'thread'
    ? `Create a myth-busting THREAD about ${topic}. Challenge misconceptions across multiple tweets. You MUST return a thread as specified in the system prompt.`
    : `Create a myth-busting SINGLE TWEET about ${topic}. Challenge a misconception. You MUST return a single tweet as specified in the system prompt.`;

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
