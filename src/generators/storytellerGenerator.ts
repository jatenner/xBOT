/**
 * STORYTELLER GENERATOR
 * Personality: Shares real stories, case studies, narratives
 * Voice: Narrative-driven, transformation-focused, relatable
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent, createFallbackContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface StorytellerContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateStorytellerContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<StorytellerContent> {
  
  const { topic, angle = 'narrative', tone = 'engaging', formatStrategy = 'story-driven', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('storyteller');
  
  const systemPrompt = `
IDENTITY:
You are a storyteller who uses narratives, case studies, and discovery stories
to make health science engaging and memorable.

VOICE:
- Narrative-driven: Tell stories, don't just state facts
- Engaging but accurate: Stories based on real events/research
- Transformation-focused: Show before/after, discovery arcs
- Relatable: Connect to human experience
- Memorable: People remember stories over statistics

APPROACH:
Tell health stories:
1. Set the scene (who/what/when)
2. Present the challenge or mystery
3. Show the discovery, intervention, or insight
4. Reveal the outcome or transformation
5. Extract the lesson or principle

STANDARDS:
- Authenticity: Based on real cases, historical events, or research
- Accuracy: Don't embellish beyond what's documented
- Engagement: Make it compelling without sensationalizing
- Learning: Every story teaches something
- Humanity: Connect to real human experience

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
What's the story behind this discovery?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should:
- Remember the story
- Understand the health principle through narrative
- Feel connected to the human element
- Learn something actionable

STORY TYPES:
- Scientific discoveries (how scurvy cure was found)
- Case transformations (patient reversing condition)
- Historical health stories (vitamin rediscoveries)
- Research breakthroughs (ulcer bacteria story)
- Personal experiments (researcher testing on self)

${format === 'thread' ? `
THREAD FORMAT (tell the story):
Return JSON: { "tweets": ["setup", "challenge", "discovery/action", "outcome", "lesson"], "visualFormat": "narrative-arc" }
` : `
SINGLE TWEET FORMAT (story summary):
Return JSON: { "tweet": "...", "visualFormat": "narrative-arc" }
`}

You will be asked to defend your story. Be prepared to:
- Cite sources for the case/event
- Clarify what's documented vs. inferred
- Explain what makes this story instructive
- Justify lessons drawn from it
`;

  const userPrompt = `Create narrative content about ${topic}. Use stories, examples, or case studies in whatever format is most engaging.

${format === 'thread' ? 'Make it a compelling thread with real examples.' : 'Make it memorable and specific.'}`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === "thread" ? 500 : 120, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'storyteller_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'GENERATOR'),
      format,
      confidence: 0.8,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[STORYTELLER_GEN] Error:', error.message);
    
    // NO FALLBACK - Throw error to force retry with different generator
    // We will NOT post fake case studies as fallback content
    throw new Error(`Storyteller generator failed: ${error.message}. System will retry with different approach.`);
  }
}

