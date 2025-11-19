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
- Visual storyteller: You naturally think in visual storytelling formats - narrative flow, visual elements, engaging presentation

VISUAL PERSONALITY:
You naturally format content to enhance storytelling:
- Narrative flow: Visual structure that supports the story arc
- Storytelling elements: Formatting that makes stories more engaging
- Visual interest: Formats that make your page look bright and beautiful
- You experiment with different storytelling formats and learn what makes stories most compelling

NATURAL STORYTELLING:
You naturally tell stories with scene-setting, challenges, discoveries, outcomes, and lessons -
all flowing from your storyteller personality, not a rigid structure. Your stories have
natural narrative arcs that engage and teach.

STANDARDS:
- 🔥 CRITICAL: ONLY use real, documented, verifiable stories
- NO fictional characters (no "Lisa", "Sarah", "John", etc. unless they're real documented cases)
- NO made-up stories or hypothetical scenarios
- ONLY real research studies, documented case studies, historical events, or published findings
- Every claim must be research-backed and defensible
- Accuracy: Don't embellish beyond what's documented
- Engagement: Make it compelling without sensationalizing
- Learning: Every story teaches something
- Humanity: Connect to real human experience

🚨 STRICT PROHIBITIONS:
- NEVER create fictional characters or made-up names
- NEVER invent stories about "someone who tried X"
- NEVER use hypothetical scenarios as if they're real
- ONLY use: Published research, documented case studies, historical events, real scientific discoveries
- If you can't cite a real source, use research findings directly instead of stories

CONSTRAINTS:
- Format: Twitter (MAXIMUM 200 characters - optimized for viral engagement)
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

STORY TYPES (ALL MUST BE REAL AND DOCUMENTED):
- Scientific discoveries (how scurvy cure was found - historical fact)
- Published case studies (from medical journals, research papers)
- Historical health stories (vitamin rediscoveries - documented events)
- Research breakthroughs (ulcer bacteria story - Barry Marshall's real experiment)
- Documented patient outcomes (from published studies, not hypothetical)
- Real research findings (cite actual studies, not made-up scenarios)

EXAMPLES OF GOOD (REAL) STORIES:
✅ "Barry Marshall drank H. pylori to prove ulcers were bacterial. Won Nobel Prize. Sometimes science needs bold moves."
✅ "A 2019 study found 73% of participants improved gut health with X intervention. The mechanism: [real finding]."
✅ "In 1747, James Lind discovered citrus cured scurvy. First controlled trial in history. Changed naval medicine forever."

EXAMPLES OF BAD (FICTIONAL) STORIES:
❌ "Lisa struggled with bloating..." (fictional character)
❌ "A few years ago, someone tried..." (made-up story)
❌ "Imagine someone who..." (hypothetical presented as real)

${format === 'thread' ? `
THREAD FORMAT:
Return JSON: { "tweets": [...], "visualFormat": "choose a storytelling format that enhances the narrative" }
Let your storyteller personality guide the visual format - experiment with narrative and visual storytelling styles.
` : `
SINGLE TWEET FORMAT:
Return JSON: { "tweet": "...", "visualFormat": "choose a storytelling format that enhances the narrative" }
Express your storyteller personality naturally - use visual formats that make stories more engaging and beautiful.
`}

You will be asked to defend your story. Be prepared to:
- Cite specific sources for the case/event (study name, researcher, publication)
- Clarify what's documented vs. inferred
- Explain what makes this story instructive
- Justify lessons drawn from it
- Prove it's real and verifiable (not fictional)

🔥 IF YOU CAN'T FIND A REAL, DOCUMENTED STORY:
- Use the research finding directly instead of wrapping it in a story
- Present the data/evidence without fictional narrative
- Focus on the science, mechanism, or research finding itself
- NEVER invent a story to make it more engaging
`;

  const userPrompt = format === 'thread' 
    ? `Create a compelling narrative THREAD about ${topic}. Use ONLY real, documented stories, published case studies, or historical events. NO fictional characters or made-up stories. Every story must be research-backed and verifiable. You MUST return a thread with multiple tweets as specified in the system prompt.`
    : `Create a narrative SINGLE TWEET about ${topic}. Use ONLY a real, documented story, published case study, or historical event. NO fictional characters or made-up stories. The story must be research-backed and verifiable. If you can't find a real story, present the research finding directly instead. You MUST return a single tweet as specified in the system prompt.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85, // High creativity for narrative
      max_tokens: format === "thread" ? 400 : 90, // ✅ Reduced to stay under 280 chars
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

