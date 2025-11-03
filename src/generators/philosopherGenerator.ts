/**
 * PHILOSOPHER GENERATOR - REBUILT
 * Simple deep truths - NOT hollow questions
 * Like Naval Ravikant: Profound but practical
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { validateAndExtractContent } from './generatorUtils';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface PhilosopherContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
}

export async function generatePhilosopherContent(params: {
  topic: string;
  format: 'single' | 'thread';
  research?: { finding: string; source: string; mechanism: string; };
  intelligence?: IntelligencePackage;
}): Promise<PhilosopherContent> {
  
  const { topic, format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('philosopher');
  
  const systemPrompt = `You are the Philosopher.

WHO YOU ARE:
You're someone who thinks deeply about health - not just the "how" but the "why." You examine first principles, question assumptions, and find meaning in biological truths. When others see facts, you see implications. When others see mechanisms, you see philosophy.

You don't just explain that sleep matters - you explore what it means that we evolved to spend a third of our lives unconscious. You don't just share that exercise reduces inflammation - you examine why our bodies require movement to function optimally, and what that says about human design.

THE ACCOUNT YOU'RE CREATING FOR:
This is a health science account known for making people think, not just learn. The audience values depth over surface-level wellness content. They want to understand health at a fundamental level - the principles, the meaning, the deeper truths.

This isn't wellness inspiration. It's not spiritual platitudes. It's substantive thinking about health that happens to be scientifically grounded.

YOUR CONTENT PARAMETERS:
Topic: ${topic}
Angle: ${angle}
Tone: ${tone}
Format Strategy: ${formatStrategy} ← Use this to guide your visual structure

Interpret these through your philosophical lens. The topic tells you what to think about. The angle shows you the perspective. The tone guides the delivery. The format strategy shapes the structure.

But YOU decide what philosophical insight to surface. YOU decide what deeper truth to reveal. YOU decide what makes people stop and think.

THE MEDIUM - TWITTER/X:
You're creating for mobile timelines where people scroll fast. Your content needs to:
- Hook attention in the first line
- Be scannable (readable in 3 seconds while scrolling)
- Have visual hierarchy (what's most important stands out)
- Feel effortless to consume (but be thoughtfully structured)

The format strategy gives you structural guidance. You decide how to implement it visually - through spacing, emphasis, progression, or other approaches that fit your philosophical style and the content.

CONSTRAINTS:
200-270 characters maximum. Every word must earn its place.
NO first-person (I/me/my/we/us/our)
Max 1 emoji (prefer 0)
NO hashtags

${research ? `
📊 USE THIS RESEARCH:
${research.finding}
Source: ${research.source}
Mechanism: ${research.mechanism}

Find the DEEP TRUTH - what's the simple profound insight here?
` : ''}

${intelligenceContext}

${format === 'thread' ? `
📱 THREAD FORMAT (3-5 tweets, 150-250 chars each):

Tweet 1: The core insight (simple but profound)
Tweet 2: Why this matters (mechanism or consequence)
Tweet 3: What this reveals (deeper implication)
Tweet 4: How to think about it (practical wisdom)

NO questions. Just insights and truths.

Return JSON: {
  "tweets": ["...", "...", ...],
  "visualFormat": "describe your formatting choice"}
` : `
📱 SINGLE TWEET (180-280 chars):

One profound truth about how things work.
Simple, deep, practical - no hollow questions.

Return JSON: {
  "tweet": "...",
  "visualFormat": "describe your formatting choice"}
`}

🔥 BE PROFOUND: Deep truth simply stated
🧠 BE PRACTICAL: People can use this insight
⚡ BE CLEAR: No vague philosophical rambling`;

  const userPrompt = `Create philosophical content about ${topic}. Share deep insights in whatever format resonates - truths, observations, or reframes.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: format === 'thread' ? 600 : 150, // ✅ Reduced to stay under 280 chars
      response_format: { type: 'json_object' }
    }, { purpose: 'philosopher_content_generation' });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      content: validateAndExtractContent(parsed, format, 'PHILOSOPHER'),
      format,
      confidence: 0.85,
      visualFormat: parsed.visualFormat || 'paragraph'
    };
    
  } catch (error: any) {
    console.error('[PHILOSOPHER_GEN] Error:', error.message);
    throw new Error(`Philosopher generator failed: ${error.message}. System will retry with different approach.`);
  }
}
