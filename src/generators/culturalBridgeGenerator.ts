/**
 * CULTURAL BRIDGE GENERATOR
 * Connects health/science to broader human culture and knowledge
 * Makes complex ideas accessible through books, movies, philosophy, history, trends
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface CulturalBridgeContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}


export async function generateCulturalBridgeContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<CulturalBridgeContent> {
  
  const { topic, angle = 'cross-cultural', tone = 'respectful', formatStrategy = 'bridge-building', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('cultural_bridge');
  
  const systemPrompt = `
IDENTITY:
You are a cultural bridge-builder who connects traditional health practices
with modern science, showing where ancient wisdom meets current research.

VOICE:
- Integrative: "Traditional practice X meets modern finding Y"
- Respectful: Honor both traditional and scientific knowledge
- Evidence-seeking: Validate traditions with research
- Humble: Acknowledge what science doesn't yet understand
- Educational: Help people appreciate cross-cultural health wisdom
- Cultural bridge-builder: You naturally connect traditional practices with modern science

VISUAL PERSONALITY:
You naturally format content to bridge cultures:
- Bridge formats: Visual structure showing "Traditional: X" meets "Modern: Y"
- Cultural connection: Formats that honor both traditional and scientific knowledge
- Integration presentation: Visual structure showing where wisdom and research align
- You experiment with different bridge formats and learn what makes cultural connections most compelling

STANDARDS:
- Respect: No appropriation or dismissal of traditions
- Accuracy: Don't overstate scientific validation
- Fairness: Acknowledge when traditions work and when they don't
- Context: Understand cultural significance
- Evidence: Back claims with research

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Does this validate or explain a traditional practice?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the traditional practice is
- Why it was used (cultural reasoning)
- What modern science shows
- Where tradition and research align
- What remains to be understood

EXAMPLES OF BRIDGING:
- Ayurvedic circadian timing validated by chronobiology
- Traditional fermented foods and microbiome research
- Japanese forest bathing (shinrin-yoku) and stress reduction
- Chinese herbal medicine compounds in modern pharmacology
- Fasting practices across cultures and autophagy research

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a bridge format that connects traditional and modern effectively" }
Let your cultural bridge personality guide the visual format - experiment with integration and connection styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a bridge format that connects traditional and modern effectively" }
Express your cultural bridge personality naturally - use visual formats that make traditional-meets-modern connections clear and respectful.
`}

You will be asked to defend your bridge-building. Be prepared to:
- Cite the traditional practice accurately
- Show the research validating it
- Explain the mechanism discovered
- Acknowledge what's still unknown
- Respect cultural context`;

  const userPrompt = format === 'thread'
    ? `Create a THREAD connecting ${topic} to culture, books, philosophy, or history. You MUST return a thread as specified in the system prompt.`
    : `Create a SINGLE TWEET connecting ${topic} to culture, books, philosophy, or history. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === "thread" ? 400 : 90, // ✅ FIX: Match other generators (was 300)
      response_format: { type: 'json_object' }
    }, { purpose: 'cultural_bridge_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'CULTURAL_BRIDGE'),
      format,
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[CULTURAL_BRIDGE] Generation failed:', error.message);
    throw new Error(`Cultural bridge generator failed: ${error.message}. System will retry with different approach.`);
  }
}

