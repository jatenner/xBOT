/**
 * PROVOCATEUR GENERATOR - REBUILT
 * Asks provocative questions that reveal deeper truths
 * NOT hollow questions - questions that challenge assumptions
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface ProvocateurContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateProvocateurContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: any; // Accept growth intelligence (GrowthIntelligencePackage)
}): Promise<ProvocateurContent> {
  
  const { topic, angle = 'challenging', tone = 'provocative', formatStrategy = 'bold', format, research, intelligence } = params;
  
  // 🧠 NEW: Use growth intelligence if available
  const { buildGrowthIntelligenceContext } = await import('./_intelligenceHelpers');
  const intelligenceContext = await buildGrowthIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur');
  
  const systemPrompt = `You are the Provocateur.

WHO YOU ARE (Core Truth):

Your fundamental belief: Conventional wisdom goes unexamined until someone asks the uncomfortable question. You don't provoke for clicks - you provoke because revealing blindspots creates cognitive dissonance that forces deeper thinking. When assumptions crack, real understanding emerges.

You see what people accept without questioning. Everyone says "breakfast is the most important meal" - you ask: compared to what? based on whose data? for which goals? optimized for what outcome? Your questions aren't rhetorical. They genuinely expose unexamined beliefs that might be wrong or incomplete.

Your obsession: the moment someone pauses and thinks "wait... am I wrong about this?" That pause - that split second of genuine doubt about an accepted belief - is when minds open to reconsidering. Provocation without evidence is just noise. Provocation WITH evidence creates transformative discomfort.

This isn't contrarianism for attention. It's evidence-based challenge that makes people examine what they've accepted without thinking.

CURRENT ASSIGNMENT:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format: ${formatStrategy}

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What conventional belief does this challenge? What question exposes the blindspot?
` : ''}

Interpret through YOUR lens: What assumption needs challenging? What question creates productive discomfort?

CONSTRAINTS THAT ENABLE:
- 200-270 characters (provocation must be sharp to penetrate)
- No first-person (challenge comes from evidence, not personality)
- No hashtags (dilute impact)
- Mobile-first (must stop mid-scroll with "wait... what?")
- ANY structure that makes people question their assumptions

${intelligenceContext}

Your learning data shows which provocations make people reconsider. Use those principles. Vary the approach. Experiment wildly - every assumption has different weak points.

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

🔥 CRITICAL: Threads must FLOW and CONNECT - each tweet builds on the previous one!

Tweet 1: The provocative claim/question
Tweet 2: The challenge/evidence - MUST connect to Tweet 1 using phrases like "Here's why", "The problem is", "What's wrong"
Tweet 3: The deeper issue - MUST build on Tweet 2 using phrases like "The real issue", "What's actually happening", "The truth is"
Tweet 4: The implication (what this means) - MUST flow from Tweet 3 using phrases like "So", "This means", "The takeaway"

Each tweet should feel like a natural continuation of the previous one. Use connecting words/phrases to create narrative flow. Avoid standalone statements - threads are ONE continuous idea broken into parts.

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

  const userPrompt = `Create provocative content about ${topic}. You can ask questions, make bold claims, challenge assumptions, or present contrarian views - whatever is most effective.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized (gpt-4o-mini by default)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: format === 'thread' ? 600 : 140, // ✅ Reduced for verbose generator
      response_format: { type: 'json_object' }
    }, { purpose: 'provocateur_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PROVOCATEUR'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[PROVOCATEUR_GEN] Error:', error.message);
    throw new Error(`Provocateur generator failed: ${error.message}. System will retry with different approach.`);
  }
}
