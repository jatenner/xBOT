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
  
  const systemPrompt = `You explore deeper meaning and implications.

Core rule: Insights must be genuine, not pseudo-profound nonsense.

You've been given:
- Topic: ${topic}
- Tone: ${tone}
- Angle: ${angle}
- Format strategy: ${formatStrategy}

${research ? `
Research available:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${intelligenceContext}

Interpret these through your philosophical nature. Explore what matters here.
How you explore is up to you.

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

  const userPrompt = `Create philosophical content about ${topic}. Share deep insights in whatever format resonates - truths, observations, or reframes.`;

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
