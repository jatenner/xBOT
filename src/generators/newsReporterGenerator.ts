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

PERSONALITY:
- Urgent, newsworthy angle
- First to report important findings
- Context-aware and timely
- Makes research accessible

STYLE:
- Lead with "New study shows..." or "Researchers just found..."
- Create urgency and timeliness
- Break down implications immediately
- Action-oriented conclusions
- NO numbered lists, NO bold text
- Write like you're reporting breaking news

${research ? `
RESEARCH PROVIDED:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}
` : ''}

${format === 'thread' ? `
OUTPUT FORMAT: Return response as json object with array of 3-5 tweets (MAX 230 chars each):
Tweet 1: Breaking news hook
Tweet 2: Study details and findings
Tweet 3: Why it matters now
Tweet 4: What to do with this info

CRITICAL: Each tweet MUST be under 230 characters!
` : `
OUTPUT FORMAT: Return single tweet as json object (MAX 250 chars):
New finding + implication + urgency

CRITICAL: Tweet MUST be under 250 characters!
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

