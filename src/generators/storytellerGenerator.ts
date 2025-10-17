/**
 * STORYTELLER GENERATOR
 * Personality: Shares real stories, case studies, narratives
 * Voice: Narrative-driven, transformation-focused, relatable
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';

export interface StorytellerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
}

export async function generateStorytellerContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
}): Promise<StorytellerContent> {
  
  const { topic, format, research } = params;
  
  const systemPrompt = `You are an EXPERT explaining how things actually work - NO FAKE PEOPLE, NO MADE-UP STORIES.

🚫 NEVER DO THIS:
❌ "Sarah struggled with hormonal imbalances..."
❌ "A person tried intermittent fasting and..."
❌ "Someone changed their diet and..."
❌ ANY fake case studies with made-up people

✅ INSTEAD, DO THIS:
✅ "Here's what actually happens when you..."
✅ "The pattern most people miss..."
✅ "Why this works for some but not others..."
✅ "The mechanism behind [phenomenon]..."

TALK ABOUT PATTERNS, NOT PEOPLE:
- "Most people do X, but the data shows Y"
- "The mechanism: [explain how it works]"
- "Why timing matters more than duration"
- "The difference between X and Y that nobody talks about"

${research ? `
REAL RESEARCH TO USE:
Finding: ${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Explain this finding - the MECHANISM, not a fake story.
` : ''}

BE SPECIFIC AND INSIGHTFUL:
- Use real data and mechanisms
- Explain WHY things work
- Compare approaches
- Reveal non-obvious connections
- Sound like an expert who actually knows this stuff

${format === 'thread' ? `
OUTPUT: Return valid JSON array of 3-5 tweets (150-250 chars each):
Tweet 1: The pattern or mechanism (what people miss)
Tweet 2: Why it works (the science/data)
Tweet 3: The key insight (what this means)
Tweet 4: The takeaway (how to think about it differently)

NO FAKE PEOPLE. Just insights and explanations.
Format your response as JSON.
` : `
OUTPUT: Return single tweet in JSON format (180-280 chars):
Explain a mechanism, pattern, or insight - NO fake people

Format your response as JSON.
`}`;

  const userPrompt = `Explain the mechanism or pattern behind: ${topic}

${format === 'thread' ? 'Break down how it works and why it matters - NO fake people or stories.' : 'Explain the key insight or mechanism - NO fake people.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === 'thread' ? 600 : 200,
      response_format: { type: 'json_object' }
    }, { purpose: 'storyteller_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.8
    };
    
  } catch (error: any) {
    console.error('[STORYTELLER_GEN] Error:', error.message);
    
    // NO FALLBACK - Throw error to force retry with different generator
    // We will NOT post fake case studies as fallback content
    throw new Error(`Storyteller generator failed: ${error.message}. System will retry with different approach.`);
  }
}

