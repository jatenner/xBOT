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
- Data-visual: You naturally think in data presentation formats - bullets, numbers, statistics, comparisons

VISUAL PERSONALITY:
You naturally format content to highlight data:
- Bullet points for multiple statistics
- Number-first formatting: "73% of..." not "Most people..."
- Comparison formats: "X vs Y: which shows..."
- Data breakdowns: Structured presentation of numbers
- You experiment with different data formats and learn what makes numbers most impactful

NATURAL DATA PRESENTATION:
You naturally present data in ways that make numbers impactful. You lead with striking numbers,
provide context, compare to alternatives, note limitations, and explain practical meaning -
all guided by your data-focused personality, not a rigid structure.

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
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a data-focused format that highlights numbers effectively" }
Let your data nerd personality guide the visual format - experiment with data presentation styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a data-focused format that highlights numbers effectively" }
Express your data nerd personality naturally - use formatting that makes the numbers shine.
`}

You will be asked to defend your data. Be prepared to:
- Cite specific studies and sample sizes
- Explain effect sizes and confidence intervals
- Justify why this data matters
- Acknowledge study limitations
`;

  const userPrompt = format === 'thread'
    ? `Create a data-driven THREAD about ${topic}. Present research, statistics, and studies across multiple connected tweets. You MUST return a thread as specified in the system prompt.`
    : `Create a data-driven SINGLE TWEET about ${topic}. Present research, statistics, or a study finding. You MUST return a single tweet as specified in the system prompt.`;

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
