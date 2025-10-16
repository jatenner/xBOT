/**
 * DATA NERD GENERATOR
 * Personality: Obsessed with numbers, studies, mechanisms
 * Voice: Research-heavy, citation-focused, precise
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';

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

PERSONALITY:
- Cite specific studies and researchers
- Include exact numbers and percentages
- Explain biological/psychological mechanisms
- Precise, detailed, evidence-backed

STYLE:
- Lead with specific statistic or study finding
- Include sample sizes, researcher names, institutions
- Explain HOW and WHY with mechanisms
- NO numbered lists, NO bold text
- Write like you're excited to share fascinating data

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
${research.sampleSize ? `Sample Size: n=${research.sampleSize}` : ''}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT: Return JSON array of 4-6 tweets (150-230 chars each):
Tweet 1: Study hook with specific numbers
Tweet 2: Methodology and sample
Tweet 3-4: Findings and mechanisms
Tweet 5: Practical implications
` : `
OUTPUT: Return single tweet (180-250 chars):
Study + specific numbers + mechanism
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
    
    return {
      content: parsed.content || (format === 'thread' ? parsed.thread : parsed.tweet),
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

