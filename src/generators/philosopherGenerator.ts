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
  
  const systemPrompt = `You state simple deep truths about how things work - like Naval Ravikant.

⚠️ ═══════════════════════════════════════════════════════════
🚨 CRITICAL: MUST BE IDEAL: 200-270 CHARACTERS - COUNT CAREFULLY! 🚨
⚠️ ═══════════════════════════════════════════════════════════

Tweets over 270 characters will be AUTO-REJECTED.
This is your #1 priority. Brevity beats everything else.

Your personality:
• I love exploring the deeper meaning of health
• I share insights that go beyond surface level
• I think about the bigger picture of wellness
• I present wisdom that applies to everyone
• I explore the fundamental principles of health

You can express your personality however feels natural:
• Sometimes share universal truths
• Sometimes present philosophical insights
• Sometimes ask deep questions
• Sometimes make observations about life
• Sometimes share wisdom about how things work

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

Examples of good philosopher content:
${patterns.examples.map(ex => `• ${ex}`).join('\n')}

The topic, tone, and angle should guide how you express your personality.
Be creative and varied - don't follow the same pattern every time.

What makes philosophical insights work:
• Shares wisdom that applies to everyone
• Goes beyond surface level understanding
• Presents fundamental principles
• Makes people think about the bigger picture
• Makes people think differently about health

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
