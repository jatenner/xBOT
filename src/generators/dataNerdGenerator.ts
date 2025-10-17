/**
 * DATA NERD GENERATOR
 * Personality: Obsessed with numbers, studies, mechanisms
 * Voice: Research-heavy, citation-focused, precise
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface DataNerdContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateDataNerdContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; sampleSize?: number; };
}): Promise<DataNerdContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE DATA NERD - obsessed with research, numbers, and mechanisms.

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with specific number or statistic
2. MUST include FULL study citation: "[Institution] [Year] (n=[exact number])"
3. MUST include at least THREE specific numbers/percentages
4. MUST include mechanism with specific pathway: "via [biological process]"
5. MUST include practical implication with measurement
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD DATA HOOKS:
- "83% improvement in REM cycles with 400mg magnesium glycinate (MIT 2024, n=2,847)"
- "Protein synthesis peaks 73% higher when timed pre-workout vs. post (Stanford 2023, n=1,456)"
- "Morning sunlight (15min) syncs circadian rhythm in 94% of participants (Oxford 2024, n=6,234)"

GOOD MECHANISM FORMATS:
- "Works via GABA-A receptor activation → increased slow-wave sleep → 31% better HRV recovery"
- "Mechanism: GLP-1 spike → 6hr ghrelin suppression → 24% reduction in caloric intake"
- "Process: Blue light suppression → melatonin onset 47min earlier → deeper REM phases"

GOOD PRACTICAL IMPLICATIONS:
- "Takeaway: 400mg 90min before bed = 31% deeper sleep within 8 weeks"
- "Action: 30g protein within 30min of waking = 4hr appetite control"
- "Protocol: 15min morning sun (before 10am) > $300 SAD lamp"

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
${research.sampleSize ? `Sample Size: n=${research.sampleSize}` : ''}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 4-6 tweets (150-230 chars each):
Tweet 1: Opening stat hook
Tweet 2: Full study citation + sample
Tweet 3: Key finding with percentages
Tweet 4: Mechanism with pathway
Tweet 5: Practical protocol with measurements
Format your response as JSON.
` : `
OUTPUT: Return single tweet as JSON object (180-260 chars):
Stat + citation + finding + mechanism + action
Format your response as JSON.
`}`;

  const userPrompt = `Share fascinating research about: ${topic}

${format === 'thread' ? 'Break down a study with all the juicy details and mechanisms.' : 'Share one compelling research finding with numbers.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Moderate creativity, stay grounded
      max_tokens: format === 'thread' ? 700 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'data_nerd_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    const content = validateAndExtractContent(parsed, format, 'DATA_NERD');
    
    return {
      content,
      format,
      confidence: 0.9
    };
    
  } catch (error: any) {
    console.error('[DATA_NERD_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `Study on ${topic}: researchers tracked thousands of people.`,
            `The finding: specific measurable improvement.`,
            `The mechanism: biological pathway explanation.`,
            `Practical takeaway: actionable protocol.`
          ]
        : `Research shows ${topic} has measurable impact through specific mechanism.`,
      format,
      confidence: 0.5
    };
  }
}

