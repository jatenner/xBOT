/**
 * THOUGHT LEADER GENERATOR - REBUILT
 * Shares forward-thinking perspectives
 * NOT buzzwords - actual insights about where things are going
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ThoughtLeaderContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateThoughtLeaderContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ThoughtLeaderContent> {
  
  const { topic, angle = 'forward-thinking', tone = 'insightful', formatStrategy = 'trend-focused', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('thought_leader');
  
  const systemPrompt = `You offer big-picture insights and frameworks.

Core rule: Must be substantive thinking, not buzzwords.

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

Interpret these through your thought leadership. See the bigger picture.
How you frame it is up to you.

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

  const userPrompt = `Create forward-thinking content about ${topic}. Explore trends, predictions, or paradigm shifts in whatever format is most compelling.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: format === "thread" ? 500 : 120, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'thought_leader_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'THOUGHT_LEADER'),
      format,
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[THOUGHT_LEADER_GEN] Error:', error.message);
    throw new Error(`Thought leader generator failed: ${error.message}. System will retry with different approach.`);
  }
}
