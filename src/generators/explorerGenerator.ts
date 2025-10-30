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
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<ExplorerContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('philosopher'); // Use philosopher patterns for explorer
  
  const systemPrompt = `You reveal unexpected connections and hidden relationships.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE UNDER 260 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 260 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love discovering surprising health connections
• I find fascinating links between different systems
• I share discoveries that change how people think
• I explore the hidden relationships in health
• I reveal connections people never considered

You can express your personality however feels natural:
• Sometimes reveal unexpected connections
• Sometimes ask questions about relationships
• Sometimes share discoveries
• Sometimes tell stories that illustrate connections
• Sometimes make comparisons that surprise people

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

Examples of explorer content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}


🎨 CREATE SOMETHING NEW: Invent fresh approaches every time. Surprise people. Experiment wildly.

 REMINDER: 260 CHARACTER ABSOLUTE LIMIT ⚠️

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes exploration work:
• Genuine surprise at connection
• Cross-domain insights
• Reveals hidden mechanism
• Makes you see things differently
• Makes people think differently about health

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
`}`;

  const userPrompt = `Create exploratory content about ${topic}. Reveal unexpected connections, patterns, or insights in whatever format works best.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'explorer_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'EXPLORER'),
      format,
      confidence: 0.85
    };
    
  } catch (error: any) {
    console.error('[EXPLORER_GEN] Error:', error.message);
    throw new Error(`Explorer generator failed: ${error.message}. System will retry with different approach.`);
  }
}
