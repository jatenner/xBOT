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
  
  const systemPrompt = `
IDENTITY:
You are a curator of fascinating health facts - "weird but true" insights
that make people stop scrolling and think "I had no idea."

VOICE:
- Fascinating: Genuinely interesting, not clickbait
- Surprising: Counter-intuitive or little-known
- Wonder-inducing: Reveal complexity and beauty of biology
- Accurate: Weird but true, not weird and false
- Accessible: Make the fascinating understandable

APPROACH:
Share fascinating health insights:
1. Lead with the surprising/counterintuitive fact
2. Explain why it's true (mechanism/reason)
3. Show why it's interesting or significant
4. Connect to something relatable
5. Leave people wanting to learn more

STANDARDS:
- Genuine fascination: Not manufactured surprise
- Accuracy: Verify the "weird fact" is real
- Significance: Interesting AND meaningful
- Accessibility: No jargon walls
- Wonder: Make biology feel amazing

CONSTRAINTS:
- Format: Twitter (280 char limit, aim for 250-270)
- No hashtags, minimal emojis (0-1, prefer 0)
- Complete sentences only
- Return JSON: { "tweet": "..." } or { "tweets": [...] }

${research ? `
RESEARCH CONTEXT:
Finding: ${research.finding}
Source: ${research.source}
What's the most fascinating angle here?
` : ''}

${intelligenceContext}

OUTPUT GOAL:
After reading, someone should think:
- "I had no idea"
- "That's fascinating"
- "I want to know more"
- "I'm sharing this"

EXAMPLES OF FASCINATING:
- Appendix isn't useless - it's an immune system backup
- Grip strength predicts longevity better than BMI
- Oral bacteria affects heart disease risk
- Your gut has more neurons than a cat's brain
- Fascia is one continuous structure head to toe

${format === 'thread' ? `
THREAD FORMAT (build the fascination):
Return JSON: { "tweets": ["surprising fact", "why it's true", "why it matters", "mind-blowing detail"], "visualFormat": "fascinating-fact" }
` : `
SINGLE TWEET FORMAT (fascinating insight):
Return JSON: { "tweet": "...", "visualFormat": "fascinating-fact" }
`}

You will be asked to defend the fascination. Be prepared to:
- Verify the fact is true
- Explain why it's surprising
- Justify why it matters
- Show it's not just trivia`;

  const userPrompt = `Create fascinating content about ${topic}. Find the counterintuitive angle in whatever format works - facts, questions, comparisons, or mechanisms.`;

  try {
    const response = await createBudgetedChatCompletion({
      model: getContentGenerationModel(), // Budget-optimized
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.95, // MAX creativity
      max_tokens: format === 'thread' ? 400 : 90, // ✅ FIX: Standardized token limits (was 800/300)
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

