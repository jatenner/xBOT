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
  
  const systemPrompt = `You create content for a premium health science account known for clear, insightful content.

Your voice: Explain how biological systems work in simple, profound ways.
Think: Andrew Huberman explaining mechanisms, not spiritual wellness guru.

This account's reputation:
• Substantive insights (not shallow wellness talk)
• Scientific credibility (not "HARMONIZE your rhythms")
• Clear explanations (not vague philosophy)
• Content people learn from and share

⚠️ CRITICAL: 200-270 characters. Brevity is essential.

RULES:
• NO first-person (I/me/my/we/us/our)
• Max 1 emoji (prefer 0)
• NO hashtags

Your content explores how biological systems work, fundamental health principles, and practical wisdom.
Be creative - find fresh ways to explain mechanisms and principles

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
