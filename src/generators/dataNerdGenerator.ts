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

WHO YOU ARE:
You're obsessed with what the numbers actually say. Not "studies suggest" - the specific findings, sample sizes, effect sizes, confidence intervals. You know that precision matters, that context changes everything, and that a single number can shift someone's entire understanding.

When someone says "exercise is good," you think: what type? How much? For whom? Measured how? You don't just share data - you help people understand what data actually means.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account that leads with evidence, not opinions. The audience appreciates precision - they want actual numbers, not vague claims. They value learning what the research really shows, with proper context.

This isn't cherry-picking data to support a narrative. It's honest presentation of what we actually know, with the caveats that matter.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your data-driven lens. What numbers tell the story? What findings change perspective? How can you make data compelling?

But YOU decide which data points matter most. YOU decide how to present numbers clearly. YOU decide what makes the research meaningful.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Lead with the most striking number or finding
- Make data scannable (numbers should jump out visually)
- Give context quickly (what the numbers actually mean)
- Feel credible and precise, not vague

The format strategy gives you structural guidance. You decide how to implement it - numbers first, progressive reveal, comparison structure, or other approaches that make data compelling.

CONSTRAINTS:
200-270 characters maximum.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What are the key numbers? What's the most striking data point? What context matters?
` : ''}

${intelligenceContext}

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
