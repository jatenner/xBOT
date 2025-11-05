/**
 * 🔥 INTERESTING CONTENT GENERATOR
 * 
 * Generates content that's ACTUALLY interesting - not formulaic
 * Think: "What would a smart person tweet that would make you stop scrolling?"
 */

import { createBudgetedChatCompletion } from '../services/openaiBudgetedClient';
import { parseAIJson } from '../utils/aiJsonParser';
import { getGeneratorPatterns } from './generatorSpecificPatterns';
import { getContentGenerationModel } from '../config/modelConfig';
import { IntelligencePackage } from '../intelligence/intelligenceTypes';
import { buildIntelligenceContext } from './_intelligenceHelpers';

export interface InterestingContent {
  content: string | string[];
  format: 'single' | 'thread';
  confidence: number;
  visualFormat?: string;
  metadata: {
    angle: string;
    intrigue_factor: number;
  };
}

export async function generateInterestingContent(params: {
  topic?: string;
  angle?: string;
  tone?: string;
  formatStrategy?: string;
  format: 'single' | 'thread';
  research?: any;
  intelligence?: IntelligencePackage;
}): Promise<InterestingContent> {
  
  const { topic, angle = 'counterintuitive', tone = 'intriguing', formatStrategy = 'surprising', format, research, intelligence } = params;
  const intelligenceContext = await buildIntelligenceContext(intelligence);
  
  const patterns = getGeneratorPatterns('provocateur'); // Use provocateur patterns for interesting content
  
  const systemPrompt = `You find what's genuinely surprising.

Core rule: Must be actually interesting, not just clickbait.

You've been given:
- Topic: ${topic}
- Tone: ${tone}
- Angle: ${angle}
- Format strategy: ${formatStrategy}

${research ? `
Research available:
${research.finding}
Source: ${research.source}
` : ''}

${intelligenceContext}

Interpret these through your curiosity. Find what makes people stop scrolling.
How you surprise them is up to you.

${format === 'thread' ? `
THREAD FORMAT (3-5 tweets, 150-250 chars each):
Return JSON: { "tweets": ["...", "...", ...], "visualFormat": "describe approach" }
` : `
Return JSON: { "tweet": "...", "visualFormat": "describe approach" }
`}

Constraints:
- 200-270 characters max per tweet
- No first-person (I/me/my)
- No hashtags
- Max 1 emoji (prefer 0)`;

  const userPrompt = `Create fascinating content about ${topic}. Find the counterintuitive angle in whatever format works - facts, questions, comparisons, or mechanisms.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.95, // MAX creativity
      max_tokens: format === 'thread' ? 800 : 300,
      response_format: { type: 'json_object' }
    }, { purpose: 'interesting_content_generation' });

    const parsed = parseAIJson(response.choices[0].message.content || '{}');
    
    const content = format === 'thread' 
      ? (parsed.tweets || parsed.thread || ['Interesting fact coming soon'])
      : (parsed.tweet || parsed.content || 'Interesting fact coming soon');

    return {
      content,
      format,
      confidence: 0.9,
      visualFormat: parsed.visualFormat || 'standard',
      metadata: {
        angle: parsed.angle || 'counterintuitive',
        intrigue_factor: parsed.intrigue_factor || 8
      }
    };
    
  } catch (error: any) {
    console.error('[INTERESTING_GEN] Error:', error.message);
    throw new Error(`Interesting content generation failed: ${error.message}`);
  }
}

/**
 * Generate content with multiple attempts to find the most interesting angle
 */
export async function generateBestInterestingContent(params: {
  topic?: string;
  format: 'single' | 'thread';
  research?: any;
  attempts?: number;
}): Promise<InterestingContent> {
  
  const attempts = params.attempts || 2;
  const candidates: InterestingContent[] = [];
  
  console.log(`[INTERESTING_GEN] Generating ${attempts} variations to find best angle...`);
  
  // Generate multiple variations
  for (let i = 0; i < attempts; i++) {
    try {
      const content = await generateInterestingContent(params);
      candidates.push(content);
      console.log(`[INTERESTING_GEN] Variation ${i+1}: "${Array.isArray(content.content) ? content.content[0] : content.content.substring(0, 60)}..."`);
    } catch (error) {
      console.warn(`[INTERESTING_GEN] Variation ${i+1} failed`);
    }
  }
  
  if (candidates.length === 0) {
    throw new Error('All interesting content generation attempts failed');
  }
  
  // Pick the one with highest intrigue factor
  const best = candidates.sort((a, b) => 
    b.metadata.intrigue_factor - a.metadata.intrigue_factor
  )[0];
  
  console.log(`[INTERESTING_GEN] ✅ Selected best variation (intrigue: ${best.metadata.intrigue_factor}/10)`);
  
  return best;
}

