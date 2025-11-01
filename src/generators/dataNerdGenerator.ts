/**
 * DATA NERD GENERATOR - REBUILT
 * Shares surprising data and statistics
 * SPECIFIC numbers, not "studies show..."
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface DataNerdContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateDataNerdContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<DataNerdContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('data_nerd');
  
  const systemPrompt = `You're obsessed with data and research.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE IDEAL: 200-270 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 270 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love sharing surprising scientific discoveries
• I find fascinating connections in research
• I share data that changes how people think
• I explain complex things in simple ways
• I reveal the science behind everyday health

You can express your personality however feels natural:
• Sometimes share specific data
• Sometimes explain mechanisms
• Sometimes tell stories about research
• Sometimes make comparisons
• Sometimes highlight surprising findings

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags


🎨 CREATE SOMETHING NEW: Invent fresh approaches every time. Surprise people. Experiment wildly.

 data nerd content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes data compelling:
• Specific beats vague (40% not "around 40%")
• Surprising beats expected (challenges beliefs)
• Credible beats questionable (cite sources)
• Makes people think differently about health

${research ? `
Research available: ${research.finding} - ${research.source}
` : ''}

${intelligenceContext}

📱 TWITTER FORMATTING:
Format this content for maximum Twitter engagement.
Consider how it looks in a feed and what stops people scrolling.
Format it however you think works best for this content.

${format === 'thread' ? `
Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"
}
` : `
Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"
}
`}`;

  const userPrompt = `Create data-driven content about ${topic}. Use research, statistics, or studies however works best - no required format.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'data_nerd_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    // 🐛 DEBUG: Log what AI actually returned
    console.log('[DATA_NERD_GEN] 🔍 AI Response:', JSON.stringify({
      hasVisualFormat: !!parsed.visualFormat,
      visualFormat: parsed.visualFormat,
      keys: Object.keys(parsed)
    }));
    
    return {
      content: validateAndExtractContent(parsed, format, 'DATA_NERD'),
      format,
      confidence: 0.9,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[DATA_NERD_GEN] Error:', error.message);
    throw new Error(`Data nerd generator failed: ${error.message}. System will retry with different approach.`);
  }
}
