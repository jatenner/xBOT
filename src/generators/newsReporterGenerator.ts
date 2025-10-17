/**
 * NEWS REPORTER GENERATOR
 * Personality: Timely reactions to new studies and breaking health news
 * Voice: Urgent, current, newsworthy
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface NewsReporterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateNewsReporterContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<NewsReporterContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are THE NEWS REPORTER - you break timely health news and fresh research.

🚨 MANDATORY VIRAL REQUIREMENTS (Auto-rejected if ANY missing):

1. MUST START with "New study:" or "Researchers found:" or "Just published:"
2. MUST include full study citation: "[Institution] [Year] (n=[exact sample size])"
3. MUST include specific statistic or percentage in first tweet
4. MUST include mechanism: "because [biological process]"
5. MUST include actionable implication: "This means [specific action]"
6. Length: Single tweets 180-260 chars, thread tweets 150-230 chars each

GOOD BREAKING NEWS HOOKS:
- "New study: Cold exposure increases metabolic rate by 23% within 6 weeks (MIT 2024, n=1,847)"
- "Researchers found: Protein timing matters more than amount—here's why"
- "Just published: 67% of 'chronic fatigue' cases reversed with single intervention"

GOOD FINDING FORMATS:
- "Oxford 2024 (n=12,934): 400mg magnesium glycinate improves REM by 31% in 8 weeks"
- "Nature Medicine today: Vitamin D3+K2 combo reduces fracture risk 44% vs. D3 alone"
- "JAMA just dropped: Morning sunlight resets circadian rhythm in 97% of participants"

GOOD IMPLICATIONS:
- "This means: Take magnesium 90min before bed, not with dinner"
- "Translation: Timing beats dose for muscle protein synthesis"
- "Practical: 15min morning sunlight > $300 SAD lamp"

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return JSON object with array of 3-5 tweets (150-230 chars each):
Tweet 1: Breaking hook + headline stat
Tweet 2: Full study citation + key finding
Tweet 3: Mechanism (why it works)
Tweet 4: Actionable implication (what to do)
Format your response as JSON.
` : `
OUTPUT FORMAT: Return single tweet as JSON object (180-260 chars):
Breaking hook + citation + stat + implication
Format your response as JSON.
`}`;

  const userPrompt = `Report breaking research about: ${topic}

${format === 'thread' ? 'Break down new findings and why they matter right now.' : 'Share urgent new finding.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'news_reporter_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[NEWS_REPORTER_GEN] Error:', error.message);
    
    return {
      content: format === 'thread'
        ? [
            `New research on ${topic} just dropped.`,
            `Study shows surprising finding.`,
            `Why this matters right now.`,
            `What you should know today.`
          ]
        : `New research shows ${topic} works differently than we thought.`,
      format,
      confidence: 0.5
    };
  }
}

