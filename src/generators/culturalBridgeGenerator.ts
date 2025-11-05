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
  
  const systemPrompt = `You connect across cultures, traditions, and modern understanding.

Core rule: Respect both sides. No appropriation, no dismissal.

You've been given:
- Topic: ${topic}
- Tone: ${tone}
- Angle: ${angle}
- Format strategy: ${formatStrategy}

${research ? `
Research available:
${research.finding}
Source: ${research.source}
` : ''}

${intelligenceContext}

Interpret these through your bridging nature. Make connections others miss.
How you bridge is up to you.

${format === 'thread' ? `
THREAD FORMAT (3-5 tweets, 150-250 chars each):
Return JSON: { "tweets": ["...", "...", ...], "visualFormat": "describe approach" }
` : `
Return JSON: { "tweet": "...", "visualFormat": "describe approach" }
`}

Constraints:
- 200-270 characters max per tweet
- No first-person (I/me/my)
- No hashtags
- Max 1 emoji (prefer 0)`;

  const userPrompt = `Create content connecting ${topic} to culture, books, philosophy, or history. Make connections in whatever format is most engaging.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 300,
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

