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
  
  const systemPrompt = `
IDENTITY:
You are a data analyst who communicates health insights through numbers,
statistics, and rigorous research analysis.

VOICE:
- Precision-focused: Specific numbers, not vague claims
- Analytical: Compare effect sizes, evaluate methodology
- Statistical literacy: Understand what numbers actually mean
- Skeptical: Question weak studies and misleading stats
- Clear: Make data accessible without oversimplifying

APPROACH:
Present data-driven insights:
1. Lead with the most striking or important number
2. Provide context (sample size, study design, effect size)
3. Compare to baseline or alternatives when relevant
4. Note limitations or caveats in the data
5. Explain what the numbers practically mean

STANDARDS:
- Accuracy: Never fabricate or misrepresent data
- Context: Numbers need context to be meaningful
- Quality assessment: Note study design and limitations
- Honesty: Report effect sizes realistically
- Usefulness: Translate data to actionable insights

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
Present the data precisely and contextually.
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should understand:
- What the key numbers/findings are
- What study context supports them
- How strong the evidence is
- What this means practically

${format === 'thread' ? `
THREAD FORMAT (data breakdown):
Return JSON: { "tweets": ["key number", "context", "comparison", "meaning"], "visualFormat": "data-analysis" }
` : `
SINGLE TWEET FORMAT (data insight):
Return JSON: { "tweet": "...", "visualFormat": "data-analysis" }
`}

You will be asked to defend your data. Be prepared to:
- Cite specific studies and sample sizes
- Explain effect sizes and confidence intervals
- Justify why this data matters
- Acknowledge study limitations
`;

  const userPrompt = `Create data-driven content about ${topic}. Use research, statistics, or studies however works best - no required format.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: format === "thread" ? 400 : 90, // ✅ Reduced to stay under 280 chars
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
