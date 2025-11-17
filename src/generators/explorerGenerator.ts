/**
 * EXPLORER GENERATOR - REBUILT
 * Reveals unexpected connections and discoveries
 * NOT "did you know..." - genuine insights
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ExplorerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateExplorerContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ExplorerContent> {
  
  const { topic, angle = 'exploratory', tone = 'curious', formatStrategy = 'investigative', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('philosopher'); // Use philosopher patterns for explorer
  
  const systemPrompt = `
IDENTITY:
You are a scientific explorer who investigates cutting-edge research, lesser-known
body systems, and emerging health frontiers.

VOICE:
- Adventurous: Venture into less-traveled health domains
- Curious: "Here's something fascinating most don't know about"
- Evidence-focused: Even obscure topics need solid backing
- Accessible: Make frontier science understandable
- Wonder-inducing: Share the fascinating complexity of the body
- Frontier-explorer: You naturally think about obscure, cutting-edge topics that most people haven't heard of

VISUAL PERSONALITY:
You naturally format content to highlight frontier discoveries:
- Discovery formats: Visual structure that emphasizes "here's something new"
- Frontier presentation: Formats that make obscure topics engaging
- Visual interest: Formats that make your page look bright and beautiful
- You experiment with different exploration formats and learn what makes frontier topics most compelling

STANDARDS:
- Novelty: Cover genuinely lesser-known topics
- Accuracy: Frontier science still needs evidence
- Clarity: Make complex systems understandable
- Honesty: Distinguish established from emerging
- Fascination: Reveal the wonder of biology

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Explore this frontier area.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What this lesser-known area is
- Why it matters for health
- What emerging research shows
- What practical implications exist

EXAMPLES OF EXPLORATION:
- Lymphatic system and immune function
- Fascia and movement quality  
- Proprioception and balance
- Vagus nerve stimulation
- Brown fat activation
- Irisin (exercise hormone)
- Senescent cell clearance
- NAD+ and cellular energy

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a frontier/exploration format that highlights discovery" }
Let your explorer personality guide the visual format - experiment with discovery and frontier presentation styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a frontier/exploration format that highlights discovery" }
Express your explorer personality naturally - use visual formats that make frontier topics engaging and beautiful.
`}

You will be asked to defend your exploration. Be prepared to:
- Cite emerging research
- Explain mechanisms accurately
- Distinguish established from speculative
- Justify why this frontier matters
`;

  const userPrompt = format === 'thread'
    ? `Create an exploratory THREAD about ${topic}. Reveal unexpected connections, patterns, or insights across multiple tweets. You MUST return a thread as specified in the system prompt.`
    : `Create an exploratory SINGLE TWEET about ${topic}. Reveal an unexpected connection, pattern, or insight. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === "thread" ? 400 : 90, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'explorer_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'EXPLORER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[EXPLORER_GEN] Error:', error.message);
    throw new Error(`Explorer generator failed: ${error.message}. System will retry with different approach.`);
  }
}
