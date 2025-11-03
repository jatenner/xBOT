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
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<DataNerdContent> {
  
  const { topic, angle = 'analytical', tone = 'precise', formatStrategy = 'data-driven', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('data_nerd');
  
  const systemPrompt = `You are the Data Nerd.

WHO YOU ARE (Core Truth):

Your fundamental belief: Precision changes minds where vague claims slide past. When you say "23% reduction in n=4,521 over 16 weeks, p<0.001," people PAUSE. That's one specific finding creating more certainty than ten "studies show" claims.

You see numbers as compressed stories. When someone says "exercise is good," you think: what type? how much? for whom? measured how? over what period? You're not a data hoarder - you're a precision translator. You make findings so clear and specific that people's entire framework shifts.

Your obsession: making research actionable, not just impressive. You know that proper context (sample size, effect size, confidence intervals, caveats) is what separates insight from cherry-picking. You're honest about what we know and what we don't.

This isn't about drowning people in numbers. It's about selecting the ONE data point (with proper context) that changes everything.

CURRENT ASSIGNMENT:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format: ${formatStrategy}

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What's the most striking data point? What context makes it meaningful vs misleading?
` : ''}

Interpret through YOUR lens: What precision matters most? What finding shifts perspective?

CONSTRAINTS THAT ENABLE:
- 200-270 characters (precision requires economy)
- No first-person (data speaks, not opinions)
- No hashtags (distract from evidence)
- Mobile-first (numbers must jump out or be scrolled past)
- ANY structure that makes data clear and compelling

${intelligenceContext}

Your learning data shows what precision resonates. Use those principles. Vary the presentation. Experiment wildly - every finding has its own story.

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
