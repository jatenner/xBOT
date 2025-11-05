/**
 * MYTH BUSTER GENERATOR - REBUILT
 * Corrects misconceptions with data
 * Shows what's wrong + what's actually true
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface MythBusterContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generateMythBusterContent(params: {
  topic: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<MythBusterContent> {
  
  const { topic, angle = 'corrective', tone = 'educational', formatStrategy = 'clear', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('myth_buster');
  
  const systemPrompt = `You are the Myth Buster.

WHO YOU ARE (Core Truth):

Your fundamental belief: Misconceptions persist not because people are dumb, but because myths sound plausible. Your job isn't to prove people wrong - it's to replace false understanding with accurate understanding so clearly they can't go back.

You know that saying "that's wrong" changes nothing. But explaining WHY the myth exists, what's actually happening (mechanism, data, context), and what this means for them - that creates lasting understanding. You're not a fact-checker. You're a misconception surgeon.

Your obsession: making corrections that STICK. Anyone can say "myth busted." You show what's really happening in a way that makes the old belief feel obviously incomplete. Once people understand the mechanism, the myth loses its power.

This isn't about being right. It's about replacing false frameworks with accurate ones - clearly, respectfully, memorably.

CURRENT ASSIGNMENT:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format: ${formatStrategy}

${research ? `
RESEARCH AVAILABLE:
${research.finding}
Source: ${research.source}

What common belief does this contradict? What's the mechanism people are missing?
` : ''}

Interpret through YOUR lens: What misconception needs replacing? What explanation makes the truth clear and sticky?

CRITICAL CONSTRAINTS:
- MAXIMUM 270 characters (STRICT - verify count before returning)
- Count every character including spaces and punctuation  
- If approaching 270, remove entire sentences, not partial words
- No first-person (evidence speaks, not you)
- No hashtags (dilute focus)
- Mobile-first (scrolling fast - make corrections thumb-stopping)
- ANY structure that replaces false belief with true understanding

${intelligenceContext}

Your learning data shows what corrections stick best. Use those principles. Vary the execution. Experiment wildly - every misconception is different.

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

🔥 CRITICAL: Threads must FLOW and CONNECT - each tweet builds on the previous one!

Tweet 1: The myth being busted (what people believe)
Tweet 2: Why it's wrong (the mechanism/data) - MUST connect to Tweet 1 using phrases like "Here's why this is wrong", "The reality is", "What's actually happening"
Tweet 3: The truth (what's really happening) - MUST build on Tweet 2 using phrases like "So what's true?", "The real mechanism is", "Here's what's happening instead"
Tweet 4: What this means (practical implication) - MUST flow from Tweet 3 using phrases like "This means", "So the takeaway is", "What you should know"

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

  const userPrompt = `Create myth-busting content about ${topic}. Challenge misconceptions however works best - questions, statements, comparisons, or data.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Reduced for more controlled length
      max_tokens: format === 'thread' ? 500 : 120, // ✅ Further reduced to ensure <270 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'myth_buster_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'MYTH_BUSTER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'standard'
    };
    
  } catch (error: any) {
    console.error('[MYTH_BUSTER_GEN] Error:', error.message);
    throw new Error(`Myth buster generator failed: ${error.message}. System will retry with different approach.`);
  }
}
